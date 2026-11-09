import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Eye,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { VerificationFilterCriteria, VerificationDossier } from '../domain/types';
import { verificationRepository } from '../data/verificationRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { ConcurrencyConflictError, ValidationError } from '../../../core/errors/DomainError';
import { VerificationHistoryPage } from './VerificationHistoryPage';
import { WorkerVerificationReviewModal } from './WorkerVerificationReviewModal';
import { VerificationCheckStatusView } from './VerificationCheckStatusView';
import { VerificationDocumentReviewView } from './VerificationDocumentReviewView';

export interface VerificationQueuePageProps {
  viewMode?: 'all' | 'my-reviews' | 'rechecks' | 'corrections' | 'history';
  defaultStatus?: string;
}

export const VerificationQueuePage: React.FC<VerificationQueuePageProps> = ({
  viewMode: propViewMode,
  defaultStatus: propDefaultStatus,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canDecide = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE);
  const canReview = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW);

  const [activeSection, setActiveSection] = useState<'queue' | 'document-review' | 'check-status' | 'expiry-recheck'>(() => {
    const s = searchParams.get('section') || searchParams.get('tab');
    if (s === 'document-review' || location.pathname.includes('/document-review')) return 'document-review';
    if (s === 'check-status' || location.pathname.includes('/check-status')) return 'check-status';
    if (s === 'expiry-recheck' || s === 'rechecks' || location.pathname.includes('/rechecks')) return 'expiry-recheck';
    return 'queue';
  });

  useEffect(() => {
    const s = searchParams.get('section') || searchParams.get('tab');
    if (s === 'document-review' || location.pathname.includes('/document-review')) setActiveSection('document-review');
    else if (s === 'check-status' || location.pathname.includes('/check-status')) setActiveSection('check-status');
    else if (s === 'expiry-recheck' || s === 'rechecks' || location.pathname.includes('/rechecks')) setActiveSection('expiry-recheck');
    else if (!s && location.pathname === '/verification') setActiveSection('queue');
  }, [searchParams, location.pathname]);

  const effectiveSection = activeSection;

  const effectiveViewMode: 'all' | 'my-reviews' | 'rechecks' | 'corrections' | 'history' = propViewMode || (
    location.pathname.includes('/my-reviews')
      ? 'my-reviews'
      : location.pathname.includes('/rechecks') || effectiveSection === 'expiry-recheck'
      ? 'rechecks'
      : location.pathname.includes('/corrections')
      ? 'corrections'
      : location.pathname.includes('/history')
      ? 'history'
      : (searchParams.get('tab') as 'all' | 'my-reviews' | 'rechecks' | 'corrections' | 'history') || 'all'
  );

  const initialStatus = searchParams.get('status') || propDefaultStatus || (
    effectiveViewMode === 'my-reviews'
      ? 'IN_REVIEW'
      : effectiveViewMode === 'rechecks' || effectiveSection === 'expiry-recheck'
      ? 'RECHECK_DUE'
      : effectiveViewMode === 'corrections'
      ? 'REJECTED'
      : 'ALL'
  );

  // Filter & Queue State initialized from URL params / viewMode defaults
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('category') || 'ALL');
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = searchParams.get('page');
    return p ? parseInt(p, 10) || 1 : 1;
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    const s = searchParams.get('sortOrder');
    return s === 'asc' ? 'asc' : 'desc';
  });

  const toggleSortOrder = () => {
    const nextOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(nextOrder);
    updateUrlParams({ sortOrder: nextOrder === 'desc' ? null : 'asc', page: 1 });
    setCurrentPage(1);
  };

  // Selected Dossier state
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(
    () => searchParams.get('workerId') || searchParams.get('dossierId') || null
  );

  // References for modal accessibility & focus restore
  const triggerElementRef = useRef<{ focus: () => void } | null>(null);

  // Helper to synchronize URL query parameters with active filters
  const updateUrlParams = (updates: Record<string, string | number | null | undefined>) => {
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '' || v === 'ALL') {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      });
      return next;
    }, { replace: true });
  };

  const handleSelectDossier = (workerIdOrDossierId: string | null) => {
    if (workerIdOrDossierId) {
      if (typeof document !== 'undefined' && document.activeElement && 'focus' in document.activeElement) {
        triggerElementRef.current = document.activeElement as { focus: () => void };
      }
    }
    setSelectedDossierId(workerIdOrDossierId);
    updateUrlParams({ workerId: workerIdOrDossierId, dossierId: workerIdOrDossierId });
  };

  const handleCloseModal = useCallback(() => {
    const returnTo = searchParams.get('returnTo');
    setSelectedDossierId(null);
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      next.delete('workerId');
      next.delete('dossierId');
      return next;
    }, { replace: true });
    setTimeout(() => {
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
    }, 0);
  }, [setSearchParams, searchParams, navigate]);

  // Synchronize state when URL params change externally
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
    const urlWorkerId = searchParams.get('workerId') || searchParams.get('dossierId');
    if (urlWorkerId !== null && urlWorkerId !== selectedDossierId) {
      setSelectedDossierId(urlWorkerId);
    }
    const urlSortOrder = searchParams.get('sortOrder');
    if (urlSortOrder === 'asc' && sortOrder !== 'asc') {
      setSortOrder('asc');
    } else if (!urlSortOrder && sortOrder !== 'desc') {
      setSortOrder('desc');
    }
  }, [searchParams, searchTerm, selectedDossierId, sortOrder]);

  // Query verification queue
  const { data: queueData, isLoading, isError, error: queueError, refetch } = useQuery({
    queryKey: ['verification', 'queue', effectiveViewMode, searchTerm, selectedStatus, selectedCategory, currentPage, sortOrder],
    queryFn: () =>
      verificationRepository.getVerificationQueue({
        assignedTo: effectiveViewMode === 'my-reviews' ? 'me' : undefined,
        searchTerm,
        status: selectedStatus as VerificationFilterCriteria['status'],
        category: selectedCategory,
        page: currentPage,
        pageSize: 10,
        sortBy: 'submissionTime',
        sortOrder,
      }),
    enabled: canReview,
  });

  // Auto-select dossier if search parameter matches workerId or dossierId
  useEffect(() => {
    if (!selectedDossierId && queueData?.items.length) {
      const searchParam = searchParams.get('search');
      if (searchParam) {
        const match = queueData.items.find(
          (item) => item.workerId.toLowerCase() === searchParam.toLowerCase() || item.id === searchParam
        );
        if (match) {
          setSelectedDossierId(match.workerId || match.id);
        }
      }
    }
  }, [queueData, selectedDossierId, searchParams]);

  // Cross-entity cache invalidation helper
  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ['verification'] });
    queryClient.invalidateQueries({ queryKey: ['workers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  // Start review mutation for queue table actions
  const claimMutation = useMutation({
    mutationFn: async ({ checkId, dossierId }: { checkId: string; dossierId: string }) => {
      if (!checkId || checkId.startsWith('W-') || checkId.startsWith('VQ-') || checkId.startsWith('APP-')) {
        throw new ValidationError('A valid verification checkId is required to start review. Worker or dossier IDs cannot be used.');
      }
      try {
        await verificationRepository.claimCheck(checkId);
      } catch (err: unknown) {
        interface ConflictErrorLike {
          status?: number;
          code?: string;
          response?: {
            status?: number;
            data?: {
              code?: string;
            };
          };
        }
        const conflictErr = err as ConflictErrorLike;
        const isConflict =
          err instanceof ConcurrencyConflictError ||
          conflictErr?.status === 409 ||
          conflictErr?.code === 'CHECK_ALREADY_ASSIGNED' ||
          conflictErr?.code === 'CHECK_ALREADY_IN_REVIEW' ||
          conflictErr?.response?.status === 409 ||
          conflictErr?.response?.data?.code === 'CHECK_ALREADY_ASSIGNED' ||
          conflictErr?.response?.data?.code === 'CHECK_ALREADY_IN_REVIEW' ||
          (err as Error)?.message?.toLowerCase().includes('already assigned') ||
          (err as Error)?.message?.toLowerCase().includes('already in review');

        if (isConflict) {
          // Check is already in review on backend: proceed directly into the dossier
          return { checkId, dossierId };
        }

        // If the check was already decided / approved on backend (404 Resource not found or already decided),
        // refresh query cache and proceed to dossier
        const isAlreadyDecided =
          conflictErr?.status === 404 ||
          conflictErr?.response?.status === 404 ||
          conflictErr?.code === 'CHECK_ALREADY_DECIDED' ||
          conflictErr?.response?.data?.code === 'CHECK_ALREADY_DECIDED' ||
          (err as Error)?.message?.toLowerCase().includes('not found') ||
          (err as Error)?.message?.toLowerCase().includes('already decided') ||
          (err as Error)?.message?.toLowerCase().includes('invalid transition');

        if (isAlreadyDecided) {
          invalidateRelated();
          return { checkId, dossierId };
        }
        throw err;
      }
      return { checkId, dossierId };
    },
    onSuccess: (data) => {
      invalidateRelated();
      handleSelectDossier(data.dossierId);
    },
  });

  const isActionPending = claimMutation.isPending;

  if (!canReview) {
    return <NoAccessView moduleName="Worker Verification & Trust Operations" requiredPermission={PERMISSIONS.VERIFICATION_REVIEW} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading worker verification queue..." />;
  }

  if (isError) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error-dark)' }}>
          Failed to load verification queue
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', maxWidth: '520px', margin: '0 auto var(--space-4) auto' }}>
          {(queueError as Error)?.message || 'Unable to connect to verification queue service. Required backend contract: GET /api/v1/admin/verification/queue.'}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-brand-600)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            {effectiveViewMode === 'my-reviews'
              ? 'My Reviews Workstation'
              : effectiveViewMode === 'rechecks'
              ? 'Rechecks & Credential Expiry'
              : effectiveViewMode === 'corrections'
              ? 'Corrections Required Workstation'
              : effectiveViewMode === 'history'
              ? 'Authoritative Review History & Audit'
              : 'Worker Verification & Trust Operations'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {effectiveViewMode === 'my-reviews'
              ? 'Active in-progress dossiers and ongoing verification reviews under operational evaluation.'
              : effectiveViewMode === 'rechecks'
              ? 'Annual compliance renewals, expiring police certificates, and re-check directives.'
              : effectiveViewMode === 'corrections'
              ? 'Rejected checks, missing KYC documents, and applicant rectification tracking.'
              : effectiveViewMode === 'history'
              ? 'Historical decision records, compliance determinations, and review notes for approved and rejected domestic workers.'
              : 'Mandatory 6-point verification (1 pre-check phone OTP + 5 operations checks: Identity, Address, Emergency Contact, Employer Reference, Police Clearance).'}
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-primary-subtle)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-primary)',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={16} />
          <span>Operational Verification SLA: 48 Hours</span>
        </div>
      </div>

      {/* 4 Working Sections for Verification Executive */}
      <div
        role="tablist"
        aria-label="Verification Sections"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '2px solid var(--color-border)',
          paddingBottom: '0',
          marginBottom: 'var(--space-2)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'queue' as const, label: 'Verification Queue', icon: FileText, count: queueData?.totalCount },
          { id: 'document-review' as const, label: 'Document Review', icon: Eye },
          { id: 'check-status' as const, label: 'Check Status', icon: CheckCircle2 },
          { id: 'expiry-recheck' as const, label: 'Expiry & Re-check', icon: RefreshCw },
        ].map((tab) => {
          const isActive = effectiveSection === tab.id && effectiveViewMode !== 'history';
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveSection(tab.id);
                updateUrlParams({
                  section: tab.id === 'queue' ? null : tab.id,
                  tab: tab.id === 'queue' ? null : tab.id,
                  page: 1,
                  status: tab.id === 'expiry-recheck' ? 'RECHECK_DUE' : (tab.id === 'queue' ? (selectedStatus === 'RECHECK_DUE' ? 'ALL' : selectedStatus) : null),
                });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
                marginBottom: '-2px',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                    color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {effectiveViewMode === 'history' ? (
        <VerificationHistoryPage onSelectDossier={handleSelectDossier} hideHeader={true} />
      ) : effectiveSection === 'document-review' ? (
        <VerificationDocumentReviewView
          selectedDossierId={selectedDossierId}
          onSelectDossier={handleSelectDossier}
          onClearSelectedDossier={() => handleSelectDossier(null)}
        />
      ) : effectiveSection === 'check-status' ? (
        <VerificationCheckStatusView onSelectDossier={handleSelectDossier} />
      ) : (
        <>

      {/* Contextual Mode Callout Banner */}
      {effectiveViewMode === 'my-reviews' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-primary-subtle)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <UserCheck size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--color-primary)' }}>My Reviews Workstation:</strong> Active verification dossiers assigned for review (<code>assignedTo=me</code>). You can inspect and evaluate ongoing reviews.
          </div>
        </div>
      )}

      {effectiveViewMode === 'rechecks' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-status-warning-bg)',
            border: '1px solid var(--color-status-warning-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-warning-text)',
          }}
        >
          <RefreshCw size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Re-Verification & Credential Renewal:</strong> Domestic workers requiring annual address proof re-validation, police clearance certificate renewals, or updated driver licenses. Request document updates or renew verified status upon re-inspection.
          </div>
        </div>
      )}

      {effectiveViewMode === 'corrections' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-status-danger-bg)',
            border: '1px solid var(--color-status-danger-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-danger-text)',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Document Rectification Queue:</strong> Applications with one or more rejected checks. Inspect the structured rejection category (e.g. Blurry Image, Name Mismatch) and review applicant rectifications.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={16}
              color="var(--color-text-tertiary)"
              style={{ position: 'absolute', left: 'var(--space-3)' }}
            />
            <input
              type="text"
              placeholder="Search by worker name, ID, locality..."
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                setCurrentPage(1);
                updateUrlParams({ search: val, page: 1 });
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-label="Search verification queue"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status filter buttons */}
          <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'PENDING_REVIEW', label: 'Pending' },
              { key: 'IN_REVIEW', label: 'In Review' },
              { key: 'RECHECK_DUE', label: 'Re-Check Due' },
              { key: 'REJECTED', label: 'Corrections / Rejected' },
              { key: 'APPROVED', label: 'Approved' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => {
                  setSelectedStatus(st.key);
                  setCurrentPage(1);
                  updateUrlParams({ status: st.key, page: 1 });
                }}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  backgroundColor: selectedStatus === st.key ? 'var(--color-brand-600)' : 'var(--color-surface)',
                  color: selectedStatus === st.key ? '#ffffff' : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRight: '1px solid var(--color-border)',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              const cat = e.target.value;
              setSelectedCategory(cat);
              setCurrentPage(1);
              updateUrlParams({ category: cat, page: 1 });
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-surface)',
            }}
            aria-label="Filter by category"
          >
            <option value="ALL">All Service Categories</option>
            <option value="House Maid">House Maid</option>
            <option value="Driver">Driver</option>
            <option value="Cook">Cook</option>
            <option value="Babysitter">Babysitter</option>
            <option value="Elderly Care Helper">Elderly Care Helper</option>
            <option value="Cleaning Helper">Cleaning Helper</option>
          </select>
        </div>
      </div>

      {/* Main Verification Queue Directory (Full-Width) */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
          <div
            style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {effectiveViewMode === 'my-reviews'
                ? `My In-Progress Reviews (${queueData?.totalCount || 0})`
                : effectiveViewMode === 'rechecks'
                ? `Re-Check & Expiry Queue (${queueData?.totalCount || 0})`
                : effectiveViewMode === 'corrections'
                ? `Correction Cases Queue (${queueData?.totalCount || 0})`
                : `Worker Verification Queue (${queueData?.totalCount || 0})`}
            </h2>
            <button
              type="button"
              onClick={toggleSortOrder}
              title={sortOrder === 'desc' ? 'Currently ordered latest applications first. Click to sort oldest first.' : 'Currently ordered oldest applications first. Click to sort latest first.'}
              aria-label={sortOrder === 'desc' ? 'Ordered Latest-First' : 'Ordered Oldest-First'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <ArrowUpDown size={12} />
              <span>{sortOrder === 'desc' ? 'Ordered Latest-First' : 'Ordered Oldest-First'}</span>
            </button>
          </div>

          {claimMutation.isError && (
            <div
              role="alert"
              style={{
                margin: 'var(--space-3) var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-error-dark)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={16} />
                <span>{(claimMutation.error as Error)?.message || 'Failed to start review. Please try again.'}</span>
              </div>
              <button
                onClick={() => claimMutation.reset()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
                aria-label="Dismiss review error"
              >
                ✕
              </button>
            </div>
          )}

          {queueData?.items.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <ShieldCheck size={48} color="var(--color-brand-600)" style={{ marginBottom: 'var(--space-3)' }} />
              <p style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>No pending worker dossiers</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                All verification items in this view are completed or no records match your filter criteria.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Worker & Application
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Category / Locality
                    </th>
                    <th
                      onClick={toggleSortOrder}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      title="Click to toggle submission date ordering (Latest / Oldest)"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Submitted</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Queue Status
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queueData?.items.map((item) => {
                    const targetWorkerId = item.workerId || item.id;
                    const isSelected = Boolean(
                      selectedDossierId === targetWorkerId ||
                      selectedDossierId === item.id
                    );
                    const isClaimingThisItem = claimMutation.isPending && (claimMutation.variables as { checkId?: string } | undefined)?.checkId === item.checkId;

                    return (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open verification dossier for ${item.workerName}`}
                        className={`verification-queue-row clickable-table-row ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          handleSelectDossier(targetWorkerId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            const target = e.target as { closest?: (selector: string) => unknown };
                            if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                              return;
                            }
                            e.preventDefault();
                            handleSelectDossier(targetWorkerId);
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: isSelected ? 'var(--color-brand-50)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: 'var(--space-4)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)', fontWeight: 600 }}>{item.workerId}</span>
                            {item.applicationId && item.applicationId !== item.workerId && (
                              <>
                                <span>•</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }} title="Application ID / Reference Number">
                                  App: {item.applicationId}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                            {item.category}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {item.locality} • {item.experienceYears} Yrs Exp
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {formatDateTimeIST(item.submissionTime)}
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            {/* Submitted / Pending Review Status Actions */}
                            {item.status === 'PENDING_REVIEW' && (
                              <>
                                {canDecide && (
                                  <button
                                    disabled={isActionPending}
                                    aria-label="Start Review"
                                    title="Start verification review on this worker dossier"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.checkId) {
                                        claimMutation.mutate({ checkId: item.checkId, dossierId: targetWorkerId });
                                      } else {
                                        handleSelectDossier(targetWorkerId);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--color-brand-600)',
                                      backgroundColor: 'var(--color-brand-600)',
                                      color: '#ffffff',
                                      fontSize: 'var(--font-size-xs)',
                                      fontWeight: 600,
                                      cursor: isActionPending ? 'not-allowed' : 'pointer',
                                      opacity: isActionPending ? 0.7 : 1,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <ShieldCheck size={13} />
                                    <span>{isClaimingThisItem ? 'Starting...' : 'Start Review'}</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* In Review Status Actions */}
                            {item.status === 'IN_REVIEW' && (
                              <button
                                aria-label={`Continue Review (Inspect Dossier) for ${item.workerName}`}
                                title="Continue active verification review"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDossier(targetWorkerId);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--color-brand-600)',
                                  backgroundColor: isSelected ? 'var(--color-brand-600)' : 'var(--color-primary-subtle)',
                                  color: isSelected ? '#ffffff' : 'var(--color-primary)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Clock size={13} />
                                <span>Continue Review</span>
                              </button>
                            )}

                            {/* Rejected / Corrections Required Status Actions */}
                            {item.status === 'REJECTED' && (
                              <button
                                aria-label={`Review Corrections (Inspect Dossier) for ${item.workerName}`}
                                title="Review applicant corrections and rejected checks"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDossier(targetWorkerId);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: isSelected ? '1px solid var(--color-error)' : '1px solid var(--color-status-danger-border)',
                                  backgroundColor: isSelected ? 'var(--color-error)' : 'var(--color-status-danger-bg)',
                                  color: isSelected ? '#ffffff' : 'var(--color-status-danger-text)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <AlertCircle size={13} />
                                <span>Review Corrections</span>
                              </button>
                            )}

                            {/* Recheck Due Status Actions */}
                            {item.status === 'RECHECK_DUE' && (
                              <button
                                aria-label={`Review Re-Check (Inspect Dossier) for ${item.workerName}`}
                                title="Review credentials and certificates due for re-check"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDossier(targetWorkerId);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: isSelected ? '1px solid var(--color-warning-dark)' : '1px solid var(--color-status-warning-border)',
                                  backgroundColor: isSelected ? 'var(--color-warning-dark)' : 'var(--color-status-warning-bg)',
                                  color: isSelected ? '#ffffff' : 'var(--color-status-warning-text)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <RefreshCw size={13} />
                                <span>Review Re-Check</span>
                              </button>
                            )}

                            {/* Approved Status Actions */}
                            {item.status === 'APPROVED' && (
                              <button
                                aria-label={`View Dossier (read-only mode) for ${item.workerName}`}
                                title="View approved worker dossier in read-only mode"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDossier(targetWorkerId);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: isSelected ? 'var(--color-navy)' : 'var(--color-surface)',
                                  color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>View Dossier</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {queueData && queueData.totalPages > 1 && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Page {queueData.page} of {queueData.totalPages} ({queueData.totalCount} total)
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  disabled={queueData.page <= 1}
                  onClick={() => {
                    const p = Math.max(queueData.page - 1, 1);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    cursor: queueData.page <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  disabled={queueData.page >= queueData.totalPages}
                  onClick={() => {
                    const p = Math.min(queueData.page + 1, queueData.totalPages);
                    setCurrentPage(p);
                    updateUrlParams({ page: p });
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    cursor: queueData.page >= queueData.totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
      </div>
      </>
      )}

            {/* Redesigned Clean Worker Verification Review Modal */}
      {selectedDossierId && (
        <WorkerVerificationReviewModal
          dossierId={selectedDossierId}
          initialDossier={
            queueData?.items.find((item) => (item.workerId || item.id) === selectedDossierId) as unknown as VerificationDossier
          }
          onClose={handleCloseModal}
          triggerElement={triggerElementRef.current}
        />
      )}
    </div>
  );
};
