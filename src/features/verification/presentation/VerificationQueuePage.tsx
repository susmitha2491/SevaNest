import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Check,
  X,
  ShieldCheck,
  PhoneCall,
  Search,
  RotateCw,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import {
  VerificationCheckType,
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationFilterCriteria,
} from '../domain/types';
import { verificationRepository } from '../data/verificationRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';

export interface VerificationQueuePageProps {
  viewMode?: 'all' | 'my-reviews' | 'rechecks' | 'corrections';
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
  const canDecide = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE) || user?.role === 'VERIFICATION_EXECUTIVE' || user?.role === 'SUPER_ADMIN';
  const canReview = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW);
  const canViewDocuments = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW) || hasPermission(user?.permissions, PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED);

  const effectiveViewMode = propViewMode || (
    location.pathname.includes('/my-reviews')
      ? 'my-reviews'
      : location.pathname.includes('/rechecks')
      ? 'rechecks'
      : location.pathname.includes('/corrections')
      ? 'corrections'
      : 'all'
  );

  const initialStatus = searchParams.get('status') || propDefaultStatus || (
    effectiveViewMode === 'my-reviews'
      ? 'IN_REVIEW'
      : effectiveViewMode === 'rechecks'
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

  // Selected Dossier & Active Tab state
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(() => searchParams.get('dossierId') || null);
  const [activeCheckTab, setActiveCheckTab] = useState<VerificationCheckType>('IDENTITY');

  // Modal dialog states
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRecheckDialogOpen, setIsRecheckDialogOpen] = useState(false);
  const [selectedRejectionCategory, setSelectedRejectionCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [recheckInstructions, setRecheckInstructions] = useState('');
  const [telephonicCallNotes, setTelephonicCallNotes] = useState('');
  const [docRotation, setDocRotation] = useState(0);
  const [docZoom, setDocZoom] = useState(100);

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

  const handleSelectDossier = (id: string | null) => {
    setSelectedDossierId(id);
    updateUrlParams({ dossierId: id });
  };

  // Synchronize state when URL params change externally
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
    const urlDossierId = searchParams.get('dossierId');
    if (urlDossierId !== null && urlDossierId !== selectedDossierId) {
      setSelectedDossierId(urlDossierId);
    }
  }, [searchParams, searchTerm, selectedDossierId]);

  // Query verification queue
  const { data: queueData, isLoading, isError, error: queueError, refetch } = useQuery({
    queryKey: ['verification', 'queue', searchTerm, selectedStatus, selectedCategory, currentPage],
    queryFn: () =>
      verificationRepository.getVerificationQueue({
        searchTerm,
        status: selectedStatus as VerificationFilterCriteria['status'],
        category: selectedCategory,
        page: currentPage,
        pageSize: 5,
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
          setSelectedDossierId(match.id);
        }
      }
    }
  }, [queueData, selectedDossierId, searchParams]);

  // Query single dossier details if selected
  const { data: activeDossier } = useQuery({
    queryKey: ['verification', 'dossier', selectedDossierId],
    queryFn: () => (selectedDossierId ? verificationRepository.getDossierById(selectedDossierId) : null),
    enabled: !!selectedDossierId,
  });

  const currentDossier = activeDossier || queueData?.items.find((d) => d.id === selectedDossierId) || null;
  const currentCheck = currentDossier ? currentDossier.checks[activeCheckTab] : null;
  const isDocumentCheck = currentCheck && currentCheck.evaluationMethod !== 'TELEPHONIC_VETTING';

  // Query authorized signed document link for document checks
  const {
    data: docLinkData,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
    refetch: refetchDocLink,
  } = useQuery({
    queryKey: [
      'verification',
      'documentLink',
      currentDossier?.id,
      activeCheckTab,
      currentCheck?.documentMetadata?.documentId,
    ],
    queryFn: () =>
      verificationRepository.getSignedDocumentUrl(
        currentDossier!.id,
        activeCheckTab,
        currentCheck?.documentMetadata?.documentId
      ),
    enabled: !!currentDossier && canViewDocuments && !!isDocumentCheck,
    staleTime: 5 * 60 * 1000,
  });

  // Cross-entity cache invalidation helper
  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: ['verification'] });
    queryClient.invalidateQueries({ queryKey: ['workers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  // Mutations
  const approveCheckMutation = useMutation({
    mutationFn: async ({
      dossierId,
      checkType,
      notes,
    }: {
      dossierId: string;
      checkType: VerificationCheckType;
      notes?: string;
    }) => {
      await verificationRepository.approveCheck(dossierId, checkType, notes);
    },
    onSuccess: () => {
      invalidateRelated();
    },
  });

  const rejectCheckMutation = useMutation({
    mutationFn: async ({
      dossierId,
      checkType,
      category,
      remarks,
    }: {
      dossierId: string;
      checkType: VerificationCheckType;
      category: RejectionReasonCategory;
      remarks: string;
    }) => {
      await verificationRepository.rejectCheck(dossierId, checkType, category, remarks);
    },
    onSuccess: () => {
      invalidateRelated();
      setIsRejectDialogOpen(false);
      setRejectionRemarks('');
    },
  });

  const recheckMutation = useMutation({
    mutationFn: async ({
      dossierId,
      checkTypes,
      instructions,
    }: {
      dossierId: string;
      checkTypes: VerificationCheckType[];
      instructions: string;
    }) => {
      await verificationRepository.requestReVerification(dossierId, checkTypes, instructions);
    },
    onSuccess: () => {
      invalidateRelated();
      setIsRecheckDialogOpen(false);
      setRecheckInstructions('');
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (dossierId: string) => {
      await verificationRepository.claimDossier(dossierId);
    },
    onSuccess: () => {
      invalidateRelated();
    },
  });

  const isActionPending =
    approveCheckMutation.isPending ||
    rejectCheckMutation.isPending ||
    recheckMutation.isPending ||
    claimMutation.isPending;

  const mutationError =
    approveCheckMutation.error ||
    rejectCheckMutation.error ||
    recheckMutation.error ||
    claimMutation.error;

  const resetMutationErrors = () => {
    approveCheckMutation.reset();
    rejectCheckMutation.reset();
    recheckMutation.reset();
    claimMutation.reset();
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
              : 'Worker Verification & Trust Operations'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {effectiveViewMode === 'my-reviews'
              ? 'Active claimed dossiers and ongoing verification reviews under operational evaluation.'
              : effectiveViewMode === 'rechecks'
              ? 'Annual compliance renewals, expiring police certificates, and re-check directives.'
              : effectiveViewMode === 'corrections'
              ? 'Rejected checks, missing KYC documents, and applicant rectification tracking.'
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
          <span>Operational Verification Workstation</span>
        </div>
      </div>

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
            <strong style={{ color: 'var(--color-primary)' }}>Reviewer Assignment & Claim Scope:</strong> Currently displaying active in-progress verification dossiers. Server-side executive assignment filtering (<code>assignedTo=me</code>) is pending backend contract enhancement. You can resume and decide any in-progress review.
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
          padding: 'var(--space-4)',
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
          </select>
        </div>
      </div>

      {/* Main Review Console Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: currentDossier ? '1fr 1.3fr' : '1fr',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Verification Queue Table */}
        <div
          style={{
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
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Ordered Oldest-First
            </span>
          </div>

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
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Submitted
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
                  {queueData?.items.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: currentDossier?.id === item.id ? 'var(--color-brand-50)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: 'var(--space-4)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)', fontWeight: 600 }}>{item.workerId}</span>
                          {item.applicationId && (
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
                        <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                          {item.status === 'PENDING_REVIEW' && canDecide && (
                            <button
                              disabled={isActionPending}
                              onClick={() => {
                                claimMutation.mutate(item.id);
                                handleSelectDossier(item.id);
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
                              }}
                            >
                              Claim & Review
                            </button>
                          )}
                          <button
                            onClick={() => handleSelectDossier(item.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: currentDossier?.id === item.id ? 'var(--color-brand-600)' : 'var(--color-surface)',
                              color: currentDossier?.id === item.id ? '#ffffff' : 'var(--color-text-primary)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect Dossier
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

        {/* Right Column: Split-Screen Dossier Review Console */}
        {currentDossier ? (
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Dossier Header */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Verification Dossier: {currentDossier.workerName}
                  </h3>
                  <StatusBadge status={currentDossier.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Worker ID: <span style={{ fontFamily: 'monospace' }}>{currentDossier.workerId}</span>
                    {currentDossier.applicationId && (
                      <> • App Ref: <span style={{ fontFamily: 'monospace' }}>{currentDossier.applicationId}</span></>
                    )}
                    {' '}• Category: {currentDossier.category} • Locality: {currentDossier.locality}
                    {currentDossier.submissionTime && (
                      <> • Submitted: {formatDateTimeIST(currentDossier.submissionTime)}</>
                    )}
                  </p>
                  <button
                    onClick={() => navigate(`/workers?search=${encodeURIComponent(currentDossier.workerId)}&workerId=${encodeURIComponent(currentDossier.workerId)}`)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-brand-600)',
                      cursor: 'pointer',
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>View Worker Record</span>
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {currentDossier.status === 'PENDING_REVIEW' && canDecide && (
                  <button
                    disabled={isActionPending}
                    onClick={() => claimMutation.mutate(currentDossier.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-brand-600)',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#ffffff',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: isActionPending ? 'not-allowed' : 'pointer',
                      opacity: isActionPending ? 0.7 : 1,
                    }}
                  >
                    <ShieldCheck size={14} />
                    {claimMutation.isPending ? 'Claiming...' : 'Claim Dossier & Start Review'}
                  </button>
                )}
                <button
                  onClick={() => handleSelectDossier(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 700,
                  }}
                  aria-label="Close dossier view"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Mutation Inline Error Banner */}
            {mutationError && (
              <div
                role="alert"
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  backgroundColor: 'var(--color-error-bg)',
                  borderBottom: '1px solid var(--color-error-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-error-dark)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertTriangle size={16} />
                  <span>
                    {(mutationError as Error)?.message || 'Action failed. Please verify required permissions and backend connectivity.'}
                  </span>
                </div>
                <button
                  onClick={resetMutationErrors}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-dark)', fontWeight: 700 }}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Automated Pre-check Banner */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: currentDossier.preCheckOtpVerified ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldCheck size={16} color={currentDossier.preCheckOtpVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)'} />
                <span style={{ fontWeight: 600, color: currentDossier.preCheckOtpVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)' }}>
                  Tier 1 Automated Onboarding Pre-Check: Mobile OTP {currentDossier.preCheckOtpVerified ? 'PASSED (System Verified)' : 'PENDING'}
                </span>
              </div>
              <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{currentDossier.phoneMasked}</span>
            </div>

            {/* 5 Operations Checks Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                overflowX: 'auto',
              }}
            >
              {(
                [
                  { key: 'IDENTITY', label: '1. Identity Proof' },
                  { key: 'ADDRESS', label: '2. Address Proof' },
                  { key: 'EMERGENCY_CONTACT', label: '3. Emergency Contact' },
                  { key: 'REFERENCE', label: '4. Employer Reference' },
                  { key: 'POLICE_CLEARANCE', label: '5. Police Certificate' },
                ] as const
              ).map((tab) => {
                const check = currentDossier.checks[tab.key];
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCheckTab(tab.key)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      border: 'none',
                      borderBottom: activeCheckTab === tab.key ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                      backgroundColor: activeCheckTab === tab.key ? 'var(--color-surface)' : 'transparent',
                      color: activeCheckTab === tab.key ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                      fontWeight: 700,
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          check?.status === 'APPROVED'
                            ? 'var(--color-status-success-text)'
                            : check?.status === 'REJECTED'
                            ? 'var(--color-status-danger-text)'
                            : 'var(--color-status-warning-text)',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Active Check Details and Inspection Pane */}
            {currentCheck && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Active Check Overview Box */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Inspection Check:
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {currentCheck.title}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Check Status:</span>
                    <StatusBadge status={currentCheck.status} />
                  </div>
                </div>

                {/* Sub-Pane 1: Document Inspection View (Identity, Address, Police) */}
                {currentCheck.evaluationMethod !== 'TELEPHONIC_VETTING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {currentCheck.documentMetadata && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3)',
                          backgroundColor: '#f8fafc',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-xs)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)' }}>Document Type:</strong>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentCheck.documentMetadata.documentTypeName}</div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)' }}>Name on Document:</strong>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentCheck.documentMetadata.nameOnDoc || currentDossier.workerName}</div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)' }}>Document Ref Number:</strong>
                          <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-brand-700)' }}>
                            {currentCheck.documentMetadata.docNumberMasked || 'XXXX-XXXX-VALID'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Restricted access notice if user lacks DOCUMENTS_VIEW_RESTRICTED */}
                    {!canViewDocuments ? (
                      <div
                        style={{
                          padding: 'var(--space-6)',
                          backgroundColor: 'var(--color-warning-bg)',
                          border: '1px solid var(--color-warning-border)',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                          color: 'var(--color-warning-dark)',
                        }}
                      >
                        <Lock size={32} style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-1) 0' }}>
                          Restricted Personal Document (KYC)
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
                          Access to raw identity and address document attachments requires the <code>verification.document.view</code> (<code>documents.view_restricted</code>) permission.
                        </p>
                      </div>
                    ) : isDocLoading ? (
                      <div
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          minHeight: '220px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LoadingSpinner message="Fetching authorized signed document link from secure vault..." />
                      </div>
                    ) : isDocError ? (
                      <div
                        style={{
                          border: '1px solid var(--color-error-border)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-error-bg)',
                          minHeight: '220px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 'var(--space-6)',
                          textAlign: 'center',
                        }}
                      >
                        <AlertTriangle size={36} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, color: 'var(--color-error-dark)', margin: '0 0 var(--space-1) 0' }}>
                          Failed to load document attachment
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '380px' }}>
                          Document Vault Access Unavailable: {(docError as Error)?.message || 'The signed document link is missing, expired, or access was rejected. Required contract: GET /api/v1/admin/verification/documents/{documentId}/link.'}
                        </p>
                        <button
                          onClick={() => refetchDocLink()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-brand-600)',
                            color: '#fff',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={14} /> Retry Fetching Document
                        </button>
                      </div>
                    ) : !docLinkData?.signedUrl ? (
                      <div
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          minHeight: '220px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 'var(--space-6)',
                          textAlign: 'center',
                        }}
                      >
                        <AlertCircle size={36} color="var(--color-text-muted)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
                          Document Attachment Unavailable
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '380px' }}>
                          The authorized backend signed document endpoint did not return an active access URL. Contract gap: <code>GET /api/v1/admin/verification/documents/{'{documentId}'}/link</code>.
                        </p>
                        <button
                          onClick={() => refetchDocLink()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-brand-600)',
                            color: '#fff',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={14} /> Retry Fetching Document
                        </button>
                      </div>
                    ) : (
                      /* Document Viewer Container with Authorized Link */
                      <div
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-text-primary)',
                          minHeight: '220px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          padding: 'var(--space-6)',
                        }}
                      >
                        {/* Document Canvas Display */}
                        <div
                          style={{
                            transform: `rotate(${docRotation}deg) scale(${docZoom / 100})`,
                            transition: 'transform 0.2s ease',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <FileText size={56} color="var(--color-brand-600)" />
                          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            [CONFIDENTIAL KYC ATTACHMENT]
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {currentCheck.documentMetadata?.documentTypeName || 'Official Government Certificate'}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--color-text-muted)',
                              backgroundColor: 'var(--color-border-subtle)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginTop: 'var(--space-1)',
                            }}
                          >
                            Authorized Document Vault Record • Watermarked for Confidential Inspection
                          </div>
                          {docLinkData.expiresAt && (
                            <div style={{ fontSize: '10px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                              Validity: {docLinkData.expiresAt}
                            </div>
                          )}
                        </div>

                        {/* Secure Document Link Action */}
                        <div style={{ marginTop: 'var(--space-4)', zIndex: 2 }}>
                          <a
                            href={docLinkData.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-brand-600)',
                              color: '#ffffff',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              textDecoration: 'none',
                              boxShadow: 'var(--shadow-sm)',
                            }}
                          >
                            <ExternalLink size={14} /> Open Secure Document Link
                          </a>
                        </div>

                        {/* Viewer Toolbar */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'var(--space-2)',
                            right: 'var(--space-2)',
                            display: 'flex',
                            gap: 'var(--space-1)',
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            boxShadow: 'var(--shadow-sm)',
                            padding: '4px',
                            borderRadius: 'var(--radius-md)',
                            zIndex: 3,
                          }}
                        >
                          <button
                            onClick={() => setDocZoom((z) => Math.min(z + 10, 150))}
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 4px' }}
                            title="Zoom In"
                            aria-label="Zoom In"
                          >
                            <ZoomIn size={14} />
                          </button>
                          <button
                            onClick={() => setDocZoom((z) => Math.max(z - 10, 70))}
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 4px' }}
                            title="Zoom Out"
                            aria-label="Zoom Out"
                          >
                            <ZoomOut size={14} />
                          </button>
                          <button
                            onClick={() => setDocRotation((r) => (r + 90) % 360)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 4px' }}
                            title="Rotate 90deg"
                            aria-label="Rotate 90 degrees"
                          >
                            <RotateCw size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Pane 2: Telephonic Vetting View (Emergency Contact / Prior Employer Reference) */}
                {currentCheck.evaluationMethod === 'TELEPHONIC_VETTING' && currentCheck.contactDetails && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-4)',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-brand-700)' }}>
                      <PhoneCall size={18} />
                      <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
                        Telephonic Vetting Contact Record
                      </h5>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                      <div>
                        <strong style={{ color: 'var(--color-text-secondary)' }}>Contact Person:</strong>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentCheck.contactDetails.contactName}</div>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--color-text-secondary)' }}>Relationship / Role:</strong>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentCheck.contactDetails.relationshipOrRole}</div>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--color-text-secondary)' }}>Phone Number:</strong>
                        <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-brand-600)' }}>
                          {currentCheck.contactDetails.phoneMasked}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                        Telephonic Interview Notes & Vetting Summary:
                      </label>
                      <textarea
                        rows={2}
                        defaultValue={currentCheck.contactDetails.callNotes || ''}
                        onChange={(e) => setTelephonicCallNotes(e.target.value)}
                        placeholder="Record detailed notes from phone conversation (relationship confirmation, conduct feedback, tenure verification)..."
                        style={{
                          width: '100%',
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Rejection Details Banner if already rejected */}
                {currentCheck.status === 'REJECTED' && (
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-error-bg)',
                      border: '1px solid var(--color-error-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-error-dark)',
                    }}
                  >
                    <strong>Rejection Category:</strong> {currentCheck.rejectionCategory || 'Operational Rejection'}
                    <div style={{ marginTop: '2px' }}>
                      <strong>Remarks:</strong> {currentCheck.rejectionRemarks || 'No additional remarks.'}
                    </div>
                  </div>
                )}

                {/* Action Controls for Active Check */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'var(--space-2)',
                    paddingTop: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  <button
                    disabled={isActionPending}
                    onClick={() => setIsRecheckDialogOpen(true)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-warning-dark)',
                      backgroundColor: 'var(--color-warning-bg)',
                      color: 'var(--color-warning-dark)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: isActionPending ? 'not-allowed' : 'pointer',
                      opacity: isActionPending ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RefreshCw size={14} /> Request Re-Verification
                  </button>

                  {canDecide ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        disabled={isActionPending}
                        onClick={() => setIsRejectDialogOpen(true)}
                        style={{
                          padding: 'var(--space-2) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-error-dark)',
                          backgroundColor: 'var(--color-error-bg)',
                          color: 'var(--color-error-dark)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: isActionPending ? 'not-allowed' : 'pointer',
                          opacity: isActionPending ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <X size={14} /> Reject Check
                      </button>

                      <button
                        disabled={isActionPending}
                        onClick={() => {
                          approveCheckMutation.mutate({
                            dossierId: currentDossier.id,
                            checkType: activeCheckTab,
                            notes: telephonicCallNotes,
                          });
                        }}
                        style={{
                          padding: 'var(--space-2) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-brand-600)',
                          backgroundColor: 'var(--color-brand-600)',
                          color: '#ffffff',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: isActionPending ? 'not-allowed' : 'pointer',
                          opacity: isActionPending ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Check size={14} /> {approveCheckMutation.isPending ? 'Approving...' : 'Approve Check'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <button
                        onClick={() => navigate(`/workers?search=${encodeURIComponent(currentDossier.workerId)}&workerId=${encodeURIComponent(currentDossier.workerId)}`)}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-brand-600)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ExternalLink size={14} /> Inspect Worker Profile
                      </button>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        (Verification decisions reserved for Verification Executives)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--color-border)',
              padding: 'var(--space-12)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ShieldCheck size={56} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-3)' }} />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No Worker Dossier Selected
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', maxWidth: '360px', margin: '0 auto' }}>
              Select a worker record from the queue on the left to launch the split-screen document and telephonic review workstation.
            </p>
          </div>
        )}
      </div>

      {/* Reject Dialog with Structured Rejection Categories */}
      <ConfirmDialog
        isOpen={isRejectDialogOpen}
        title={`Reject ${currentCheck?.title || 'Verification Check'}`}
        description="Select an operational rejection reason category and provide mandatory remarks. The worker will be notified to re-upload or rectify."
        confirmLabel="Confirm Rejection"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational remarks (e.g., Aadhaar image is blurry, name mismatch with registration)..."
        isLoading={rejectCheckMutation.isPending}
        onConfirm={(remarks) => {
          if (currentDossier) {
            rejectCheckMutation.mutate({
              dossierId: currentDossier.id,
              checkType: activeCheckTab,
              category: selectedRejectionCategory,
              remarks: remarks || rejectionRemarks || 'Verification check rejected by executive.',
            });
          }
        }}
        onCancel={() => setIsRejectDialogOpen(false)}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
            Rejection Category:
          </label>
          <select
            value={selectedRejectionCategory}
            onChange={(e) => setSelectedRejectionCategory(e.target.value as RejectionReasonCategory)}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-surface)',
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

      {/* Re-Verification Request Modal */}
      <ConfirmDialog
        isOpen={isRecheckDialogOpen}
        title="Request Document Re-Verification"
        description="Issue an operational re-verification request to the worker app for annual renewal or document update."
        confirmLabel="Issue Re-Verification Request"
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory instructions for the worker (e.g., Please upload updated electricity bill for address re-check)..."
        isLoading={recheckMutation.isPending}
        onConfirm={(remarks) => {
          if (currentDossier) {
            recheckMutation.mutate({
              dossierId: currentDossier.id,
              checkTypes: [activeCheckTab],
              instructions: remarks || recheckInstructions || 'Annual document re-verification requested.',
            });
          }
        }}
        onCancel={() => setIsRecheckDialogOpen(false)}
      />
    </div>
  );
};
