import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  PieChart,
  ArrowRight,
  TrendingUp,
  Info,
} from 'lucide-react';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { verificationRepository } from '../data/verificationRepository';

export const VerificationInsightsPage: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['verification', 'insights-data'],
    queryFn: async () => {
      const [pendingRes, inReviewRes, recheckRes, rejectedRes, approvedRes] = await Promise.all([
        verificationRepository.getVerificationQueue({ status: 'PENDING_REVIEW', page: 1, pageSize: 50 }),
        verificationRepository.getVerificationQueue({ status: 'IN_REVIEW', page: 1, pageSize: 50 }),
        verificationRepository.getVerificationQueue({ status: 'RECHECK_DUE', page: 1, pageSize: 50 }),
        verificationRepository.getVerificationQueue({ status: 'REJECTED', page: 1, pageSize: 50 }),
        verificationRepository.getVerificationQueue({ status: 'APPROVED', page: 1, pageSize: 50 }),
      ]);

      const pendingCount = pendingRes.totalCount;
      const inReviewCount = inReviewRes.totalCount;
      const recheckCount = recheckRes.totalCount;
      const rejectedCount = rejectedRes.totalCount;
      const approvedCount = approvedRes.totalCount;

      const totalActiveBacklog = pendingCount + inReviewCount + recheckCount;
      const totalDecided = approvedCount + rejectedCount;
      const totalTracked = totalActiveBacklog + totalDecided;

      // Category breakdown from loaded items
      const categoryCounts: Record<string, number> = {};
      const allLoaded = [
        ...pendingRes.items,
        ...inReviewRes.items,
        ...recheckRes.items,
        ...rejectedRes.items,
        ...approvedRes.items,
      ];

      allLoaded.forEach((item) => {
        const cat = item.category || 'General';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // Rejection categories from rejected items
      const rejectionReasonCounts: Record<string, number> = {};
      rejectedRes.items.forEach((item) => {
        Object.values(item.checks || {}).forEach((chk) => {
          if (chk.status === 'REJECTED') {
            const reason = chk.rejectionCategory || 'DOCUMENT_DEFECT';
            rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] || 0) + 1;
          }
        });
      });

      return {
        pendingCount,
        inReviewCount,
        recheckCount,
        rejectedCount,
        approvedCount,
        totalActiveBacklog,
        totalDecided,
        totalTracked,
        approvalRatePct: totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : 0,
        categoryCounts,
        rejectionReasonCounts,
      };
    },
  });

  if (isLoading) {
    return <LoadingSpinner message="Calculating verification workload metrics and aggregate insights..." />;
  }

  if (isError || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          Failed to load verification analytics.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Verification Workload & Performance Insights
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Authoritative status distribution, review queue throughput, and compliance breakdown computed from real backend records.
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
          <span>Refresh Insights</span>
        </button>
      </div>

      {/* Honest Backend Telemetry Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-primary-subtle)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--color-primary)' }}>Telemetry & Data Fidelity:</strong> Workload counts below reflect real database records. Turnaround cycle durations and historical SLA graphs require backend timestamp telemetry (documented in Integration Gap Register Dependency 6).
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Active Backlog"
          value={data.totalActiveBacklog}
          subtitle="Pending + in-review + recheck"
          icon={Clock}
          onClick={() => navigate('/verification')}
        />
        <KPICard
          title="Completed Reviews"
          value={data.approvedCount}
          subtitle="Approved workforce dossiers"
          icon={CheckCircle2}
          onClick={() => navigate('/verification/history')}
        />
        <KPICard
          title="Approval Rate"
          value={`${data.approvalRatePct}%`}
          subtitle={`Based on ${data.totalDecided} decided applications`}
          icon={TrendingUp}
        />
        <KPICard
          title="Corrections Workload"
          value={data.rejectedCount}
          subtitle="Rejected or rectifying cases"
          icon={AlertCircle}
          onClick={() => navigate('/verification/corrections')}
        />
        <KPICard
          title="Re-Check Due"
          value={data.recheckCount}
          subtitle="Expiring annual certs"
          icon={AlertTriangle}
          onClick={() => navigate('/verification/rechecks')}
        />
      </div>

      {/* Queue Distribution & Breakdown Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Workload Status Distribution */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <PieChart size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: 0 }}>
              Queue Distribution by Status
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: 'Pending Review', count: data.pendingCount, color: 'var(--color-brand-600)', path: '/verification?status=PENDING_REVIEW' },
              { label: 'Active In-Review', count: data.inReviewCount, color: '#0284c7', path: '/verification/my-reviews' },
              { label: 'Re-Check Due', count: data.recheckCount, color: '#f59e0b', path: '/verification/rechecks' },
              { label: 'Corrections Required', count: data.rejectedCount, color: '#ef4444', path: '/verification/corrections' },
              { label: 'Fully Approved', count: data.approvedCount, color: '#10b981', path: '/verification/history' },
            ].map((st) => {
              const pct = data.totalTracked > 0 ? Math.round((st.count / data.totalTracked) * 100) : 0;
              return (
                <div key={st.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{st.label}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {st.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: st.color,
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Workload Distribution */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <BarChart3 size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: 0 }}>
              Workload by Service Category
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {Object.keys(data.categoryCounts).length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>No category data available.</p>
            ) : (
              Object.entries(data.categoryCounts).map(([cat, cnt]) => (
                <div
                  key={cat}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{cat}</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-brand-100, #e0f2fe)',
                      color: 'var(--color-brand-700, #0369a1)',
                      fontWeight: 700,
                    }}
                  >
                    {cnt} records
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rejection Category Root Causes & SLA Telemetry Notice */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Rejection Reasons */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: '0 0 var(--space-3) 0' }}>
            Frequent Rejection & Rectification Causes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {Object.keys(data.rejectionReasonCounts).length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                Zero active rejection categories recorded in loaded queue.
              </p>
            ) : (
              Object.entries(data.rejectionReasonCounts).map(([reason, cnt]) => (
                <div
                  key={reason}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-status-danger-bg)',
                    color: 'var(--color-status-danger-text)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{reason.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 700 }}>{cnt} occurrences</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SLA Telemetry Note Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: '0 0 var(--space-2) 0' }}>
              Operational Turnaround SLA Assessment
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              The SevaNest trust framework targets a <strong>24-hour turnaround</strong> for domestic worker KYC. Historical latency logging and executive processing time per dossier require backend timestamps. Until supported by the server, arbitrary metrics or simulated SLAs are explicitly withheld.
            </p>
          </div>
          <button
            onClick={() => navigate('/verification')}
            style={{
              marginTop: 'var(--space-4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-brand-600)',
              color: '#ffffff',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span>Go to Active Verification Workstation</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
