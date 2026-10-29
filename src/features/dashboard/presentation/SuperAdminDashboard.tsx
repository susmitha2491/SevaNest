import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Users,
  ShieldCheck,
  LifeBuoy,
  RefreshCw,
  ArrowRight,
  Sliders,
  DollarSign,
  AlertTriangle,
  History,
  Clock,
  ShieldAlert,
  CreditCard,
  UserCheck,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'super-admin'],
    queryFn: () => dashboardRepository.getSuperAdminDashboard(),
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading Executive Platform Metrics..." />;
  }

  if (isError || !data) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Executive Dashboard metrics.';

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

  const { kpis, queues, sections, generatedAt } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Super Admin Executive Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Global marketplace governance, commercial parameters, platform audit events, and executive operational queues.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {generatedAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
              title="Snapshot timestamp provided directly by backend"
            >
              <Clock size={13} color="var(--color-primary)" />
              <span>Snapshot: {formatDateTimeIST(generatedAt)}</span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
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
              cursor: isFetching ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              opacity: isFetching ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} color="var(--color-primary)" className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* 8-Card Executive KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Gross Bookings"
          value={kpis.grossBookings !== null && kpis.grossBookings !== undefined ? kpis.grossBookings : '—'}
          subtitle={
            kpis.grossBookings !== null && kpis.grossBookings !== undefined
              ? 'Cumulative platform demand'
              : 'Metric unavailable (pending contract definition)'
          }
          icon={CalendarCheck}
          onClick={() => navigate('/bookings')}
        />
        <KPICard
          title="Active Workforce"
          value={kpis.activeWorkforce !== null && kpis.activeWorkforce !== undefined ? kpis.activeWorkforce : '—'}
          subtitle={
            sections?.workers
              ? `${sections.workers.verifiedAndActive} verified of ${sections.workers.registered} registered`
              : (kpis.activeWorkforce !== null && kpis.activeWorkforce !== undefined
                ? 'Fully verified & active staff'
                : 'Metric unavailable in backend response')
          }
          icon={Users}
          onClick={() => navigate('/workers')}
        />
        <KPICard
          title="Verification Queue"
          value={kpis.verificationQueue !== null && kpis.verificationQueue !== undefined ? kpis.verificationQueue : '—'}
          subtitle={
            sections?.pendingKyc
              ? `${sections.pendingKyc.submitted} submitted, ${sections.pendingKyc.inReview} in review`
              : (kpis.verificationQueue !== null && kpis.verificationQueue !== undefined
                ? 'Pending trust & safety review'
                : 'Metric unavailable in backend response')
          }
          icon={ShieldCheck}
          onClick={() => navigate('/verification')}
        />
        <KPICard
          title="Active Grievances"
          value={kpis.activeGrievances !== null && kpis.activeGrievances !== undefined ? kpis.activeGrievances : '—'}
          subtitle={
            sections?.complaints
              ? `${sections.complaints.open} open, ${sections.complaints.inProgress} in progress, ${sections.complaints.escalated} escalated`
              : (kpis.activeGrievances !== null && kpis.activeGrievances !== undefined
                ? 'Open support & SLA tickets'
                : 'Metric unavailable in backend response')
          }
          icon={LifeBuoy}
          onClick={() => navigate('/support')}
        />
        <KPICard
          title="Replacement Volume"
          value={kpis.replacementVolume !== null && kpis.replacementVolume !== undefined ? kpis.replacementVolume : '—'}
          subtitle={
            sections?.replacements
              ? `${sections.replacements.requested} requested, ${sections.replacements.approved} approved`
              : (kpis.replacementVolume !== null && kpis.replacementVolume !== undefined
                ? 'Active rematching requests'
                : 'Metric unavailable in backend response')
          }
          icon={RefreshCw}
          onClick={() => navigate('/bookings')}
        />
        <KPICard
          title="Gross Collections"
          value={
            kpis.platformRevenueINR !== null && kpis.platformRevenueINR !== undefined
              ? formatCurrencyINR(kpis.platformRevenueINR)
              : '—'
          }
          subtitle={
            sections?.collections?.[0]
              ? `MTD: ${sections.collections[0].monthToDateFormatted} (Today: ${sections.collections[0].todayFormatted})`
              : (kpis.platformRevenueINR !== null && kpis.platformRevenueINR !== undefined
                ? 'Platform booking & placement fees'
                : 'Metric unavailable (pending contract definition)')
          }
          icon={DollarSign}
          onClick={() => navigate('/payments')}
        />
        <KPICard
          title="Scheduled Trials"
          value={kpis.scheduledTrials !== null && kpis.scheduledTrials !== undefined ? kpis.scheduledTrials : '—'}
          subtitle={
            kpis.scheduledTrials !== null && kpis.scheduledTrials !== undefined
              ? 'Interviews and trials in progress'
              : 'Metric unavailable in backend response'
          }
          icon={CalendarCheck}
          onClick={() => navigate('/bookings')}
        />
        <KPICard
          title="Police Verif Due"
          value={kpis.policeVerifDue !== null && kpis.policeVerifDue !== undefined ? kpis.policeVerifDue : '—'}
          subtitle={
            kpis.policeVerifDue !== null && kpis.policeVerifDue !== undefined
              ? 'Impending annual rechecks'
              : 'Metric unavailable in backend response'
          }
          icon={AlertTriangle}
          onClick={() => navigate('/verification')}
        />
      </div>

      {/* Backend Granular Sections: Bookings Breakdown by Status */}
      {sections?.bookings?.byStatus && sections.bookings.byStatus.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Layers size={18} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
                  Marketplace Bookings by Status
                </h2>
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', display: 'block' }}>
                Real-time lifecycle distribution from backend. Select any status to filter the bookings management workstation.
              </span>
            </div>
            <button
              onClick={() => navigate('/bookings')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {sections.bookings.byStatus.map((item) => (
              <div
                key={item.status}
                id={`booking-status-${item.status.toLowerCase()}`}
                onClick={() => navigate(`/bookings?status=${encodeURIComponent(item.status)}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-app)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'none';
                }}
                title={`Filter bookings by ${item.status}`}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {formatStatusLabel(item.status)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                    {item.status}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 700,
                    color: item.count > 0 ? 'var(--color-navy)' : 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-surface)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    minWidth: '28px',
                    textAlign: 'center',
                  }}
                >
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backend Granular Sections: Collections & Financial Realization */}
      {sections?.collections && sections.collections.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CreditCard size={18} color="var(--color-primary)" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
                  Collections & Financial Realization
                </h2>
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', display: 'block' }}>
                Multi-currency platform collections converted from minor units (paise for INR) as recorded by the gateway.
              </span>
            </div>
            <button
              id="view-payments-ledger-btn"
              onClick={() => navigate('/payments')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <span>View Financial Ledger</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {sections.collections.map((col, idx) => (
              <div
                key={col.currency || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-app)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      {col.currency} Currency Account
                    </span>
                  </div>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Today's Realized Collections</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
                      {col.todayFormatted}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Minor units: {col.todayMinor.toLocaleString()} {col.currency === 'INR' ? 'paise' : 'units'}
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Month-to-Date (MTD)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {col.monthToDateFormatted}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Minor units: {col.monthToDateMinor.toLocaleString()} {col.currency === 'INR' ? 'paise' : 'units'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backend Granular Sections: Workforce, Support & Platform Alert Tri-Panel */}
      {(sections?.workers || sections?.pendingKyc || sections?.complaints || sections?.replacements || sections?.alerts) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {/* Panel 1: Workforce Health & KYC Pipeline */}
          {(sections.workers || sections.pendingKyc) && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <UserCheck size={16} color="var(--color-primary)" />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                    Workforce & Trust Verification
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {sections.workers && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Registered Domestic Staff</span>
                      <strong style={{ color: 'var(--color-navy)' }}>{sections.workers.registered}</strong>
                    </div>
                  )}
                  {sections.workers && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Verified & Active Roster</span>
                      <strong style={{ color: 'var(--color-primary)' }}>{sections.workers.verifiedAndActive}</strong>
                    </div>
                  )}
                  {sections.pendingKyc && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>KYC Dossiers Submitted</span>
                      <strong style={{ color: 'var(--color-navy)' }}>{sections.pendingKyc.submitted}</strong>
                    </div>
                  )}
                  {sections.pendingKyc && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>KYC In Review (Claimed)</span>
                      <strong style={{ color: 'var(--color-navy)' }}>{sections.pendingKyc.inReview}</strong>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button
                  onClick={() => navigate('/workers')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Workers
                </button>
                <button
                  onClick={() => navigate('/verification')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Verification
                </button>
              </div>
            </div>
          )}

          {/* Panel 2: Grievance Triage & Rematching */}
          {(sections.complaints || sections.replacements) && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <LifeBuoy size={16} color="var(--color-primary)" />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                    Grievance Triage & Rematching
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {sections.complaints && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Unassigned Complaints</span>
                      <strong style={{ color: sections.complaints.unassigned > 0 ? 'var(--color-status-warning-text)' : 'var(--color-navy)' }}>
                        {sections.complaints.unassigned}
                      </strong>
                    </div>
                  )}
                  {sections.complaints && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Open Cases</span>
                      <strong style={{ color: 'var(--color-navy)' }}>{sections.complaints.open}</strong>
                    </div>
                  )}
                  {sections.complaints && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>In Progress Cases</span>
                      <strong style={{ color: 'var(--color-navy)' }}>{sections.complaints.inProgress}</strong>
                    </div>
                  )}
                  {sections.complaints && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Escalated to Operations</span>
                      <strong style={{ color: sections.complaints.escalated > 0 ? 'var(--color-status-danger-text)' : 'var(--color-navy)' }}>
                        {sections.complaints.escalated}
                      </strong>
                    </div>
                  )}
                  {sections.replacements && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Rematches (Requested / Approved)</span>
                      <strong style={{ color: 'var(--color-navy)' }}>
                        {sections.replacements.requested} / {sections.replacements.approved}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button
                  onClick={() => navigate('/support')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Support
                </button>
                <button
                  onClick={() => navigate('/bookings?status=REPLACEMENT_REQUESTED')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Replacements
                </button>
              </div>
            </div>
          )}

          {/* Panel 3: System Alerts & Platform Health */}
          {sections.alerts && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <ShieldAlert size={16} color="var(--color-primary)" />
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                    System Alerts & Platform Health
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Open Alerts</span>
                    <strong style={{ color: sections.alerts.open > 0 ? 'var(--color-status-warning-text)' : 'var(--color-navy)' }}>
                      {sections.alerts.open}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Critical Severity Alerts</span>
                    <strong style={{ color: sections.alerts.critical > 0 ? 'var(--color-status-danger-text)' : 'var(--color-navy)' }}>
                      {sections.alerts.critical}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Warning Alerts</span>
                    <strong style={{ color: sections.alerts.warning > 0 ? 'var(--color-status-warning-text)' : 'var(--color-navy)' }}>
                      {sections.alerts.warning}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)', padding: '4px 0' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Health State</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor:
                          sections.alerts.critical > 0
                            ? 'var(--color-status-danger-bg)'
                            : sections.alerts.warning > 0
                            ? 'var(--color-status-warning-bg)'
                            : 'var(--color-status-success-bg)',
                        color:
                          sections.alerts.critical > 0
                            ? 'var(--color-status-danger-text)'
                            : sections.alerts.warning > 0
                            ? 'var(--color-status-warning-text)'
                            : 'var(--color-status-success-text)',
                      }}
                    >
                      {sections.alerts.critical > 0
                        ? 'CRITICAL INCIDENTS'
                        : sections.alerts.warning > 0
                        ? 'WARNINGS ACTIVE'
                        : 'ALL SYSTEMS OPERATIONAL'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button
                  onClick={() => navigate('/audit')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Audit Trail
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Executive Queues and Quick Governance Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
        {/* System Queue Summaries */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
              System Operational Queues
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              High-level queues requiring executive visibility and operational escalation
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {queues.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-6)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  backgroundColor: 'var(--color-bg-app)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                }}
              >
                No operational queues requiring executive attention at this time. All queues are clear.
              </div>
            ) : (
              queues.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {item.title}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Source: {item.source} • {item.timing}
                    </span>
                  </div>
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
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Executive Governance Shortcuts */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
              Governance Shortcuts
            </h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Configure masters, audit trails & business reports
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button
              onClick={() => navigate('/configuration')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <Sliders size={18} color="var(--color-primary)" />
              <div>
                <div>Pricing & Fee Schedule</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  Manage dynamic pricing tiers
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/audit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <History size={18} color="var(--color-primary)" />
              <div>
                <div>Authoritative Audit Logs</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  Inspect immutable platform actions
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <DollarSign size={18} color="var(--color-primary)" />
              <div>
                <div>Standard Business Reports</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  12 financial & operational exports
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
