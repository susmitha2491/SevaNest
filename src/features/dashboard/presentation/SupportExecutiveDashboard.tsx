import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LifeBuoy,
  RefreshCw,
  Clock,
  AlertOctagon,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';

export const SupportExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'AT_RISK' | 'UNASSIGNED' | 'MY_CASES' | 'ESCALATED'>('AT_RISK');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'support-exec'],
    queryFn: () => dashboardRepository.getSupportExecutiveDashboard(),
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading Support Operations Console..." />;
  }

  if (isError || !data) {
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

  const { kpis, queues } = data;
  const currentQueue = queues[activeTab] || [];

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

      {/* 5-Card Support Metric Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Open Grievances"
          value={kpis.openUnassignedGrievances}
          subtitle="Unassigned customer/worker tickets"
          icon={LifeBuoy}
          onClick={() => setActiveTab('UNASSIGNED')}
        />
        <KPICard
          title="Assigned to Me"
          value={kpis.myActiveCases}
          subtitle="Active claimed investigation cases"
          icon={UserCheck}
          onClick={() => setActiveTab('MY_CASES')}
        />
        <KPICard
          title="SLA At Risk"
          value={kpis.slaAtRiskCount}
          subtitle="Requires agreed SLA threshold"
          icon={Clock}
          onClick={() => setActiveTab('AT_RISK')}
        />
        <KPICard
          title="SLA Breached"
          value={kpis.slaBreachedCount}
          subtitle="Escalated to management"
          icon={AlertOctagon}
          onClick={() => setActiveTab('AT_RISK')}
        />
        <KPICard
          title="Resolved Today"
          value={kpis.resolvedTodayCount}
          subtitle="Disputes mediated successfully"
          icon={CheckCircle2}
        />
      </div>

      {/* Actionable Support Ticket Workstation Tabs */}
      <div
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
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-app)',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('AT_RISK')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'AT_RISK' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'AT_RISK' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            SLA At Risk & Breached ({queues.AT_RISK.length})
          </button>
          <button
            onClick={() => setActiveTab('UNASSIGNED')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'UNASSIGNED' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'UNASSIGNED' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Unassigned Intake Queue ({queues.UNASSIGNED.length})
          </button>
          <button
            onClick={() => setActiveTab('MY_CASES')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'MY_CASES' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'MY_CASES' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            My Active Cases ({queues.MY_CASES.length})
          </button>
          <button
            onClick={() => setActiveTab('ESCALATED')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'ESCALATED' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'ESCALATED' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Escalated to Operations ({queues.ESCALATED.length})
          </button>
        </div>

        {/* Tab Content Table */}
        <div style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
          {currentQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
              All support queues are clear. Zero unresolved grievance tickets.
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
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Mediation Action</th>
                </tr>
              </thead>
              <tbody>
                {currentQueue.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/support?search=${encodeURIComponent(item.ticketId)}&ticketId=${encodeURIComponent(item.ticketId)}`)}
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
