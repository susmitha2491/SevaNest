import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.BOOKINGS_MANAGE,
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

  describe('1. Operations Admin Dashboard & Workstation Queues', () => {
    it('renders all 12 operational KPI cards and allows queue switching across tabs', async () => {
      renderWithProviders(<OperationsAdminDashboard />);

      // Dashboard header
      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();

      // KPI summary cards
      expect(screen.getByText('Total Customers')).toBeInTheDocument();
      expect(screen.getByText('Available Workforce')).toBeInTheDocument();
      expect(screen.getByText('New Requests')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Matching')).toBeInTheDocument();
      expect(screen.getByText("Today's Trials")).toBeInTheDocument();
      expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Active Engagements')).toBeInTheDocument();
      expect(screen.getByText('Replacement Queue')).toBeInTheDocument();
      expect(screen.getByText('Pending Verification')).toBeInTheDocument();
      expect(screen.getByText('Open Disputes')).toBeInTheDocument();
      expect(screen.getByText('Pending Refunds')).toBeInTheDocument();
      expect(screen.getByText('Police Verif Alert')).toBeInTheDocument();

      // Check default New Booking Requests queue tab
      expect(screen.getByText(/New Booking Requests \(\d+\)/)).toBeInTheDocument();
      expect(screen.getByText('Anand Sharma')).toBeInTheDocument();

      // Switch to Urgent Replacements tab
      const replacementTab = screen.getByText(/Urgent Replacements \(\d+\)/);
      fireEvent.click(replacementTab);
      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();
      expect(screen.getAllByText('Process Rematch').length).toBeGreaterThan(0);

      // Switch to Refund Authorizations tab
      const refundTab = screen.getByText(/Refund Authorizations \(\d+\)/);
      fireEvent.click(refundTab);
      expect(await screen.findByText('TXN-892050')).toBeInTheDocument();
      expect(screen.getAllByText('Authorize Refund').length).toBeGreaterThan(0);

      // Switch to Operational Follow-up tab
      const followUpTab = screen.getByText(/Operational Follow-up \(\d+\)/);
      fireEvent.click(followUpTab);
      expect(await screen.findByText(/Sunita Devi \(Worker\)/)).toBeInTheDocument();
    });
  });

  describe('2. Verification Visibility & Trust Oversight Boundaries', () => {
    it('allows Operations Admin to inspect worker dossiers and request re-verification, but hides approval and rejection controls', async () => {
      renderWithProviders(<VerificationQueuePage />);

      // Queue renders
      expect(await screen.findByText('Worker Verification & Trust Operations')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Click Inspect Dossier button
      const inspectButtons = screen.getAllByRole('button', { name: /Inspect Dossier/i });
      fireEvent.click(inspectButtons[0]);

      // Dossier modal opens with verification checks
      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Identity Proof/i).length).toBeGreaterThan(0);

      // Strictly verify: Operations Admin has oversight only, NO "Approve Check" or "Reject Check" decision buttons
      expect(screen.queryByRole('button', { name: /^Approve Check$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Reject Check$/i })).not.toBeInTheDocument();

      // Operations Admin can request re-verification or inspect worker profile
      expect(screen.getByRole('button', { name: /Request Re-Verification/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Inspect Worker Profile/i })).toBeInTheDocument();
      expect(screen.getByText(/Verification decisions reserved for Verification Executives/i)).toBeInTheDocument();
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

    it('hides Control section (Configuration Masters and Audit Trail) from sidebar navigation', async () => {
      renderWithProviders(<AppShell />);

      // Operations Admin should see permitted sections
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Verification Review')).toBeInTheDocument();
      expect(screen.getByText('Booking Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Workers')).toBeInTheDocument();
      expect(screen.getByText('Transactions & Fees')).toBeInTheDocument();
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();

      // Restricted items MUST NOT exist in navigation
      expect(screen.queryByText('Configuration Masters')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Trail')).not.toBeInTheDocument();
      expect(screen.queryByText('Control')).not.toBeInTheDocument();
    });
  });
});
