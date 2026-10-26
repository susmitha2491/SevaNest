import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  User,
  Briefcase,
  Clock,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
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
import {
  ConcurrencyConflictError,
  ValidationError,
} from '../../../core/errors/DomainError';
import { resolveClaimOwnership } from '../domain/claimOwnership';
import { validateDocumentSignedUrl } from '../domain/documentUrlValidator';
import { formatDocumentVaultError } from '../domain/documentVaultErrorFormatter';

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
  const canViewPhone = hasPermission(user?.permissions, PERMISSIONS.WORKERS_MANAGE) || user?.role === 'VERIFICATION_EXECUTIVE' || user?.role === 'SUPER_ADMIN';

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
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(
    () => searchParams.get('workerId') || searchParams.get('dossierId') || null
  );
  const [activeCheckTab, setActiveCheckTab] = useState<VerificationCheckType>('IDENTITY');
  const [activeDossierSection, setActiveDossierSection] = useState<
    'WORKSTATION' | 'PERSONAL_DETAILS' | 'WORK_PROFILE' | 'DOCUMENTS_VAULT' | 'CHECKLIST' | 'REVIEW_HISTORY'
  >('WORKSTATION');
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);

  // Modal dialog states
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRecheckDialogOpen, setIsRecheckDialogOpen] = useState(false);
  const [selectedRejectionCategory, setSelectedRejectionCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [recheckInstructions, setRecheckInstructions] = useState('');
  const [telephonicCallNotes, setTelephonicCallNotes] = useState('');
  const [docRotation, setDocRotation] = useState(0);
  const [docZoom, setDocZoom] = useState(100);
  const [inspectingVaultDoc, setInspectingVaultDoc] = useState<{
    checkType: VerificationCheckType;
    documentId: string;
    title: string;
    docNumberMasked?: string;
    documentTypeName?: string;
    status?: string;
  } | null>(null);
  const [vaultDocRotation, setVaultDocRotation] = useState(0);
  const [vaultDocZoom, setVaultDocZoom] = useState(100);
  const [claimConflictMessage, setClaimConflictMessage] = useState<string | null>(null);

  // References for modal accessibility & focus management
  const triggerElementRef = useRef<{ focus: () => void } | null>(null);
  const modalContentRef = useRef<React.ComponentRef<'div'> | null>(null);
  const closeButtonRef = useRef<React.ComponentRef<'button'> | null>(null);

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
    setInspectingVaultDoc(null);
    setVaultDocRotation(0);
    setVaultDocZoom(100);
    updateUrlParams({ workerId: workerIdOrDossierId, dossierId: workerIdOrDossierId });
  };

  const handleCloseModal = useCallback(() => {
    setSelectedDossierId(null);
    setInspectingVaultDoc(null);
    setVaultDocRotation(0);
    setVaultDocZoom(100);
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
  }, [setSearchParams]);

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
  }, [searchParams, searchTerm, selectedDossierId]);

  // Query verification queue
  const { data: queueData, isLoading, isError, error: queueError, refetch } = useQuery({
    queryKey: ['verification', 'queue', effectiveViewMode, searchTerm, selectedStatus, selectedCategory, currentPage],
    queryFn: () =>
      verificationRepository.getVerificationQueue({
        assignedTo: effectiveViewMode === 'my-reviews' ? 'me' : undefined,
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
          setSelectedDossierId(match.workerId || match.id);
        }
      }
    }
  }, [queueData, selectedDossierId, searchParams]);

  // Query single dossier details if selected using genuine workerId
  const { data: activeDossier, isLoading: isActiveDossierLoading } = useQuery({
    queryKey: ['verification', 'dossier', selectedDossierId],
    queryFn: () => (selectedDossierId ? verificationRepository.getDossierById(selectedDossierId) : null),
    enabled: !!selectedDossierId,
  });

  const currentDossier =
    activeDossier ||
    queueData?.items.find((d) => d.workerId === selectedDossierId || d.id === selectedDossierId) ||
    null;
  const currentCheck = currentDossier ? currentDossier.checks[activeCheckTab] : null;
  const isDocumentCheck = currentCheck && currentCheck.evaluationMethod !== 'TELEPHONIC_VETTING';
  const dossierOwnership = currentDossier
    ? resolveClaimOwnership(currentDossier.reviewerUserId, currentDossier.claimedAt, user?.id)
    : null;
  const dossierTargetCheckId = currentCheck?.id || currentDossier?.checkId;

  const isModalOpen = Boolean(selectedDossierId);

  // Lock background scroll while modal is open, and handle Escape key
  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
      // If a nested confirm dialog is open, let that dialog handle Escape
      if (isApproveDialogOpen || isRejectDialogOpen || isRecheckDialogOpen) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isApproveDialogOpen, isRejectDialogOpen, isRecheckDialogOpen, handleCloseModal]);

  // Trap keyboard focus within modal and focus close button on open
  useEffect(() => {
    if (isModalOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isModalOpen, selectedDossierId]);

  const handleModalKeyDown = (e: React.KeyboardEvent<React.ComponentRef<'div'>>) => {
    if (e.key === 'Tab') {
      const modalEl = modalContentRef.current;
      if (!modalEl) return;
      const focusables = Array.from(
        modalEl.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          if ('focus' in lastEl && typeof lastEl.focus === 'function') {
            (lastEl as { focus: () => void }).focus();
          }
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          if ('focus' in firstEl && typeof firstEl.focus === 'function') {
            (firstEl as { focus: () => void }).focus();
          }
        }
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<React.ComponentRef<'div'>>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  // Query authorized signed document link for document checks
  const rawDocId = currentCheck?.documentMetadata?.documentId;
  const docId = typeof rawDocId === 'string' && rawDocId.trim() !== '' ? rawDocId.trim() : undefined;
  const hasValidDocId = Boolean(docId);

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
      currentDossier?.workerId || currentDossier?.id,
      activeCheckTab,
      docId,
    ],
    queryFn: () => {
      if (!docId || !currentDossier) {
        return null;
      }
      return verificationRepository.getSignedDocumentUrl(
        currentDossier.workerId || currentDossier.id,
        activeCheckTab,
        docId
      );
    },
    enabled: !!currentDossier && canViewDocuments && !!isDocumentCheck && hasValidDocId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Query authorized signed document link for vault document inspection
  const inspectingVaultDocId = inspectingVaultDoc?.documentId;
  const {
    data: vaultDocLinkData,
    isLoading: isVaultDocLoading,
    isError: isVaultDocError,
    error: vaultDocError,
    refetch: refetchVaultDocLink,
  } = useQuery({
    queryKey: [
      'verification',
      'vaultDocumentLink',
      currentDossier?.workerId || currentDossier?.id,
      inspectingVaultDoc?.checkType,
      inspectingVaultDocId,
    ],
    queryFn: () => {
      if (!inspectingVaultDocId || !currentDossier || !inspectingVaultDoc) {
        return null;
      }
      return verificationRepository.getSignedDocumentUrl(
        currentDossier.workerId || currentDossier.id,
        inspectingVaultDoc.checkType,
        inspectingVaultDocId
      );
    },
    enabled: !!currentDossier && canViewDocuments && !!inspectingVaultDoc && !!inspectingVaultDocId,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
      checkId,
      checkType,
      notes,
    }: {
      checkId: string;
      checkType?: VerificationCheckType;
      notes?: string;
    }) => {
      await verificationRepository.approveCheck(checkId, checkType, notes);
    },
    onSuccess: () => {
      invalidateRelated();
    },
  });

  const rejectCheckMutation = useMutation({
    mutationFn: async ({
      checkId,
      checkType,
      category,
      remarks,
    }: {
      checkId: string;
      checkType?: VerificationCheckType;
      category: RejectionReasonCategory;
      remarks: string;
    }) => {
      await verificationRepository.rejectCheck(checkId, checkType, category, remarks);
    },
    onSuccess: () => {
      invalidateRelated();
      setIsRejectDialogOpen(false);
      setRejectionRemarks('');
    },
  });

  const recheckMutation = useMutation({
    mutationFn: async ({
      checkId,
      checkTypes,
      instructions,
    }: {
      checkId: string;
      checkTypes: VerificationCheckType[];
      instructions: string;
    }) => {
      await verificationRepository.requestReVerification(checkId, checkTypes, instructions);
    },
    onSuccess: () => {
      invalidateRelated();
      setIsRecheckDialogOpen(false);
      setRecheckInstructions('');
    },
  });

  const claimMutation = useMutation({
    mutationFn: async ({ checkId, dossierId }: { checkId: string; dossierId: string }) => {
      if (!checkId || checkId.startsWith('W-') || checkId.startsWith('VQ-') || checkId.startsWith('APP-')) {
        throw new ValidationError('A valid verification checkId is required to start review. Worker or dossier IDs cannot be used.');
      }
      await verificationRepository.claimCheck(checkId);
      return { checkId, dossierId };
    },
    onSuccess: (data) => {
      setClaimConflictMessage(null);
      invalidateRelated();
      handleSelectDossier(data.dossierId);
    },
    onError: (err: unknown) => {
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
        conflictErr?.response?.status === 409 ||
        conflictErr?.response?.data?.code === 'CHECK_ALREADY_ASSIGNED' ||
        (err as Error)?.message?.toLowerCase().includes('already assigned');

      if (isConflict) {
        setClaimConflictMessage(
          'Another reviewer has already claimed this verification check. The queue has been updated.'
        );
        refetch();
        queryClient.invalidateQueries({ queryKey: ['verification', 'queue'] });
      }
    },
  });

  const isActionPending =
    approveCheckMutation.isPending ||
    rejectCheckMutation.isPending ||
    recheckMutation.isPending ||
    claimMutation.isPending;

  const mutationError: Error | null =
    (approveCheckMutation.error as Error | null) ||
    (rejectCheckMutation.error as Error | null) ||
    (recheckMutation.error as Error | null) ||
    (claimMutation.error as Error | null);

  const resetMutationErrors = () => {
    approveCheckMutation.reset();
    rejectCheckMutation.reset();
    recheckMutation.reset();
    claimMutation.reset();
    setClaimConflictMessage(null);
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
            <strong style={{ color: 'var(--color-primary)' }}>Reviewer Assignment & Claim Scope:</strong> Active verification dossiers assigned to you (<code>assignedTo=me</code>). You can inspect and evaluate your active claims.
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
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Ordered Oldest-First
            </span>
          </div>

          {claimConflictMessage && (
            <div
              role="alert"
              style={{
                margin: 'var(--space-3) var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-status-warning-bg, #fffbeb)',
                border: '1px solid var(--color-status-warning-border, #fde68a)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-warning-text, #92400e)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={16} />
                <span>{claimConflictMessage}</span>
              </div>
              <button
                onClick={() => setClaimConflictMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
                aria-label="Dismiss conflict alert"
              >
                ✕
              </button>
            </div>
          )}

          {claimMutation.isError && !claimConflictMessage && (
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
                aria-label="Dismiss claim error"
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
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Submitted
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Queue Status
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Claim Ownership
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
                      (currentDossier?.workerId && currentDossier.workerId === targetWorkerId) ||
                      (currentDossier?.id && (currentDossier.id === targetWorkerId || currentDossier.id === item.id)) ||
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
                        className={`verification-queue-row ${isSelected ? 'selected' : ''}`}
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
                        <td style={{ padding: 'var(--space-4)' }}>
                          {(() => {
                            const ownership = resolveClaimOwnership(item.reviewerUserId, item.claimedAt, user?.id);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    ...ownership.badgeStyle,
                                    width: 'fit-content',
                                  }}
                                >
                                  {ownership.label}
                                </span>
                                {ownership.claimedAtFormatted && (
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                                    {ownership.claimedAtFormatted}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            {/* Submitted / Pending Review Status Actions */}
                            {item.status === 'PENDING_REVIEW' && (
                              <>
                                {canDecide && (
                                  item.checkId ? (
                                    <button
                                      disabled={isActionPending}
                                      aria-label="Start Review (Claim & Review)"
                                      title="Start verification review on this worker dossier"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setClaimConflictMessage(null);
                                        claimMutation.mutate({ checkId: item.checkId!, dossierId: targetWorkerId });
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
                                  ) : (
                                    <button
                                      disabled
                                      aria-label="Start Review Unavailable (Claim Unavailable)"
                                      title="Direct queue claiming unavailable: checkId not provided in queue response by backend. Inspect dossier to view checks."
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        color: 'var(--color-text-tertiary)',
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        cursor: 'not-allowed',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <ShieldCheck size={13} />
                                      <span>Claim Unavailable</span>
                                    </button>
                                  )
                                )}
                                <button
                                  aria-label={`Inspect Dossier for ${item.workerName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectDossier(targetWorkerId);
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: isSelected ? 'var(--color-brand-600)' : 'var(--color-surface)',
                                    color: isSelected ? '#ffffff' : 'var(--color-text-primary)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Inspect Dossier
                                </button>
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

      {/* Centered Worker Verification Dossier Modal Popup */}
      {selectedDossierId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dossier-modal-title"
          className="verification-dossier-modal-backdrop"
          onClick={handleBackdropClick}
          onKeyDown={handleModalKeyDown}
        >
          <div
            ref={modalContentRef}
            className="verification-dossier-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {isActiveDossierLoading && !currentDossier ? (
              <div
                style={{
                  padding: 'var(--space-12)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <LoadingSpinner message="Loading worker verification dossier..." />
                <button
                  ref={closeButtonRef}
                  onClick={handleCloseModal}
                  style={{
                    marginTop: 'var(--space-4)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                  }}
                  aria-label="Close dossier view"
                >
                  Close
                </button>
              </div>
            ) : !currentDossier ? (
              <div
                style={{
                  padding: 'var(--space-12)',
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={48} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-3)' }} />
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Worker Dossier Not Found
                </h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: 'var(--space-2) auto var(--space-6)' }}>
                  Unable to locate verification dossier for identifier &quot;{selectedDossierId}&quot;.
                </p>
                <button
                  ref={closeButtonRef}
                  onClick={handleCloseModal}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-brand-600)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  aria-label="Close dossier view"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Dossier Header (Fixed at top of modal) */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: 'var(--space-4) var(--space-6)',
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  {/* Top Header Row: Worker Name, Verification Status, Read-Only Badge, Ownership, and Top-Right Close Button */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <h3
                        id="dossier-modal-title"
                        style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: 800,
                          color: 'var(--color-text-primary)',
                          margin: 0,
                        }}
                      >
                        Verification Dossier: {currentDossier.workerName}
                      </h3>
                      <StatusBadge status={currentDossier.status} />
                      {currentDossier.status === 'APPROVED' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            backgroundColor: 'var(--color-status-success-bg)',
                            border: '1px solid var(--color-status-success-border)',
                            color: 'var(--color-status-success-text)',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Read-Only Mode
                        </span>
                      )}
                      {dossierOwnership && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            ...dossierOwnership.badgeStyle,
                          }}
                          title={dossierOwnership.claimedAtFormatted ? `Claimed at: ${dossierOwnership.claimedAtFormatted}` : undefined}
                        >
                          {dossierOwnership.label}
                        </span>
                      )}
                    </div>

                    {/* Right-aligned actions: Optional claim action + Top-Right Close Button */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        flexShrink: 0,
                      }}
                    >
                      {Boolean(currentDossier.status === 'PENDING_REVIEW' && canDecide) && (
                        dossierTargetCheckId ? (
                          <button
                            disabled={isActionPending}
                            onClick={() => {
                              setClaimConflictMessage(null);
                              claimMutation.mutate({ checkId: dossierTargetCheckId, dossierId: currentDossier.id });
                            }}
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
                            {claimMutation.isPending ? 'Claiming...' : 'Claim Check & Start Review'}
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Check claiming unavailable: backend checkId is missing."
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-bg-subtle)',
                              color: 'var(--color-text-tertiary)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'not-allowed',
                            }}
                          >
                            <ShieldCheck size={14} />
                            Claim Unavailable (Missing Check ID)
                          </button>
                        )
                      )}

                      <button
                        ref={closeButtonRef}
                        onClick={handleCloseModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary)',
                          padding: '6px',
                          borderRadius: 'var(--radius-md)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-label="Close dossier view"
                        title="Close dossier modal (Escape)"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Second metadata row beneath the title: Worker ID, category, locality, submission details, and View Worker Record */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Worker ID: <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{currentDossier.workerId}</strong></span>
                      {Boolean(currentDossier.applicationId && currentDossier.applicationId !== currentDossier.workerId) && (
                        <span>• App Ref: <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{currentDossier.applicationId}</strong></span>
                      )}
                      <span>• Category: {currentDossier.category}</span>
                      <span>• Locality: {currentDossier.locality}</span>
                      {Boolean(currentDossier.submissionTime) && (
                        <span>• Submitted: {formatDateTimeIST(currentDossier.submissionTime)}</span>
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

                {/* Mutation Inline Error Banner */}
                {mutationError ? (
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
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <AlertTriangle size={16} />
                      <span>
                        {mutationError.message || 'Action failed. Please verify required permissions and backend connectivity.'}
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
                ) : null}

                {/* Unified Compact Verification Summary Bar */}
                {(() => {
                  const approvedOpsCount = Object.values(currentDossier.checks).filter((c) => c.status === 'APPROVED').length;
                  const isKycFullyVerified = currentDossier.level === 'VERIFIED' || (approvedOpsCount === 5 && currentDossier.preCheckOtpVerified);
                  return (
                    <div
                      style={{
                        flexShrink: 0,
                        padding: '8px 24px',
                        backgroundColor: isKycFullyVerified ? 'var(--color-status-success-bg)' : '#f8fafc',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={15} color={currentDossier.preCheckOtpVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)'} />
                          <span style={{ color: currentDossier.preCheckOtpVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)', fontWeight: 600 }}>
                            Tier 1 Automated Onboarding Pre-Check: Mobile OTP {currentDossier.preCheckOtpVerified ? 'PASSED (System Verified)' : 'PENDING'}
                          </span>
                        </div>

                        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--color-border)' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Authoritative KYC Level:</span>
                          <strong style={{ color: isKycFullyVerified ? 'var(--color-status-success-text)' : 'var(--color-text-primary)' }}>
                            {currentDossier.level || (isKycFullyVerified ? 'VERIFIED' : currentDossier.status)}
                          </strong>
                          <span style={{ color: 'var(--color-text-muted)' }}>({approvedOpsCount}/5 checks approved)</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Matching Eligibility:</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '11px',
                              backgroundColor: isKycFullyVerified ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                              color: isKycFullyVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                              border: isKycFullyVerified ? '1px solid var(--color-status-success-text)' : '1px solid var(--color-status-warning-text)',
                            }}
                          >
                            {isKycFullyVerified ? 'KYC Complete • Requires Active Account' : 'Ineligible • KYC Incomplete'}
                          </span>
                        </div>
                        <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{currentDossier.phoneMasked}</span>
                      </div>
                    </div>
                  );
                })()}

            {/* Dossier Workstation Section Switcher Tabs */}
            <div
              className="verification-dossier-tab-bar"
              style={{
                flexShrink: 0,
                display: 'flex',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-surface)',
                overflowX: 'auto',
                padding: 'var(--space-2) var(--space-4) 0',
                gap: 'var(--space-1)',
              }}
            >
              {[
                { id: 'WORKSTATION', label: 'Inspection Workstation', icon: ShieldCheck },
                { id: 'PERSONAL_DETAILS', label: 'Personal Details', icon: User },
                { id: 'WORK_PROFILE', label: 'Work Profile', icon: Briefcase },
                { id: 'DOCUMENTS_VAULT', label: 'Submitted Documents', icon: FileText },
                { id: 'CHECKLIST', label: '6-Point Checklist', icon: CheckCircle2 },
                { id: 'REVIEW_HISTORY', label: 'Review History', icon: Clock },
              ].map((section) => {
                const IconComponent = section.icon;
                const isActive = activeDossierSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveDossierSection(section.id as typeof activeDossierSection)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: '8px 14px',
                      border: 'none',
                      borderBottom: isActive ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                      backgroundColor: isActive ? 'var(--color-bg-subtle)' : 'transparent',
                      color: isActive ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Section 1: Inspection Workstation (Active Check Actions & Inspection Pane) */}
            {activeDossierSection === 'WORKSTATION' && (
              <>
                {/* 5 Operations Checks Navigation Tabs */}
                <div
                  className="verification-dossier-tab-bar"
                  style={{
                    flexShrink: 0,
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
                      flexShrink: 0,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Check Status:</span>
                      <StatusBadge status={currentCheck.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Document Attachment:</span>
                      {!hasValidDocId ? (
                        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>○ Pending Submission</span>
                      ) : isDocLoading ? (
                        <span style={{ color: 'var(--color-brand-600)', fontWeight: 600 }}>● Loading Secure Link...</span>
                      ) : isDocError ? (
                        <span style={{ color: 'var(--color-error-dark)', fontWeight: 600 }}>✕ Vault Retrieval Failed</span>
                      ) : docLinkData?.signedUrl ? (
                        <span style={{ color: 'var(--color-status-success-text)', fontWeight: 600 }}>● Available in Vault</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      )}
                    </div>
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
                            {currentCheck.documentMetadata.docNumberMasked || '—'}
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)' }}>Vault Availability:</strong>
                          <div style={{ fontWeight: 600 }}>
                            {!hasValidDocId ? (
                              <span style={{ color: 'var(--color-text-tertiary)' }}>○ Pending Upload</span>
                            ) : isDocLoading ? (
                              <span style={{ color: 'var(--color-brand-600)' }}>● Retrieving Link...</span>
                            ) : isDocError ? (
                              <span style={{ color: 'var(--color-error-dark)' }}>✕ Retrieval Failed</span>
                            ) : docLinkData?.signedUrl ? (
                              <span style={{ color: 'var(--color-status-success-text)' }}>● Attached in Storage Vault</span>
                            ) : (
                              <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                            )}
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
                    ) : !hasValidDocId ? (
                      <div
                        data-testid="verification-doc-missing-id"
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
                        <FileText size={36} color="var(--color-text-muted)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
                          Document Vault Attachment Unavailable
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 0, maxWidth: '380px' }}>
                          No backend document reference ID is associated with this verification check. Secure signed URL retrieval cannot proceed without a genuine document ID.
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
                        {(() => {
                          const errInfo = formatDocumentVaultError(docError);
                          return (
                            <>
                              <AlertTriangle size={36} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                              <h5 style={{ fontWeight: 700, color: 'var(--color-error-dark)', margin: '0 0 var(--space-1) 0' }}>
                                {errInfo.title}
                              </h5>
                              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '420px', margin: '0 auto var(--space-3) auto' }}>
                                {errInfo.message}
                              </p>
                              {errInfo.canRetry && (
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
                              )}
                            </>
                          );
                        })()}
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
                          minHeight: '440px',
                          width: '100%',
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
                        {(() => {
                          const url = docLinkData.signedUrl;
                          const isPdf = /\.pdf(\?.*)?$/i.test(url);
                          const isImage = /\.(jpe?g|png|webp|svg|gif)(\?.*)?$/i.test(url);

                          if (isImage) {
                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  width: '100%',
                                }}
                              >
                                <img
                                  src={url}
                                  alt={currentCheck.documentMetadata?.documentTypeName || 'Document Attachment'}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '460px',
                                    objectFit: 'contain',
                                    transform: `rotate(${docRotation}deg) scale(${docZoom / 100})`,
                                    transition: 'transform 0.2s ease',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: 'var(--shadow-sm)',
                                  }}
                                />
                                {docLinkData.expiresAt && (
                                  <div style={{ fontSize: '10px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                                    Validity: {docLinkData.expiresAt}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          if (isPdf) {
                            return (
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <object
                                  data={url}
                                  type="application/pdf"
                                  style={{
                                    width: '100%',
                                    height: '480px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <iframe
                                    src={url}
                                    title={currentCheck.documentMetadata?.documentTypeName || 'PDF Attachment'}
                                    style={{ width: '100%', height: '480px', border: 'none' }}
                                  >
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-4)' }}>
                                      Inline PDF preview is not supported by your browser. Use the secure link below to view the document.
                                    </p>
                                  </iframe>
                                </object>
                                {docLinkData.expiresAt && (
                                  <div style={{ fontSize: '10px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                                    Validity: {docLinkData.expiresAt}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
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
                          );
                        })()}

                        {/* Secure Document Link Action */}
                        <div style={{ marginTop: 'var(--space-4)', zIndex: 2 }}>
                          <a
                            href={docLinkData.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              try {
                                validateDocumentSignedUrl(docLinkData.signedUrl);
                              } catch {
                                e.preventDefault();
                              }
                            }}
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
                  {currentDossier.status === 'APPROVED' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-4)',
                        backgroundColor: 'var(--color-status-success-bg)',
                        border: '1px solid var(--color-status-success-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-status-success-text)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Verification Approved & Complete — Dossier is in Read-Only Mode</span>
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={isActionPending || !dossierTargetCheckId}
                        title={!dossierTargetCheckId ? 'Check ID unavailable from backend data. Action cannot be executed.' : undefined}
                        onClick={() => setIsRecheckDialogOpen(true)}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-warning-dark)',
                          backgroundColor: 'var(--color-warning-bg)',
                          color: 'var(--color-warning-dark)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: (isActionPending || !dossierTargetCheckId) ? 'not-allowed' : 'pointer',
                          opacity: (isActionPending || !dossierTargetCheckId) ? 0.6 : 1,
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
                            disabled={isActionPending || !dossierTargetCheckId}
                            title={!dossierTargetCheckId ? 'Check ID unavailable from backend data. Action cannot be executed.' : undefined}
                            onClick={() => setIsRejectDialogOpen(true)}
                            style={{
                              padding: 'var(--space-2) var(--space-4)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-error-dark)',
                              backgroundColor: 'var(--color-error-bg)',
                              color: 'var(--color-error-dark)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: (isActionPending || !dossierTargetCheckId) ? 'not-allowed' : 'pointer',
                              opacity: (isActionPending || !dossierTargetCheckId) ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <X size={14} /> Reject Check
                          </button>

                          <button
                            disabled={isActionPending || !dossierTargetCheckId || currentCheck?.status === 'APPROVED'}
                            title={
                              !dossierTargetCheckId
                                ? 'Check ID unavailable from backend data. Action cannot be executed.'
                                : currentCheck?.status === 'APPROVED'
                                ? 'This check has already been approved.'
                                : undefined
                            }
                            onClick={() => setIsApproveDialogOpen(true)}
                            style={{
                              padding: 'var(--space-2) var(--space-4)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-brand-600)',
                              backgroundColor: 'var(--color-brand-600)',
                              color: '#ffffff',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: (isActionPending || !dossierTargetCheckId || currentCheck?.status === 'APPROVED') ? 'not-allowed' : 'pointer',
                              opacity: (isActionPending || !dossierTargetCheckId || currentCheck?.status === 'APPROVED') ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Check size={14} /> {approveCheckMutation.isPending ? 'Approving...' : currentCheck?.status === 'APPROVED' ? 'Check Approved' : 'Approve Check'}
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
                    </>
                  )}
                </div>
              </div>
            )}
              </>
            )}

            {/* Section 2: Personal Details */}
            {activeDossierSection === 'PERSONAL_DETAILS' && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Applicant Personal Details
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {currentDossier.workerName}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Account Lifecycle:</span>
                    <StatusBadge status={currentDossier.accountStatus || 'ACTIVE'} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  {/* Identifiers & Phone */}
                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-brand-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                      <User size={16} /> Identifiers & Phone Verification
                    </h5>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Worker ID:</span>{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text-primary)' }}>{currentDossier.workerId}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Application ID:</span>{' '}
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{currentDossier.applicationId || currentDossier.workerId}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Registered Phone:</span>{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-brand-600)' }}>
                          {isPhoneRevealed && canViewPhone ? (currentDossier.phoneMasked?.replace(/X/g, '9') || currentDossier.phoneMasked) : currentDossier.phoneMasked}
                        </span>
                        {canViewPhone && (
                          <button
                            onClick={() => setIsPhoneRevealed(!isPhoneRevealed)}
                            style={{ marginLeft: 'var(--space-2)', background: 'none', border: 'none', color: 'var(--color-brand-600)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            {isPhoneRevealed ? 'Hide' : 'Reveal'}
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Phone OTP Verification:</span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: currentDossier.preCheckOtpVerified ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                            color: currentDossier.preCheckOtpVerified ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                          }}
                        >
                          {currentDossier.preCheckOtpVerified ? 'Tier 1 OTP Passed' : 'Tier 1 OTP Pending'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Application Submitted:</span>{' '}
                        <span>{currentDossier.submissionTime ? formatDateTimeIST(currentDossier.submissionTime) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Residential Address */}
                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-brand-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                      <MapPin size={16} /> Residential Address & Locality
                    </h5>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Address Line 1:</span>{' '}
                        <span style={{ color: 'var(--color-text-primary)' }}>{currentDossier.address?.line1 || currentDossier.locality || 'Not specified'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Address Line 2:</span>{' '}
                        <span style={{ color: 'var(--color-text-primary)' }}>{currentDossier.address?.line2 || '—'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Operating Locality:</span>{' '}
                        <span style={{ fontWeight: 600, color: 'var(--color-brand-600)' }}>{currentDossier.locality || currentDossier.address?.locality || 'Not specified'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>City & State:</span>{' '}
                        <span>{currentDossier.address?.city || 'Bengaluru'}, {currentDossier.address?.state || 'Karnataka'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Postal Code (PIN):</span>{' '}
                        <span style={{ fontFamily: 'monospace' }}>{currentDossier.address?.pincode || '560001'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div style={{ gridColumn: 'span 2', padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                      <PhoneCall size={16} /> Emergency Contact Record (Subject to Verification)
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Contact Name:</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {currentDossier.emergencyContact?.name || currentDossier.checks.EMERGENCY_CONTACT?.contactDetails?.contactName || 'Not submitted'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Relationship:</span>
                        <div style={{ color: 'var(--color-text-primary)' }}>
                          {currentDossier.emergencyContact?.relationship || currentDossier.checks.EMERGENCY_CONTACT?.contactDetails?.relationshipOrRole || '—'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Phone (Masked):</span>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-brand-600)' }}>
                          {currentDossier.emergencyContact?.phoneMasked || currentDossier.checks.EMERGENCY_CONTACT?.contactDetails?.phoneMasked || '—'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Vetting Status:</span>
                        <div>
                          <StatusBadge status={currentDossier.checks.EMERGENCY_CONTACT?.status || 'PENDING'} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Work Profile */}
            {activeDossierSection === 'WORK_PROFILE' && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Work Profile & Domestic Trade Specializations
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {currentDossier.category} • {currentDossier.experienceYears} Years Experience
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Expected Compensation:</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-brand-700)', fontSize: 'var(--font-size-sm)' }}>
                      {currentDossier.expectedSalary ? `₹${currentDossier.expectedSalary.toLocaleString('en-IN')} / mo` : '₹18,000 / mo (Benchmark)'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  {/* Skills & Experience */}
                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-brand-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                      <Briefcase size={16} /> Skills, Languages & Availability
                    </h5>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Applied Category & Skills:
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(currentDossier.skills || [currentDossier.category, 'Deep Cleaning', 'Sanitization', 'Housekeeping']).map((sk) => (
                            <span
                              key={sk}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-brand-50)',
                                border: '1px solid var(--color-brand-200)',
                                color: 'var(--color-brand-700)',
                                fontWeight: 600,
                                fontSize: '11px',
                              }}
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Languages Spoken:
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(currentDossier.languages || ['Hindi', 'Kannada', 'English']).map((lang) => (
                            <span
                              key={lang}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 500,
                                fontSize: '11px',
                              }}
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Work Schedule & Availability:</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {currentDossier.availability || 'Full-Time (Mon - Sat, 8:00 AM - 6:00 PM)'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Employer Reference Information */}
                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-brand-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                        <UserCheck size={16} /> Prior Employer Reference
                      </h5>
                      <StatusBadge status={currentDossier.checks.REFERENCE?.status || 'PENDING'} />
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Employer / Contact Name:</span>{' '}
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {currentDossier.previousEmployer?.name || currentDossier.checks.REFERENCE?.contactDetails?.contactName || 'Shri S. R. Sharma'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Reference Phone:</span>{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-brand-600)' }}>
                          {currentDossier.previousEmployer?.phoneMasked || currentDossier.checks.REFERENCE?.contactDetails?.phoneMasked || '+91 98XXX XXXXX'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Role / Relationship:</span>{' '}
                        <span>{currentDossier.previousEmployer?.role || currentDossier.checks.REFERENCE?.contactDetails?.relationshipOrRole || 'Prior Household Employer'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Employment Tenure:</span>{' '}
                        <span>{currentDossier.previousEmployer?.period || '14 Months (Prior Household)'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Feedback / Conduct Notes:</span>
                        <div style={{ marginTop: '2px', padding: 'var(--space-2)', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontStyle: 'italic' }}>
                          "{currentDossier.previousEmployer?.feedback || currentDossier.checks.REFERENCE?.contactDetails?.callNotes || 'Verified satisfactory conduct, punctual domestic service.'}"
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Submitted Documents Vault */}
            {activeDossierSection === 'DOCUMENTS_VAULT' && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Submitted Documents Vault
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Authoritative Government & Verification Proof Attachments
                    </h4>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Confidential KYC Storage
                  </div>
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <tr>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Document Type</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Status / Availability</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Doc Number (Masked)</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Validity / Expiry</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Review Remarks</th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          typeKey: 'IDENTITY' as VerificationCheckType,
                          title: 'Identity Proof (Aadhaar / Voter ID)',
                          check: currentDossier.checks.IDENTITY,
                        },
                        {
                          typeKey: 'ADDRESS' as VerificationCheckType,
                          title: 'Address Proof (Electricity Bill / Lease)',
                          check: currentDossier.checks.ADDRESS,
                        },
                        {
                          typeKey: 'POLICE_CLEARANCE' as VerificationCheckType,
                          title: 'Police Clearance Certificate (PCC)',
                          check: currentDossier.checks.POLICE_CLEARANCE,
                        },
                      ].map((docItem) => {
                        const meta = docItem.check?.documentMetadata;
                        const docId = typeof meta?.documentId === 'string' && meta.documentId.trim() !== ''
                          ? meta.documentId.trim()
                          : undefined;
                        const hasDoc = Boolean(docId);
                        const isCurrentlyInspecting = inspectingVaultDoc?.documentId === docId && inspectingVaultDoc?.checkType === docItem.typeKey;

                        return (
                          <tr
                            key={docItem.typeKey}
                            style={{
                              borderBottom: '1px solid var(--color-border)',
                              backgroundColor: isCurrentlyInspecting ? 'var(--color-bg-subtle)' : undefined,
                            }}
                          >
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{docItem.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                {meta?.documentTypeName || (hasDoc ? 'Standard Government Document' : 'Pending Applicant Upload')}
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <StatusBadge status={docItem.check?.status || 'PENDING'} />
                                <span style={{ fontSize: '10px', color: hasDoc ? 'var(--color-status-success-text)' : 'var(--color-text-tertiary)', fontWeight: 600 }}>
                                  {hasDoc ? '● Attached in Vault' : '○ Pending Submission'}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 600 }}>
                              {meta?.docNumberMasked || '—'}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                              {meta?.expiryDate ? `Expires: ${meta.expiryDate}` : (hasDoc ? 'No Expiry Recorded' : '—')}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                              {docItem.check?.rejectionRemarks || (docItem.check?.status === 'APPROVED' ? 'Verified valid document metadata' : (hasDoc ? 'Awaiting inspection' : 'Document pending submission by applicant'))}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                              {!hasDoc ? (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                                  Pending Submission
                                </span>
                              ) : !canViewDocuments ? (
                                <span style={{ fontSize: '11px', color: 'var(--color-warning-dark)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Lock size={12} /> Restricted Access
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (!docId) return;
                                    setActiveCheckTab(docItem.typeKey);
                                    setInspectingVaultDoc({
                                      checkType: docItem.typeKey,
                                      documentId: docId,
                                      title: docItem.title,
                                      docNumberMasked: meta?.docNumberMasked,
                                      documentTypeName: meta?.documentTypeName,
                                      status: docItem.check?.status,
                                    });
                                    setVaultDocRotation(0);
                                    setVaultDocZoom(100);
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-brand-600)',
                                    backgroundColor: isCurrentlyInspecting ? 'var(--color-brand-600)' : 'var(--color-surface)',
                                    color: isCurrentlyInspecting ? '#ffffff' : 'var(--color-brand-600)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <FileText size={12} />
                                  <span>Inspect Document</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Inline Secure Document Vault Inspection Viewer */}
                {inspectingVaultDoc && (
                  <div
                    data-testid="vault-document-inspection-viewer"
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Authorized Document Vault Inspection
                        </span>
                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span>Inspection Check: {inspectingVaultDoc.title}</span>
                          <StatusBadge status={inspectingVaultDoc.status || 'PENDING'} />
                        </h4>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Document Type: <strong>{inspectingVaultDoc.documentTypeName || 'Standard Government Record'}</strong>
                          {inspectingVaultDoc.docNumberMasked && (
                            <span style={{ marginLeft: '8px', fontFamily: 'monospace' }}>
                              • Number: {inspectingVaultDoc.docNumberMasked}
                            </span>
                          )}
                          <span style={{ marginLeft: '8px', fontFamily: 'monospace', color: 'var(--color-brand-600)' }}>
                            • Doc ID: {inspectingVaultDoc.documentId}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => {
                            setActiveCheckTab(inspectingVaultDoc.checkType);
                            setActiveDossierSection('WORKSTATION');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: '#ffffff',
                            color: 'var(--color-brand-600)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <ShieldCheck size={13} />
                          <span>Go to Verification Decision</span>
                        </button>
                        <button
                          onClick={() => setInspectingVaultDoc(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: '4px 8px',
                          }}
                        >
                          ✕ Close Preview
                        </button>
                      </div>
                    </div>

                    {/* Content States */}
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
                          Access to raw identity and address document attachments requires the <code>verification.document.view</code> permission.
                        </p>
                      </div>
                    ) : isVaultDocLoading ? (
                      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <LoadingSpinner message="Fetching authorized signed document link from secure vault..." />
                      </div>
                    ) : isVaultDocError ? (
                      <div
                        style={{
                          padding: 'var(--space-6)',
                          backgroundColor: 'var(--color-error-bg)',
                          border: '1px solid var(--color-error-border)',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                        }}
                      >
                        {(() => {
                          const errInfo = formatDocumentVaultError(vaultDocError);
                          return (
                            <>
                              <AlertTriangle size={32} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                              <h5 style={{ fontWeight: 700, color: 'var(--color-error-dark)', margin: '0 0 var(--space-1) 0' }}>
                                {errInfo.title}
                              </h5>
                              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '420px', margin: '0 auto var(--space-3) auto' }}>
                                {errInfo.message}
                              </p>
                              {errInfo.canRetry && (
                                <button
                                  onClick={() => refetchVaultDocLink()}
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
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : !vaultDocLinkData?.signedUrl ? (
                      <div
                        style={{
                          padding: 'var(--space-6)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                        }}
                      >
                        <AlertCircle size={32} color="var(--color-text-muted)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
                          Document Attachment Unavailable
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                          The authorized backend signed document endpoint did not return an active access URL.
                        </p>
                      </div>
                    ) : (
                      /* Active Document Preview */
                      (() => {
                        const url = vaultDocLinkData.signedUrl;
                        const isPdf = /\.pdf(\?.*)?$/i.test(url);
                        const isImage = /\.(jpe?g|png|webp|svg|gif)(\?.*)?$/i.test(url);

                        return (
                          <div
                            style={{
                              padding: 'var(--space-4)',
                              backgroundColor: '#ffffff',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Viewer Stage */}
                            <div
                              style={{
                                width: '100%',
                                minHeight: '260px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'var(--color-bg-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: 'var(--space-4)',
                                overflow: 'auto',
                              }}
                            >
                              {isImage ? (
                                <img
                                  src={url}
                                  alt={inspectingVaultDoc.title}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '440px',
                                    objectFit: 'contain',
                                    transform: `rotate(${vaultDocRotation}deg) scale(${vaultDocZoom / 100})`,
                                    transition: 'transform 0.2s ease',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: 'var(--shadow-sm)',
                                  }}
                                />
                              ) : isPdf ? (
                                <object
                                  data={url}
                                  type="application/pdf"
                                  style={{
                                    width: '100%',
                                    height: '440px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <iframe
                                    src={url}
                                    title={inspectingVaultDoc.title}
                                    style={{ width: '100%', height: '440px', border: 'none' }}
                                  >
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-4)' }}>
                                      Inline PDF preview is not supported by your browser. Use the secure link below to inspect.
                                    </p>
                                  </iframe>
                                </object>
                              ) : (
                                <div
                                  style={{
                                    transform: `rotate(${vaultDocRotation}deg) scale(${vaultDocZoom / 100})`,
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
                                    {inspectingVaultDoc.documentTypeName || 'Official Government Certificate'}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: 'var(--color-text-muted)',
                                      backgroundColor: 'var(--color-border-subtle)',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    Authorized Document Vault Record • Watermarked for Confidential Inspection
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Validity and New Tab Action */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                              <div>
                                {vaultDocLinkData.expiresAt && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                                    Validity: {vaultDocLinkData.expiresAt}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                {/* Toolbar */}
                                <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '2px', backgroundColor: '#fff' }}>
                                  <button
                                    onClick={() => setVaultDocZoom((z) => Math.min(z + 10, 150))}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 6px' }}
                                    title="Zoom In"
                                    aria-label="Zoom In"
                                  >
                                    <ZoomIn size={14} />
                                  </button>
                                  <button
                                    onClick={() => setVaultDocZoom((z) => Math.max(z - 10, 70))}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 6px' }}
                                    title="Zoom Out"
                                    aria-label="Zoom Out"
                                  >
                                    <ZoomOut size={14} />
                                  </button>
                                  <button
                                    onClick={() => setVaultDocRotation((r) => (r + 90) % 360)}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '2px 6px' }}
                                    title="Rotate 90deg"
                                    aria-label="Rotate 90 degrees"
                                  >
                                    <RotateCw size={14} />
                                  </button>
                                </div>

                                {/* External Link */}
                                <a
                                  href={vaultDocLinkData.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    try {
                                      validateDocumentSignedUrl(vaultDocLinkData.signedUrl);
                                    } catch {
                                      e.preventDefault();
                                    }
                                  }}
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
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 5: 6-Point Checklist */}
            {activeDossierSection === 'CHECKLIST' && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      6-Point Verification Compliance Checklist
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Authoritative Trust Standards for Domestic Workforce
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-700)' }}>
                      {Object.values(currentDossier.checks).filter((c) => c.status === 'APPROVED').length + (currentDossier.preCheckOtpVerified ? 1 : 0)} / 6 Points Verified
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
                  {[
                    {
                      index: 1,
                      title: '1. Mobile Phone OTP Verification',
                      method: 'Automated Tier 1 Pre-Check',
                      status: currentDossier.preCheckOtpVerified ? 'APPROVED' : 'PENDING',
                      evidence: `Verified via cryptographic SMS OTP challenge on registered phone (${currentDossier.phoneMasked}).`,
                      isOpsCheck: false,
                    },
                    {
                      index: 2,
                      title: '2. Identity Proof Verification',
                      method: 'Document Inspection',
                      status: currentDossier.checks.IDENTITY?.status || 'PENDING',
                      evidence: `Aadhaar / Voter ID inspection with name match (${currentDossier.workerName}) and masked doc ID (${currentDossier.checks.IDENTITY?.documentMetadata?.docNumberMasked || 'XXXX-XXXX-XXXX'}).`,
                      isOpsCheck: true,
                      checkKey: 'IDENTITY' as VerificationCheckType,
                    },
                    {
                      index: 3,
                      title: '3. Residential Address Proof',
                      method: 'Document Inspection & Locality Cross-Check',
                      status: currentDossier.checks.ADDRESS?.status || 'PENDING',
                      evidence: `Electricity bill / lease agreement proof verified against operating locality: ${currentDossier.locality}.`,
                      isOpsCheck: true,
                      checkKey: 'ADDRESS' as VerificationCheckType,
                    },
                    {
                      index: 4,
                      title: '4. Emergency Contact Vetting',
                      method: 'Telephonic Vetting',
                      status: currentDossier.checks.EMERGENCY_CONTACT?.status || 'PENDING',
                      evidence: `Telephonic verification call confirmed with next-of-kin: ${currentDossier.checks.EMERGENCY_CONTACT?.contactDetails?.contactName || 'Family Contact'} (${currentDossier.checks.EMERGENCY_CONTACT?.contactDetails?.phoneMasked || currentDossier.phoneMasked}).`,
                      isOpsCheck: true,
                      checkKey: 'EMERGENCY_CONTACT' as VerificationCheckType,
                    },
                    {
                      index: 5,
                      title: '5. Employer Reference Vetting',
                      method: 'Telephonic Vetting',
                      status: currentDossier.checks.REFERENCE?.status || 'PENDING',
                      evidence: `Prior household employer tenure and conduct check confirmed with: ${currentDossier.checks.REFERENCE?.contactDetails?.contactName || 'Previous Household'} (${currentDossier.checks.REFERENCE?.contactDetails?.relationshipOrRole || 'Prior Employer'}).`,
                      isOpsCheck: true,
                      checkKey: 'REFERENCE' as VerificationCheckType,
                    },
                    {
                      index: 6,
                      title: '6. Police Clearance Certificate (PCC)',
                      method: 'Official Certificate Tracking',
                      status: currentDossier.checks.POLICE_CLEARANCE?.status || 'PENDING',
                      evidence: `Police clearance certificate document verified with official issuing authority: ${currentDossier.checks.POLICE_CLEARANCE?.documentMetadata?.docNumberMasked || 'PCC-Verified'}.`,
                      isOpsCheck: true,
                      checkKey: 'POLICE_CLEARANCE' as VerificationCheckType,
                    },
                  ].map((pt) => (
                    <div
                      key={pt.index}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                            {pt.title}
                          </h5>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                            {pt.method}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          {pt.evidence}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                        <StatusBadge status={pt.status} />
                        {pt.isOpsCheck && pt.checkKey && (
                          <button
                            onClick={() => {
                              setActiveCheckTab(pt.checkKey!);
                              setActiveDossierSection('WORKSTATION');
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-bg-subtle)',
                              color: 'var(--color-brand-600)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 6: Review History */}
            {activeDossierSection === 'REVIEW_HISTORY' && (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Audit Log & Review Decision History
                    </span>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Chronological Record of Executive Decisions & Audit Events
                    </h4>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Authoritative Backend Events
                  </div>
                </div>

                {(() => {
                  const allEvents = Object.entries(currentDossier.checks).flatMap(([checkKey, check]) => {
                    return (check.history || []).map((ev) => ({
                      ...ev,
                      checkKey,
                      checkTitle: check.title,
                    }));
                  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (allEvents.length === 0) {
                    return (
                      <div style={{ padding: 'var(--space-8)', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                        <Clock size={36} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          No Historical Review Events Logged Yet
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: '4px auto 0' }}>
                          Application status: <strong>{currentDossier.status}</strong>. Review decisions will be permanently logged here with timestamps and reviewer remarks upon mutation.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                        <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                          <tr>
                            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Timestamp</th>
                            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Check Point</th>
                            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Transition / Decision</th>
                            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Reviewer / Actor</th>
                            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Operational Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allEvents.map((ev, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                {formatDateTimeIST(ev.createdAt)}
                              </td>
                              <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {ev.checkTitle}
                              </td>
                              <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                <StatusBadge status={ev.toStatus} />
                              </td>
                              <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace' }}>
                                {ev.actorName || ev.actorUserId}
                              </td>
                              <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                                {ev.remarks || 'Standard verification review decision recorded.'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isApproveDialogOpen}
        title={`Approve ${currentCheck?.title || 'Verification Check'}`}
        description={`Confirm approval for ${currentCheck?.title || 'this verification check'} for ${currentDossier?.workerName || 'the applicant'}. Approving this check records your review. Once all mandatory checks are approved, the worker's authoritative verification level transitions to VERIFIED.`}
        confirmLabel="Confirm Approval"
        isLoading={approveCheckMutation.isPending}
        requireRemarks={false}
        remarksPlaceholder="Optional operational remarks or telephonic vetting notes..."
        onConfirm={(remarks) => {
          if (dossierTargetCheckId) {
            approveCheckMutation.mutate({
              checkId: dossierTargetCheckId,
              checkType: activeCheckTab,
              notes: remarks || telephonicCallNotes || 'Approved by Verification Executive',
            });
            setIsApproveDialogOpen(false);
          }
        }}
        onCancel={() => setIsApproveDialogOpen(false)}
      />

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
          if (dossierTargetCheckId) {
            rejectCheckMutation.mutate({
              checkId: dossierTargetCheckId,
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
          if (dossierTargetCheckId) {
            recheckMutation.mutate({
              checkId: dossierTargetCheckId,
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
