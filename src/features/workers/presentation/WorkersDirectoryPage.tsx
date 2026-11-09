import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Star,
  MapPin,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { Worker } from '../domain/types';
import { WorkerDirectoryModal } from './WorkerDirectoryModal';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Skill Categories' },
  { value: 'COOKING', label: 'Cooking' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'ELDERLY_CARE', label: 'Elderly Care' },
  { value: 'CHILDCARE', label: 'Childcare' },
  { value: 'GARDENING', label: 'Gardening' },
  { value: 'PET_CARE', label: 'Pet Care' },
];

export const WorkersDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canView = hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const {
    data: pageResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['workers-directory', { searchTerm, selectedCategory, page }],
    queryFn: async () => {
      return await workerRepository.getWorkersPage(
        {
          verified: true,
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          searchTerm: searchTerm.trim() || undefined,
        },
        page,
        pageSize
      );
    },
    enabled: canView,
    staleTime: 30 * 1000,
  });

  const workers = useMemo(() => {
    const raw = pageResult?.items || [];
    return raw.filter((w) => {
      const isVerified = Boolean(
        w.isFullyVerified === true ||
        w.verificationLevel === 'VERIFIED' ||
        w.verificationStatus === 'VERIFIED' ||
        w.applicationStatus === 'VERIFIED' ||
        w.applicationStatus === 'ACTIVE' ||
        Boolean(w.signedOffAt)
      );
      const isNotRejected =
        w.verificationStatus !== 'REJECTED' &&
        w.applicationStatus !== 'REJECTED' &&
        w.onboardingStatus !== 'REJECTED';
      const isActive =
        w.status === 'ACTIVE' || w.accountStatus === 'ACTIVE' || (w.status as string) === 'VERIFIED';
      return isVerified && isNotRejected && isActive;
    });
  }, [pageResult]);
  const total = pageResult?.total !== undefined && pageResult.total === (pageResult?.items?.length ?? 0)
    ? workers.length
    : (pageResult?.total ?? workers.length);

  if (!canView) {
    return <NoAccessView moduleName="Workers Directory" requiredPermission={PERMISSIONS.WORKER_VIEW} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Users size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Workers Directory
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Authoritative directory of active, fully verified domestic household professionals on SevaNest.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
              border: '1px solid var(--color-status-success-border, #10b981)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-status-success-text, #065f46)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{total} Verified Workers Onboarded</span>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search verified worker by name or mobile..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-bg-app)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-bg-app)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <LoadingSpinner message="Loading verified workers directory..." />
          </div>
        ) : isError ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-error)' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 8px' }} />
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>Unable to Load Directory</h3>
            <p style={{ margin: '4px 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {error instanceof Error ? error.message : 'Error fetching workers from backend.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                padding: '6px 14px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        ) : workers.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
              No Verified Workers Found
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)' }}>
              {searchTerm || selectedCategory !== 'ALL'
                ? 'Try clearing your search term or category filters.'
                : 'No workers have completed the full KYC verification and supervisor onboarding process yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Worker ID
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Worker Name & Contact
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Skill Categories
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Experience & Rating
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Locality
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    KYC & Platform Status
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker: Worker) => (
                  <tr
                    key={worker.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View profile for ${worker.name} (${worker.id})`}
                    className="worker-directory-row clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      setSelectedWorkerId(worker.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        setSelectedWorkerId(worker.id);
                      }
                    }}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {worker.id}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{worker.name}</div>
                      {(worker.phone || worker.mobile || worker.phoneMasked) && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {worker.phone || worker.mobile || worker.phoneMasked}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {worker.category || 'General'}
                        </span>
                        {worker.categories && worker.categories.filter((c) => c !== worker.category).map((cat) => (
                          <span
                            key={cat}
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-bg-app)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            +{cat}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Briefcase size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span>{worker.experienceYears || 0} yrs</span>
                        <span style={{ color: 'var(--color-border)' }}>•</span>
                        <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                        <span style={{ fontWeight: 600 }}>{worker.ratingAverage ? Number(worker.ratingAverage).toFixed(1) : 'New'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span>{worker.locality || 'Hyderabad'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <VerificationBadge isFullyVerified={true} status="VERIFIED" />
                        <StatusBadge status={worker.status || 'ACTIVE'} />
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/verification?workerId=${encodeURIComponent(worker.id)}`);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-primary-subtle)',
                            backgroundColor: 'var(--color-primary-subtle)',
                            color: 'var(--color-primary)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Inspect verification dossier"
                        >
                          <ShieldCheck size={12} />
                          <span>Dossier</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWorkerId(worker.id);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={12} />
                          <span>View Profile</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination / Continuous Scrolling Controls */}
        {total > pageSize && (
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
              borderTop: '1px solid var(--color-border)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>
              Showing {workers.length} of {total} verified workers
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontWeight: 600 }}>
                Page {page}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={pageResult?.hasMore === false || workers.length < pageSize}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: pageResult?.hasMore === false || workers.length < pageSize ? 'not-allowed' : 'pointer',
                  opacity: pageResult?.hasMore === false || workers.length < pageSize ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Worker Detail Modal */}
      {selectedWorkerId && (
        <WorkerDirectoryModal
          workerId={selectedWorkerId}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}
    </div>
  );
};
