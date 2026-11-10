import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LifeBuoy,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  ArrowUpRight,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

export type SupportDashboardTab =
  | 'ALL'
  | 'UNASSIGNED'
  | 'MY_CASES'
  | 'IN_PROGRESS'
  | 'AT_RISK'
  | 'ESCALATED'
  | 'RESOLVED';

const TABS: { key: SupportDashboardTab; label: string }[] = [
  { key: 'ALL', label: 'All Tickets' },
  { key: 'UNASSIGNED', label: 'Unassigned Intake Queue' },
  { key: 'MY_CASES', label: 'My Active Cases' },
  { key: 'IN_PROGRESS', label: 'In Investigation' },
  { key: 'AT_RISK', label: 'SLA At Risk & Breached' },
  { key: 'ESCALATED', label: 'Escalated to Operations' },
  { key: 'RESOLVED', label: 'Resolved Tickets' },
];

export const SupportExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canViewDashboard = hasPermission(user?.permissions, PERMISSIONS.DASHBOARD_VIEW);
  const [activeTab, setActiveTab] = useState<SupportDashboardTab>('ALL');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'support-exec'],
    queryFn: () => dashboardRepository.getSupportExecutiveDashboard(),
    enabled: canViewDashboard,
  });

  const handleKpiCardClick = (targetTab: SupportDashboardTab) => {
    setActiveTab(targetTab);

    // Smoothly scroll down to the support ticket workstation table ensuring header and tabs remain visible
    const tableEl = document.getElementById('support-workstation-queues');
    if (tableEl) {
      const headerOffset = 80;
      const elementPosition = tableEl.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  };

  const queues = data?.queues;
  const kpis = data?.kpis;

  const tabCounts = useMemo(() => {
    if (!queues || !kpis) {
      return {
        ALL: 0,
        UNASSIGNED: 0,
        MY_CASES: 0,
        IN_PROGRESS: 0,
        AT_RISK: 0,
        ESCALATED: 0,
        RESOLVED: 0,
      };
    }
    const all = queues.ALL || [
      ...(queues.AT_RISK || []),
      ...(queues.UNASSIGNED || []),
      ...(queues.MY_CASES || []),
      ...(queues.ESCALATED || []),
      ...(queues.IN_PROGRESS || []),
      ...(queues.RESOLVED || []),
    ];
    const unassigned = queues.UNASSIGNED || [];
    const myCases = queues.MY_CASES || [];
    const inProgress = queues.IN_PROGRESS || all.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'INVESTIGATION_PENDING' || t.status === 'ASSIGNED');
    const atRisk = queues.AT_RISK || [];
    const escalated = queues.ESCALATED || [];
    const resolved = queues.RESOLVED || all.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');

    return {
      ALL: kpis.totalTickets ?? all.length,
      UNASSIGNED: unassigned.length,
      MY_CASES: myCases.length,
      IN_PROGRESS: inProgress.length,
      AT_RISK: atRisk.length,
      ESCALATED: escalated.length,
      RESOLVED: resolved.length,
    };
  }, [queues, kpis]);

  const currentQueue = useMemo(() => {
    if (!queues) return [];
    switch (activeTab) {
      case 'ALL': {
        if (queues.ALL && queues.ALL.length > 0) return queues.ALL;
        const seen = new Set<string>();
        const list = [
          ...(queues.AT_RISK || []),
          ...(queues.UNASSIGNED || []),
          ...(queues.MY_CASES || []),
          ...(queues.ESCALATED || []),
          ...(queues.IN_PROGRESS || []),
          ...(queues.RESOLVED || []),
        ];
        return list.filter((item) => {
          const key = item.ticketId || item.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      case 'UNASSIGNED':
        return queues.UNASSIGNED || [];
      case 'MY_CASES':
        return queues.MY_CASES || [];
      case 'IN_PROGRESS': {
        if (queues.IN_PROGRESS && queues.IN_PROGRESS.length > 0) return queues.IN_PROGRESS;
        return (queues.ALL || [
          ...(queues.AT_RISK || []),
          ...(queues.UNASSIGNED || []),
          ...(queues.MY_CASES || []),
          ...(queues.ESCALATED || []),
        ]).filter((t) => t.status === 'IN_PROGRESS' || t.status === 'INVESTIGATION_PENDING' || t.status === 'ASSIGNED');
      }
      case 'AT_RISK':
        return queues.AT_RISK || [];
      case 'ESCALATED':
        return queues.ESCALATED || [];
      case 'RESOLVED': {
        if (queues.RESOLVED && queues.RESOLVED.length > 0) return queues.RESOLVED;
        return (queues.ALL || []).filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
      }
      default: {
        if (queues.ALL && queues.ALL.length > 0) return queues.ALL;
        const seen = new Set<string>();
        const list = [
          ...(queues.AT_RISK || []),
          ...(queues.UNASSIGNED || []),
          ...(queues.MY_CASES || []),
          ...(queues.ESCALATED || []),
          ...(queues.IN_PROGRESS || []),
          ...(queues.RESOLVED || []),
        ];
        return list.filter((item) => {
          const key = item.ticketId || item.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }
  }, [queues, activeTab]);

  if (!canViewDashboard) {
    return <NoAccessView moduleName="Support Executive Dashboard" requiredPermission={PERMISSIONS.DASHBOARD_VIEW} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading Support Operations Console..." />;
  }

  if (isError || !data || !kpis || !queues) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Support Console metrics.';

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

  const allQueuesEmpty =
    (queues.AT_RISK?.length || 0) === 0 &&
    (queues.UNASSIGNED?.length || 0) === 0 &&
    (queues.MY_CASES?.length || 0) === 0 &&
    (queues.ESCALATED?.length || 0) === 0 &&
    (queues.ALL?.length || 0) === 0 &&
    (queues.IN_PROGRESS?.length || 0) === 0 &&
    (queues.RESOLVED?.length || 0) === 0;

  const activeTabConfig = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Support Operations Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Grievance mediation, customer/worker dispute resolution, live SLA deadline tracking, and Ops escalation handoffs.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <RefreshCw size={14} color="var(--color-primary)" />
          <span>Refresh Support Queues</span>
        </button>
      </div>

      {/* 7-Card Support Executive Interactive KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Total Tickets"
          value={kpis.totalTickets ?? ((kpis.openUnassignedGrievances ?? 0) + (kpis.myActiveCases ?? 0) + (kpis.resolvedTodayCount ?? 0))}
          subtitle="All active & archived tickets"
          icon={LifeBuoy}
          isSelected={activeTab === 'ALL'}
          onClick={() => handleKpiCardClick('ALL')}
        />
        <KPICard
          title="Unassigned Tickets"
          value={kpis.unassignedTickets ?? kpis.openUnassignedGrievances}
          subtitle="Awaiting staff intake"
          icon={Inbox}
          isSelected={activeTab === 'UNASSIGNED'}
          onClick={() => handleKpiCardClick('UNASSIGNED')}
        />
        <KPICard
          title="My Assigned Tickets"
          value={kpis.myAssignedTickets ?? kpis.myActiveCases}
          subtitle="Assigned to current executive"
          icon={UserCheck}
          isSelected={activeTab === 'MY_CASES'}
          onClick={() => handleKpiCardClick('MY_CASES')}
        />
        <KPICard
          title="In Progress"
          value={kpis.inProgressTickets ?? kpis.myActiveCases}
          subtitle="Active case investigations"
          icon={Clock}
          isSelected={activeTab === 'IN_PROGRESS'}
          onClick={() => handleKpiCardClick('IN_PROGRESS')}
        />
        <KPICard
          title="SLA Imminent Breach"
          value={kpis.slaImminentBreach ?? kpis.slaAtRiskCount}
          subtitle="Impending SLA deadline"
          icon={AlertTriangle}
          isSelected={activeTab === 'AT_RISK'}
          onClick={() => handleKpiCardClick('AT_RISK')}
        />
        <KPICard
          title="Escalated Tickets"
          value={kpis.escalatedTickets ?? kpis.slaBreachedCount}
          subtitle="Handoff to Operations"
          icon={ShieldAlert}
          isSelected={activeTab === 'ESCALATED'}
          onClick={() => handleKpiCardClick('ESCALATED')}
        />
        <KPICard
          title="Resolved Tickets"
          value={kpis.resolvedTickets ?? kpis.resolvedTodayCount}
          subtitle="Completed settlements"
          icon={CheckCircle2}
          isSelected={activeTab === 'RESOLVED'}
          onClick={() => handleKpiCardClick('RESOLVED')}
        />
      </div>

      {/* Actionable Support Ticket Workstation Tabs */}
      <div
        id="support-workstation-queues"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Tab Headers */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {TABS.map((tab) => {
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 14px',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Tab Content Table */}
        <div style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
          {currentQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
              {allQueuesEmpty ? (
                'All support queues are clear. Zero unresolved grievance tickets.'
              ) : (
                `No tickets currently in ${activeTabConfig.label}. All records are clear.`
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                  <th style={{ padding: '8px 12px' }}>Ticket ID</th>
                  <th style={{ padding: '8px 12px' }}>Complainant</th>
                  <th style={{ padding: '8px 12px' }}>Service Category</th>
                  <th style={{ padding: '8px 12px' }}>Dispute Category</th>
                  <th style={{ padding: '8px 12px' }}>SLA Indicator</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Ticket Owner</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Mediation Action</th>
                </tr>
              </thead>
              <tbody>
                {currentQueue.map((item) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open mediation for ticket ${item.ticketId}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      navigate(`/support/tickets?search=${encodeURIComponent(item.ticketId)}&ticketId=${encodeURIComponent(item.ticketId)}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        navigate(`/support/tickets?search=${encodeURIComponent(item.ticketId)}&ticketId=${encodeURIComponent(item.ticketId)}`);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.ticketId}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.complainantName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Role: {item.roleType}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{item.category}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{item.disputeCategory}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          backgroundColor:
                            item.slaIndicator === 'BREACHED'
                              ? 'var(--color-status-danger-bg)'
                              : item.slaIndicator === 'AT_RISK'
                              ? 'var(--color-status-warning-bg)'
                              : 'var(--color-status-success-bg)',
                          border: `1px solid ${
                            item.slaIndicator === 'BREACHED'
                              ? 'var(--color-status-danger-border)'
                              : item.slaIndicator === 'AT_RISK'
                              ? 'var(--color-status-warning-border)'
                              : 'var(--color-status-success-border)'
                          }`,
                          color:
                            item.slaIndicator === 'BREACHED'
                              ? 'var(--color-status-danger-text)'
                              : item.slaIndicator === 'AT_RISK'
                              ? 'var(--color-status-warning-text)'
                              : 'var(--color-status-success-text)',
                        }}
                      >
                        {item.slaIndicator}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-size-xs)' }}>
                      {item.ticketOwner ? (
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.ticketOwner}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/support/tickets?search=${encodeURIComponent(item.ticketId)}&ticketId=${encodeURIComponent(item.ticketId)}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-primary-subtle)',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                        }}
                      >
                        {activeTab === 'ESCALATED' ? <ArrowUpRight size={14} /> : <LifeBuoy size={14} />}
                        <span>{item.actionLabel}</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
