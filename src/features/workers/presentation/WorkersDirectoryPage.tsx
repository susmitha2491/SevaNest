import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Users,
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
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Skill Categories' },
  { value: 'COOKING', label: 'Cook / Cooking' },
  { value: 'CLEANING', label: 'Cleaning Helper' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'BABYSITTER', label: 'Babysitter' },
  { value: 'CHILDCARE', label: 'Childcare' },
  { value: 'ELDERLY_CARE', label: 'Elderly Care Helper' },
  { value: 'HOUSE_MAID', label: 'House Maid' },
];

export const WorkersDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canView = hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(() => searchParams.get('workerId'));
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const wid = searchParams.get('workerId');
    if (wid !== selectedWorkerId) {
      setSelectedWorkerId(wid);
    }
  }, [searchParams, selectedWorkerId]);

  const handleSelectWorker = (id: string | null) => {
    setSelectedWorkerId(id);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      if (id) {
        next.set('workerId', id);
        if (!next.has('workerTab')) {
          next.set('workerTab', 'details');
        }
      } else {
        next.delete('workerId');
        next.delete('workerTab');
        next.delete('docId');
      }
      return next;
    });
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  const {
    data: pageResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['workers-directory', { searchTerm: debouncedSearchTerm, selectedCategory, page }],
    queryFn: async () => {
      return await workerRepository.getWorkersPage(
        {
          verified: true,
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          searchTerm: debouncedSearchTerm.trim() || undefined,
        },
        page,
        pageSize
      );
    },
    enabled: canView,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
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
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '16px',
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
      >
        <SearchInput
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
          placeholder="Search verified worker by name or mobile..."
          ariaLabel="Search verified workers"
          isLoading={isFetching && debouncedSearchTerm.trim().length > 0}
          containerStyle={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)' }}
        />

        <CustomSelect
          value={selectedCategory}
          onChange={(val) => {
            setSelectedCategory(val);
            setPage(1);
          }}
          options={CATEGORY_OPTIONS}
          ariaLabel="Filter by skill category"
          minWidth="180px"
        />
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
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs, 12px)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', width: '80px' }}>
                    Worker ID
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Worker Name & Contact
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Skill Categories
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Experience & Rating
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Locality
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    KYC & Platform Status
                  </th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '135px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker: Worker) => {
                  const skillList: string[] = [];
                  const addSkill = (val?: string) => {
                    if (!val) return;
                    val.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
                      if (!skillList.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
                        skillList.push(s);
                      }
                    });
                  };
                  if (worker.category) addSkill(worker.category);
                  if (worker.categories && Array.isArray(worker.categories)) {
                    worker.categories.forEach((cat) => addSkill(cat));
                  }
                  if (skillList.length === 0) skillList.push('General');

                  const visibleSkills = skillList.slice(0, 1);
                  const remainingSkills = skillList.length - 1;

                  return (
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
                        handleSelectWorker(worker.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          e.preventDefault();
                          handleSelectWorker(worker.id);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span
                          title={worker.id}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '11px',
                            color: 'var(--color-primary)',
                            display: 'inline-block',
                            maxWidth: '75px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            verticalAlign: 'middle',
                          }}
                        >
                          {worker.id}
                        </span>
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{worker.name}</div>
                        {(worker.phone || worker.mobile || worker.phoneMasked) && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px', whiteSpace: 'nowrap' }}>
                            {worker.phone || worker.mobile || worker.phoneMasked}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap' }}>
                          {visibleSkills.map((skill, sIdx) => (
                            <span
                              key={skill}
                              title={skillList.join(', ')}
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: sIdx === 0 ? 'var(--color-bg-subtle)' : 'var(--color-bg-app)',
                                color: sIdx === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {skill}
                            </span>
                          ))}
                          {remainingSkills > 0 && (
                            <span
                              title={skillList.slice(1).join(', ')}
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-app)',
                                color: 'var(--color-text-muted)',
                                border: '1px solid var(--color-border)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              +{remainingSkills}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
                          <Briefcase size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                          <span>{worker.experienceYears || 0} yrs</span>
                          <span style={{ color: 'var(--color-border)' }}>•</span>
                          <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600 }}>{worker.ratingAverage ? Number(worker.ratingAverage).toFixed(1) : 'New'}</span>
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                          <span>{worker.locality || 'Hyderabad'}</span>
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <VerificationBadge isFullyVerified={true} status="VERIFIED" />
                          <StatusBadge status={worker.status || 'ACTIVE'} />
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/verification?workerId=${encodeURIComponent(worker.id)}`);
                            }}
                            style={{
                              padding: '4px 6px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-primary-subtle)',
                              backgroundColor: 'var(--color-primary-subtle)',
                              color: 'var(--color-primary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
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
                              handleSelectWorker(worker.id);
                            }}
                            style={{
                              padding: '4px 6px',
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
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Eye size={12} />
                            <span>View Profile</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          onClose={() => handleSelectWorker(null)}
        />
      )}
    </div>
  );
};
