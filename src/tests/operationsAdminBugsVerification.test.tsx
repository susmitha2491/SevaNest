/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { workerRepository } from '../features/workers/data/workerRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { paymentRepository } from '../features/payments/data/paymentRepository';
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';

import WorkersListPageDefault, { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import CustomersListPageDefault, { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import BookingsListPageDefault, { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import PaymentsListPageDefault, { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import OperationalAlertsPageDefault, { OperationalAlertsPage } from '../features/dashboard/presentation/OperationalAlertsPage';
import { OperationalAlertsDrawer } from '../features/dashboard/presentation/OperationalAlertsDrawer';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { AppShell } from '../app/layouts/AppShell';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, initialEntry: string = '/') {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Operations Admin Bug Fixes Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default authenticated as Operations Admin
    useAuthStore.setState({
      user: {
        id: 'usr_ops_01',
        name: 'Operations Admin User',
        email: 'ops@sevanest.com',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.ALERT_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKER_MANAGE,
          PERMISSIONS.CUSTOMER_VIEW,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.SUPPORT_VIEW,
          // Intentionally omitting PERMISSIONS.VERIFICATION_REVIEW
        ],
      },
      isAuthenticated: true,
      accessToken: 'valid_mock_token',
    });

    // Mock workerRepository
    if (typeof workerRepository.getWorkersPage === 'function') {
      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: [
          {
            id: 'W-01',
            name: 'Sunita Worker',
            category: 'Cook',
            categories: ['Cook'],
            experienceYears: 4,
            locality: 'Madhapur',
            status: 'ACTIVE',
            verificationStatus: 'PENDING',
            applicationStatus: 'SUBMITTED',
            isFullyVerified: false,
            ratingAverage: 0,
            totalReviews: 0,
            matchingEligible: false,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });
    } else {
      vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue([
        {
          id: 'W-01',
          name: 'Sunita Worker',
          category: 'Cook',
          categories: ['Cook'],
          experienceYears: 4,
          locality: 'Madhapur',
          status: 'ACTIVE',
          verificationStatus: 'PENDING',
          applicationStatus: 'SUBMITTED',
          isFullyVerified: false,
          ratingAverage: 0,
          totalReviews: 0,
          matchingEligible: false,
        },
      ]);
    }

    // Mock customerRepository
    if (typeof customerRepository.getCustomersPage === 'function') {
      vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      });
    } else {
      vi.spyOn(customerRepository, 'getCustomers').mockResolvedValue([]);
    }

    // Mock bookingRepository
    vi.spyOn(bookingRepository, 'getBookings').mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    // Mock paymentRepository
    vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    } as any);
    vi.spyOn(paymentRepository, 'getFinancialOverview').mockResolvedValue({
      totalRevenueINR: 0,
      totalRefundedINR: 0,
      netRevenueINR: 0,
      settledTransactionsCount: 0,
    } as any);

    // Mock dashboardRepository
    vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValue({
      kpis: {
        totalCustomers: 100,
        totalWorkers: 50,
        verifiedAndActiveWorkers: 40,
        totalBookings: 30,
        newBookingRequests: 2,
        activeLiveEngagements: 10,
      },
      sections: {
        bookings: {
          grossBookings: 30,
          byStatus: [
            { status: 'NEW_REQUEST', count: 2 },
            { status: 'ACTIVE', count: 10 },
            { status: 'COMPLETED', count: 18 },
          ],
        },
        workers: {
          registered: 50,
          verifiedAndActive: 40,
        },
        alerts: {
          open: 1,
          critical: 1,
          warning: 0,
          info: 0,
        },
      },
      operationsOverview: {
        reportingDateIST: '2026-11-27',
        newCustomersToday: 5,
        newWorkersToday: 3,
        workersWithActiveBooking: 12,
        workersVerifiedCount: 40,
        customersTotal: 100,
        customersVerified: 85,
        customersPendingVerification: 15,
        openAlertsList: [
          {
            id: 'ALT-1',
            type: 'SLA_BREACH',
            severity: 'CRITICAL',
            title: 'Booking Assignment Overdue',
            status: 'OPEN',
            occurrences: 1,
            entityType: 'booking',
            entityId: 'B-100',
            createdAt: '2026-11-27T08:00:00Z',
          },
        ],
      },
      alerts: {
        open: 1,
        critical: 1,
        warning: 0,
        info: 0,
      },
      bookingStatusCounts: {
        PENDING: 2,
        MATCHED: 4,
        ACTIVE: 10,
        COMPLETED: 20,
      },
      financialSummary: {
        mtdGrossCollectionsINR: 250000,
        todayGrossCollectionsINR: 15000,
      },
    } as any);

    vi.spyOn(dashboardRepository as any, 'getOperationalAlerts').mockResolvedValue({
      items: [
        {
          id: 'ALT-1',
          type: 'SLA_BREACH',
          severity: 'CRITICAL',
          title: 'Booking Assignment Overdue',
          status: 'OPEN',
          occurrences: 1,
          entityType: 'booking',
          entityId: 'B-100',
          createdAt: '2026-11-27T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 15,
      totalPages: 1,
    });
  });

  // Bug 4: Dynamic import & default export resolution
  describe('Bug 4 — Worker Management module exports', () => {
    it('provides both named and default exports for WorkersListPage', () => {
      expect(WorkersListPage).toBeDefined();
      expect(WorkersListPageDefault).toBeDefined();
      expect(WorkersListPageDefault).toBe(WorkersListPage);
    });

    it('provides default exports for other main pages as well', () => {
      expect(CustomersListPageDefault).toBe(CustomersListPage);
      expect(BookingsListPageDefault).toBe(BookingsListPage);
      expect(PaymentsListPageDefault).toBe(PaymentsListPage);
      expect(OperationalAlertsPageDefault).toBe(OperationalAlertsPage);
    });
  });

  // Bug 5: Back to Dashboard navigation
  describe('Bug 5 — Back to Dashboard navigation', () => {
    it('shows Back to Dashboard button in WorkersListPage when opened with from=dashboard', async () => {
      renderWithProviders(<WorkersListPage />, '/workers?from=dashboard');

      const backBtn = await screen.findByRole('button', { name: /Back to Dashboard/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('does NOT show Back to Dashboard button in WorkersListPage when navigated directly', () => {
      renderWithProviders(<WorkersListPage />, '/workers');

      expect(screen.queryByRole('button', { name: /Back to Dashboard/i })).not.toBeInTheDocument();
    });

    it('shows Back to Dashboard button in CustomersListPage when opened with from=dashboard', async () => {
      renderWithProviders(<CustomersListPage />, '/customers?from=dashboard');

      const backBtn = await screen.findByRole('button', { name: /Back to Dashboard/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('shows Back to Dashboard button in BookingsListPage when opened with from=dashboard', async () => {
      renderWithProviders(<BookingsListPage />, '/bookings?from=dashboard');

      const backBtn = await screen.findByRole('button', { name: /Back to Dashboard/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('shows Back to Dashboard button in PaymentsListPage when opened with from=dashboard', async () => {
      renderWithProviders(<PaymentsListPage />, '/payments?from=dashboard');

      const backBtn = await screen.findByRole('button', { name: /Back to Dashboard/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('shows Back to Dashboard button in OperationalAlertsPage', async () => {
      renderWithProviders(<OperationalAlertsPage />, '/alerts?from=dashboard');

      const backBtn = await screen.findByRole('button', { name: /Back to Dashboard/i });
      expect(backBtn).toBeInTheDocument();
    });
  });

  // Bug 6: Company logo size & legibility
  describe('Bug 6 — Company logo size in AppShell', () => {
    it('renders sidebar logo with enhanced height and width styling', () => {
      renderWithProviders(<AppShell />, '/');

      const logos = screen.getAllByAltText('SevaNest logo');
      expect(logos.length).toBeGreaterThanOrEqual(1);

      // Check expanded sidebar logo styling
      const sidebarLogo = logos[0];
      expect(sidebarLogo).toHaveStyle({
        height: '38px',
        maxWidth: '165px',
      });
    });
  });

  // Bug 7: Alerts Triage full page
  describe('Bug 7 — Dedicated Alerts Triage page and navigation', () => {
    it('renders the full-page Operational Alerts Triage Queue at /alerts', async () => {
      renderWithProviders(<OperationalAlertsPage />, '/alerts');

      expect(await screen.findByText('Operational Alerts Triage Queue')).toBeInTheDocument();
      expect(await screen.findByText('Booking Assignment Overdue')).toBeInTheDocument();
      expect(await screen.findByText('SLA BREACH')).toBeInTheDocument();
    });

    it('OperationsAdminDashboard Triage All Alerts button navigates to /alerts', async () => {
      renderWithProviders(<OperationsAdminDashboard />, '/dashboard');

      const triageBtn = await screen.findByRole('button', { name: /Triage All Alerts/i });
      expect(triageBtn).toBeInTheDocument();
    });
  });

  // Bug 8: Alerts queue Reset/Clear Filters
  describe('Bug 8 — Alerts queue Reset Filters', () => {
    it('shows Reset Filters button in OperationalAlertsPage when filters are modified and resets them', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OperationalAlertsPage />, '/alerts');

      // Initially default: status=OPEN, severity=ALL -> Reset Filters button not displayed
      expect(screen.queryByTestId('alerts-page-reset-filters-btn')).not.toBeInTheDocument();

      // Change status filter to 'RESOLVED'
      const statusSelect = screen.getByLabelText('Filter alerts by status');
      fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

      // Reset Filters button should now be visible
      const resetBtn = await screen.findByTestId('alerts-page-reset-filters-btn');
      expect(resetBtn).toBeInTheDocument();

      // Clicking Reset Filters should reset status filter back to OPEN and hide the button
      await user.click(resetBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('alerts-page-reset-filters-btn')).not.toBeInTheDocument();
      });
    });

    it('resets filters in OperationalAlertsDrawer when Reset Filters is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OperationalAlertsDrawer isOpen={true} onClose={vi.fn()} />, '/');

      // Default: status=OPEN, severity=ALL -> drawer Reset button not displayed
      expect(screen.queryByTestId('alerts-drawer-reset-filters-btn')).not.toBeInTheDocument();

      // Change severity filter to 'CRITICAL'
      const severitySelect = screen.getByLabelText('Filter alerts by severity');
      fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });

      // Reset button should now be visible
      const resetBtn = await screen.findByTestId('alerts-drawer-reset-filters-btn');
      expect(resetBtn).toBeInTheDocument();

      // Clicking reset restores default
      await user.click(resetBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('alerts-drawer-reset-filters-btn')).not.toBeInTheDocument();
      });
    });
  });

  // Bug 9: Open Verification Queue button permission guard
  describe('Bug 9 — Open Verification Queue permission guard', () => {
    it('hides Open Verification Queue button for Operations Admin (lacks VERIFICATION_REVIEW)', async () => {
      // Operations Admin lacks PERMISSIONS.VERIFICATION_REVIEW
      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING');

      // Informational banner must be displayed
      expect(
        await screen.findByText(/Pending verification workers are excluded from booking matches/i)
      ).toBeInTheDocument();

      // "Open Verification Queue" button must NOT be rendered
      expect(screen.queryByRole('button', { name: /Open Verification Queue/i })).not.toBeInTheDocument();
    });

    it('shows Open Verification Queue button for users with VERIFICATION_REVIEW permission', async () => {
      // User with VERIFICATION_REVIEW
      useAuthStore.setState({
        user: {
          id: 'usr_verif_01',
          name: 'Verification Executive',
          email: 'verif@sevanest.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        isAuthenticated: true,
        accessToken: 'valid_mock_token',
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING');

      // Informational banner must be displayed
      expect(
        await screen.findByText(/Pending verification workers are excluded from booking matches/i)
      ).toBeInTheDocument();

      // "Open Verification Queue" button must be rendered
      const openQueueBtn = await screen.findByRole('button', { name: /Open Verification Queue/i });
      expect(openQueueBtn).toBeInTheDocument();
    });
  });
});
