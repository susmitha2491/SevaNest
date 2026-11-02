import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { verificationRepository, MockVerificationRepository } from '../features/verification/data/verificationRepository';
import { NotFoundError, ValidationError } from '../core/errors/DomainError';
import { syncMockWorkerVerification } from '../features/workers/data/workerRepository';

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

describe('Worker Final Rejection Workflow and Strict Backend Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncMockWorkerVerification('W-10499', false, false);
    useAuthStore.setState({
      user: {
        id: 'usr-admin-1',
        name: 'Operations Supervisor',
        email: 'supervisor@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.WORKER_ACTIVATE,
          PERMISSIONS.WORKERS_MANAGE_STATUS,
        ],
      },
      isAuthenticated: true,
      accessToken: 'mock-test-jwt-token',
    });

    if (verificationRepository instanceof MockVerificationRepository) {
      verificationRepository.simulateWorkerRejectionSupported = false;
      const vq = verificationRepository.dossiers.find((d) => d.workerId === 'W-10499');
      if (vq) {
        vq.status = 'PENDING_REVIEW';
        vq.level = 'NOT_STARTED';
        vq.applicationStatus = 'SUBMITTED';
      }
    }
  });

  describe('1. Zero-Document Worker Scenario', () => {
    it('navigates through all 4 stages, verifies empty documents, keeps Approve disabled and Reject enabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkerDetailModal workerId="W-10499" onClose={vi.fn()} />);

      // Stage 1: Worker Information
      await waitFor(() => {
        expect(screen.getAllByText('Pooja Sharma').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/W-10499/).length).toBeGreaterThan(0);
      });

      // Confirm Next button to Stage 2
      const nextBtn1 = await screen.findByRole('button', { name: /Next: Digitally Submitted Documents/i });
      await user.click(nextBtn1);

      // Stage 2: Digitally Submitted Documents - Confirm Empty State
      expect(await screen.findByText(/No documents submitted by this worker yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('no-documents-submitted')).toBeInTheDocument();

      // Navigate to Stage 3: Manually Submitted Documents
      const nextBtn2 = await screen.findByRole('button', { name: /Next: Manual Documents/i });
      await user.click(nextBtn2);

      // Stage 3: Manually Submitted Documents - Confirm Empty State
      expect(await screen.findByText(/No manually submitted physical documents recorded/i)).toBeInTheDocument();

      // Navigate to Stage 4: Final Worker Approval
      const nextBtn3 = await screen.findByRole('button', { name: /Next: Final Approval/i });
      await user.click(nextBtn3);

      // Stage 4: Final Worker Approval
      expect(await screen.findByRole('heading', { level: 3, name: /Final Worker Approval/i })).toBeInTheDocument();

      // Verify Stage 4 action buttons:
      // 1. Approve Worker must be DISABLED (no documents/checks approved)
      const approveBtn = screen.getByTestId('stage4-bottom-approve-btn');
      expect(approveBtn).toBeDisabled();

      // 2. Reject Worker must be ENABLED
      const rejectBtn = screen.getByTestId('stage4-bottom-reject-btn');
      expect(rejectBtn).toBeEnabled();

      const cardRejectBtn = screen.getByTestId('stage4-card-reject-btn');
      expect(cardRejectBtn).toBeEnabled();
    });
  });

  describe('2. Backend 404 (Missing Worker-Level Rejection Endpoint) - Unsafe Fallback Prohibited', () => {
    it('blocks worker rejection, displays clear error, and does NOT fall back to check rejection or change status', async () => {
      const user = userEvent.setup();

      // Spy on rejectCheck to guarantee it is NEVER called as a fallback
      const rejectCheckSpy = vi.spyOn(verificationRepository, 'rejectCheck');

      // Mock rejectWorker to throw 404 Not Found error (reflecting missing backend endpoint)
      const rejectWorkerSpy = vi.spyOn(verificationRepository, 'rejectWorker').mockRejectedValueOnce(
        new NotFoundError(
          'Worker rejection is blocked: The backend does not support worker-level rejection (POST /api/v1/admin/workers/{workerId}/reject returned 404 Not Found). Individual verification check rejection cannot be substituted for worker-level rejection.',
          undefined,
          'WORKER_REJECTION_NOT_IMPLEMENTED'
        )
      );

      renderWithProviders(<WorkerDetailModal workerId="W-10499" onClose={vi.fn()} />);

      // Navigate to Stage 4
      await waitFor(() => {
        expect(screen.getAllByText('Pooja Sharma').length).toBeGreaterThan(0);
      });
      const stage4Tab = screen.getByRole('tab', { name: /4\. Final Worker Approval/i });
      await user.click(stage4Tab);

      // Click Reject Worker
      const rejectBtn = screen.getByTestId('stage4-bottom-reject-btn');
      await user.click(rejectBtn);

      // Verify Dialog opens
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Reject Worker' })).toBeInTheDocument();
      });

      // Enter valid rejection reason
      const remarksTextarea = screen.getByPlaceholderText(/Enter mandatory rejection reason\/remarks/i);
      await user.type(remarksTextarea, 'Applicant failed to provide mandatory documents within deadline');

      // Check operational confirmation checkbox inside dialog
      const confirmCheckbox = screen.getByTestId('confirm-destructive-checkbox');
      await user.click(confirmCheckbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      expect(confirmBtn).toBeEnabled();
      await user.click(confirmBtn);

      // Verify rejectWorker was called
      await waitFor(() => {
        expect(rejectWorkerSpy).toHaveBeenCalledWith(
          'W-10499',
          'OTHER',
          'Applicant failed to provide mandatory documents within deadline'
        );
      });

      // Verify rejectCheck was NEVER called as a fallback
      expect(rejectCheckSpy).not.toHaveBeenCalled();

      // Verify error banner is shown to administrator
      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(
          screen.getAllByText(/Worker rejection is blocked: The backend does not support worker-level rejection/i).length
        ).toBeGreaterThan(0);
      });

      // Confirmation dialog must remain open so admin can see the blocker
      expect(screen.getByRole('heading', { name: 'Reject Worker' })).toBeInTheDocument();

      // Worker status must NOT be changed to REJECTED locally
      expect(screen.queryByTestId('verification-badge-rejected')).not.toBeInTheDocument();
      expect(screen.queryByText('App: REJECTED')).not.toBeInTheDocument();
    });
  });

  describe('3. Backend 400 / 422 Validation Failures', () => {
    it('displays validation error and does not mutate worker status', async () => {
      const user = userEvent.setup();

      const rejectWorkerSpy = vi.spyOn(verificationRepository, 'rejectWorker').mockRejectedValueOnce(
        new ValidationError('Rejection category INVALID_REASON is not recognized by backend validation schema.')
      );

      renderWithProviders(<WorkerDetailModal workerId="W-10499" onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('Pooja Sharma').length).toBeGreaterThan(0);
      });
      const stage4Tab = screen.getByRole('tab', { name: /4\. Final Worker Approval/i });
      await user.click(stage4Tab);

      const rejectBtn = screen.getByTestId('stage4-bottom-reject-btn');
      await user.click(rejectBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Reject Worker' })).toBeInTheDocument();
      });

      const remarksTextarea = screen.getByPlaceholderText(/Enter mandatory rejection reason\/remarks/i);
      await user.type(remarksTextarea, 'Applicant documents mismatch');

      const confirmCheckbox = screen.getByTestId('confirm-destructive-checkbox');
      await user.click(confirmCheckbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      expect(confirmBtn).toBeEnabled();
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(rejectWorkerSpy).toHaveBeenCalled();
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(
          screen.getAllByText(/Rejection category INVALID_REASON is not recognized/i).length
        ).toBeGreaterThan(0);
      });

      // Worker status must remain unmutated
      expect(screen.queryByTestId('verification-badge-rejected')).not.toBeInTheDocument();
    });
  });

  describe('4. Worker with Multiple Verification Checks', () => {
    it('does not reject any individual checks when attempting worker rejection', async () => {
      const user = userEvent.setup();
      const rejectCheckSpy = vi.spyOn(verificationRepository, 'rejectCheck');

      // Mock rejectWorker with 404
      vi.spyOn(verificationRepository, 'rejectWorker').mockRejectedValueOnce(
        new NotFoundError('Backend 404 Not Found')
      );

      // Open a worker with multiple verification checks (e.g., Sunita Devi W-10482)
      renderWithProviders(<WorkerDetailModal workerId="W-10482" onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('Sunita Devi').length).toBeGreaterThan(0);
      });

      const stage4Tab = screen.getByRole('tab', { name: /4\. Final Worker Approval/i });
      await user.click(stage4Tab);

      const rejectBtn = screen.getByTestId('stage4-bottom-reject-btn');
      await user.click(rejectBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Reject Worker' })).toBeInTheDocument();
      });

      const remarksTextarea = screen.getByPlaceholderText(/Enter mandatory rejection reason\/remarks/i);
      await user.type(remarksTextarea, 'Multiple check worker rejection test');

      const confirmCheckbox = screen.getByLabelText(/I confirm this action adheres to operational guidelines/i);
      await user.click(confirmCheckbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Verify rejectCheck was NEVER invoked for any of the multiple checks
      expect(rejectCheckSpy).not.toHaveBeenCalled();
    });
  });

  describe('5. Successful Worker-Level Rejection (Authoritative Backend Confirmation)', () => {
    it('updates worker profile and replaces Pending KYC only after authoritative backend response', async () => {
      const user = userEvent.setup();

      // Simulate genuine backend success response (200 OK)
      const mockSuccessResponse = {
        workerId: 'W-10499',
        applicationStatus: 'REJECTED' as const,
        level: 'NOT_STARTED' as const,
        requiredChecks: ['IDENTITY', 'ADDRESS'],
        checks: [],
      };

      vi.spyOn(verificationRepository, 'rejectWorker').mockImplementationOnce(async () => {
        if (verificationRepository instanceof MockVerificationRepository) {
          verificationRepository.simulateWorkerRejectionSupported = true;
          return await verificationRepository.rejectWorker('W-10499', 'OTHER', 'Mandatory documents missing');
        }
        return mockSuccessResponse;
      });

      renderWithProviders(<WorkerDetailModal workerId="W-10499" onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByText('Pooja Sharma').length).toBeGreaterThan(0);
      });

      const stage4Tab = screen.getByRole('tab', { name: /4\. Final Worker Approval/i });
      await user.click(stage4Tab);

      const rejectBtn = screen.getByTestId('stage4-bottom-reject-btn');
      await user.click(rejectBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Reject Worker' })).toBeInTheDocument();
      });

      const remarksTextarea = screen.getByPlaceholderText(/Enter mandatory rejection reason\/remarks/i);
      await user.type(remarksTextarea, 'Mandatory documents missing');

      const confirmCheckbox = screen.getByLabelText(/I confirm this action adheres to operational guidelines/i);
      await user.click(confirmCheckbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      await user.click(confirmBtn);

      // Now that backend confirmed success, status updates to REJECTED and dialog closes
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Reject Worker' })).not.toBeInTheDocument();
        expect(screen.getByTestId('verification-badge-rejected')).toBeInTheDocument();
        expect(screen.getByText('App: REJECTED')).toBeInTheDocument();
        expect(screen.getByText('Matching: INELIGIBLE')).toBeInTheDocument();
      });

      // Pending KYC must NOT be present in this worker's header
      const headerArea = screen.getByRole('heading', { name: 'Pooja Sharma' }).closest('div');
      expect(headerArea).not.toBeNull();
      if (headerArea) {
        expect(within(headerArea).queryByText('Pending KYC')).not.toBeInTheDocument();
      }
    });
  });

  describe('6. Workers Management List Consistency and Status After Refresh', () => {
    it('maintains consistency: displays REJECTED status and Ineligible (Rejected) for rejected worker without Pending KYC', async () => {
      // Ensure W-10499 has simulated backend rejection confirmed
      if (verificationRepository instanceof MockVerificationRepository) {
        verificationRepository.simulateWorkerRejectionSupported = true;
        await verificationRepository.rejectWorker(
          'W-10499',
          'INCOMPLETE_DOCUMENTATION',
          'Applicant did not provide documents'
        );
      }

      renderWithProviders(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getByText('Pooja Sharma')).toBeInTheDocument();
      });

      const poojaRow = screen.getByText('Pooja Sharma').closest('tr');
      expect(poojaRow).not.toBeNull();

      if (poojaRow) {
        // 1. Verification badge shows REJECTED in Pooja's row
        expect(within(poojaRow).getByTestId('verification-badge-rejected')).toBeInTheDocument();

        // 2. Matching column shows Ineligible (Rejected)
        expect(within(poojaRow).getByText(/Ineligible \(Rejected\)/i)).toBeInTheDocument();

        // 3. Pending KYC must NOT be displayed for Pooja Sharma
        expect(within(poojaRow).queryByText('Pending KYC')).not.toBeInTheDocument();
      }
    });
  });
});
