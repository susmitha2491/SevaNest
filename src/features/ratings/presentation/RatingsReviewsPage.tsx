import React, { useContext, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import { ratingRepository } from '../data/ratingRepository';
import { RatingRecord } from '../domain/types';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { SearchInput } from '../../../components/common/SearchInput';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { formatDateIST, formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

function renderStars(score: number): string {
  const clamped = Math.min(5, Math.max(0, Math.round(score)));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export const RatingsReviewsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const user = useAuthStore((s) => s.user);

  const canView = hasPermission(user?.permissions, PERMISSIONS.RATING_VIEW);
  const canModerate = hasPermission(user?.permissions, PERMISSIONS.RATING_MODERATE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  const [scoreFilter, setScoreFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const [detailRatingId, setDetailRatingId] = useState<string | null>(null);
  const [moderateTarget, setModerateTarget] = useState<{ item: RatingRecord; action: 'hide' | 'unhide' } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    data: ratingsData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['ratings', 'list', debouncedSearch, statusFilter, scoreFilter, fromDate, toDate, page],
    queryFn: () =>
      ratingRepository.getRatings({
        searchTerm: debouncedSearch || undefined,
        status: statusFilter,
        score: scoreFilter === 'ALL' ? 'ALL' : Number(scoreFilter),
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        limit: 15,
      }),
    enabled: canView,
    staleTime: 30_000,
  });

  const { data: detailRating, isLoading: isDetailLoading } = useQuery({
    queryKey: ['ratings', 'detail', detailRatingId],
    queryFn: () => (detailRatingId ? ratingRepository.getRatingById(detailRatingId) : Promise.resolve(null)),
    enabled: canView && Boolean(detailRatingId),
  });

  const { data: workerSummary } = useQuery({
    queryKey: ['ratings', 'worker-summary', detailRating?.workerId],
    queryFn: () =>
      detailRating?.workerId
        ? ratingRepository.getWorkerRatingSummary(detailRating.workerId)
        : Promise.resolve(null),
    enabled: canView && Boolean(detailRating?.workerId),
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ ratingId, action, reason }: { ratingId: string; action: 'hide' | 'unhide'; reason: string }) => {
      if (reason.trim().length < 3) {
        throw new Error('Moderation reason must be at least 3 characters.');
      }
      setModalError(null);
      await ratingRepository.moderateRating(ratingId, action, reason);
    },
    onSuccess: async (_, vars) => {
      setModerateTarget(null);
      setModalError(null);
      setFeedback({
        type: 'success',
        message: vars.action === 'hide' ? 'Review hidden from worker profile.' : 'Review restored to visible status.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ratings'] }),
        queryClient.invalidateQueries({ queryKey: ['workers', 'ratings'] }),
      ]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update review visibility.';
      setModalError(msg);
      setFeedback({ type: 'error', message: msg });
    },
  });

  if (!canView) {
    return <NoAccessView moduleName="Ratings & Reviews" requiredPermission={PERMISSIONS.RATING_VIEW} />;
  }

  const navigateTo = (target: string) => {
    if (navigationContext?.navigator) {
      navigationContext.navigator.push(target);
    } else if (typeof window !== 'undefined') {
      window.location.assign(target);
    }
  };

  const overview = ratingsData?.overview;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Ratings &amp; Reviews
          </h1>
          <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Monitor verified customer feedback and moderate inappropriate or policy-violating reviews.
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

      {/* A. Ratings Overview KPIs */}
      {overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <KPICard title="Total Ratings" value={overview.total} subtitle="All recorded reviews" icon={Star} />
            <KPICard
              title="Average Rating"
              value={overview.averageScore !== null ? `${overview.averageScore} / 5` : 'Unavailable'}
              subtitle={overview.isCompleteDataset ? 'Across all ratings' : 'Dataset incomplete'}
              icon={Star}
            />
            <KPICard title="Visible Reviews" value={overview.visible} subtitle="Published on profiles" icon={Eye} />
            <KPICard title="Hidden Reviews" value={overview.hidden} subtitle="Removed via moderation" icon={EyeOff} />
          </div>

          {overview.isCompleteDataset && overview.total > 0 && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-4)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <strong style={{ color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '11px' }}>
                Rating Distribution:
              </strong>
              {overview.distribution.map((d) => (
                <span key={d.score} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  {d.score}★: {d.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* C. Search & Filters */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <SearchInput
          value={searchTerm}
          onChange={(val) => {
            setSearchTerm(val);
            setPage(1);
          }}
          placeholder="Search by worker, customer, booking ID, or review..."
          ariaLabel="Search ratings and reviews"
          containerStyle={{ flex: '1 1 260px', minWidth: 'min(100%, 220px)' }}
        />

        <CustomSelect
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val as 'ALL' | 'VISIBLE' | 'HIDDEN');
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'All Statuses' },
            { value: 'VISIBLE', label: 'Visible Only' },
            { value: 'HIDDEN', label: 'Hidden Only' },
          ]}
          ariaLabel="Filter by moderation status"
          minWidth="140px"
        />

        <CustomSelect
          value={scoreFilter}
          onChange={(val) => {
            setScoreFilter(val);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'All Ratings' },
            { value: '5', label: '5 Stars' },
            { value: '4', label: '4 Stars' },
            { value: '3', label: '3 Stars' },
            { value: '2', label: '2 Stars' },
            { value: '1', label: '1 Star' },
          ]}
          ariaLabel="Filter by star rating"
          minWidth="130px"
        />

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          From:
          <input
            type="date"
            aria-label="Filter from date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
            }}
          />
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          To:
          <input
            type="date"
            aria-label="Filter to date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
            }}
          />
        </label>
      </div>

      {/* B. Ratings & Reviews Table */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner message="Loading customer ratings and reviews..." />
          </div>
        ) : isError ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-3)' }}>
              {error instanceof Error ? error.message : 'Unable to load ratings and reviews.'}
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
            <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  {['Rating ID', 'Worker', 'Customer', 'Booking Ref', 'Rating', 'Review', 'Submitted', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!ratingsData?.items.length ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No ratings match the selected filters.
                    </td>
                  </tr>
                ) : (
                  ratingsData.items.map((item) => {
                    const isHidden = item.status === 'HIDDEN';
                    return (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        className="clickable-table-row"
                        onClick={(e) => {
                          const target = e.target as { closest?: (s: string) => unknown };
                          if (target?.closest && target.closest('button') && target !== e.currentTarget) return;
                          setDetailRatingId(item.id);
                        }}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {item.id.slice(0, 12)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 'var(--font-size-xs)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {item.workerName || item.workerId}
                          </div>
                          {item.workerName && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                              {item.workerId.slice(0, 12)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 'var(--font-size-xs)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {item.customerName || item.customerUserId || 'Not specified'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                          {canViewBookings ? (
                            <button
                              type="button"
                              onClick={() => navigateTo(`/bookings?search=${encodeURIComponent(item.bookingId)}`)}
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
                              {item.bookingId.slice(0, 12)}
                            </button>
                          ) : (
                            item.bookingId.slice(0, 12)
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                          <span style={{ color: '#d97706', marginRight: '4px' }}>{renderStars(item.score)}</span>
                          <span>({item.score})</span>
                        </td>
                        <td style={{ padding: '12px 14px', maxWidth: '280px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.review || ''}
                          >
                            {item.review || 'No written comment'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {formatDateIST(item.createdAt)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setDetailRatingId(item.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-surface)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              View
                            </button>
                            {canModerate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalError(null);
                                  setModerateTarget({ item, action: isHidden ? 'unhide' : 'hide' });
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: `1px solid ${isHidden ? 'var(--color-status-success-border)' : 'var(--color-status-warning-border)'}`,
                                  backgroundColor: isHidden ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                                  color: isHidden ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                <span>{isHidden ? 'Unhide' : 'Hide'}</span>
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
        {ratingsData && ratingsData.totalPages > 1 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <span>
              Page {ratingsData.page} of {ratingsData.totalPages} ({ratingsData.total} matching ratings)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={ratingsData.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: ratingsData.page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                type="button"
                disabled={ratingsData.page >= ratingsData.totalPages}
                onClick={() => setPage((p) => Math.min(ratingsData.totalPages, p + 1))}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: ratingsData.page >= ratingsData.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* D. Review Details Modal */}
      {detailRatingId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rating-detail-title"
          onClick={() => setDetailRatingId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '580px',
              width: '100%',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <h2 id="rating-detail-title" style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
                Review Details
              </h2>
              <button
                type="button"
                onClick={() => setDetailRatingId(null)}
                aria-label="Close review details"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {isDetailLoading || !detailRating ? (
                <LoadingSpinner message="Loading review details..." />
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                      <span style={{ color: '#d97706', marginRight: '6px' }}>{renderStars(detailRating.score)}</span>
                      {detailRating.score} / 5
                    </div>
                    <StatusBadge status={detailRating.status} />
                  </div>

                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', lineHeight: 1.55 }}>
                    {detailRating.review || 'No written review comment provided.'}
                  </div>

                  {detailRating.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {detailRating.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-subtle)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Worker: </span>
                      <strong>{detailRating.workerName || detailRating.workerId}</strong>
                      {workerSummary && (
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Overall: {workerSummary.average ?? 'N/A'} / {workerSummary.scaleMax} ({workerSummary.count} visible)
                        </div>
                      )}
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Customer: </span>
                      <strong>{detailRating.customerName || detailRating.customerUserId || 'Not specified'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Booking Ref: </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{detailRating.bookingId}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Submitted: </span>
                      <strong>{formatDateTimeIST(detailRating.createdAt)}</strong>
                    </div>
                  </div>

                  {(detailRating.moderationReason || detailRating.moderatedAt) && (
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: '#fffbeb', border: '1px solid #fde68a', fontSize: 'var(--font-size-xs)', color: '#92400e' }}>
                      <div><strong>Moderation Reason:</strong> {detailRating.moderationReason || 'Not specified'}</div>
                      {detailRating.moderatedAt && (
                        <div style={{ marginTop: '2px' }}>Moderated At: {formatDateTimeIST(detailRating.moderatedAt)}</div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    {canViewBookings ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailRatingId(null);
                          navigateTo(`/bookings?search=${encodeURIComponent(detailRating.bookingId)}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-surface)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Open Linked Booking
                      </button>
                    ) : <span />}

                    {canModerate && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setModerateTarget({
                            item: detailRating,
                            action: detailRating.status === 'HIDDEN' ? 'unhide' : 'hide',
                          });
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          backgroundColor: detailRating.status === 'HIDDEN' ? '#16a34a' : '#d97706',
                          color: '#ffffff',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {detailRating.status === 'HIDDEN' ? 'Unhide Review' : 'Hide Review'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* E. Moderation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(moderateTarget)}
        title={moderateTarget?.action === 'hide' ? 'Hide Customer Review' : 'Unhide Customer Review'}
        description={
          moderateTarget?.action === 'hide'
            ? 'Hiding this review removes it from public worker profiles and rating totals. A moderation reason is required.'
            : 'Restoring this review makes it visible on worker profiles and included in rating totals again. A reason is required.'
        }
        confirmLabel={
          moderateMutation.isPending
            ? 'Submitting...'
            : moderateTarget?.action === 'hide'
            ? 'Hide Review'
            : 'Unhide Review'
        }
        isDestructive={moderateTarget?.action === 'hide'}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory moderation reason (recorded in audit trail)..."
        isLoading={moderateMutation.isPending}
        errorMessage={modalError}
        onConfirm={(reason) => {
          if (moderateTarget && reason) {
            moderateMutation.mutate({
              ratingId: moderateTarget.item.id,
              action: moderateTarget.action,
              reason,
            });
          }
        }}
        onCancel={() => {
          setModerateTarget(null);
          setModalError(null);
        }}
      />
    </div>
  );
};

