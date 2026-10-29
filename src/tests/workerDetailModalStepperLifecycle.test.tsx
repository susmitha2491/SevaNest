import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderModalWithProviders(workerId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkerDetailModal workerId={workerId} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkerDetailModal Guided Verification Lifecycle Stepper', () => {
  const setupAuth = () => {
    useAuthStore.getState().setSession(
      {
        id: 'op-admin-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.WORKER_ACTIVATE,
        ],
      },
      'token-ops'
    );
  };

  it('In Step 1 for an in-review worker, later steps (Step 4 & 5) are NOT marked completed while earlier checks (Step 3) are incomplete', async () => {
    setupAuth();

    // W-10483 (Ramesh Yadav) is an IN_REVIEW worker with pending KYC checks
    renderModalWithProviders('W-10483');

    // Wait for Step 1 header to appear
    expect(await screen.findByText(/Step 1: Application Overview/i)).toBeInTheDocument();

    // Step 1 is Current
    const step1Btn = screen.getByRole('button', { name: /Application Overview/i });
    expect(step1Btn).toHaveAttribute('aria-current', 'step');
    expect(step1Btn).toHaveTextContent(/Current/i);

    // Step 3 (Verification Checklist) is incomplete/pending
    const step3Btn = screen.getByRole('button', { name: /Verification Checklist/i });
    expect(step3Btn).toHaveTextContent(/Pending/i);
    expect(step3Btn).not.toHaveTextContent(/Completed/i);

    // Step 4 (Verification Summary) MUST NOT be marked completed!
    const step4Btn = screen.getByRole('button', { name: /Verification Summary/i });
    expect(step4Btn).toHaveTextContent(/Pending/i);
    expect(step4Btn).not.toHaveTextContent(/Completed/i);

    // Step 5 (Platform Status) MUST NOT be marked completed!
    const step5Btn = screen.getByRole('button', { name: /Platform Status/i });
    expect(step5Btn).toHaveTextContent(/Pending/i);
    expect(step5Btn).not.toHaveTextContent(/Completed/i);
  });

  it('Highlights current step distinctly as user navigates through steps', async () => {
    setupAuth();
    const user = userEvent.setup();

    renderModalWithProviders('W-10483');

    expect(await screen.findByText(/Step 1: Application Overview/i)).toBeInTheDocument();

    // Navigate to Step 2 via stepper pill (the first button containing "Documents & Evidence")
    const step2Btn = screen.getAllByRole('button', { name: /Documents & Evidence/i })[0];
    await user.click(step2Btn);

    expect(await screen.findByText(/Step 2: Documents & KYC Evidence Vault/i)).toBeInTheDocument();
    expect(step2Btn).toHaveAttribute('aria-current', 'step');
    expect(step2Btn).toHaveTextContent(/Current/i);

    // Step 1 now shows Completed
    const step1Btn = screen.getAllByRole('button', { name: /Application Overview/i })[0];
    expect(step1Btn).not.toHaveAttribute('aria-current', 'step');
    expect(step1Btn).toHaveTextContent(/Completed/i);
  });

  it('Marks all steps completed for a fully verified worker', async () => {
    setupAuth();

    // W-10482 (Sunita Devi) is a fully verified, active worker
    renderModalWithProviders('W-10482');

    expect(await screen.findByText(/Step 1: Application Overview/i)).toBeInTheDocument();

    // In a fully verified worker, Step 2, Step 3, Step 4, and Step 5 are all satisfied
    const step2Btn = screen.getAllByRole('button', { name: /Documents & Evidence/i })[0];
    expect(step2Btn).toHaveTextContent(/Completed/i);

    const step3Btn = screen.getByRole('button', { name: /Verification Checklist/i });
    expect(step3Btn).toHaveTextContent(/Completed/i);

    const step4Btn = screen.getByRole('button', { name: /Verification Summary/i });
    expect(step4Btn).toHaveTextContent(/Completed/i);

    const step5Btn = screen.getByRole('button', { name: /Platform Status/i });
    expect(step5Btn).toHaveTextContent(/Completed/i);
  });
});
