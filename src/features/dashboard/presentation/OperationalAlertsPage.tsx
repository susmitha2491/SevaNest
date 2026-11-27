import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { dashboardRepository } from '../data/dashboardRepository';
import { OperationalAlertItem } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';

export const OperationalAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const canViewAlerts = !user || hasPermission(user.permissions, PERMISSIONS.ALERT_VIEW);
  const canManageAlerts = Boolean(user && hasPermission(user.permissions, PERMISSIONS.ALERT_MANAGE));
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);
  const canViewSupport = hasPermission(user?.permissions, PERMISSIONS.SUPPORT_VIEW);
  const canViewWorkers = hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const canViewPayments = hasPermission(user?.permissions, PERMISSIONS.PAYMENTS_VIEW);

  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL'>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [page, setPage] = useState(1);
  const [alertToResolve, setAlertToResolve] = useState<OperationalAlertItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'alerts', statusFilter, severityFilter, page],
    queryFn: async () => {
      if (!dashboardRepository.getOperationalAlerts) {
        return { items: [], total: 0, page: 1, limit: 15, totalPages: 1 };
      }
      return dashboardRepository.getOperationalAlerts({
        status: statusFilter,
        severity: severityFilter,
        page,
        limit: 15,
      });
    },
    enabled: canViewAlerts,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      if (!dashboardRepository.acknowledgeAlert) return;
      await dashboardRepository.acknowledgeAlert(alertId);
    },
    onSuccess: () => {
      setActionError(null);
      setActionFeedback('Alert acknowledged.');
      invalidateAll();
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Unable to acknowledge alert.');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, note }: { alertId: string; note: string }) => {
      if (!dashboardRepository.resolveAlert) return;
      await dashboardRepository.resolveAlert(alertId, note);
    },
    onSuccess: () => {
      setAlertToResolve(null);
      setActionError(null);
      setActionFeedback('Alert resolved and recorded.');
      invalidateAll();
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Unable to resolve alert.');
    },
  });

  if (!canViewAlerts) {
    return <NoAccessView moduleName="Operational Alerts & SLA Exceptions" requiredPermission={PERMISSIONS.ALERT_VIEW} />;
  }

  const getEntityRoute = (alert: OperationalAlertItem): { label: string; path: string } | null => {
    const entityType = (alert.entityType || '').toLowerCase();
    const id = alert.entityId || '';
    if (!id) return null;
    if (entityType.includes('booking') && canViewBookings) {
      return { label: 'Open Booking', path: `/bookings?search=${encodeURIComponent(id)}` };
    }
    if (entityType.includes('ticket') && canViewSupport) {
      return { label: 'Open Ticket', path: `/support?ticketId=${encodeURIComponent(id)}` };
    }
    if (entityType.includes('worker') && canViewWorkers) {
      return { label: 'Open Worker', path: `/workers?workerId=${encodeURIComponent(id)}` };
    }
    if (entityType.includes('payment') && canViewPayments) {
      return { label: 'Open Payment', path: `/payments?search=${encodeURIComponent(id)}` };
    }
    return null;
  };

  const isFiltered = statusFilter !== 'OPEN' || severityFilter !== 'ALL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Back to Dashboard Navigation Button */}
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          cursor: 'pointer',
          width: 'fit-content',
          marginBottom: 'var(--space-1)',
          boxShadow: 'var(--shadow-sm)',
        }}
        aria-label="Back to Dashboard"
      >
        <ChevronLeft size={14} />
        <span>Back to Dashboard</span>
      </button>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={24} color="#dc2626" />
            <h1
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 700,
                color: 'var(--color-navy)',
                margin: 0,
              }}
            >
              Operational Alerts Triage Queue
            </h1>
          </div>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-1)',
              marginBottom: 0,
            }}
          >
            Live marketplace exceptions, service SLA breaches, and operations triage workstation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
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
          <RefreshCw size={14} color="var(--color-primary)" className={isFetching ? 'animate-spin' : ''} />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Filter Bar with Reset Filters Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '10px 14px',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
        }}
      >
        <CustomSelect
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val as typeof statusFilter);
            setPage(1);
          }}
          options={[
            { value: 'OPEN', label: 'Status: Open' },
            { value: 'ACKNOWLEDGED', label: 'Status: Acknowledged' },
            { value: 'RESOLVED', label: 'Status: Resolved' },
            { value: 'ALL', label: 'Status: All' },
          ]}
          ariaLabel="Filter alerts by status"
          minWidth="170px"
        />

        <CustomSelect
          value={severityFilter}
          onChange={(val) => {
            setSeverityFilter(val as typeof severityFilter);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Severity: All' },
            { value: 'CRITICAL', label: 'Severity: Critical' },
            { value: 'WARNING', label: 'Severity: Warning' },
            { value: 'INFO', label: 'Severity: Info' },
          ]}
          ariaLabel="Filter alerts by severity"
          minWidth="150px"
        />

        {isFiltered && (
          <button
            type="button"
            data-testid="alerts-page-reset-filters-btn"
            onClick={() => {
              setStatusFilter('OPEN');
              setSeverityFilter('ALL');
              setPage(1);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Reset alerts filters to default (Status: Open, Severity: All)"
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {data ? `Showing ${data.items.length} of ${data.total} alerts` : 'Loading alerts...'}
        </div>
      </div>

      {/* Feedback Banners */}
      {(actionFeedback || actionError) && (
        <div>
          {actionFeedback && (
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {actionFeedback}
            </div>
          )}
          {actionError && (
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {actionError}
            </div>
          )}
        </div>
      )}

      {/* Alerts Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {isLoading ? (
          <LoadingSpinner message="Loading operational alerts queue..." />
        ) : isError ? (
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <AlertTriangle size={32} color="#dc2626" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Failed to load alerts
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              {error instanceof Error ? error.message : 'Unable to load alerts from backend.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : !data?.items?.length ? (
          <div
            style={{
              padding: 'var(--space-8)',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <CheckCircle2 size={36} color="#16a34a" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No operational alerts match the selected criteria
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              All alert queues for this view are currently clear.
            </p>
          </div>
        ) : (
          data.items.map((alert) => {
            const deepLink = getEntityRoute(alert);
            const severityColor =
              alert.severity === 'CRITICAL'
                ? { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
                : alert.severity === 'WARNING'
                ? { bg: '#fffbeb', border: '#fde68a', text: '#b45309' }
                : { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };

            return (
              <div
                key={alert.id}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: severityColor.bg,
                        border: `1px solid ${severityColor.border}`,
                        color: severityColor.text,
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                    {alert.occurrences > 1 && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        ({alert.occurrences}x)
                      </span>
                    )}
                  </div>
                  <StatusBadge status={alert.status} />
                </div>

                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  {alert.title}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span>
                    Detected: {alert.createdAt ? formatDateTimeIST(alert.createdAt) : 'Recent'}
                    {alert.entityId ? ` · Ref: ${alert.entityId}` : ''}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {deepLink && (
                      <button
                        type="button"
                        onClick={() => navigate(deepLink.path)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{deepLink.label}</span>
                        <ExternalLink size={11} />
                      </button>
                    )}

                    {canManageAlerts && alert.status === 'OPEN' && (
                      <button
                        type="button"
                        disabled={acknowledgeMutation.isPending}
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-brand-500)',
                          backgroundColor: 'var(--color-brand-50)',
                          color: 'var(--color-brand-700)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: acknowledgeMutation.isPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Acknowledge
                      </button>
                    )}

                    {canManageAlerts && alert.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null);
                          setAlertToResolve(alert);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: 'none',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>

                {alert.resolutionNote && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#065f46',
                      backgroundColor: '#ecfdf5',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Resolution Note: {alert.resolutionNote}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {data && data.totalPages > 1 && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>
            Page {data.page} of {data.totalPages} ({data.total} total)
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-app)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-app)',
                cursor: page >= data.totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= data.totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Resolve Alert Confirmation Dialog with Operational Note */}
      {alertToResolve && (
        <ConfirmDialog
          isOpen={true}
          title="Resolve Operational Alert"
          description={`Please provide an operational resolution note for alert: "${alertToResolve.title}". This action will mark the alert resolved in backend event logs.`}
          confirmLabel="Mark Resolved"
          isDestructive={false}
          requireRemarks={true}
          remarksPlaceholder="Enter corrective action or reason for resolution (required)..."
          isLoading={resolveMutation.isPending}
          errorMessage={actionError}
          onConfirm={(note) => {
            if (!note?.trim()) {
              setActionError('Resolution note is required.');
              return;
            }
            resolveMutation.mutate({ alertId: alertToResolve.id, note: note.trim() });
          }}
          onCancel={() => {
            setAlertToResolve(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
};

export default OperationalAlertsPage;
