import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';
import { ServerFailureError } from '../core/errors/DomainError';
import {
  bookingRepository,
  clearBookingDetailCache,
  clearBookingRegistryCaches,
  RealBookingRepository,
} from '../features/bookings/data/bookingRepository';
import { BookingAttendanceEntry, BookingDetail } from '../features/bookings/domain/types';
import { AttendanceLogsPage } from '../features/attendance/presentation/AttendanceLogsPage';
import { getTodayISTDate } from '../features/attendance/utils/attendanceHelpers';

const UUID_ACTIVE = '01a11ef8-6593-7737-a1f2-95764ebbf14d';
const UUID_CONFIRMED = '01a11ef8-7694-8848-b2e3-06875fcc25e1';
const UUID_COMPLETED = '01a11ef8-8795-9959-c3d4-17986add36f2';

const SAMPLE_BOOKINGS: BookingDetail[] = [
  {
    id: UUID_ACTIVE,
    customerId: 'CUST-1',
    customerName: 'Ananya Rao',
    customerPhoneMasked: '+91 98*** **111',
    customerLocality: 'Madhapur',
    serviceCategory: 'House Maid',
    engagementType: 'FULL_TIME_LIVE_OUT',
    timingShift: '09:00 - 17:00',
    salaryBudgetMax: 12000,
    status: 'SERVICE_ACTIVE',
    assignedWorkerId: 'WRK-101',
    assignedWorkerName: 'Lakshmi Devi',
    createdAt: '2026-10-01T09:00:00.000Z',
    serviceStartDate: '2026-10-10',
    platformFeePaid: true,
    platformFeeAmount: 499,
    internalNotes: [],
  },
  {
    id: UUID_CONFIRMED,
    customerId: 'CUST-2',
    customerName: 'Rohan Mehta',
    customerPhoneMasked: '+91 98*** **222',
    customerLocality: 'Kondapur',
    serviceCategory: 'Cook',
    engagementType: 'PART_TIME',
    timingShift: '08:00 - 11:00',
    salaryBudgetMax: 9000,
    status: 'CONFIRMED',
    assignedWorkerId: 'WRK-102',
    assignedWorkerName: 'Kamala Kumari',
    createdAt: '2026-11-05T09:00:00.000Z',
    serviceStartDate: '2026-11-15',
    platformFeePaid: true,
    platformFeeAmount: 499,
    internalNotes: [],
  },
  {
    id: UUID_COMPLETED,
    customerId: 'CUST-3',
    customerName: 'Vikram Singh',
    customerPhoneMasked: '+91 98*** **333',
    customerLocality: 'Gachibowli',
    serviceCategory: 'Driver',
    engagementType: 'FULL_TIME_LIVE_OUT',
    timingShift: '09:00 - 18:00',
    salaryBudgetMax: 18000,
    status: 'COMPLETED',
    assignedWorkerId: 'WRK-103',
    assignedWorkerName: 'Ramesh Babu',
    createdAt: '2026-09-01T09:00:00.000Z',
    serviceStartDate: '2026-09-05',
    platformFeePaid: true,
    platformFeeAmount: 499,
    internalNotes: [],
  },
];

const SAMPLE_ENTRIES: BookingAttendanceEntry[] = [
  {
    id: 'ATT-ACTIVE-1',
    bookingId: UUID_ACTIVE,
    workerId: 'WRK-101',
    date: '2026-11-10',
    status: 'PRESENT',
    note: 'Checked in on time',
    markedByRole: 'WORKER',
    updatedAt: '2026-11-10T09:05:00.000Z',
    history: [],
  },
  {
    id: 'ATT-COMP-1',
    bookingId: UUID_COMPLETED,
    workerId: 'WRK-103',
    date: '2026-10-15',
    status: 'EXCEPTION',
    note: 'Traffic delay reported',
    markedByRole: 'ADMIN',
    updatedAt: '2026-10-15T11:00:00.000Z',
    history: [
      {
        id: 'H-COMP-1',
        previousStatus: 'ABSENT',
        newStatus: 'EXCEPTION',
        reason: 'Approved traffic exception',
        actorKind: 'ADMIN',
        changedAt: '2026-10-15T11:00:00.000Z',
      },
    ],
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/attendance']}>
        <AttendanceLogsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Attendance & Daily Logs — Redesigned Attendance-First View & Backend Completeness Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'ops-1',
        name: 'Operations Manager',
        email: 'operations.manager@sevanest.example.com',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.ATTENDANCE_MANAGE,
        ],
      },
      'tok'
    );
  });

  it('removes Selected Booking Scope panel, shows 4 compact summary cards, and lists cross-booking attendance directly', async () => {
    vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview').mockResolvedValue({
      entries: SAMPLE_ENTRIES,
      bookings: SAMPLE_BOOKINGS,
      isComplete: true,
      failedBookingsCount: 0,
    });

    renderPage();

    // Header has title + Refresh button only (no + Record Attendance button)
    const headerTitle = await screen.findByRole('heading', { name: /Attendance & Daily Logs/i });
    const headerBar = headerTitle.parentElement?.parentElement;
    expect(headerBar).toBeTruthy();
    if (headerBar) {
      expect(within(headerBar).getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
      expect(within(headerBar).queryByRole('button', { name: /Record Attendance/i })).not.toBeInTheDocument();
    }

    // Selected Booking Scope panel and booking status pills are completely removed
    expect(screen.queryByText(/Selected Booking Scope/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Filter booking scope status/i })).not.toBeInTheDocument();

    // Wait for loaded data before asserting summary counts & rows
    expect(await screen.findAllByText('BK-4EBBF14D')).not.toHaveLength(0);
    expect(screen.getByText('BK-6ADD36F2')).toBeInTheDocument();
    expect(screen.getAllByText('Ananya Rao').length).toBeGreaterThan(0);
    expect(screen.getByText('Vikram Singh')).toBeInTheDocument();

    // 4 compact summary cards only (Total Recorded = 2, Present = 1, Absent = 0, Exceptions = 1)
    const summarySection = screen.getByRole('region', { name: /Attendance summary/i });
    expect(within(summarySection).getByText('Total Recorded')).toBeInTheDocument();
    expect(within(summarySection).getByText('Present')).toBeInTheDocument();
    expect(within(summarySection).getByText('Absent')).toBeInTheDocument();
    expect(within(summarySection).getByText('Exceptions')).toBeInTheDocument();
    expect(within(summarySection).queryByText('Late')).not.toBeInTheDocument();
    expect(within(summarySection).queryByText('Leave')).not.toBeInTheDocument();
    expect(within(summarySection).getByText('2')).toBeInTheDocument();

    // Ineligible CONFIRMED booking (Rohan Mehta) NEVER renders a contextual Record Attendance row
    expect(screen.queryByText('Rohan Mehta')).not.toBeInTheDocument();
    // Eligible active booking (Ananya Rao) has no entry for todayIST -> contextual Record Attendance button renders once in its row
    expect(screen.getAllByRole('button', { name: /Record Attendance/i })).toHaveLength(1);
  });

  it('filters records by date range & status, updates summary cards accurately, and resets cleanly', async () => {
    const user = userEvent.setup();
    vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview').mockResolvedValue({
      entries: SAMPLE_ENTRIES,
      bookings: SAMPLE_BOOKINGS,
      isComplete: true,
      failedBookingsCount: 0,
    });

    renderPage();

    expect(await screen.findByText('Vikram Singh')).toBeInTheDocument();

    // Narrow to 2026-10-15 -> Summary reflects filtered scope (Total = 1, Exceptions = 1)
    const fromInput = screen.getByLabelText('Filter logs from date');
    const toInput = screen.getByLabelText('Filter logs to date');
    fireEvent.change(fromInput, { target: { value: '2026-10-15' } });
    fireEvent.change(toInput, { target: { value: '2026-10-15' } });

    const summarySection = screen.getByRole('region', { name: /Attendance summary/i });
    await waitFor(() => {
      expect(within(summarySection).getAllByText('1').length).toBeGreaterThanOrEqual(2);
    });

    // Filtering status to EXCEPTION hides contextual NOT_RECORDED row for Ananya Rao
    const statusSelect = screen.getByRole('combobox', { name: 'Filter by attendance status' });
    fireEvent.change(statusSelect, { target: { value: 'EXCEPTION' } });
    await waitFor(() => {
      expect(screen.queryByText('Ananya Rao')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Record Attendance/i })).not.toBeInTheDocument();
    });

    // Reset Filters restores full view
    await user.click(screen.getByRole('button', { name: /Reset Filters/i }));
    expect(await screen.findAllByText('Ananya Rao')).not.toHaveLength(0);

    // Selecting 2026-11-10 (already recorded for Ananya Rao) hides Record Attendance to prevent duplicate entry
    fireEvent.change(fromInput, { target: { value: '2026-11-10' } });
    fireEvent.change(toInput, { target: { value: '2026-11-10' } });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Record Attendance/i })).not.toBeInTheDocument();
    });

    // Filter to a date before all bookings with no records -> honest filtered empty state
    fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
    fireEvent.change(toInput, { target: { value: '2026-08-02' } });
    expect(await screen.findByText(/No attendance records match the selected filters/i)).toBeInTheDocument();
  });

  it('prevents duplicate dates, enforces serviceStartDate boundary, and blocks concurrent double-submit', async () => {
    const user = userEvent.setup();
    vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview').mockResolvedValue({
      entries: SAMPLE_ENTRIES,
      bookings: SAMPLE_BOOKINGS,
      isComplete: true,
      failedBookingsCount: 0,
    });

    let resolvePost!: () => void;
    const recordSpy = vi
      .spyOn(bookingRepository as Required<typeof bookingRepository>, 'recordBookingAttendance')
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolvePost = resolve;
          })
      );

    renderPage();

    const recordBtn = await screen.findByRole('button', { name: /Record Attendance/i });
    await user.click(recordBtn);

    const dialog = await screen.findByRole('dialog');
    const dateInput = within(dialog).getByLabelText(/Service Date/i);

    // 1. Duplicate check: 2026-11-10 is already recorded for UUID_ACTIVE
    fireEvent.change(dateInput, { target: { value: '2026-11-10' } });
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: /Save Attendance/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already recorded/i);
    expect(recordSpy).not.toHaveBeenCalled();

    // 2. Service start boundary check: 2026-10-01 is earlier than 2026-10-10
    fireEvent.change(dateInput, { target: { value: '2026-10-01' } });
    await user.click(within(dialog).getByRole('button', { name: /Save Attendance/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/earlier than the service start date/i);

    // 3. Valid date + double-click prevention
    fireEvent.change(dateInput, { target: { value: getTodayISTDate() } });
    const submitBtn = within(dialog).getByRole('button', { name: /Save Attendance/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(1);
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveTextContent(/Saving/i);
    });
    expect(recordSpy).toHaveBeenCalledWith(
      UUID_ACTIVE,
      expect.objectContaining({ status: 'PRESENT', idempotencyKey: expect.any(String) })
    );

    resolvePost();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/Attendance recorded successfully/i)).toBeInTheDocument();
  });

  it('supports server pagination across combined rows and surfaces incomplete fan-out warnings honestly', async () => {
    const user = userEvent.setup();
    const manyEntries: BookingAttendanceEntry[] = Array.from({ length: 18 }, (_, i) => ({
      id: `ATT-${i + 1}`,
      bookingId: UUID_COMPLETED,
      workerId: 'WRK-103',
      date: `2026-10-${String(28 - i).padStart(2, '0')}`,
      status: 'PRESENT',
      markedByRole: 'WORKER',
      updatedAt: '2026-10-28T10:00:00.000Z',
      history: [],
    }));

    vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview').mockResolvedValueOnce({
      entries: manyEntries,
      bookings: SAMPLE_BOOKINGS,
      isComplete: false,
      failedBookingsCount: 2,
      incompleteReason: 'Failed to fetch attendance for 2 bookings. GET /admin/attendance is required.',
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Failed to fetch attendance for 2 bookings/i);
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    // Summary shows "—" rather than misleading incomplete totals
    const summarySection = screen.getByRole('region', { name: /Attendance summary/i });
    expect(within(summarySection).getAllByText('—')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: /Next page/i }));
    expect(await screen.findByText(/Page 2 of 2/i)).toBeInTheDocument();
  });

  it('surfaces API load failure cleanly with Retry button', async () => {
    const user = userEvent.setup();
    const overviewSpy = vi
      .spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview')
      .mockRejectedValueOnce(new ServerFailureError('Attendance service unavailable.'))
      .mockResolvedValueOnce({
        entries: [],
        bookings: [],
        isComplete: true,
        failedBookingsCount: 0,
      });

    renderPage();

    expect(await screen.findByText(/Attendance service unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Retry$/i }));
    await waitFor(() => expect(overviewSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/No attendance records found/i)).toBeInTheDocument();
  });

  it('paginates all booking pages and tracks failed fan-out honestly in RealBookingRepository', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: { params?: unknown }) => {
      const pageParam = (config?.params as { page?: number } | undefined)?.page;
      if (url === '/admin/customers' || url === '/admin/workers') {
        return { data: { data: [] } } as never;
      }
      if (url === '/admin/bookings' && pageParam === 1) {
        return {
          data: {
            data: [{ id: UUID_ACTIVE, status: 'ACTIVE', workerId: 'WRK-101', startDate: '2026-10-10' }],
            meta: { page: 1, limit: 100, total: 105 },
          },
        } as never;
      }
      if (url === '/admin/bookings' && pageParam === 2) {
        return {
          data: {
            data: [{ id: UUID_COMPLETED, status: 'COMPLETED', workerId: 'WRK-103', startDate: '2026-09-05' }],
            meta: { page: 2, limit: 100, total: 105 },
          },
        } as never;
      }
      if (url === `/admin/attendance/bookings/${UUID_ACTIVE}`) {
        return {
          data: {
            data: [
              {
                id: 'ATT-1',
                bookingId: UUID_ACTIVE,
                workerId: 'WRK-101',
                date: '2026-11-10',
                status: 'PRESENT',
                note: null,
                checkInAt: null,
                checkOutAt: null,
                recordedBy: 'ADMIN',
                updatedAt: '2026-11-10T10:00:00.000Z',
                recordedByUserId: 'ops-1',
                history: [],
              },
            ],
            meta: { page: 1, limit: 100, total: 1 },
          },
          headers: { etag: 'W/"att-1"' },
        } as never;
      }
      if (url === `/admin/attendance/bookings/${UUID_COMPLETED}`) {
        throw new Error('429 Rate limited');
      }
      return { data: { data: [] } } as never;
    });

    const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({ data: {} } as never);
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({ data: {} } as never);

    const repo = new RealBookingRepository();
    const overview = await repo.getAllAttendanceOverview();

    expect(overview.bookings).toHaveLength(2); // Page 1 + Page 2 bookings both loaded
    expect(overview.entries).toHaveLength(1);
    expect(overview.isComplete).toBe(false);
    expect(overview.failedBookingsCount).toBe(1);
    expect(overview.incompleteReason).toMatch(/GET \/admin\/attendance/);

    await repo.recordBookingAttendance(UUID_ACTIVE, {
      date: '2026-11-11',
      status: 'PRESENT',
      idempotencyKey: 'fixed-idem-key-1234',
    });
    expect(postSpy).toHaveBeenCalledWith(
      `/admin/attendance/bookings/${UUID_ACTIVE}`,
      { date: '2026-11-11', status: 'PRESENT' },
      { headers: { 'Idempotency-Key': 'fixed-idem-key-1234' } }
    );

    await repo.correctBookingAttendance('ATT-1', {
      status: 'LATE',
      reason: 'Arrived 20 mins late',
      etag: 'W/"att-1"',
    });
    expect(patchSpy).toHaveBeenCalledWith(
      '/admin/attendance/ATT-1',
      { status: 'LATE', reason: 'Arrived 20 mins late' },
      { headers: { 'If-Match': 'W/"att-1"' } }
    );
  });
});

describe('Attendance & Daily Logs — Customer Name Resolution & Enrichment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearBookingDetailCache();
    clearBookingRegistryCaches();
    useAuthStore.setState({
      user: {
        id: 'ops-1',
        name: 'Ops Manager',
        email: 'ops@sevanest.example.com',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.ATTENDANCE_VIEW,
          PERMISSIONS.ATTENDANCE_MANAGE,
          PERMISSIONS.BOOKINGS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  const makeEntry = (id: string, bookingId: string, workerId: string, date: string) => ({
    id,
    bookingId,
    workerId,
    date,
    status: 'PRESENT',
    note: null,
    checkInAt: null,
    checkOutAt: null,
    recordedBy: 'ADMIN',
    updatedAt: `${date}T10:00:00.000Z`,
    recordedByUserId: 'ops-1',
    history: [],
  });

  it('resolves customer names via booking detail customerUserId, supports multiple records per customer and distinct customers across bookings without swapping worker/customer names', async () => {
    const BOOKING_A = '01a11ef8-6593-7737-a1f2-95764ebbf14d';
    const BOOKING_B = '01a11ef8-34a5-779a-a6c3-b674dae566da';

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/customers') {
        return {
          data: {
            data: [
              { id: 'cust-1', userId: 'usr-cust-1', name: 'Rajesh Agarwal' },
              { id: 'cust-2', userId: 'usr-cust-2', name: 'Sneha Kulkarni' },
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      if (url === '/admin/workers') {
        return {
          data: {
            data: [
              { id: 'wrk-1', userId: 'usr-wrk-1', name: 'Pushpa Lingam', isFullyVerified: true },
              { id: 'wrk-2', userId: 'usr-wrk-2', name: 'Kavitha Rao', isFullyVerified: true },
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      if (url === '/admin/bookings') {
        // List endpoint omits customerUserId (matching real OpenAPI/backend contract)
        return {
          data: {
            data: [
              { id: BOOKING_A, status: 'ACTIVE', workerId: 'wrk-1', startDate: '2026-10-05' },
              { id: BOOKING_B, status: 'COMPLETED', workerId: 'wrk-2', startDate: '2026-10-04' },
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      if (url === `/admin/bookings/${BOOKING_A}`) {
        return { data: { id: BOOKING_A, status: 'ACTIVE', workerId: 'wrk-1', customerUserId: 'usr-cust-1' } } as never;
      }
      if (url === `/admin/bookings/${BOOKING_B}`) {
        return { data: { id: BOOKING_B, status: 'COMPLETED', workerId: 'wrk-2', customerUserId: 'usr-cust-2' } } as never;
      }
      if (url === `/admin/attendance/bookings/${BOOKING_A}`) {
        return {
          data: {
            data: [
              makeEntry('ATT-A1', BOOKING_A, 'wrk-1', '2026-11-10'),
              makeEntry('ATT-A2', BOOKING_A, 'wrk-1', '2026-11-09'),
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      if (url === `/admin/attendance/bookings/${BOOKING_B}`) {
        return {
          data: {
            data: [makeEntry('ATT-B1', BOOKING_B, 'wrk-2', '2026-11-08')],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      return { data: { data: [] } } as never;
    });

    const repo = new RealBookingRepository();
    const overview = await repo.getAllAttendanceOverview();

    const bookingA = overview.bookings.find((b) => b.id === BOOKING_A);
    const bookingB = overview.bookings.find((b) => b.id === BOOKING_B);
    expect(bookingA?.customerName).toBe('Rajesh Agarwal');
    expect(bookingA?.assignedWorkerName).toBe('Pushpa Lingam');
    expect(bookingB?.customerName).toBe('Sneha Kulkarni');
    expect(bookingB?.assignedWorkerName).toBe('Kavitha Rao');
    expect(overview.entries.filter((e) => e.bookingId === BOOKING_A)).toHaveLength(2);
    expect(overview.entries.filter((e) => e.bookingId === BOOKING_B)).toHaveLength(1);

    vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getAllAttendanceOverview').mockResolvedValue(overview);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AttendanceLogsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Rajesh Agarwal').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Sneha Kulkarni')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Customer Details Unavailable/i)).not.toBeInTheDocument();
  });

  it('caches customer registry and booking detail lookups across repeated loads', async () => {
    const BOOKING_ID = '01a11ef8-6593-7737-a1f2-95764ebbf14d';
    const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/customers') {
        return {
          data: {
            data: [{ id: 'c1', userId: 'u1', name: 'Meera Subramanian' }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      if (url === '/admin/workers') {
        return { data: { data: [{ id: 'w1', name: 'Pushpa Lingam' }], meta: { page: 1, limit: 100, total: 1 } } } as never;
      }
      if (url === '/admin/bookings') {
        return {
          data: {
            data: [{ id: BOOKING_ID, status: 'ACTIVE', workerId: 'w1', startDate: '2026-10-05' }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      if (url === `/admin/bookings/${BOOKING_ID}`) {
        return { data: { id: BOOKING_ID, status: 'ACTIVE', workerId: 'w1', customerUserId: 'u1' } } as never;
      }
      if (url === `/admin/attendance/bookings/${BOOKING_ID}`) {
        return {
          data: { data: [makeEntry('ATT-1', BOOKING_ID, 'w1', '2026-11-10')], meta: { page: 1, limit: 100, total: 1 } },
        } as never;
      }
      return { data: { data: [] } } as never;
    });

    const repo = new RealBookingRepository();
    const first = await repo.getAllAttendanceOverview();
    const second = await repo.getAllAttendanceOverview();

    expect(first.bookings[0].customerName).toBe('Meera Subramanian');
    expect(second.bookings[0].customerName).toBe('Meera Subramanian');

    const customerCalls = getSpy.mock.calls.filter(([u]) => u === '/admin/customers');
    const detailCalls = getSpy.mock.calls.filter(([u]) => u === `/admin/bookings/${BOOKING_ID}`);
    expect(customerCalls).toHaveLength(1);
    expect(detailCalls).toHaveLength(1);
  });

  it('paginates customer registry responses beyond 100 customers (page 1 + page 2)', async () => {
    const BOOKING_PAGE2 = '01a11ef8-c14b-766f-b3e4-dfe2d54cfd7f';
    const page1Customers = Array.from({ length: 100 }, (_, i) => ({
      id: `c-p1-${i}`,
      userId: `u-p1-${i}`,
      name: `Customer One ${i}`,
    }));

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: { params?: unknown }) => {
      const page = (config?.params as { page?: number } | undefined)?.page;
      if (url === '/admin/customers' && page === 1) {
        return { data: { data: page1Customers, meta: { page: 1, limit: 100, total: 102 } } } as never;
      }
      if (url === '/admin/customers' && page === 2) {
        return {
          data: {
            data: [
              { id: 'c-101', userId: 'u-101', name: 'Other Page2' },
              { id: 'c-102', userId: 'u-102', name: 'Divya Chowdary' },
            ],
            meta: { page: 2, limit: 100, total: 102 },
          },
        } as never;
      }
      if (url === '/admin/workers') {
        return { data: { data: [], meta: { page: 1, limit: 100, total: 0 } } } as never;
      }
      if (url === '/admin/bookings') {
        return {
          data: {
            data: [{ id: BOOKING_PAGE2, status: 'COMPLETED', workerId: 'w1', startDate: '2026-10-06', customerUserId: 'u-102' }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      if (url === `/admin/attendance/bookings/${BOOKING_PAGE2}`) {
        return {
          data: { data: [makeEntry('ATT-P2', BOOKING_PAGE2, 'w1', '2026-11-10')], meta: { page: 1, limit: 100, total: 1 } },
        } as never;
      }
      return { data: { data: [] } } as never;
    });

    const repo = new RealBookingRepository();
    const overview = await repo.getAllAttendanceOverview();
    expect(overview.bookings[0].customerName).toBe('Divya Chowdary');
  });

  it('handles missing customer ID and rejects fabricated or ID-like customer names', async () => {
    const BOOKING_MISSING = '01a11ef8-932b-77fa-a0dd-8bc8d95410d8';
    const BOOKING_FAKE_ID = '01a11ef8-eed5-7308-a0d3-8912fc67fa4e';

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/customers') {
        return {
          data: {
            data: [{ id: 'c-idlike', userId: 'u-idlike', name: '01a11ef5-e4d9-72a5-a78c-9dded10997f1' }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      if (url === '/admin/workers') {
        return { data: { data: [{ id: 'w1', name: 'Ramesh Yadav' }], meta: { page: 1, limit: 100, total: 1 } } } as never;
      }
      if (url === '/admin/bookings') {
        return {
          data: {
            data: [
              { id: BOOKING_MISSING, status: 'ACTIVE', workerId: 'w1', startDate: '2026-10-05' },
              {
                id: BOOKING_FAKE_ID,
                status: 'ACTIVE',
                workerId: 'w1',
                startDate: '2026-10-05',
                customerUserId: 'u-idlike',
                customerName: 'Customer (u-idlike)',
              },
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      if (url === `/admin/bookings/${BOOKING_MISSING}`) {
        return { data: { id: BOOKING_MISSING, status: 'ACTIVE', workerId: 'w1' } } as never;
      }
      if (url.startsWith('/admin/attendance/bookings/')) {
        const bId = url.split('/').pop()!;
        return {
          data: { data: [makeEntry(`ATT-${bId}`, bId, 'w1', '2026-11-10')], meta: { page: 1, limit: 100, total: 1 } },
        } as never;
      }
      return { data: { data: [] } } as never;
    });

    const repo = new RealBookingRepository();
    const overview = await repo.getAllAttendanceOverview();
    const bMissing = overview.bookings.find((b) => b.id === BOOKING_MISSING);
    const bFake = overview.bookings.find((b) => b.id === BOOKING_FAKE_ID);

    expect(bMissing?.customerName).toBe('Customer Details Unavailable');
    expect(bFake?.customerName).toBe('Customer Details Unavailable');
    expect(bMissing?.assignedWorkerName).toBe('Ramesh Yadav');
    expect(overview.entries).toHaveLength(2);
  });

  it('handles customer API failure gracefully without corrupting attendance records', async () => {
    const BOOKING_ID = '01a11ef8-6593-7737-a1f2-95764ebbf14d';

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/customers') {
        throw new Error('503 Customer service unavailable');
      }
      if (url === '/admin/workers') {
        return { data: { data: [{ id: 'w1', name: 'Pushpa Lingam' }], meta: { page: 1, limit: 100, total: 1 } } } as never;
      }
      if (url === '/admin/bookings') {
        return {
          data: {
            data: [{ id: BOOKING_ID, status: 'ACTIVE', workerId: 'w1', startDate: '2026-10-05', customerUserId: 'u1' }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as never;
      }
      if (url === `/admin/attendance/bookings/${BOOKING_ID}`) {
        return {
          data: {
            data: [
              makeEntry('ATT-SAFE-1', BOOKING_ID, 'w1', '2026-11-10'),
              makeEntry('ATT-SAFE-2', BOOKING_ID, 'w1', '2026-11-09'),
            ],
            meta: { page: 1, limit: 100, total: 2 },
          },
        } as never;
      }
      return { data: { data: [] } } as never;
    });

    const repo = new RealBookingRepository();
    const overview = await repo.getAllAttendanceOverview();

    expect(overview.isComplete).toBe(true);
    expect(overview.entries).toHaveLength(2);
    expect(overview.entries.map((e) => e.id)).toEqual(['ATT-SAFE-1', 'ATT-SAFE-2']);
    expect(overview.bookings[0].assignedWorkerName).toBe('Pushpa Lingam');
    expect(overview.bookings[0].customerName).toBe('Customer Details Unavailable');
  });
});
