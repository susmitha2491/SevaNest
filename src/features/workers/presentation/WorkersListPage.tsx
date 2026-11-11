/* global HTMLDivElement, IntersectionObserver */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ShieldAlert,
  Star,
  RefreshCw,
  Clock,
  CheckCircle2,
  ExternalLink,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { Worker, WorkerFilterCriteria } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { WorkerDetailModal } from './WorkerDetailModal';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

export const WorkersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canView = hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);
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

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync debounced search to URL without reloading or thrashing
  useEffect(() => {
    const trimmed = debouncedSearchTerm.trim();
    if (trimmed !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = trimmed;
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        if (trimmed) {
          if (next.get('search') !== trimmed) next.set('search', trimmed);
        } else {
          if (next.has('search')) next.delete('search');
        }
        return next;
      }, { replace: true });
    }
  }, [debouncedSearchTerm, setSearchParams]);

  useEffect(() => {
    const wid = searchParams.get('workerId') || searchParams.get('applicationId');
    if (wid !== null) {
      setDetailModalId(wid);
    }
    const q = searchParams.get('search') || '';
    if (q !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = q;
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
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'workers',
      'infinite',
      debouncedSearchTerm,
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
        searchTerm: debouncedSearchTerm,
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
    enabled: canView,
    retry: false,
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

  // Sort and filter accumulated infinite-scroll records preserving complete server-side search results
  const filteredAndSortedWorkers = useMemo(() => {
    // Incomplete draft registrations must never be displayed as onboarded workers
    let result = allWorkers.filter((w) => w.applicationStatus !== 'DRAFT' && w.onboardingStatus !== 'DRAFT');

    if (categoryFilter !== 'ALL') {
      result = result.filter((w) => w.category === categoryFilter || (w.categories && w.categories.includes(categoryFilter)));
    }

    if (verificationFilter !== 'ALL') {
      if (verificationFilter === 'VERIFIED') {
        result = result.filter(
          (w) =>
            w.isFullyVerified === true &&
            (w.status === 'ACTIVE' || w.status === 'VERIFIED') &&
            w.matchingEligible === true &&
            w.applicationStatus !== 'DRAFT' &&
            w.applicationStatus !== 'UNDER_REVIEW' &&
            w.applicationStatus !== 'SUBMITTED'
        );
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
  }, [allWorkers, categoryFilter, verificationFilter, statusFilter, localityFilter, sortField, sortOrder]);

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

  if (!canView) {
    return <NoAccessView moduleName="Domestic Worker Management" requiredPermission={PERMISSIONS.WORKER_VIEW} />;
  }

  if (isError && !searchTerm) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.25 }}>
            Domestic Worker Roster & Profiles
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Workforce catalog with 6-point verification badge, skill ratings, cluster distribution, and disciplinary controls.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '5px 10px',
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
          <RefreshCw size={12} color="var(--color-primary)" />
          <span>Refresh Roster</span>
        </button>
      </div>

      {/* Operational Scope Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
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
                padding: '5px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-brand-600, var(--color-primary))' : 'var(--color-bg-subtle)',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
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
          gap: '12px',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-surface, #ffffff)',
          padding: '16px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
      >
        {/* Search */}
        <SearchInput
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
          placeholder="Search by worker name, ID, category, or locality..."
          ariaLabel="Search workers"
          containerStyle={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)' }}
        />

        {/* Category Filter */}
        <CustomSelect
          value={categoryFilter}
          onChange={(val) => {
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
          options={categories.map((cat) => ({
            value: cat,
            label: cat === 'ALL' ? 'Category: All Skills' : cat,
          }))}
          ariaLabel="Filter by skill category"
          minWidth="160px"
        />

        {/* Verification Status Filter */}
        <CustomSelect
          value={verificationFilter}
          onChange={(val) => {
            const nextVal = val as 'ALL' | 'VERIFIED' | 'PENDING';
            setVerificationFilter(nextVal);
            setSearchParams((prev) => {
              const next = new window.URLSearchParams(prev);
              if (nextVal !== 'ALL') {
                next.set('verificationStatus', nextVal);
              } else {
                next.delete('verificationStatus');
              }
              return next;
            }, { replace: true });
          }}
          options={[
            { value: 'ALL', label: 'Verification: All' },
            { value: 'VERIFIED', label: 'Fully Verified Only' },
            { value: 'PENDING', label: 'Pending Verification' },
          ]}
          ariaLabel="Filter by verification state"
          minWidth="170px"
        />

        {/* Status Filter */}
        <CustomSelect
          value={statusFilter}
          onChange={(val) => {
            const nextVal = val as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
            setStatusFilter(nextVal);
            setSearchParams((prev) => {
              const next = new window.URLSearchParams(prev);
              if (nextVal !== 'ALL') {
                next.set('status', nextVal);
              } else {
                next.delete('status');
              }
              return next;
            }, { replace: true });
          }}
          options={[
            { value: 'ALL', label: 'Status: All' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'BLACKLISTED', label: 'Blacklisted' },
          ]}
          ariaLabel="Filter by account status"
          minWidth="150px"
        />

        {/* Locality Filter */}
        <CustomSelect
          value={localityFilter}
          onChange={(val) => {
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
          options={localities.map((loc) => ({
            value: loc,
            label: loc === 'ALL' ? 'Locality: All Clusters' : loc,
          }))}
          ariaLabel="Filter by operating locality"
          minWidth="160px"
        />

        {/* Sort Field */}
        <CustomSelect
          value={`${sortField}-${sortOrder}`}
          onChange={(val) => {
            const [field, order] = val.split('-') as ['ratingAverage' | 'experienceYears' | 'name' | 'id', 'asc' | 'desc'];
            setSortField(field);
            setSortOrder(order);
          }}
          options={[
            { value: 'ratingAverage-desc', label: 'Sort: Highest Rating' },
            { value: 'experienceYears-desc', label: 'Sort: Most Experience' },
            { value: 'name-asc', label: 'Sort: Worker Name (A-Z)' },
            { value: 'id-asc', label: 'Sort: Worker ID' },
          ]}
          ariaLabel="Sort worker roster"
          minWidth="175px"
        />
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
        <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
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
            {isLoading && !data && !isError ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                  <LoadingSpinner message="Loading domestic worker roster..." />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-status-danger-text)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AlertTriangle size={24} />
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Backend Validation Error</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', maxWidth: '480px' }}>
                      {error instanceof Error ? error.message : 'Validation failed while retrieving workers from the backend.'}
                    </span>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSearchParams((prev) => {
                          const next = new window.URLSearchParams(prev);
                          next.delete('search');
                          return next;
                        }, { replace: true });
                        refetch();
                      }}
                      style={{
                        marginTop: 'var(--space-2)',
                        padding: '6px 14px',
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear Search & Reset
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedWorkers.length === 0 ? (
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
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {detailModalId === worker.id ? `${worker.name} (Viewing)` : worker.name}
                    </div>
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
                    {(() => {
                      const isVerified = worker.isFullyVerified || worker.verificationLevel === 'VERIFIED';
                      const isRejected = worker.verificationStatus === 'REJECTED' || worker.applicationStatus === 'REJECTED';
                      const isInProgress = worker.verificationLevel === 'IN_PROGRESS' || worker.applicationStatus === 'UNDER_REVIEW';
                      const statusToShow = isRejected ? 'REJECTED' : isVerified ? 'VERIFIED' : isInProgress ? 'IN_REVIEW' : 'PENDING';
                      return (
                        <div>
                          <VerificationBadge isFullyVerified={isVerified} status={statusToShow} />
                          {worker.signedOffAt && (
                            <div style={{ fontSize: '10px', color: 'var(--color-success)', marginTop: '2px', fontWeight: 600 }}>
                              Signed Off{worker.activatedAt ? ' • Activated' : ''}
                            </div>
                          )}
                          {!worker.signedOffAt && isVerified && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Awaiting Sign-Off
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {(() => {
                      const isEligible = worker.matchingEligible ?? (worker.isFullyVerified && (worker.accountStatus === 'ACTIVE' || worker.status === 'ACTIVE') && (!worker.signedOffAt || Boolean(worker.signedOffAt && worker.activatedAt)));
                      if (isEligible) {
                        return (
                          <span style={{ color: 'var(--color-status-success-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                            <CheckCircle2 size={13} /> Eligible
                          </span>
                        );
                      }
                      if (worker.verificationStatus === 'REJECTED' || worker.applicationStatus === 'REJECTED') {
                        return (
                          <span style={{ color: 'var(--color-status-danger-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                            <ShieldAlert size={13} /> Ineligible (Rejected)
                          </span>
                        );
                      }
                      if (worker.accountStatus === 'SUSPENDED' || worker.status === 'SUSPENDED') {
                        return (
                          <span style={{ color: 'var(--color-status-danger-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                            <ShieldAlert size={13} /> Ineligible (Suspended)
                          </span>
                        );
                      }
                      if (worker.isFullyVerified && worker.signedOffAt && !worker.activatedAt) {
                        return (
                          <span style={{ color: 'var(--color-status-warning-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                            <Clock size={13} /> Ineligible (Pending Activation)
                          </span>
                        );
                      }
                      if (worker.isFullyVerified && !worker.signedOffAt) {
                        return (
                          <span style={{ color: 'var(--color-status-warning-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                            <Clock size={13} /> Ineligible (Pending Sign-Off)
                          </span>
                        );
                      }
                      return (
                        <span style={{ color: 'var(--color-status-warning-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                          <Clock size={13} /> Ineligible (KYC Pending)
                        </span>
                      );
                    })()}
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
                    {worker.status === 'SUSPENDED' || worker.status === 'BLACKLISTED' ? (
                      <StatusBadge status={worker.status} />
                    ) : worker.verificationStatus === 'REJECTED' || (worker.onboardingStatus as string) === 'REJECTED' || worker.status === 'REJECTED' ? (
                      <StatusBadge status="REJECTED" />
                    ) : (
                      <StatusBadge status={worker.status} />
                    )}
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
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={13} />
                        <span>View Profile</span>
                      </button>
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

      {/* Detailed Worker Profile / Operational Dossier Modal (Read-Only KYC in Worker Management) */}
      {detailModalId && (
        <WorkerDetailModal
          workerId={detailModalId}
          onClose={handleCloseDetailModal}
          onStatusChanged={() => refetch()}
          readOnly={true}
        />
      )}
    </div>
  );
};
