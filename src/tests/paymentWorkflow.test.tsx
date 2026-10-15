import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
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

describe('Financial Transactions & Refund Workflows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Officer',
        email: 'ops@sevanest.local',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.REFUNDS_MANAGE,
          PERMISSIONS.BOOKINGS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders the payments ledger with summary metrics, status tabs, and transactions table', async () => {
    renderWithProviders(<PaymentsListPage />);

    expect(
      await screen.findByRole('heading', { name: /Financial Transactions & Refunds/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Gross Settled Collections/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Refund Requests/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by customer, booking ref, transaction ID/i)).toBeInTheDocument();

    // Verify transaction records
    expect(await screen.findByText('TXN-892104')).toBeInTheDocument();
    expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
    expect(screen.getByText('B-84920')).toBeInTheDocument();
  });

  it('opens transaction detail modal showing fee and tax breakdown table', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentsListPage />);

    const viewButtons = await screen.findAllByRole('button', { name: /View/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    // Check modal contents
    expect(await screen.findByRole('heading', { name: /Transaction: TXN-892104/i })).toBeInTheDocument();
    expect(screen.getByText(/Gross Platform Collection/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Base Charge/i)).toBeInTheDocument();
    expect(screen.getByText(/Applicable GST/i)).toBeInTheDocument();
  });

  it('opens audited refund processing modal with reason category and mandatory remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentsListPage />);

    const refundButtons = await screen.findAllByRole('button', { name: /^Refund$/i });
    expect(refundButtons.length).toBeGreaterThan(0);
    await user.click(refundButtons[0]);

    // Check refund modal contents
    expect(await screen.findByRole('heading', { name: /Audited Refund Authorization Workstation/i })).toBeInTheDocument();
    expect(screen.getByText(/Refund Reason Category/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated Idempotency Key:/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Authorize Refund/i });
    expect(submitBtn).toBeDisabled();

    // Enter remarks and confirm policy
    const remarksInput = screen.getByPlaceholderText(/Enter comprehensive operational justification/i);
    await user.type(remarksInput, 'Customer cancelled trial due to family relocation.');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(submitBtn).toBeEnabled();
  });

  it('displays NoAccessView when user lacks payments.view permission', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Verification Officer',
        email: 've@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<PaymentsListPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/payments\.view/i)).toBeInTheDocument();
  });
});
