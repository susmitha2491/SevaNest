import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  UserCheck,
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
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { formatRegistrationDateIST } from '../../../shared/formatters/dateTime';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { MaskedPhoneText } from '../../../shared/components/MaskedPhoneText';

import { SearchInput } from '../../../components/common/SearchInput';

const WORKER_CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Skill Categories' },
  { value: 'COOKING', label: 'Cook / Cooking' },
  { value: 'CLEANING', label: 'Cleaning Helper' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'BABYSITTER', label: 'Babysitter' },
  { value: 'CHILDCARE', label: 'Childcare' },
  { value: 'ELDERLY_CARE', label: 'Elderly Care Helper' },
  { value: 'HOUSE_MAID', label: 'House Maid' },
];

const CUSTOMER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Account Statuses' },
  { value: 'ACTIVE', label: 'Active Accounts' },
  { value: 'SUSPENDED', label: 'Suspended Accounts' },
];

export const DirectoryPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.permissions?.includes('*');
  const canViewWorkers = isSuperAdmin || hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const canViewCustomers = isSuperAdmin || hasPermission(user?.permissions, PERMISSIONS.CUSTOMER_VIEW);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const initialTab = useMemo<'workers' | 'customers'>(() => {
    if (tabParam === 'customers' && canViewCustomers) return 'customers';
    if (tabParam === 'workers' && canViewWorkers) return 'workers';
    if (canViewWorkers) return 'workers';
    if (canViewCustomers) return 'customers';
    return 'workers';
  }, [tabParam, canViewWorkers, canViewCustomers]);

  const [activeTab, setActiveTab] = useState<'workers' | 'customers'>(initialTab);

  useEffect(() => {
    if (tabParam === 'customers' && canViewCustomers && activeTab !== 'customers') {
      setActiveTab('customers');
    } else if (tabParam === 'workers' && canViewWorkers && activeTab !== 'workers') {
      setActiveTab('workers');
    }
  }, [tabParam, canViewWorkers, canViewCustomers, activeTab]);

  const handleTabChange = (tab: 'workers' | 'customers') => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // --- Workers Tab State ---
  const [workerSearch, setWorkerSearch] = useState('');
  const debouncedWorkerSearch = useDebounce(workerSearch, 400);
  const [workerCategory, setWorkerCategory] = useState('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(() => searchParams.get('workerId'));
  const [workerPage, setWorkerPage] = useState(1);
  const workerPageSize = 25;

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
    setWorkerPage(1);
  }, [debouncedWorkerSearch]);

  // --- Customers Tab State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 400);
  const [customerStatus, setCustomerStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 20;

  useEffect(() => {
    setCustomerPage(1);
  }, [debouncedCustomerSearch]);

  // --- Query Workers ---
  const {
    data: workerPageResult,
    isLoading: isWorkerLoading,
    isError: isWorkerError,
    error: workerError,
    refetch: refetchWorkers,
    isFetching: isWorkerFetching,
  } = useQuery({
    queryKey: ['directory-workers', { workerSearch: debouncedWorkerSearch, workerCategory, workerPage }],
    queryFn: async () => {
      return await workerRepository.getWorkersPage(
        {
          verified: true,
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          category: workerCategory !== 'ALL' ? workerCategory : undefined,
          searchTerm: debouncedWorkerSearch.trim() || undefined,
        },
        workerPage,
        workerPageSize
      );
    },
    enabled: canViewWorkers,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
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
    queryKey: ['directory-customers', { customerSearch: debouncedCustomerSearch, customerStatus, customerPage }],
    queryFn: async () => {
      return await customerRepository.getCustomersPage(
        {
          searchTerm: debouncedCustomerSearch.trim() || undefined,
          status: customerStatus,
        },
        customerPage,
        customerPageSize
      );
    },
    enabled: canViewCustomers,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const customers = useMemo(() => {
    return customerPageResult?.items || [];
  }, [customerPageResult]);

  const customerTotal = customerPageResult?.total ?? customers.length;

  const isCurrentFetching = isWorkerFetching || isCustomerFetching;
  const handleRefresh = () => {
    if (canViewWorkers) {
      refetchWorkers();
    }
    if (canViewCustomers) {
      refetchCustomers();
    }
  };

  if (!canViewWorkers && !canViewCustomers) {
    return <NoAccessView moduleName="Directory" requiredPermission="worker.view or customer.view" />;
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
                ? isWorkerLoading && workerPageResult === undefined
                  ? 'Loading verified workers...'
                  : isWorkerError
                    ? 'Error loading workers'
                    : `${workerTotal} Verified Workers Onboarded`
                : isCustomerLoading && customerPageResult === undefined
                  ? 'Loading registered customers...'
                  : isCustomerError
                    ? 'Error loading customers'
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
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={isCurrentFetching ? 'animate-spin' : ''} />
            <span>{isCurrentFetching ? 'Refreshing...' : 'Refresh'}</span>
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
        {canViewWorkers && (
          <button
            type="button"
            role="tab"
            id="tab-workers"
            aria-selected={activeTab === 'workers'}
            aria-controls="panel-workers"
            onClick={() => handleTabChange('workers')}
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
              {isWorkerLoading && workerPageResult === undefined ? '...' : isWorkerError ? '—' : workerTotal}
            </span>
          </button>
        )}

        {canViewCustomers && (
          <button
            type="button"
            role="tab"
            id="tab-customers"
            aria-selected={activeTab === 'customers'}
            aria-controls="panel-customers"
            onClick={() => handleTabChange('customers')}
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
              {isCustomerLoading && customerPageResult === undefined ? '...' : isCustomerError ? '—' : customerTotal}
            </span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* WORKERS TAB PANEL                                            */}
      {/* ============================================================ */}
      {activeTab === 'workers' && (
        !canViewWorkers ? (
          <div id="panel-workers" role="tabpanel" aria-labelledby="tab-workers">
            <NoAccessView moduleName="Workers Directory" requiredPermission={PERMISSIONS.WORKER_VIEW} />
          </div>
        ) : (
        <div id="panel-workers" role="tabpanel" aria-labelledby="tab-workers" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
              value={workerSearch}
              onChange={(val) => setWorkerSearch(val)}
              placeholder="Search verified worker by name or mobile..."
              ariaLabel="Search verified workers"
              isLoading={isWorkerFetching && debouncedWorkerSearch.trim().length > 0}
              containerStyle={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)' }}
            />

            <CustomSelect
              value={workerCategory}
              onChange={(val) => {
                setWorkerCategory(val);
                setWorkerPage(1);
              }}
              options={WORKER_CATEGORY_OPTIONS}
              ariaLabel="Filter by skill category"
              minWidth="180px"
            />
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
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs, 11px)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '75px', whiteSpace: 'nowrap' }}>
                        Worker ID
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', minWidth: '120px', whiteSpace: 'nowrap' }}>
                        Worker Name & Contact
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '75px', whiteSpace: 'nowrap' }}>
                        Skills
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '85px', whiteSpace: 'nowrap' }}>
                        Exp & Rating
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '70px', whiteSpace: 'nowrap' }}>
                        Locality
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '85px', whiteSpace: 'nowrap' }}>
                        Verification
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '75px', whiteSpace: 'nowrap' }}>
                        Status
                      </th>
                      <th style={{ padding: '8px 6px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right', width: '85px', whiteSpace: 'nowrap' }}>
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
                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {worker.name}
                            </div>
                            {(worker.phone || worker.mobile || worker.phoneMasked) && (
                              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '1px', whiteSpace: 'nowrap' }}>
                                <MaskedPhoneText
                                  phone={worker.phone || worker.mobile || worker.phoneMasked}
                                  unmaskedPhone={worker.phone || worker.mobile}
                                  entityId={worker.id}
                                  entityType="worker"
                                />
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap' }}>
                              {visibleSkills.map((skill, sIdx) => (
                                <span
                                  key={skill}
                                  title={skillList.join(', ')}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '1px 5px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: sIdx === 0 ? 'var(--color-bg-subtle)' : 'var(--color-bg-app)',
                                    color: sIdx === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                    border: '1px solid var(--color-border)',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '75px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
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
                                    padding: '1px 4px',
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

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}>
                              <Briefcase size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                              <span>{worker.experienceYears || 0}y</span>
                              <span style={{ color: 'var(--color-border)' }}>•</span>
                              <Star size={10} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                              <span style={{ fontWeight: 600 }}>{worker.ratingAverage ? Number(worker.ratingAverage).toFixed(1) : 'New'}</span>
                            </div>
                          </td>

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <MapPin size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                              <span>{worker.locality || 'Hyderabad'}</span>
                            </div>
                          </td>

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <VerificationBadge isFullyVerified={true} status="VERIFIED" />
                          </td>

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <StatusBadge status={worker.status || 'ACTIVE'} />
                          </td>

                          <td style={{ padding: '6px 6px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectWorker(worker.id);
                              }}
                              style={{
                                padding: '3px 6px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Eye size={11} />
                              <span>View Profile</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
        )
      )}

      {/* ============================================================ */}
      {/* CUSTOMERS TAB PANEL                                          */}
      {/* ============================================================ */}
      {activeTab === 'customers' && (
        !canViewCustomers ? (
          <div id="panel-customers" role="tabpanel" aria-labelledby="tab-customers">
            <NoAccessView moduleName="Customers Directory" requiredPermission={PERMISSIONS.CUSTOMER_VIEW} />
          </div>
        ) : (
        <div id="panel-customers" role="tabpanel" aria-labelledby="tab-customers" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Customer Filter and Search Bar */}
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
              value={customerSearch}
              onChange={(val) => setCustomerSearch(val)}
              placeholder="Search customer by ID, name, or mobile..."
              ariaLabel="Search customers"
              isLoading={isCustomerFetching && debouncedCustomerSearch.trim().length > 0}
              containerStyle={{ flex: '1 1 280px', minWidth: 'min(100%, 240px)' }}
            />

            <CustomSelect
              value={customerStatus}
              onChange={(val) => {
                setCustomerStatus(val as 'ALL' | 'ACTIVE' | 'SUSPENDED');
                setCustomerPage(1);
              }}
              options={CUSTOMER_STATUS_OPTIONS}
              ariaLabel="Filter by account status"
              minWidth="180px"
            />
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
              <div
                role="status"
                data-testid="customers-empty-state"
                style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}
              >
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
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs, 12px)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', width: '80px' }}>
                        Customer ID
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Customer Name & Contact
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Locality
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Registration Date
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Account Status
                      </th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '90px' }}>
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
                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <span
                            title={customer.id}
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
                            {customer.id}
                          </span>
                        </td>

                        <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{customer.name}</div>
                          {(customer.unmaskedPhone || customer.phone || customer.maskedPhone) && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px', whiteSpace: 'nowrap' }}>
                              <MaskedPhoneText
                                phone={customer.maskedPhone || customer.phone}
                                unmaskedPhone={customer.unmaskedPhone || (customer.phone && !customer.phone.includes('*') ? customer.phone : undefined)}
                                entityId={customer.id}
                                entityType="customer"
                              />
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <span>{customer.locality || 'Hyderabad'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <span>{formatRegistrationDateIST(customer.registeredDate)}</span>
                          </div>
                        </td>

                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <StatusBadge status={customer.status} />
                        </td>

                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomerId(customer.id);
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text-primary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
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
        )
      )}

      {/* Read-Only Worker Detail Modal */}
      {selectedWorkerId && (
        <WorkerDirectoryModal
          workerId={selectedWorkerId}
          onClose={() => handleSelectWorker(null)}
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

