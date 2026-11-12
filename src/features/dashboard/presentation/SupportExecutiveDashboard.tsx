import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Inbox,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { dashboardRepository } from '../data/dashboardRepository';
import {
  SupportActivityType,
  SupportRecentActivityItem,
} from '../domain/types';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { DonutChart } from './analytics/charts/DonutChart';
import { HorizontalBarChart } from './analytics/charts/HorizontalBarChart';
import { formatRegistrationDateIST } from '../../../shared/formatters/dateTime';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { ConcurrencyConflictError } from '../../../core/errors/DomainError';
import { supportRepository } from '../../support/data/supportRepository';
import { SupportTicketDetail } from '../../support/domain/types';
import { TicketDetailModal } from '../../support/presentation/TicketDetailModal';

const cardSurfaceStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  boxShadow: 'var(--shadow-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  minWidth: 0,
};

function getActivityBadgeStyle(type: SupportActivityType): {
  bg: string;
  border: string;
  text: string;
} {
  switch (type) {
    case 'RESOLVED':
      return {
        bg: 'var(--color-status-success-bg)',
        border: 'var(--color-status-success-border)',
        text: 'var(--color-status-success-text)',
      };
    case 'ESCALATED':
      return {
        bg: 'var(--color-status-danger-bg)',
        border: 'var(--color-status-danger-border)',
        text: 'var(--color-status-danger-text)',
      };
    case 'UPDATED':
      return {
        bg: 'var(--color-status-warning-bg)',
        border: 'var(--color-status-warning-border)',
        text: 'var(--color-status-warning-text)',
      };
    case 'CREATED':
    default:
      return {
        bg: 'var(--color-status-info-bg)',
        border: 'var(--color-status-info-border)',
        text: 'var(--color-status-info-text)',
      };
  }
}

export const SupportExecutiveDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canViewDashboard = hasPermission(user?.permissions, PERMISSIONS.DASHBOARD_VIEW);

  const [selectedActivity, setSelectedActivity] = useState<SupportRecentActivityItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionTicket, setActionTicket] = useState<SupportTicketDetail | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [escalateError, setEscalateError] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'support-exec'],
    queryFn: () => dashboardRepository.getSupportExecutiveDashboard(),
    enabled: canViewDashboard,
  });

  const { data: fetchedTicketDetail } = useQuery({
    queryKey: ['support', 'ticket', selectedActivity?.ticketId],
    queryFn: async () => {
      if (!selectedActivity?.ticketId) return null;
      try {
        return await supportRepository.getTicketById(selectedActivity.ticketId);
      } catch {
        return null;
      }
    },
    enabled: (isDetailOpen || isResolveOpen || isEscalateOpen) && Boolean(selectedActivity?.ticketId),
  });

  const fallbackTicket = useMemo<SupportTicketDetail | null>(() => {
    if (!selectedActivity) return null;
    return {
      id: selectedActivity.ticketId,
      etag: selectedActivity.etag,
      complainantId: '',
      complainantName: selectedActivity.complainantName,
      complainantType: selectedActivity.roleType,
      complainantPhoneMasked: '—',
      serviceCategory: selectedActivity.category,
      disputeCategory: selectedActivity.disputeCategory as SupportTicketDetail['disputeCategory'],
      description: '',
      priority: 'MEDIUM',
      slaStatus: selectedActivity.slaIndicator,
      status: selectedActivity.status as SupportTicketDetail['status'],
      createdAt: selectedActivity.timestamp || '',
      caseNotes: [],
    };
  }, [selectedActivity]);

  const activeTicket = fetchedTicketDetail || fallbackTicket;

  const resolveMutation = useMutation({
    mutationFn: async ({ ticketId, remarks, etag }: { ticketId: string; remarks: string; etag?: string }) => {
      await supportRepository.resolveTicket(ticketId, remarks, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsResolveOpen(false);
      setActionTicket(null);
      setSelectedActivity(null);
      setResolveError(null);
    },
    onError: (err: unknown) => {
      if (
        err instanceof ConcurrencyConflictError ||
        (err as { statusCode?: number })?.statusCode === 412 ||
        (err as { statusCode?: number })?.statusCode === 428
      ) {
        setResolveError('Ticket was modified by another transaction. Please refresh and retry.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        setResolveError((err as Error)?.message || 'Failed to resolve grievance. Please try again.');
      }
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ ticketId, rationale, etag }: { ticketId: string; rationale: string; etag?: string }) => {
      await supportRepository.escalateToOperations(ticketId, rationale, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsEscalateOpen(false);
      setActionTicket(null);
      setSelectedActivity(null);
      setEscalateError(null);
    },
    onError: (err: unknown) => {
      if (
        err instanceof ConcurrencyConflictError ||
        (err as { statusCode?: number })?.statusCode === 412 ||
        (err as { statusCode?: number })?.statusCode === 428
      ) {
        setEscalateError('Ticket was modified by another transaction. Please refresh and retry.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        setEscalateError((err as Error)?.message || 'Failed to escalate ticket. Please try again.');
      }
    },
  });

  const handleOpenActivity = (item: SupportRecentActivityItem) => {
    setSelectedActivity(item);
    setIsDetailOpen(true);
  };

  if (!canViewDashboard) {
    return <NoAccessView moduleName="Support Executive Dashboard" requiredPermission={PERMISSIONS.DASHBOARD_VIEW} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading Support Dashboard..." />;
  }

  if (isError || !data || !data.kpis || !data.queues) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Support Dashboard metrics.';

    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          {errorMessage}
        </p>
        <button
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

  const { kpis, queues, analytics } = data;

  const openTicketsVal =
    analytics?.openTickets !== undefined
      ? analytics.openTickets
      : kpis.unassignedTickets ?? kpis.openUnassignedGrievances ?? null;
  const inInvestigationVal =
    analytics?.inInvestigationTickets !== undefined
      ? analytics.inInvestigationTickets
      : kpis.inProgressTickets ?? kpis.myActiveCases ?? null;
  const escalatedVal =
    analytics?.escalatedTickets !== undefined
      ? analytics.escalatedTickets
      : kpis.escalatedTickets ?? null;
  const resolvedVal =
    analytics?.resolvedTickets !== undefined
      ? analytics.resolvedTickets
      : kpis.resolvedTickets ?? kpis.resolvedTodayCount ?? null;
  const totalTicketsVal = kpis.totalTickets ?? null;
  const slaAtRiskOrBreachedVal =
    analytics?.slaAtRiskOrBreached !== undefined
      ? analytics.slaAtRiskOrBreached
      : kpis.slaImminentBreach != null && kpis.slaBreachedCount != null
        ? kpis.slaImminentBreach + kpis.slaBreachedCount
        : kpis.slaAtRiskCount != null && kpis.slaBreachedCount != null
          ? kpis.slaAtRiskCount + kpis.slaBreachedCount
          : null;

  const statusDistribution = analytics?.statusDistribution || [
    { status: 'OPEN', label: 'Open', count: openTicketsVal ?? 0, color: '#3B82F6' },
    { status: 'IN_INVESTIGATION', label: 'In Investigation', count: inInvestigationVal ?? 0, color: '#D97706' },
    { status: 'ESCALATED', label: 'Escalated', count: escalatedVal ?? 0, color: '#DC2626' },
    { status: 'RESOLVED', label: 'Resolved', count: resolvedVal ?? 0, color: '#16A34A' },
  ];

  const statusTotal = statusDistribution.reduce((sum, s) => sum + s.count, 0);

  const slaMonitoring = analytics?.slaMonitoring ?? null;
  const slaBarItems = slaMonitoring
    ? [
      {
        id: 'NORMAL',
        title: 'Normal',
        subtitle: 'Within SLA target',
        value: slaMonitoring.normal,
        formattedValue: `${slaMonitoring.normal} ticket${slaMonitoring.normal === 1 ? '' : 's'}`,
        color: 'var(--color-success)',
      },
      {
        id: 'AT_RISK',
        title: 'At Risk',
        subtitle: 'Deadline within 24h',
        value: slaMonitoring.atRisk,
        formattedValue: `${slaMonitoring.atRisk} ticket${slaMonitoring.atRisk === 1 ? '' : 's'}`,
        color: 'var(--color-warning)',
      },
      {
        id: 'BREACHED',
        title: 'Breached',
        subtitle: 'SLA target exceeded',
        value: slaMonitoring.breached,
        formattedValue: `${slaMonitoring.breached} ticket${slaMonitoring.breached === 1 ? '' : 's'}`,
        color: 'var(--color-error)',
      },
    ]
    : [];

  const recentActivity: SupportRecentActivityItem[] =
    analytics?.recentActivity ??
    (queues.ALL || [
      ...(queues.AT_RISK || []),
      ...(queues.UNASSIGNED || []),
      ...(queues.MY_CASES || []),
      ...(queues.ESCALATED || []),
    ])
      .slice(0, 8)
      .map((q) => {
        const st = q.status.toUpperCase();
        const activityType: SupportActivityType =
          st === 'RESOLVED' || st === 'CLOSED'
            ? 'RESOLVED'
            : st === 'ESCALATED' || st === 'REPLACEMENT_INITIATED'
              ? 'ESCALATED'
              : st === 'OPEN' || st === 'CREATED'
                ? 'CREATED'
                : 'UPDATED';
        const activityLabel =
          activityType === 'RESOLVED'
            ? 'Ticket Resolved'
            : activityType === 'ESCALATED'
              ? 'Ticket Escalated'
              : activityType === 'CREATED'
                ? 'Ticket Created'
                : 'Ticket Updated';
        return {
          id: q.id,
          ticketId: q.ticketId,
          activityType,
          activityLabel,
          timestamp: '',
          status: q.status,
          complainantName: q.complainantName,
          roleType: q.roleType,
          category: q.category,
          disputeCategory: q.disputeCategory,
          slaIndicator: q.slaIndicator,
        };
      });

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
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Support operations overview and ticket monitoring.
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

      {/* 2. KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Total Tickets"
          value={totalTicketsVal}
          subtitle="All recorded tickets"
          icon={LifeBuoy}
        />
        <KPICard
          title="Open Tickets"
          value={openTicketsVal}
          subtitle="Awaiting triage"
          icon={Inbox}
        />
        <KPICard
          title="In Investigation"
          value={inInvestigationVal}
          subtitle="Active investigations"
          icon={Clock}
        />
        <KPICard
          title="Escalated Tickets"
          value={escalatedVal}
          subtitle="Handed off to Operations"
          icon={ShieldAlert}
        />
        <KPICard
          title="Resolved Tickets"
          value={resolvedVal}
          subtitle="Closed & resolved cases"
          icon={CheckCircle2}
        />
        <KPICard
          title="SLA At Risk / Breached"
          value={slaAtRiskOrBreachedVal}
          subtitle="Urgent SLA attention"
          icon={AlertTriangle}
        />
      </div>

      {/* 3 & 4. Ticket Status Distribution + SLA Monitoring */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {/* 3. Ticket Status Distribution */}
        <section style={cardSurfaceStyle} aria-label="Ticket Status Distribution">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                Ticket Status Distribution
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Breakdown of support tickets by current workflow stage
              </p>
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {statusTotal} Total
            </span>
          </div>

          <DonutChart
            segments={statusDistribution.map((s) => ({
              id: s.status,
              label: s.label,
              value: s.count,
              color: s.color,
            }))}
            centerLabel="Total Tickets"
            emptyMessage="No ticket records recorded in status distribution"
            ariaLabel="Ticket Status Distribution Doughnut Chart"
          />
        </section>

        {/* 4. SLA Monitoring */}
        <section style={cardSurfaceStyle} aria-label="SLA Monitoring">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                SLA Monitoring
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Normal, At Risk, and Breached tickets from backend SLA tracking
              </p>
            </div>
            {slaMonitoring && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    slaMonitoring.breached > 0
                      ? 'var(--color-status-danger-bg)'
                      : 'var(--color-bg-app)',
                  border: `1px solid ${slaMonitoring.breached > 0
                      ? 'var(--color-status-danger-border)'
                      : 'var(--color-border)'
                    }`,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color:
                    slaMonitoring.breached > 0
                      ? 'var(--color-status-danger-text)'
                      : 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {slaMonitoring.atRisk + slaMonitoring.breached} Attention
              </span>
            )}
          </div>

          <HorizontalBarChart
            items={slaBarItems}
            showRank={false}
            maxItems={3}
            emptyMessage="SLA breakdown unavailable from current backend response"
            ariaLabel="SLA Monitoring Chart"
          />
        </section>
      </div>

      {/* 5. Recent Support Activity */}
      <section style={cardSurfaceStyle} aria-label="Recent Support Activity">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Recent Support Activity
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Recently created, updated, escalated, and resolved tickets
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Activity size={12} />
            <span>{recentActivity.length} Recent</span>
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border)',
            }}
          >
            No recent support ticket activity recorded.
          </div>
        ) : (
          <div role="list" aria-label="Recent support activity list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {recentActivity.map((item) => {
              const badgeStyle = getActivityBadgeStyle(item.activityType);
              return (
                <div key={`${item.id}-${item.activityType}`} role="listitem">
                  <button
                    type="button"
                    onClick={() => handleOpenActivity(item)}
                    aria-label={`Open ticket ${item.ticketId} (${item.activityLabel})`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-app)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            color: 'var(--color-navy)',
                            fontFamily: 'var(--font-mono, monospace)',
                            wordBreak: 'break-all',
                          }}
                        >
                          {item.ticketId}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: badgeStyle.bg,
                            border: `1px solid ${badgeStyle.border}`,
                            color: badgeStyle.text,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.activityLabel}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {item.timestamp ? formatRegistrationDateIST(item.timestamp) : 'Timestamp unavailable'}
                      </span>
                    </div>

                    <ArrowRight size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Ticket Chat & Details Modal (opened directly within Dashboard context) */}
      <TicketDetailModal
        ticket={activeTicket}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedActivity(null);
        }}
        onOpenResolve={(tkt) => {
          setIsDetailOpen(false);
          setActionTicket(tkt);
          setResolveError(null);
          setIsResolveOpen(true);
        }}
        onOpenEscalate={(tkt) => {
          setIsDetailOpen(false);
          setActionTicket(tkt);
          setEscalateError(null);
          setIsEscalateOpen(true);
        }}
      />

      {/* Resolve Grievance Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResolveOpen}
        title="Resolve Grievance"
        description="Describe how the complaint was addressed and what resolution was communicated to the customer or worker."
        confirmLabel="Confirm & Close Ticket"
        remarksLabel="Resolution Summary"
        requireRemarks={true}
        remarksPlaceholder="Enter resolution summary notes (e.g., Worker arrived with customer consent, mediation successful)..."
        isLoading={resolveMutation.isPending}
        errorMessage={resolveError}
        onConfirm={(remarks) => {
          const trimmedRemarks = remarks?.trim();
          if (actionTicket && trimmedRemarks) {
            setResolveError(null);
            resolveMutation.mutate({
              ticketId: actionTicket.id,
              remarks: trimmedRemarks,
              etag: activeTicket?.etag || actionTicket.etag,
            });
          }
        }}
        onCancel={() => {
          setIsResolveOpen(false);
          setActionTicket(null);
          setSelectedActivity(null);
          setResolveError(null);
        }}
      />

      {/* Escalate to Operations Dialog */}
      <ConfirmDialog
        isOpen={isEscalateOpen}
        title={`Escalate Ticket ${actionTicket?.id} to Operations`}
        description="Escalate this grievance to Operations Admins for replacement rematching, financial refund review, or disciplinary arbitration."
        confirmLabel="Escalate to Operations"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory escalation rationale for Operations Admin..."
        isLoading={escalateMutation.isPending}
        errorMessage={escalateError}
        onConfirm={(remarks) => {
          const trimmedRemarks = remarks?.trim();
          if (actionTicket && trimmedRemarks) {
            setEscalateError(null);
            escalateMutation.mutate({
              ticketId: actionTicket.id,
              rationale: trimmedRemarks,
              etag: activeTicket?.etag || actionTicket.etag,
            });
          }
        }}
        onCancel={() => {
          setIsEscalateOpen(false);
          setActionTicket(null);
          setSelectedActivity(null);
          setEscalateError(null);
        }}
      />
    </div>
  );
};
