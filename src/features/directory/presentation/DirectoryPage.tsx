import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  Star,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Eye,
  Calendar,
} from 'lucide-react';
import { workerRepository } from '../../workers/data/workerRepository';
import { customerRepository } from '../../customers/data/customerRepository';
import { Worker } from '../../workers/domain/types';
import { Customer } from '../../customers/domain/types';
import { WorkerDirectoryModal } from '../../workers/presentation/WorkerDirectoryModal';
import { CustomerDetailModal } from '../../customers/presentation/CustomerDetailModal';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useAuthStore } from '../../../core/auth/authStore';
import { formatRegistrationDateIST } from '../../../shared/formatters/dateTime';

const WORKER_CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Skill Categories' },
  { value: 'COOKING', label: 'Cooking' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'ELDERLY_CARE', label: 'Elderly Care' },
  { value: 'CHILDCARE', label: 'Childcare' },
  { value: 'GARDENING', label: 'Gardening' },
  { value: 'PET_CARE', label: 'Pet Care' },
];

const CUSTOMER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Account Statuses' },
  { value: 'ACTIVE', label: 'Active Accounts' },
  { value: 'SUSPENDED', label: 'Suspended Accounts' },
];

export const DirectoryPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.permissions?.includes('*');
  const [activeTab, setActiveTab] = useState<'workers' | 'customers'>('workers');

  // --- Workers Tab State ---
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerCategory, setWorkerCategory] = useState('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workerPage, setWorkerPage] = useState(1);
  const workerPageSize = 25;

  // --- Customers Tab State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatus, setCustomerStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 20;

  // --- Query Workers ---
  const {
    data: workerPageResult,
    isLoading: isWorkerLoading,
    isError: isWorkerError,
    error: workerError,
    refetch: refetchWorkers,
    isFetching: isWorkerFetching,
  } = useQuery({
    queryKey: ['directory-workers', { workerSearch, workerCategory, workerPage }],
    queryFn: async () => {
      return await workerRepository.getWorkersPage(
        {
          verified: true,
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          category: workerCategory !== 'ALL' ? workerCategory : undefined,
          searchTerm: workerSearch.trim() || undefined,
        },
        workerPage,
        workerPageSize
      );
    },
    enabled: isSuperAdmin,
    staleTime: 30 * 1000,
  });

  const workers = useMemo(() => {
    const raw = workerPageResult?.items || [];
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
  }, [workerPageResult]);

  const workerTotal =
    workerPageResult?.total !== undefined && workerPageResult.total === (workerPageResult?.items?.length ?? 0)
      ? workers.length
      : (workerPageResult?.total ?? workers.length);

  // --- Query Customers ---
  const {
    data: customerPageResult,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    error: customerError,
    refetch: refetchCustomers,
    isFetching: isCustomerFetching,
  } = useQuery({
    queryKey: ['directory-customers', { customerSearch, customerStatus, customerPage }],
    queryFn: async () => {
      return await customerRepository.getCustomersPage(
        {
          searchTerm: customerSearch.trim() || undefined,
          status: customerStatus,
        },
        customerPage,
        customerPageSize
      );
    },
    enabled: isSuperAdmin,
    staleTime: 30 * 1000,
  });

  const customers = useMemo(() => {
    return customerPageResult?.items || [];
  }, [customerPageResult]);

  const customerTotal = customerPageResult?.total ?? customers.length;

  const isCurrentFetching = activeTab === 'workers' ? isWorkerFetching : isCustomerFetching;
  const handleRefresh = () => {
    if (activeTab === 'workers') {
      refetchWorkers();
    } else {
      refetchCustomers();
    }
  };

  if (!isSuperAdmin) {
    return <NoAccessView moduleName="Master Directory" requiredPermission="*" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Users size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Directory
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Authoritative unified directory of active domestic workforce professionals and registered customers.
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
            <span>
              {activeTab === 'workers'
                ? `${workerTotal} Verified Workers Onboarded`
                : `${customerTotal} Registered Customers`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isCurrentFetching}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: isCurrentFetching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isCurrentFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Directory Tabs */}
      <div
        role="tablist"
        aria-label="Directory sections"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-workers"
          aria-selected={activeTab === 'workers'}
          aria-controls="panel-workers"
          onClick={() => setActiveTab('workers')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: activeTab === 'workers' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
            backgroundColor: activeTab === 'workers' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'workers' ? '#ffffff' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Briefcase size={16} />
          <span>Workers</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              backgroundColor: activeTab === 'workers' ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-subtle)',
              color: activeTab === 'workers' ? '#ffffff' : 'var(--color-text-muted)',
              fontWeight: 700,
            }}
          >
            {workerTotal}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-customers"
          aria-selected={activeTab === 'customers'}
          aria-controls="panel-customers"
          onClick={() => setActiveTab('customers')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: activeTab === 'customers' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
            backgroundColor: activeTab === 'customers' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === 'customers' ? '#ffffff' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <UserCheck size={16} />
          <span>Customers</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              backgroundColor: activeTab === 'customers' ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-subtle)',
              color: activeTab === 'customers' ? '#ffffff' : 'var(--color-text-muted)',
              fontWeight: 700,
            }}
          >
            {customerTotal}
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* WORKERS TAB PANEL                                            */}
      {/* ============================================================ */}
      {activeTab === 'workers' && (
        <div id="panel-workers" role="tabpanel" aria-labelledby="tab-workers" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
                value={workerSearch}
                onChange={(e) => {
                  setWorkerSearch(e.target.value);
                  setWorkerPage(1);
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
                aria-label="Filter by skill category"
                value={workerCategory}
                onChange={(e) => {
                  setWorkerCategory(e.target.value);
                  setWorkerPage(1);
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
                {WORKER_CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Workers Table */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {isWorkerLoading ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <LoadingSpinner message="Loading verified workers directory..." />
              </div>
            ) : isWorkerError ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-error)' }}>
                <AlertTriangle size={32} style={{ margin: '0 auto 8px' }} />
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>Unable to Load Workers Directory</h3>
                <p style={{ margin: '4px 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {workerError instanceof Error ? workerError.message : 'Error fetching workers from backend.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetchWorkers()}
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
                  {workerSearch || workerCategory !== 'ALL'
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
                        Skills
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Experience & Rating
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Locality
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Verification Status
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Account Status
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
                          <VerificationBadge isFullyVerified={true} status="VERIFIED" />
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={worker.status || 'ACTIVE'} />
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Worker Pagination Controls */}
            {workerTotal > workerPageSize && (
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
                  Showing {workers.length} of {workerTotal} verified workers
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setWorkerPage((p) => Math.max(1, p - 1))}
                    disabled={workerPage <= 1}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: workerPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: workerPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontWeight: 600 }}>
                    Page {workerPage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWorkerPage((p) => p + 1)}
                    disabled={workerPageResult?.hasMore === false || workers.length < workerPageSize}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: workerPageResult?.hasMore === false || workers.length < workerPageSize ? 'not-allowed' : 'pointer',
                      opacity: workerPageResult?.hasMore === false || workers.length < workerPageSize ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CUSTOMERS TAB PANEL                                          */}
      {/* ============================================================ */}
      {activeTab === 'customers' && (
        <div id="panel-customers" role="tabpanel" aria-labelledby="tab-customers" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Customer Filter and Search Bar */}
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
                placeholder="Search customer by ID, name, or mobile..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerPage(1);
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
                aria-label="Filter by account status"
                value={customerStatus}
                onChange={(e) => {
                  setCustomerStatus(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED');
                  setCustomerPage(1);
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
                {CUSTOMER_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customers Table */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {isCustomerLoading ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <LoadingSpinner message="Loading registered customers directory..." />
              </div>
            ) : isCustomerError ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-error)' }}>
                <AlertTriangle size={32} style={{ margin: '0 auto 8px' }} />
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>Unable to Load Customers Directory</h3>
                <p style={{ margin: '4px 0 16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {customerError instanceof Error ? customerError.message : 'Error fetching customers from backend.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetchCustomers()}
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
            ) : customers.length === 0 ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <UserCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  No Customers Found
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)' }}>
                  {customerSearch || customerStatus !== 'ALL'
                    ? 'Try clearing your search term or status filters.'
                    : 'No customer accounts registered in the system yet.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Customer ID
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Customer Name & Contact
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Locality
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Registration Date
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Account Status
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer: Customer) => (
                      <tr
                        key={customer.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`View profile for ${customer.name} (${customer.id})`}
                        className="customer-directory-row clickable-table-row"
                        onClick={(e) => {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          setSelectedCustomerId(customer.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            const target = e.target as { closest?: (selector: string) => unknown };
                            if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                              return;
                            }
                            e.preventDefault();
                            setSelectedCustomerId(customer.id);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {customer.id}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{customer.name}</div>
                          {(customer.unmaskedPhone || customer.phone || customer.maskedPhone) && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {customer.unmaskedPhone || customer.phone || customer.maskedPhone}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} style={{ color: 'var(--color-text-muted)' }} />
                            <span>{customer.locality || 'Hyderabad'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={12} style={{ color: 'var(--color-text-muted)' }} />
                            <span>{formatRegistrationDateIST(customer.registeredDate)}</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={customer.status} />
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomerId(customer.id);
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Customer Pagination Controls */}
            {customerTotal > customerPageSize && (
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
                  Showing {customers.length} of {customerTotal} registered customers
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                    disabled={customerPage <= 1}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: customerPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: customerPage <= 1 ? 0.5 : 1,
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontWeight: 600 }}>
                    Page {customerPage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomerPage((p) => p + 1)}
                    disabled={customerPageResult?.hasMore === false || customers.length < customerPageSize}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      cursor: customerPageResult?.hasMore === false || customers.length < customerPageSize ? 'not-allowed' : 'pointer',
                      opacity: customerPageResult?.hasMore === false || customers.length < customerPageSize ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Read-Only Worker Detail Modal */}
      {selectedWorkerId && (
        <WorkerDirectoryModal
          workerId={selectedWorkerId}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}

      {/* Read-Only Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          readOnly={true}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
};

