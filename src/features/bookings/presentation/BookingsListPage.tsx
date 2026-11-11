import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  UserPlus,
  RefreshCw,
  XCircle,
  Eye,
  Calendar,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { BookingDetail, REPLACEMENT_REASONS } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { BookingDetailModal } from './BookingDetailModal';
import { CandidateMatchingModal } from './CandidateMatchingModal';
import { TrialOutcomeModal } from './TrialOutcomeModal';
import { ReplacementFulfillmentModal } from './ReplacementFulfillmentModal';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

export interface BookingsListPageProps {
  defaultStatus?: string;
}

export const BookingsListPage: React.FC<BookingsListPageProps> = ({ defaultStatus }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);

  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || defaultStatus || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLocality, setSelectedLocality] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when debounced search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Sync debounced search to URL without reloading or thrashing
  useEffect(() => {
    const trimmed = debouncedSearchTerm.trim();
    if (trimmed !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = trimmed;
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        if (trimmed) {
          if (next.get('search') !== trimmed) next.set('search', trimmed);
        } else {
          if (next.has('search')) next.delete('search');
        }
        return next;
      }, { replace: true });
    }
  }, [debouncedSearchTerm, setSearchParams]);

  // Sync URL search param to state only when external change (e.g. back/forward navigation) occurs
  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    if (searchParam !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = searchParam;
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    } else if (defaultStatus) {
      setSelectedStatus(defaultStatus);
    }
  }, [searchParams, defaultStatus]);

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMatchOpen, setIsMatchOpen] = useState(false);
  const [isTrialOutcomeOpen, setIsTrialOutcomeOpen] = useState(false);
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelCategory, setCancelCategory] = useState('Customer Request');

  const canView = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);
  const canManage = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_MANAGE);

  // Query bookings with debounced search and keepPreviousData
  const { data: bookingsData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['bookings', 'list', debouncedSearchTerm, selectedStatus, selectedCategory, selectedLocality, currentPage],
    queryFn: () =>
      bookingRepository.getBookings({
        searchTerm: debouncedSearchTerm,
        status: selectedStatus,
        category: selectedCategory,
        locality: selectedLocality,
        page: currentPage,
        pageSize: 6,
      }),
    enabled: canView,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  // Confirm booking mutation (activates service)
  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await bookingRepository.confirmBooking(bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async ({
      bookingId,
      remarks,
      reason,
    }: {
      bookingId: string;
      remarks: string;
      reason: string;
    }) => {
      await bookingRepository.cancelBooking(bookingId, remarks, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setIsCancelOpen(false);
    },
  });

  if (!canView) {
    return <NoAccessView moduleName="Booking & Service Management" requiredPermission={PERMISSIONS.BOOKINGS_VIEW} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            {defaultStatus === 'REPLACEMENT_REQUESTED' ? 'Replacement Management' : 'Booking & Service Management'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {defaultStatus === 'REPLACEMENT_REQUESTED'
              ? 'Operational replacement coordination: review eligibility, rematch qualified domestic workers, and oversee trial fulfillment.'
              : 'Operational orchestration for demand matching, trial coordination, replacement fulfillment, and service status.'}
          </p>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-status-info-bg)',
            border: '1px solid var(--color-status-info-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-info-text)',
          }}
        >
          <Info size={16} />
          <span>Strict Policy: Only fully-verified candidates matched to bookings</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          padding: '16px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Status Quick-Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)', scrollbarWidth: 'thin' }}>
          {[
            { key: 'ALL', label: 'All Bookings' },
            { key: 'REQUESTED', label: 'New Requests' },
            { key: 'INTERVIEW_SCHEDULED', label: 'Trials Scheduled' },
            { key: 'CONFIRMED', label: 'Confirmed' },
            { key: 'SERVICE_ACTIVE', label: 'Active Services' },
            { key: 'REPLACEMENT_REQUESTED', label: 'Replacements' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full, 9999px)',
                border: selectedStatus === tab.key ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: selectedStatus === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface, #ffffff)',
                color: selectedStatus === tab.key ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                fontSize: 'var(--font-size-xs, 12px)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search and Secondary Dropdowns */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%' }}>
          <SearchInput
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            placeholder="Search by customer, worker, booking ID, locality..."
            ariaLabel="Search bookings"
            isLoading={isFetching && debouncedSearchTerm.trim().length > 0}
            containerStyle={{ flex: '1 1 300px', minWidth: 'min(100%, 240px)' }}
          />

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Category Dropdown */}
            <CustomSelect
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'House Maid', label: 'House Maid' },
                { value: 'Cook', label: 'Cook' },
                { value: 'Driver', label: 'Driver' },
                { value: 'Babysitter', label: 'Babysitter' },
                { value: 'Elderly Care Helper', label: 'Elderly Care Helper' },
              ]}
              ariaLabel="Filter by service category"
              minWidth="130px"
            />

            {/* Locality Dropdown */}
            <CustomSelect
              value={selectedLocality}
              onChange={(val) => {
                setSelectedLocality(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Localities' },
                { value: 'Kondapur', label: 'Kondapur' },
                { value: 'Gachibowli', label: 'Gachibowli' },
                { value: 'Madhapur', label: 'Madhapur' },
                { value: 'Hitec City', label: 'Hitec City' },
                { value: 'Jubilee Hills', label: 'Jubilee Hills' },
                { value: 'Banjara Hills', label: 'Banjara Hills' },
              ]}
              ariaLabel="Filter by locality cluster"
              minWidth="130px"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Booking ID
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {selectedStatus === 'REPLACEMENT_REQUESTED' ? 'Customer & Contact' : 'Customer'}
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {selectedStatus === 'REPLACEMENT_REQUESTED' ? 'Prior Worker Details' : 'Service Details'}
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {selectedStatus === 'REPLACEMENT_REQUESTED' ? 'Replacement Reason & Date' : 'Assigned Worker'}
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {selectedStatus === 'REPLACEMENT_REQUESTED' ? 'Replacement Status' : 'Operational Status'}
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !bookingsData ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <LoadingSpinner message="Loading active bookings & service requests..." />
                  </td>
                </tr>
              ) : isError && !bookingsData ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-error-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={36} color="var(--color-error-dark)" />
                      <div style={{ fontWeight: 600 }}>Failed to load bookings</div>
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--font-size-xs)' }}>
                        An error occurred while communicating with the booking management repository.
                      </p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        style={{
                          marginTop: 'var(--space-2)',
                          padding: '6px 16px',
                          backgroundColor: 'var(--color-brand-600)',
                          color: '#fff',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : bookingsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {selectedStatus === 'REPLACEMENT_REQUESTED'
                      ? 'No active replacement requests found.'
                      : 'No bookings found matching the selected criteria.'}
                  </td>
                </tr>
              ) : (
                bookingsData?.items.map((booking) => {
                  const isReplacementTab = selectedStatus === 'REPLACEMENT_REQUESTED';
                  const priorWorkerName = booking.replacement?.priorWorkerName || booking.assignedWorkerName || 'Prior Worker';
                  const priorWorkerId = booking.replacement?.priorWorkerId || booking.assignedWorkerId;

                  return (
                    <tr
                      key={booking.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`View booking details for ${booking.id}`}
                      className="clickable-table-row"
                      onClick={(e) => {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        setSelectedBooking(booking);
                        setIsDetailOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          e.preventDefault();
                          setSelectedBooking(booking);
                          setIsDetailOpen(true);
                        }
                      }}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      {/* Booking ID */}
                      <td style={{ padding: 'var(--space-4)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                          {booking.id}
                        </span>
                        {booking.replacesBookingId && (
                          <div style={{ fontSize: '10px', color: '#1e40af', backgroundColor: '#eff6ff', padding: '1px 5px', borderRadius: '4px', marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #bfdbfe' }}>
                            <RefreshCw size={9} /> Replaces: {booking.replacesBookingId}
                          </div>
                        )}
                        {booking.replacement?.replacementBookingId && (
                          <div style={{ fontSize: '10px', color: '#0f766e', backgroundColor: '#f0fdfa', padding: '1px 5px', borderRadius: '4px', marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #99f6e4' }}>
                            <RefreshCw size={9} /> Replaced: {booking.replacement.replacementBookingId}
                          </div>
                        )}
                        {isReplacementTab && booking.replacement?.id && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                            Req: {booking.replacement.id}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: 'var(--space-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.customerName}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {booking.customerLocality} • {booking.customerPhoneMasked}
                        </div>
                      </td>

                      {/* Column 3: Prior Worker (if replacement tab) OR Service Details */}
                      <td style={{ padding: 'var(--space-4)' }}>
                        {isReplacementTab ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{priorWorkerName}</div>
                            {priorWorkerId && (
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                                {priorWorkerId}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                              {booking.serviceCategory}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.serviceCategory}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              {booking.engagementType.replace(/_/g, ' ')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Replacement Reason & Date (if replacement tab) OR Assigned Worker */}
                      <td style={{ padding: 'var(--space-4)' }}>
                        {isReplacementTab ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-warning-dark)' }}>
                              {(booking.replacement?.reasonCode && REPLACEMENT_REASONS[booking.replacement.reasonCode]) ||
                                booking.replacement?.reasonCode ||
                                booking.replacement?.reasonCategory ||
                                booking.replacement?.reason ||
                                'Replacement Request'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              Requested: {formatDateTimeIST(booking.replacement?.createdAt || booking.replacement?.requestedAt || booking.createdAt)}
                            </div>
                            {(booking.replacement?.notes || booking.replacement?.reason) && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--color-text-tertiary)',
                                  maxWidth: '240px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={booking.replacement.notes ? `${booking.replacement.reason} — ${booking.replacement.notes}` : booking.replacement.reason}
                              >
                                &ldquo;{booking.replacement.notes ? `${booking.replacement.reason} — ${booking.replacement.notes}` : booking.replacement.reason}&rdquo;
                              </div>
                            )}
                          </div>
                        ) : booking.assignedWorkerName ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.assignedWorkerName}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                              {booking.assignedWorkerId}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-warning-dark)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)' }}>
                            <UserPlus size={14} /> Unassigned / Needs Match
                          </span>
                        )}
                      </td>

                      {/* Column 5: Operational Status OR Replacement Status */}
                      <td style={{ padding: 'var(--space-4)' }}>
                        {isReplacementTab && booking.replacement?.status ? (
                          <StatusBadge status={booking.replacement.status} />
                        ) : (
                          <StatusBadge status={booking.status} />
                        )}
                      </td>

                    {/* Actions */}
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        {/* View Details CTA */}
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsDetailOpen(true);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="View Details"
                        >
                          <Eye size={13} /> View
                        </button>

                        {/* Match Candidates (for REQUESTED state) */}
                        {canManage && booking.status === 'REQUESTED' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsMatchOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-brand-500)',
                              backgroundColor: 'var(--color-brand-50)',
                              color: 'var(--color-brand-700)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <UserPlus size={13} /> Match Workers
                          </button>
                        )}

                        {/* Record Trial Outcome (for INTERVIEW_SCHEDULED state) */}
                        {canManage && booking.status === 'INTERVIEW_SCHEDULED' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsTrialOutcomeOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-brand-600)',
                              backgroundColor: 'var(--color-brand-600)',
                              color: '#ffffff',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Calendar size={13} /> Record Outcome
                          </button>
                        )}

                        {/* Confirm Booking -> Active (for CONFIRMED state) */}
                        {canManage && booking.status === 'CONFIRMED' && (
                          <button
                            onClick={() => confirmBookingMutation.mutate(booking.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-status-success-border)',
                              backgroundColor: 'var(--color-status-success-bg)',
                              color: 'var(--color-status-success-text)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Check size={13} /> Activate Service
                          </button>
                        )}

                        {/* Process Replacement (for REPLACEMENT_REQUESTED state or active replacement case) */}
                        {canManage && (booking.status === 'REPLACEMENT_REQUESTED' || booking.replacement) && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsReplacementOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-warning-dark)',
                              backgroundColor: 'var(--color-warning-bg)',
                              color: 'var(--color-warning-dark)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <RefreshCw size={13} /> Process Replacement
                          </button>
                        )}

                        {/* Cancel Booking */}
                        {canManage && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsCancelOpen(true);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-error-dark)',
                              fontSize: 'var(--font-size-xs)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Cancel Booking"
                          >
                            <XCircle size={13} />
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

        {/* Pagination Bar */}
        {bookingsData && bookingsData.totalPages > 1 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Page {bookingsData.page} of {bookingsData.totalPages} ({bookingsData.totalCount} total bookings)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={bookingsData.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: bookingsData.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={bookingsData.page >= bookingsData.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, bookingsData.totalPages))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: bookingsData.page >= bookingsData.totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedBooking(null);
        }}
        onOpenMatchWizard={canManage ? (b) => {
          setIsDetailOpen(false);
          setSelectedBooking(b);
          setIsMatchOpen(true);
        } : undefined}
        onOpenTrialOutcome={canManage ? (b) => {
          setIsDetailOpen(false);
          setSelectedBooking(b);
          setIsTrialOutcomeOpen(true);
        } : undefined}
        onOpenReplacement={canManage ? (b) => {
          setIsDetailOpen(false);
          setSelectedBooking(b);
          setIsReplacementOpen(true);
        } : undefined}
        onOpenCancel={canManage ? (b) => {
          setIsDetailOpen(false);
          setSelectedBooking(b);
          setIsCancelOpen(true);
        } : undefined}
      />

      {/* Candidate Matching Wizard Modal */}
      <CandidateMatchingModal
        booking={selectedBooking}
        isOpen={isMatchOpen}
        onClose={() => {
          setIsMatchOpen(false);
          setSelectedBooking(null);
        }}
        onTrialScheduled={() => {
          setIsMatchOpen(false);
          setSelectedBooking(null);
        }}
      />

      {/* Trial Outcome Modal */}
      <TrialOutcomeModal
        booking={selectedBooking}
        isOpen={isTrialOutcomeOpen}
        onClose={() => {
          setIsTrialOutcomeOpen(false);
          setSelectedBooking(null);
        }}
        onOutcomeRecorded={() => {
          setIsTrialOutcomeOpen(false);
          setSelectedBooking(null);
        }}
      />

      {/* Replacement Fulfillment Modal */}
      <ReplacementFulfillmentModal
        booking={selectedBooking}
        isOpen={isReplacementOpen}
        onClose={() => {
          setIsReplacementOpen(false);
          setSelectedBooking(null);
        }}
        onReplacementProcessed={() => {
          setIsReplacementOpen(false);
          setSelectedBooking(null);
        }}
      />

      {/* Booking Cancellation Dialog with Mandatory Remarks */}
      <ConfirmDialog
        isOpen={isCancelOpen}
        title={`Cancel Booking ${selectedBooking?.id}`}
        description="Terminating this booking will cancel any scheduled interviews/trials or active service allocations."
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational remarks for cancellation audit trail..."
        onConfirm={(remarks) => {
          if (selectedBooking) {
            cancelMutation.mutate({
              bookingId: selectedBooking.id,
              remarks: remarks || 'Booking cancelled via operations console.',
              reason: cancelCategory,
            });
          }
        }}
        onCancel={() => {
          setIsCancelOpen(false);
          setSelectedBooking(null);
        }}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
            Cancellation Reason Category:
          </label>
          <CustomSelect
            value={cancelCategory}
            onChange={(val) => setCancelCategory(val)}
            options={[
              { value: 'Customer Request', label: 'Customer Voluntary Cancellation' },
              { value: 'Worker Unavailable', label: 'Assigned Worker Unavailable' },
              { value: 'Customer Relocation', label: 'Customer Relocated' },
              { value: 'Trial Rejected No Rematch', label: 'Trial Unsatisfactory - Rematch Declined' },
              { value: 'Other Operational Policy', label: 'Other Operational Policy Violation' },
            ]}
            ariaLabel="Cancellation Reason Category"
            width="100%"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
