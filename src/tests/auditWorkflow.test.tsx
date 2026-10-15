import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuditTrailPage } from '../features/audit/presentation/AuditTrailPage';
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

describe('Authoritative Audit Trail Workflows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.AUDIT_VIEW],
      },
      isAuthenticated: true,
    });
  });

  it('renders read-only audit log table with event metadata and action type tags', async () => {
    renderWithProviders(<AuditTrailPage />);

    expect(
      await screen.findByRole('heading', { name: /Authoritative Platform Audit Trail/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Strictly Read-Only — Simulated Immutability Log/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search audit trail by actor, target ID/i)).toBeInTheDocument();

    // Verify audit log entries
    expect(await screen.findByText('AUD-901')).toBeInTheDocument();
    expect(screen.getByText(/Approved Aadhaar Identity & Address Proof/i)).toBeInTheDocument();
    expect(screen.getByText('AUD-902')).toBeInTheDocument();
  });

  it('filters audit records by action type dropdown and search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuditTrailPage />);

    const filterSelect = await screen.findByLabelText(/Filter by action type/i);
    await user.selectOptions(filterSelect, 'CONFIG_PUBLISH_FEES');

    expect(await screen.findByText('AUD-902')).toBeInTheDocument();
    expect(screen.queryByText('AUD-901')).not.toBeInTheDocument();

    // Search by target ID
    const searchInput = screen.getByPlaceholderText(/Search audit trail by actor, target ID/i);
    await user.type(searchInput, 'CFG-FEES');
    expect(screen.getByText('AUD-902')).toBeInTheDocument();
  });

  it('opens audit detail modal displaying pre/post state snapshot diff and actor justification remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuditTrailPage />);

    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    await user.click(inspectButtons[0]);

    // Check modal contents
    expect(await screen.findByRole('heading', { name: /Approved Aadhaar Identity & Address Proof/i })).toBeInTheDocument();
    expect(screen.getByText(/Recorded Operational Justification/i)).toBeInTheDocument();
    expect(screen.getByText(/Aadhaar QR verified against UIDAI offline XML standard/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-Mutation Snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Post-Mutation Snapshot/i)).toBeInTheDocument();
    expect(screen.getAllByText(/10.0.4.12/i).length).toBeGreaterThan(0);

    // Verify immutability disclaimer
    expect(screen.getByText(/Immutable write-only record — Modifications strictly prohibited/i)).toBeInTheDocument();
  });

  it('verifies that no edit or delete controls exist in the audit trail', async () => {
    renderWithProviders(<AuditTrailPage />);

    await screen.findByText('AUD-901');

    // Confirm neither Delete nor Edit buttons exist anywhere
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
  });

  it('displays NoAccessView when user lacks audit.view permission', async () => {
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

    renderWithProviders(<AuditTrailPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/audit\.view/i)).toBeInTheDocument();
  });
});
