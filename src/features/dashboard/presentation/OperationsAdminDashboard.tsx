import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Users,
  RefreshCw,
  LifeBuoy,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Briefcase,
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

      {/* 4 Primary Operational KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Active Engagements"
          value={kpis.activeLiveEngagements}
          subtitle="Live recurring household service"
          icon={Users}
          onClick={() => setActiveTab('ACTIVE_SERVICES')}
        />
        <KPICard
          title="New Requests"
          value={kpis.newBookingRequests}
          subtitle="Awaiting candidate matching"
          icon={CalendarCheck}
          onClick={() => setActiveTab('NEW_REQUESTS')}
        />
        <KPICard
          title="Available Workforce"
          value={kpis.totalWorkers}
          subtitle="Total registered workforce"
          icon={Briefcase}
          onClick={() => navigate('/workers')}
        />
        <KPICard
          title="Replacement Queue"
          value={kpis.replacementRequests}
          subtitle="Urgent household rematching"
          icon={RefreshCw}
          onClick={() => setActiveTab('REPLACEMENTS')}
        />
      </div>

      {/* Simplified Booking Status Overview & Lifecycle Summary */}
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
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <TrendingUp size={18} color="var(--color-primary)" />
              <span>Booking Status Overview & Lifecycle Summary</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', marginBottom: 0 }}>
              Operational progression from initial customer intake to active service deployment. Click any stage to inspect relevant records.
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

        {/* 5-Stage Core Lifecycle Pipeline */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {[
            {
              step: '1',
              label: 'New Intake',
              sublabel: 'Customer Demand',
              count: newRequestsCount,
              statusKey: 'REQUESTED',
              route: '/bookings?status=REQUESTED',
              color: 'var(--color-primary)',
            },
            {
              step: '2',
              label: 'Awaiting Matching',
              sublabel: 'Shortlisting Pool',
              count: matchingCount,
              statusKey: 'MATCHING_IN_PROGRESS',
              route: '/bookings?status=MATCHING_IN_PROGRESS',
              color: '#6366f1',
            },
            {
              step: '3',
              label: "Today's Trials",
              sublabel: 'Interviews & Trials',
              count: trialsCount,
              statusKey: 'INTERVIEW_SCHEDULED',
              route: '/bookings?status=INTERVIEW_SCHEDULED',
              color: '#0ea5e9',
            },
            {
              step: '4',
              label: 'Awaiting Confirmation',
              sublabel: 'Trial Confirmed',
              count: confirmedCount,
              statusKey: 'CONFIRMED',
              route: '/bookings?status=CONFIRMED',
              color: '#10b981',
            },
            {
              step: '5',
              label: 'Active Deployments',
              sublabel: 'Live Household Service',
              count: activeCount,
              statusKey: 'SERVICE_ACTIVE',
              route: '/bookings?status=SERVICE_ACTIVE',
              color: '#059669',
            },
          ].map((stage) => (
            <div
              key={stage.label}
              onClick={() => navigate(stage.route)}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-app)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${stage.color}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {stage.sublabel}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: stage.color,
                    backgroundColor: 'var(--color-bg-surface)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Step {stage.step}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {stage.label}
                </span>
                <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {stage.count}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary Lifecycle & Exception Strip */}
        <div
          style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px dashed var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <div
            onClick={() => navigate('/bookings?status=COMPLETED')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }} />
            <span>Completed Engagements:</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{completedCount}</strong>
          </div>

          <div
            onClick={() => navigate('/replacements')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span>Replacement Demands:</span>
            <strong style={{ color: '#d97706' }}>{replacementCount}</strong>
          </div>

          <div
            onClick={() => navigate('/bookings?status=CANCELLED')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <span>Cancelled Bookings:</span>
            <strong style={{ color: '#dc2626' }}>{cancelledCount}</strong>
          </div>
        </div>
      </div>

      {/* Workforce Supply & Verification Command (2-Column Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <Briefcase size={18} color="var(--color-primary)" />
                <span>Worker Availability Overview</span>
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                Workforce Supply
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Registered Workers</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Total Workers registered in pool</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {sections?.workers?.registered ?? kpis.totalWorkers}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Verified & Active Workforce</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Eligible for household assignment</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-status-success-text)' }}>
                  {sections?.workers?.verifiedAndActive ?? kpis.totalWorkers}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Customers</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Registered households & employers</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {kpis.totalCustomers}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: kpis.expiringVerifications > 0 ? '#fffbeb' : 'var(--color-bg-app)', borderRadius: 'var(--radius-md)', border: kpis.expiringVerifications > 0 ? '1px solid #fef3c7' : 'none' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: kpis.expiringVerifications > 0 ? '#b45309' : 'var(--color-text-secondary)', fontWeight: 600 }}>Police Verif Alert</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Clearances expiring within 30 days</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: kpis.expiringVerifications > 0 ? '#d97706' : 'var(--color-text-primary)' }}>
                  {kpis.expiringVerifications}
                </span>
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
              transition: 'background-color var(--transition-fast)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                <ShieldCheck size={18} color="#059669" />
                <span>Verification Progress Oversight</span>
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                Trust Operations
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Pending Verification</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Cases under trust review</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {kpis.pendingVerificationCases}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Pending KYC Review</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Awaiting review claim</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#0F766E' }}>
                  {sections?.pendingKyc?.submitted ?? kpis.pendingVerificationCases}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>KYC Under Review</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>In active executive inspection</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#0284c7' }}>
                  {sections?.pendingKyc?.inReview ?? 0}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Verification Pipeline</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Combined pending & active cases</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {kpis.pendingVerificationCases}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-app)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
              <Info size={14} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />
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
              transition: 'background-color var(--transition-fast)',
            }}
          >
            <span>Inspect Verification Queue</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Operational Alerts & Pending Activities */}
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
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <AlertCircle size={18} color="#dc2626" />
              <span>Operational Alerts & Pending Activities</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', marginBottom: 0 }}>
              High-priority operational queues requiring administrative attention, authorizations, and partner rematching.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {/* Replacement Status Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-app)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <RefreshCw size={15} color="#d97706" />
                  <span>Replacement Status</span>
                </h4>
                <span style={{ fontSize: '11px', fontWeight: 600, color: kpis.replacementRequests > 0 ? '#b45309' : '#059669', backgroundColor: kpis.replacementRequests > 0 ? '#fef3c7' : '#f0fdf4', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  {kpis.replacementRequests} Active
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Pending Replacement Requests</span>
                  <strong style={{ color: kpis.replacementRequests > 0 ? '#d97706' : 'var(--color-text-primary)' }}>{kpis.replacementRequests}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Approved / Rematched Replacements</span>
                  <strong style={{ color: 'var(--color-status-success-text)' }}>{sections?.replacements?.approved ?? 0}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/replacements')}
              style={{
                marginTop: 'var(--space-3)',
                width: '100%',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>Manage Replacements</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Support Escalation Overview Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-app)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <LifeBuoy size={15} color="#dc2626" />
                  <span>Support Escalation Overview</span>
                </h4>
                <span style={{ fontSize: '11px', fontWeight: 600, color: kpis.openDisputes > 0 ? '#b91c1c' : '#059669', backgroundColor: kpis.openDisputes > 0 ? '#fef2f2' : '#f0fdf4', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  {kpis.openDisputes} Open
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Open Disputes</span>
                  <strong style={{ color: kpis.openDisputes > 0 ? '#dc2626' : 'var(--color-text-primary)' }}>{sections?.complaints?.open ?? kpis.openDisputes}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>In-Progress Investigations</span>
                  <strong>{sections?.complaints?.inProgress ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>High-Priority Escalated Cases</span>
                  <strong style={{ color: (sections?.complaints?.escalated ?? 0) > 0 ? '#dc2626' : 'var(--color-text-primary)' }}>{sections?.complaints?.escalated ?? 0}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/support')}
              style={{
                marginTop: 'var(--space-3)',
                width: '100%',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>Open Support Console</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Pending Authorizations & Compliance Watchlist Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-app)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <DollarSign size={15} color="#059669" />
                  <span>Pending Refunds & Settlements</span>
                </h4>
                <span style={{ fontSize: '11px', fontWeight: 600, color: kpis.pendingRefunds > 0 ? '#b45309' : '#059669', backgroundColor: kpis.pendingRefunds > 0 ? '#fef3c7' : '#f0fdf4', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  {kpis.pendingRefunds} Pending
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Pending Refunds</span>
                  <strong style={{ color: kpis.pendingRefunds > 0 ? '#d97706' : 'var(--color-text-primary)' }}>{kpis.pendingRefunds}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Authorizations Status</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Awaiting Ops authorization</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('REFUNDS')}
              style={{
                marginTop: 'var(--space-3)',
                width: '100%',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>Authorize Pending Refunds</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Payment and Collection Realization Summary */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <DollarSign size={16} color="#059669" />
              <span>Payment & Collections Realization Summary</span>
            </h4>
            <button
              onClick={() => navigate('/payments')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <span>View Financial Transactions</span>
              <ArrowRight size={11} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {collections && collections.length > 0 ? (
              collections.map((col, idx) => (
                <div
                  key={col.currency || idx}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    Realized Today ({col.currency})
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {col.todayFormatted}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Month-to-Date: <strong>{col.monthToDateFormatted}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-app)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                No active collections recorded. Real-time gateway settlement active.
              </div>
            )}
          </div>
        </div>
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
