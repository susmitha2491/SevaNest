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
  Info,
  TrendingUp,
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

  const { kpis, queues, sections } = data;
  const currentQueue = queues[activeTab] || [];

  const getBookingCount = (statusKey: string, fallback: number = 0) => {
    const item = sections?.bookings?.byStatus?.find((s) => s.status === statusKey);
    return item ? item.count : fallback;
  };

  const newRequestsCount = getBookingCount('REQUESTED', kpis.newBookingRequests);
  const matchingCount = getBookingCount('MATCHING_IN_PROGRESS', kpis.bookingsAwaitingMatching);
  const trialsCount = getBookingCount('INTERVIEW_SCHEDULED', kpis.scheduledTrialsToday);
  const confirmedCount = getBookingCount('CONFIRMED', kpis.bookingsAwaitingConfirmation);
  const activeCount = getBookingCount('SERVICE_ACTIVE', kpis.activeLiveEngagements);
  const completedCount = getBookingCount('COMPLETED', 0);
  const cancelledCount = getBookingCount('CANCELLED', 0);
  const replacementCount = getBookingCount('REPLACEMENT_REQUESTED', kpis.replacementRequests);

  const collections = sections?.collections;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Operations Command Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Operational overview of marketplace customer demand, workforce supply, verification progress, and booking lifecycles.
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

      {/* Operational Visualizations: Booking Status & Lifecycle Overview */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <TrendingUp size={20} color="var(--color-primary)" />
              <span>Booking Status Overview & Lifecycle Summary</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Real-time operational distribution across key booking states. Click any stage to inspect relevant records.
            </p>
          </div>
          <button
            onClick={() => navigate('/bookings')}
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
            <span>View All Bookings</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {[
            { label: 'New Intake', count: newRequestsCount, statusKey: 'REQUESTED', route: '/bookings?status=REQUESTED', color: 'var(--color-brand-600)' },
            { label: 'Shortlisting Pool', count: matchingCount, statusKey: 'MATCHING_IN_PROGRESS', route: '/bookings?status=MATCHING_IN_PROGRESS', color: '#6366f1' },
            { label: 'Trials & Interviews', count: trialsCount, statusKey: 'INTERVIEW_SCHEDULED', route: '/bookings?status=INTERVIEW_SCHEDULED', color: '#0ea5e9' },
            { label: 'Trial Confirmed', count: confirmedCount, statusKey: 'CONFIRMED', route: '/bookings?status=CONFIRMED', color: '#10b981' },
            { label: 'Active Deployments', count: activeCount, statusKey: 'SERVICE_ACTIVE', route: '/bookings?status=SERVICE_ACTIVE', color: '#059669' },
            { label: 'Completed Engagements', count: completedCount, statusKey: 'COMPLETED', route: '/bookings?status=COMPLETED', color: '#64748b' },
            { label: 'Replacement Demands', count: replacementCount, statusKey: 'REPLACEMENT_REQUESTED', route: '/replacements', color: '#f59e0b' },
            { label: 'Cancelled Bookings', count: cancelledCount, statusKey: 'CANCELLED', route: '/bookings?status=CANCELLED', color: '#ef4444' },
          ].map((stage) => (
            <div
              key={stage.label}
              onClick={() => navigate(stage.route)}
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-app)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {stage.label}
                </span>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: stage.color,
                  }}
                />
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 'var(--space-2)' }}>
                {stage.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workforce Availability & Verification Progress Oversight */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Worker Availability Overview */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Briefcase size={18} color="var(--color-primary)" />
                <span>Worker Availability Overview</span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Total Registered Workers</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{sections?.workers?.registered ?? kpis.totalWorkers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Verified & Active Workforce</span>
                <span style={{ fontWeight: 600, color: 'var(--color-status-success-text)' }}>{sections?.workers?.verifiedAndActive ?? kpis.totalWorkers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Expiring Police Clearances</span>
                <span style={{ fontWeight: 600, color: kpis.expiringVerifications > 0 ? 'var(--color-status-warning-text)' : 'var(--color-text-primary)' }}>{kpis.expiringVerifications}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/workers')}
            style={{
              marginTop: 'var(--space-4)',
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>View Workforce Roster</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Verification Progress Oversight */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldCheck size={18} color="#059669" />
                <span>Verification Progress Oversight</span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Pending KYC Review</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{sections?.pendingKyc?.submitted ?? kpis.pendingVerificationCases}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>KYC Under Review</span>
                <span style={{ fontWeight: 600, color: '#0284c7' }}>{sections?.pendingKyc?.inReview ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Total Verification Pipeline</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{kpis.pendingVerificationCases}</span>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <Info size={14} color="var(--color-text-secondary)" />
              <span>KYC decisions reserved for Verification Executives. Ops Admin provides coordination.</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/verification')}
            style={{
              marginTop: 'var(--space-4)',
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Inspect Verification Queue</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Replacement Status & Support Escalations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Replacement Status */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <RefreshCw size={18} color="#d97706" />
              <span>Replacement Status</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Pending Replacement Requests</span>
                <span style={{ fontWeight: 600, color: kpis.replacementRequests > 0 ? '#d97706' : 'var(--color-text-primary)' }}>{kpis.replacementRequests}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Approved / Rematched Replacements</span>
                <span style={{ fontWeight: 600, color: 'var(--color-status-success-text)' }}>{sections?.replacements?.approved ?? 0}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/replacements')}
            style={{
              marginTop: 'var(--space-4)',
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Manage Replacements</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Support Escalation Overview */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <LifeBuoy size={18} color="#dc2626" />
              <span>Support Escalation Overview</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Open Grievances</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{sections?.complaints?.open ?? kpis.openDisputes}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>In-Progress Investigations</span>
                <span style={{ fontWeight: 600, color: '#0284c7' }}>{sections?.complaints?.inProgress ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>High-Priority Escalated Cases</span>
                <span style={{ fontWeight: 600, color: (sections?.complaints?.escalated ?? 0) > 0 ? '#dc2626' : 'var(--color-text-primary)' }}>{sections?.complaints?.escalated ?? 0}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/support')}
            style={{
              marginTop: 'var(--space-4)',
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Open Support Console</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Payment and Collection Summary (Only when supported by backend sections) */}
      {collections && collections.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <DollarSign size={18} color="#059669" />
              <span>Payment & Collections Realization Summary</span>
            </h3>
            <button
              onClick={() => navigate('/payments')}
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
              <span>View Financial Transactions</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {collections.map((col, idx) => (
              <div
                key={col.currency || idx}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-app)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Realized Today ({col.currency})
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#059669', marginTop: 'var(--space-1)' }}>
                  {col.todayFormatted}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                  Month-to-Date: <strong>{col.monthToDateFormatted}</strong>
                </div>
              </div>
            ))}
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Pending Refunds Awaiting Auth
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: kpis.pendingRefunds > 0 ? '#d97706' : 'var(--color-text-primary)', marginTop: 'var(--space-1)' }}>
                {kpis.pendingRefunds}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                Operational settlement triage queue
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div style={{ padding: 'var(--space-4) var(--space-4) 0', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Recent Operational Activities & Backlog Queues
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', marginBottom: 'var(--space-3)' }}>
            Direct triage workstations for customer bookings, candidate rematching, scheduled trials, confirmations, and refund review.
          </p>
        </div>
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
                  <tr
                    key={item.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open queue item ${item.id} - ${item.dominantAction}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      navigate(item.targetRoute);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        navigate(item.targetRoute);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
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
