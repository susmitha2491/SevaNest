import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Shield,
  AlertCircle,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import { VerificationAttentionApplication } from '../domain/types';
import { KPICard } from '../../../shared/components/KPICard/KPICard';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { HorizontalBarChart } from './analytics/charts/HorizontalBarChart';
import { formatRegistrationDateIST } from '../../../shared/formatters/dateTime';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

export const VerificationExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const canViewDashboard = !user || hasPermission(user?.permissions, PERMISSIONS.DASHBOARD_VIEW);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'verification-exec'],
    queryFn: () => dashboardRepository.getVerificationExecutiveDashboard(),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: canViewDashboard,
  });

  const handleRefresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['verification'] }),
    ]);
  };

  const handleOpenDossier = (workerId: string) => {
    navigate(`/verification?workerId=${encodeURIComponent(workerId)}&dossierId=${encodeURIComponent(workerId)}`);
  };

  const handleOpenVerificationQueue = () => {
    navigate('/verification');
  };

  if (!canViewDashboard) {
    return (
      <NoAccessView
        moduleName="Trust & Verification Executive Dashboard"
        requiredPermission={PERMISSIONS.DASHBOARD_VIEW}
      />
    );
  }

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
          onClick={handleRefresh}
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

  // Derive normalized fields with fallback compatibility for mock datasets
  const overview = data.overview || {
    pendingApplications: data.kpis.pendingReview ?? data.kpis.pendingKycSubmitted ?? 0,
    inReview: data.kpis.inProgressReview ?? data.kpis.inReview ?? 0,
    correctionsRequired: data.kpis.correctionsRequired ?? 0,
    recheckDue: data.kpis.reCheckDue ?? 0,
  };

  const statusDistribution = data.statusDistribution || [
    { status: 'PENDING_REVIEW', label: 'Pending Review', count: overview.pendingApplications, color: '#F59E0B' },
    { status: 'IN_REVIEW', label: 'In Review', count: overview.inReview, color: '#3B82F6' },
    { status: 'REJECTED', label: 'Corrections Required / Rejected', count: overview.correctionsRequired, color: '#EF4444' },
    { status: 'RECHECK_DUE', label: 'Re-check Due', count: overview.recheckDue, color: '#8B5CF6' },
    { status: 'APPROVED', label: 'Approved', count: data.kpis.verifiedAndActiveWorkers ?? 0, color: '#10B981' },
  ];

  const recentAttentionApplications: VerificationAttentionApplication[] = data.recentAttentionApplications || [
    ...(data.queues.PENDING_REVIEW || []).map((q) => ({
      id: q.id,
      workerId: q.workerId,
      applicationId: q.id,
      applicantName: q.workerName,
      serviceCategory: q.category,
      submissionDate: q.submissionTime,
      status: q.status,
      isOverdue: false,
      slaFlags: [],
    })),
    ...(data.queues.IN_REVIEW || []).map((q) => ({
      id: q.id,
      workerId: q.workerId,
      applicationId: q.id,
      applicantName: q.workerName,
      serviceCategory: q.category,
      submissionDate: q.submissionTime,
      status: q.status,
      isOverdue: false,
      slaFlags: [],
    })),
    ...(data.queues.REJECTED || []).map((q) => ({
      id: q.id,
      workerId: q.workerId,
      applicationId: q.id,
      applicantName: q.workerName,
      serviceCategory: q.category,
      submissionDate: q.submissionTime,
      status: q.status,
      isOverdue: false,
      slaFlags: [],
    })),
    ...(data.queues.RECHECK_DUE || []).map((q) => ({
      id: q.id,
      workerId: q.workerId,
      applicationId: q.id,
      applicantName: q.workerName,
      serviceCategory: q.category,
      submissionDate: q.submissionTime,
      status: q.status,
      isOverdue: false,
      slaFlags: [],
    })),
  ];

  const slaOverview = data.slaOverview || {
    withinSla: Math.max(0, overview.pendingApplications - (data.kpis.overdueReviews ?? 0)),
    approachingSla: 0,
    slaExceeded: data.kpis.overdueReviews ?? 0,
    notes: 'Duration telemetry pending backend contract',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
            Trust & Verification Console
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Verification Executive Dashboard — Real-time application triage, SLA compliance, and document review workstation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* Registered & Verified Workforce Context */}
          {data.kpis.registeredWorkers !== null && data.kpis.registeredWorkers !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '6px 12px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Users size={14} color="var(--color-text-secondary)" />
              <span>
                <span>Registered Workers</span>:{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>{data.kpis.registeredWorkers}</strong>
              </span>
              <span style={{ color: 'var(--color-border)' }}>•</span>
              <span>
                <span>Verified & Active Workers</span>:{' '}
                <strong style={{ color: 'var(--color-status-success-text)' }}>{data.kpis.verifiedAndActiveWorkers ?? 0}</strong>
              </span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isFetching}
            aria-label="Refresh Queue"
            title="Refresh verification queue and metrics with latest backend data"
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
              opacity: isFetching ? 0.7 : 1,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <RefreshCw
              size={14}
              color="var(--color-primary)"
              style={{
                animation: isFetching ? 'spin 1s linear infinite' : undefined,
              }}
            />
            <span>{isFetching ? 'Refreshing...' : 'Refresh Queue'}</span>
          </button>
        </div>
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
            (1) Phone OTP, (2) Identity, (3) Address, (4) Emergency Contact, (5) Employer Reference, and (6) Police Clearance.
          </div>
        </div>
      </div>

      {/* Section A: Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <KPICard
          title="Pending Applications"
          value={overview.pendingApplications}
          subtitle="Pending KYC / Submitted"
          icon={Clock}
          onClick={() => navigate('/verification?status=PENDING_REVIEW')}
        />
        <KPICard
          title="In Review"
          value={overview.inReview}
          subtitle="Active in-progress dossiers"
          icon={FileText}
          onClick={() => navigate('/verification?status=IN_REVIEW')}
        />
        <KPICard
          title="Corrections Required"
          value={overview.correctionsRequired}
          subtitle="Rejected or rectifying cases"
          icon={AlertCircle}
          onClick={() => navigate('/verification?status=REJECTED')}
        />
        <KPICard
          title="Re-check Due"
          value={overview.recheckDue}
          subtitle="Expiring police & license certs"
          icon={AlertTriangle}
          onClick={() => navigate('/verification?status=RECHECK_DUE')}
        />
      </div>

      {/* Section B & D: Application Status Distribution & SLA Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Section B: Application Status Distribution */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                Application Status Distribution
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Breakdown of applications across verification lifecycle stages
              </p>
            </div>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              {statusDistribution.reduce((acc, curr) => acc + curr.count, 0)} Total
            </div>
          </div>

          <HorizontalBarChart
            items={statusDistribution.map((item) => ({
              id: item.status,
              title: item.label,
              value: item.count,
              formattedValue: `${item.count} app${item.count === 1 ? '' : 's'}`,
              color: item.color,
            }))}
            emptyMessage="No application records in status distribution"
            maxItems={5}
            ariaLabel="Application Status Distribution Chart"
          />
        </div>

        {/* Section D: Verification SLA Overview */}
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
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Verification SLA Overview
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Authoritative SLA performance tracked from backend deadlines (dueAt, isOverdue)
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Within SLA
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-status-success-text)', marginTop: '4px' }}>
                {slaOverview.withinSla}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                On track
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Approaching SLA
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: '#D97706', marginTop: '4px' }}>
                {slaOverview.approachingSla}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                At risk
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                SLA Exceeded
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-status-danger-text)', marginTop: '4px' }}>
                {slaOverview.slaExceeded}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Breached
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section C: Recent Applications Requiring Attention */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Recent Applications Requiring Attention
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Non-approved applications prioritized oldest-first for SLA compliance
            </p>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            {recentAttentionApplications.length} Actionable
          </span>
        </div>

        {recentAttentionApplications.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <CheckCircle2 size={36} color="var(--color-status-success-text)" style={{ margin: '0 auto var(--space-2)' }} />
            <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              All verification queues are up to date. Zero pending worker documents awaiting review.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>Applicant Name</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>Worker / Application ID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>Service Category</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>Submission Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>Verification Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>SLA Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentAttentionApplications.map((app) => (
                  <tr
                    key={app.id || app.workerId}
                    onClick={() => handleOpenDossier(app.workerId)}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, rgba(0,0,0,0.02))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {app.applicantName}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text-secondary)' }}>
                      {app.applicationId || app.workerId}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-primary)' }}>
                      {app.serviceCategory}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {app.submissionDate && app.submissionDate.includes('T')
                        ? formatRegistrationDateIST(app.submissionDate)
                        : (app.submissionDate || 'Recently Submitted')}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <StatusBadge status={app.status} />
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {app.isOverdue || (app.slaFlags && app.slaFlags.includes('OVERDUE')) ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-status-danger-bg)',
                            color: 'var(--color-status-danger-text)',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          Overdue
                        </span>
                      ) : app.slaFlags && app.slaFlags.includes('APPROACHING') ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-status-warning-bg)',
                            color: 'var(--color-status-warning-text)',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          Approaching
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-status-success-bg)',
                            color: 'var(--color-status-success-text)',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          Within SLA
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDossier(app.workerId);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-primary)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Review KYC
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section E: Quick Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-navy)' }}>
            Operational Verification Workstation
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Inspect individual document proofs, review police clearance records, and process application vetting in the queue.
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenVerificationQueue}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 'var(--font-size-xs)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Open Verification Queue</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
