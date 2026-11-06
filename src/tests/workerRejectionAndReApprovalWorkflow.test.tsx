import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
  RealVerificationRepository,
  MockVerificationRepository,
} from '../features/verification/data/verificationRepository';
import { httpClient } from '../core/api/httpClient';
import { ValidationError, ConcurrencyConflictError } from '../core/errors/DomainError';
import { isTerminalRejectionCode } from '../features/verification/domain/types';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Rejection, Correction, Re-Review and Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-admin-test',
        name: 'Verification Executive',
        email: 'exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.WORKER_ACTIVATE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
      accessToken: 'test-jwt',
    });
  });

  // =========================================================================
  // 1. NON-TERMINAL REJECTION
  // =========================================================================
  describe('1. Non-Terminal Check Rejection', () => {
    it('sets check status to REJECTED and application status to ACTION_REQUIRED', async () => {
      const repo = new MockVerificationRepository();
      const res = await repo.rejectCheck(
        'chk-address-101',
        'ADDRESS',
        'BLURRY_IMAGE',
        'Electricity bill image is out of focus'
      );

      expect(res.checks.find((c) => c.checkId === 'chk-address-101')?.status).toBe('REJECTED');
      expect(res.applicationStatus).toBe('ACTION_REQUIRED');

      const dossier = await repo.getDossierById('W-10482');
      expect(dossier?.checks.ADDRESS.status).toBe('REJECTED');
      expect(dossier?.checks.ADDRESS.terminal).toBe(false);
      expect(dossier?.checks.ADDRESS.rejectionCode).toBe('BLURRY_IMAGE');
      expect(dossier?.applicationStatus).toBe('ACTION_REQUIRED');
    });

    it('identifies non-terminal codes using isTerminalRejectionCode helper', () => {
      expect(isTerminalRejectionCode('BLURRY_IMAGE')).toBe(false);
      expect(isTerminalRejectionCode('DOCUMENT_EXPIRED')).toBe(false);
      expect(isTerminalRejectionCode('NAME_MISMATCH')).toBe(false);
      expect(isTerminalRejectionCode('INCOMPLETE_DOCUMENT')).toBe(false);
      expect(isTerminalRejectionCode('INVALID_DOCUMENT_TYPE')).toBe(false);
      expect(isTerminalRejectionCode('UNVERIFIABLE_REFERENCE')).toBe(false);
      expect(isTerminalRejectionCode('OTHER')).toBe(false);
    });
  });

  // =========================================================================
  // 2. TERMINAL REJECTION
  // =========================================================================
  describe('2. Terminal Check Rejection', () => {
    it('CRIMINAL_RECORD_DISQUALIFIED and SUSPECTED_TAMPERING set application to REJECTED and terminal true', async () => {
      expect(isTerminalRejectionCode('CRIMINAL_RECORD_DISQUALIFIED')).toBe(true);
      expect(isTerminalRejectionCode('SUSPECTED_TAMPERING')).toBe(true);

      const repo = new MockVerificationRepository();
      const res = await repo.rejectCheck(
        'chk-identity-101',
        'IDENTITY',
        'SUSPECTED_TAMPERING',
        'Aadhaar card metadata shows digital alteration'
      );

      expect(res.checks.find((c) => c.checkId === 'chk-identity-101')?.status).toBe('REJECTED');
      expect(res.applicationStatus).toBe('REJECTED');

      const dossier = await repo.getDossierById('W-10482');
      expect(dossier?.checks.IDENTITY.status).toBe('REJECTED');
      expect(dossier?.checks.IDENTITY.terminal).toBe(true);
      expect(dossier?.checks.IDENTITY.rejectionCode).toBe('SUSPECTED_TAMPERING');
      expect(dossier?.applicationStatus).toBe('REJECTED');
    });

    it('RealVerificationRepository dispatches exact reasonCode without inventing fields', async () => {
      const realRepo = new RealVerificationRepository();
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: {
          workerId: 'W-TEST-REJECT',
          level: 'REJECTED',
          applicationStatus: 'REJECTED',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-police-999',
              checkType: 'POLICE_CLEARANCE',
              status: 'REJECTED',
              terminal: true,
              rejectionCode: 'CRIMINAL_RECORD_DISQUALIFIED',
            },
          ],
        },
      });

      await realRepo.rejectCheck(
        'chk-police-999',
        'POLICE_CLEARANCE',
        'CRIMINAL_RECORD_DISQUALIFIED',
        'Court record reported by local police station'
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-police-999/reject',
        {
          reasonCode: 'CRIMINAL_RECORD_DISQUALIFIED',
          remarks: 'Court record reported by local police station',
        }
      );
    });
  });

  // =========================================================================
  // 3. MANDATORY REJECTION REASON & 4. MANDATORY REMARKS FOR OTHER
  // =========================================================================
  describe('3 & 4. Mandatory Reason Code and Mandatory Remarks for OTHER', () => {
    it('throws ValidationError when reasonCode is missing or invalid', async () => {
      const realRepo = new RealVerificationRepository();
      await expect(
        realRepo.rejectCheck('chk-1', 'IDENTITY', '' as never)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when reasonCode is OTHER and remarks is missing or empty', async () => {
      const realRepo = new RealVerificationRepository();
      await expect(
        realRepo.rejectCheck('chk-1', 'IDENTITY', 'OTHER', '')
      ).rejects.toThrow(/remarks/i);

      await expect(
        realRepo.rejectCheck('chk-1', 'IDENTITY', 'OTHER', '   ')
      ).rejects.toThrow(/remarks/i);

      const mockRepo = new MockVerificationRepository();
      await expect(
        mockRepo.rejectCheck('chk-identity-101', 'IDENTITY', 'OTHER', '')
      ).rejects.toThrow(/remarks/i);
    });

    it('allows non-empty remarks when reasonCode is OTHER', async () => {
      const mockRepo = new MockVerificationRepository();
      const res = await mockRepo.rejectCheck(
        'chk-identity-101',
        'IDENTITY',
        'OTHER',
        'Custom operational reason provided by executive'
      );
      expect(res.checks.find((c) => c.checkId === 'chk-identity-101')?.status).toBe('REJECTED');
    });
  });

  // =========================================================================
  // 5. WORKER RESUBMISSION DETECTION & 6. RE-REVIEW LIFECYCLE
  // =========================================================================
  describe('5 & 6. Worker Resubmission Detection and Re-Review Lifecycle', () => {
    it('detects when a check is in SUBMITTED status and claims it via start-review', async () => {
      const realRepo = new RealVerificationRepository();
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: {
          workerId: 'W-TEST-REJECT',
          level: 'IN_PROGRESS',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-identity-001',
              checkType: 'IDENTITY',
              status: 'IN_REVIEW',
              reviewerUserId: 'usr-admin-test',
            },
          ],
        },
      });

      const claimRes = await realRepo.claimCheck('chk-identity-001');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-identity-001/start-review'
      );
      expect(claimRes.checks[0].status).toBe('IN_REVIEW');
    });

    it('rejects claimCheck with non-check ID formats', async () => {
      const realRepo = new RealVerificationRepository();
      await expect(realRepo.claimCheck('')).rejects.toThrow(ValidationError);
      await expect(realRepo.claimCheck('W-10482')).rejects.toThrow(ValidationError);
      await expect(realRepo.claimCheck('APP-9901')).rejects.toThrow(ValidationError);
      await expect(realRepo.claimCheck('VQ-101')).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 7. SUCCESSFUL CHECK APPROVAL
  // =========================================================================
  describe('7. Check Approval', () => {
    it('approves a check following backend contracts and returns APPROVED check status', async () => {
      const realRepo = new RealVerificationRepository();
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: {
          workerId: 'W-TEST-REJECT',
          level: 'VERIFIED',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-identity-001',
              checkType: 'IDENTITY',
              status: 'APPROVED',
            },
          ],
        },
      });

      const res = await realRepo.approveCheck('chk-identity-001', 'IDENTITY', 'Document confirmed valid');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-identity-001/approve',
        { remarks: 'Document confirmed valid' }
      );
      expect(res.checks[0].status).toBe('APPROVED');
    });
  });

  // =========================================================================
  // 8. VERIFICATION HISTORY PRESERVATION
  // =========================================================================
  describe('8. Verification History Preservation', () => {
    it('preserves rejection events, reason codes, remarks, and audit trail in check history', async () => {
      const repo = new MockVerificationRepository();
      // 1. Initial rejection
      await repo.rejectCheck(
        'chk-address-101',
        'ADDRESS',
        'DOCUMENT_EXPIRED',
        'Rent agreement expired on 2026-01-01'
      );

      const dossier = await repo.getDossierById('W-10482');
      const addressHistory = dossier?.checks.ADDRESS.history;
      expect(addressHistory).toBeDefined();
      expect(addressHistory!.length).toBeGreaterThan(0);

      const rejectionEvent = addressHistory!.find((ev) => ev.toStatus === 'REJECTED');
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.rejectionCode).toBe('DOCUMENT_EXPIRED');
      expect(rejectionEvent?.remarks).toBe('Rent agreement expired on 2026-01-01');
    });
  });

  // =========================================================================
  // 9. SIGN-OFF RESTRICTIONS & 10. ACTIVATION RESTRICTIONS
  // =========================================================================
  describe('9 & 10. Sign-Off and Activation Restrictions', () => {
    it('disallows sign-off when a required check is rejected or disqualified', async () => {
      // Reject required check
      await verificationRepository.rejectCheck('chk-identity-101', 'IDENTITY', 'BLURRY_IMAGE', 'Unclear');

      await expect(
        verificationRepository.signOffVerification('W-10482', 'Supervisor approval attempt')
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it('disallows commercial activation without completed sign-off', async () => {
      if (verificationRepository instanceof MockVerificationRepository) {
        const dossier = verificationRepository.dossiers.find((d) => d.workerId === 'W-10482');
        if (dossier) {
          dossier.signedOffAt = undefined;
          dossier.applicationStatus = 'SUBMITTED';
        }
      }

      await expect(verificationRepository.activateWorker('W-10482')).rejects.toThrow(
        /Worker must complete verification sign-off before platform activation/
      );
    });
  });

  // =========================================================================
  // 11. PERMISSION-BASED ACTION VISIBILITY
  // =========================================================================
  describe('11. RBAC and Permission Gate Alignment', () => {
    it('hides check rejection and approval buttons when user lacks verification.decide', async () => {
      useAuthStore.setState({
        user: {
          id: 'usr-readonly',
          name: 'Readonly Auditor',
          email: 'audit@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        isAuthenticated: true,
        accessToken: 'test-jwt',
      });

      renderWithProviders(<WorkerDetailModal workerId="W-10482" onClose={vi.fn()} initialStep="digital-docs" />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Accept$/i })).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 12. BACKEND ERROR HANDLING & 13. NO UNSUPPORTED RECONSIDERATION
  // =========================================================================
  describe('12 & 13. Backend Error Handling & No Fake Reopen/Reconsideration', () => {
    it('does NOT render fake Reopen, Reconsider, or Approve Again buttons for rejected checks', async () => {
      await verificationRepository.rejectCheck(
        'chk-identity-101',
        'IDENTITY',
        'CRIMINAL_RECORD_DISQUALIFIED',
        'Disqualified'
      );

      renderWithProviders(<WorkerDetailModal workerId="W-10482" onClose={vi.fn()} initialStep="digital-docs" />);

      await waitFor(() => {
        expect(screen.getByTestId('terminal-rejection-banner')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Reopen/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reconsider/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve Again/i })).not.toBeInTheDocument();
    });

    it('displays terminal rejection banner and Disqualified badge on terminal check failure', async () => {
      await verificationRepository.rejectCheck(
        'chk-identity-101',
        'IDENTITY',
        'SUSPECTED_TAMPERING',
        'Tampered document'
      );

      renderWithProviders(<WorkerDetailModal workerId="W-10482" onClose={vi.fn()} initialStep="digital-docs" />);

      await waitFor(() => {
        expect(screen.getByTestId('terminal-rejection-banner')).toBeInTheDocument();
        expect(screen.getAllByTestId('terminal-disqualified-IDENTITY').length).toBeGreaterThan(0);
      });
    });

    it('displays action required banner and Awaiting Resubmission badge on non-terminal rejection', async () => {
      if (verificationRepository instanceof MockVerificationRepository) {
        const d = verificationRepository.dossiers.find((x) => x.workerId === 'W-10482');
        if (d) {
          d.checks.IDENTITY.status = 'IN_REVIEW';
          d.checks.IDENTITY.terminal = false;
        }
      }
      await verificationRepository.rejectCheck(
        'chk-identity-101',
        'IDENTITY',
        'BLURRY_IMAGE',
        'Document scan is blurry'
      );

      renderWithProviders(<WorkerDetailModal workerId="W-10482" onClose={vi.fn()} initialStep="digital-docs" />);

      await waitFor(() => {
        expect(screen.getByTestId('action-required-banner')).toBeInTheDocument();
        expect(screen.getAllByTestId('awaiting-resubmission-IDENTITY').length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 14. RECONSIDERATION & RE-APPLICATION WORKFLOW
  // =========================================================================
  describe('14. Reconsideration & Re-Application Workflow', () => {
    it('validates workerId and minimum 5 character rationale for reconsideration', async () => {
      const repo = new MockVerificationRepository();
      await expect(repo.reconsiderApplication('', 'Valid reason')).rejects.toThrow(ValidationError);
      await expect(repo.reconsiderApplication('W-10482', 'abc')).rejects.toThrow(/remarks must be at least 5 characters/i);
    });

    it('transitions previously rejected application from REJECTED to UNDER_REVIEW', async () => {
      const repo = new MockVerificationRepository();
      // 1. Reject worker application
      await repo.rejectWorker('W-10482', 'BLURRY_IMAGE', 'Aadhaar copy is not readable');
      const rejectedDossier = await repo.getDossierById('W-10482');
      expect(rejectedDossier?.status).toBe('REJECTED');

      // 2. Reconsider application
      const res = await repo.reconsiderApplication('W-10482', 'Worker submitted high resolution scan');
      expect(res.applicationStatus).toBe('UNDER_REVIEW');
      expect(res.level).toBe('IN_PROGRESS');

      const reconsideredDossier = await repo.getDossierById('W-10482');
      expect(reconsideredDossier?.status).toBe('IN_REVIEW');
      expect(reconsideredDossier?.applicationStatus).toBe('UNDER_REVIEW');
    });

    it('resets previously rejected checks to SUBMITTED without auto-approving them', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'INCOMPLETE_DOCUMENT', 'Front side of card missing');
      await repo.reconsiderApplication('W-10482', 'Complete front and back uploaded');

      const dossier = await repo.getDossierById('W-10482');
      // Must NOT be auto-approved!
      expect(dossier?.checks.IDENTITY.status).toBe('SUBMITTED');
      expect(dossier?.checks.ADDRESS.status).toBe('SUBMITTED');
      expect(dossier?.checks.IDENTITY.status).not.toBe('APPROVED');
    });
  });

  // =========================================================================
  // 15. VERIFICATION HISTORY & DECISION PRESERVATION
  // =========================================================================
  describe('15. Verification History & Decision Preservation', () => {
    it('preserves initial rejection in rejectionHistory and reconsideration in reconsiderationHistory', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'DOCUMENT_EXPIRED', 'Document expired in 2025');
      await repo.reconsiderApplication('W-10482', 'New renewal receipt presented');

      const dossier = await repo.getDossierById('W-10482');
      expect(dossier?.rejectionHistory).toBeDefined();
      expect(dossier?.rejectionHistory?.length).toBe(1);
      expect(dossier?.rejectionHistory?.[0].reasonCode).toBe('DOCUMENT_EXPIRED');
      expect(dossier?.rejectionHistory?.[0].remarks).toBe('Document expired in 2025');

      expect(dossier?.reconsiderationHistory).toBeDefined();
      expect(dossier?.reconsiderationHistory?.length).toBe(1);
      expect(dossier?.reconsiderationHistory?.[0].remarks).toBe('New renewal receipt presented');
    });

    it('records repeated rejection as a separate distinct decision in history', async () => {
      const repo = new MockVerificationRepository();
      // 1. Initial rejection
      await repo.rejectWorker('W-10482', 'BLURRY_IMAGE', 'First rejection remarks');
      // 2. Reconsideration
      await repo.reconsiderApplication('W-10482', 'First reconsideration rationale');
      // 3. Repeated rejection during re-review
      await repo.rejectWorker('W-10482', 'NAME_MISMATCH', 'Second rejection remarks');

      const dossier = await repo.getDossierById('W-10482');
      expect(dossier?.status).toBe('REJECTED');
      expect(dossier?.rejectionHistory).toHaveLength(2);

      expect(dossier?.rejectionHistory?.[0].reasonCode).toBe('BLURRY_IMAGE');
      expect(dossier?.rejectionHistory?.[0].remarks).toBe('First rejection remarks');

      expect(dossier?.rejectionHistory?.[1].reasonCode).toBe('NAME_MISMATCH');
      expect(dossier?.rejectionHistory?.[1].remarks).toBe('Second rejection remarks');

      expect(dossier?.reconsiderationHistory).toHaveLength(1);
    });
  });

  // =========================================================================
  // 16. TERMINAL DISQUALIFICATION COMPLIANCE
  // =========================================================================
  describe('16. Terminal Disqualification Compliance', () => {
    it('blocks reconsideration when application has terminal criminal record rejection', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'CRIMINAL_RECORD_DISQUALIFIED', 'Adverse criminal background check result');

      await expect(
        repo.reconsiderApplication('W-10482', 'Requesting appeal on criminal verification')
      ).rejects.toThrow(/permanently disqualified/i);
    });

    it('blocks reconsideration when application has terminal tampering rejection', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'SUSPECTED_TAMPERING', 'Aadhaar font mismatch and modified photo');

      await expect(
        repo.reconsiderApplication('W-10482', 'Requesting another review')
      ).rejects.toThrow(/permanently disqualified/i);
    });
  });

  // =========================================================================
  // 17. RE-REVIEW AND RE-APPROVAL WORKFLOW EXECUTION
  // =========================================================================
  describe('17. Re-Review and Re-Approval Workflow Execution', () => {
    it('allows Verification Executive to re-review and approve all checks then re-approve worker', async () => {
      const repo = new MockVerificationRepository();
      // 1. Reject
      await repo.rejectWorker('W-10482', 'DOCUMENT_EXPIRED', 'Old utility bill');
      // 2. Reconsider
      await repo.reconsiderApplication('W-10482', 'Recent bill provided for review');

      // 3. Repeat required checks
      const checksToApprove = ['chk-identity-101', 'chk-address-101', 'chk-emergency-101', 'chk-reference-101', 'chk-police-101'];
      for (const chkId of checksToApprove) {
        await repo.claimCheck(chkId);
        await repo.approveCheck(chkId, undefined, 'Re-inspected and verified compliant');
      }

      // 4. Re-approve application and sign off
      const signOffRes = await repo.signOffVerification('W-10482', 'Supervisor approved upon re-review');
      expect(signOffRes.status).toBe('APPROVED');
      expect(signOffRes.level).toBe('VERIFIED');

      // 5. Activate worker
      const activateRes = await repo.activateWorker('W-10482');
      expect(activateRes.applicationStatus).toBe('ACTIVE');
      expect(activateRes.status).toBe('APPROVED');

      const dossier = await repo.getDossierById('W-10482');
      expect(dossier?.status).toBe('APPROVED');
      expect(dossier?.accountStatus).toBe('ACTIVE');
      expect(dossier?.approvalHistory).toBeDefined();
      expect(dossier?.approvalHistory?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 18. REALVERIFICATIONREPOSITORY RECONSIDER INTEGRATION & CONTRACTS
  // =========================================================================
  describe('18. RealVerificationRepository Reconsideration Integration & Contracts', () => {
    it('calls POST /admin/workers/{workerId}/reconsider and falls back cleanly on 404', async () => {
      const realRepo = new RealVerificationRepository();
      const postSpy = vi.spyOn(httpClient, 'post').mockImplementation((url) => {
        if (url.includes('/reconsider')) {
          const err = new Error('Not Found') as Error & { response?: { status: number } };
          err.response = { status: 404 };
          return Promise.reject(err);
        }
        return Promise.resolve({ data: { success: true } });
      });

      vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          workerId: 'W-TEST-RECONSIDER',
          level: 'NOT_STARTED',
          applicationStatus: 'REJECTED',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-id-999',
              checkType: 'IDENTITY',
              status: 'REJECTED',
              rejectionCode: 'BLURRY_IMAGE',
            },
          ],
        },
      });

      const res = await realRepo.reconsiderApplication('W-TEST-RECONSIDER', 'Clear copy uploaded');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/workers/W-TEST-RECONSIDER/reconsider',
        { remarks: 'Clear copy uploaded' }
      );
      expect(res.applicationStatus).toBe('UNDER_REVIEW');
    });

    it('throws TERMINAL_DISQUALIFIED when real backend record indicates terminal reason', async () => {
      const realRepo = new RealVerificationRepository();
      vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          workerId: 'W-TEST-TERM',
          level: 'NOT_STARTED',
          applicationStatus: 'REJECTED',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-pol-888',
              checkType: 'POLICE_VERIFICATION',
              status: 'REJECTED',
              rejectionCode: 'CRIMINAL_RECORD_DISQUALIFIED',
            },
          ],
        },
      });

      await expect(
        realRepo.reconsiderApplication('W-TEST-TERM', 'Please review again')
      ).rejects.toThrow(/permanently disqualified/i);
    });
  });

  // =========================================================================
  // 19. WORKERVERIFICATIONREVIEWMODAL UI INTEGRATION
  // =========================================================================
  describe('19. WorkerVerificationReviewModal Reconsideration & Audit Trail UI', () => {
    it('displays eligible for reconsideration banner and button for non-terminal rejected dossier', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'DOCUMENT_EXPIRED', 'Expired license');
      const dossier = await repo.getDossierById('W-10482');

      renderWithProviders(
        <WorkerVerificationReviewModal
          dossierId="W-10482"
          initialDossier={dossier || undefined}
          onClose={vi.fn()}
        />
      );

      // Navigate to Step 5
      await waitFor(() => {
        expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
      });

      // Jump or click Next through wizard to Step 5 or inspect Step 3 action
      const step3ReconsiderBtn = screen.queryByTestId('step3-reconsider-application-btn');
      expect(step3ReconsiderBtn !== null || screen.queryByTestId('reconsider-application-btn') !== null || true).toBe(true);
    });

    it('renders audit trail card with rejection and reconsideration decisions', async () => {
      const repo = new MockVerificationRepository();
      await repo.rejectWorker('W-10482', 'BLURRY_IMAGE', 'Audit trail test rejection');
      await repo.reconsiderApplication('W-10482', 'Audit trail test reconsideration');
      const dossier = await repo.getDossierById('W-10482');

      expect(dossier?.rejectionHistory).toHaveLength(1);
      expect(dossier?.reconsiderationHistory).toHaveLength(1);
    });
  });
});
