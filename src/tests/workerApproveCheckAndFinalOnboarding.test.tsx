import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
  RealVerificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  workerRepository,
} from '../features/workers/data/workerRepository';
import { httpClient } from '../core/api/httpClient';
import { ValidationError } from '../core/errors/DomainError';
import { AdminWorkerVerificationResponse } from '../features/verification/domain/types';

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

const mockWorkerBase = {
  id: 'W-TEST-ONBOARD',
  name: 'Meena Sharma',
  category: 'Cook',
  categories: ['Cook'],
  experienceYears: 4,
  ratingAverage: 4.8,
  totalReviews: 12,
  locality: 'Banjara Hills',
  serviceRadiusKm: 6,
  languages: ['Hindi', 'Telugu'],
  bio: 'Experienced cook',
  isFullyVerified: false,
  status: 'SUSPENDED' as const,
  onboardingStatus: 'IN_REVIEW' as const,
  phoneMasked: '+91 98765 *****',
  documents: [],
  verification: {
    phoneOtpVerified: true,
    identityProofStatus: 'PENDING' as const,
    addressProofStatus: 'PENDING' as const,
    criminalRecordStatus: 'PENDING' as const,
    skillProofStatus: 'NOT_APPLICABLE' as const,
    referenceCheckStatus: 'PENDING' as const,
  },
  activeEngagementsCount: 0,
  completedBookingsCount: 0,
  replacementsIncurred: 0,
  recentEngagements: [],
  internalNotes: [],
};

const mockDossierPending = {
  id: 'W-TEST-ONBOARD',
  applicationId: 'APP-TEST-ONBOARD',
  workerId: 'W-TEST-ONBOARD',
  workerName: 'Meena Sharma',
  category: 'Cook',
  locality: 'Banjara Hills',
  experienceYears: 4,
  phoneMasked: '+91 98765 *****',
  submissionTime: new Date().toISOString(),
  status: 'PENDING_REVIEW' as const,
  level: 'IN_PROGRESS' as const,
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: { id: 'chk-id-101', type: 'IDENTITY' as const, title: 'Identity Proof', status: 'PENDING' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
    ADDRESS: { id: 'chk-addr-102', type: 'ADDRESS' as const, title: 'Address Proof', status: 'PENDING' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
    EMERGENCY_CONTACT: { id: 'chk-em-103', type: 'EMERGENCY_CONTACT' as const, title: 'Emergency Contact', status: 'PENDING' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
    REFERENCE: { id: 'chk-ref-104', type: 'REFERENCE' as const, title: 'Reference', status: 'PENDING' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
    POLICE_CLEARANCE: { id: 'chk-pol-105', type: 'POLICE_CLEARANCE' as const, title: 'Police Certificate', status: 'PENDING' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
  },
};

const mockDossierAllApproved = {
  ...mockDossierPending,
  status: 'APPROVED' as const,
  level: 'LEVEL_3' as const,
  checks: {
    IDENTITY: { id: 'chk-id-101', type: 'IDENTITY' as const, title: 'Identity Proof', status: 'APPROVED' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
    ADDRESS: { id: 'chk-addr-102', type: 'ADDRESS' as const, title: 'Address Proof', status: 'APPROVED' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
    EMERGENCY_CONTACT: { id: 'chk-em-103', type: 'EMERGENCY_CONTACT' as const, title: 'Emergency Contact', status: 'APPROVED' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
    REFERENCE: { id: 'chk-ref-104', type: 'REFERENCE' as const, title: 'Reference', status: 'APPROVED' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
    POLICE_CLEARANCE: { id: 'chk-pol-105', type: 'POLICE_CLEARANCE' as const, title: 'Police Certificate', status: 'APPROVED' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
  },
};

describe('Worker Approve Check Behavior and Final Worker Onboarding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Senior Verification Executive',
        email: 'verif.exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Individual Check Approval Lifecycle and Popup Persistence', () => {
    it('invokes correct API with checkId, does NOT close popup on approval, and updates check status', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValueOnce(undefined);

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      // Navigate to Step 3: Verification Checklist
      const step3Pill = await screen.findByRole('button', { name: /Verification Checklist/i });
      await user.click(step3Pill);

      expect(await screen.findByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();

      // Click Approve Check on the active Identity Check
      const approveButtons = await screen.findAllByRole('button', { name: /^Approve Check$/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      await user.click(approveButtons[0]);

      // ConfirmDialog opens
      expect(await screen.findByRole('button', { name: /Confirm Approval/i })).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Verify repository was called with correct check ID
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-id-101',
        'IDENTITY',
        expect.any(String)
      );

      // CRITICAL: Ensure the worker modal was NOT closed!
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Confirm success feedback banner is displayed
      await waitFor(() => {
        expect(screen.getByText(/successfully approved by the backend/i)).toBeInTheDocument();
      });

      // Confirm modal popup is still fully rendered and active in DOM
      expect(screen.getByText(/Meena Sharma/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();
    });

    it('keeps popup open and displays error feedback when approval fails', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();
      vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValueOnce(
        new Error('Backend verification service timeout (HTTP 504)')
      );

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      // Navigate to Step 3
      const step3Pill = await screen.findByRole('button', { name: /Verification Checklist/i });
      await user.click(step3Pill);

      // Click Approve Check
      const approveButtons = await screen.findAllByRole('button', { name: /^Approve Check$/i });
      await user.click(approveButtons[0]);

      // Confirm in dialog
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Verify modal did NOT close
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Verify error feedback is displayed
      await waitFor(() => {
        expect(screen.getAllByText(/Backend verification service timeout \(HTTP 504\)/i).length).toBeGreaterThan(0);
      });

      // Verify modal still open and retry is possible
      expect(screen.getByRole('heading', { name: /Meena Sharma/i })).toBeInTheDocument();
      expect(screen.getByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();
    });

    it('transmits exact ApproveCheckDto payload ({ remarks, recheckAt? }) and strictly strips non-whitelisted fields', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          workerId: '01a166eb-8f68-7543-b394-a86124c4e66a',
          level: 'IN_PROGRESS',
          requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
          checks: [
            {
              checkId: '01a166fb-5c87-7265-8036-b68ac96d1880',
              checkType: 'PREVIOUS_EMPLOYMENT',
              status: 'APPROVED',
              required: true,
              submittedAt: '2026-10-27T05:07:00Z',
              reviewedAt: '2026-10-27T07:15:00Z',
              remarks: 'Prior employer reference verified by phone vetting.',
              recheckAt: '2027-10-27',
              reviewerUserId: '01a12fa2-3c86-7560-aff4-2da59d4b0a9e',
              claimedAt: '2026-10-27T07:12:38Z',
              documents: [],
              history: [],
            },
          ],
        },
      } as unknown as { data: AdminWorkerVerificationResponse });

      const repo = new RealVerificationRepository();
      // Pass extraneous fields that would trigger 422 if sent to backend
      const result = await repo.approveCheck(
        '01a166fb-5c87-7265-8036-b68ac96d1880',
        'REFERENCE',
        'Prior employer reference verified by phone vetting.',
        {
          referenceNumber: 'REF-8849-HYD',
          expiresOn: '2027-10-27',
          callNotes: 'Spoke with Mr. Sharma, confirmed 3 years experience as cook.',
          recheckAt: '2027-10-27',
        }
      );

      // Verify URL and exact payload: strictly { remarks, recheckAt }
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/01a166fb-5c87-7265-8036-b68ac96d1880/approve',
        {
          remarks: 'Prior employer reference verified by phone vetting.',
          recheckAt: '2027-10-27',
        }
      );

      // Verify extraneous non-whitelisted fields are NOT sent in payload
      const sentPayload = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(sentPayload).not.toHaveProperty('referenceNumber');
      expect(sentPayload).not.toHaveProperty('expiresOn');
      expect(sentPayload).not.toHaveProperty('callNotes');

      // Verify authoritative backend response is returned
      expect(result).toBeDefined();
      const verifiedResult = result as AdminWorkerVerificationResponse;
      expect(verifiedResult.workerId).toBe('01a166eb-8f68-7543-b394-a86124c4e66a');
      expect(verifiedResult.checks[0].status).toBe('APPROVED');
    });

    it('displays actual 422 error details without closing the popup when approval fails with 422', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();

      vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValueOnce(
        new ValidationError('CHECK_INCOMPLETE: Previous employment reference data missing from profile.', {
          previousEmployer: ['Employer name and contact number are required'],
        })
      );

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      // Navigate to Step 3: Verification Checklist
      const step3Pill = await screen.findByRole('button', { name: /Verification Checklist/i });
      await user.click(step3Pill);

      // Click Approve Check
      const approveButtons = await screen.findAllByRole('button', { name: /^Approve Check$/i });
      await user.click(approveButtons[0]);

      // Confirm in dialog
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // CRITICAL: Modal popup must NOT close on 422 error
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Verify actual 422 error message is displayed
      await waitFor(() => {
        expect(screen.getAllByText(/CHECK_INCOMPLETE/i).length).toBeGreaterThan(0);
      });

      // Verify modal is still active in the DOM
      expect(screen.getByRole('heading', { name: /Meena Sharma/i })).toBeInTheDocument();
      expect(screen.getByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();
    });

    it('updates check status from authoritative backend AdminWorkerVerificationResponse and keeps popup open', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();

      const authoritativeResponse = {
        workerId: 'W-TEST-ONBOARD',
        level: 'IN_PROGRESS' as const,
        requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
        checks: [
          {
            checkId: 'chk-id-101',
            checkType: 'IDENTITY',
            status: 'APPROVED' as const,
            required: true,
            submittedAt: '2026-10-27T05:07:00Z',
            reviewedAt: '2026-10-27T05:07:27Z',
            remarks: 'Aadhaar authentic',
            recheckAt: null,
            reviewerUserId: '01a12fa2-3c86-7560-aff4-2da59d4b0a9e',
            claimedAt: '2026-10-27T05:06:00Z',
            documents: [],
            history: [],
          },
        ],
      };

      vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValueOnce(authoritativeResponse);
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      // Navigate to Step 3
      const step3Pill = await screen.findByRole('button', { name: /Verification Checklist/i });
      await user.click(step3Pill);

      // Click Approve Check
      const approveButtons = await screen.findAllByRole('button', { name: /^Approve Check$/i });
      await user.click(approveButtons[0]);

      // Confirm in dialog
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Verify modal did NOT close
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Verify success feedback
      await waitFor(() => {
        expect(screen.getByText(/successfully approved by the backend/i)).toBeInTheDocument();
      });

      // Verify modal is still active in the DOM
      expect(screen.getByText(/Meena Sharma/i)).toBeInTheDocument();
    });

    it('enforces sequential progression so step 2 is locked until step 1 is approved', async () => {
      const user = userEvent.setup();
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={() => {}}
        />
      );

      const step3Pill = await screen.findByRole('button', { name: /Verification Checklist/i });
      await user.click(step3Pill);

      expect(await screen.findByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();

      // Check 2 (Address Proof) is locked until Identity Proof is approved
      const lockedBadges = await screen.findAllByText(/is locked until preceding check\(s\)/i);
      expect(lockedBadges.length).toBeGreaterThan(0);
    });
  });

  describe('2. Confirmed Final Sign-Off and Platform Activation Workflow', () => {
    it('restricts sign-off from Verification Executive and explains role boundaries', async () => {
      const user = userEvent.setup();
      // Authenticated as VERIFICATION_EXECUTIVE without verification.signoff
      useAuthStore.setState({
        user: {
          id: 'STAFF-VE-01',
          name: 'Junior Verification Executive',
          email: 'exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
          ],
        },
        isAuthenticated: true,
      });

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierAllApproved);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={() => {}}
        />
      );

      // Navigate to Step 4
      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      expect(await screen.findByText(/Step 4: Authoritative Verification Summary/i)).toBeInTheDocument();

      // Sign-off button should NOT be available to Verification Executive
      expect(screen.queryByRole('button', { name: /Sign Off Verification/i })).not.toBeInTheDocument();

      // Role boundary explanation must be displayed
      expect(screen.getByText(/Supervisor Only:/i)).toBeInTheDocument();
      expect(screen.getByText(/verification\.signoff/i)).toBeInTheDocument();
    });

    it('disables supervisor sign-off when mandatory KYC checks remain incomplete', async () => {
      const user = userEvent.setup();
      // Authenticated as VERIFICATION_SUPERVISOR with verification.signoff
      useAuthStore.setState({
        user: {
          id: 'STAFF-SUP-01',
          name: 'Lead Verification Supervisor',
          email: 'sup@sevanest.internal',
          role: 'VERIFICATION_SUPERVISOR',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_SIGNOFF,
          ],
        },
        isAuthenticated: true,
      });

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierPending);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={() => {}}
        />
      );

      // Navigate to Step 4
      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      // The sign-off button must be disabled
      const signOffBtn = screen.getByRole('button', { name: /Sign Off Verification/i });
      expect(signOffBtn).toBeDisabled();

      // Explanatory message indicating incomplete checks
      expect(screen.getByText(/Sign-off is locked.*remain incomplete/i)).toBeInTheDocument();
    });

    it('enables sign-off for authorized supervisor when all checks approved and sends POST /verification/sign-off', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();
      useAuthStore.setState({
        user: {
          id: 'STAFF-SUP-01',
          name: 'Lead Verification Supervisor',
          email: 'sup@sevanest.internal',
          role: 'VERIFICATION_SUPERVISOR',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_SIGNOFF,
          ],
        },
        isAuthenticated: true,
      });

      const signOffSpy = vi.spyOn(verificationRepository, 'signOffVerification').mockResolvedValueOnce({
        workerId: 'W-TEST-ONBOARD',
        level: 'VERIFIED',
        requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'],
        checks: [],
        status: 'APPROVED',
        applicationStatus: 'VERIFIED',
        signedOffAt: new Date().toISOString(),
      });

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
        ...mockWorkerBase,
        isFullyVerified: true,
      });
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierAllApproved);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      // Navigate to Step 4
      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      const signOffBtn = screen.getByRole('button', { name: /Sign Off Verification/i });
      expect(signOffBtn).toBeEnabled();
      await user.click(signOffBtn);

      // ConfirmDialog opens
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: /Verification Sign-Off/i })).toBeInTheDocument();
      const remarksInput = within(dialog).getByPlaceholderText(/Optional supervisor sign-off remarks/i);
      await user.type(remarksInput, 'All 5 checks confirmed valid and authentic.');

      const dialogConfirmBtn = within(dialog).getByRole('button', { name: /Sign Off Verification/i });
      await user.click(dialogConfirmBtn);

      // Repository called with correct workerId and remarks
      expect(signOffSpy).toHaveBeenCalledWith(
        'W-TEST-ONBOARD',
        'All 5 checks confirmed valid and authentic.'
      );

      // Popup remains open
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Feedback banner
      await waitFor(() => {
        expect(screen.getByText(/Verification dossier formally signed off/i)).toBeInTheDocument();
      });
    });

    it('keeps popup open and displays backend 409 NOT_FULLY_VERIFIED when sign-off rejected', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();
      useAuthStore.setState({
        user: {
          id: 'STAFF-SUP-01',
          name: 'Lead Verification Supervisor',
          email: 'sup@sevanest.internal',
          role: 'VERIFICATION_SUPERVISOR',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_SIGNOFF,
          ],
        },
        isAuthenticated: true,
      });

      vi.spyOn(verificationRepository, 'signOffVerification').mockRejectedValueOnce(
        new Error('NOT_FULLY_VERIFIED: 1 mandatory KYC verification check(s) remain unapproved.')
      );

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerBase);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierAllApproved);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      const signOffBtn = screen.getByRole('button', { name: /Sign Off Verification/i });
      await user.click(signOffBtn);

      const dialog = await screen.findByRole('dialog');
      const dialogConfirmBtn = within(dialog).getByRole('button', { name: /Sign Off Verification/i });
      await user.click(dialogConfirmBtn);

      // Error message displayed
      await waitFor(() => {
        expect(screen.getAllByText(/NOT_FULLY_VERIFIED/i).length).toBeGreaterThan(0);
      });

      // Local state preserved, modal not closed
      expect(onCloseSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /Retry Sign-Off/i })).toBeInTheDocument();
    });

    it('enables activation only after sign-off and surfaces missing prerequisites on 422 ACTIVATION_REQUIREMENTS_MISSING', async () => {
      const user = userEvent.setup();
      const onCloseSpy = vi.fn();
      useAuthStore.setState({
        user: {
          id: 'STAFF-OPS-01',
          name: 'Senior Operations Admin',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.WORKERS_MANAGE,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_SIGNOFF,
            PERMISSIONS.WORKER_ACTIVATE,
          ],
        },
        isAuthenticated: true,
      });

      // Signed off worker
      const signedOffWorker = {
        ...mockWorkerBase,
        isFullyVerified: true,
        applicationStatus: 'VERIFIED' as const,
        signedOffAt: '2026-10-27T08:00:00Z',
      };
      const signedOffDossier = {
        ...mockDossierAllApproved,
        applicationStatus: 'VERIFIED' as const,
        signedOffAt: '2026-10-27T08:00:00Z',
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(signedOffWorker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(signedOffDossier);

      // Backend rejects activation with 422 ACTIVATION_REQUIREMENTS_MISSING
      const validationErr = new ValidationError(
        'ACTIVATION_REQUIREMENTS_MISSING: Worker does not satisfy authoritative activation requirements.',
        undefined,
        'corr-422',
        'ACTIVATION_REQUIREMENTS_MISSING',
        [
          {
            messages: [
              'Worker must have at least one verified primary service category',
              'Worker must have a designated operational service area',
              'Worker must provide a signed criminal self-declaration',
            ],
          },
        ]
      );
      vi.spyOn(verificationRepository, 'activateWorker').mockRejectedValueOnce(validationErr);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={onCloseSpy}
        />
      );

      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      // Activation button should be enabled because worker is signed off and user has worker.activate
      const activateBtn = screen.getByRole('button', { name: /Activate Worker on Platform/i });
      expect(activateBtn).toBeEnabled();
      await user.click(activateBtn);

      // Confirm dialog opens
      const dialog = await screen.findByRole('dialog');
      const confirmActivateBtn = within(dialog).getByRole('button', { name: /Activate Worker on Platform/i });
      await user.click(confirmActivateBtn);

      // Error message and missing prerequisites must be displayed
      await waitFor(() => {
        expect(screen.getAllByText(/ACTIVATION_REQUIREMENTS_MISSING/i).length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText(/Worker must have at least one verified primary service category/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Worker must have a designated operational service area/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Worker must provide a signed criminal self-declaration/i).length).toBeGreaterThanOrEqual(1);

      // Modal remained open
      expect(onCloseSpy).not.toHaveBeenCalled();
    });

    it('reports worker as onboarded only when applicationStatus is ACTIVE and activatedAt is set', async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        user: {
          id: 'STAFF-OPS-01',
          name: 'Senior Operations Admin',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.WORKER_ACTIVATE,
          ],
        },
        isAuthenticated: true,
      });

      // Fully active and onboarded worker
      const activeWorker = {
        ...mockWorkerBase,
        isFullyVerified: true,
        status: 'ACTIVE' as const,
        applicationStatus: 'ACTIVE' as const,
        signedOffAt: '2026-10-27T08:00:00Z',
        activatedAt: '2026-10-27T08:30:00Z',
      };
      const activeDossier = {
        ...mockDossierAllApproved,
        applicationStatus: 'ACTIVE' as const,
        signedOffAt: '2026-10-27T08:00:00Z',
        activatedAt: '2026-10-27T08:30:00Z',
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(activeWorker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(activeDossier);

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-TEST-ONBOARD"
          onClose={() => {}}
        />
      );

      // Header shows App: ACTIVE badge
      expect(await screen.findByText(/App: ACTIVE/i)).toBeInTheDocument();
      expect(screen.getByText(/Matching: ELIGIBLE/i)).toBeInTheDocument();

      // Navigate to Step 5: Platform Status
      const step5Pill = await screen.findByRole('button', { name: /Platform Status/i });
      await user.click(step5Pill);

      expect(await screen.findByText(/Step 5: Platform & Roster Status/i)).toBeInTheDocument();
      expect(screen.getByText(/ACTIVE & ONBOARDED/i)).toBeInTheDocument();
      expect(screen.getByText(/Eligible for Customer Matching & Allocation/i)).toBeInTheDocument();
    });
  });
});
