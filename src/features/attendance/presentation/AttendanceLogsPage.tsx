import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { bookingRepository } from '../../bookings/data/bookingRepository';
import {
  BackendAttendanceStatus,
  BookingAttendanceEntry,
  BookingDetail,
} from '../../bookings/domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { formatDateIST, formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import {
  ATTENDANCE_STATUS_OPTIONS,
  evaluateBookingAttendanceEligibility,
  formatBookingReference,
  generateIdempotencyKey,
  getTodayISTDate,
} from '../utils/attendanceHelpers';
import {
  AttendanceDetailModal,
  CorrectAttendanceModal,
  RecordAttendanceModal,
} from './AttendanceModals';

const PAGE_SIZE = 15;

const filterLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  marginBottom: '6px',
};

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  height: '38px',
  padding: '0 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: '#ffffff',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
};

type AttendanceTableRow =
  | {
      kind: 'ENTRY';
      key: string;
      entry: BookingAttendanceEntry;
      booking?: BookingDetail;
    }
  | {
      kind: 'PENDING_FOR_DATE';
      key: string;
      booking: BookingDetail;
      serviceDate: string;
    };

export const AttendanceLogsPage: React.FC = () => {
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const canView = hasPermission(user?.permissions, PERMISSIONS.ATTENDANCE_VIEW);
  const canManage = hasPermission(user?.permissions, PERMISSIONS.ATTENDANCE_MANAGE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BackendAttendanceStatus>('ALL');
  const [page, setPage] = useState(1);

  const [detailEntry, setDetailEntry] = useState<BookingAttendanceEntry | null>(null);
  const [recordTarget, setRecordTarget] = useState<{ booking: BookingDetail; date: string } | null>(null);
  const [correctEntry, setCorrectEntry] = useState<BookingAttendanceEntry | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const submitLockRef = useRef(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const hasInvalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
  const hasActiveFilters = Boolean(searchTerm.trim() || fromDate || toDate || statusFilter !== 'ALL');

  const {
    data: overview,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['attendance', 'global-overview'],
    queryFn: async () => {
      if (bookingRepository.getAllAttendanceOverview) {
        return bookingRepository.getAllAttendanceOverview();
      }
      // Fallback for mocked repositories implementing per-booking methods only
      const bookingRes = await bookingRepository.getBookings({ page: 1, pageSize: 100 });
      const candidates = bookingRes.items.filter(
        (b) =>
          Boolean(b.assignedWorkerId) &&
          (Boolean(b.serviceStartDate) ||
            ['SERVICE_ACTIVE', 'ACTIVE', 'COMPLETED', 'REPLACED', 'REPLACEMENT_REQUESTED'].includes(b.status))
      );
      const entries: BookingAttendanceEntry[] = [];
      let failedBookingsCount = 0;
      const settled = await Promise.allSettled(
        candidates.map(async (b) => {
          if (bookingRepository.getBookingAttendancePage) {
            const p = await bookingRepository.getBookingAttendancePage(b.id, { page: 1, limit: 100 });
            return p.items;
          }
          return (await bookingRepository.getBookingAttendance?.(b.id)) || [];
        })
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') entries.push(...r.value);
        else failedBookingsCount++;
      }
      entries.sort((a, b) => b.date.localeCompare(a.date));
      return {
        entries,
        bookings: bookingRes.items,
        isComplete: failedBookingsCount === 0,
        failedBookingsCount,
        incompleteReason:
          failedBookingsCount > 0
            ? `Failed to fetch attendance for ${failedBookingsCount} booking(s).`
            : undefined,
      };
    },
    enabled: canView,
    staleTime: 30_000,
  });

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, statusFilter, debouncedSearch]);

  const bookingsById = useMemo(() => {
    const map = new Map<string, BookingDetail>();
    for (const b of overview?.bookings ?? []) {
      map.set(b.id, b);
    }
    return map;
  }, [overview?.bookings]);

  const recordedDatesByBooking = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const entry of overview?.entries ?? []) {
      let set = map.get(entry.bookingId);
      if (!set) {
        set = new Set<string>();
        map.set(entry.bookingId, set);
      }
      set.add(entry.date);
    }
    return map;
  }, [overview?.entries]);

  const todayIST = getTodayISTDate();
  const targetServiceDate =
    fromDate && (!toDate || fromDate === toDate)
      ? fromDate
      : !fromDate && toDate
      ? toDate
      : todayIST;

  // Filter recorded attendance entries by Date Range and Search first so Summary Cards match active scope
  const entriesInDateAndSearchScope = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return (overview?.entries ?? []).filter((entry) => {
      if (hasInvalidDateRange) return false;
      if (fromDate && entry.date < fromDate) return false;
      if (toDate && entry.date > toDate) return false;
      if (!q) return true;
      const booking = bookingsById.get(entry.bookingId);
      const refStr = formatBookingReference(entry.bookingId).toLowerCase();
      return (
        entry.bookingId.toLowerCase().includes(q) ||
        refStr.includes(q) ||
        (booking?.customerName || '').toLowerCase().includes(q) ||
        (booking?.assignedWorkerName || '').toLowerCase().includes(q) ||
        entry.workerId.toLowerCase().includes(q) ||
        entry.date.toLowerCase().includes(q) ||
        (entry.note || '').toLowerCase().includes(q) ||
        (entry.markedByRole || '').toLowerCase().includes(q)
      );
    });
  }, [overview?.entries, hasInvalidDateRange, fromDate, toDate, debouncedSearch, bookingsById]);

  const summaryCounts = useMemo(() => {
    if (overview && !overview.isComplete) return null;
    const list = entriesInDateAndSearchScope;
    return {
      totalRecorded: list.length,
      present: list.filter((e) => e.status === 'PRESENT').length,
      absent: list.filter((e) => e.status === 'ABSENT').length,
      exceptions: list.filter((e) => e.status === 'EXCEPTION').length,
    };
  }, [overview, entriesInDateAndSearchScope]);

  // Build combined table rows: contextual unrecorded active bookings first (when eligible), then recorded entries
  const tableRows = useMemo<AttendanceTableRow[]>(() => {
    if (hasInvalidDateRange) return [];

    const q = debouncedSearch.trim().toLowerCase();
    const pendingRows: AttendanceTableRow[] = [];

    if (canManage && statusFilter === 'ALL') {
      const withinDateFilter =
        (!fromDate || targetServiceDate >= fromDate) && (!toDate || targetServiceDate <= toDate);
      if (withinDateFilter) {
        for (const booking of overview?.bookings ?? []) {
          const eligibility = evaluateBookingAttendanceEligibility(booking);
          if (!eligibility.recordEligible) continue;

          const minDate = booking.serviceStartDate?.slice(0, 10);
          const hasValidMin = Boolean(minDate && /^\d{4}-\d{2}-\d{2}$/.test(minDate));
          if (targetServiceDate > todayIST) continue;
          if (hasValidMin && targetServiceDate < minDate!) continue;

          const recordedSet = recordedDatesByBooking.get(booking.id);
          if (recordedSet?.has(targetServiceDate)) continue;

          if (q) {
            const refStr = formatBookingReference(booking.id).toLowerCase();
            const matchesBooking =
              booking.id.toLowerCase().includes(q) ||
              refStr.includes(q) ||
              booking.customerName.toLowerCase().includes(q) ||
              (booking.assignedWorkerName || '').toLowerCase().includes(q) ||
              targetServiceDate.toLowerCase().includes(q);
            if (!matchesBooking) continue;
          }

          pendingRows.push({
            kind: 'PENDING_FOR_DATE',
            key: `pending-${booking.id}-${targetServiceDate}`,
            booking,
            serviceDate: targetServiceDate,
          });
        }
      }
    }

    const entryRows: AttendanceTableRow[] = entriesInDateAndSearchScope
      .filter((entry) => statusFilter === 'ALL' || entry.status === statusFilter)
      .map((entry) => ({
        kind: 'ENTRY',
        key: entry.id,
        entry,
        booking: bookingsById.get(entry.bookingId),
      }));

    return [...pendingRows, ...entryRows];
  }, [
    hasInvalidDateRange,
    debouncedSearch,
    canManage,
    statusFilter,
    fromDate,
    toDate,
    overview?.bookings,
    targetServiceDate,
    todayIST,
    recordedDatesByBooking,
    entriesInDateAndSearchScope,
    bookingsById,
  ]);

  const totalCount = tableRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [tableRows, currentPage]);

  const invalidateAttendanceQueries = async (bookingId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['bookings', 'attendance', bookingId] }),
    ]);
  };

  const recordMutation = useMutation({
    mutationFn: async (payload: {
      bookingId: string;
      date: string;
      status: BackendAttendanceStatus;
      note?: string;
    }) => {
      if (!bookingRepository.recordBookingAttendance) return;
      setModalError(null);
      const signature = `${payload.bookingId}|${payload.date}|${payload.status}|${payload.note || ''}`;
      if (!idempotencyRef.current || idempotencyRef.current.signature !== signature) {
        idempotencyRef.current = { signature, key: generateIdempotencyKey() };
      }
      await bookingRepository.recordBookingAttendance(payload.bookingId, {
        date: payload.date,
        status: payload.status,
        note: payload.note,
        idempotencyKey: idempotencyRef.current.key,
      });
      idempotencyRef.current = null;
    },
    onSuccess: async (_, vars) => {
      setRecordTarget(null);
      setModalError(null);
      setFeedback({ type: 'success', message: 'Attendance recorded successfully.' });
      await invalidateAttendanceQueries(vars.bookingId);
    },
    onError: (err: unknown) => {
      setModalError(err instanceof Error ? err.message : 'Unable to record attendance.');
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const correctMutation = useMutation({
    mutationFn: async (payload: {
      entry: BookingAttendanceEntry;
      status: BackendAttendanceStatus;
      note?: string;
      reason: string;
    }) => {
      if (!bookingRepository.correctBookingAttendance) return;
      setModalError(null);
      await bookingRepository.correctBookingAttendance(payload.entry.id, {
        status: payload.status,
        note: payload.note,
        reason: payload.reason,
        etag: payload.entry.etag,
      });
    },
    onSuccess: async (_, vars) => {
      setCorrectEntry(null);
      setModalError(null);
      setFeedback({ type: 'success', message: 'Attendance record corrected and logged in audit history.' });
      await invalidateAttendanceQueries(vars.entry.bookingId);
    },
    onError: (err: unknown) => {
      setModalError(err instanceof Error ? err.message : 'Unable to correct attendance.');
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  if (!canView) {
    return (
      <NoAccessView
        moduleName="Attendance & Daily Logs"
        requiredPermission={PERMISSIONS.ATTENDANCE_VIEW}
      />
    );
  }

  const navigateTo = (target: string) => {
    if (navigationContext?.navigator) {
      navigationContext.navigator.push(target);
    } else if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setStatusFilter('ALL');
    setPage(1);
  };

  const emptyStateMessage = hasInvalidDateRange
    ? 'Invalid date range: From Date must be on or before To Date.'
    : hasActiveFilters
    ? 'No attendance records match the selected filters.'
    : 'No attendance records found.';

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, currentPage * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Attendance &amp; Daily Logs
          </h1>
          <p style={{ marginTop: 'var(--space-1)', marginBottom: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Monitor worker attendance, daily service records and attendance corrections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            cursor: isFetching ? 'not-allowed' : 'pointer',
            opacity: isFetching ? 0.7 : 1,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <RefreshCw size={14} color="var(--color-primary)" />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-status-success-border)' : 'var(--color-status-danger-border)'}`,
            backgroundColor: feedback.type === 'success' ? 'var(--color-status-success-bg)' : 'var(--color-status-danger-bg)',
            color: feedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Honest Backend Incomplete Warning (only rendered if cross-booking retrieval was partial or hit fan-out limit) */}
      {overview && !overview.isComplete && overview.incompleteReason && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-status-warning-border)',
            backgroundColor: 'var(--color-status-warning-bg)',
            color: 'var(--color-status-warning-text)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{overview.incompleteReason}</span>
        </div>
      )}

      {/* 2. Four Compact Summary Cards */}
      <section aria-label="Attendance summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 'var(--space-3)' }}>
        {[
          {
            label: 'Total Recorded',
            value: summaryCounts ? summaryCounts.totalRecorded : null,
            subtitle: 'Completed & logged entries',
            accent: 'var(--color-navy)',
          },
          {
            label: 'Present',
            value: summaryCounts ? summaryCounts.present : null,
            subtitle: 'Confirmed attendance logs',
            accent: '#15803d',
          },
          {
            label: 'Absent',
            value: summaryCounts ? summaryCounts.absent : null,
            subtitle: 'Recorded absences',
            accent: '#b91c1c',
          },
          {
            label: 'Exceptions',
            value: summaryCounts ? summaryCounts.exceptions : null,
            subtitle: 'Flagged exceptions',
            accent: '#b45309',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {metric.label}
            </span>
            {isLoading ? (
              <div style={{ height: '24px', width: '52px', borderRadius: '4px', backgroundColor: '#f1f5f9', marginTop: '2px' }} />
            ) : (
              <strong style={{ fontSize: '22px', fontWeight: 700, color: metric.accent, lineHeight: 1.2 }}>
                {metric.value === null ? '—' : metric.value}
              </strong>
            )}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {metric.subtitle}
            </span>
          </div>
        ))}
      </section>

      {/* 3. Clean Filter Section */}
      <section
        aria-label="Attendance filters"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: '2 1 240px', minWidth: 'min(100%, 220px)' }}>
            <label htmlFor="attendance-log-search" style={filterLabelStyle}>
              Search
            </label>
            <SearchInput
              id="attendance-log-search"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search ref, customer, worker, note..."
              ariaLabel="Search attendance records"
              minWidth="100%"
            />
          </div>

          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <label htmlFor="attendance-from-date" style={filterLabelStyle}>
              From Date
            </label>
            <input
              id="attendance-from-date"
              type="date"
              aria-label="Filter logs from date"
              value={fromDate}
              max={toDate || todayIST}
              onChange={(e) => setFromDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <label htmlFor="attendance-to-date" style={filterLabelStyle}>
              To Date
            </label>
            <input
              id="attendance-to-date"
              type="date"
              aria-label="Filter logs to date"
              value={toDate}
              min={fromDate || undefined}
              max={todayIST}
              onChange={(e) => setToDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <div style={{ flex: '1 1 165px', minWidth: '155px' }}>
            <label htmlFor="attendance-status-filter" style={filterLabelStyle}>
              Attendance Status
            </label>
            <CustomSelect
              id="attendance-status-filter"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as typeof statusFilter)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                ...ATTENDANCE_STATUS_OPTIONS,
              ]}
              ariaLabel="Filter by attendance status"
              width="100%"
              minWidth="100%"
            />
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                color: hasActiveFilters ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
                opacity: hasActiveFilters ? 1 : 0.6,
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {hasInvalidDateRange && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: '12px', color: 'var(--color-status-danger-text)', fontWeight: 600 }}>
            From Date must be on or before To Date.
          </div>
        )}
      </section>

      {/* 4. Attendance Records Table */}
      <section
        aria-label="Attendance records table"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        {isError ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              {error instanceof Error ? error.message : 'Unable to load attendance logs.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  {[
                    'Booking Reference',
                    'Customer',
                    'Worker',
                    'Service Date',
                    'Attendance Status',
                    'Check-in',
                    'Check-out',
                    'Last Updated',
                    'Actions',
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding:
                          heading === 'Booking Reference'
                            ? '10px 8px 10px 14px'
                            : heading === 'Actions'
                            ? '10px 14px 10px 8px'
                            : '10px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                        textAlign: heading === 'Actions' ? 'right' : 'left',
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && !hasInvalidDateRange ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {Array.from({ length: 9 }).map((__, colIdx) => (
                        <td key={`cell-${idx}-${colIdx}`} style={{ padding: '14px' }}>
                          <div
                            style={{
                              height: '12px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9',
                              width: colIdx === 8 ? '64px' : '85%',
                              marginLeft: colIdx === 8 ? 'auto' : 0,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      <Calendar size={22} color="#94a3b8" style={{ display: 'block', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {emptyStateMessage}
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    if (row.kind === 'PENDING_FOR_DATE') {
                      const { booking, serviceDate } = row;
                      return (
                        <tr
                          key={row.key}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            backgroundColor: '#fcfdff',
                          }}
                        >
                          <td style={{ padding: '10px 8px 10px 14px', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                            {canViewBookings ? (
                              <button
                                type="button"
                                onClick={() => navigateTo(`/bookings?search=${encodeURIComponent(booking.id)}`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--color-primary)',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  fontSize: 'var(--font-size-xs)',
                                }}
                              >
                                {formatBookingReference(booking.id)}
                              </button>
                            ) : (
                              formatBookingReference(booking.id)
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {booking.customerName}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                            <div style={{ fontWeight: 600 }}>
                              {booking.assignedWorkerName || 'Assigned Worker'}
                            </div>
                            {booking.assignedWorkerId && (
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                {formatBookingReference(booking.assignedWorkerId)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {formatDateIST(serviceDate)}
                          </td>
                          <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                            <StatusBadge status="NOT_RECORDED" />
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            —
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            —
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Pending entry
                          </td>
                          <td style={{ padding: '10px 14px 10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                idempotencyRef.current = null;
                                setRecordTarget({ booking, date: serviceDate });
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid transparent',
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={12} />
                              <span>Record Attendance</span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const { entry, booking } = row;
                    return (
                      <tr
                        key={row.key}
                        tabIndex={0}
                        className="clickable-table-row"
                        onClick={(e) => {
                          const target = e.target as { closest?: (s: string) => unknown };
                          if (target?.closest && target.closest('button') && target !== e.currentTarget) return;
                          setDetailEntry(entry);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDetailEntry(entry);
                          }
                        }}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td style={{ padding: '10px 8px 10px 14px', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                          {canViewBookings ? (
                            <button
                              type="button"
                              onClick={() => navigateTo(`/bookings?search=${encodeURIComponent(entry.bookingId)}`)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: 'var(--color-primary)',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-xs)',
                              }}
                            >
                              {formatBookingReference(entry.bookingId)}
                            </button>
                          ) : (
                            formatBookingReference(entry.bookingId)
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {booking?.customerName || 'Not provided'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          <div style={{ fontWeight: 600 }}>
                            {booking?.assignedWorkerName || formatBookingReference(entry.workerId)}
                          </div>
                          {booking?.assignedWorkerName && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                              {formatBookingReference(entry.workerId)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {formatDateIST(entry.date)}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <StatusBadge status={entry.status} />
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {entry.checkInTime ? formatDateTimeIST(entry.checkInTime) : 'Not recorded'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {entry.checkOutTime ? formatDateTimeIST(entry.checkOutTime) : 'Not recorded'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          <div>{entry.updatedAt ? formatDateTimeIST(entry.updatedAt) : formatDateIST(entry.date)}</div>
                          {entry.markedByRole && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>By: {entry.markedByRole}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px 10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setDetailEntry(entry)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: '#ffffff',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Details
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalError(null);
                                  setCorrectEntry(entry);
                                }}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: '#f8fafc',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Edit3 size={12} />
                                <span>Correct</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isError && totalCount > 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>
              Showing {rangeStart}–{rangeEnd} of {totalCount} row{totalCount === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span style={{ fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modals */}
      <AttendanceDetailModal
        entry={detailEntry}
        booking={detailEntry ? bookingsById.get(detailEntry.bookingId) : undefined}
        canViewBookings={canViewBookings}
        canManage={canManage}
        onNavigateToBooking={(id) => navigateTo(`/bookings?search=${encodeURIComponent(id)}`)}
        onOpenCorrect={(entry) => {
          setModalError(null);
          setCorrectEntry(entry);
        }}
        onClose={() => setDetailEntry(null)}
      />

      {canManage && recordTarget && (
        <RecordAttendanceModal
          key={`record-${recordTarget.booking.id}-${recordTarget.date}`}
          isOpen={true}
          booking={recordTarget.booking}
          initialDate={recordTarget.date}
          recordedDates={recordedDatesByBooking.get(recordTarget.booking.id)}
          isSubmitting={recordMutation.isPending}
          serverError={modalError}
          onSubmit={(payload) => {
            if (submitLockRef.current || recordMutation.isPending) return;
            submitLockRef.current = true;
            recordMutation.mutate({ bookingId: recordTarget.booking.id, ...payload });
          }}
          onClose={() => {
            if (!recordMutation.isPending) {
              setRecordTarget(null);
              setModalError(null);
            }
          }}
        />
      )}

      {canManage && (
        <CorrectAttendanceModal
          key={`correct-${correctEntry?.id || 'none'}`}
          entry={correctEntry}
          booking={correctEntry ? bookingsById.get(correctEntry.bookingId) : undefined}
          isSubmitting={correctMutation.isPending}
          serverError={modalError}
          onSubmit={(payload) => {
            if (!correctEntry || submitLockRef.current || correctMutation.isPending) return;
            submitLockRef.current = true;
            correctMutation.mutate({ entry: correctEntry, ...payload });
          }}
          onClose={() => {
            if (!correctMutation.isPending) {
              setCorrectEntry(null);
              setModalError(null);
            }
          }}
        />
      )}
    </div>
  );
};
