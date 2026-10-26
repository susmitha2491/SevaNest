import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('opens split-screen inspection dossier when Inspect Dossier is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    await user.click(inspectButtons[0]);

    // Check dossier header
    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Check automated Pre-Check banner
    expect(screen.getByText(/Tier 1 Automated Onboarding Pre-Check: Mobile OTP/i)).toBeInTheDocument();

    // Check 5 Operations Check Tabs
    expect(screen.getByRole('button', { name: /1\. Identity Proof/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2\. Address Proof/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\. Emergency Contact/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4\. Employer Reference/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5\. Police Certificate/i })).toBeInTheDocument();

    // Check document viewer authorized container
    expect(screen.getByText(/CONFIDENTIAL KYC ATTACHMENT/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorized Document Vault Record • Watermarked for Confidential Inspection/i)).toBeInTheDocument();
  });

  it('allows switching between document inspection and telephonic vetting tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    // Click on Emergency Contact tab
    const emergencyTab = await screen.findByRole('button', { name: /3\. Emergency Contact/i });
    await user.click(emergencyTab);

    // Verify telephonic vetting container rendered
    expect(await screen.findByText(/Telephonic Vetting Contact Record/i)).toBeInTheDocument();
    expect(screen.getByText('Rajesh Devi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Record detailed notes from phone conversation/i)).toBeInTheDocument();
  });

  it('approves an individual verification check', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    const approveButton = await screen.findByRole('button', { name: /Approve Check/i });
    expect(approveButton).toBeInTheDocument();
    await user.click(approveButton);
    const confirmButton = await screen.findByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmButton);
  });

  it('opens reject check dialog requiring category selection and mandatory operational remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerificationQueuePage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
    await user.click(inspectButtons[0]);

    const rejectButton = await screen.findByRole('button', { name: /Reject Check/i });
    await user.click(rejectButton);

    // Verify ConfirmDialog opens with category selection
    expect(await screen.findByText(/Reject Identity Proof/i)).toBeInTheDocument();
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
