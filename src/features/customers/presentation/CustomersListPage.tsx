import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Ban, RefreshCw, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { customerRepository } from '../data/customerRepository';
import { Customer } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { CustomerDetailModal } from './CustomerDetailModal';

const ITEMS_PER_PAGE = 5;

export const CustomersListPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [localityFilter, setLocalityFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'name' | 'id' | 'totalBookings'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);

  const { data: customers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', 'list'],
    queryFn: () => customerRepository.getCustomers(),
  });

  // Client-side filtering and sorting
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers];

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
  }, [customers, searchTerm, statusFilter, localityFilter, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / ITEMS_PER_PAGE) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedCustomers, currentPage]);


  const handleSuspendConfirm = async (remarks?: string) => {
    if (selectedCustomerId) {
      await customerRepository.suspendCustomer(selectedCustomerId, remarks || 'Operational account suspension');
      setIsSuspendOpen(false);
      refetch();
    }
  };

  const localities = useMemo(() => {
    const set = new Set(customers.map((c) => c.locality));
    return ['ALL', ...Array.from(set)];
  }, [customers]);

  if (isLoading) {
    return <LoadingSpinner message="Loading customer directory..." />;
  }

  if (isError) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-4)' }}>
          Failed to load customer profiles.
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
          <span>Refresh Directory</span>
        </button>
      </div>

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
            placeholder="Search by customer name, ID, or locality..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED');
              setCurrentPage(1);
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
          </select>
        </div>

        {/* Locality Filter */}
        <div>
          <select
            value={localityFilter}
            onChange={(e) => {
              setLocalityFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by cluster locality"
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
              const [field, order] = e.target.value.split('-') as ['name' | 'id' | 'totalBookings', 'asc' | 'desc'];
              setSortField(field);
              setSortOrder(order);
            }}
            aria-label="Sort customer records"
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
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="totalBookings-desc">Sort: Most Bookings</option>
            <option value="id-asc">Sort: Customer ID</option>
          </select>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <tr>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Customer ID
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Customer Name
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Contact (PII Masked)
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Cluster Locality
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Account Status
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Bookings
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No customer accounts match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer: Customer) => (
                  <tr key={customer.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                      {customer.id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{customer.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Registered: {customer.registeredDate}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{customer.maskedPhone}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                      {customer.locality}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={customer.status} />
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                      {customer.totalBookings}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => setDetailModalId(customer.id)}
                          style={{
                            padding: '4px 10px',
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
                          }}
                        >
                          <User size={13} />
                          <span>View Profile</span>
                        </button>

                        <PermissionGate permission={PERMISSIONS.CUSTOMERS_MANAGE_STATUS}>
                          {customer.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setSelectedCustomerId(customer.id);
                                setIsSuspendOpen(true);
                              }}
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
                              }}
                            >
                              <Ban size={13} />
                              <span>Suspend</span>
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
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div>
            Showing <strong>{filteredAndSortedCustomers.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to{' '}
            <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedCustomers.length)}</strong> of{' '}
            <strong>{filteredAndSortedCustomers.length}</strong> customers
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: currentPage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {detailModalId && (
        <CustomerDetailModal
          customerId={detailModalId}
          onClose={() => setDetailModalId(null)}
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
