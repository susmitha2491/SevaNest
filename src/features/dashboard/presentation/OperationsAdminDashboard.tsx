import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Users,
  RefreshCw,
  LifeBuoy,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  ArrowRight,
  UserCheck,
  User,
  Briefcase,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { OperationsQueueTab } from '../domain/types';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';

export const OperationsAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OperationsQueueTab>('NEW_REQUESTS');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'operations-admin'],
    queryFn: () => dashboardRepository.getOperationsAdminDashboard(),
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading Operations Command Console..." />;
  }

  if (isError || !data) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Operations Console metrics.';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Operations Command Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Marketplace supply matching, candidate shortlisting, interview trials, replacement dispatch, and refund review.
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
          <span>Refresh Operations</span>
        </button>
      </div>

      {/* 12-Card Complete Operations KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Total Customers"
          value={kpis.totalCustomers}
          subtitle="Registered households"
          icon={User}
          onClick={() => navigate('/customers')}
        />
        <KPICard
          title="Available Workforce"
          value={kpis.totalWorkers}
          subtitle="Total Workers registered"
          icon={Briefcase}
          onClick={() => navigate('/workers')}
        />
        <KPICard
          title="New Requests"
          value={kpis.newBookingRequests}
          subtitle="Awaiting candidate matching"
          icon={CalendarCheck}
          onClick={() => setActiveTab('NEW_REQUESTS')}
        />
        <KPICard
          title="Awaiting Matching"
          value={kpis.bookingsAwaitingMatching}
          subtitle="In shortlisting workflow"
          icon={UserCheck}
          onClick={() => setActiveTab('MATCHING')}
        />
        <KPICard
          title="Today's Trials"
          value={kpis.scheduledTrialsToday}
          subtitle="Scheduled interviews & trials"
          icon={CheckCircle2}
          onClick={() => setActiveTab('TRIALS')}
        />
        <KPICard
          title="Awaiting Confirmation"
          value={kpis.bookingsAwaitingConfirmation}
          subtitle="Post-trial customer decisions"
          icon={Clock}
          onClick={() => setActiveTab('CONFIRMATIONS')}
        />
        <KPICard
          title="Active Engagements"
          value={kpis.activeLiveEngagements}
          subtitle="Live recurring household service"
          icon={Users}
          onClick={() => setActiveTab('ACTIVE_SERVICES')}
        />
        <KPICard
          title="Replacement Queue"
          value={kpis.replacementRequests}
          subtitle="Urgent household rematching"
          icon={RefreshCw}
          onClick={() => setActiveTab('REPLACEMENTS')}
        />
        <KPICard
          title="Pending Verification"
          value={kpis.pendingVerificationCases}
          subtitle="Cases under trust review"
          icon={ShieldCheck}
          onClick={() => navigate('/verification')}
        />
        <KPICard
          title="Open Disputes"
          value={kpis.openDisputes}
          subtitle="Escalated customer grievances"
          icon={LifeBuoy}
          onClick={() => setActiveTab('SUPPORT_HANDOFFS')}
        />
        <KPICard
          title="Pending Refunds"
          value={kpis.pendingRefunds}
          subtitle="Awaiting Ops authorization"
          icon={DollarSign}
          onClick={() => setActiveTab('REFUNDS')}
        />
        <KPICard
          title="Police Verif Alert"
          value={kpis.expiringVerifications}
          subtitle="Impending expiry action"
          icon={AlertCircle}
          onClick={() => setActiveTab('FOLLOW_UPS')}
        />
      </div>

      {/* Action-Oriented Operational Workstation Tabs */}
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
          {(
            [
              { key: 'NEW_REQUESTS', label: 'New Booking Requests', count: queues.NEW_REQUESTS?.length || 0 },
              { key: 'MATCHING', label: 'Awaiting Matching', count: queues.MATCHING?.length || 0 },
              { key: 'TRIALS', label: 'Scheduled Trials', count: queues.TRIALS?.length || 0 },
              { key: 'CONFIRMATIONS', label: 'Awaiting Confirmation', count: queues.CONFIRMATIONS?.length || 0 },
              { key: 'ACTIVE_SERVICES', label: 'Active Engagements', count: queues.ACTIVE_SERVICES?.length || 0 },
              { key: 'REPLACEMENTS', label: 'Urgent Replacements', count: queues.REPLACEMENTS?.length || 0 },
              { key: 'REFUNDS', label: 'Refund Authorizations', count: queues.REFUNDS?.length || 0 },
              { key: 'FOLLOW_UPS', label: 'Operational Follow-up', count: queues.FOLLOW_UPS?.length || 0 },
              { key: 'SUPPORT_HANDOFFS', label: 'Support Handoffs', count: queues.SUPPORT_HANDOFFS?.length || 0 },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tab Content Table */}
        <div style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
          {currentQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
              All items in this operational queue are cleared. Zero backlog.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                  <th style={{ padding: '8px 12px' }}>Record Ref</th>
                  <th style={{ padding: '8px 12px' }}>Customer Name</th>
                  <th style={{ padding: '8px 12px' }}>Service Category</th>
                  <th style={{ padding: '8px 12px' }}>Locality</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Timeline</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Dominant Action</th>
                </tr>
              </thead>
              <tbody>
                {currentQueue.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.id}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{item.customerName}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{item.category}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{item.locality}</td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>{item.submissionTime}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(item.targetRoute)}
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
                        <span>{item.dominantAction}</span>
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
