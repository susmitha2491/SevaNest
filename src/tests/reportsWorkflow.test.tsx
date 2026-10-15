import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
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

describe('Operational Reports & Analytics Workflows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.REPORTS_VIEW,
          PERMISSIONS.EXPORTS_GENERATE,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders reports catalogue with all 12 standard report cards and filter controls', async () => {
    renderWithProviders(<ReportsDashboardPage />);

    expect(
      await screen.findByRole('heading', { name: /Operational & Business Reports/i })
    ).toBeInTheDocument();

    expect(screen.getByText('All 12 Reports')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search reports by title, ID, or description/i)).toBeInTheDocument();

    // Verify presence of standard PRD reports
    expect(await screen.findByText('REP-01')).toBeInTheDocument();
    expect(screen.getByText('New Customer Acquisition by Period & Locality')).toBeInTheDocument();
    expect(screen.getByText('REP-12')).toBeInTheDocument();
    expect(screen.getByText('Gross Booking Value, Fee Realization & Refunds')).toBeInTheDocument();
  });

  it('filters reports catalogue by category pill and search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsDashboardPage />);

    const financePill = await screen.findByRole('button', { name: /^Finance$/i });
    await user.click(financePill);

    expect(await screen.findByText('REP-12')).toBeInTheDocument();
    expect(screen.queryByText('REP-01')).not.toBeInTheDocument();

    // Search within finance
    const searchInput = screen.getByPlaceholderText(/Search reports by title, ID, or description/i);
    await user.type(searchInput, 'Realization');
    expect(screen.getByText('Gross Booking Value, Fee Realization & Refunds')).toBeInTheDocument();
  });

  it('opens report preview modal displaying KPI indicators, dataset table, and triggers CSV export', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsDashboardPage />);

    const previewButtons = await screen.findAllByRole('button', { name: /Preview/i });
    expect(previewButtons.length).toBeGreaterThan(0);
    await user.click(previewButtons[0]);

    // Check modal contents
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Key Report Indicators/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Total Signups/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Tabular Dataset Preview/i)).toBeInTheDocument();
    expect(screen.getByText('HITEC City')).toBeInTheDocument();

    // Trigger CSV Export
    const exportCsvBtn = screen.getByRole('button', { name: /Export CSV/i });
    await user.click(exportCsvBtn);

    expect(await screen.findByText(/Audited CSV exported/i)).toBeInTheDocument();
  });

  it('displays NoAccessView when user lacks reports.view permission', async () => {
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

    renderWithProviders(<ReportsDashboardPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/reports\.view/i)).toBeInTheDocument();
  });
});
