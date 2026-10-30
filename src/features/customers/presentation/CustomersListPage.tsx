/* global HTMLDivElement, IntersectionObserver */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Ban, RefreshCw, User, CheckCircle } from 'lucide-react';
import { customerRepository } from '../data/customerRepository';
import { Customer } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { CustomerDetailModal } from './CustomerDetailModal';

export const CustomersListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>(
    () => (searchParams.get('status') as 'ALL' | 'ACTIVE' | 'SUSPENDED') || 'ALL'
  );
  const [localityFilter, setLocalityFilter] = useState(() => searchParams.get('locality') || 'ALL');
  const [sortField, setSortField] = useState<'name' | 'id' | 'totalBookings'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailModalId, setDetailModalId] = useState<string | null>(() => searchParams.get('customerId') || null);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cid = searchParams.get('customerId');
    if (cid !== detailModalId) {
      setDetailModalId(cid);
    }
    const q = searchParams.get('search');
    if (q !== null && q !== searchTerm) {
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
  }, [searchParams, detailModalId, searchTerm, statusFilter, localityFilter]);

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
    queryKey: ['customers', 'infinite', searchTerm, statusFilter, localityFilter],
    queryFn: async ({ pageParam = 1 }) => {
      if (typeof customerRepository.getCustomersPage === 'function') {
        return customerRepository.getCustomersPage(
          {
            searchTerm,
            status: statusFilter,
            locality: localityFilter,
          },
          pageParam,
          20
        );
      }
      const all = await customerRepository.getCustomers({
        searchTerm,
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
      if (sortField === 'name') {
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

  const handleSuspendConfirm = async (remarks?: string) => {
    if (selectedCustomerId) {
      await customerRepository.suspendCustomer(selectedCustomerId, remarks || 'Operational account suspension');
      setIsSuspendOpen(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  };

  const handleReactivateCustomer = async (id: string) => {
    await customerRepository.reactivateCustomer(id);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const localities = useMemo(() => {
    const set = new Set(allCustomers.map((c) => c.locality));
    return ['ALL', ...Array.from(set)];
  }, [allCustomers]);

  if (isLoading) {
    return <LoadingSpinner message="Loading customer directory..." />;
  }

  if (isError) {
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

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          alignItems: 'center',
          backgroundColor: 'var(--color-bg-surface)',
          padding: 'var(--space-3)',
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
            placeholder="Search by customer name, ID, or locality..."
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
              padding: '6px 10px 6px 34px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-primary)',
              height: '34px',
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED';
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
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              height: '34px',
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
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
            aria-label="Filter by cluster locality"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              height: '34px',
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
              const [field, order] = e.target.value.split('-') as ['name' | 'id' | 'totalBookings', 'asc' | 'desc'];
              setSortField(field);
              setSortOrder(order);
            }}
            aria-label="Sort customer records"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              height: '34px',
            }}
          >
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="totalBookings-desc">Sort: Most Bookings</option>
            <option value="id-asc">Sort: Customer ID</option>
          </select>
        </div>
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
            {filteredAndSortedCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                  No customer accounts match your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredAndSortedCustomers.map((customer: Customer) => (
                <tr key={customer.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {customer.id}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{customer.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Registered: {customer.registeredDate}</div>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{customer.maskedPhone}</span>
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
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleOpenDetailModal(customer.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          backgroundColor: 'var(--color-bg-surface-elevated)',
                          color: 'var(--color-text-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <User size={13} />
                        <span>View Profile</span>
                      </button>

                      <PermissionGate permission={PERMISSIONS.CUSTOMERS_MANAGE_STATUS}>
                        {customer.status === 'ACTIVE' ? (
                          <button
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setIsSuspendOpen(true);
                            }}
                            aria-label={`Suspend customer ${customer.name}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-status-danger-text)',
                              backgroundColor: 'var(--color-status-danger-bg)',
                              color: 'var(--color-status-danger-text)',
                              fontSize: 'var(--font-size-xs)',
                              cursor: 'pointer',
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
                            onClick={() => handleReactivateCustomer(customer.id)}
                            aria-label={`Reactivate customer ${customer.name}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-status-success-text)',
                              backgroundColor: 'var(--color-status-success-bg)',
                              color: 'var(--color-status-success-text)',
                              fontSize: 'var(--font-size-xs)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <CheckCircle size={13} />
                            <span>Reactivate</span>
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
          onStatusChanged={() => refetch()}
        />
      )}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendOpen}
        title="Suspend Customer Account"
        description={`Are you sure you want to suspend customer ${selectedCustomerId}? Suspended customers cannot make new booking requests.`}
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational reason for customer suspension..."
        onConfirm={handleSuspendConfirm}
        onCancel={() => setIsSuspendOpen(false)}
      />
    </div>
  );
};
