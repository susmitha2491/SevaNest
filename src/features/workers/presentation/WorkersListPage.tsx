import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  ShieldAlert,
  Star,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { Worker } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { WorkerDetailModal } from './WorkerDetailModal';

const ITEMS_PER_PAGE = 5;

export const WorkersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING'>(
    () => (searchParams.get('verificationStatus') as 'ALL' | 'VERIFIED' | 'PENDING') || 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED'>(
    () => (searchParams.get('status') as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED') || 'ALL'
  );
  const [localityFilter, setLocalityFilter] = useState(() => searchParams.get('locality') || 'ALL');
  const [sortField, setSortField] = useState<'ratingAverage' | 'experienceYears' | 'name' | 'id'>('ratingAverage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [detailModalId, setDetailModalId] = useState<string | null>(() => searchParams.get('workerId') || null);
  const [isDisciplineOpen, setIsDisciplineOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'SUSPENDED' | 'BLACKLISTED' | 'ACTIVE'>('SUSPENDED');

  useEffect(() => {
    const wid = searchParams.get('workerId');
    if (wid !== null) {
      setDetailModalId(wid);
    }
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
    const verif = searchParams.get('verificationStatus');
    if (verif) {
      setVerificationFilter(verif as 'ALL' | 'VERIFIED' | 'PENDING');
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
    const nextParams = new window.URLSearchParams(searchParams);
    nextParams.set('workerId', id);
    setSearchParams(nextParams, { replace: true });
  };

  const handleCloseDetailModal = () => {
    setDetailModalId(null);
    const nextParams = new window.URLSearchParams(searchParams);
    nextParams.delete('workerId');
    setSearchParams(nextParams, { replace: true });
  };

  const { data: workers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['workers', 'list'],
    queryFn: () => workerRepository.getWorkers(),
  });

  // Client-side filtering and sorting
  const filteredAndSortedWorkers = useMemo(() => {
    let result = [...workers];

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
      result = result.filter((w) => w.category === categoryFilter);
    }

    if (verificationFilter !== 'ALL') {
      const wantVerified = verificationFilter === 'VERIFIED';
      result = result.filter((w) => w.isFullyVerified === wantVerified);
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
  }, [workers, searchTerm, categoryFilter, verificationFilter, statusFilter, localityFilter, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedWorkers.length / ITEMS_PER_PAGE) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedWorkers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedWorkers, currentPage]);

  const handleDisciplineConfirm = async (remarks?: string) => {
    if (selectedWorkerId) {
      await workerRepository.updateWorkerStatus(selectedWorkerId, targetStatus, remarks || 'Operational disciplinary status mutation');
      setIsDisciplineOpen(false);
      refetch();
    }
  };

  const categories = useMemo(() => {
    const set = new Set(workers.map((w) => w.category));
    return ['ALL', ...Array.from(set)];
  }, [workers]);

  const localities = useMemo(() => {
    const set = new Set(workers.map((w) => w.locality));
    return ['ALL', ...Array.from(set)];
  }, [workers]);

  if (isLoading) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
          <span>Refresh Roster</span>
        </button>
      </div>

      {/* Operational Scope Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: 'All Registered Workers' },
          { key: 'VERIFIED', label: 'Active & Verified Roster (Matching Eligible)' },
          { key: 'PENDING', label: 'Pending Verification / Incomplete KYC' },
        ].map((tab) => {
          const isActive = verificationFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setVerificationFilter(tab.key as 'ALL' | 'VERIFIED' | 'PENDING');
                setCurrentPage(1);
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

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
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

        {/* Verification Badge Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={14} color="var(--color-text-muted)" />
          <select
            value={verificationFilter}
            onChange={(e) => {
              setVerificationFilter(e.target.value as 'ALL' | 'VERIFIED' | 'PENDING');
              setCurrentPage(1);
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
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED');
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
            <option value="BLACKLISTED">Blacklisted</option>
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

      {/* Workers Roster Table */}
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
                  Worker ID
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Worker Name
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Primary Skill
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Verification
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Matching Eligibility
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Experience
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Rating
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Cluster
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No domestic workers match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedWorkers.map((worker: Worker) => (
                  <tr key={worker.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
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
                      <VerificationBadge isFullyVerified={worker.isFullyVerified} />
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
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => handleOpenDetailModal(worker.id)}
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

                        {!worker.isFullyVerified && (
                          <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
                            <button
                              onClick={() => navigate(`/verification?search=${encodeURIComponent(worker.id)}&dossierId=${encodeURIComponent(worker.id)}`)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border-subtle)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                color: 'var(--color-brand-600, var(--color-primary))',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ShieldAlert size={13} />
                              <span>Review KYC</span>
                            </button>
                          </PermissionGate>
                        )}

                        <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE_STATUS}>
                          {worker.status === 'ACTIVE' ? (
                            <button
                              onClick={() => {
                                setSelectedWorkerId(worker.id);
                                setTargetStatus('SUSPENDED');
                                setIsDisciplineOpen(true);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border-subtle)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-status-danger-text)',
                                fontSize: 'var(--font-size-xs)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ShieldAlert size={13} />
                              <span>Discipline</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedWorkerId(worker.id);
                                setTargetStatus('ACTIVE');
                                setIsDisciplineOpen(true);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border-subtle)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-status-success-text)',
                                fontSize: 'var(--font-size-xs)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Reinstate</span>
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
            Showing <strong>{filteredAndSortedWorkers.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to{' '}
            <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedWorkers.length)}</strong> of{' '}
            <strong>{filteredAndSortedWorkers.length}</strong> workers
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

      {/* Worker Detail Modal */}
      {detailModalId && (
        <WorkerDetailModal
          workerId={detailModalId}
          onClose={handleCloseDetailModal}
          onStatusChanged={() => refetch()}
        />
      )}

      {/* Disciplinary Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDisciplineOpen}
        title={`Disciplinary Status Mutation: ${targetStatus}`}
        description={
          targetStatus === 'ACTIVE'
            ? `Reinstate active operational state for worker ${selectedWorkerId}. This restores matching eligibility if verification is complete.`
            : `Configure account state for worker ${selectedWorkerId}. This action revokes active matching eligibility.`
        }
        isDestructive={targetStatus !== 'ACTIVE'}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational reason (e.g., Safety breach, Chronic absenteeism)..."
        onConfirm={handleDisciplineConfirm}
        onCancel={() => setIsDisciplineOpen(false)}
      />
    </div>
  );
};
