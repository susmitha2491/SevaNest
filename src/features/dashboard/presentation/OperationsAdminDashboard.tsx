import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  Shield,
  UserCheck,
} from 'lucide-react';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { DonutChart, DonutChartSegment } from './analytics/charts/DonutChart';
import { HorizontalBarChart, HorizontalBarItem } from './analytics/charts/HorizontalBarChart';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

const cardSurfaceStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  boxShadow: 'var(--shadow-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
};

const headerActionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg-app)',
  color: 'var(--color-primary)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const BOOKING_STATUS_META: Record<string, { label: string; color: string; order: number }> = {
  NEW_REQUEST: { label: 'New Request', color: '#3B82F6', order: 1 },
  REQUESTED: { label: 'New Request', color: '#3B82F6', order: 1 },
  MATCHED: { label: 'Matched', color: '#6366F1', order: 2 },
  MATCHING_IN_PROGRESS: { label: 'Matched', color: '#6366F1', order: 2 },
  INTERVIEW_TRIAL_SCHEDULED: { label: 'Trial Scheduled', color: '#8B5CF6', order: 3 },
  INTERVIEW_SCHEDULED: { label: 'Trial Scheduled', color: '#8B5CF6', order: 3 },
  INTERVIEW_TRIAL_COMPLETED: { label: 'Trial Completed', color: '#0EA5E9', order: 4 },
  TRIAL_ACTIVE: { label: 'Trial Completed', color: '#0EA5E9', order: 4 },
  PENDING_PAYMENT: { label: 'Pending Payment', color: '#F59E0B', order: 5 },
  CUSTOMER_CONFIRMATION_PENDING: { label: 'Pending Payment', color: '#F59E0B', order: 5 },
  CONFIRMED: { label: 'Confirmed', color: '#14B8A6', order: 6 },
  ACTIVE: { label: 'Active', color: '#16A34A', order: 7 },
  SERVICE_ACTIVE: { label: 'Active', color: '#16A34A', order: 7 },
  REPLACEMENT_REQUESTED: { label: 'Replacement Requested', color: '#F97316', order: 8 },
  REPLACED: { label: 'Replaced', color: '#64748B', order: 9 },
  COMPLETED: { label: 'Completed', color: '#10B981', order: 10 },
  CANCELLED: { label: 'Cancelled', color: '#EF4444', order: 11 },
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export const OperationsAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const canViewDashboard = !user || hasPermission(user.permissions, PERMISSIONS.DASHBOARD_VIEW);
  const canViewBookings = !user || hasPermission(user.permissions, PERMISSIONS.BOOKINGS_VIEW);
  const canViewWorkers = !user || hasPermission(user.permissions, PERMISSIONS.WORKER_VIEW);
  const canViewSupport = !user || hasPermission(user.permissions, PERMISSIONS.SUPPORT_VIEW);
  const canViewPayments = !user || hasPermission(user.permissions, PERMISSIONS.PAYMENTS_VIEW);
  const canReviewVerification = !user || hasPermission(user.permissions, PERMISSIONS.VERIFICATION_REVIEW);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'operations-admin'],
    queryFn: () => dashboardRepository.getOperationsAdminDashboard(),
    enabled: canViewDashboard,
  });

  if (!canViewDashboard) {
    return (
      <NoAccessView
        moduleName="Operations Command Console"
        requiredPermission={PERMISSIONS.DASHBOARD_VIEW}
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading Operations Command Console..." />;
  }

  if (isError || !data || !data.kpis) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Operations Dashboard metrics.';

    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const { kpis, sections } = data;

  const hasBookingMetrics =
    Boolean(sections?.bookings) ||
    kpis.totalBookings != null ||
    kpis.newBookingRequests != null;

  const totalBookingsVal = sections?.bookings
    ? (sections.bookings.grossBookings ??
      sections.bookings.byStatus.reduce((sum, item) => sum + item.count, 0))
    : kpis.totalBookings ??
      (hasBookingMetrics
        ? (kpis.newBookingRequests ?? 0) +
          (kpis.bookingsAwaitingMatching ?? 0) +
          (kpis.scheduledTrialsToday ?? 0) +
          (kpis.bookingsAwaitingConfirmation ?? 0) +
          (kpis.activeLiveEngagements ?? 0)
        : null);

  const bookingSubtitleParts: string[] = [];
  if (kpis.newBookingRequests != null) bookingSubtitleParts.push(`${kpis.newBookingRequests} new`);
  if (kpis.scheduledTrialsToday != null) bookingSubtitleParts.push(`${kpis.scheduledTrialsToday} trials`);
  if (kpis.activeLiveEngagements != null) bookingSubtitleParts.push(`${kpis.activeLiveEngagements} active`);

  const verifiedWorkersVal =
    sections?.workers?.verifiedAndActive ??
    kpis.verifiedAndActiveWorkers ??
    kpis.totalWorkers ??
    null;
  const registeredWorkersVal = sections?.workers?.registered ?? kpis.totalWorkers ?? null;
  const workerReadinessPct =
    registeredWorkersVal && registeredWorkersVal > 0 && verifiedWorkersVal != null
      ? Math.round((verifiedWorkersVal / registeredWorkersVal) * 100)
      : null;

  const showPendingKyc =
    sections?.pendingKyc != null ||
    (kpis.pendingVerificationCases != null && canReviewVerification);

  const replacementsRequestedVal =
    sections?.replacements?.requested ?? kpis.replacementRequests ?? null;

  const activeComplaintsVal = sections?.complaints
    ? sections.complaints.open + sections.complaints.inProgress + sections.complaints.escalated
    : kpis.openDisputes ?? null;

  const alertsSection = sections?.alerts ?? null;
  const primaryCollection =
    sections?.collections && sections.collections.length > 0 ? sections.collections[0] : null;

  // Merge equivalent legacy/canonical booking statuses in natural workflow order
  const bookingSegmentMap = new Map<string, DonutChartSegment & { order: number }>();
  if (sections?.bookings?.byStatus) {
    for (const entry of sections.bookings.byStatus) {
      if (!entry.status) continue;
      const meta = BOOKING_STATUS_META[entry.status] ?? {
        label: formatStatusLabel(entry.status),
        color: '#94A3B8',
        order: 99,
      };
      const existing = bookingSegmentMap.get(meta.label);
      if (existing) {
        existing.value += entry.count;
      } else {
        bookingSegmentMap.set(meta.label, {
          id: entry.status,
          label: meta.label,
          value: entry.count,
          color: meta.color,
          order: meta.order,
        });
      }
    }
  } else if (hasBookingMetrics) {
    const legacyCounts: Array<{ id: string; value: number | null | undefined }> = [
      { id: 'NEW_REQUEST', value: kpis.newBookingRequests },
      { id: 'MATCHED', value: kpis.bookingsAwaitingMatching },
      { id: 'INTERVIEW_TRIAL_SCHEDULED', value: kpis.scheduledTrialsToday },
      { id: 'CONFIRMED', value: kpis.bookingsAwaitingConfirmation },
      { id: 'ACTIVE', value: kpis.activeLiveEngagements },
    ];
    for (const item of legacyCounts) {
      if (item.value == null) continue;
      const meta = BOOKING_STATUS_META[item.id];
      bookingSegmentMap.set(meta.label, {
        id: item.id,
        label: meta.label,
        value: item.value,
        color: meta.color,
        order: meta.order,
      });
    }
  }

  const bookingStatusSegments: DonutChartSegment[] = Array.from(bookingSegmentMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ id, label, value, color }) => ({ id, label, value, color }));

  const bookingDistributionTotal = bookingStatusSegments.reduce((sum, seg) => sum + seg.value, 0);

  const operationalTriageItems: HorizontalBarItem[] = [];
  if (alertsSection) {
    operationalTriageItems.push(
      {
        id: 'CRITICAL_ALERTS',
        title: 'Critical Alerts',
        subtitle: 'Immediate operational attention',
        value: alertsSection.critical,
        formattedValue: `${alertsSection.critical}`,
        color: 'var(--color-error)',
      },
      {
        id: 'WARNING_ALERTS',
        title: 'Warning Alerts',
        subtitle: 'Monitoring required',
        value: alertsSection.warning,
        formattedValue: `${alertsSection.warning}`,
        color: 'var(--color-warning)',
      }
    );
  }
  if (sections?.complaints) {
    const { open, inProgress, escalated, unassigned } = sections.complaints;
    operationalTriageItems.push(
      {
        id: 'UNASSIGNED_COMPLAINTS',
        title: 'Unassigned Complaints',
        subtitle: 'Awaiting owner assignment',
        value: unassigned,
        formattedValue: `${unassigned}`,
        color: '#F97316',
      },
      {
        id: 'ESCALATED_COMPLAINTS',
        title: 'Escalated Complaints',
        subtitle: 'Escalated to Operations',
        value: escalated,
        formattedValue: `${escalated}`,
        color: '#DC2626',
      },
      {
        id: 'OPEN_IN_PROGRESS_COMPLAINTS',
        title: 'Open & In-Progress Complaints',
        subtitle: `${open} open · ${inProgress} in progress`,
        value: open + inProgress,
        formattedValue: `${open + inProgress}`,
        color: '#3B82F6',
      }
    );
  } else if (kpis.openDisputes != null && kpis.openDisputes > 0) {
    operationalTriageItems.push({
      id: 'ACTIVE_COMPLAINTS',
      title: 'Active Complaints',
      subtitle: 'Open support grievances',
      value: kpis.openDisputes,
      formattedValue: `${kpis.openDisputes}`,
      color: '#3B82F6',
    });
  }

  const totalAttentionCount =
    (alertsSection?.open ?? 0) + (activeComplaintsVal ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Dashboard Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 700,
              color: 'var(--color-navy)',
              margin: 0,
            }}
          >
            Operations Command Console
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-1)',
            }}
          >
            Marketplace operations overview across bookings, active workers, replacements, complaints, and collections.
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
          <RefreshCw
            size={14}
            color="var(--color-primary)"
            style={{ animation: isFetching ? 'spin 1s linear infinite' : undefined }}
          />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* 2. Essential Operational KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {totalBookingsVal !== null && (
          <KPICard
            title="Total Bookings"
            value={totalBookingsVal}
            subtitle={bookingSubtitleParts.join(' · ') || 'Booking requests & active services'}
            icon={CalendarCheck}
            onClick={canViewBookings ? () => navigate('/bookings') : undefined}
          />
        )}

        {(verifiedWorkersVal !== null || registeredWorkersVal !== null) && (
          <KPICard
            title="Verified & Active Workers"
            value={verifiedWorkersVal}
            subtitle={
              registeredWorkersVal != null
                ? workerReadinessPct != null
                  ? `${workerReadinessPct}% of ${registeredWorkersVal} registered`
                  : `${registeredWorkersVal} registered workers`
                : 'Active verified workforce'
            }
            icon={UserCheck}
            onClick={canViewWorkers ? () => navigate('/workers') : undefined}
          />
        )}

        {showPendingKyc && (
          <KPICard
            title="Pending KYC"
            value={kpis.pendingVerificationCases}
            subtitle={
              sections?.pendingKyc
                ? `${sections.pendingKyc.submitted} submitted · ${sections.pendingKyc.inReview} in review`
                : 'Worker verification queue'
            }
            icon={Shield}
            onClick={canReviewVerification ? () => navigate('/verification') : undefined}
          />
        )}

        {replacementsRequestedVal !== null && (
          <KPICard
            title="Replacement Requests"
            value={replacementsRequestedVal}
            subtitle={
              sections?.replacements
                ? `${sections.replacements.approved} approved`
                : 'Rematch requests'
            }
            icon={RefreshCw}
            onClick={canViewBookings ? () => navigate('/bookings') : undefined}
          />
        )}

        {activeComplaintsVal !== null && (
          <KPICard
            title="Active Complaints"
            value={activeComplaintsVal}
            subtitle={
              sections?.complaints
                ? `${sections.complaints.open} open · ${sections.complaints.escalated} escalated`
                : 'Open support grievances'
            }
            icon={LifeBuoy}
            onClick={canViewSupport ? () => navigate('/support') : undefined}
          />
        )}

        {alertsSection && (
          <KPICard
            title="Open Alerts"
            value={alertsSection.open}
            subtitle={`${alertsSection.critical} critical · ${alertsSection.warning} warning`}
            icon={AlertTriangle}
          />
        )}

        {primaryCollection && canViewPayments && (
          <KPICard
            title="Collections (MTD)"
            value={primaryCollection.monthToDateFormatted}
            subtitle={`Today: ${primaryCollection.todayFormatted}`}
            icon={CreditCard}
            onClick={() => navigate('/payments')}
          />
        )}
      </div>

      {/* 3. Operational Visualizations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <section style={cardSurfaceStyle} aria-label="Booking Status Distribution">
          <div style={cardHeaderStyle}>
            <div>
              <h2
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 700,
                  color: 'var(--color-navy)',
                  margin: 0,
                }}
              >
                Booking Status Distribution
              </h2>
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '4px',
                }}
              >
                Breakdown of bookings across current operational lifecycle stages ({bookingDistributionTotal} total)
              </p>
            </div>
            {canViewBookings && (
              <button
                type="button"
                onClick={() => navigate('/bookings')}
                style={headerActionBtnStyle}
              >
                <span>Open Bookings</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <DonutChart
            segments={bookingStatusSegments}
            centerLabel="Total Bookings"
            emptyMessage="No booking records available"
            ariaLabel="Booking Status Distribution Chart"
          />
        </section>

        <section style={cardSurfaceStyle} aria-label="Alerts & Complaints Breakdown">
          <div style={cardHeaderStyle}>
            <div>
              <h2
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 700,
                  color: 'var(--color-navy)',
                  margin: 0,
                }}
              >
                Alerts & Complaints Breakdown
              </h2>
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '4px',
                }}
              >
                Live operational alerts and support ticket workload ({totalAttentionCount} open items)
              </p>
            </div>
            {canViewSupport && (
              <button
                type="button"
                onClick={() => navigate('/support')}
                style={headerActionBtnStyle}
              >
                <span>Open Support</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <HorizontalBarChart
            items={operationalTriageItems}
            showRank={false}
            maxItems={5}
            emptyMessage="No open operational alerts or complaints recorded"
            ariaLabel="Operational Alerts and Complaints Breakdown"
          />
        </section>
      </div>
    </div>
  );
};
