import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { AuditTrailPage } from '../features/audit/presentation/AuditTrailPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ProtectedRoute } from '../app/router/ProtectedRoute';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Operations Admin Role — End-to-End Workflow & Boundary Suite', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(
      {
        id: 'ops-admin-01',
        name: 'Sneha Rao (Operations Lead)',
        email: 'ops.lead@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.CUSTOMER_VIEW,
          PERMISSIONS.CUSTOMERS_MANAGE,
          PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.WORKERS_MANAGE_STATUS,
          PERMISSIONS.WORKER_ACTIVATE,
          'verification.reassign',
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.BOOKINGS_MANAGE,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.ATTENDANCE_MANAGE,
          PERMISSIONS.RATING_VIEW,
          PERMISSIONS.RATING_MODERATE,
          PERMISSIONS.ALERT_VIEW,
          PERMISSIONS.ALERT_MANAGE,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.REFUNDS_MANAGE,
          PERMISSIONS.SUPPORT_VIEW,
          PERMISSIONS.SUPPORT_MANAGE,
          PERMISSIONS.REPORTS_VIEW,
          PERMISSIONS.EXPORTS_GENERATE,
        ],
      },
      'test-ops-token'
    );
  });

  describe('1. Operations Admin Dashboard & Core Visualizations', () => {
    it('renders essential PRD operational KPIs, status distribution, and triage breakdown without cluttered legacy tabs', async () => {
      renderWithProviders(<OperationsAdminDashboard />);

      // Dashboard header
      expect(await screen.findByRole('heading', { name: 'Operations Command Console' })).toBeInTheDocument();

      // Essential Operational KPI cards
      expect(screen.getAllByText('Total Bookings').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Available Workers')).toBeInTheDocument();
      expect(screen.getByText('Open Alerts')).toBeInTheDocument();
      expect(screen.getByText('Collections (MTD)')).toBeInTheDocument();

      // Core Operational Sections & Action Triggers
      expect(screen.getByRole('heading', { name: 'Booking Overview' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Customer Overview' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Worker Overview' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Unresolved Operational Alerts/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Replacement Overview' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Support Overview' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Bookings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Support/i })).toBeInTheDocument();

      // Cluttered legacy sections removed
      expect(screen.queryByText('End-to-End Booking Lifecycle Monitor')).not.toBeInTheDocument();
      expect(screen.queryByText('Verification Progress Oversight')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Refunds & Settlements')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent Operational Activities & Backlog Queues')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('2. Verification Visibility & Trust Oversight Boundaries', () => {
    it('restricts Verification Queue access and renders standard NoAccessView when Operations Admin lacks verification.review', async () => {
      renderWithProviders(<VerificationQueuePage />);

      // Queue does NOT render for unauthorized user
      expect(screen.queryByText('Worker Verification & Trust Operations')).not.toBeInTheDocument();

      // Standard access-denied state is rendered
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: verification\.review/i)).toBeInTheDocument();
    });

    it('protects route-level direct navigation to /verification and renders standard NoAccessView without redirecting to unrelated module', async () => {
      renderWithProviders(
        <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
          <VerificationQueuePage />
        </ProtectedRoute>,
        '/verification'
      );

      // Standard access-denied state is rendered
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: verification\.review/i)).toBeInTheDocument();
      expect(screen.queryByText('Worker Verification & Trust Operations')).not.toBeInTheDocument();
    });
  });

  describe('3. Customer & Worker Management Workflows', () => {
    it('allows Operations Admin to view customer list with masked PII', async () => {
      renderWithProviders(<CustomersListPage />);

      expect(await screen.findByText('Customer Accounts & Households')).toBeInTheDocument();
      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();
      expect(screen.getByText('+91 98**** **12')).toBeInTheDocument();
    });

    it('allows Operations Admin to view worker roster and service categories', async () => {
      renderWithProviders(<WorkersListPage />);

      expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getAllByText('House Maid').length).toBeGreaterThan(0);
    });
  });

  describe('4. Booking Fulfillment, Trials & Replacement Orchestration', () => {
    it('renders canonical status tabs and allows matching workflow for new requests', async () => {
      renderWithProviders(<BookingsListPage />);

      expect(await screen.findByText('Booking & Service Management')).toBeInTheDocument();

      // Quick filter tabs are present
      expect(screen.getByRole('button', { name: /All Bookings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Requests/i })).toBeInTheDocument();

      // Verify booking rows
      expect(await screen.findByText('B-84920')).toBeInTheDocument();
      expect(screen.getByText('Anand Sharma')).toBeInTheDocument();

      // Status badge displays canonical label
      expect(screen.getByText('New request')).toBeInTheDocument();
    });

    it('renders replacement management view with default replacement filter and header', async () => {
      renderWithProviders(<BookingsListPage defaultStatus="REPLACEMENT_REQUESTED" />);

      expect(await screen.findByText('Replacement Management')).toBeInTheDocument();
      expect(screen.getByText(/Operational replacement coordination/i)).toBeInTheDocument();
    });
  });

  describe('5. Payments, Fees & Refund Authorizations', () => {
    it('allows Operations Admin to view ledger and open refund authorization modal with policy check', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PaymentsListPage />);

      expect(await screen.findByText('Financial Transactions & Refunds')).toBeInTheDocument();
      expect(await screen.findByText('TXN-892050')).toBeInTheDocument();

      // Open refund modal
      const refundButtons = await screen.findAllByRole('button', { name: /^Refund$/i });
      expect(refundButtons.length).toBeGreaterThan(0);
      await user.click(refundButtons[0]);

      // Modal appears
      expect(await screen.findByRole('heading', { name: /Audited Refund Authorization Workstation/i })).toBeInTheDocument();
      expect(screen.getByText(/Commercial Cancellation Policies/i)).toBeInTheDocument();

      // Submit is initially disabled before policy confirmation and remarks
      const submitBtn = screen.getByRole('button', { name: /Authorize Refund/i });
      expect(submitBtn).toBeDisabled();

      // Enter remarks and confirm checkbox
      const remarksInput = screen.getByPlaceholderText(/Enter comprehensive operational justification/i);
      await user.type(remarksInput, 'Approved trial refund per customer dissatisfaction report.');

      const policyCheckbox = screen.getByRole('checkbox');
      await user.click(policyCheckbox);

      expect(submitBtn).toBeEnabled();
    });
  });

  describe('6. Support Grievances & Operational Reports', () => {
    it('allows Operations Admin to view support tickets and operational reports', async () => {
      renderWithProviders(<SupportTicketsPage />);
      expect(await screen.findByText('Support Grievance & SLA Queue')).toBeInTheDocument();
      expect(await screen.findByText('TKT-4921')).toBeInTheDocument();
    });

    it('renders reports catalog with standard reports', async () => {
      renderWithProviders(<ReportsDashboardPage />);
      expect(await screen.findByText(/Operational & Business Reports/i)).toBeInTheDocument();
      expect(await screen.findByText('New Customer Acquisition by Period & Locality')).toBeInTheDocument();
      expect(screen.getByText('Worker Registration & Onboarding Drop-off Funnel')).toBeInTheDocument();
    });
  });

  describe('7. Security & Strict RBAC Boundaries for Operations Admin', () => {
    it('prohibits Operations Admin from accessing Super Admin configuration masters', async () => {
      renderWithProviders(
        <Routes>
          <Route
            path="/configuration"
            element={
              <ProtectedRoute permission={PERMISSIONS.CONFIGURATION_MANAGE}>
                <ConfigurationMastersPage />
              </ProtectedRoute>
            }
          />
        </Routes>,
        '/configuration'
      );

      // Access restricted view should be rendered
      expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });

    it('prohibits Operations Admin from accessing Super Admin audit trail', async () => {
      renderWithProviders(
        <Routes>
          <Route
            path="/audit"
            element={
              <ProtectedRoute permission={PERMISSIONS.AUDIT_VIEW}>
                <AuditTrailPage />
              </ProtectedRoute>
            }
          />
        </Routes>,
        '/audit'
      );

      // Access restricted view should be rendered
      expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/audit\.view/i)).toBeInTheDocument();
    });

    it('renders the 9 PRD-approved primary modules and hides Verification Management when unauthorized', async () => {
      renderWithProviders(<AppShell />);

      // Operations Admin sidebar navigation items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Customer Management')).toBeInTheDocument();
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Booking Management')).toBeInTheDocument();
      expect(screen.getByText('Attendance & Daily Logs')).toBeInTheDocument();
      expect(screen.getByText('Ratings & Reviews')).toBeInTheDocument();
      expect(screen.getByText('Payments Management')).toBeInTheDocument();
      expect(screen.getByText('Support Management')).toBeInTheDocument();
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();

      // Alerts and Recent Activity belong inside Dashboard, never separate sidebar links
      expect(screen.queryByRole('link', { name: /Operational Alerts/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Recent Activity/i })).not.toBeInTheDocument();

      // Verification Management must NOT be visible for Operations Admin without verification.review
      expect(screen.queryByText('Verification Management')).not.toBeInTheDocument();
      expect(screen.queryByText('Verification')).not.toBeInTheDocument();

      // Replacement Management must NOT be a separate primary sidebar module
      expect(screen.queryByRole('link', { name: /Replacement Management/i })).not.toBeInTheDocument();

      // Super Admin governance modules MUST NOT exist in navigation
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Trail')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
      expect(screen.queryByText('Administrator Accounts')).not.toBeInTheDocument();
    });

    it('displays all 9 authorized modules when authorized with backend-issued server permissions (Verification hidden)', async () => {
      // Simulate exact backend-issued permission array returned by POST /api/v1/auth/admin/login
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-server-01',
          name: 'Operations Manager',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            'booking.view',
            'booking.manage',
            'customer.view',
            'customer.manage',
            'worker.view',
            'worker.manage',
            'matching.run',
            'replacement.view',
            'replacement.manage',
            'attendance.view',
            'attendance.manage',
            'payment.view',
            'support.view',
            'rating.view',
            'rating.moderate',
            'report.view',
            'notification.manage',
            'category.manage',
            'area.manage',
            'user.view',
            'alert.view',
            'alert.manage',
            'verification.signoff',
            'verification.reassign',
            'worker.activate',
          ],
        },
        'server-token-123'
      );

      renderWithProviders(<AppShell />);

      // All 9 primary authorized modules must resolve to true based on backend-issued permissions
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Customer Management')).toBeInTheDocument();
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Booking Management')).toBeInTheDocument();
      expect(screen.getByText('Attendance & Daily Logs')).toBeInTheDocument();
      expect(screen.getByText('Ratings & Reviews')).toBeInTheDocument();
      expect(screen.getByText('Payments Management')).toBeInTheDocument();
      expect(screen.getByText('Support Management')).toBeInTheDocument();
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();

      // Verification Management is strictly hidden because Operations Admin lacks verification.review
      expect(screen.queryByText('Verification Management')).not.toBeInTheDocument();
      expect(screen.queryByText('Verification')).not.toBeInTheDocument();

      // No separate replacement module
      expect(screen.queryByRole('link', { name: /Replacement Management/i })).not.toBeInTheDocument();
    });
  });
});
