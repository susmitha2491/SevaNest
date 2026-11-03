import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { AuditTrailPage } from '../features/audit/presentation/AuditTrailPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Portal-wide Clickable Table Rows Verification', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-01',
        name: 'Super Admin',
        email: 'admin@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
      isAuthenticated: true,
    });
  });

  it('verifies clickable rows in Booking Management page', async () => {
    renderWithProviders(<BookingsListPage />);

    expect(await screen.findByRole('heading', { name: /Booking & Service Management/i })).toBeInTheDocument();

    const bookingRows = await screen.findAllByRole('button', { name: /View booking details for/i });
    expect(bookingRows.length).toBeGreaterThan(0);

    const firstRow = bookingRows[0];
    expect(firstRow).toHaveClass('clickable-table-row');
    expect(firstRow).toHaveAttribute('tabIndex', '0');

    // Click row and confirm booking detail modal opens
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Booking Details:/i })).toBeInTheDocument();
    });
  });

  it('verifies clickable rows in Customer Management page', async () => {
    renderWithProviders(<CustomersListPage />);

    expect(await screen.findByRole('heading', { name: /Customer Accounts & Households/i })).toBeInTheDocument();

    const customerRows = await screen.findAllByRole('button', { name: /View profile for .+ \(C-\d+\)/i });
    expect(customerRows.length).toBeGreaterThan(0);

    const firstRow = customerRows[0];
    expect(firstRow).toHaveClass('clickable-table-row');
    expect(firstRow).toHaveAttribute('tabIndex', '0');

    // Click row and confirm customer detail modal opens
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(screen.getByText(/1\. Profile & Household/i)).toBeInTheDocument();
    });
  });

  it('verifies clickable rows in Payments Ledger page', async () => {
    renderWithProviders(<PaymentsListPage />);

    expect(await screen.findByRole('heading', { name: /Financial Transactions & Refunds/i })).toBeInTheDocument();

    const paymentRows = await screen.findAllByRole('button', { name: /View transaction details for/i });
    expect(paymentRows.length).toBeGreaterThan(0);

    const firstRow = paymentRows[0];
    expect(firstRow).toHaveClass('clickable-table-row');
    expect(firstRow).toHaveAttribute('tabIndex', '0');

    // Press Enter on row and confirm transaction detail modal opens
    fireEvent.keyDown(firstRow, { key: 'Enter', code: 'Enter' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Transaction:/i })).toBeInTheDocument();
    });
  });

  it('verifies clickable rows in Support Tickets page', async () => {
    renderWithProviders(<SupportTicketsPage />);

    expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i })).toBeInTheDocument();

    const ticketRows = await screen.findAllByRole('button', { name: /View support ticket details for/i });
    expect(ticketRows.length).toBeGreaterThan(0);

    const firstRow = ticketRows[0];
    expect(firstRow).toHaveClass('clickable-table-row');
    expect(firstRow).toHaveAttribute('tabIndex', '0');

    // Click row and confirm support ticket modal opens
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Grievance Case:/i })).toBeInTheDocument();
    });
  });

  it('verifies clickable rows in Audit Trail page', async () => {
    renderWithProviders(<AuditTrailPage />);

    expect(await screen.findByRole('heading', { name: /Authoritative Platform Audit Trail/i })).toBeInTheDocument();

    const auditRows = await screen.findAllByRole('button', { name: /View audit log details for event/i });
    expect(auditRows.length).toBeGreaterThan(0);

    const firstRow = auditRows[0];
    expect(firstRow).toHaveClass('clickable-table-row');
    expect(firstRow).toHaveAttribute('tabIndex', '0');

    // Click row and confirm audit detail modal opens
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(screen.getByText(/Target Entity:/i)).toBeInTheDocument();
    });
  });
});
