/* global HTMLDivElement, IntersectionObserver, Node */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  ExternalLink,
  Eye,
  AlertTriangle,
  AlertCircle,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { workerRepository, resolveCategoryId } from '../data/workerRepository';
import { Worker, WorkerFilterCriteria } from '../domain/types';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { WorkerDetailModal } from './WorkerDetailModal';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';
import { MaskedPhoneText } from '../../../shared/components/MaskedPhoneText';


type VerificationFilterValue = 'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'RECHECK_DUE';
type WorkerSortOption = 'recently_added' | 'name_asc';

const WORKER_TABS: Array<{ key: VerificationFilterValue; label: string }> = [
  { key: 'ALL', label: 'All Workers' },
  { key: 'VERIFIED', label: 'Active' },
  { key: 'PENDING', label: 'Pending Verification' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'REJECTED', label: 'Rejected / Corrections' },
  { key: 'RECHECK_DUE', label: 'Re-check Due' },
];

function getPrimarySkillDisplay(worker: Worker): { primarySkill: string; extraCount: number } {
  const fromCategories = Array.isArray(worker.categories)
    ? worker.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const fromCategoryStr =
    typeof worker.category === 'string'
      ? worker.category.split(',').map((c) => c.trim()).filter(Boolean)
      : [];
  const explicitPrimary =
    typeof worker.category === 'string' && !worker.category.includes(',')
      ? worker.category.trim()
      : '';

  const seen = new Set<string>();
  const uniqueSkills: string[] = [];
  for (const raw of [
    ...(explicitPrimary ? [explicitPrimary] : []),
    ...(fromCategories.length > 0 ? fromCategories : fromCategoryStr),
  ]) {
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSkills.push(raw);
    }
  }

  const primarySkill = uniqueSkills[0] || 'Domestic Worker';
  const extraCount = uniqueSkills.length > 1 ? uniqueSkills.length - 1 : 0;
  return { primarySkill, extraCount };
}

function getVerificationBadgeSpec(worker: Worker) {
  const isRejected =
    worker.verificationStatus === 'REJECTED' ||
    worker.applicationStatus === 'REJECTED' ||
    worker.status === 'REJECTED';
  const isRecheckDue = worker.verificationStatus === 'RECHECK_DUE';
  const isVerified = worker.isFullyVerified || worker.verificationLevel === 'VERIFIED';
  const isInReview =
    worker.verificationStatus === 'IN_REVIEW' ||
    worker.verificationLevel === 'IN_PROGRESS' ||
    worker.applicationStatus === 'UNDER_REVIEW' ||
    worker.applicationStatus === 'ACTION_REQUIRED';

  if (isRejected) {
    return {
      key: 'REJECTED' as const,
      label: 'Rejected',
      bg: 'var(--color-status-danger-bg)',
      border: 'var(--color-status-danger-border)',
      color: 'var(--color-status-danger-text)',
      testId: 'verification-badge-rejected',
      Icon: AlertTriangle,
    };
  }
  if (isRecheckDue) {
    return {
      key: 'RECHECK_DUE' as const,
      label: 'Re-check Due',
      bg: 'var(--color-status-warning-bg)',
      border: 'var(--color-status-warning-border)',
      color: 'var(--color-status-warning-text)',
      Icon: RefreshCw,
    };
  }
  if (isVerified) {
    return {
      key: 'VERIFIED' as const,
      label: 'Verified',
      bg: 'var(--color-status-success-bg)',
      border: 'var(--color-status-success-border)',
      color: 'var(--color-status-success-text)',
      Icon: CheckCircle2,
    };
  }
  if (isInReview) {
    return {
      key: 'IN_REVIEW' as const,
      label: 'In Review',
      bg: 'var(--color-status-info-bg)',
      border: 'var(--color-status-info-border)',
      color: 'var(--color-status-info-text)',
      Icon: Clock,
    };
  }
  return {
    key: 'PENDING' as const,
    label: 'Pending',
    bg: 'var(--color-status-warning-bg)',
    border: 'var(--color-status-warning-border)',
    color: 'var(--color-status-warning-text)',
    Icon: AlertCircle,
  };
}

export const WorkersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canView = hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'ALL');
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilterValue>(
    () => (searchParams.get('verificationStatus') as VerificationFilterValue) || 'ALL'
  );
  const [sortOption, setSortOption] = useState<WorkerSortOption>('recently_added');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const [detailModalId, setDetailModalId] = useState<string | null>(
    () => searchParams.get('workerId') || searchParams.get('applicationId') || null
  );
  const [refreshToast, setRefreshToast] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSortMenuOpen) return;
    const handleOutside = (e: { target: unknown }) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    const handleEsc = (e: { key: string }) => {
      if (e.key === 'Escape') setIsSortMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSortMenuOpen]);

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
      setVerificationFilter(verif as VerificationFilterValue);
    }
    const cat = searchParams.get('category');
    if (cat) {
      setCategoryFilter(cat);
    }
  }, [searchParams]);

  const handleVerificationFilterChange = (nextVal: VerificationFilterValue) => {
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
  };

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
    isFetching,
  } = useInfiniteQuery({
    queryKey: [
      'workers',
      'infinite',
      debouncedSearchTerm,
      categoryFilter,
      verificationFilter,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      let verifiedParam: boolean | undefined = undefined;
      if (verificationFilter === 'VERIFIED') {
        verifiedParam = true;
      } else if (verificationFilter === 'PENDING' || verificationFilter === 'IN_REVIEW') {
        verifiedParam = false;
      }

      const criteria: WorkerFilterCriteria = {
        searchTerm: debouncedSearchTerm,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        verificationStatus: verificationFilter !== 'ALL' ? verificationFilter : undefined,
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
      const filterUuid = resolveCategoryId(categoryFilter);
      result = result.filter((w) => {
        if (w.category === categoryFilter || (w.categories && w.categories.includes(categoryFilter))) {
          return true;
        }
        if (filterUuid) {
          if (resolveCategoryId(w.category) === filterUuid) return true;
          if (w.categories?.some((c) => resolveCategoryId(c) === filterUuid)) return true;
        }
        return false;
      });
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
        result = result.filter(
          (w) =>
            w.verificationStatus === 'PENDING' &&
            !w.isFullyVerified &&
            w.verificationLevel !== 'IN_PROGRESS' &&
            w.applicationStatus !== 'UNDER_REVIEW' &&
            w.applicationStatus !== 'ACTION_REQUIRED'
        );
      } else if (verificationFilter === 'IN_REVIEW') {
        result = result.filter(
          (w) =>
            (w.verificationStatus === 'IN_REVIEW' ||
             w.verificationLevel === 'IN_PROGRESS' ||
             w.applicationStatus === 'UNDER_REVIEW' ||
             w.applicationStatus === 'ACTION_REQUIRED') &&
            !w.isFullyVerified
        );
      } else if (verificationFilter === 'REJECTED') {
        result = result.filter(
          (w) => w.verificationStatus === 'REJECTED' || w.applicationStatus === 'REJECTED'
        );
      } else if (verificationFilter === 'RECHECK_DUE') {
        result = result.filter((w) => w.verificationStatus === 'RECHECK_DUE');
      }
    }

    result.sort((a, b) => {
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      // Recently Added: sort newest-first using backend timestamps (with ID fallback)
      const timeA = Date.parse(a.createdAt || a.registeredAt || '');
      const timeB = Date.parse(b.createdAt || b.registeredAt || '');
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      if (Number.isFinite(timeB) && !Number.isFinite(timeA)) return 1;
      if (Number.isFinite(timeA) && !Number.isFinite(timeB)) return -1;
      return b.id.localeCompare(a.id);
    });

    return result;
  }, [allWorkers, categoryFilter, verificationFilter, sortOption]);

  const totalCount = data?.pages[0]?.total ?? filteredAndSortedWorkers.length;

  const categories = useMemo(() => {
    const canonicalCategories = [
      'House Maid',
      'Driver',
      'Cook',
      'Babysitter',
      'Elderly Care Helper',
      'Cleaning Helper',
    ];
    const set = new Set<string>(canonicalCategories);
    allWorkers.forEach((w) => {
      w.categories?.forEach((c) => {
        const trimmed = c?.trim();
        if (trimmed && trimmed !== 'ALL') set.add(trimmed);
      });
      if (w.category && w.category !== 'ALL') {
        w.category.split(',').forEach((part) => {
          const trimmed = part.trim();
          if (trimmed && trimmed !== 'ALL') set.add(trimmed);
        });
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [allWorkers]);

  // Scroll event listener on the scrollable table container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      if (hasNextPage && !isFetchingNextPage && !isFetching) {
        fetchNextPage();
      }
    }
  };

  // IntersectionObserver for continuous background loading
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage || isFetching) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage && !isFetching) {
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
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // When filtered workers in the current loaded batch is empty but further server pages exist,
  // automatically advance to next page so matching records in subsequent pages are loaded.
  useEffect(() => {
    if (filteredAndSortedWorkers.length === 0 && hasNextPage && !isFetchingNextPage && !isFetching && !isLoading) {
      fetchNextPage();
    }
  }, [filteredAndSortedWorkers.length, hasNextPage, isFetchingNextPage, isFetching, isLoading, fetchNextPage]);

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
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.25 }}>
            Domestic Worker Roster & Profiles
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Manage worker profiles, skills, and verification status.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await refetch();
            setRefreshToast(true);
            setTimeout(() => setRefreshToast(false), 3000);
          }}
          disabled={isFetching}
          aria-label="Refresh"
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
            cursor: isFetching ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sm)',
            opacity: isFetching ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} color="var(--color-primary)" className={isFetching ? 'animate-spin' : ''} />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {refreshToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
            border: '1px solid var(--color-status-success-border, #a7f3d0)',
            color: 'var(--color-status-success-text, #065f46)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={14} />
          <span>Worker roster successfully refreshed with latest server data.</span>
        </div>
      )}

      {/* Worker Category Tabs */}
      <div
        role="tablist"
        aria-label="Worker verification filters"
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '6px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
        }}
      >
        {WORKER_TABS.map((tab) => {
          const isActive = verificationFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleVerificationFilterChange(tab.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid transparent' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--color-brand-600, var(--color-primary))' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background-color 0.15s ease, color 0.15s ease',
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
            padding: '8px 12px',
            backgroundColor: 'var(--color-status-info-bg)',
            border: '1px solid var(--color-status-info-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-info-text)',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Clock size={15} />
            <span>
              Pending verification workers are excluded from booking matches until Verification Executive review completes.
            </span>
          </div>
          <button
            type="button"
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

      {/* Compact Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-surface, #ffffff)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        }}
      >
        <SearchInput
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
          placeholder="Search by worker name, mobile, or ID..."
          ariaLabel="Search workers"
          containerStyle={{ flex: '1 1 260px', minWidth: 'min(100%, 220px)' }}
        />

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
            label: cat === 'ALL' ? 'Category: All' : cat,
          }))}
          ariaLabel="Filter by skill category"
          minWidth="165px"
        />

        <CustomSelect
          value={verificationFilter}
          onChange={(val) => handleVerificationFilterChange(val as VerificationFilterValue)}
          options={[
            { value: 'ALL', label: 'Verification: All' },
            { value: 'VERIFIED', label: 'Verification: Verified' },
            { value: 'PENDING', label: 'Verification: Pending' },
            { value: 'IN_REVIEW', label: 'Verification: In Review' },
            { value: 'REJECTED', label: 'Verification: Rejected' },
            { value: 'RECHECK_DUE', label: 'Verification: Re-check Due' },
          ]}
          ariaLabel="Filter by verification state"
          minWidth="170px"
        />
      </div>

      {/* Table Section Header + Compact Sort Control */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface)',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Worker Directory
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-bg-subtle)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {filteredAndSortedWorkers.length}
              {totalCount > filteredAndSortedWorkers.length ? ` of ${totalCount}` : ''}
            </span>

            <div ref={sortMenuRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsSortMenuOpen((prev) => !prev)}
                aria-label="Sort worker roster"
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
                title={`Sort: ${sortOption === 'name_asc' ? 'Name A–Z' : 'Recently Added'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: isSortMenuOpen ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <ArrowUpDown size={12} />
                <span>{sortOption === 'name_asc' ? 'Name A–Z' : 'Recently Added'}</span>
              </button>

              {isSortMenuOpen && (
                <div
                  role="menu"
                  aria-label="Sort options"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    minWidth: '150px',
                    backgroundColor: 'var(--color-bg-surface, #ffffff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1))',
                    padding: '4px',
                    zIndex: 30,
                  }}
                >
                  {(
                    [
                      { value: 'recently_added', label: 'Recently Added' },
                      { value: 'name_asc', label: 'Name A–Z' },
                    ] as const
                  ).map((opt) => {
                    const active = sortOption === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setSortOption(opt.value);
                          setIsSortMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          backgroundColor: active ? 'var(--color-brand-50, #f0fdfa)' : 'transparent',
                          color: active ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          fontSize: '12px',
                          fontWeight: active ? 600 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>{opt.label}</span>
                        {active && <Check size={13} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Workers Roster Table with Continuous Scroll and Sticky Header */}
        <div
          data-testid="worker-table-scroll-container"
          ref={tableContainerRef}
          onScroll={handleScroll}
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '620px',
            position: 'relative',
          }}
        >
          <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'var(--color-bg-subtle)',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <tr>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '26%' }}>
                  Worker
                </th>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '22%' }}>
                  Primary Skill
                </th>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '18%' }}>
                  Verification Status
                </th>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '11%' }}>
                  Experience
                </th>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '13%' }}>
                  Account Status
                </th>
                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', whiteSpace: 'nowrap', width: '10%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !data && !isError ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <LoadingSpinner message="Loading domestic worker roster..." />
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-status-danger-text)' }}>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No domestic workers match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSortedWorkers.map((worker: Worker) => {
                  const mobileText = worker.phoneMasked || worker.phone || worker.mobile;
                  const { primarySkill, extraCount } = getPrimarySkillDisplay(worker);
                  const badge = getVerificationBadgeSpec(worker);
                  const BadgeIcon = badge.Icon;
                  const isRejectedWorker =
                    worker.verificationStatus === 'REJECTED' ||
                    worker.applicationStatus === 'REJECTED' ||
                    (worker.onboardingStatus as string) === 'REJECTED' ||
                    worker.status === 'REJECTED';
                  const isAccountActive =
                    !isRejectedWorker &&
                    worker.status === 'ACTIVE' &&
                    worker.accountStatus !== 'SUSPENDED';

                  return (
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
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                          {detailModalId === worker.id ? `${worker.name} (Viewing)` : worker.name}
                        </div>
                        {mobileText && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            <MaskedPhoneText
                              phone={mobileText}
                              unmaskedPhone={worker.phone && !worker.phone.includes('*') ? worker.phone : undefined}
                              entityId={worker.id}
                              entityType="worker"
                              allowReveal={true}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{primarySkill}</span>
                          {extraCount > 0 && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border-subtle)',
                                color: 'var(--color-text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              +{extraCount} {extraCount === 1 ? 'skill' : 'skills'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          data-testid={badge.testId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <BadgeIcon size={11} />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {Number(worker.experienceYears ?? 0)} yrs
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          role="status"
                          aria-label={`Account status: ${isAccountActive ? 'Active' : 'Inactive'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isAccountActive
                              ? 'var(--color-status-success-bg)'
                              : 'var(--color-status-neutral-bg)',
                            border: `1px solid ${
                              isAccountActive
                                ? 'var(--color-status-success-border)'
                                : 'var(--color-status-neutral-border)'
                            }`,
                            color: isAccountActive
                              ? 'var(--color-status-success-text)'
                              : 'var(--color-status-neutral-text)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isAccountActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td
                        style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        <div
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetailModal(worker.id);
                            }}
                            aria-label={`View profile for ${worker.name}`}
                            style={{
                              padding: '5px 10px',
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
                  );
                })
              )}
            </tbody>
          </table>

          {/* Sentinel element for infinite scroll */}
          {hasNextPage && <div ref={sentinelRef} style={{ height: '1px' }} />}

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
