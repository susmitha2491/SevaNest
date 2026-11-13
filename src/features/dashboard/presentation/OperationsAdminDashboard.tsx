import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LifeBuoy,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { dashboardRepository } from '../data/dashboardRepository';
import { OperationalAlertItem } from '../domain/types';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { OperationalAlertsDrawer } from './OperationalAlertsDrawer';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
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
  NEW_REQUEST: { label: 'Pending (New Request)', color: '#3B82F6', order: 1 },
  REQUESTED: { label: 'Pending (New Request)', color: '#3B82F6', order: 1 },
  MATCHED: { label: 'Matched', color: '#6366F1', order: 2 },
  MATCHING_IN_PROGRESS: { label: 'Matched', color: '#6366F1', order: 2 },
  INTERVIEW_TRIAL_SCHEDULED: { label: 'Trial Scheduled', color: '#8B5CF6', order: 3 },
  INTERVIEW_SCHEDULED: { label: 'Trial Scheduled', color: '#8B5CF6', order: 3 },
  INTERVIEW_TRIAL_COMPLETED: { label: 'Trial Completed', color: '#0EA5E9', order: 4 },
  PENDING_PAYMENT: { label: 'Pending Payment', color: '#F59E0B', order: 5 },
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
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState<OperationalAlertItem | null>(null);
  const [alertActionError, setAlertActionError] = useState<string | null>(null);
  const [alertActionFeedback, setAlertActionFeedback] = useState<string | null>(null);

  const canViewDashboard = !user || hasPermission(user.permissions, PERMISSIONS.DASHBOARD_VIEW);
  const canViewCustomers = !user || hasPermission(user.permissions, PERMISSIONS.CUSTOMER_VIEW);
  const canViewWorkers = !user || hasPermission(user.permissions, PERMISSIONS.WORKER_VIEW);
  const canViewBookings = !user || hasPermission(user.permissions, PERMISSIONS.BOOKINGS_VIEW);
  const canViewSupport = !user || hasPermission(user.permissions, PERMISSIONS.SUPPORT_VIEW);
  const canViewPayments = !user || hasPermission(user.permissions, PERMISSIONS.PAYMENTS_VIEW);
  const canViewAlerts = !user || hasPermission(user.permissions, PERMISSIONS.ALERT_VIEW);
  const canManageAlerts = Boolean(user && hasPermission(user.permissions, PERMISSIONS.ALERT_MANAGE));

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'operations-admin'],
    queryFn: () => dashboardRepository.getOperationsAdminDashboard(),
    enabled: canViewDashboard,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      if (!dashboardRepository.acknowledgeAlert) return;
      await dashboardRepository.acknowledgeAlert(alertId);
    },
    onSuccess: () => {
      setAlertActionError(null);
      setAlertActionFeedback('Alert acknowledged.');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: unknown) => {
      setAlertActionError(err instanceof Error ? err.message : 'Unable to acknowledge alert.');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, note }: { alertId: string; note: string }) => {
      if (!dashboardRepository.resolveAlert) return;
      await dashboardRepository.resolveAlert(alertId, note);
    },
    onSuccess: () => {
      setAlertToResolve(null);
      setAlertActionError(null);
      setAlertActionFeedback('Alert resolved.');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: unknown) => {
      setAlertActionError(err instanceof Error ? err.message : 'Unable to resolve alert.');
    },
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

  const { kpis, sections, operationsOverview, generatedAt } = data;
  const byStatus = sections?.bookings?.byStatus ?? [];
  const countStatus = (...names: string[]) =>
    byStatus.filter((s) => names.includes(s.status)).reduce((sum, s) => sum + s.count, 0);

  const pendingBookingsCount = byStatus.length > 0
    ? countStatus('NEW_REQUEST', 'REQUESTED', 'PENDING_PAYMENT')
    : kpis.newBookingRequests ?? null;
  const activeBookingsCount = byStatus.length > 0
    ? countStatus('ACTIVE', 'SERVICE_ACTIVE')
    : kpis.activeLiveEngagements ?? null;
  const completedBookingsCount = byStatus.length > 0 ? countStatus('COMPLETED') : null;

  const totalBookingsVal = sections?.bookings
    ? (sections.bookings.grossBookings ?? byStatus.reduce((sum, item) => sum + item.count, 0))
    : kpis.totalBookings ?? null;

  const registeredWorkersVal = sections?.workers?.registered ?? kpis.totalWorkers ?? null;
  const verifiedAndActiveWorkersVal =
    sections?.workers?.verifiedAndActive ?? kpis.verifiedAndActiveWorkers ?? null;
  const availableWorkersVal = operationsOverview?.availableWorkers ?? verifiedAndActiveWorkersVal;

  const alertsSection = sections?.alerts ?? null;
  const primaryCollection =
    sections?.collections && sections.collections.length > 0 ? sections.collections[0] : null;

  const bookingRows = (byStatus.length > 0
    ? byStatus.map((entry) => {
        const meta = BOOKING_STATUS_META[entry.status] ?? {
          label: formatStatusLabel(entry.status),
          color: '#64748B',
          order: 99,
        };
        return { status: entry.status, count: entry.count, ...meta };
      })
    : [
        { status: 'NEW_REQUEST', count: kpis.newBookingRequests ?? 0, ...BOOKING_STATUS_META.NEW_REQUEST },
        { status: 'MATCHED', count: kpis.bookingsAwaitingMatching ?? 0, ...BOOKING_STATUS_META.MATCHED },
        { status: 'CONFIRMED', count: kpis.bookingsAwaitingConfirmation ?? 0, ...BOOKING_STATUS_META.CONFIRMED },
        { status: 'ACTIVE', count: kpis.activeLiveEngagements ?? 0, ...BOOKING_STATUS_META.ACTIVE },
      ]
  ).sort((a, b) => a.order - b.order);

  const getAlertDeepLink = (alert: OperationalAlertItem): string | null => {
    const t = (alert.entityType || '').toLowerCase();
    const id = alert.entityId || '';
    if (!id) return null;
    if (t.includes('booking') && canViewBookings) return `/bookings?search=${encodeURIComponent(id)}`;
    if (t.includes('ticket') && canViewSupport) return `/support?ticketId=${encodeURIComponent(id)}`;
    if (t.includes('worker') && canViewWorkers) return `/workers?workerId=${encodeURIComponent(id)}`;
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
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
            Daily marketplace operations snapshot
            {generatedAt ? ` · Updated ${formatDateTimeIST(generatedAt)}` : ''}
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

      {/* A. Daily Statistics (Meaningful KPI Row) */}
      <section aria-label="Daily Statistics">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {operationsOverview?.newCustomersToday != null && (
            <KPICard
              title="New Customers (Today)"
              value={operationsOverview.newCustomersToday}
              subtitle={`IST date: ${operationsOverview.reportingDateIST}`}
              icon={UserPlus}
              onClick={canViewCustomers ? () => navigate('/customers') : undefined}
            />
          )}

          {operationsOverview?.newWorkersToday != null && (
            <KPICard
              title="New Workers (Today)"
              value={operationsOverview.newWorkersToday}
              subtitle={`IST date: ${operationsOverview.reportingDateIST}`}
              icon={Briefcase}
              onClick={canViewWorkers ? () => navigate('/workers') : undefined}
            />
          )}

          {totalBookingsVal !== null && (
            <KPICard
              title="Total Bookings"
              value={totalBookingsVal}
              subtitle={`${pendingBookingsCount ?? 0} pending · ${activeBookingsCount ?? 0} active · ${completedBookingsCount ?? 0} completed`}
              icon={CalendarCheck}
              onClick={canViewBookings ? () => navigate('/bookings') : undefined}
            />
          )}

          {availableWorkersVal !== null && (
            <KPICard
              title="Available Workers"
              value={availableWorkersVal}
              subtitle={
                operationsOverview?.workersVerifiedCount != null
                  ? `${operationsOverview.workersWithActiveBooking ?? 0} assigned of ${operationsOverview.workersVerifiedCount} verified`
                  : `${registeredWorkersVal ?? 0} total registered`
              }
              icon={UserCheck}
              onClick={canViewWorkers ? () => navigate('/workers') : undefined}
            />
          )}

          {alertsSection && canViewAlerts && (
            <KPICard
              title="Open Alerts"
              value={alertsSection.open}
              subtitle={`${alertsSection.critical} critical · ${alertsSection.warning} warning`}
              icon={AlertTriangle}
              onClick={() => setIsAlertsDrawerOpen(true)}
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
      </section>

      {/* B. Booking Overview */}
      <section style={cardSurfaceStyle} aria-label="Booking Overview">
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Booking Overview
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Live booking counts by backend lifecycle status
            </p>
          </div>
          {canViewBookings && (
            <button type="button" onClick={() => navigate('/bookings')} style={headerActionBtnStyle}>
              <span>Open Bookings</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {bookingRows.length === 0 ? (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            No booking summary available.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            {bookingRows.map((row) => (
              <button
                key={row.status}
                type="button"
                disabled={!canViewBookings}
                onClick={() => canViewBookings && navigate(`/bookings?status=${encodeURIComponent(row.status === 'NEW_REQUEST' ? 'REQUESTED' : row.status === 'ACTIVE' ? 'SERVICE_ACTIVE' : row.status)}`)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  cursor: canViewBookings ? 'pointer' : 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {row.label}
                </span>
                <strong style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {row.count}
                </strong>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* C. Customer Overview & D. Worker Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--space-5)' }}>
        {canViewCustomers && (
          <section style={cardSurfaceStyle} aria-label="Customer Overview">
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} color="var(--color-primary)" />
                  <span>Customer Overview</span>
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Registered households and verification progress
                </p>
              </div>
              <button type="button" onClick={() => navigate('/customers')} style={headerActionBtnStyle}>
                <span>Open Customers</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Customers</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)', marginTop: '2px' }}>
                  {operationsOverview?.customersTotal ?? kpis.totalCustomers ?? '—'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Verified</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#15803d', marginTop: '2px' }}>
                  {operationsOverview?.customersVerified ?? '—'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>Pending KYC</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                  {operationsOverview?.customersPendingVerification ?? '—'}
                </div>
              </div>
            </div>
          </section>
        )}

        {canViewWorkers && (
          <section style={cardSurfaceStyle} aria-label="Worker Overview">
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={16} color="var(--color-primary)" />
                  <span>Worker Overview</span>
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Registration, activation, and active deployment readiness
                </p>
              </div>
              <button type="button" onClick={() => navigate('/workers')} style={headerActionBtnStyle}>
                <span>Open Workers</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Registered</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)', marginTop: '2px' }}>
                  {registeredWorkersVal ?? '—'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Verified &amp; Active</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#15803d', marginTop: '2px' }}>
                  {verifiedAndActiveWorkersVal ?? '—'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>On Active Booking</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#1d4ed8', marginTop: '2px' }}>
                  {operationsOverview?.workersWithActiveBooking ?? '—'}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* E. Unresolved Operational Alerts */}
      {canViewAlerts && (
        <section style={cardSurfaceStyle} aria-label="Operational Alerts">
          <div style={cardHeaderStyle}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} color="#dc2626" />
                <span>Unresolved Operational Alerts ({alertsSection?.open ?? operationsOverview?.openAlertsList?.length ?? 0})</span>
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Latest open SLA and operational exceptions requiring triage
              </p>
            </div>
            <button type="button" onClick={() => setIsAlertsDrawerOpen(true)} style={headerActionBtnStyle}>
              <span>Triage All Alerts</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {alertActionFeedback && (
            <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-status-success-bg)', color: 'var(--color-status-success-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              {alertActionFeedback}
            </div>
          )}
          {alertActionError && (
            <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-status-danger-bg)', color: 'var(--color-status-danger-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              {alertActionError}
            </div>
          )}

          {!operationsOverview?.openAlertsList || operationsOverview.openAlertsList.length === 0 ? (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              No unresolved alerts found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {operationsOverview.openAlertsList.map((alert) => {
                const deepLink = getAlertDeepLink(alert);
                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <StatusBadge status={alert.severity} />
                        <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                          {alert.title}
                        </strong>
                        {alert.occurrences > 1 && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            ×{alert.occurrences}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                        {alert.type} · Created {formatDateTimeIST(alert.createdAt)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {deepLink && (
                        <button
                          type="button"
                          onClick={() => navigate(deepLink)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ExternalLink size={11} />
                          <span>Inspect</span>
                        </button>
                      )}
                      {canManageAlerts && (
                        <>
                          <button
                            type="button"
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: '#fff',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Acknowledge
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAlertActionError(null);
                              setAlertToResolve(alert);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              backgroundColor: 'var(--color-primary)',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={11} />
                            <span>Resolve</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* F. Replacement Overview & G. Support Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--space-5)' }}>
        <section style={cardSurfaceStyle} aria-label="Replacement Overview">
          <div style={cardHeaderStyle}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={16} color="var(--color-primary)" />
                <span>Replacement Overview</span>
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Worker replacement requests and approvals
              </p>
            </div>
            {canViewBookings && (
              <button
                type="button"
                onClick={() => navigate('/bookings?status=REPLACEMENT_REQUESTED')}
                style={headerActionBtnStyle}
              >
                <span>Open Replacements</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>Pending Requested</div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                {sections?.replacements?.requested ?? kpis.replacementRequests ?? 0}
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Approved</div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#15803d', marginTop: '2px' }}>
                {sections?.replacements?.approved ?? 0}
              </div>
            </div>
          </div>
        </section>

        {canViewSupport && (
          <section style={cardSurfaceStyle} aria-label="Support Overview">
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LifeBuoy size={16} color="var(--color-primary)" />
                  <span>Support Overview</span>
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Open, escalated, and unassigned customer support tickets
                </p>
              </div>
              <button type="button" onClick={() => navigate('/support')} style={headerActionBtnStyle}>
                <span>Open Support</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Open</div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {sections?.complaints?.open ?? kpis.openDisputes ?? 0}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: 600 }}>In Progress</div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: '#1d4ed8' }}>
                  {sections?.complaints?.inProgress ?? 0}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600 }}>Escalated</div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: '#dc2626' }}>
                  {sections?.complaints?.escalated ?? 0}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 600 }}>Unassigned</div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: '#b45309' }}>
                  {sections?.complaints?.unassigned ?? 0}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* H. Recent Operational Activity (only when permitted/supported by backend) */}
      <section style={cardSurfaceStyle} aria-label="Recent Operational Activity">
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} color="var(--color-primary)" />
              <span>Recent Operational Activity</span>
            </h2>
          </div>
        </div>

        {operationsOverview?.activityAvailable && operationsOverview.recentActivity && operationsOverview.recentActivity.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {operationsOverview.recentActivity.map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <div>
                  <strong>{act.action}</strong>
                  {act.entityType && ` · ${act.entityType}`}
                  {act.entityId && ` (${act.entityId})`}
                  {act.actorName && ` · ${act.actorName}`}
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>{formatDateTimeIST(act.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {operationsOverview?.activityUnavailableReason ||
              'No dedicated recent operational activity feed is exposed by the backend for this role.'}
          </div>
        )}
      </section>

      <OperationalAlertsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(alertToResolve)}
        title="Resolve Operational Alert"
        description={`Close alert "${alertToResolve?.title || ''}" with an audited resolution note.`}
        confirmLabel="Resolve Alert"
        isDestructive={false}
        requireRemarks={true}
        remarksPlaceholder="Enter resolution note (what action was taken)..."
        isLoading={resolveMutation.isPending}
        errorMessage={alertActionError}
        onConfirm={(note) => {
          if (alertToResolve && note?.trim()) {
            resolveMutation.mutate({ alertId: alertToResolve.id, note: note.trim() });
          }
        }}
        onCancel={() => {
          if (!resolveMutation.isPending) {
            setAlertToResolve(null);
            setAlertActionError(null);
          }
        }}
      />
    </div>
  );
};
