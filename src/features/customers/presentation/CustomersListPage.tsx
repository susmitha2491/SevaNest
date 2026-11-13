/* global HTMLDivElement, IntersectionObserver */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ban, RefreshCw, CheckCircle, X } from 'lucide-react';
import { customerRepository } from '../data/customerRepository';
import { Customer } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { useAuthStore } from '../../../core/auth/authStore';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { CustomerDetailModal } from './CustomerDetailModal';
import { updateCustomerStatusInCache } from '../utils/customerCache';
import { formatRegistrationDateIST } from '../../../shared/formatters/dateTime';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

type CustomerSortField = 'registeredDate' | 'name' | 'id' | 'totalBookings';

function parseRegisteredTimestamp(raw: string | undefined): number {
  if (!raw) return NaN;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? NaN : ms;
}

export const CustomersListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const canView = hasPermission(user?.permissions, PERMISSIONS.CUSTOMER_VIEW);

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>(
    () => (searchParams.get('status') as 'ALL' | 'ACTIVE' | 'SUSPENDED') || 'ALL'
  );
  const [localityFilter, setLocalityFilter] = useState(() => searchParams.get('locality') || 'ALL');
  const [sortField, setSortField] = useState<CustomerSortField>('registeredDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailModalId, setDetailModalId] = useState<string | null>(() => searchParams.get('customerId') || null);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync debounced search term to URL
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
    const cid = searchParams.get('customerId');
    if (cid !== detailModalId) {
      setDetailModalId(cid);
    }
    const q = searchParams.get('search') || '';
    if (q !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = q;
      setSearchTerm(q);
    }
    const stat = searchParams.get('status');
    if (stat && stat !== statusFilter) {
      setStatusFilter(stat as 'ALL' | 'ACTIVE' | 'SUSPENDED');
    }
    const loc = searchParams.get('locality');
    if (loc && loc !== localityFilter) {
      setLocalityFilter(loc);
    }
  }, [searchParams, detailModalId, statusFilter, localityFilter]);

  const handleOpenDetailModal = (id: string) => {
    setDetailModalId(id);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      next.set('customerId', id);
      return next;
    }, { replace: true });
  };

  const handleCloseDetailModal = () => {
    setDetailModalId(null);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      next.delete('customerId');
      return next;
    }, { replace: true });
  };

  // Continuous infinite scrolling query using documented pagination contract
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
    queryKey: ['customers', 'infinite', debouncedSearchTerm, statusFilter, localityFilter],
    queryFn: async ({ pageParam = 1 }) => {
      if (typeof customerRepository.getCustomersPage === 'function') {
        return customerRepository.getCustomersPage(
          {
            searchTerm: debouncedSearchTerm,
            status: statusFilter,
            locality: localityFilter,
          },
          pageParam,
          20
        );
      }
      const all = await customerRepository.getCustomers({
        searchTerm: debouncedSearchTerm,
        status: statusFilter,
        locality: localityFilter,
      });
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
  });

  // Deduplicate customer records across loaded batches
  const allCustomers = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const list: Customer[] = [];
    for (const page of data.pages) {
      for (const customer of page.items) {
        if (!seen.has(customer.id)) {
          seen.add(customer.id);
          list.push(customer);
        }
      }
    }
    return list;
  }, [data?.pages]);

  // Client-side filtering and sorting on accumulated records
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...allCustomers];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          c.locality.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (localityFilter !== 'ALL') {
      result = result.filter((c) => c.locality === localityFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'registeredDate') {
        const msA = parseRegisteredTimestamp(a.registeredDate);
        const msB = parseRegisteredTimestamp(b.registeredDate);
        if (!Number.isNaN(msA) && !Number.isNaN(msB)) {
          comparison = msA - msB;
        } else if (!Number.isNaN(msA) || !Number.isNaN(msB)) {
          comparison = Number.isNaN(msA) ? -1 : 1;
        } else {
          return 0;
        }
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'id') {
        comparison = a.id.localeCompare(b.id);
      } else if (sortField === 'totalBookings') {
        comparison = a.totalBookings - b.totalBookings;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allCustomers, searchTerm, statusFilter, localityFilter, sortField, sortOrder]);

  const totalCount = data?.pages[0]?.total ?? filteredAndSortedCustomers.length;

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

  // Auto-dismiss success notification
  useEffect(() => {
    if (!successBanner) return;
    const timer = setTimeout(() => {
      setSuccessBanner(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  const handleOpenSuspendModal = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCustomer(customer);
    setActionError(null);
    setIsSuspendOpen(true);
  };

  const handleOpenActivateModal = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCustomer(customer);
    setActionError(null);
    setIsActivateOpen(true);
  };

  const handleCloseSuspendModal = () => {
    if (isActionLoading) return;
    setIsSuspendOpen(false);
    setSelectedCustomer(null);
    setActionError(null);
  };

  const handleCloseActivateModal = () => {
    if (isActionLoading) return;
    setIsActivateOpen(false);
    setSelectedCustomer(null);
    setActionError(null);
  };

  const handleSuspendConfirm = async (remarks?: string) => {
    if (!selectedCustomer) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await customerRepository.suspendCustomer(
        selectedCustomer.id,
        remarks || 'Operational account suspension'
      );
      updateCustomerStatusInCache(queryClient, selectedCustomer.id, 'SUSPENDED');
      setSuccessBanner(
        `Customer ${selectedCustomer.name} (${selectedCustomer.id}) has been successfully suspended.`
      );
      setIsSuspendOpen(false);
      setSelectedCustomer(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to suspend customer account.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActivateConfirm = async () => {
    if (!selectedCustomer) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await customerRepository.reactivateCustomer(selectedCustomer.id);
      updateCustomerStatusInCache(queryClient, selectedCustomer.id, 'ACTIVE');
      setSuccessBanner(
        `Customer ${selectedCustomer.name} (${selectedCustomer.id}) has been successfully unsuspended.`
      );
      setIsActivateOpen(false);
      setSelectedCustomer(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unsuspend customer account.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const localities = useMemo(() => {
    const set = new Set(allCustomers.map((c) => c.locality));
    return ['ALL', ...Array.from(set)];
  }, [allCustomers]);

  if (!canView) {
    return <NoAccessView moduleName="Customer Accounts & Households" requiredPermission={PERMISSIONS.CUSTOMER_VIEW} />;
  }

  if (isError && allCustomers.length === 0 && !searchTerm) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          {error instanceof Error ? error.message : 'Failed to load customer profiles.'}
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
            Customer Accounts & Households
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Directory of registered households, booking history, address profiles, and privacy compliance.
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
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="customer-action-success-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-status-success-bg, #f0fdf4)',
            border: '1px solid var(--color-status-success-border, #bbf7d0)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-success-text, #166534)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle size={18} style={{ color: 'var(--color-status-success-text, #166534)', flexShrink: 0 }} />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss success message"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-status-success-text, #166534)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
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
          placeholder="Search by customer name, ID, or locality..."
          ariaLabel="Search customers"
          containerStyle={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)' }}
        />

        {/* Status Filter */}
        <CustomSelect
          value={statusFilter}
          onChange={(val) => {
            const nextVal = val as 'ALL' | 'ACTIVE' | 'SUSPENDED';
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
          ]}
          ariaLabel="Filter by account status"
          minWidth="140px"
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
          ariaLabel="Filter by cluster locality"
          minWidth="160px"
        />

        {/* Sort Field */}
        <CustomSelect
          value={`${sortField}-${sortOrder}`}
          onChange={(val) => {
            const [field, order] = val.split('-') as [CustomerSortField, 'asc' | 'desc'];
            setSortField(field);
            setSortOrder(order);
          }}
          options={[
            { value: 'registeredDate-desc', label: 'Sort: Latest Registered' },
            { value: 'registeredDate-asc', label: 'Sort: Oldest Registered' },
            { value: 'name-asc', label: 'Sort: Name (A-Z)' },
            { value: 'name-desc', label: 'Sort: Name (Z-A)' },
            { value: 'totalBookings-desc', label: 'Sort: Most Bookings' },
            { value: 'id-asc', label: 'Sort: Customer ID' },
          ]}
          ariaLabel="Sort customer records"
          minWidth="190px"
        />
      </div>

      {/* Customer Directory Table with Continuous Scroll and Sticky Header */}
      <div
        data-testid="customer-table-scroll-container"
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
        <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
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
                Customer ID
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Customer Name
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Contact (PII Masked)
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Cluster Locality
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                KYC Verification
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Account Status
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>
                Bookings
              </th>
              <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-subtle)', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                  <LoadingSpinner message="Loading customer directory..." />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-status-danger-text)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>{error instanceof Error ? error.message : 'Failed to search customer records.'}</span>
                    <button
                      type="button"
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
                      Clear Search & Reload
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredAndSortedCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                  No customer accounts match your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredAndSortedCustomers.map((customer: Customer) => (
                <tr
                  key={customer.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View profile for ${customer.name} (${customer.id})`}
                  className="clickable-table-row"
                  onClick={(e) => {
                    const target = e.target as { closest?: (selector: string) => unknown };
                    if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                      return;
                    }
                    handleOpenDetailModal(customer.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenDetailModal(customer.id);
                    }
                  }}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {customer.id}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{customer.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Registered: {formatRegistrationDateIST(customer.registeredDate)}</div>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                      {customer.unmaskedPhone || customer.phone || customer.maskedPhone}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {customer.locality}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <VerificationBadge
                      isFullyVerified={customer.verificationStatus === 'VERIFIED'}
                      status={customer.verificationStatus || 'PENDING'}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={customer.status} />
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-text-primary)', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {customer.totalBookings}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PermissionGate permission={PERMISSIONS.CUSTOMERS_MANAGE_STATUS}>
                        {customer.status === 'ACTIVE' ? (
                          <button
                            onClick={(e) => handleOpenSuspendModal(customer, e)}
                            disabled={isActionLoading}
                            aria-label={`Suspend customer ${customer.name}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-status-danger-text)',
                              backgroundColor: 'var(--color-status-danger-bg)',
                              color: 'var(--color-status-danger-text)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: isActionLoading ? 'not-allowed' : 'pointer',
                              opacity: isActionLoading ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Ban size={13} />
                            <span>Suspend</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleOpenActivateModal(customer, e)}
                            disabled={isActionLoading}
                            aria-label={`Unsuspend customer ${customer.name}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-status-success-text)',
                              backgroundColor: 'var(--color-status-success-bg)',
                              color: 'var(--color-status-success-text)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: isActionLoading ? 'not-allowed' : 'pointer',
                              opacity: isActionLoading ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <CheckCircle size={13} />
                            <span>Unsuspend</span>
                          </button>
                        )}
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
            data-testid="loading-more-customers"
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
            <span>Loading more customer records...</span>
          </div>
        )}

        {/* Continuous scroll status indicator when all records are loaded */}
        {!hasNextPage && filteredAndSortedCustomers.length > 0 && (
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
            All {totalCount} customer records loaded • Continuous scroll
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {detailModalId && (
        <CustomerDetailModal
          customerId={detailModalId}
          onClose={handleCloseDetailModal}
        />
      )}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendOpen}
        title="Suspend Customer Account"
        description={`Are you sure you want to suspend customer ${selectedCustomer?.name || ''} (${selectedCustomer?.id || ''})? Suspended customers cannot log in and will be blocked from accessing protected customer features.`}
        confirmLabel="Confirm"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational reason for customer suspension (max 500 characters)..."
        errorMessage={actionError}
        isLoading={isActionLoading}
        onConfirm={handleSuspendConfirm}
        onCancel={handleCloseSuspendModal}
      />

      {/* Unsuspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isActivateOpen}
        title="Unsuspend Customer Account"
        description={`Are you sure you want to unsuspend customer ${selectedCustomer?.name || ''} (${selectedCustomer?.id || ''})? This will restore their ability to log in and use permitted customer features.`}
        confirmLabel="Unsuspend"
        isDestructive={false}
        requireRemarks={false}
        errorMessage={actionError}
        isLoading={isActionLoading}
        onConfirm={handleActivateConfirm}
        onCancel={handleCloseActivateModal}
      />
    </div>
  );
};
