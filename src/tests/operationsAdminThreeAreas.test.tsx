import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { AttendanceLogsPage } from '../features/attendance/presentation/AttendanceLogsPage';
import { ratingRepository } from '../features/ratings/data/ratingRepository';
import { RatingsReviewsPage } from '../features/ratings/presentation/RatingsReviewsPage';

const FULL_OPS_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.WORKER_VIEW,
  PERMISSIONS.BOOKINGS_VIEW,
  PERMISSIONS.BOOKINGS_MANAGE,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.RATING_VIEW,
  PERMISSIONS.RATING_MODERATE,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.SUPPORT_VIEW,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.ALERT_VIEW,
  PERMISSIONS.ALERT_MANAGE,
];

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Operations Admin — Dashboard, Attendance & Daily Logs, Ratings & Reviews', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'ops-mgr-1',
        name: 'Operations Manager',
        email: 'operations.manager@sevanest.example.com',
        role: 'OPERATIONS_ADMIN',
        permissions: FULL_OPS_PERMISSIONS,
      },
      'ops-jwt'
    );
  });

  describe('1. Operations Admin Dashboard', () => {
    it('renders loading, real data across sections A-H, and inline alert actions', async () => {
      const user = userEvent.setup();
      let resolveDash!: (v: unknown) => void;
      const pendingPromise = new Promise((res) => {
        resolveDash = res;
      });
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockReturnValueOnce(
        pendingPromise as never
      );

      renderWithProviders(<OperationsAdminDashboard />);
      expect(screen.getByText(/Loading Operations Command Console/i)).toBeInTheDocument();

      resolveDash({
        generatedAt: '2026-11-12T10:30:00.000Z',
        kpis: {
          totalBookings: 50,
          totalCustomers: 44,
          totalWorkers: 70,
          verifiedAndActiveWorkers: 28,
          newBookingRequests: 10,
          bookingsAwaitingMatching: 9,
          scheduledTrialsToday: 1,
          bookingsAwaitingConfirmation: 7,
          activeLiveEngagements: 2,
          replacementRequests: 1,
          pendingVerificationCases: null,
          openDisputes: 13,
          pendingRefunds: null,
          expiringVerifications: null,
        },
        queues: {
          NEW_REQUESTS: [],
          MATCHING: [],
          TRIALS: [],
          CONFIRMATIONS: [],
          ACTIVE_SERVICES: [],
          REPLACEMENTS: [],
          REFUNDS: [],
          FOLLOW_UPS: [],
          SUPPORT_HANDOFFS: [],
        },
        sections: {
          bookings: {
            byStatus: [
              { status: 'NEW_REQUEST', count: 10 },
              { status: 'MATCHED', count: 9 },
              { status: 'CONFIRMED', count: 6 },
              { status: 'ACTIVE', count: 2 },
              { status: 'COMPLETED', count: 3 },
            ],
          },
          workers: { registered: 70, verifiedAndActive: 28 },
          complaints: { open: 2, inProgress: 0, escalated: 11, unassigned: 13 },
          replacements: { requested: 1, approved: 0 },
          alerts: { open: 33, critical: 2, warning: 23 },
        },
        operationsOverview: {
          reportingDateIST: '2026-11-12',
          newCustomersToday: 3,
          newWorkersToday: 2,
          customersTotal: 44,
          customersVerified: 30,
          customersPendingVerification: 14,
          availableWorkers: 32,
          workersVerifiedCount: 34,
          workersWithActiveBooking: 2,
          openAlertsList: [
            {
              id: 'ALT-1',
              type: 'BOOKING_NO_RESPONSE',
              severity: 'WARNING',
              status: 'OPEN',
              title: 'Matched worker did not respond in time',
              entityType: 'booking',
              entityId: 'B-84920',
              occurrences: 3,
              createdAt: '2026-11-12T08:00:00.000Z',
            },
          ],
          recentActivity: null,
          activityAvailable: false,
          activityUnavailableReason: 'Recent operational activity requires audit.view permission.',
        },
      });

      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();
      expect(screen.getByText('New Customers (Today)')).toBeInTheDocument();
      expect(screen.getByText('New Workers (Today)')).toBeInTheDocument();
      expect(screen.getByText('Available Workers')).toBeInTheDocument();
      expect(screen.getByText('Customer Overview')).toBeInTheDocument();
      expect(screen.getByText('Worker Overview')).toBeInTheDocument();
      expect(screen.getByText(/Unresolved Operational Alerts/i)).toBeInTheDocument();
      expect(screen.getByText('Matched worker did not respond in time')).toBeInTheDocument();
      expect(screen.getByText(/Recent operational activity requires audit\.view/i)).toBeInTheDocument();

      const ackSpy = vi
        .spyOn(dashboardRepository as Required<typeof dashboardRepository>, 'acknowledgeAlert')
        .mockResolvedValue();
      await user.click(screen.getByRole('button', { name: /^Acknowledge$/i }));
      expect(ackSpy).toHaveBeenCalledWith('ALT-1');
    });

    it('handles error state with retry and respects missing dashboard/alert permissions', async () => {
      const user = userEvent.setup();
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard')
        .mockRejectedValueOnce(new Error('Dashboard service unreachable'))
        .mockResolvedValueOnce({
          kpis: {
            totalBookings: 0,
            totalCustomers: 0,
            totalWorkers: 0,
            newBookingRequests: 0,
            bookingsAwaitingMatching: 0,
            scheduledTrialsToday: 0,
            bookingsAwaitingConfirmation: 0,
            activeLiveEngagements: 0,
            replacementRequests: 0,
            pendingVerificationCases: null,
            openDisputes: 0,
            pendingRefunds: null,
            expiringVerifications: null,
          },
          queues: {
            NEW_REQUESTS: [],
            MATCHING: [],
            TRIALS: [],
            CONFIRMATIONS: [],
            ACTIVE_SERVICES: [],
            REPLACEMENTS: [],
            REFUNDS: [],
            FOLLOW_UPS: [],
            SUPPORT_HANDOFFS: [],
          },
          sections: { bookings: { byStatus: [] }, alerts: { open: 0, critical: 0, warning: 0 } },
        } as never);

      const { unmount } = renderWithProviders(<OperationsAdminDashboard />);
      expect(await screen.findByText('Dashboard service unreachable')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Retry/i }));
      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();
      unmount();

      // Permission denied when dashboard.view removed
      useAuthStore.getState().setSession(
        {
          id: 'no-dash',
          name: 'Restricted',
          email: 'restricted@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.BOOKINGS_VIEW],
        },
        'tok'
      );
      renderWithProviders(<OperationsAdminDashboard />);
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
    });
  });

  describe('2. Attendance & Daily Logs Page', () => {
    beforeEach(() => {
      vi.spyOn(bookingRepository, 'getBookings').mockResolvedValue({
        items: [
          {
            id: 'BK-ATT-1',
            customerId: 'CUST-1',
            customerName: 'Aarav Patel',
            customerPhoneMasked: '+91 98*** **001',
            customerLocality: 'Kondapur',
            serviceCategory: 'Cook',
            engagementType: 'PART_TIME',
            timingShift: '09:00 - 12:00',
            salaryBudgetMax: 8000,
            status: 'SERVICE_ACTIVE',
            assignedWorkerId: 'WRK-1',
            assignedWorkerName: 'Sunita Devi',
            createdAt: '2026-10-05T08:00:00.000Z',
            serviceStartDate: '2026-10-05',
            platformFeePaid: true,
            platformFeeAmount: 499,
            internalNotes: [],
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      });
    });

    it('renders overview, records table, filters, detail history modal, and validates create/correct actions', async () => {
      const user = userEvent.setup();
      vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendanceSummary').mockResolvedValue({
        bookingId: 'BK-ATT-1',
        month: '2026-11',
        daysInMonth: 30,
        recorded: 2,
        presentDays: 1,
        absentDays: 1,
        lateDays: 0,
        exceptionDays: 0,
        leaveDays: 0,
        scheduledWindow: { from: '09:00', to: '12:00' },
      });
      const pageSpy = vi
        .spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendancePage')
        .mockResolvedValue({
          items: [
            {
              id: 'ATT-101',
              bookingId: 'BK-ATT-1',
              workerId: 'WRK-1',
              date: '2026-11-10',
              status: 'ABSENT',
              note: 'Marked absent',
              markedByRole: 'WORKER',
              updatedAt: '2026-11-10T10:00:00.000Z',
              history: [
                {
                  id: 'H-1',
                  previousStatus: null,
                  newStatus: 'ABSENT',
                  actorKind: 'WORKER',
                  changedAt: '2026-11-10T10:00:00.000Z',
                },
              ],
            },
            {
              id: 'ATT-102',
              bookingId: 'BK-ATT-1',
              workerId: 'WRK-1',
              date: '2026-11-11',
              status: 'PRESENT',
              checkInTime: '2026-11-11T03:30:00.000Z',
              checkOutTime: '2026-11-11T06:30:00.000Z',
              note: null,
              markedByRole: 'WORKER',
              updatedAt: '2026-11-11T06:35:00.000Z',
              history: [],
            },
          ],
          meta: { page: 1, limit: 15, total: 2, totalPages: 1 },
        });
      const recordSpy = vi
        .spyOn(bookingRepository as Required<typeof bookingRepository>, 'recordBookingAttendance')
        .mockResolvedValue();
      const correctSpy = vi
        .spyOn(bookingRepository as Required<typeof bookingRepository>, 'correctBookingAttendance')
        .mockResolvedValue();

      renderWithProviders(<AttendanceLogsPage />);

      expect(await screen.findByRole('heading', { name: /Attendance & Daily Logs/i })).toBeInTheDocument();
      expect(await screen.findAllByText('Aarav Patel')).not.toHaveLength(0);
      expect(screen.getAllByText('Sunita Devi').length).toBeGreaterThan(0);
      expect(screen.getByText('Total Recorded')).toBeInTheDocument();

      // Filter by status
      const statusSelect = screen.getByRole('combobox', { name: 'Filter by attendance status' });
      fireEvent.change(statusSelect, { target: { value: 'ABSENT' } });
      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBe(2); // Header + 1 ABSENT row
      });

      // Open detail modal & verify audit history
      await user.click(screen.getByRole('button', { name: /^Details$/i }));
      expect(await screen.findByText(/Attendance Log Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Audit Change History/i)).toBeInTheDocument();

      // Open Correct modal, change status to PRESENT, & validate mandatory reason
      await user.click(screen.getByRole('button', { name: /Correct Record/i }));
      const correctDialog = await screen.findByRole('dialog');
      await user.selectOptions(within(correctDialog).getByLabelText(/Proposed Attendance Status/i), 'PRESENT');
      await user.click(within(correctDialog).getByRole('checkbox'));
      await user.click(within(correctDialog).getByRole('button', { name: /Save Correction/i }));
      expect(await within(correctDialog).findByRole('alert')).toHaveTextContent(/correction reason is required/i);
      expect(correctSpy).not.toHaveBeenCalled();

      await user.type(within(correctDialog).getByLabelText(/Correction Reason/i), 'Verified arrival with customer');
      await user.click(within(correctDialog).getByRole('button', { name: /Save Correction/i }));
      await waitFor(() => {
        expect(correctSpy).toHaveBeenCalledWith(
          'ATT-101',
          expect.objectContaining({ status: 'PRESENT', reason: 'Verified arrival with customer' })
        );
      });

      // Reset status filter to show contextual unrecorded row & test Record Attendance
      await user.click(screen.getByRole('button', { name: /Reset Filters/i }));
      const initialCalls = pageSpy.mock.calls.length;
      await user.click(await screen.findByRole('button', { name: /Record Attendance/i }));
      const recordDialog = await screen.findByRole('dialog');
      await user.selectOptions(within(recordDialog).getByLabelText(/Attendance Status/i), 'EXCEPTION');
      await user.click(within(recordDialog).getByRole('checkbox'));
      await user.click(within(recordDialog).getByRole('button', { name: /Save Attendance/i }));
      expect(await within(recordDialog).findByRole('alert')).toHaveTextContent(/note is required when recording an EXCEPTION/i);

      await user.type(within(recordDialog).getByLabelText(/Operational Note/i), 'Emergency leave notified');
      await user.click(within(recordDialog).getByRole('button', { name: /Save Attendance/i }));
      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          'BK-ATT-1',
          expect.objectContaining({
            status: 'EXCEPTION',
            note: 'Emergency leave notified',
            idempotencyKey: expect.any(String),
          })
        );
        expect(pageSpy.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });

    it('restricts record/correct actions without attendance.manage and blocks page without attendance.view', async () => {
      vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendancePage').mockResolvedValue({
        items: [],
        meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
      });
      vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendanceSummary').mockResolvedValue(null);

      useAuthStore.getState().setSession(
        {
          id: 'att-viewer',
          name: 'Viewer',
          email: 'viewer@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.BOOKINGS_VIEW],
        },
        'tok'
      );

      const { unmount } = renderWithProviders(<AttendanceLogsPage />);
      expect(await screen.findByRole('heading', { name: /Attendance & Daily Logs/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Record Attendance/i })).not.toBeInTheDocument();
      unmount();

      useAuthStore.getState().setSession(
        {
          id: 'att-none',
          name: 'No Attendance',
          email: 'none@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        'tok'
      );

      renderWithProviders(<AttendanceLogsPage />);
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
    });
  });

  describe('3. Ratings & Reviews Page', () => {
    it('renders ratings overview, table, filters, detail modal, and enforces hide/unhide moderation rules', async () => {
      const user = userEvent.setup();
      vi.spyOn(ratingRepository, 'getRatings').mockResolvedValue({
        items: [
          {
            id: 'RAT-1',
            bookingId: 'BK-1',
            workerId: 'WRK-1',
            workerName: 'Sunita Devi',
            customerUserId: 'CUST-1',
            customerName: 'Ananya Verma',
            score: 5,
            review: 'Very thorough and reliable.',
            tags: ['PUNCTUAL'],
            status: 'VISIBLE',
            createdAt: '2026-11-10T09:00:00.000Z',
          },
          {
            id: 'RAT-2',
            bookingId: 'BK-2',
            workerId: 'WRK-2',
            workerName: 'Basheer Khan',
            customerUserId: 'CUST-2',
            customerName: 'Ramesh Nair',
            score: 2,
            review: 'Delayed start.',
            tags: [],
            status: 'HIDDEN',
            moderationReason: 'Duplicate report',
            createdAt: '2026-11-08T09:00:00.000Z',
          },
        ],
        total: 2,
        page: 1,
        limit: 15,
        totalPages: 1,
        overview: {
          total: 2,
          visible: 1,
          hidden: 1,
          averageScore: 3.5,
          isCompleteDataset: true,
          distribution: [
            { score: 5, count: 1 },
            { score: 4, count: 0 },
            { score: 3, count: 0 },
            { score: 2, count: 1 },
            { score: 1, count: 0 },
          ],
        },
      });
      vi.spyOn(ratingRepository, 'getRatingById').mockResolvedValue({
        id: 'RAT-1',
        bookingId: 'BK-1',
        workerId: 'WRK-1',
        workerName: 'Sunita Devi',
        customerUserId: 'CUST-1',
        customerName: 'Ananya Verma',
        score: 5,
        review: 'Very thorough and reliable.',
        tags: ['PUNCTUAL'],
        status: 'VISIBLE',
        createdAt: '2026-11-10T09:00:00.000Z',
      });
      vi.spyOn(ratingRepository, 'getWorkerRatingSummary').mockResolvedValue({
        count: 1,
        average: 5,
        scaleMax: 5,
      });
      const modSpy = vi
        .spyOn(ratingRepository, 'moderateRating')
        .mockRejectedValueOnce(new Error('Moderation conflict'))
        .mockResolvedValueOnce();

      renderWithProviders(<RatingsReviewsPage />);

      expect(await screen.findByRole('heading', { name: /Ratings & Reviews/i })).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Ananya Verma')).toBeInTheDocument();
      expect(screen.getByText('3.5 / 5')).toBeInTheDocument();

      // No unrequested edit/delete/reply buttons exist
      expect(screen.queryByRole('button', { name: /Delete|Reply|Edit Review/i })).not.toBeInTheDocument();

      // Open detail modal & trigger moderation error handling
      await user.click(screen.getAllByRole('button', { name: /^View$/i })[0]);
      expect(await screen.findByRole('heading', { name: 'Review Details' })).toBeInTheDocument();
      expect(await screen.findByText(/Overall: 5 \/ 5 \(1 visible\)/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Hide Review/i }));
      const dialogs = await screen.findAllByRole('dialog');
      const confirmModal = dialogs[dialogs.length - 1];
      await user.type(within(confirmModal).getByPlaceholderText(/Enter mandatory moderation reason/i), 'Contains policy breach');
      await user.click(within(confirmModal).getByTestId('confirm-destructive-checkbox'));
      await user.click(within(confirmModal).getByRole('button', { name: /Hide Review/i }));

      expect(await screen.findAllByText('Moderation conflict')).not.toHaveLength(0);

      // Retry succeeds
      await user.click(within(confirmModal).getByRole('button', { name: /Hide Review/i }));
      await waitFor(() => {
        expect(modSpy).toHaveBeenCalledWith('RAT-1', 'hide', 'Contains policy breach');
      });
    });

    it('hides moderation actions without rating.moderate and restricts page without rating.view', async () => {
      vi.spyOn(ratingRepository, 'getRatings').mockResolvedValue({
        items: [
          {
            id: 'RAT-1',
            bookingId: 'BK-1',
            workerId: 'WRK-1',
            workerName: 'Sunita Devi',
            customerName: 'Ananya Verma',
            score: 5,
            review: 'Good work',
            tags: [],
            status: 'VISIBLE',
            createdAt: '2026-11-10T09:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
        overview: {
          total: 1,
          visible: 1,
          hidden: 0,
          averageScore: 5,
          isCompleteDataset: true,
          distribution: [{ score: 5, count: 1 }],
        },
      });

      useAuthStore.getState().setSession(
        {
          id: 'rat-viewer',
          name: 'Ratings Viewer',
          email: 'viewer@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.RATING_VIEW],
        },
        'tok'
      );

      const { unmount } = renderWithProviders(<RatingsReviewsPage />);
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Hide$|^Unhide$/i })).not.toBeInTheDocument();
      unmount();

      useAuthStore.getState().setSession(
        {
          id: 'rat-none',
          name: 'Restricted',
          email: 'none@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        'tok'
      );

      renderWithProviders(<RatingsReviewsPage />);
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
    });
  });
});

