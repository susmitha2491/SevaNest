import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Verification & Trust Workstation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Verification Officer',
        email: 've@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          PERMISSIONS.WORKERS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders the verification queue with filter controls and ordered dossiers', async () => {
    renderWithProviders(<VerificationQueuePage />);

    expect(
      await screen.findByRole('heading', { name: /Worker Verification & Trust Operations/i })
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/Search by worker name, ID, locality/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pending$/i })).toBeInTheDocument();

    // Verify worker items in queue table
    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText(/W-10482/i)).toBeInTheDocument();
  });

  it('opens redesigned verification review modal when Inspect Dossier is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    await user.click(inspectButtons[0]);

    // Check dossier header
    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Check Step 1: Worker Application Details
    expect(screen.getByRole('heading', { name: /Step 1 — Worker Application Details/i })).toBeInTheDocument();
    expect(screen.getAllByText('Sunita Devi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);

    const dialog = screen.getByRole('dialog');

    // Navigate to Step 2: Documents Review
    const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
    await user.click(nextBtn1);
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Check document viewer authorized container
    expect(await screen.findByText(/CONFIDENTIAL KYC ATTACHMENT/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorized Document Vault Record • Watermarked for Confidential Inspection/i)).toBeInTheDocument();

    // Navigate to Step 3: KYC Verification
    const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
    await user.click(nextBtn2);
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Check automated Pre-Check banner
    expect(screen.getAllByText(/Mobile OTP Pre-Check/i).length).toBeGreaterThan(0);

    // Check all required operational checks
    expect(screen.getAllByText('Identity Proof').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Address Proof').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Emergency Contact').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Employer Reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Police Clearance').length).toBeGreaterThan(0);
  });

  it('allows viewing emergency contact details and telephonic vetting notes in top-to-bottom layout', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 3 (KYC Verification)
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Verify contact record rendered in Emergency Contact check
    expect((await screen.findAllByText(/Emergency Contact/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Rajesh Devi/i)).toBeInTheDocument();
  });

  it('approves an individual verification check', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 3 (KYC Verification)
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    const approveButtons = await within(dialog).findAllByRole('button', { name: /Approve Check/i });
    expect(approveButtons.length).toBeGreaterThan(0);
    await user.click(approveButtons[0]);
    const confirmButton = await screen.findByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmButton);
  });

  it('opens reject check dialog requiring category selection and mandatory operational remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 3 (KYC Verification)
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    const rejectButtons = await within(dialog).findAllByRole('button', { name: /Reject Check/i });
    expect(rejectButtons.length).toBeGreaterThan(0);
    await user.click(rejectButtons[0]);

    // Verify ConfirmDialog opens with category selection
    expect(await screen.findByText(/Reject (Identity|Address) Proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Rejection Category:/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter mandatory operational remarks/i)).toBeInTheDocument();

    // Confirm button is disabled if remarks are empty
    const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    expect(confirmBtn).toBeDisabled();

    // Enter remarks
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational remarks/i);
    await user.type(remarksInput, 'Document image is blurred and unreadable.');

    // Confirm checkbox for destructive action
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(confirmBtn).toBeEnabled();
  });

  it('displays NoAccessView when user lacks verification.review permission', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPPORT',
        name: 'Support Exec',
        email: 'support@sevanest.local',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SUPPORT_VIEW],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<VerificationQueuePage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/verification\.review/i)).toBeInTheDocument();
  });
});
