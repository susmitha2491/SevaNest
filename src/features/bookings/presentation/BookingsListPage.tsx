import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
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
import { BookingDetail } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { BookingDetailModal } from './BookingDetailModal';
import { CandidateMatchingModal } from './CandidateMatchingModal';
import { TrialOutcomeModal } from './TrialOutcomeModal';
import { ReplacementFulfillmentModal } from './ReplacementFulfillmentModal';

export const BookingsListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLocality, setSelectedLocality] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    }
  }, [searchParams]);

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

  // Query bookings
  const { data: bookingsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', 'list', searchTerm, selectedStatus, selectedCategory, selectedLocality, currentPage],
    queryFn: () =>
      bookingRepository.getBookings({
        searchTerm,
        status: selectedStatus,
        category: selectedCategory,
        locality: selectedLocality,
        page: currentPage,
        pageSize: 6,
      }),
    enabled: canView,
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

  if (isLoading) {
    return <LoadingSpinner message="Loading active bookings & service requests..." />;
  }

  if (isError) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error-dark)' }}>
          Failed to load bookings
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          An error occurred while communicating with the booking management repository.
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
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
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Booking & Service Management
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Operational orchestration for demand matching, trial coordination, replacement fulfillment, and service status.
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
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Status Quick-Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
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
                borderRadius: 'var(--radius-full)',
                border: selectedStatus === tab.key ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                backgroundColor: selectedStatus === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: selectedStatus === tab.key ? '#ffffff' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search and Secondary Dropdowns */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '450px' }}>
            <Search
              size={16}
              color="var(--color-text-tertiary)"
              style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by customer, worker, booking ID, locality..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-label="Search bookings"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
              aria-label="Filter by service category"
            >
              <option value="ALL">All Categories</option>
              <option value="House Maid">House Maid</option>
              <option value="Cook">Cook</option>
              <option value="Driver">Driver</option>
              <option value="Babysitter">Babysitter</option>
              <option value="Elderly Care Helper">Elderly Care Helper</option>
            </select>

            {/* Locality Dropdown */}
            <select
              value={selectedLocality}
              onChange={(e) => {
                setSelectedLocality(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
              aria-label="Filter by locality cluster"
            >
              <option value="ALL">All Localities</option>
              <option value="Kondapur">Kondapur</option>
              <option value="Gachibowli">Gachibowli</option>
              <option value="Madhapur">Madhapur</option>
              <option value="Hitec City">Hitec City</option>
              <option value="Jubilee Hills">Jubilee Hills</option>
              <option value="Banjara Hills">Banjara Hills</option>
            </select>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Booking ID
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Customer
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Service Details
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Assigned Worker
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Operational Status
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bookingsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No bookings found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                bookingsData?.items.map((booking) => (
                  <tr key={booking.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {/* Booking ID */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                        {booking.id}
                      </span>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.customerName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {booking.customerLocality} • {booking.customerPhoneMasked}
                      </div>
                    </td>

                    {/* Service */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{booking.serviceCategory}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {booking.engagementType.replace(/_/g, ' ')}
                      </div>
                    </td>

                    {/* Assigned Worker */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      {booking.assignedWorkerName ? (
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

                    {/* Operational Status */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <StatusBadge status={booking.status} />
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

                        {/* Process Replacement (for REPLACEMENT_REQUESTED state) */}
                        {canManage && booking.status === 'REPLACEMENT_REQUESTED' && (
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
                ))
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
          <select
            value={cancelCategory}
            onChange={(e) => setCancelCategory(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <option value="Customer Request">Customer Voluntary Cancellation</option>
            <option value="Worker Unavailable">Assigned Worker Unavailable</option>
            <option value="Customer Relocation">Customer Relocated</option>
            <option value="Trial Rejected No Rematch">Trial Unsatisfactory - Rematch Declined</option>
            <option value="Other Operational Policy">Other Operational Policy Violation</option>
          </select>
        </div>
      </ConfirmDialog>
    </div>
  );
};
