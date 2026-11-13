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
  ShieldAlert,
  X,
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

interface OperationalAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OperationalAlertsDrawer: React.FC<OperationalAlertsDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManageAlerts = hasPermission(user?.permissions, PERMISSIONS.ALERT_MANAGE);
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
    enabled: isOpen,
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

  if (!isOpen) return null;

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="operational-alerts-title"
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(680px, 100vw)',
          height: '100vh',
          backgroundColor: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <h2 id="operational-alerts-title" style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#dc2626" />
              Operational Alerts Triage Queue
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Live operational exceptions, SLA breaches, and unattended marketplace items ({data?.total ?? 0} total)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh alerts"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: isFetching ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alerts queue"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <CustomSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val as typeof statusFilter);
              setPage(1);
            }}
            options={[
              { value: 'OPEN', label: 'Status: Open Alerts' },
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
        </div>

        {/* Feedback Banners */}
        {(actionFeedback || actionError) && (
          <div style={{ padding: 'var(--space-2) var(--space-5) 0' }}>
            {actionFeedback && (
              <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                {actionFeedback}
              </div>
            )}
            {actionError && (
              <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                {actionError}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {isLoading ? (
            <LoadingSpinner message="Loading live operational alerts..." />
          ) : isError ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-status-danger-text)' }}>
              <AlertTriangle size={28} style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Failed to load alerts</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                {error instanceof Error ? error.message : 'Unable to load alerts from backend.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : !data?.items?.length ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <CheckCircle2 size={32} color="#16a34a" style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>No alerts match the selected filter</div>
              <p style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>All operational alert queues for this view are clear.</p>
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
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
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

                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
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
                          onClick={() => {
                            onClose();
                            navigate(deepLink.path);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-app)',
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
                    <div style={{ fontSize: '11px', color: '#065f46', backgroundColor: '#ecfdf5', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
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
              padding: 'var(--space-3) var(--space-5)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <span>
              Page {data.page} of {data.totalPages} ({data.total} alerts)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: data.page <= 1 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: data.page >= data.totalPages ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Alert Modal */}
      <ConfirmDialog
        isOpen={Boolean(alertToResolve)}
        title="Resolve Operational Alert"
        description={`Close alert "${alertToResolve?.title || ''}" with an audited resolution note.`}
        confirmLabel="Resolve Alert"
        isDestructive={false}
        requireRemarks={true}
        remarksPlaceholder="Enter resolution note (what action was taken)..."
        isLoading={resolveMutation.isPending}
        errorMessage={actionError}
        onConfirm={(note) => {
          if (alertToResolve && note?.trim()) {
            resolveMutation.mutate({ alertId: alertToResolve.id, note: note.trim() });
          }
        }}
        onCancel={() => {
          if (!resolveMutation.isPending) {
            setAlertToResolve(null);
            setActionError(null);
          }
        }}
      />
    </div>
  );
};

