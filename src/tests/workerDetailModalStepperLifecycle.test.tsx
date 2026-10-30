import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal, WorkerModalWorkflowStep } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderModalWithProviders(workerId: string, initialStep: WorkerModalWorkflowStep = 'worker-info') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkerDetailModal workerId={workerId} initialStep={initialStep} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkerDetailModal Simplified 2-Step Workflow (Worker Info & KYC Verification)', () => {
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
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'token-ops'
    );
  };

  it('Step 1: Worker Information renders clean basic info, contact, category, and Next: Verify KYC button', async () => {
    setupAuth();

    // W-10483 (Ramesh Yadav)
    renderModalWithProviders('W-10483');

    // Worker identity and category
    expect(await screen.findByRole('heading', { name: /Ramesh Yadav/i })).toBeInTheDocument();
    expect(await screen.findByText('Primary Skill & Experience')).toBeInTheDocument();
    expect(await screen.findByText('Address & Locality')).toBeInTheDocument();

    // Verify clear Next: Verify KYC button is present
    const nextBtn = screen.getByRole('button', { name: /Next: Verify KYC/i });
    expect(nextBtn).toBeInTheDocument();

    // Verify unnecessary 5-step stepper and unrelated operational tabs are NOT rendered
    expect(screen.queryByText(/Step 1: Application Overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 2: Documents & KYC Evidence Vault/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 3: Verification Checklist & Operational Evaluation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 4: Authoritative Verification Summary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 5: Platform & Roster Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/5\. Historical Engagements/i)).not.toBeInTheDocument();
  });

  it('Navigates to Step 2: KYC Verification on clicking Next, showing documents, checklist, and Back button', async () => {
    setupAuth();
    const user = userEvent.setup();

    renderModalWithProviders('W-10483');

    expect(await screen.findByRole('heading', { name: /Ramesh Yadav/i })).toBeInTheDocument();

    // Click Next: Verify KYC
    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Step 2 header and Back button
    expect(await screen.findByText(/KYC Verification & Compliance/i)).toBeInTheDocument();
    const backBtn = screen.getByRole('button', { name: /Back to Worker Information/i });
    expect(backBtn).toBeInTheDocument();

    // Submitted KYC Documents and 6-Point verification status
    expect(screen.getByText(/Submitted KYC Documents/i)).toBeInTheDocument();
    expect(screen.getByText('6-Point Trust & Verification Status')).toBeInTheDocument();
    expect(screen.getByText('1. Mobile OTP Pre-Check')).toBeInTheDocument();
    expect(screen.getByText('2. Identity Proof (Aadhaar)')).toBeInTheDocument();

    // Click Back to Worker Information to return to Step 1
    await user.click(backBtn);
    expect(await screen.findByText('Primary Skill & Experience')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next: Verify KYC/i })).toBeInTheDocument();
  });

  it('Opens directly in Step 2 when initialStep is kyc-verification', async () => {
    setupAuth();

    renderModalWithProviders('W-10482', 'kyc-verification');

    // Opens directly in KYC Verification
    expect(await screen.findByText(/KYC Verification & Compliance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Worker Information/i })).toBeInTheDocument();
    expect(screen.getByText('6-Point Trust & Verification Status')).toBeInTheDocument();
  });
});
