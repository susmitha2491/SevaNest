/* global HTMLDivElement, HTMLButtonElement, KeyboardEvent, HTMLElement */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Star,
  MapPin,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Languages,
  Clock,
  ExternalLink,
  Briefcase,
  FileText,
  User,
  Sliders,
  Lock,
  Phone,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { WorkerDocumentMetadata } from '../domain/types';
import { verificationRepository } from '../../verification/data/verificationRepository';
import {
  VerificationCheckType,
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationCheck,
  AdminWorkerVerificationResponse,
  AdminCheckView,
} from '../../verification/domain/types';
import { ValidationError, ConcurrencyConflictError } from '../../../core/errors/DomainError';
import { evaluateVerificationWorkflow } from '../../verification/domain/verificationWorkflow';
import { formatDocumentVaultError } from '../../verification/domain/documentVaultErrorFormatter';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { useAuthStore } from '../../../core/auth/authStore';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

export type WorkerModalWorkflowStep = 'worker-info' | 'kyc-verification';

interface WorkerDetailModalProps {
  workerId: string;
  onClose: () => void;
  onStatusChanged?: () => void;
  initialStep?: WorkerModalWorkflowStep;
}

const ALL_SERVICE_CATEGORIES = [
  'House Maid',
  'Driver',
  'Cook',
  'Babysitter',
  'Elderly Care Helper',
  'Cleaning Helper',
];

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({
  workerId,
  onClose,
  onStatusChanged,
  initialStep = 'worker-info',
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // Modal accessibility refs
  const modalContentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Role permissions
  const canViewWorker =
    hasPermission(user?.permissions, PERMISSIONS.WORKERS_VIEW) ||
    hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW);
  const canReview = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW);
  const canDecide =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE) ||
    user?.role === 'VERIFICATION_EXECUTIVE' ||
    user?.role === 'SUPER_ADMIN';
  const canSignOff = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_SIGNOFF);
  const canActivate = hasPermission(user?.permissions, PERMISSIONS.WORKER_ACTIVATE);
  const canViewDocuments =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW) ||
    hasPermission(user?.permissions, PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED);
  const canRevealPii = canReview || canViewWorker;

  // 2-Step Workflow State: Step 1 = worker-info, Step 2 = kyc-verification
  const [activeStep, setActiveStep] = useState<WorkerModalWorkflowStep>(initialStep);

  // Sensitive PII reveal
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);

  // Document Inspection State
  const [inspectingDoc, setInspectingDoc] = useState<{
    id?: string;
    documentId?: string;
    checkId?: string;
    checkType: VerificationCheckType;
    title: string;
    docNumber?: string;
    contentType?: string;
    mimeType?: string;
  } | null>(null);
  const [docRotation, setDocRotation] = useState(0);
  const [docZoom, setDocZoom] = useState(100);

  // Check actions state
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approveCheckId, setApproveCheckId] = useState<string | null>(null);
  const [approveCheckType, setApproveCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [approveCheckTitle, setApproveCheckTitle] = useState<string>('Verification Check');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [approveDialogError, setApproveDialogError] = useState<string | null>(null);
  const [missingApprovalRequirements, setMissingApprovalRequirements] = useState<string[] | null>(null);
  const [inputDocNumber, setInputDocNumber] = useState('');
  const [inputExpiryDate, setInputExpiryDate] = useState('');

  // Final Sign-Off & Activation Dialog State
  const [isSignOffDialogOpen, setIsSignOffDialogOpen] = useState(false);
  const [signOffDialogError, setSignOffDialogError] = useState<string | null>(null);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [activateDialogError, setActivateDialogError] = useState<string | null>(null);
  const [missingActivationPrerequisites, setMissingActivationPrerequisites] = useState<string[] | null>(null);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectCheckType, setRejectCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [rejectCheckId, setRejectCheckId] = useState<string | null>(null);
  const [rejectCategory, setRejectCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectRemarks, setRejectRemarks] = useState('');

  const [isRecheckModalOpen, setIsRecheckModalOpen] = useState(false);
  const [recheckCheckType, setRecheckCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [recheckCheckId, setRecheckCheckId] = useState<string | null>(null);
  const [recheckInstructions, setRecheckInstructions] = useState('');

  // Disciplinary state
  const [isDisciplineOpen, setIsDisciplineOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'SUSPENDED' | 'BLACKLISTED' | 'ACTIVE'>('SUSPENDED');

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryUpdateSuccess, setCategoryUpdateSuccess] = useState(false);

  // Focus close button on mount
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, []);

  // Modal accessibility: body scroll lock and Escape key listener
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          !isApproveDialogOpen &&
          !isRejectDialogOpen &&
          !isRecheckModalOpen &&
          !isDisciplineOpen &&
          !isSignOffDialogOpen &&
          !isActivateDialogOpen &&
          !isCategoryModalOpen
        ) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isApproveDialogOpen,
    isRejectDialogOpen,
    isRecheckModalOpen,
    isDisciplineOpen,
    isSignOffDialogOpen,
    isActivateDialogOpen,
    isCategoryModalOpen,
    onClose,
  ]);

  // Trap keyboard focus within modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const modalEl = modalContentRef.current;
      if (!modalEl) return;
      const focusables = Array.from(
        modalEl.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  // Query worker data
  const {
    data: worker,
    isLoading: isWorkerLoading,
    refetch: refetchWorker,
  } = useQuery({
    queryKey: ['workers', 'detail', workerId],
    queryFn: () => workerRepository.getWorkerById(workerId),
  });

  // Query verification dossier
  const {
    data: dossier,
    isLoading: isDossierLoading,
    isError: isDossierError,
    error: dossierError,
    refetch: refetchDossier,
  } = useQuery({
    queryKey: ['verification', 'dossier', workerId],
    queryFn: () => verificationRepository.getDossierById(workerId),
    enabled: !!workerId,
  });

  // Query signed document link for inspectingDoc
  const rawInspectingDocId = inspectingDoc?.documentId || inspectingDoc?.id;
  const inspectingDocId =
    typeof rawInspectingDocId === 'string' && rawInspectingDocId.trim() !== ''
      ? rawInspectingDocId.trim()
      : undefined;
  const hasInspectingDocId = Boolean(inspectingDocId);

  const {
    data: docLinkData,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
    refetch: refetchDocLink,
  } = useQuery({
    queryKey: ['verification', 'documentLink', workerId, inspectingDoc?.checkType, inspectingDocId],
    queryFn: () =>
      inspectingDoc && inspectingDocId
        ? verificationRepository.getSignedDocumentUrl(workerId, inspectingDoc.checkType, inspectingDocId)
        : null,
    enabled: !!inspectingDoc && hasInspectingDocId && canViewDocuments,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Invalidate and refresh cache helper
  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workers'] }),
      queryClient.invalidateQueries({ queryKey: ['verification'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      refetchWorker(),
      refetchDossier(),
    ]);
    onStatusChanged?.();
  };

  // Mutations
  const approveCheckMutation = useMutation({
    mutationFn: async ({
      checkId,
      checkType,
      notes,
      docDetails,
    }: {
      checkId: string;
      checkType: VerificationCheckType;
      notes?: string;
      docDetails?: { documentNumber?: string; expiresOn?: string };
    }) => {
      // 1. If document details provided (e.g. from missing approval requirements), update them first
      if (docDetails && (docDetails.documentNumber || docDetails.expiresOn)) {
        await verificationRepository.updateDocumentDetails(checkId, docDetails);
      }

      // 2. Call start-review before approving a SUBMITTED or PENDING check
      const currentCheck = dossier?.checks?.[checkType];
      const isSubmittedOrPending = currentCheck?.status === 'PENDING' || (currentCheck?.status as string) === 'SUBMITTED';
      if (isSubmittedOrPending) {
        try {
          await verificationRepository.claimCheck(checkId);
        } catch {
          // If already claimed, in review, or start-review not required, proceed to approve
        }
      }

      // 3. Call approveCheck
      const response = await verificationRepository.approveCheck(checkId, checkType, notes);
      return { checkId, checkType, response };
    },
    onSuccess: async (data) => {
      setIsApproveDialogOpen(false);
      setApproveCheckId(null);
      setApproveDialogError(null);
      setMissingApprovalRequirements(null);
      setInputDocNumber('');
      setInputExpiryDate('');

      // Update selected check and dossier from authoritative backend response
      if (
        data.response &&
        typeof data.response === 'object' &&
        'checks' in data.response &&
        Array.isArray((data.response as AdminWorkerVerificationResponse).checks)
      ) {
        const backendChecks = (data.response as AdminWorkerVerificationResponse).checks;
        if (dossier?.checks) {
          backendChecks.forEach((bc: AdminCheckView) => {
            const mappedType = bc.checkType as VerificationCheckType;
            if (dossier.checks[mappedType]) {
              const mappedStatus =
                bc.status === 'APPROVED'
                  ? 'APPROVED'
                  : bc.status === 'REJECTED'
                  ? 'REJECTED'
                  : bc.status === 'IN_REVIEW'
                  ? 'IN_REVIEW'
                  : bc.status === 'RECHECK_DUE'
                  ? 'RECHECK_DUE'
                  : 'PENDING';
              dossier.checks[mappedType].status = mappedStatus;
              if (bc.recheckAt) dossier.checks[mappedType].recheckDueDate = bc.recheckAt;
              if (bc.reviewedAt) dossier.checks[mappedType].verifiedAt = bc.reviewedAt;
            }
          });
        }
      } else if (dossier?.checks && data.checkType && dossier.checks[data.checkType]) {
        dossier.checks[data.checkType].status = 'APPROVED';
      }

      await invalidateAll();
      setActionFeedback({
        type: 'success',
        message: `Verification check "${approveCheckTitle}" successfully approved by the backend.`,
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const code = (err as { errorCode?: string })?.errorCode;
      const isConflict = err instanceof ConcurrencyConflictError;

      if (code === 'CHECK_ALREADY_ASSIGNED' || code === 'CHECK_NOT_ASSIGNED_TO_YOU' || (isConflict && code !== 'INVALID_TRANSITION' && code !== 'APPROVAL_REQUIREMENTS_MISSING')) {
        const errorMsg = err instanceof Error ? err.message : 'This check is assigned to another reviewer. Refreshing latest check data...';
        setApproveDialogError(errorMsg);
        setActionFeedback({
          type: 'error',
          message: errorMsg,
        });
        invalidateAll();
        return;
      }

      if (code === 'APPROVAL_REQUIREMENTS_MISSING') {
        let missing: string[] = [];
        if (err instanceof ValidationError && Array.isArray(err.details)) {
          missing = (err.details as unknown[]).map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const obj = item as Record<string, unknown>;
              return String(obj.field || obj.name || obj.property || JSON.stringify(item));
            }
            return String(item);
          });
        }
        setMissingApprovalRequirements(missing.length > 0 ? missing : ['documentNumber', 'expiresOn']);
        const errorMsg = (err as Error).message || 'Approval requirements missing: Please fill required fields below before approving.';
        setApproveDialogError(errorMsg);
        return;
      }

      if (code === 'INVALID_TRANSITION') {
        const errorMsg = (err as Error).message || 'Invalid transition: check must be claimed into review before deciding.';
        setApproveDialogError(`${errorMsg} You may claim the check and retry.`);
        setActionFeedback({
          type: 'error',
          message: `Decision rejected: ${errorMsg}. Please claim review first and retry explicitly.`,
        });
        invalidateAll();
        return;
      }

      let errorMsg = 'Server error occurred';
      if (err instanceof ValidationError && err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        errorMsg = `${err.message} (${Object.entries(err.fieldErrors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join('; ')})`;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      setApproveDialogError(errorMsg);
      setActionFeedback({
        type: 'error',
        message: `Check approval failed: ${errorMsg}. Please retry.`,
      });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: async ({ workerId, remarks }: { workerId: string; remarks?: string }) => {
      return await verificationRepository.signOffVerification(workerId, remarks);
    },
    onSuccess: async () => {
      setIsSignOffDialogOpen(false);
      setSignOffDialogError(null);
      await invalidateAll();
      setActionFeedback({
        type: 'success',
        message: 'Verification dossier formally signed off! Application status is now VERIFIED.',
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to sign off verification.';
      setSignOffDialogError(msg);
      setActionFeedback({
        type: 'error',
        message: `Sign-off failed: ${msg}`,
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (workerId: string) => {
      return await verificationRepository.activateWorker(workerId);
    },
    onSuccess: async () => {
      setIsActivateDialogOpen(false);
      setActivateDialogError(null);
      setMissingActivationPrerequisites(null);
      await invalidateAll();
      setActionFeedback({
        type: 'success',
        message: 'Worker successfully activated onto the commercial platform roster!',
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      let msg = 'Failed to activate worker.';
      let missingPrereqs: string[] | null = null;
      if (err instanceof ValidationError) {
        msg = err.message;
        if (err.details && Array.isArray(err.details)) {
          const first = err.details[0] as { messages?: string[] };
          if (first && Array.isArray(first.messages)) {
            missingPrereqs = first.messages;
          }
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setActivateDialogError(msg);
      setMissingActivationPrerequisites(missingPrereqs);
      setActionFeedback({
        type: 'error',
        message: `Activation failed: ${msg}`,
      });
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
      checkType: VerificationCheckType;
      category: RejectionReasonCategory;
      remarks: string;
    }) => {
      // Call start-review before rejecting a SUBMITTED or PENDING check
      const currentCheck = dossier?.checks?.[checkType];
      const isSubmittedOrPending = currentCheck?.status === 'PENDING' || (currentCheck?.status as string) === 'SUBMITTED';
      if (isSubmittedOrPending) {
        try {
          await verificationRepository.claimCheck(checkId);
        } catch {
          // If already claimed, in review, or start-review not required, proceed to reject
        }
      }

      const response = await verificationRepository.rejectCheck(checkId, checkType, category, remarks);
      return { checkId, checkType, response };
    },
    onSuccess: (data) => {
      // Update from full response if available
      if (
        data.response &&
        typeof data.response === 'object' &&
        'checks' in data.response &&
        Array.isArray((data.response as AdminWorkerVerificationResponse).checks)
      ) {
        const backendChecks = (data.response as AdminWorkerVerificationResponse).checks;
        if (dossier?.checks) {
          backendChecks.forEach((bc: AdminCheckView) => {
            const mappedType = bc.checkType as VerificationCheckType;
            if (dossier.checks[mappedType]) {
              dossier.checks[mappedType].status = bc.status as VerificationCheck['status'];
            }
          });
        }
      }
      invalidateAll();
      setIsRejectDialogOpen(false);
      setRejectRemarks('');
      setRejectCheckId(null);
      setActionFeedback({
        type: 'success',
        message: 'Verification check rejection recorded successfully.',
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const code = (err as { errorCode?: string })?.errorCode;
      if (code === 'CHECK_ALREADY_ASSIGNED' || code === 'CHECK_NOT_ASSIGNED_TO_YOU') {
        const msg = (err as Error).message || 'Check assignment conflict. Refreshing authoritative data...';
        setActionFeedback({
          type: 'error',
          message: msg,
        });
        invalidateAll();
        return;
      }
      if (code === 'INVALID_TRANSITION') {
        const msg = (err as Error).message || 'Invalid transition: check must be claimed before rejection.';
        setActionFeedback({
          type: 'error',
          message: `${msg} Please claim review first and retry.`,
        });
        invalidateAll();
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to reject check.';
      setActionFeedback({
        type: 'error',
        message: `Rejection failed: ${msg}`,
      });
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
      invalidateAll();
      setIsRecheckModalOpen(false);
      setRecheckInstructions('');
      setRecheckCheckId(null);
      setActionFeedback({
        type: 'success',
        message: 'Re-verification notice sent to worker successfully.',
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to request re-verification.';
      setActionFeedback({
        type: 'error',
        message: `Re-verification request failed: ${msg}`,
      });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (checkId: string) => {
      await verificationRepository.claimCheck(checkId);
    },
    onSuccess: () => {
      invalidateAll();
      setActionFeedback({
        type: 'success',
        message: 'Verification review claimed successfully.',
      });
      setTimeout(() => setActionFeedback(null), 4000);
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async (categoryCodes: string[]) => {
      await workerRepository.updateWorkerCategories(workerId, categoryCodes);
    },
    onSuccess: () => {
      invalidateAll();
      setCategoryUpdateSuccess(true);
      setTimeout(() => {
        setIsCategoryModalOpen(false);
        setCategoryUpdateSuccess(false);
      }, 1000);
    },
  });

  const handleStatusConfirm = async (remarks?: string) => {
    await workerRepository.updateWorkerStatus(
      workerId,
      targetStatus,
      remarks || 'Operational disciplinary action'
    );
    setIsDisciplineOpen(false);
    invalidateAll();
  };

  const openCategoryModal = () => {
    if (worker) {
      setSelectedCategories(
        worker.categories && worker.categories.length > 0 ? [...worker.categories] : [worker.category]
      );
    }
    setIsCategoryModalOpen(true);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter((c) => c !== cat) : prev) : [...prev, cat]
    );
  };

  // Combine worker documents and documents from verification checks (only submitted documents)
  const displayDocuments = useMemo(() => {
    const docs: WorkerDocumentMetadata[] = [];
    const seenIds = new Set<string>();

    const addDoc = (d: WorkerDocumentMetadata) => {
      // Must be reviewable: render a document only when reviewable === true.
      // Do not treat available === true as proof that a document is reviewable.
      // Never show discarded or not-uploaded documents as reviewable.
      if (d.reviewable !== true) return;
      if (
        d.available === false ||
        d.availability === 'DISCARDED' ||
        d.availability === 'NOT_UPLOADED' ||
        (d.status as string) === 'PENDING_UPLOAD'
      ) {
        return;
      }

      // Must be actually submitted by worker: has a genuine ID or docNumberMasked or submittedAt
      if (!d.id && !d.documentId && !d.docNumberMasked && !d.submittedAt) return;
      if ((d.id && d.id.startsWith('placeholder-')) || (d.documentId && d.documentId.startsWith('placeholder-'))) return;

      const primaryId = d.documentId || d.id;
      const key = primaryId || `${d.documentType}-${d.docNumberMasked}`;
      if (seenIds.has(key)) {
        // Enrich existing entry if richer fields are present
        const existing = docs.find((x) => (x.documentId || x.id) === primaryId || (x.documentType === d.documentType && x.docNumberMasked === d.docNumberMasked));
        if (existing) {
          if (!existing.checkId && d.checkId) existing.checkId = d.checkId;
          if (!existing.documentId && d.documentId) existing.documentId = d.documentId;
          if (!existing.checkType && d.checkType) existing.checkType = d.checkType;
          if (!existing.contentType && d.contentType) existing.contentType = d.contentType;
          if (!existing.mimeType && d.mimeType) existing.mimeType = d.mimeType;
          if (existing.sizeBytes === undefined && d.sizeBytes !== undefined) existing.sizeBytes = d.sizeBytes;
          if (existing.available === undefined && d.available !== undefined) existing.available = d.available;
          if (!existing.availability && d.availability) existing.availability = d.availability;
          if (existing.reviewable === undefined && d.reviewable !== undefined) existing.reviewable = d.reviewable;
        }
        return;
      }
      seenIds.add(key);
      docs.push({ ...d, reviewable: true });
    };

    // 1. Dossier submittedDocuments first (richest metadata from /verification API)
    if (dossier?.submittedDocuments && Array.isArray(dossier.submittedDocuments)) {
      dossier.submittedDocuments.forEach((sd) => {
        if (sd.reviewable !== true) return;
        const isDiscarded =
          sd.available === false ||
          sd.availability === 'DISCARDED' ||
          sd.availability === 'NOT_UPLOADED' ||
          sd.status === 'PENDING_UPLOAD';
        if (isDiscarded) return;

        const docId = sd.documentId || sd.id;
        if (docId) {
          addDoc({
            id: docId,
            documentId: docId,
            checkId: sd.checkId,
            checkType: sd.checkType,
            documentType: sd.checkType || 'IDENTITY',
            documentTypeName: sd.documentTypeName || 'Submitted Document',
            docNumberMasked: sd.docNumberMasked,
            contentType: sd.contentType,
            mimeType: sd.mimeType,
            sizeBytes: sd.sizeBytes,
            available: true,
            availability: sd.availability || 'AVAILABLE',
            submitted: sd.submitted !== false,
            reviewable: true,
            status: (sd.status as WorkerDocumentMetadata['status']) || 'SUBMITTED',
            submittedAt: sd.submittedAt || sd.createdAt || dossier.submissionTime,
          });
        }
      });
    }

    // 2. Checks documents / documentMetadata
    if (dossier?.checks) {
      (Object.entries(dossier.checks) as [VerificationCheckType, VerificationCheck][]).forEach(
        ([type, chk]) => {
          const chkId = chk.id;
          if (Array.isArray(chk.documents)) {
            chk.documents.forEach((d) => {
              if (d.reviewable !== true) return;
              const docId = d.documentId || d.id;
              if (docId) {
                addDoc({
                  id: docId,
                  documentId: docId,
                  checkId: chkId,
                  checkType: type,
                  documentType: type,
                  documentTypeName: d.documentTypeName || chk.title || `${type} Document`,
                  docNumberMasked: d.docNumberMasked,
                  contentType: d.contentType,
                  mimeType: d.mimeType,
                  sizeBytes: d.sizeBytes,
                  reviewable: true,
                  status:
                    chk.status === 'APPROVED'
                      ? 'VERIFIED'
                      : chk.status === 'REJECTED'
                      ? 'REJECTED'
                      : 'SUBMITTED',
                  submittedAt: d.submittedAt || chk.history?.[0]?.createdAt || dossier.submissionTime,
                  verifiedAt: chk.verifiedAt,
                  recheckDueDate: chk.recheckDueDate,
                  rejectionReason: chk.rejectionRemarks,
                });
              }
            });
          }
          if (chk.documentMetadata?.documentId && chk.documentMetadata.reviewable === true) {
            addDoc({
              id: chk.documentMetadata.documentId,
              documentId: chk.documentMetadata.documentId,
              checkId: chkId,
              checkType: type,
              documentType: type,
              documentTypeName: chk.documentMetadata.documentTypeName || chk.title || `${type} Document`,
              docNumberMasked: chk.documentMetadata.docNumberMasked,
              contentType: chk.documentMetadata.contentType,
              mimeType: chk.documentMetadata.mimeType,
              sizeBytes: chk.documentMetadata.sizeBytes,
              reviewable: true,
              status:
                chk.status === 'APPROVED'
                  ? 'VERIFIED'
                  : chk.status === 'REJECTED'
                  ? 'REJECTED'
                  : 'SUBMITTED',
              submittedAt: chk.history?.[0]?.createdAt || dossier.submissionTime,
              verifiedAt: chk.verifiedAt,
              recheckDueDate: chk.recheckDueDate,
              rejectionReason: chk.rejectionRemarks,
            });
          }
        }
      );
    }

    // 3. Worker submitted documents
    (worker?.documents || []).forEach(addDoc);

    return docs;
  }, [worker?.documents, dossier?.checks, dossier?.submittedDocuments, dossier?.submissionTime]);

  if (!canViewWorker) {
    return (
      <div
        className="worker-detail-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 950,
          padding: 'var(--space-4)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
            padding: 'var(--space-6)',
            maxWidth: '520px',
            width: '100%',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <NoAccessView moduleName="Worker Details" requiredPermission={PERMISSIONS.WORKER_VIEW} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button
              onClick={onClose}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isWorkerLoading || isDossierLoading) {
    return (
      <div
        className="worker-detail-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 950,
          padding: 'var(--space-4)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <LoadingSpinner message="Loading worker profile and verification details..." />
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-subtle)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!worker) {
    return null;
  }

  // Construct effective checks
  const checksRecord: Record<VerificationCheckType, VerificationCheck> = dossier?.checks || {
    IDENTITY: {
      type: 'IDENTITY',
      title: 'Identity Proof',
      status:
        worker.verification.identityProofStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.identityProofStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        docNumberMasked:
          worker.documents?.find((d) => d.documentType === 'IDENTITY')?.docNumberMasked ||
          'XXXX-XXXX-MASKED',
        documentTypeName: worker.verification.identityDocName || 'Aadhaar Card (National ID)',
      },
    },
    ADDRESS: {
      type: 'ADDRESS',
      title: 'Address Proof',
      status:
        worker.verification.addressProofStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.addressProofStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        docNumberMasked:
          worker.documents?.find((d) => d.documentType === 'ADDRESS')?.docNumberMasked ||
          'XXXX-XXXX-MASKED',
        documentTypeName: 'Electricity Utility Bill (Residential Address)',
      },
    },
    EMERGENCY_CONTACT: {
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: worker.isFullyVerified ? 'APPROVED' : 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Emergency Contact',
        relationshipOrRole: 'Immediate Family',
        phoneMasked: worker.phoneMasked || '+91 ••••• •••••',
      },
    },
    REFERENCE: {
      type: 'REFERENCE',
      title: 'Previous Employer Reference',
      status:
        worker.verification.referenceCheckStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.referenceCheckStatus === 'FAILED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Prior Household Employer',
        relationshipOrRole: 'Domestic Employer',
        phoneMasked: '+91 ••••• •••••',
        callNotes: worker.verification.overallRemarks,
      },
    },
    POLICE_CLEARANCE: {
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance Certificate',
      status:
        worker.verification.criminalRecordStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.criminalRecordStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        docNumberMasked:
          worker.documents?.find((d) => d.documentType === 'POLICE_CLEARANCE')?.docNumberMasked ||
          'XXXX-XXXX-MASKED',
        documentTypeName: 'Police Clearance Certificate (PCC)',
      },
    },
    PREVIOUS_EMPLOYMENT: {
      type: 'PREVIOUS_EMPLOYMENT',
      title: 'Previous Employer Reference',
      status:
        worker.verification.referenceCheckStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.referenceCheckStatus === 'FAILED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_VERIFICATION: {
      type: 'POLICE_VERIFICATION',
      title: 'Police Clearance Certificate',
      status:
        worker.verification.criminalRecordStatus === 'VERIFIED'
          ? 'APPROVED'
          : worker.verification.criminalRecordStatus === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    SKILL_CERTIFICATE: {
      type: 'SKILL_CERTIFICATE',
      title: 'Skill Certificate Verification',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    LICENSE: {
      type: 'LICENSE',
      title: 'Commercial / Driving License',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
  };

  // Authoritative Prerequisite & Required Checks Calculations
  const otpPassed = Boolean(dossier?.preCheckOtpVerified ?? worker.verification.phoneOtpVerified ?? true);
  const workflow = evaluateVerificationWorkflow(checksRecord, otpPassed);

  // Dynamic Operational Checks List reflecting actual checks configured for this worker
  const operationalChecksList: Array<{
    key: VerificationCheckType;
    label: string;
    approved: boolean;
    check: VerificationCheck;
    stepEval?: (typeof workflow.steps)[0];
    required: boolean;
  }> = [];

  const checkCandidates: Array<{ key: VerificationCheckType; defaultLabel: string }> = [
    { key: 'IDENTITY', defaultLabel: 'Identity Proof' },
    { key: 'ADDRESS', defaultLabel: 'Address Proof' },
    { key: 'EMERGENCY_CONTACT', defaultLabel: 'Emergency Contact' },
    { key: 'REFERENCE', defaultLabel: 'Employer Reference' },
    { key: 'POLICE_CLEARANCE', defaultLabel: 'Police Certificate' },
    { key: 'SKILL_CERTIFICATE', defaultLabel: 'Skill Certificate' },
    { key: 'LICENSE', defaultLabel: 'Commercial / Driving License' },
  ];

  checkCandidates.forEach(({ key, defaultLabel }) => {
    const chk = checksRecord[key];
    const isRequired = dossier?.requiredChecks
      ? (dossier.requiredChecks as string[]).includes(key)
      : key === 'IDENTITY' || key === 'ADDRESS' || key === 'EMERGENCY_CONTACT';
    const hasData =
      chk?.id ||
      chk?.documentMetadata?.documentId ||
      (chk?.documents && chk.documents.length > 0) ||
      isRequired;

    if (chk && hasData) {
      operationalChecksList.push({
        key,
        label: defaultLabel,
        approved: chk.status === 'APPROVED',
        check: chk,
        stepEval: workflow.steps.find((s) => s.type === key),
        required: isRequired,
      });
    }
  });

  const approvedOpsCount = operationalChecksList.filter((c) => c.approved).length;

  // Backend authoritative required checks calculation
  const hasDynamicRequirements = Boolean(dossier?.requiredChecks && dossier.requiredChecks.length > 0);
  const requiredCheckKeys: string[] = hasDynamicRequirements
    ? (dossier!.requiredChecks as string[])
    : ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'];

  const allRequiredApproved = requiredCheckKeys.every((reqKey) => {
    const normalizedKey = (
      reqKey === 'PREVIOUS_EMPLOYMENT'
        ? 'REFERENCE'
        : reqKey === 'POLICE_VERIFICATION'
        ? 'POLICE_CLEARANCE'
        : reqKey
    ) as VerificationCheckType;
    const chk = checksRecord[normalizedKey] || checksRecord[reqKey as VerificationCheckType];
    return chk?.status === 'APPROVED';
  });

  const allMandatoryChecksApproved = otpPassed && allRequiredApproved;
  const hasRejectedCheck = operationalChecksList.some((c) => c.check?.status === 'REJECTED');
  const pendingChecksCount = operationalChecksList.filter((c) => c.check?.status === 'PENDING').length;

  // Authoritative Sign-Off and Active Onboarding state
  const isSignedOff = Boolean(
    dossier?.signedOffAt ||
      worker?.signedOffAt ||
      dossier?.applicationStatus === 'VERIFIED' ||
      dossier?.applicationStatus === 'ACTIVE' ||
      worker?.applicationStatus === 'VERIFIED' ||
      worker?.applicationStatus === 'ACTIVE'
  );

  const currentAppStatus =
    dossier?.applicationStatus || worker?.applicationStatus || (isSignedOff ? 'VERIFIED' : 'UNDER_REVIEW');

  const effectiveAppStatus = dossier?.applicationStatus || worker?.applicationStatus;
  const effectiveActivatedAt = dossier?.activatedAt || worker?.activatedAt;
  const isOnboarded = effectiveAppStatus === 'ACTIVE' && Boolean(effectiveActivatedAt);

  // Authoritative Matching Eligibility
  const isMatchingEligible = worker.status === 'ACTIVE' && (worker.isFullyVerified || isSignedOff || isOnboarded);

  // Helper to resolve the authoritative verification check and workflow evaluation for any submitted document
  const getCheckForDoc = (doc: WorkerDocumentMetadata) => {
    // 1. Direct checkId if already on doc
    let targetCheckId = doc.checkId;
    let checkType: VerificationCheckType = (doc.checkType as VerificationCheckType) || 'IDENTITY';

    // 2. Match by doc.id or doc.documentId in check metadata or documents array
    const checkEntry = (Object.entries(checksRecord) as [VerificationCheckType, VerificationCheck][]).find(
      ([, chk]) =>
        (chk.documentMetadata?.documentId && (chk.documentMetadata.documentId === doc.id || chk.documentMetadata.documentId === doc.documentId)) ||
        (chk.documentMetadata?.id && (chk.documentMetadata.id === doc.id || chk.documentMetadata.id === doc.documentId)) ||
        chk.documents?.some((d) => (d.documentId && (d.documentId === doc.id || d.documentId === doc.documentId)) || (d.id && (d.id === doc.id || d.id === doc.documentId)))
    );

    if (checkEntry) {
      checkType = checkEntry[0];
      if (!targetCheckId) {
        targetCheckId = checkEntry[1]?.id || (checkEntry[1] as { checkId?: string })?.checkId;
      }
    }

    // 2. Fallback matching heuristics by documentType or documentTypeName if not resolved
    if (!checkEntry && !doc.checkType) {
      const typeStr = (doc.documentType || '').toUpperCase();
      const nameStr = (doc.documentTypeName || '').toUpperCase();
      if (
        typeStr === 'ADDRESS' ||
        nameStr.includes('ADDRESS') ||
        nameStr.includes('UTILITY') ||
        nameStr.includes('RENT') ||
        nameStr.includes('ELECTRICITY')
      ) {
        checkType = 'ADDRESS';
      } else if (
        typeStr === 'POLICE_CLEARANCE' ||
        nameStr.includes('POLICE') ||
        nameStr.includes('CLEARANCE') ||
        nameStr.includes('CRIMINAL')
      ) {
        checkType = 'POLICE_CLEARANCE';
      } else if (typeStr === 'EMERGENCY_CONTACT' || nameStr.includes('EMERGENCY')) {
        checkType = 'EMERGENCY_CONTACT';
      } else if (typeStr === 'REFERENCE' || nameStr.includes('REFERENCE') || nameStr.includes('EMPLOYER')) {
        checkType = 'REFERENCE';
      } else {
        checkType = 'IDENTITY';
      }
    }

    const check = checksRecord[checkType];
    const stepEval = workflow.steps.find((s) => s.type === checkType);
    if (!targetCheckId) {
      targetCheckId =
        check?.id ||
        (check as { id?: string; checkId?: string })?.checkId ||
        dossier?.checks?.[checkType]?.id ||
        (checkType === 'IDENTITY' ? dossier?.checkId : undefined);
    }

    // Strict validation: Verify every displayed document maps to its real backend verification check ID
    // Prohibit substituting workerId, doc.id, or doc.documentId for checkId
    const isCheckIdValid = Boolean(
      targetCheckId &&
      targetCheckId !== workerId &&
      targetCheckId !== doc.id &&
      targetCheckId !== doc.documentId &&
      !targetCheckId.startsWith('W-') &&
      !targetCheckId.startsWith('wrk-') &&
      !targetCheckId.startsWith('DOC-') &&
      !targetCheckId.startsWith('doc-')
    );

    const safeTargetCheckId = isCheckIdValid ? targetCheckId : undefined;
    const hasValidCheckId = Boolean(safeTargetCheckId);
    const isApproved = check?.status === 'APPROVED';
    const isRejected = check?.status === 'REJECTED';

    const effectiveStatus: WorkerDocumentMetadata['status'] =
      isApproved
        ? 'VERIFIED'
        : isRejected
        ? 'REJECTED'
        : check?.status === 'RECHECK_DUE'
        ? 'RECHECK_DUE'
        : doc.status || 'SUBMITTED';

    return {
      checkType,
      check,
      stepEval,
      targetCheckId: safeTargetCheckId,
      hasValidCheckId,
      isApproved,
      isRejected,
      effectiveStatus,
    };
  };

  return (
    <div
      aria-labelledby="worker-detail-modal-title"
      className="worker-detail-modal-backdrop"
      onClick={onClose}
      onKeyDown={handleModalKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 950,
        padding: 'var(--space-4)',
      }}
    >
      <div
        ref={modalContentRef}
        className="worker-detail-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-border)',
          border: '1px solid var(--color-border)',
          width: '94%',
          maxWidth: '960px',
          maxHeight: '92vh',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Clean Modal Header */}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <h2
                id="worker-detail-modal-title"
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 800,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                {worker.name}
              </h2>
              <StatusBadge status={worker.status} />
              <VerificationBadge isFullyVerified={worker.isFullyVerified} status={worker.verificationStatus} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-bg)' : '#eff6ff',
                  color: currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-text)' : '#1d4ed8',
                  border: `1px solid ${currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-border)' : '#bfdbfe'}`,
                }}
              >
                App: {currentAppStatus}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isMatchingEligible ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                  color: isMatchingEligible ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                  border: `1px solid ${isMatchingEligible ? 'var(--color-status-success-border)' : 'var(--color-status-warning-border)'}`,
                }}
              >
                {isMatchingEligible ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                <span>{isMatchingEligible ? 'Matching: ELIGIBLE' : 'Matching: INELIGIBLE'}</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close dossier"
                title="Close"
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
                  transition: 'background-color 0.15s ease',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Sub-row with identity and locality */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-primary)',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >
              ID: {worker.id}
            </span>
            <span
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'monospace',
              }}
            >
              • App ID: {worker.applicationId || dossier?.applicationId || worker.id}
            </span>
            <span>
              • {worker.category} • {worker.experienceYears} Yrs Exp • {worker.locality}
            </span>
          </div>
        </div>

        {/* 2-Step Workflow Navigation Tabs */}
        <div
          role="tablist"
          style={{
            flexShrink: 0,
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 var(--space-6)',
            backgroundColor: 'var(--color-surface)',
            gap: 'var(--space-2)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeStep === 'worker-info'}
            onClick={() => setActiveStep('worker-info')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeStep === 'worker-info' ? '3px solid var(--color-primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeStep === 'worker-info' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeStep === 'worker-info' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <User size={15} />
            <span>1. Worker Information</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeStep === 'kyc-verification'}
            onClick={() => setActiveStep('kyc-verification')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeStep === 'kyc-verification' ? '3px solid var(--color-primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeStep === 'kyc-verification' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeStep === 'kyc-verification' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={15} />
            <span>2. KYC Verification</span>
            {pendingChecksCount > 0 ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-status-warning-bg)',
                  color: 'var(--color-status-warning-text)',
                  border: '1px solid var(--color-status-warning-border)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {pendingChecksCount} pending
              </span>
            ) : allMandatoryChecksApproved ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-status-success-bg)',
                  color: 'var(--color-status-success-text)',
                  border: '1px solid var(--color-status-success-border)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                Verified
              </span>
            ) : null}
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor:
                  actionFeedback.type === 'success' ? 'var(--color-status-success-bg)' : 'var(--color-status-danger-bg)',
                border: `1px solid ${
                  actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)'
                }`,
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color:
                  actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span style={{ fontWeight: 600 }}>{actionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                }}
                aria-label="Dismiss feedback"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: WORKER INFORMATION (Clean & Simple Layout)        */}
          {/* ======================================================== */}
          {activeStep === 'worker-info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Header description */}
              <div
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: 'var(--space-2)',
                }}
              >
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                  Worker Information
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                  Personal identity, contact details, service categories, and professional profile.
                </p>
              </div>

              {/* Matching Eligible Banner */}
              {isMatchingEligible && (
                <div
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--color-status-success-bg)',
                    border: '1px solid var(--color-status-success-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="var(--color-status-success-text)" />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-status-success-text)' }}>
                      Matching Engine: Worker is verified & eligible for domestic household matching.
                    </span>
                  </div>
                  <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
                    <button
                      onClick={() => {
                        onClose();
                        navigate('/verification');
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-status-success-text)',
                        border: '1px solid var(--color-status-success-text)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>Inspect in Verification Queue</span>
                      <ExternalLink size={12} />
                    </button>
                  </PermissionGate>
                </div>
              )}

              {/* Grid 1: Basic Identity & Contact Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                {/* Full Registered Name */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <User size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Full Name & ID
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {worker.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Worker ID: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{worker.id}</strong>
                    {worker.applicationId && (
                      <span> • App: <strong style={{ fontFamily: 'monospace' }}>{worker.applicationId}</strong></span>
                    )}
                  </div>
                </div>

                {/* Contact Information with Sensitive PII Reveal Safeguard */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <Phone size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Contact Number (PII Protected)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <strong style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {isPhoneRevealed
                        ? worker.phone || worker.mobile || (worker.phoneMasked ? `${worker.phoneMasked} (Full number not supplied by backend)` : 'Not available')
                        : worker.phoneMasked || '+91 ••••• •••••'}
                    </strong>
                    {canRevealPii ? (
                      <button
                        type="button"
                        onClick={() => setIsPhoneRevealed((prev) => !prev)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-brand-600)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                        aria-label={isPhoneRevealed ? 'Hide contact number' : 'Reveal contact number'}
                      >
                        {isPhoneRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{isPhoneRevealed ? 'Hide' : 'Reveal'}</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        (Restricted)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {isPhoneRevealed ? '✓ Authorized contact reveal active' : 'Secure communication channel'}
                  </div>
                </div>

                {/* Primary Locality & Coverage Area */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <MapPin size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Address & Locality
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.locality}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Service Radius: {worker.serviceRadiusKm} km from locality base
                  </div>
                </div>

                {/* Service Category & Experience */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Briefcase size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Primary Skill & Experience
                      </span>
                    </div>
                    <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE}>
                      <button
                        type="button"
                        onClick={openCategoryModal}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          color: 'var(--color-brand-600)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Sliders size={12} />
                        <span>Manage Categories</span>
                      </button>
                    </PermissionGate>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {worker.category}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {worker.experienceYears} Years Experience
                    </span>
                  </div>
                  {worker.categories && worker.categories.length > 1 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {worker.categories
                        .filter((c) => c !== worker.category)
                        .map((c) => (
                          <span
                            key={c}
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--color-bg-subtle)',
                              color: 'var(--color-text-tertiary)',
                              border: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            +{c}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Languages Spoken */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <Languages size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Languages Spoken
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.languages && worker.languages.length > 0 ? worker.languages.join(', ') : 'Not specified'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Household communication proficiency
                  </div>
                </div>

                {/* Allocation Availability */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <Clock size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Current Availability
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-status-success-text)' }}>
                    {worker.availability || (worker.status === 'ACTIVE' ? 'Available for Immediate Allocation' : 'Unavailable')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Customer allocation readiness
                  </div>
                </div>

                {/* Compensation Expectation */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <DollarSign size={15} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Expected Compensation
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.expectedCompensation || 'Not specified'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Benchmark monthly wage expectation
                  </div>
                </div>

                {/* Rating Score */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <Star size={15} color="#b45309" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Customer Rating & Reviews
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={16} fill="#f59e0b" color="#f59e0b" />
                    <span>{worker.ratingAverage}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      ({worker.totalReviews} reviews)
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Completed Jobs: <strong>{worker.completedBookingsCount}</strong>
                  </div>
                </div>
              </div>

              {/* Skill Competencies List */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <CheckCircle2 size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Skill Competencies
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {(worker.skills && worker.skills.length > 0 ? worker.skills : [worker.category]).map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Biography / Description */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <FileText size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Professional Biography & Overview
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {worker.bio || 'No biography provided by applicant.'}
                </p>
              </div>

              {/* Step 1 Footer Action */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <button
                  onClick={() => setActiveStep('kyc-verification')}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-brand-600, var(--color-primary))',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span>Next: Verify KYC</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: KYC VERIFICATION (Dedicated Verification Screen) */}
          {/* ======================================================== */}
          {activeStep === 'kyc-verification' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Step Header with Back Button and Verification Progress */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: 'var(--space-3)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <button
                    onClick={() => setActiveStep('worker-info')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <ChevronLeft size={16} />
                    <span>Back to Worker Information</span>
                  </button>

                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                      KYC Verification & Compliance
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Authoritative document inspection, 6-point verification criteria, and final supervisor sign-off.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(dossier?.level || worker?.verification?.level) && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      Level: {dossier?.level || worker?.verification?.level}
                    </span>
                  )}
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: allMandatoryChecksApproved
                        ? 'var(--color-status-success-bg)'
                        : 'var(--color-status-warning-bg)',
                      color: allMandatoryChecksApproved
                        ? 'var(--color-status-success-text)'
                        : 'var(--color-status-warning-text)',
                      border: `1px solid ${
                        allMandatoryChecksApproved
                          ? 'var(--color-status-success-border)'
                          : 'var(--color-status-warning-border)'
                      }`,
                    }}
                  >
                    {allMandatoryChecksApproved
                      ? '✓ All 6 Checks Approved'
                      : `${approvedOpsCount + (otpPassed ? 1 : 0)} of 6 Requirements Satisfied`}
                  </span>
                </div>
              </div>

              {/* Progress Summary Banner */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: allMandatoryChecksApproved ? '#f0fdf4' : '#fffbeb',
                  borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${allMandatoryChecksApproved ? '#86efac' : '#fde68a'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {allMandatoryChecksApproved ? (
                    <CheckCircle2 size={24} color="var(--color-status-success-text)" />
                  ) : (
                    <Clock size={24} color="#b45309" />
                  )}
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {allMandatoryChecksApproved
                        ? 'KYC Verification Checklist Complete — Ready for Sign-Off'
                        : `${pendingChecksCount} Verification Check(s) Pending Review`}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {allMandatoryChecksApproved
                        ? 'All mandatory identity, address, criminal, reference, and vetting criteria are approved. Supervisor may execute sign-off.'
                        : 'Review submitted evidence documents below and complete the 6-point verification criteria.'}
                    </div>
                    {hasRejectedCheck && (
                      <div style={{ fontSize: '11px', color: 'var(--color-status-danger-text)', fontWeight: 700, marginTop: '4px' }}>
                        ⚠ Rejection findings recorded on one or more verification checks.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ minWidth: '160px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>
                    <span>KYC Progress</span>
                    <span>{Math.round(((approvedOpsCount + (otpPassed ? 1 : 0)) / 6) * 100)}%</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${((approvedOpsCount + (otpPassed ? 1 : 0)) / 6) * 100}%`,
                        backgroundColor: allMandatoryChecksApproved ? '#16a34a' : 'var(--color-brand-600)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Authoritative Verification Level Unavailable / Dossier Error Banner */}
              {(isDossierError || (!dossier?.level && !worker?.verification?.level)) && (
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-status-warning-bg)',
                    border: '1px solid var(--color-status-warning-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-status-warning-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      <AlertTriangle size={18} />
                      <span>Authoritative Verification Level Unavailable</span>
                    </div>
                    {isDossierError && (
                      <button
                        onClick={() => refetchDossier()}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--color-status-warning-border)',
                          color: 'var(--color-status-warning-text)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    Failed to fetch verification dossier: Unable to load the authoritative verification level from backend endpoint{' '}
                    <code>GET /api/v1/admin/workers/{workerId}/verification</code>.
                    {dossierError ? ` Error: ${(dossierError as Error).message || 'Server returned an error'}.` : ''}
                  </p>
                  <p style={{ margin: 0, lineHeight: 1.5, fontSize: 'var(--font-size-xs)' }}>
                    The frontend displays only confirmed backend verification status and does not infer approval.
                  </p>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SECTION A: SUBMITTED DOCUMENTS & SECURE VAULT PREVIEW    */}
              {/* -------------------------------------------------------- */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <FileText size={16} color="var(--color-primary)" />
                    <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      Documents — Submitted KYC Documents ({displayDocuments.length})
                    </h4>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> Encrypted Cloud Storage • On-demand short-lived signed URLs
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Click any submitted document to inspect it in the secure vault. You can review, accept, reject, or request re-verification per document.
                </div>

                {/* Documents Table */}
                <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Document Type</th>
                        <th style={{ padding: '8px 12px' }}>Reference / Number</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Submission Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDocuments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            data-testid="no-documents-submitted"
                            style={{
                              padding: 'var(--space-6)',
                              textAlign: 'center',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <FileText size={24} style={{ opacity: 0.4, marginBottom: '4px' }} />
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                              No verification documents submitted yet
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Pending worker upload via the Worker Mobile App.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        displayDocuments.map((doc, idx) => {
                          const {
                            checkType,
                            targetCheckId,
                            hasValidCheckId,
                            isApproved,
                            effectiveStatus,
                          } = getCheckForDoc(doc);

                          const isInspectingThis =
                            inspectingDoc &&
                            (inspectingDoc.id === doc.id ||
                              (doc.documentId && inspectingDoc.documentId === doc.documentId));

                          return (
                            <tr
                              key={doc.id || idx}
                              onClick={() => {
                                if (canViewDocuments) {
                                  setInspectingDoc({
                                    id: doc.id,
                                    documentId: doc.documentId || doc.id,
                                    checkId: targetCheckId,
                                    checkType,
                                    title: doc.documentTypeName,
                                    docNumber: doc.docNumberMasked,
                                    contentType: doc.contentType,
                                    mimeType: doc.mimeType,
                                  });
                                  setDocRotation(0);
                                  setDocZoom(100);
                                }
                              }}
                              style={{
                                borderBottom: '1px solid var(--color-border-subtle)',
                                cursor: canViewDocuments ? 'pointer' : 'default',
                                backgroundColor: isInspectingThis ? 'var(--color-bg-subtle)' : 'transparent',
                                transition: 'background-color 0.15s ease',
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={14} color="var(--color-brand-600)" />
                                  <span>{doc.documentTypeName}</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                                {doc.docNumberMasked || 'XXXX-XXXX-MASKED'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor:
                                      effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-bg)'
                                        : effectiveStatus === 'REJECTED'
                                        ? 'var(--color-status-danger-bg)'
                                        : 'var(--color-status-warning-bg)',
                                    color:
                                      effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-text)'
                                        : effectiveStatus === 'REJECTED'
                                        ? 'var(--color-status-danger-text)'
                                        : 'var(--color-status-warning-text)',
                                  }}
                                >
                                  {effectiveStatus}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                                {doc.submittedAt ? formatDateTimeIST(doc.submittedAt) : 'Recorded'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    justifyContent: 'flex-end',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {canViewDocuments ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectingDoc({
                                          id: doc.id,
                                          documentId: doc.documentId || doc.id,
                                          checkId: targetCheckId,
                                          checkType,
                                          title: doc.documentTypeName,
                                          docNumber: doc.docNumberMasked,
                                          contentType: doc.contentType,
                                          mimeType: doc.mimeType,
                                        });
                                        setDocRotation(0);
                                        setDocZoom(100);
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: 'var(--color-surface)',
                                        border: '1px solid var(--color-border-subtle)',
                                        color: 'var(--color-brand-600)',
                                        fontSize: '11px',
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
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                      Access Restricted
                                    </span>
                                  )}

                                  {canDecide && (
                                    <>
                                      <button
                                        disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId}
                                        title={!hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRecheckCheckType(checkType);
                                          setRecheckCheckId(targetCheckId || null);
                                          setIsRecheckModalOpen(true);
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-warning-dark)',
                                          backgroundColor: 'var(--color-warning-bg)',
                                          color: 'var(--color-warning-dark)',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          cursor:
                                            approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                              ? 'not-allowed'
                                              : 'pointer',
                                          opacity:
                                            approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                              ? 0.6
                                              : 1,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <RotateCcw size={12} />
                                        <span>Re-verify</span>
                                      </button>

                                      <button
                                        disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId}
                                        title={!hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRejectCheckType(checkType);
                                          setRejectCheckId(targetCheckId || null);
                                          setIsRejectDialogOpen(true);
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-error-dark)',
                                          backgroundColor: 'var(--color-error-bg)',
                                          color: 'var(--color-error-dark)',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          cursor:
                                            approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                              ? 'not-allowed'
                                              : 'pointer',
                                          opacity:
                                            approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                              ? 0.6
                                              : 1,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <XCircle size={12} />
                                        <span>Reject</span>
                                      </button>

                                      <button
                                        disabled={
                                          approveCheckMutation.isPending ||
                                          rejectCheckMutation.isPending ||
                                          isApproved ||
                                          !hasValidCheckId
                                        }
                                        title={
                                          !hasValidCheckId
                                            ? 'Contract gap: Backend verification check ID missing for this document'
                                            : isApproved
                                            ? 'Check is already approved'
                                            : undefined
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (targetCheckId) {
                                            setApproveCheckId(targetCheckId);
                                            setApproveCheckType(checkType);
                                            setApproveCheckTitle(doc.documentTypeName);
                                            setApproveDialogError(null);
                                            setIsApproveDialogOpen(true);
                                          }
                                        }}
                                        style={{
                                          padding: '4px 12px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-brand-600)',
                                          backgroundColor: isApproved
                                            ? 'var(--color-status-success-bg)'
                                            : 'var(--color-brand-600)',
                                          color: isApproved
                                            ? 'var(--color-status-success-text)'
                                            : '#ffffff',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          cursor: isApproved || !hasValidCheckId ? 'not-allowed' : 'pointer',
                                          opacity: !hasValidCheckId ? 0.6 : 1,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        {isApproved ? (
                                          <>
                                            <CheckCircle2 size={12} />
                                            <span>Accepted</span>
                                          </>
                                        ) : approveCheckMutation.isPending && approveCheckId === targetCheckId ? (
                                          <>
                                            <Clock size={12} />
                                            <span>Accepting...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 size={12} />
                                            <span>Accept</span>
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline Secure Document Inspection Viewer */}
                {inspectingDoc && (
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Authorized Document Vault Preview
                        </span>
                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {inspectingDoc.title} ({inspectingDoc.docNumber || 'XXXX-XXXX-VALID'})
                        </h4>
                      </div>
                      <button
                        onClick={() => setInspectingDoc(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        ✕ Close Preview
                      </button>
                    </div>

                    {!hasInspectingDocId ? (
                      <div
                        data-testid="worker-doc-missing-id"
                        style={{
                          padding: 'var(--space-6)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                        }}
                      >
                        <FileText size={32} color="var(--color-text-muted)" style={{ marginBottom: 'var(--space-2)' }} />
                        <h5 style={{ fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1) 0' }}>
                          Document Attachment Unavailable
                        </h5>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                          No backend document reference ID is associated with this record. A genuine document ID is required to request an authorized signed URL.
                        </p>
                      </div>
                    ) : isDocLoading ? (
                      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <LoadingSpinner message="Fetching authorized signed document link from secure vault..." />
                      </div>
                    ) : isDocError ? (
                      (() => {
                        const formattedErr = formatDocumentVaultError(docError);
                        return (
                          <div
                            style={{
                              padding: 'var(--space-6)',
                              backgroundColor: 'var(--color-error-bg)',
                              border: '1px solid var(--color-error-border)',
                              borderRadius: 'var(--radius-md)',
                              textAlign: 'center',
                            }}
                          >
                            <AlertTriangle size={32} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                            <h5 style={{ fontWeight: 700, color: 'var(--color-error-dark)', margin: '0 0 var(--space-1) 0' }}>
                              {formattedErr.title}
                            </h5>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 auto var(--space-3) auto', maxWidth: '420px' }}>
                              {formattedErr.message}
                            </p>
                            {formattedErr.canRetry && (
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
                          </div>
                        );
                      })()
                    ) : docLinkData?.signedUrl ? (
                      (() => {
                        const url = docLinkData.signedUrl;
                        const mimeType = (
                          docLinkData.mimeType ||
                          inspectingDoc.mimeType ||
                          inspectingDoc.contentType ||
                          ''
                        ).toLowerCase();
                        const isPdf = mimeType.includes('pdf') || /\.pdf(\?.*)?$/i.test(url);
                        const isImage =
                          mimeType.startsWith('image/') ||
                          /\.(jpe?g|png|webp|svg|gif|bmp)(\?.*)?$/i.test(url);

                        return (
                          <div
                            style={{
                              padding: 'var(--space-6)',
                              backgroundColor: 'var(--color-bg-subtle)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              textAlign: 'center',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                            }}
                          >
                            <div
                              style={{
                                transform: `rotate(${docRotation}deg) scale(${docZoom / 100})`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                width: '100%',
                              }}
                            >
                              {isImage ? (
                                <img
                                  src={url}
                                  alt={inspectingDoc.title}
                                  data-testid="kyc-document-image"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '420px',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: 'var(--shadow-sm)',
                                  }}
                                />
                              ) : isPdf ? (
                                <iframe
                                  src={url}
                                  title={inspectingDoc.title}
                                  data-testid="kyc-document-pdf"
                                  style={{
                                    width: '100%',
                                    height: '420px',
                                    border: '1px solid var(--color-border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: '#ffffff',
                                  }}
                                />
                              ) : (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                                  <iframe
                                    src={url}
                                    title={inspectingDoc.title}
                                    data-testid="kyc-document-frame"
                                    style={{
                                      width: '100%',
                                      height: '380px',
                                      border: '1px solid var(--color-border-subtle)',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: '#ffffff',
                                    }}
                                  />
                                </div>
                              )}
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                {inspectingDoc.title} {inspectingDoc.docNumber ? `(${inspectingDoc.docNumber})` : ''}
                              </div>
                              {docLinkData.expiresAt && (
                                <div style={{ fontSize: '10px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                                  Validity: {docLinkData.expiresAt}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                              <button
                                onClick={() => setDocRotation((r) => (r + 90) % 360)}
                                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer' }}
                              >
                                Rotate 90°
                              </button>
                              <button
                                onClick={() => setDocZoom((z) => Math.min(z + 10, 150))}
                                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer' }}
                              >
                                Zoom In
                              </button>
                              <button
                                onClick={() => setDocZoom((z) => Math.max(z - 10, 70))}
                                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer' }}
                              >
                                Zoom Out
                              </button>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--color-brand-600)',
                                  color: '#ffffff',
                                  textDecoration: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <ExternalLink size={12} /> Open Secure Document Link
                              </a>
                            </div>

                            {/* Inspection Reviewer Decision Bar */}
                            {canDecide && (() => {
                              const inspInfo = getCheckForDoc({
                                id: inspectingDoc.id,
                                documentId: inspectingDoc.documentId || inspectingDoc.id,
                                checkId: inspectingDoc.checkId,
                                documentType: inspectingDoc.checkType,
                                documentTypeName: inspectingDoc.title,
                                docNumberMasked: inspectingDoc.docNumber,
                                status: 'SUBMITTED',
                              });

                              return (
                                <div
                                  style={{
                                    marginTop: 'var(--space-3)',
                                    paddingTop: 'var(--space-3)',
                                    borderTop: '1px solid var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 'var(--space-2)',
                                    width: '100%',
                                  }}
                                >
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                                    <strong>Inspection Review:</strong>{' '}
                                    {inspInfo.isApproved ? (
                                      <span style={{ color: 'var(--color-status-success-text)', fontWeight: 600 }}>
                                        Document check already approved.
                                      </span>
                                    ) : (
                                      'Review document evidence above, then make your verification decision.'
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                    <button
                                      disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId}
                                      title={!inspInfo.hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                      onClick={() => {
                                        setRecheckCheckType(inspInfo.checkType);
                                        setRecheckCheckId(inspInfo.targetCheckId || null);
                                        setIsRecheckModalOpen(true);
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-warning-dark)',
                                        backgroundColor: 'var(--color-warning-bg)',
                                        color: 'var(--color-warning-dark)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor:
                                          approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId
                                            ? 'not-allowed'
                                            : 'pointer',
                                        opacity:
                                          approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId
                                            ? 0.6
                                            : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <RotateCcw size={12} />
                                      <span>Request Re-Verification</span>
                                    </button>

                                    <button
                                      disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId}
                                      title={!inspInfo.hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                      onClick={() => {
                                        setRejectCheckType(inspInfo.checkType);
                                        setRejectCheckId(inspInfo.targetCheckId || null);
                                        setIsRejectDialogOpen(true);
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-error-dark)',
                                        backgroundColor: 'var(--color-error-bg)',
                                        color: 'var(--color-error-dark)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor:
                                          approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId
                                            ? 'not-allowed'
                                            : 'pointer',
                                        opacity:
                                          approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId
                                            ? 0.6
                                            : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <XCircle size={12} />
                                      <span>Reject</span>
                                    </button>

                                    <button
                                      disabled={
                                        approveCheckMutation.isPending ||
                                        rejectCheckMutation.isPending ||
                                        inspInfo.isApproved ||
                                        !inspInfo.hasValidCheckId
                                      }
                                      title={
                                        !inspInfo.hasValidCheckId
                                          ? 'Contract gap: Backend verification check ID missing for this document'
                                          : inspInfo.isApproved
                                          ? 'Check is already approved'
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (inspInfo.targetCheckId) {
                                          setApproveCheckId(inspInfo.targetCheckId);
                                          setApproveCheckType(inspInfo.checkType);
                                          setApproveCheckTitle(inspectingDoc.title);
                                          setApproveDialogError(null);
                                          setIsApproveDialogOpen(true);
                                        }
                                      }}
                                      style={{
                                        padding: '4px 14px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-brand-600)',
                                        backgroundColor: inspInfo.isApproved
                                          ? 'var(--color-status-success-bg)'
                                          : 'var(--color-brand-600)',
                                        color: inspInfo.isApproved
                                          ? 'var(--color-status-success-text)'
                                          : '#ffffff',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor:
                                          inspInfo.isApproved || !inspInfo.hasValidCheckId
                                            ? 'not-allowed'
                                            : 'pointer',
                                        opacity: !inspInfo.hasValidCheckId ? 0.6 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {inspInfo.isApproved ? (
                                        <>
                                          <CheckCircle2 size={12} />
                                          <span>Accepted</span>
                                        </>
                                      ) : approveCheckMutation.isPending && approveCheckId === inspInfo.targetCheckId ? (
                                        <>
                                          <Clock size={12} />
                                          <span>Accepting...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 size={12} />
                                          <span>Accept</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()
                    ) : null}
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------- */}
              {/* SECTION B: 6-POINT VERIFICATION CHECKLIST & ACTIONS       */}
              {/* -------------------------------------------------------- */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                      6-Point Trust & Verification Status
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      1 Automated Mobile OTP Pre-Check + 5 Operations Vetting Checks
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: allMandatoryChecksApproved ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                      color: allMandatoryChecksApproved ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                    }}
                  >
                    {allMandatoryChecksApproved ? 'All 6 Checks Satisfied' : `${pendingChecksCount} Checks Pending Review`}
                  </span>
                </div>

                {/* 6-Point Verification Breakdown Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 'var(--space-2)',
                    fontSize: '11px',
                    margin: 'var(--space-1) 0',
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>1. Mobile OTP Pre-Check</span>
                    <strong style={{ color: otpPassed ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)' }}>
                      {otpPassed ? 'PASSED' : 'PENDING'}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>2. Identity Proof (Aadhaar)</span>
                    <strong style={{ color: checksRecord.IDENTITY?.status === 'APPROVED' ? 'var(--color-status-success-text)' : checksRecord.IDENTITY?.status === 'REJECTED' ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)' }}>
                      {checksRecord.IDENTITY?.status || 'PENDING'}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>3. Residential Address Proof</span>
                    <strong style={{ color: checksRecord.ADDRESS?.status === 'APPROVED' ? 'var(--color-status-success-text)' : checksRecord.ADDRESS?.status === 'REJECTED' ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)' }}>
                      {checksRecord.ADDRESS?.status || 'PENDING'}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>4. Criminal Self-Declaration</span>
                    <strong style={{ color: (checksRecord.POLICE_CLEARANCE?.status === 'APPROVED' || checksRecord.POLICE_VERIFICATION?.status === 'APPROVED') ? 'var(--color-status-success-text)' : checksRecord.POLICE_CLEARANCE?.status === 'REJECTED' ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)' }}>
                      {checksRecord.POLICE_CLEARANCE?.status || checksRecord.POLICE_VERIFICATION?.status || 'PENDING'}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>5. Skill Certificate / License</span>
                    <strong style={{ color: (checksRecord.SKILL_CERTIFICATE?.status === 'APPROVED' || checksRecord.EMERGENCY_CONTACT?.status === 'APPROVED') ? 'var(--color-status-success-text)' : checksRecord.EMERGENCY_CONTACT?.status === 'REJECTED' ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)' }}>
                      {checksRecord.SKILL_CERTIFICATE?.status || checksRecord.EMERGENCY_CONTACT?.status || 'PENDING'}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>6. Prior Employer Reference</span>
                    <strong style={{ color: (checksRecord.REFERENCE?.status === 'APPROVED' || checksRecord.PREVIOUS_EMPLOYMENT?.status === 'APPROVED') ? 'var(--color-status-success-text)' : checksRecord.REFERENCE?.status === 'REJECTED' ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)' }}>
                      {checksRecord.REFERENCE?.status || checksRecord.PREVIOUS_EMPLOYMENT?.status || 'PENDING'}
                    </strong>
                  </div>
                  {/* Additional checks beyond the core 6 (e.g. Skill Certificate, License) */}
                  {operationalChecksList.filter(c => c.key === 'SKILL_CERTIFICATE' || c.key === 'LICENSE').map(({ key, label, check, required }, idx) => {
                    const statusColor =
                      check.status === 'APPROVED'
                        ? 'var(--color-status-success-text)'
                        : check.status === 'REJECTED'
                        ? 'var(--color-status-danger-text)'
                        : 'var(--color-status-warning-text)';
                    return (
                      <div
                        key={key}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={label}>
                          {`${idx + 7}. ${label}`}{required ? ' *' : ''}
                        </span>
                        <strong style={{ color: statusColor }}>{check.status}</strong>
                      </div>
                    );
                  })}
                </div>

                {/* Pre-Check Box: Mobile OTP */}
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: otpPassed ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CheckCircle2 size={16} color={otpPassed ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)'} />
                    <div>
                      <strong style={{ color: otpPassed ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)' }}>
                        Automated Telecom OTP Pre-Check
                      </strong>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                        Automated Telecom SMS Gateway • Verified on registration
                      </div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: otpPassed ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)' }}>
                    {otpPassed ? 'PASSED (System Verified)' : 'PENDING'}
                  </span>
                </div>

                {/* 5 Operational Checks Interactive Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {operationalChecksList.map(({ key, label, check, stepEval }) => {
                    const targetCheckId =
                      check.id ||
                      (check as { id?: string; checkId?: string }).checkId ||
                      dossier?.checks?.[key]?.id ||
                      (key === 'IDENTITY' ? dossier?.checkId : undefined);
                    const hasValidCheckId = Boolean(targetCheckId);

                    return (
                      <div
                        key={key}
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                              {stepEval?.order}. {label}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              Method: {check.evaluationMethod === 'TELEPHONIC_VETTING' ? 'Telephonic Call Vetting' : 'Visual Document Inspection'}
                            </span>
                          </div>
                          <StatusBadge status={check.status} />
                        </div>

                        {/* Evidence & Details */}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                          {check.documentMetadata && (
                            <span>
                              <strong>Doc Ref:</strong> {check.documentMetadata.docNumberMasked || '—'} ({check.documentMetadata.documentTypeName})
                            </span>
                          )}
                          {check.contactDetails && (
                            <span>
                              <strong>Contact:</strong> {check.contactDetails.contactName} ({check.contactDetails.relationshipOrRole}) • {check.contactDetails.phoneMasked}
                            </span>
                          )}
                          {check.rejectionRemarks && (
                            <span style={{ color: 'var(--color-status-danger-text)' }}>
                              <strong>Rejection Reason:</strong> {check.rejectionCategory} • "{check.rejectionRemarks}"
                            </span>
                          )}
                        </div>

                        {/* Decision Controls for Verification Executives */}
                        {canDecide && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: 'var(--space-2)',
                              paddingTop: 'var(--space-2)',
                              borderTop: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {check.status === 'PENDING' && hasValidCheckId && (
                              <button
                                disabled={claimMutation.isPending || approveCheckMutation.isPending || rejectCheckMutation.isPending}
                                onClick={() => {
                                  if (targetCheckId) {
                                    claimMutation.mutate(targetCheckId);
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-brand-500)',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  color: 'var(--color-brand-600)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: claimMutation.isPending ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Clock size={12} />
                                <span>{claimMutation.isPending ? 'Claiming...' : 'Start Review'}</span>
                              </button>
                            )}

                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId}
                              title={!hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                              onClick={() => {
                                setRecheckCheckType(key);
                                setRecheckCheckId(targetCheckId || null);
                                setIsRecheckModalOpen(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-warning-dark)',
                                backgroundColor: 'var(--color-warning-bg)',
                                color: 'var(--color-warning-dark)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor:
                                  approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                    ? 'not-allowed'
                                    : 'pointer',
                                opacity:
                                  approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                    ? 0.6
                                    : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <RotateCcw size={12} />
                              <span>Request Re-Verification</span>
                            </button>

                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId}
                              title={!hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                              onClick={() => {
                                setRejectCheckType(key);
                                setRejectCheckId(targetCheckId || null);
                                setIsRejectDialogOpen(true);
                              }}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-error-dark)',
                                backgroundColor: 'var(--color-error-bg)',
                                color: 'var(--color-error-dark)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor:
                                  approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                    ? 'not-allowed'
                                    : 'pointer',
                                opacity:
                                  approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId
                                    ? 0.6
                                    : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <XCircle size={12} />
                              <span>Reject Check</span>
                            </button>

                            <button
                              disabled={
                                approveCheckMutation.isPending ||
                                rejectCheckMutation.isPending ||
                                check.status === 'APPROVED' ||
                                !hasValidCheckId
                              }
                              title={
                                !hasValidCheckId
                                  ? 'Check ID unavailable from backend data'
                                  : check.status === 'APPROVED'
                                  ? 'Check is already approved'
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (targetCheckId) {
                                  setApproveCheckId(targetCheckId);
                                  setApproveCheckType(key);
                                  setApproveCheckTitle(label);
                                  setApproveDialogError(null);
                                  setIsApproveDialogOpen(true);
                                }
                              }}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-brand-600)',
                                backgroundColor: check.status === 'APPROVED'
                                  ? 'var(--color-status-success-bg)'
                                  : 'var(--color-brand-600)',
                                color: check.status === 'APPROVED'
                                  ? 'var(--color-status-success-text)'
                                  : '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor:
                                  check.status === 'APPROVED' || !hasValidCheckId
                                    ? 'not-allowed'
                                    : 'pointer',
                                opacity: !hasValidCheckId ? 0.6 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {approveCheckMutation.isPending && approveCheckId === targetCheckId ? (
                                <>
                                  <Clock size={12} />
                                  <span>Approving...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>{check.status === 'APPROVED' ? 'Check Approved' : 'Approve Check'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* SECTION C: FINAL APPROVAL (SIGN-OFF) & ACTIVATION        */}
              {/* -------------------------------------------------------- */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                {/* Action Card 1: Supervisor Verification Sign-Off */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: isSignedOff
                      ? 'var(--color-status-success-bg)'
                      : allMandatoryChecksApproved
                      ? '#eff6ff'
                      : 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: isSignedOff
                      ? '1px solid var(--color-status-success-text)'
                      : allMandatoryChecksApproved
                      ? '1px solid var(--color-brand-500, #3b82f6)'
                      : '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <CheckCircle2
                        size={18}
                        color={
                          isSignedOff
                            ? 'var(--color-status-success-text)'
                            : allMandatoryChecksApproved
                            ? 'var(--color-brand-600, #2563eb)'
                            : 'var(--color-text-muted)'
                        }
                      />
                      <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        Supervisor Verification Sign-Off
                      </h4>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {isSignedOff
                        ? `Formal verification sign-off completed${
                            dossier?.signedOffAt || worker.signedOffAt
                              ? ` on ${formatDateTimeIST((dossier?.signedOffAt || worker.signedOffAt)!)}`
                              : ''
                          }. Application status is VERIFIED.`
                        : allMandatoryChecksApproved
                        ? 'All mandatory checks are approved. Authorized supervisor may execute final verification sign-off.'
                        : `Sign-off is locked: ${
                            operationalChecksList.length - approvedOpsCount
                          } mandatory KYC check(s) remain incomplete.`}
                    </p>
                  </div>

                  <div>
                    {isSignedOff ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: '#ffffff',
                          color: 'var(--color-status-success-text)',
                          border: '1px solid var(--color-status-success-text)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Signed Off (VERIFIED)</span>
                      </div>
                    ) : canSignOff ? (
                      <button
                        id="verification-signoff-btn"
                        disabled={!allMandatoryChecksApproved || signOffMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allMandatoryChecksApproved) {
                            setIsSignOffDialogOpen(true);
                          }
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: allMandatoryChecksApproved ? 'var(--color-brand-600, #2563eb)' : 'var(--color-bg-surface)',
                          color: allMandatoryChecksApproved ? '#ffffff' : 'var(--color-text-muted)',
                          border: allMandatoryChecksApproved ? 'none' : '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          cursor: !allMandatoryChecksApproved || signOffMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: !allMandatoryChecksApproved || signOffMutation.isPending ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: allMandatoryChecksApproved ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>{signOffMutation.isPending ? 'Signing Off...' : 'Sign Off Verification'}</span>
                      </button>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Supervisor Only: Requires supervisor sign-off permission (verification.signoff).
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Card 2: Commercial Platform Activation */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: isOnboarded
                      ? 'var(--color-status-success-bg)'
                      : isSignedOff
                      ? '#f0fdf4'
                      : 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: isOnboarded
                      ? '1px solid var(--color-status-success-text)'
                      : isSignedOff
                      ? '1px solid #86efac'
                      : '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ShieldCheck
                        size={18}
                        color={isOnboarded ? 'var(--color-status-success-text)' : isSignedOff ? '#16a34a' : 'var(--color-text-muted)'}
                      />
                      <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        Commercial Platform Activation
                      </h4>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {isOnboarded
                        ? `Worker is commercially activated on SevaNest${
                            dossier?.activatedAt || worker.activatedAt
                              ? ` since ${formatDateTimeIST((dossier?.activatedAt || worker.activatedAt)!)}`
                              : ''
                          }. Worker is live on the roster and eligible for matching.`
                        : isSignedOff
                        ? 'Verification sign-off is complete. Authorized Operations Admin may now activate the worker onto the platform roster.'
                        : 'Activation is locked: Verification sign-off must be completed before commercial platform activation.'}
                    </p>
                  </div>

                  <div>
                    {isOnboarded ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#ffffff',
                            color: 'var(--color-status-success-text)',
                            border: '1px solid var(--color-status-success-text)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>ACTIVE & ONBOARDED</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-status-success-text)', fontWeight: 600 }}>
                          Eligible for Customer Matching & Allocation
                        </span>
                      </div>
                    ) : canActivate ? (
                      <button
                        id="worker-activate-btn"
                        disabled={!isSignedOff || activateMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSignedOff) {
                            setIsActivateDialogOpen(true);
                          }
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSignedOff ? '#16a34a' : 'var(--color-bg-surface)',
                          color: isSignedOff ? '#ffffff' : 'var(--color-text-muted)',
                          border: isSignedOff ? 'none' : '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          cursor: !isSignedOff || activateMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: !isSignedOff || activateMutation.isPending ? 0.6 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSignedOff ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        <ShieldCheck size={14} />
                        <span>{activateMutation.isPending ? 'Activating...' : 'Activate Worker on Platform'}</span>
                      </button>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Requires Operations Admin activation permission (worker.activate).
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer with Operational Safeguards and Close Button */}
        <div
          style={{
            flexShrink: 0,
            padding: 'var(--space-3) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE}>
              <button
                onClick={openCategoryModal}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sliders size={13} />
                <span>Categories</span>
              </button>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE_STATUS}>
              {worker.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => {
                      setTargetStatus('SUSPENDED');
                      setIsDisciplineOpen(true);
                    }}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-warning-bg)',
                      color: 'var(--color-status-warning-text)',
                      border: '1px solid var(--color-status-warning-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ShieldAlert size={14} />
                    <span>Suspend Worker</span>
                  </button>

                  <button
                    onClick={() => {
                      setTargetStatus('BLACKLISTED');
                      setIsDisciplineOpen(true);
                    }}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-danger-bg)',
                      color: 'var(--color-status-danger-text)',
                      border: '1px solid var(--color-status-danger-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <XCircle size={14} />
                    <span>Blacklist</span>
                  </button>
                </>
              )}

              {worker.status !== 'ACTIVE' && (
                <button
                  onClick={() => {
                    setTargetStatus('ACTIVE');
                    setIsDisciplineOpen(true);
                  }}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-status-success-bg)',
                    color: 'var(--color-status-success-text)',
                    border: '1px solid var(--color-status-success-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Restore Active Status</span>
                </button>
              )}
            </PermissionGate>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Reject Check Dialog */}
      <ConfirmDialog
        isOpen={isRejectDialogOpen}
        title={`Reject ${rejectCheckType} Verification Check`}
        description="Select an operational rejection reason category and provide mandatory remarks. The applicant will be notified to re-upload or rectify."
        confirmLabel="Confirm Rejection"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational remarks (e.g., Image is blurred, name mismatch with registration records)..."
        isLoading={rejectCheckMutation.isPending}
        onConfirm={(remarks) => {
          if (rejectCheckId) {
            rejectCheckMutation.mutate({
              checkId: rejectCheckId,
              checkType: rejectCheckType,
              category: rejectCategory,
              remarks: remarks || rejectRemarks || 'Verification check rejected by executive.',
            });
          }
        }}
        onCancel={() => setIsRejectDialogOpen(false)}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Rejection Reason Category:
          </label>
          <select
            value={rejectCategory}
            onChange={(e) => setRejectCategory(e.target.value as RejectionReasonCategory)}
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

      {/* Re-Verification / Correction Dialog */}
      <ConfirmDialog
        isOpen={isRecheckModalOpen}
        title={`Request Re-Verification: ${recheckCheckType}`}
        description="Issue an operational re-verification request to the worker mobile app for annual compliance renewal or updated documentation."
        confirmLabel="Send Re-Verification Notice"
        requireRemarks={true}
        remarksPlaceholder="Enter specific mandatory instructions (e.g., Please upload updated electricity bill or valid PCC certificate)..."
        isLoading={recheckMutation.isPending}
        onConfirm={(instructions) => {
          if (recheckCheckId) {
            recheckMutation.mutate({
              checkId: recheckCheckId,
              checkTypes: [recheckCheckType],
              instructions: instructions || recheckInstructions || 'Periodic compliance re-verification requested.',
            });
          }
        }}
        onCancel={() => setIsRecheckModalOpen(false)}
      />

      {/* Approve Check Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isApproveDialogOpen}
        title={`Approve ${approveCheckTitle}`}
        description={`Confirm approval for ${approveCheckTitle} for ${worker?.name || 'the worker'}. Approving this check validates the operational evidence. Once all required checks are approved, the worker's authoritative verification level transitions to VERIFIED.`}
        confirmLabel="Confirm Approval"
        isLoading={approveCheckMutation.isPending}
        requireRemarks={false}
        remarksPlaceholder="Optional verification approval notes..."
        errorMessage={approveDialogError}
        onConfirm={(remarks) => {
          if (approveCheckId) {
            setApproveDialogError(null);
            const docDetails =
              missingApprovalRequirements && missingApprovalRequirements.length > 0
                ? {
                    documentNumber: inputDocNumber.trim() || undefined,
                    expiresOn: inputExpiryDate.trim() || undefined,
                  }
                : undefined;
            approveCheckMutation.mutate({
              checkId: approveCheckId,
              checkType: approveCheckType,
              notes: remarks || 'Verified and approved by Verification Executive',
              docDetails,
            });
          }
        }}
        onCancel={() => {
          setIsApproveDialogOpen(false);
          setApproveCheckId(null);
          setApproveDialogError(null);
          setMissingApprovalRequirements(null);
          setInputDocNumber('');
          setInputExpiryDate('');
        }}
      >
        {missingApprovalRequirements && missingApprovalRequirements.length > 0 && (
          <div
            data-testid="approval-requirements-inputs"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              marginTop: 'var(--space-2)',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Required document details must be recorded before approval:
            </div>
            {missingApprovalRequirements.some((r) => r.toLowerCase().includes('documentnumber') || r.toLowerCase().includes('number')) && (
              <div>
                <label
                  htmlFor="input-doc-number"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}
                >
                  Document Number *
                </label>
                <input
                  id="input-doc-number"
                  data-testid="input-document-number"
                  type="text"
                  value={inputDocNumber}
                  onChange={(e) => setInputDocNumber(e.target.value)}
                  placeholder="e.g. DL-1420110012345 or PCC-2026-99"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                />
              </div>
            )}
            {missingApprovalRequirements.some((r) => r.toLowerCase().includes('expire') || r.toLowerCase().includes('date')) && (
              <div>
                <label
                  htmlFor="input-expiry-date"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}
                >
                  Document Expiry Date *
                </label>
                <input
                  id="input-expiry-date"
                  data-testid="input-expiry-date"
                  type="date"
                  value={inputExpiryDate}
                  onChange={(e) => setInputExpiryDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                />
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      {/* Supervisor Verification Sign-Off Dialog */}
      <ConfirmDialog
        isOpen={isSignOffDialogOpen}
        title={`Verification Sign-Off: ${worker?.name || 'Worker'}`}
        description={`Confirm formal verification sign-off for ${worker?.name || 'the worker'}. All mandatory KYC verification checks have been independently reviewed and approved. This action transitions the worker dossier to VERIFIED status.`}
        confirmLabel={
          signOffMutation.isPending
            ? 'Signing Off...'
            : signOffDialogError
            ? 'Retry Sign-Off'
            : 'Sign Off Verification'
        }
        isLoading={signOffMutation.isPending}
        showRemarks={true}
        requireRemarks={false}
        remarksPlaceholder="Optional supervisor sign-off remarks..."
        errorMessage={signOffDialogError}
        onConfirm={(remarks) => {
          if (worker?.id) {
            signOffMutation.mutate({
              workerId: worker.id,
              remarks: remarks || undefined,
            });
          }
        }}
        onCancel={() => {
          setIsSignOffDialogOpen(false);
          setSignOffDialogError(null);
        }}
      />

      {/* Commercial Platform Activation Dialog */}
      <ConfirmDialog
        isOpen={isActivateDialogOpen}
        title={`Activate Worker: ${worker?.name || 'Worker'}`}
        description={`Confirm commercial platform activation for ${worker?.name || 'the worker'}. The backend verifies all authoritative prerequisites: approved checks, service category, service area, criminal self-declaration, active account, and no blacklist.`}
        confirmLabel={activateMutation.isPending ? 'Activating...' : 'Activate Worker on Platform'}
        isLoading={activateMutation.isPending}
        requireRemarks={false}
        errorMessage={activateDialogError}
        onConfirm={() => {
          if (worker?.id) {
            activateMutation.mutate(worker.id);
          }
        }}
        onCancel={() => {
          setIsActivateDialogOpen(false);
          setActivateDialogError(null);
          setMissingActivationPrerequisites(null);
        }}
      >
        {missingActivationPrerequisites && missingActivationPrerequisites.length > 0 && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-status-danger-bg)',
              border: '1px solid var(--color-status-danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-status-danger-text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
              <AlertTriangle size={14} />
              <span>Missing Activation Requirements (Authoritative Backend Rejection):</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.5 }}>
              {missingActivationPrerequisites.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDialog>

      {/* Disciplinary Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDisciplineOpen}
        title={`Disciplinary Status Mutation: ${targetStatus}`}
        description={`Configure account state for ${worker.name}. This action updates worker active roster eligibility.`}
        isDestructive={targetStatus !== 'ACTIVE'}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational reason (e.g., Customer safety complaint on Ticket TKT-4710)..."
        onConfirm={handleStatusConfirm}
        onCancel={() => setIsDisciplineOpen(false)}
      />

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 'var(--space-4)',
          }}
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: 0, marginBottom: 'var(--space-2)' }}>
              Configure Service Categories
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4) 0' }}>
              Select the service categories in which {worker.name} is qualified and authorized to deliver domestic work.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
              {ALL_SERVICE_CATEGORIES.map((cat) => {
                const checked = selectedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: checked ? 'var(--color-brand-50, #f0f9ff)' : 'var(--color-bg-subtle)',
                      border: checked ? '1px solid var(--color-brand-600, #0284c7)' : '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: checked ? 600 : 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat)}
                      style={{ accentColor: 'var(--color-brand-600, #0284c7)' }}
                    />
                    <span>{cat}</span>
                  </label>
                );
              })}
            </div>

            {categoryUpdateSuccess && (
              <div style={{ color: 'var(--color-status-success-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                ✓ Service categories updated successfully.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                disabled={categoryMutation.isPending}
                onClick={() => setIsCategoryModalOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                disabled={categoryMutation.isPending || selectedCategories.length === 0}
                onClick={() => categoryMutation.mutate(selectedCategories)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600, var(--color-primary))',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: categoryMutation.isPending || selectedCategories.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: categoryMutation.isPending || selectedCategories.length === 0 ? 0.6 : 1,
                }}
              >
                {categoryMutation.isPending ? 'Updating...' : 'Save Category Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
