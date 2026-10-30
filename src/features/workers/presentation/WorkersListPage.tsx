/* global HTMLDivElement, IntersectionObserver */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search,
  Filter,
  ShieldAlert,
  Star,
  RefreshCw,
  Clock,
  CheckCircle2,
  ExternalLink,
  XCircle,
  User,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { verificationRepository } from '../../verification/data/verificationRepository';
import {
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationCheckType,
} from '../../verification/domain/types';
import { Worker, WorkerFilterCriteria } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { WorkerDetailModal } from './WorkerDetailModal';

export const WorkersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'ALL');
  const [verificationFilter, setVerificationFilter] = useState<
    'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'RECHECK_DUE'
  >(
    () =>
      (searchParams.get('verificationStatus') as
        | 'ALL'
        | 'VERIFIED'
        | 'PENDING'
        | 'IN_REVIEW'
        | 'REJECTED'
        | 'RECHECK_DUE') || 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED'>(
    () => (searchParams.get('status') as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED') || 'ALL'
  );
  const [localityFilter, setLocalityFilter] = useState(() => searchParams.get('locality') || 'ALL');
  const [sortField, setSortField] = useState<'ratingAverage' | 'experienceYears' | 'name' | 'id'>('ratingAverage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [detailModalId, setDetailModalId] = useState<string | null>(
    () => searchParams.get('workerId') || searchParams.get('applicationId') || null
  );

  const queryClient = useQueryClient();
  const [rejectWorker, setRejectWorker] = useState<Worker | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectCategory, setRejectCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleOpenReject = (worker: Worker) => {
    setRejectWorker(worker);
    setRejectCategory('BLURRY_IMAGE');
    setRejectRemarks('');
    setRejectError(null);
    setIsRejectDialogOpen(true);
  };

  const handleRejectConfirm = async (remarksFromDialog?: string) => {
    const remarks = (remarksFromDialog || rejectRemarks || '').trim();
    if (!rejectWorker) return;

    if (remarks.length < 5) {
      setRejectError('Rejection remarks must be at least 5 characters');
      return;
    }

    try {
      setIsRejecting(true);
      setRejectError(null);

      let targetCheckId: string | undefined;
      let targetCheckType: VerificationCheckType | undefined;

      try {
        const dossier = await verificationRepository.getDossierById(rejectWorker.id);
        if (dossier?.checks) {
          const activeCheck =
            Object.values(dossier.checks).find((c) => c.status === 'IN_REVIEW' || c.status === 'PENDING') ||
            Object.values(dossier.checks).find((c) => c.status !== 'APPROVED') ||
            Object.values(dossier.checks)[0];
          if (activeCheck?.id) {
            targetCheckId = activeCheck.id;
            targetCheckType = activeCheck.type;
          } else if (dossier.checkId) {
            targetCheckId = dossier.checkId;
          }
        } else if (dossier?.checkId) {
          targetCheckId = dossier.checkId;
        }
      } catch {
        // Fall back if dossier lookup fails
      }

      if (targetCheckId) {
        await verificationRepository.rejectCheck(targetCheckId, targetCheckType, rejectCategory, remarks);
      } else {
        await workerRepository.rejectCheck(rejectWorker.id, rejectCategory, remarks);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workers'] }),
        queryClient.invalidateQueries({ queryKey: ['verification'] }),
        refetch(),
      ]);

      setIsRejectDialogOpen(false);
      setRejectWorker(null);
      setRejectRemarks('');
      setRejectError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject worker verification';
      setRejectError(msg);
    } finally {
      setIsRejecting(false);
    }
  };

  useEffect(() => {
    const wid = searchParams.get('workerId') || searchParams.get('applicationId');
    if (wid !== null) {
      setDetailModalId(wid);
    }
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
    const verif = searchParams.get('verificationStatus');
    if (verif) {
      setVerificationFilter(
        verif as 'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'RECHECK_DUE'
      );
    }
    const stat = searchParams.get('status');
    if (stat) {
      setStatusFilter(stat as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED');
    }
    const cat = searchParams.get('category');
    if (cat) {
      setCategoryFilter(cat);
    }
    const loc = searchParams.get('locality');
    if (loc) {
      setLocalityFilter(loc);
    }
  }, [searchParams]);

  const handleOpenDetailModal = (id: string) => {
    setDetailModalId(id);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      next.set('workerId', id);
      next.delete('applicationId');
      return next;
    }, { replace: true });
  };

  const handleCloseDetailModal = () => {
    setDetailModalId(null);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      next.delete('workerId');
      next.delete('applicationId');
      return next;
    }, { replace: true });
  };

  // Continuous infinite scrolling query using documented worker-list pagination contract
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'workers',
      'infinite',
      searchTerm,
      categoryFilter,
      verificationFilter,
      statusFilter,
      localityFilter,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      let verifiedParam: boolean | undefined = undefined;
      if (verificationFilter === 'VERIFIED') {
        verifiedParam = true;
      } else if (verificationFilter === 'PENDING') {
        verifiedParam = false;
      }

      const criteria: WorkerFilterCriteria = {
        searchTerm,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        locality: localityFilter !== 'ALL' ? localityFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        verified: verifiedParam,
      };

      if (typeof workerRepository.getWorkersPage === 'function') {
        return workerRepository.getWorkersPage(criteria, pageParam, 20);
      }
      const all = await workerRepository.getWorkers(criteria);
      return {
        items: all,
        total: all.length,
        page: 1,
        limit: all.length,
        hasMore: false,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  // Deduplicate worker records across loaded batches using genuine worker ID
  const allWorkers = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: Worker[] = [];
    for (const page of data.pages) {
      for (const worker of page.items) {
        if (!seen.has(worker.id)) {
          seen.add(worker.id);
          list.push(worker);
        }
      }
    }
    return list;
  }, [data?.pages]);

  // Client-side filtering and sorting across all accumulated records
  const filteredAndSortedWorkers = useMemo(() => {
    let result = [...allWorkers];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.id.toLowerCase().includes(term) ||
          w.category.toLowerCase().includes(term) ||
          w.locality.toLowerCase().includes(term)
      );
    }

    if (categoryFilter !== 'ALL') {
      result = result.filter((w) => w.category === categoryFilter || (w.categories && w.categories.includes(categoryFilter)));
    }

    if (verificationFilter !== 'ALL') {
      if (verificationFilter === 'VERIFIED') {
        result = result.filter((w) => w.isFullyVerified === true && w.status === 'ACTIVE');
      } else if (verificationFilter === 'PENDING') {
        result = result.filter((w) => !w.isFullyVerified);
      } else if (verificationFilter === 'IN_REVIEW') {
        result = result.filter((w) => w.verificationStatus === 'IN_REVIEW');
      } else if (verificationFilter === 'REJECTED') {
        result = result.filter((w) => w.verificationStatus === 'REJECTED');
      } else if (verificationFilter === 'RECHECK_DUE') {
        result = result.filter((w) => w.verificationStatus === 'RECHECK_DUE');
      }
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((w) => w.status === statusFilter);
    }

    if (localityFilter !== 'ALL') {
      result = result.filter((w) => w.locality === localityFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'ratingAverage') {
        comparison = a.ratingAverage - b.ratingAverage;
      } else if (sortField === 'experienceYears') {
        comparison = a.experienceYears - b.experienceYears;
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'id') {
        comparison = a.id.localeCompare(b.id);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allWorkers, searchTerm, categoryFilter, verificationFilter, statusFilter, localityFilter, sortField, sortOrder]);

  const totalCount = data?.pages[0]?.total ?? filteredAndSortedWorkers.length;

  const categories = useMemo(() => {
    const set = new Set(allWorkers.map((w) => w.category));
    return ['ALL', ...Array.from(set)];
  }, [allWorkers]);

  const localities = useMemo(() => {
    const set = new Set(allWorkers.map((w) => w.locality));
    return ['ALL', ...Array.from(set)];
  }, [allWorkers]);

  // Scroll event listener on the scrollable table container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  };

  // IntersectionObserver for continuous background loading
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: tableContainerRef.current,
        rootMargin: '120px',
      }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading && !data) {
    return <LoadingSpinner message="Loading domestic worker roster..." />;
  }

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          Failed to load domestic worker roster.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Domestic Worker Roster & Profiles
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Workforce catalog with 6-point verification badge, skill ratings, cluster distribution, and disciplinary controls.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <RefreshCw size={13} color="var(--color-primary)" />
          <span>Refresh Roster</span>
        </button>
      </div>

      {/* Operational Scope Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: 'All Registered Workers' },
          { key: 'VERIFIED', label: 'Active & Verified Roster (Matching Eligible)' },
          { key: 'PENDING', label: 'Pending Verification / Incomplete KYC' },
          { key: 'IN_REVIEW', label: 'In Review Pipeline' },
          { key: 'REJECTED', label: 'Rejected / Corrections' },
          { key: 'RECHECK_DUE', label: 'Re-Check Due' },
        ].map((tab) => {
          const isActive = verificationFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setVerificationFilter(
                  tab.key as 'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'RECHECK_DUE'
                );
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-brand-600, var(--color-primary))' : 'var(--color-bg-subtle)',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Pending Application Review Notice */}
      {verificationFilter === 'PENDING' && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-status-info-bg)',
            border: '1px solid var(--color-status-info-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-info-text)',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Clock size={16} />
            <span>
              <strong>Pending Worker Applications:</strong> These workers have submitted onboarding details but have not completed all 6 verification checks. They cannot be matched to bookings until approved by a Verification Executive.
            </span>
          </div>
          <button
            onClick={() => navigate('/verification')}
            style={{
              padding: '4px 10px',
              backgroundColor: 'var(--color-brand-600, var(--color-primary))',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Open Verification Queue</span>
            <ExternalLink size={12} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search by worker name, ID, category, or locality..."
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              setSearchParams((prev) => {
                const next = new window.URLSearchParams(prev);
                if (val) {
                  next.set('search', val);
                } else {
                  next.delete('search');
                }
                return next;
              }, { replace: true });
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              const val = e.target.value;
              setCategoryFilter(val);
              setSearchParams((prev) => {
                const next = new window.URLSearchParams(prev);
                if (val !== 'ALL') {
                  next.set('category', val);
                } else {
                  next.delete('category');
                }
                return next;
              }, { replace: true });
            }}
            aria-label="Filter by skill category"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'Category: All Skills' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Verification Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={verificationFilter}
            onChange={(e) => {
              const val = e.target.value as 'ALL' | 'VERIFIED' | 'PENDING';
              setVerificationFilter(val);
              setSearchParams((prev) => {
                const next = new window.URLSearchParams(prev);
                if (val !== 'ALL') {
                  next.set('verificationStatus', val);
                } else {
                  next.delete('verificationStatus');
                }
                return next;
              }, { replace: true });
            }}
            aria-label="Filter by verification state"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="ALL">Verification: All</option>
            <option value="VERIFIED">Fully Verified Only</option>
            <option value="PENDING">Pending Verification</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
              setStatusFilter(val);
              setSearchParams((prev) => {
                const next = new window.URLSearchParams(prev);
                if (val !== 'ALL') {
                  next.set('status', val);
                } else {
                  next.delete('status');
                }
                return next;
              }, { replace: true });
            }}
            aria-label="Filter by account status"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLACKLISTED">Blacklisted</option>
          </select>
        </div>

        {/* Locality Filter */}
        <div>
          <select
            value={localityFilter}
            onChange={(e) => {
              const val = e.target.value;
              setLocalityFilter(val);
              setSearchParams((prev) => {
                const next = new window.URLSearchParams(prev);
                if (val !== 'ALL') {
                  next.set('locality', val);
                } else {
                  next.delete('locality');
                }
                return next;
              }, { replace: true });
            }}
            aria-label="Filter by operating locality"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {localities.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'ALL' ? 'Locality: All Clusters' : loc}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Field */}
        <div>
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as ['ratingAverage' | 'experienceYears' | 'name' | 'id', 'asc' | 'desc'];
              setSortField(field);
              setSortOrder(order);
            }}
            aria-label="Sort worker roster"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="ratingAverage-desc">Sort: Highest Rating</option>
            <option value="experienceYears-desc">Sort: Most Experience</option>
            <option value="name-asc">Sort: Worker Name (A-Z)</option>
            <option value="id-asc">Sort: Worker ID</option>
          </select>
        </div>
      </div>

      {/* Workers Roster Table with Continuous Scroll and Sticky Header */}
      <div
        data-testid="worker-table-scroll-container"
        ref={tableContainerRef}
        onScroll={handleScroll}
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border-subtle)',
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '620px',
          position: 'relative',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--color-bg-subtle)',
              borderBottom: '1px solid var(--color-border-subtle)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <tr>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Worker ID
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Worker Name
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Primary Skill
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                KYC Status
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Matching Eligibility
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Experience
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Rating
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Cluster
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Account Status
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedWorkers.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                  No domestic workers match your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredAndSortedWorkers.map((worker: Worker) => (
                <tr
                  key={worker.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View profile for ${worker.name} (${worker.id})`}
                  className="worker-directory-row"
                  onClick={(e) => {
                    const target = e.target as { closest?: (selector: string) => unknown };
                    if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                      return;
                    }
                    handleOpenDetailModal(worker.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenDetailModal(worker.id);
                    }
                  }}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                    <div>{worker.id}</div>
                    {worker.applicationId && worker.applicationId !== worker.id && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        App: {worker.applicationId}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{worker.name}</div>
                    {worker.phoneMasked && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{worker.phoneMasked}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                    <div style={{ fontWeight: 500 }}>{worker.category}</div>
                    {worker.categories && worker.categories.length > 1 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                        {worker.categories
                          .filter((c) => c !== worker.category)
                          .map((cat) => (
                            <span
                              key={cat}
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border-subtle)',
                                color: 'var(--color-text-tertiary)',
                              }}
                            >
                              +{cat}
                            </span>
                          ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <VerificationBadge isFullyVerified={worker.isFullyVerified} status={worker.verificationStatus} />
                    {worker.completedChecksCount != null && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {worker.completedChecksCount}/{worker.totalRequiredChecksCount || 6} checks approved
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {worker.isFullyVerified && worker.status === 'ACTIVE' ? (
                      <span style={{ color: 'var(--color-status-success-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                        <CheckCircle2 size={13} /> Eligible
                      </span>
                    ) : !worker.isFullyVerified ? (
                      <span style={{ color: 'var(--color-status-warning-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                        <Clock size={13} /> Ineligible (KYC Pending)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-status-danger-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                        <ShieldAlert size={13} /> Ineligible ({worker.status})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                    {worker.experienceYears} Years
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: '#b45309' }}>
                      <Star size={13} fill="#f59e0b" color="#f59e0b" /> {worker.ratingAverage}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                    {worker.locality}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={worker.status} />
                  </td>
                  <td
                    style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}
                  >
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetailModal(worker.id);
                        }}
                        aria-label={`View profile for ${worker.name}`}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <User size={13} />
                        <span>View Profile</span>
                      </button>

                      <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal(worker.id);
                          }}
                          aria-label={`Approve verification for ${worker.name}`}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-status-success-text)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReject(worker);
                          }}
                          disabled={worker.verificationStatus === 'REJECTED'}
                          aria-label={`Reject verification for ${worker.name}`}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: worker.verificationStatus === 'REJECTED' ? 'var(--color-text-muted)' : 'var(--color-status-danger-text)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: worker.verificationStatus === 'REJECTED' ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: worker.verificationStatus === 'REJECTED' ? 0.6 : 1,
                          }}
                        >
                          <XCircle size={13} />
                          <span>Reject</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} style={{ height: '1px' }} />

        {/* Loading indicator when fetching additional records */}
        {isFetchingNextPage && (
          <div
            data-testid="loading-more-workers"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              backgroundColor: 'var(--color-bg-subtle)',
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <RefreshCw size={14} className="animate-spin" />
            <span>Loading more worker records...</span>
          </div>
        )}

        {/* Continuous scroll status indicator when all records are loaded */}
        {!hasNextPage && filteredAndSortedWorkers.length > 0 && (
          <div
            data-testid="continuous-scroll-footer"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              borderTop: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
            }}
          >
            All {totalCount} worker records loaded • Continuous scroll
          </div>
        )}
      </div>

      {/* Detailed Worker Profile / Operational Dossier Modal */}
      {detailModalId && (
        <WorkerDetailModal
          workerId={detailModalId}
          onClose={handleCloseDetailModal}
          onStatusChanged={() => refetch()}
        />
      )}

      {/* Reject Worker Verification Dialog */}
      <ConfirmDialog
        isOpen={isRejectDialogOpen}
        title={`Reject Verification: ${rejectWorker?.name || ''}`}
        description="Select an operational rejection reason category and provide mandatory remarks. The applicant will be notified to re-upload or rectify."
        confirmLabel="Confirm Rejection"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational remarks (e.g., Image is blurred, name mismatch with registration records)..."
        isLoading={isRejecting}
        errorMessage={rejectError || undefined}
        onConfirm={handleRejectConfirm}
        onCancel={() => {
          setIsRejectDialogOpen(false);
          setRejectWorker(null);
          setRejectRemarks('');
          setRejectError(null);
        }}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label
            htmlFor="rejection-category-select"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Rejection Reason Category:
          </label>
          <select
            id="rejection-category-select"
            aria-label="Rejection Reason Category"
            value={rejectCategory}
            onChange={(e) => setRejectCategory(e.target.value as RejectionReasonCategory)}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
          >
            {REJECTION_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>
    </div>
  );
};
