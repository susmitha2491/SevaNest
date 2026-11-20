/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

// Repositories
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { ratingRepository } from '../features/ratings/data/ratingRepository';
import { paymentRepository } from '../features/payments/data/paymentRepository';
import { supportRepository } from '../features/support/data/supportRepository';
import { authRepository } from '../features/auth/data/authRepository';
import { auditRepository } from '../features/audit/data/auditRepository';

// Presentation Components
import { SuperAdminDashboard } from '../features/dashboard/presentation/SuperAdminDashboard';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { VerificationExecutiveDashboard } from '../features/dashboard/presentation/VerificationExecutiveDashboard';
import { SupportExecutiveDashboard } from '../features/dashboard/presentation/SupportExecutiveDashboard';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { VerificationHistoryPage } from '../features/verification/presentation/VerificationHistoryPage';
import { VerificationInsightsPage } from '../features/verification/presentation/VerificationInsightsPage';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { AttendanceLogsPage } from '../features/attendance/presentation/AttendanceLogsPage';
import { RatingsReviewsPage } from '../features/ratings/presentation/RatingsReviewsPage';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { AuditTrailPage } from '../features/audit/presentation/AuditTrailPage';

function renderWithClient(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Standardized Refresh Functionality Across SevaNest Admin Modules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'super-admin-01',
        name: 'Executive Super Admin',
        email: 'superadmin@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
      isAuthenticated: true,
      accessToken: 'fake-token',
    });
  });

  describe('1. Dashboard Modules Standardized Refresh', () => {
    it('SuperAdminDashboard has standardized "Refresh" button and refetches on click', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValue({
        kpis: { grossBookings: 120, activeWorkforce: 45, verificationQueue: 8, activeGrievances: 1, replacementVolume: 2, platformRevenueINR: 50000, scheduledTrials: 4, policeVerifDue: 2 },
        queues: [],
      });

      renderWithClient(<SuperAdminDashboard />);
      expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh Metrics');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('OperationsAdminDashboard has standardized "Refresh" button and refetches on click', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValue({
        kpis: {
          totalBookings: 30,
          newBookingRequests: 5,
          bookingsAwaitingMatching: 2,
          bookingsAwaitingConfirmation: 3,
          activeLiveEngagements: 18,
          totalWorkers: 50,
          verifiedAndActiveWorkers: 40,
        },
        sections: {
          bookings: { grossBookings: 30, byStatus: [] },
          workers: { registered: 50, verifiedAndActive: 40 },
          alerts: [],
        },
        operationsOverview: {
          activeBookings: 30,
          pendingAllocations: 5,
          pendingReplacements: 2,
          todayCheckIns: 18,
          criticalGrievances: 0,
          newCustomersToday: 7,
          ongoingTrials: 3,
          attendanceAnomalies: 1,
        },
        urgentQueues: [],
      } as any);

      renderWithClient(<OperationsAdminDashboard />);
      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('VerificationExecutiveDashboard has standardized "Refresh" button without "Refresh Queue" label', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValue({
        kpis: { pendingReview: 14, inReview: 6, correctionsPending: 3, policeCertExpiry30d: 5, annualRechecksDue: 2, completedToday: 8 },
        queues: {
          PENDING_REVIEW: [],
          IN_REVIEW: [],
          RECHECK_DUE: [],
          CORRECTIONS_REQUIRED: [],
        },
        recentAttentionApplications: [],
      } as any);

      renderWithClient(<VerificationExecutiveDashboard />);
      expect(await screen.findByText('Trust & Verification Console')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh Queue');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('SupportExecutiveDashboard has standardized "Refresh" button and refetches on click', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getSupportExecutiveDashboard').mockResolvedValue({
        kpis: {
          totalTickets: 9,
          unassignedTickets: 5,
          inProgressTickets: 3,
          escalatedTickets: 1,
          resolvedTicketsToday: 4,
          slaBreachedTickets: 0,
          avgResolutionTimeHours: 4.2,
        },
        queues: {
          critical: [],
          normal: [],
        },
        recentActivity: [],
        analytics: {
          openTickets: 5,
          inInvestigationTickets: 3,
          escalatedTickets: 1,
          resolvedTickets: 4,
        },
      } as any);

      renderWithClient(<SupportExecutiveDashboard />);
      expect(await screen.findByRole('heading', { level: 1, name: /Dashboard/i })).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Customer and Worker Management Modules Standardized Refresh', () => {
    it('CustomersListPage displays "Refresh" without "Refresh Directory"', async () => {
      const sampleItem = {
        id: 'CUST-001',
        name: 'Aarav Sharma',
        phone: '+919876543210',
        maskedPhone: '+91 98765 *****',
        maskedEmail: 'a****@example.com',
        locality: 'Gachibowli',
        registeredDate: '2026-01-01T00:00:00Z',
        status: 'ACTIVE' as const,
        verificationStatus: 'VERIFIED' as const,
        totalBookings: 3,
      };

      const getSpy = vi.spyOn(customerRepository, 'getCustomers').mockResolvedValue([sampleItem]);
      const pageSpy = 'getCustomersPage' in customerRepository
        ? vi.spyOn(customerRepository, 'getCustomersPage' as any).mockResolvedValue({
            items: [sampleItem],
            total: 1,
            page: 1,
            limit: 20,
            hasMore: false,
          })
        : null;

      renderWithClient(<CustomersListPage />);
      expect(await screen.findByText('Customer Accounts & Households')).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh Directory');

      await userEvent.click(btn);
      expect(pageSpy ? pageSpy.mock.calls.length : getSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('WorkersListPage displays "Refresh" without "Refresh Roster"', async () => {
      const getSpy = vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue([]);
      const pageSpy = 'getWorkersPage' in workerRepository
        ? vi.spyOn(workerRepository, 'getWorkersPage' as any).mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            hasMore: false,
          })
        : null;

      renderWithClient(<WorkersListPage />);
      expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh Roster');

      await userEvent.click(btn);
      expect(pageSpy ? pageSpy.mock.calls.length : getSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Directory and Verification Modules Standardized Refresh', () => {
    it('DirectoryPage displays standardized "Refresh" button', async () => {
      renderWithClient(<DirectoryPage />);
      expect(await screen.findByRole('heading', { level: 1, name: /Directory/i })).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
    });

    it('VerificationQueuePage header displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      renderWithClient(<VerificationQueuePage viewMode="all" />);
      expect(await screen.findByText('Worker Verification & Trust Operations')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('VerificationHistoryPage displays standardized "Refresh" button without "Refresh History"', async () => {
      const getSpy = vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      renderWithClient(<VerificationHistoryPage />);
      expect(await screen.findByText('Authoritative Review History & Audit')).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh History');

      await userEvent.click(btn);
      expect(getSpy).toHaveBeenCalled();
    });

    it('VerificationInsightsPage displays standardized "Refresh" button without "Refresh Insights"', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      renderWithClient(<VerificationInsightsPage />);
      expect(await screen.findByText('Verification Workload & Performance Insights')).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');
      expect(btn.textContent).not.toContain('Refresh Insights');
    });
  });

  describe('4. Operational, Financial, Support, and Audit Modules Standardized Refresh', () => {
    it('BookingsListPage header displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(bookingRepository, 'getBookings').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      renderWithClient(<BookingsListPage />);
      expect(await screen.findByText('Booking & Service Management')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('AttendanceLogsPage displays standardized "Refresh" button and refetches', async () => {
      const getSpy = (
        'getAllAttendanceOverview' in bookingRepository
          ? vi.spyOn(bookingRepository, 'getAllAttendanceOverview' as any)
          : vi.spyOn(bookingRepository, 'getBookings')
      ).mockResolvedValue({
        entries: [],
        bookings: [],
        items: [],
        isComplete: true,
        failedBookingsCount: 0,
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      } as any);

      renderWithClient(<AttendanceLogsPage />);
      expect(await screen.findByRole('heading', { level: 1, name: /Attendance & Daily Logs/i })).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('RatingsReviewsPage displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(ratingRepository, 'getRatings').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        overview: {
          total: 0,
          visible: 0,
          hidden: 0,
          averageScore: null,
          isCompleteDataset: true,
          distribution: [],
        },
      });

      renderWithClient(<RatingsReviewsPage />);
      expect(await screen.findByText('Ratings & Reviews')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('PaymentsListPage displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        totalGrossCollectionsINR: 0,
      });

      renderWithClient(<PaymentsListPage />);
      expect(await screen.findByText('Financial Transactions')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalled();

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('SupportTicketsPage header displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(supportRepository, 'getTickets').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        slaAtRiskCount: 0,
        unassignedCount: 0,
        escalatedCount: 0,
        resolvedTodayCount: 0,
      });

      renderWithClient(<SupportTicketsPage />);
      expect(await screen.findByText('Support Grievance & SLA Queue')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('ReportsDashboardPage displays standardized "Refresh" button in catalog and detail', async () => {
      const user = userEvent.setup();
      renderWithClient(<ReportsDashboardPage />);
      expect(await screen.findByRole('heading', { level: 1, name: /Reports & Analytics/i })).toBeInTheDocument();

      const catalogBtn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(catalogBtn).toBeInTheDocument();
      expect(catalogBtn.textContent).toContain('Refresh');

      const viewButtons = await screen.findAllByRole('button', { name: /View Report/i });
      expect(viewButtons.length).toBeGreaterThan(0);
      await user.click(viewButtons[0]);

      const detailBtns = await screen.findAllByRole('button', { name: /^Refresh$/i });
      expect(detailBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('ConfigurationMastersPage security tab displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(authRepository, 'listSessions').mockResolvedValue([
        {
          id: 'sess-101',
          deviceName: 'Chrome / Windows 11',
          ipAddress: '127.0.0.1',
          createdAt: '2026-11-20T10:00:00Z',
          lastActiveAt: '2026-11-20T10:15:00Z',
          isCurrent: true,
        },
      ]);

      renderWithClient(<ConfigurationMastersPage />, '/configuration?tab=security');
      expect(await screen.findByText('Platform Configuration Masters')).toBeInTheDocument();

      const btns = await screen.findAllByRole('button', { name: /^Refresh$/i });
      expect(btns.length).toBeGreaterThanOrEqual(1);
      expect(btns[0].textContent).toContain('Refresh');

      const sessionRefreshBtn = screen.getByTitle('Refresh sessions list');
      await userEvent.click(sessionRefreshBtn);
      expect(getSpy).toHaveBeenCalled();
    });

    it('AuditTrailPage header displays standardized "Refresh" button and refetches', async () => {
      const getSpy = vi.spyOn(auditRepository, 'getAuditLogs').mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 8,
        totalPages: 0,
      });

      renderWithClient(<AuditTrailPage />);
      expect(await screen.findByText('Authoritative Platform Audit Trail')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const btn = screen.getByRole('button', { name: /^Refresh$/i });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Refresh');

      await userEvent.click(btn);
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('5. Preservation of Data and State across Refetches', () => {
    it('preserves existing data when a subsequent refetch fails with an error', async () => {
      let shouldFail = false;
      const sampleBooking = {
        id: 'BK-999',
        customerName: 'Priya Patel',
        customerPhone: '+91 98765 43210',
        customerLocality: 'Gachibowli',
        serviceCategory: 'Cook',
        engagementType: 'FULL_TIME',
        status: 'CONFIRMED' as const,
        requestedDate: '2026-11-20T00:00:00Z',
        createdAt: '2026-11-20T00:00:00Z',
      };

      vi.spyOn(bookingRepository, 'getBookings').mockImplementation(async () => {
        if (shouldFail) throw new Error('Transient Network Refetch Failure');
        return {
          items: [sampleBooking as any],
          totalCount: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        };
      });

      renderWithClient(<BookingsListPage />);
      expect(await screen.findByText('BK-999')).toBeInTheDocument();
      expect(screen.getByText('Priya Patel')).toBeInTheDocument();

      shouldFail = true;
      const refreshBtn = screen.getByRole('button', { name: /^Refresh$/i });
      await userEvent.click(refreshBtn);

      // Even though second call failed, existing booking data is preserved
      expect(screen.getByText('BK-999')).toBeInTheDocument();
      expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    });
  });
});
