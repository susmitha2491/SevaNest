import React from 'react';
import {
  TrendingUp,
  MapPin,
  Briefcase,
  AlertOctagon,
  CreditCard,
  Clock,
  RefreshCw,
  Award,
  Layers,
} from 'lucide-react';
import { SuperAdminAnalyticsData } from '../../domain/types';
import { BarChart } from './charts/BarChart';
import { HorizontalBarChart } from './charts/HorizontalBarChart';
import { DonutGauge } from './charts/DonutGauge';
import { FunnelChart } from './charts/FunnelChart';
import { formatCurrencyINR } from '../../../../shared/formatters/currency';

interface AnalyticsChartsSectionProps {
  analytics: SuperAdminAnalyticsData | null | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

function formatResolutionTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export const AnalyticsChartsSection: React.FC<AnalyticsChartsSectionProps> = ({
  analytics,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-primary)' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Loading Business Analytics & Trends...</span>
        </div>
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-status-danger-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <p style={{ color: 'var(--color-status-danger-text)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
          {errorMessage || 'Unable to load business analytics from backend services.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Retry Analytics
          </button>
        )}
      </div>
    );
  }

  const {
    bookingFunnel,
    categoryDemand,
    areaDemand,
    workerRegistrations,
    workerUtilization,
    interviewConversion,
    cancellationRate,
    replacementRate,
    paymentCollections,
    supportTickets,
    topRatedWorkers,
    repeatCustomers,
  } = analytics;

  // Transform Category Demand for BarChart
  const categoryBarData = categoryDemand?.categories?.map((c) => ({
    label: c.name || c.code,
    value: c.requests,
    subLabel: `${c.requests} requests`,
    color: 'var(--color-primary)',
  })) || [];

  // Transform Support Tickets by status for BarChart
  const supportStatusData = supportTickets?.byStatus?.map((s) => ({
    label: s.status.replace(/_/g, ' '),
    value: s.count,
    color: s.status === 'RESOLVED' || s.status === 'CLOSED' ? 'var(--color-success)' : s.status === 'ESCALATED' ? 'var(--color-error)' : 'var(--color-amber)',
  })) || [];

  // Transform Area Demand for HorizontalBarChart
  const areaItems = areaDemand?.map((a) => ({
    id: a.areaId,
    title: a.name,
    subtitle: a.city,
    value: a.requests,
    formattedValue: `${a.requests} requests`,
    color: 'var(--color-primary)',
  })) || [];

  // Transform Top-Rated Workers for HorizontalBarChart
  const topWorkerItems = topRatedWorkers?.map((w) => ({
    id: w.workerId,
    title: w.name,
    subtitle: w.workerId,
    value: w.averageRating,
    starRating: w.averageRating,
    formattedValue: `${w.ratingCount} reviews`,
    color: 'var(--color-amber)',
  })) || [];

  // Transform Repeat Customers for HorizontalBarChart
  const repeatCustomerItems = repeatCustomers?.map((c) => ({
    id: c.customerUserId,
    title: c.name,
    subtitle: c.customerUserId,
    value: c.bookings,
    formattedValue: `${c.bookings} bookings`,
    color: 'var(--color-navy)',
  })) || [];

  // Funnel stages for Booking Funnel
  const funnelStages = bookingFunnel ? [
    { name: 'Initial Booking Requests', count: bookingFunnel.requests, color: 'var(--color-navy)' },
    { name: 'Confirmed Engagements', count: bookingFunnel.confirmed, color: 'var(--color-success)', subtext: `${Math.round(bookingFunnel.confirmationRate * 100)}% Conversion` },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <TrendingUp size={20} color="var(--color-primary)" />
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
              Business Analytics & Marketplace Intelligence
            </h2>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', display: 'block' }}>
            PRD Section 14 Analytics: Real-time demand aggregations, fulfillment funnels, workforce capacity, and support SLAs.
          </span>
        </div>
      </div>

      {/* Grid: 2 Columns on Desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {/* Panel 1: Demand & Booking Funnel Analytics */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Layers size={17} color="var(--color-primary)" />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                Demand & Booking Conversion (PRD §14.1, §14.4)
              </h3>
            </div>
            {categoryDemand && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                Total: {categoryDemand.total.toLocaleString()} Requests
              </span>
            )}
          </div>

          {/* Category Demand Bar Chart */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Category-Wise Demand Distribution
            </div>
            {categoryDemand ? (
              <BarChart
                data={categoryBarData}
                height={180}
                emptyMessage="No category demand recorded in this reporting period"
                ariaLabel="Category-Wise Demand Chart"
              />
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — Metric not provided by backend contract
              </div>
            )}
          </div>

          {/* Booking Conversion Funnel */}
          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Booking Request to Confirmation Funnel
            </div>
            {bookingFunnel ? (
              <FunnelChart
                stages={funnelStages}
                emptyMessage="No booking funnel records available"
                ariaLabel="Booking Conversion Funnel"
              />
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — Metric not provided by backend contract
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Area-Wise Demand & Customer Loyalty */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <MapPin size={17} color="var(--color-primary)" />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                Geographic Demand & Repeat Customers (PRD §14.5, §14.10)
              </h3>
            </div>
          </div>

          {/* Area-Wise Demand Ranking */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Area-Wise Demand Aggregation (Top Hubs)
            </div>
            {areaDemand ? (
              <HorizontalBarChart
                items={areaItems}
                maxItems={5}
                emptyMessage="No area demand records recorded"
                ariaLabel="Area-Wise Demand Rankings"
              />
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — Metric not provided by backend contract
              </div>
            )}
          </div>

          {/* Repeat Customers Leaderboard */}
          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Top Repeat Customers (Loyalty Activity)
            </div>
            {repeatCustomers ? (
              <HorizontalBarChart
                items={repeatCustomerItems}
                maxItems={4}
                emptyMessage="No repeat customer records found in reporting window"
                ariaLabel="Repeat Customers Leaderboard"
              />
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — Metric not provided by backend contract
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Workforce Utilization & Conversion Rates */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Briefcase size={17} color="var(--color-primary)" />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                Workforce Capacity & Conversion (PRD §14.2, §14.6)
              </h3>
            </div>
          </div>

          {/* Rate Gauges Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-app)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <DonutGauge
              value={workerRegistrations?.verificationConversion}
              label="Verification Conversion"
              numerator={workerRegistrations?.verified}
              denominator={workerRegistrations?.registered}
              numeratorLabel="verified"
              denominatorLabel="registered"
              colorVariant="primary"
              ariaLabel="Worker Verification Conversion Gauge"
            />
            <DonutGauge
              value={workerUtilization?.utilization}
              label="Workforce Utilization"
              numerator={workerUtilization?.workersWithActiveBooking}
              denominator={workerUtilization?.verifiedWorkers}
              numeratorLabel="active"
              denominatorLabel="verified"
              colorVariant="navy"
              ariaLabel="Worker Utilization Gauge"
            />
            <DonutGauge
              value={interviewConversion?.conversion}
              label="Trial Conversion"
              numerator={interviewConversion?.confirmed}
              denominator={interviewConversion?.interviewsHeld}
              numeratorLabel="confirmed"
              denominatorLabel="trials"
              colorVariant="success"
              ariaLabel="Interview Trial Conversion Gauge"
            />
          </div>

          {/* Top-Rated Workers Leaderboard */}
          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Award size={15} color="var(--color-amber)" />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Top-Rated Verified Workers
              </span>
            </div>
            {topRatedWorkers ? (
              <HorizontalBarChart
                items={topWorkerItems}
                maxItems={4}
                emptyMessage="No rating records available for workers"
                ariaLabel="Top-Rated Workers List"
              />
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — Metric not provided by backend contract
              </div>
            )}
          </div>
        </div>

        {/* Panel 4: Quality Metrics, SLA & Collections by Fee Type */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <AlertOctagon size={17} color="var(--color-primary)" />
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-navy)' }}>
                Quality, Grievance SLA & Collections (PRD §14.7, §14.8, §14.9)
              </h3>
            </div>
          </div>

          {/* Cancellation & Replacement Gauges + Support SLA */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-app)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <DonutGauge
              value={cancellationRate?.cancellationRate}
              label="Cancellation Rate"
              numerator={cancellationRate?.cancelled}
              denominator={cancellationRate?.totalBookings}
              numeratorLabel="cancelled"
              denominatorLabel="total"
              isInverseColorScale={true}
              ariaLabel="Cancellation Rate Gauge"
            />
            <DonutGauge
              value={replacementRate?.replacementRate}
              label="Replacement Rate"
              numerator={replacementRate?.replacementRequests}
              denominator={replacementRate?.activeBookings}
              numeratorLabel="requested"
              denominatorLabel="active"
              isInverseColorScale={true}
              ariaLabel="Replacement Rate Gauge"
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-2)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  border: '8px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-bg-surface)',
                }}
              >
                <Clock size={16} color="var(--color-primary)" style={{ marginBottom: '2px' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-navy)' }}>
                  {formatResolutionTime(supportTickets?.averageResolutionSeconds ?? null)}
                </span>
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-navy)', marginTop: 'var(--space-2)' }}>
                Avg Resolution SLA
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {supportTickets?.closed ?? 0} tickets closed
              </span>
            </div>
          </div>

          {/* Payment Collections by Fee Type */}
          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <CreditCard size={15} color="var(--color-primary)" />
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Fee Collections Breakdown (PRD §14.8)
              </span>
            </div>
            {paymentCollections?.totalsByFeeType && paymentCollections.totalsByFeeType.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {paymentCollections.totalsByFeeType.map((fee, idx) => {
                  const grossINR = fee.grossMinor / 100;
                  const formattedGross = fee.currency === 'INR' ? formatCurrencyINR(grossINR) : `${fee.currency} ${grossINR.toFixed(2)}`;
                  return (
                    <div
                      key={fee.feeCode + idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        backgroundColor: 'var(--color-bg-app)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--color-navy)' }}>{fee.feeCode.replace(/_/g, ' ')}</strong>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                          {fee.payments} transactions • {fee.grossMinor.toLocaleString()} {fee.currency === 'INR' ? 'paise' : 'minor units'}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>
                        {formattedGross}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                — No fee collection totals recorded
              </div>
            )}
          </div>

          {/* Support Ticket Volume by Status (PRD §14.9) */}
          {supportStatusData.length > 0 && (
            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                Support Tickets by Status
              </div>
              <BarChart
                data={supportStatusData}
                height={140}
                emptyMessage="No support tickets recorded"
                ariaLabel="Support Tickets by Status Chart"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
