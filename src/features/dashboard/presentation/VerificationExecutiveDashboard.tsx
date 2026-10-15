import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Shield,
  AlertCircle,
  Timer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';

export const VerificationExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'REJECTED'>('PENDING_REVIEW');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'verification-exec'],
    queryFn: () => dashboardRepository.getVerificationExecutiveDashboard(),
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading Trust & Verification Workstation..." />;
  }

  if (isError || !data) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load Verification Queue metrics.';

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
            Trust & Verification Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Strict 6-point verification vetting (1 pre-check OTP + 5 operations checks: Aadhaar, Address, Criminal, Skill, References).
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
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Backend-Backed Trust & Safety Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Pending Review"
          value={kpis.pendingReview}
          subtitle="Ordered oldest-first queue"
          icon={Clock}
          onClick={() => navigate('/verification?status=PENDING_REVIEW')}
        />
        <KPICard
          title="In-Progress Review"
          value={kpis.inProgressReview}
          subtitle="Active claimed dossiers"
          icon={FileText}
          onClick={() => navigate('/verification/my-reviews')}
        />
        <KPICard
          title="Completed Reviews"
          value={kpis.completedReviews ?? 0}
          subtitle="Decisions Today"
          icon={CheckCircle2}
          onClick={() => navigate('/verification/history')}
        />
        <KPICard
          title="Re-Check Due"
          value={kpis.reCheckDue}
          subtitle="Expiring police & license certs"
          icon={AlertTriangle}
          onClick={() => navigate('/verification/rechecks')}
        />
        <KPICard
          title="Corrections Required"
          value={kpis.correctionsRequired ?? 0}
          subtitle="Rejected or rectifying cases"
          icon={AlertCircle}
          onClick={() => navigate('/verification/corrections')}
        />
        <KPICard
          title="Overdue Reviews (SLA)"
          value={kpis.overdueReviews !== null && kpis.overdueReviews !== undefined ? kpis.overdueReviews : 'Unavailable'}
          subtitle={kpis.overdueReviews !== null && kpis.overdueReviews !== undefined ? 'Breached SLA threshold' : 'SLA targets not returned by backend'}
          icon={Timer}
          onClick={() => navigate('/verification')}
        />
        <KPICard
          title="Avg Processing Time"
          value={kpis.avgProcessingTimeMinutes !== null && kpis.avgProcessingTimeMinutes !== undefined ? `${kpis.avgProcessingTimeMinutes}m` : 'Unavailable'}
          subtitle={kpis.avgProcessingTimeMinutes !== null && kpis.avgProcessingTimeMinutes !== undefined ? 'Average cycle duration' : 'Duration telemetry pending backend contract'}
          icon={Clock}
          onClick={() => navigate('/verification/insights')}
        />
      </div>

      {/* 6-Point Verification Policy Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--color-primary-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Shield size={28} color="var(--color-accent)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}>
            Mandatory 6-Point Verification Directive
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            A domestic worker is granted the <code>FULLY_VERIFIED</code> badge only when all 6 validation checks pass on the server:
            (1) Mobile Phone OTP Pre-Check, (2) Government Identity (Aadhaar), (3) Residential Address Proof,
            (4) Criminal Record Self-Declaration, (5) Skill Certificate / Driver License, and (6) Prior Employer Reference Check.
          </div>
        </div>
      </div>

      {/* Operational Verification Workstation Queue Tabs */}
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
            onClick={() => setActiveTab('PENDING_REVIEW')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'PENDING_REVIEW' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'PENDING_REVIEW' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Pending Review (Oldest First) ({queues.PENDING_REVIEW?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('IN_REVIEW')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'IN_REVIEW' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'IN_REVIEW' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            In-Review Workstation ({queues.IN_REVIEW?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('RECHECK_DUE')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'RECHECK_DUE' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'RECHECK_DUE' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Re-Check Due / Expiring Certs ({queues.RECHECK_DUE?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeTab === 'REJECTED' ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'REJECTED' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Corrections Required ({queues.REJECTED?.length || 0})
          </button>
        </div>

        {/* Tab Content Table */}
        <div style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
          {currentQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
              All verification queues are up to date. Zero pending worker documents awaiting review.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                  <th style={{ padding: '8px 12px' }}>Queue ID</th>
                  <th style={{ padding: '8px 12px' }}>Worker Name</th>
                  <th style={{ padding: '8px 12px' }}>Skill Category</th>
                  <th style={{ padding: '8px 12px' }}>Submission Time</th>
                  <th style={{ padding: '8px 12px' }}>Pending Check Types</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentQueue.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.id}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontFamily: 'monospace' }}>{item.workerId}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{item.category}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>{item.submissionTime}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {item.pendingCheckTypes.map((chk, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-bg-app)',
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            {chk}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/verification?search=${encodeURIComponent(item.workerId)}&dossierId=${encodeURIComponent(item.id)}`)}
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
                        <ShieldCheck size={14} />
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
