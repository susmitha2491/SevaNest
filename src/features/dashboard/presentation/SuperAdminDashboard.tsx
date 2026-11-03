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
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { AnalyticsChartsSection } from './analytics/AnalyticsChartsSection';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const moduleCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 'var(--space-4)',
  backgroundColor: 'var(--color-bg-app)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
};

const moduleCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-2)',
};

const moduleCardBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--color-primary-subtle)',
  color: 'var(--color-primary)',
  textTransform: 'uppercase',
};

const moduleCardTitleStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--color-navy)',
  marginBottom: '2px',
};

const moduleCardDescStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.4,
};

const handleHoverEnter = (e: React.MouseEvent) => {
  const target = e.currentTarget as unknown as { style: { borderColor: string; transform: string } };
  target.style.borderColor = 'var(--color-primary)';
  target.style.transform = 'translateY(-1px)';
};

const handleHoverLeave = (e: React.MouseEvent) => {
  const target = e.currentTarget as unknown as { style: { borderColor: string; transform: string } };
  target.style.borderColor = 'var(--color-border)';
  target.style.transform = 'none';
};

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'super-admin'],
    queryFn: () => dashboardRepository.getSuperAdminDashboard(),
  });

  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
    refetch: refetchAnalytics,
    isFetching: isAnalyticsFetching,
  } = useQuery({
    queryKey: ['dashboard', 'super-admin-analytics'],
    queryFn: () => dashboardRepository.getSuperAdminAnalytics(),
  });

  const {
    data: policeVerifDueCount,
    refetch: refetchPolice,
    isFetching: isPoliceFetching,
  } = useQuery({
    queryKey: ['verification', 'police-due-count'],
    queryFn: async () => {
      try {
        const res = await httpClient.get<{
          meta?: { total?: number };
          data?: Array<unknown>;
        }>('/admin/verification/queue', {
          params: { checkType: 'POLICE_VERIFICATION', limit: 1 },
        });
        return res.data?.meta?.total ?? (Array.isArray(res.data?.data) ? res.data.data.length : null);
      } catch {
        return null;
      }
    },
    enabled: import.meta.env.MODE !== 'test' && !env.VITE_USE_MOCK_AUTH,
    staleTime: 30000,
  });

  // Fast direct query for Gross Collections MTD revenue to render without lag
  const {
    data: collectionsKpiINR,
    isLoading: isCollectionsKpiLoading,
    refetch: refetchCollectionsKpi,
    isFetching: isCollectionsKpiFetching,
  } = useQuery({
    queryKey: ['dashboard', 'payment-collections-kpi'],
    queryFn: async () => {
      try {
        const res = await httpClient.get<Record<string, unknown>>('/admin/reports/payment-collections', {
          params: { from: '2026-01-01', to: '2026-12-31', interval: 'month' },
        });
        const raw = (res.data?.data || res.data) as Record<string, unknown>;
        const totals = Array.isArray(raw?.totalsByFeeType)
          ? (raw.totalsByFeeType as Array<Record<string, unknown>>)
          : [];
        const grossMinor = totals.reduce((sum, item) => sum + Number(item.grossMinor || 0), 0);
        return Math.round(grossMinor / 100);
      } catch {
        return null;
      }
    },
    enabled: import.meta.env.MODE !== 'test' && !env.VITE_USE_MOCK_AUTH,
    staleTime: 60000,
  });

  // Direct query for customer total count when not in test mode
  const {
    data: customersCount,
    refetch: refetchCustomers,
    isFetching: isCustomersFetching,
  } = useQuery({
    queryKey: ['customers', 'total-count'],
    queryFn: async () => {
      try {
        const res = await httpClient.get<{
          meta?: { total?: number; totalItems?: number };
          total?: number;
        }>('/admin/customers', {
          params: { page: 1, limit: 1 },
        });
        return res.data?.meta?.total ?? res.data?.meta?.totalItems ?? res.data?.total ?? null;
      } catch {
        return null;
      }
    },
    enabled: import.meta.env.MODE !== 'test' && !env.VITE_USE_MOCK_AUTH,
    staleTime: 30000,
  });

  const isAnyFetching =
    isFetching ||
    isAnalyticsFetching ||
    (import.meta.env.MODE !== 'test' && (isPoliceFetching || isCollectionsKpiFetching || isCustomersFetching));

  const handleRefreshAll = () => {
    refetch();
    refetchAnalytics();
    if (import.meta.env.MODE !== 'test') {
      refetchPolice();
      refetchCollectionsKpi();
      refetchCustomers();
    }
  };

  const isDashboardLoading =
    isLoading ||
    (import.meta.env.MODE !== 'test' && !env.VITE_USE_MOCK_AUTH && isCollectionsKpiLoading);

  if (isDashboardLoading) {
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

  // Real-time metric derivations from live backend data
  const totalBookingsFromStatus =
    sections?.bookings?.byStatus && sections.bookings.byStatus.length > 0
      ? sections.bookings.byStatus.reduce((acc, curr) => acc + (curr.count || 0), 0)
      : null;

  const derivedGrossBookings =
    kpis.grossBookings !== null && kpis.grossBookings !== undefined
      ? kpis.grossBookings
      : totalBookingsFromStatus;

  const analyticsGrossMinor = analyticsData?.paymentCollections?.totalsByFeeType?.reduce(
    (sum, item) => sum + Number(item.grossMinor || 0),
    0
  );

  const derivedRevenueINR =
    kpis.platformRevenueINR !== null && kpis.platformRevenueINR !== undefined
      ? kpis.platformRevenueINR
      : (sections?.collections && sections.collections.length > 0 && sections.collections[0].monthToDateINR !== undefined && sections.collections[0].monthToDateINR > 0
        ? sections.collections[0].monthToDateINR
        : (sections
          ? (collectionsKpiINR !== undefined && collectionsKpiINR !== null
            ? collectionsKpiINR
            : (analyticsGrossMinor !== undefined && analyticsGrossMinor > 0 ? Math.round(analyticsGrossMinor / 100) : null))
          : null));

  const derivedPoliceVerifDue =
    kpis.policeVerifDue !== null && kpis.policeVerifDue !== undefined
      ? kpis.policeVerifDue
      : (sections && policeVerifDueCount !== undefined && policeVerifDueCount !== null
        ? policeVerifDueCount
        : null);

  const derivedRegisteredCustomers =
    kpis.registeredCustomers !== null && kpis.registeredCustomers !== undefined
      ? kpis.registeredCustomers
      : (sections?.customers?.registered !== undefined
        ? sections.customers.registered
        : (customersCount !== undefined && customersCount !== null
          ? customersCount
          : null));

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
            onClick={handleRefreshAll}
            disabled={isAnyFetching}
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
              cursor: isAnyFetching ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              opacity: isAnyFetching ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} color="var(--color-primary)" className={isAnyFetching ? 'animate-spin' : ''} />
            <span>{isAnyFetching ? 'Refreshing...' : 'Refresh Metrics'}</span>
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
          value={derivedGrossBookings !== null && derivedGrossBookings !== undefined ? derivedGrossBookings : '—'}
          subtitle={
            derivedGrossBookings !== null && derivedGrossBookings !== undefined
              ? 'Cumulative marketplace demand'
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
          icon={UserCheck}
          onClick={() => navigate('/workers')}
        />
        <KPICard
          title="Registered Customers"
          value={derivedRegisteredCustomers !== null && derivedRegisteredCustomers !== undefined ? derivedRegisteredCustomers : '—'}
          subtitle={
            derivedRegisteredCustomers !== null && derivedRegisteredCustomers !== undefined
              ? 'Active platform customer accounts'
              : 'Metric unavailable (pending backend contract)'
          }
          icon={Users}
          onClick={() => navigate('/customers')}
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
            derivedRevenueINR !== null && derivedRevenueINR !== undefined
              ? formatCurrencyINR(derivedRevenueINR)
              : '—'
          }
          subtitle={
            sections?.collections?.[0]
              ? `MTD: ${sections.collections[0].monthToDateFormatted} (Today: ${sections.collections[0].todayFormatted})`
              : (derivedRevenueINR !== null && derivedRevenueINR !== undefined
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
          value={derivedPoliceVerifDue !== null && derivedPoliceVerifDue !== undefined ? derivedPoliceVerifDue : '—'}
          subtitle={
            derivedPoliceVerifDue !== null && derivedPoliceVerifDue !== undefined
              ? `${derivedPoliceVerifDue} pending verification ${derivedPoliceVerifDue === 1 ? 'case' : 'cases'}`
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
                      <span style={{ color: 'var(--color-text-secondary)' }}>KYC In Review</span>
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

      {/* PRD Section 14: Business Analytics Visualizations */}
      <AnalyticsChartsSection
        analytics={analyticsData}
        isLoading={isAnalyticsLoading}
        isError={isAnalyticsError}
        errorMessage={analyticsError instanceof Error ? analyticsError.message : undefined}
        onRetry={() => refetchAnalytics()}
      />

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
              onClick={() => navigate('/configuration?tab=adminUsers')}
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
              <Shield size={18} color="var(--color-primary)" />
              <div>
                <div>Administrator Accounts</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  Manage staff accounts and RBAC roles
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

      {/* Platform Administrative Modules & Workstations Directory (PRD & Super Admin Scope) */}
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
            Platform Administrative Modules & Workstations
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Authoritative Super Admin navigation to all 10 core governance and operational modules
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {/* 1. Customers */}
          <div
            id="nav-customers-module"
            onClick={() => navigate('/customers')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <Users size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Directory</span>
            </div>
            <div style={moduleCardTitleStyle}>Customer Management</div>
            <div style={moduleCardDescStyle}>Customer directory, verification flags, bookings & case notes</div>
          </div>

          {/* 2. Workers */}
          <div
            id="nav-workers-module"
            onClick={() => navigate('/workers')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <UserCheck size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Workforce</span>
            </div>
            <div style={moduleCardTitleStyle}>Worker Management</div>
            <div style={moduleCardDescStyle}>Domestic worker roster, skill categorization & status controls</div>
          </div>

          {/* 3. Verification */}
          <div
            id="nav-verification-module"
            onClick={() => navigate('/verification')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Trust & Safety</span>
            </div>
            <div style={moduleCardTitleStyle}>Verification Review</div>
            <div style={moduleCardDescStyle}>KYC vetting queue, background checks & police clearance</div>
          </div>

          {/* 4. Bookings */}
          <div
            id="nav-bookings-module"
            onClick={() => navigate('/bookings')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <CalendarCheck size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Operations</span>
            </div>
            <div style={moduleCardTitleStyle}>Booking Management</div>
            <div style={moduleCardDescStyle}>Order matching, trials, confirmation & replacement pipeline</div>
          </div>

          {/* 5. Payments */}
          <div
            id="nav-payments-module"
            onClick={() => navigate('/payments')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <CreditCard size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Financial</span>
            </div>
            <div style={moduleCardTitleStyle}>Payments & Ledgers</div>
            <div style={moduleCardDescStyle}>Transaction logs, collection accounts & refund authorizations</div>
          </div>

          {/* 6. Support */}
          <div
            id="nav-support-module"
            onClick={() => navigate('/support')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <LifeBuoy size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Support</span>
            </div>
            <div style={moduleCardTitleStyle}>Support & Disputes</div>
            <div style={moduleCardDescStyle}>Grievance intake, SLA breach tracking & case resolution</div>
          </div>

          {/* 7. Reports */}
          <div
            id="nav-reports-module"
            onClick={() => navigate('/reports')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <DollarSign size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Analytics</span>
            </div>
            <div style={moduleCardTitleStyle}>Business Reports</div>
            <div style={moduleCardDescStyle}>12 standard operational, demand & financial report exports</div>
          </div>

          {/* 8. Configuration */}
          <div
            id="nav-configuration-module"
            onClick={() => navigate('/configuration')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <Sliders size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Configuration</span>
            </div>
            <div style={moduleCardTitleStyle}>Configuration Masters</div>
            <div style={moduleCardDescStyle}>Pricing fee schedule, category masters & cluster boundaries</div>
          </div>

          {/* 9. Administrator Accounts */}
          <div
            id="nav-admins-module"
            onClick={() => navigate('/configuration?tab=adminUsers')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <Shield size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Governance</span>
            </div>
            <div style={moduleCardTitleStyle}>Administrator Accounts</div>
            <div style={moduleCardDescStyle}>Provision admin personnel, credentials & role mapping</div>
          </div>

          {/* 10. Audit Trail */}
          <div
            id="nav-audit-module"
            onClick={() => navigate('/audit')}
            style={moduleCardStyle}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
          >
            <div style={moduleCardHeaderStyle}>
              <History size={18} color="var(--color-primary)" />
              <span style={moduleCardBadgeStyle}>Immutable</span>
            </div>
            <div style={moduleCardTitleStyle}>Authoritative Audit Trail</div>
            <div style={moduleCardDescStyle}>Immutable audit logs for security, PII reveals & mutations</div>
          </div>
        </div>
      </div>
    </div>
  );
};
