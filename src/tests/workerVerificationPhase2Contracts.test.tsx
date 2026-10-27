/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RealVerificationRepository, MockVerificationRepository, verificationRepository } from '../features/verification/data/verificationRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 2: Correct Worker Verification Decision and Activation Flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Verification Officer',
        email: 've@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Absence of Unsupported Worker-Level Final Decision APIs', () => {
    it('verifies submitFinalDecision does not exist on RealVerificationRepository or MockVerificationRepository', () => {
      const realRepo = new RealVerificationRepository();
      const mockRepo = new MockVerificationRepository();

      expect((realRepo as any).submitFinalDecision).toBeUndefined();
      expect((mockRepo as any).submitFinalDecision).toBeUndefined();
      expect((verificationRepository as any).submitFinalDecision).toBeUndefined();
    });

    it('ensures no calls can be made to nonexistent decision endpoints (/decision)', async () => {
      const postSpy = vi.spyOn(httpClient, 'post');
      const realRepo = new RealVerificationRepository();

      // Test that supported individual check operations use correct endpoints and never /decision
      postSpy.mockResolvedValueOnce({ data: { success: true } });
      await realRepo.approveCheck('chk-101', 'IDENTITY', 'Identity approved');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-101/approve',
        { remarks: 'Identity approved' }
      );
      expect(postSpy).not.toHaveBeenCalledWith(expect.stringContaining('/decision'), expect.anything());
    });
  });

  describe('2. Authoritative Verification Level Usage from Backend Contract', () => {
    it('retrieves authoritative verification level from GET /admin/workers/{workerId}/verification', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'dossier-uuid-1',
            workerId: 'W-TEST-99',
            workerName: 'Authoritative Worker',
            level: 'LEVEL_3',
            status: 'APPROVED',
            checks: [],
          },
        },
      } as any);

      const realRepo = new RealVerificationRepository();
      const dossier = await realRepo.getDossierById('W-TEST-99');

      expect(getSpy).toHaveBeenCalledWith('/admin/workers/W-TEST-99/verification');
      expect(dossier?.level).toBe('LEVEL_3');
      expect(dossier?.status).toBe('APPROVED');
    });

    it('renders authoritative level in Step 4 read-only summary', async () => {
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'VQ-101',
        applicationId: 'W-10482',
        workerId: 'W-10482',
        workerName: 'Sunita Devi',
        category: 'House Maid',
        locality: 'Kondapur',
        experienceYears: 6,
        phoneMasked: '+91 98765 *****',
        submissionTime: '2026-10-15T07:15:00Z',
        status: 'APPROVED',
        level: 'LEVEL_3',
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: { type: 'IDENTITY', title: 'Identity Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' },
          ADDRESS: { type: 'ADDRESS', title: 'Address Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' },
          EMERGENCY_CONTACT: { type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' },
          REFERENCE: { type: 'REFERENCE', title: 'Employer Reference', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' },
          POLICE_CLEARANCE: { type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'APPROVED', evaluationMethod: 'CERTIFICATE_TRACKING' },
        },
      });
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      expect(await screen.findByText(/Step 4: Authoritative Verification Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Level: LEVEL_3/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor Verification Sign-Off/i)).toBeInTheDocument();
    });

    it('renders unavailable error state when authoritative level fails to load and does not infer approval', async () => {
      vi.spyOn(verificationRepository, 'getDossierById').mockRejectedValueOnce(
        new Error('Network connection failed')
      );
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-ERR-01',
        name: 'Worker Without Level',
        category: 'House Maid',
        status: 'PENDING',
        locality: 'Kondapur',
        experienceYears: 2,
        isFullyVerified: false,
        level: undefined,
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'VERIFIED',
          addressProofStatus: 'VERIFIED',
          criminalRecordStatus: 'VERIFIED',
          referenceCheckStatus: 'VERIFIED',
          level: undefined,
        },
      } as any);

      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-ERR-01"
          onClose={() => {}}
        />
      );

      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      expect(await screen.findByText(/Authoritative Verification Level Unavailable/i)).toBeInTheDocument();
      expect(
        screen.getByText(/The frontend displays only confirmed backend verification status and does not infer approval/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/All 6 Verification Checks Approved & Verified/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Removal of Unsupported Activation Workflow', () => {
    it('does not expose activation controls in Step 5', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      const step5Pill = await screen.findByRole('button', { name: /Platform Status/i });
      await user.click(step5Pill);

      expect(await screen.findByText(/Step 5: Platform & Roster Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Platform Matching State/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate Worker Account/i })).not.toBeInTheDocument();
    });

    it('does not invoke workerRepository.updateWorkerStatus when viewing or navigating Step 5', async () => {
      const updateStatusSpy = vi.spyOn(workerRepository, 'updateWorkerStatus');
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      const step5Pill = await screen.findByRole('button', { name: /Platform Status/i });
      await user.click(step5Pill);

      expect(updateStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('4. Preservation of Supported Individual Verification Checks', () => {
    it('preserves approveCheck operation with notes forwarding', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      });

      const repo = new RealVerificationRepository();
      await repo.approveCheck('chk-identity-01', 'IDENTITY', 'Aadhaar validated against master database');

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-identity-01/approve',
        { remarks: 'Aadhaar validated against master database' }
      );
    });

    it('preserves rejectCheck operation with remarks forwarding', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      });

      const repo = new RealVerificationRepository();
      await repo.rejectCheck(
        'chk-address-02',
        'ADDRESS',
        'EXPIRED_DOC',
        'Utility bill is more than 3 months old'
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-address-02/reject',
        {
          reasonCode: 'DOCUMENT_EXPIRED',
          remarks: 'Utility bill is more than 3 months old',
        }
      );
    });

    it('preserves requestReVerification operation with instructions forwarding', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      });

      const repo = new RealVerificationRepository();
      await repo.requestReVerification(
        'chk-address-03',
        ['ADDRESS', 'POLICE_CLEARANCE'],
        'Please upload an updated utility bill and clear copy of PCC'
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-address-03/recheck',
        {
          remarks: 'Please upload an updated utility bill and clear copy of PCC',
        }
      );
    });
  });

  describe('5. Access Enforcement via worker.view Canonical Permission', () => {
    it('enforces worker.view permission gate and blocks modal when permission is absent', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-NO-ACCESS',
          name: 'Unauthorized User',
          email: 'unauthorized@sevanest.local',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        isAuthenticated: true,
      });

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/worker\.view/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 1 of 5/i)).not.toBeInTheDocument();
    });

    it('allows access to WorkerDetailModal when user holds canonical worker.view permission', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-AUTH-01',
          name: 'Authorized Viewer',
          email: 'auth@sevanest.local',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      expect(await screen.findByRole('heading', { name: /Sunita Devi/i })).toBeInTheDocument();
      expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
    });
  });
});
