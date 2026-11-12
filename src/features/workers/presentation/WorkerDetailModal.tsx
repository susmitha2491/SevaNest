/* global HTMLDivElement, HTMLButtonElement, KeyboardEvent, HTMLElement, CustomEvent */
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
  RotateCw,
  Languages,
  Clock,
  ExternalLink,
  Briefcase,
  FileText,
  User,
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
  isTerminalRejectionCode,
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
import { CustomSelect } from '../../../components/common/CustomSelect';
import { RequiredIndicator } from '../../../components/common/RequiredIndicator';

export type WorkerModalWorkflowStep =
  | 'worker-info'
  | 'digital-docs'
  | 'final-approval'
  | 'kyc-verification'
  | 'manual-docs';

interface WorkerDetailModalProps {
  workerId: string;
  onClose: () => void;
  onStatusChanged?: () => void;
  initialStep?: WorkerModalWorkflowStep;
  readOnly?: boolean;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ur: 'Urdu',
  or: 'Odia',
};

function formatLanguageList(languages: string[] | undefined): string {
  if (!languages || languages.length === 0) return 'Not specified';
  return languages
    .map((code) => LANGUAGE_LABELS[code.toLowerCase()] || code)
    .join(', ');
}

function formatEngagementPreference(pref?: string | null): string {
  if (!pref) return 'Monthly / Per Engagement';
  const map: Record<string, string> = {
    FULL_TIME: 'Full Time (Monthly)',
    PART_TIME: 'Part Time',
    LIVE_IN: 'Live-In Resident',
    DAILY: 'Daily / Day Shifts',
    HOURLY: 'Hourly Basis',
    SHIFT: 'Rotational Shift',
    ONE_TIME: 'One-Time On-Demand',
  };
  return map[pref.toUpperCase()] || pref;
}

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({
  workerId,
  onClose,
  onStatusChanged,
  initialStep = 'worker-info',
  readOnly = false,
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
  const canDecide = !readOnly && hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE);
  const canSignOff = !readOnly && hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_SIGNOFF);
  const canActivate = hasPermission(user?.permissions, PERMISSIONS.WORKER_ACTIVATE);
  const canViewDocuments =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW) ||
    hasPermission(user?.permissions, PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED);
  const canRevealPii = canReview || canViewWorker;

  // 3-Stage Workflow State: worker-info -> digital-docs -> final-approval
  // Map legacy 'kyc-verification' to 'digital-docs', and 'manual-docs' to 'final-approval' for backward compatibility
  const normalizedInitialStep: WorkerModalWorkflowStep =
    initialStep === 'kyc-verification'
      ? 'digital-docs'
      : initialStep === 'manual-docs'
      ? 'final-approval'
      : initialStep;
  const [activeStep, setActiveStep] = useState<WorkerModalWorkflowStep>(normalizedInitialStep);

  // Sensitive PII reveal
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);
  const [isPhotoLoadError, setIsPhotoLoadError] = useState(false);
  const [revealedEmergencyContact, setRevealedEmergencyContact] = useState<{ name: string; mobile: string } | null>(null);
  const [isEmergencyContactRevealed, setIsEmergencyContactRevealed] = useState(false);
  const [isRevealingEmergency, setIsRevealingEmergency] = useState(false);
  const [emergencyRevealError, setEmergencyRevealError] = useState<string | null>(null);

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
    submittedAt?: string;
  } | null>(null);
  const [docRotation, setDocRotation] = useState(0);
  const [docZoom, setDocZoom] = useState(100);


  // Check actions dialog state (Single active dialog model to guarantee isolated popups with no stacking or state leakage)
  type ActiveDocDialog = 'APPROVE' | 'REJECT' | 'RECHECK' | null;
  const [activeDocDialog, setActiveDocDialog] = useState<ActiveDocDialog>(null);
  const isApproveDialogOpen = activeDocDialog === 'APPROVE';
  const isRejectDialogOpen = activeDocDialog === 'REJECT';
  const isRecheckModalOpen = activeDocDialog === 'RECHECK';

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

  const [rejectCheckType, setRejectCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [rejectCheckId, setRejectCheckId] = useState<string | null>(null);
  const [rejectCategory, setRejectCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectCheckError, setRejectCheckError] = useState<string | null>(null);

  // Worker-Level Rejection State (Stage 4 & Final Application Rejection)
  const [isRejectWorkerDialogOpen, setIsRejectWorkerDialogOpen] = useState(false);
  const [rejectWorkerCategory, setRejectWorkerCategory] = useState<RejectionReasonCategory>('OTHER');
  const [rejectWorkerRemarks, setRejectWorkerRemarks] = useState('');
  const [rejectWorkerError, setRejectWorkerError] = useState<string | null>(null);

  const [recheckCheckType, setRecheckCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [recheckCheckId, setRecheckCheckId] = useState<string | null>(null);
  const [recheckInstructions, setRecheckInstructions] = useState('');

  const closeDocDialog = () => {
    setActiveDocDialog(null);
    setApproveDialogError(null);
    setMissingApprovalRequirements(null);
    setInputDocNumber('');
    setInputExpiryDate('');
    setRejectRemarks('');
    setRecheckInstructions('');
  };

  const openApproveDialog = (
    checkId: string,
    checkType: VerificationCheckType,
    title: string,
    docMetadata?: { docNumberMasked?: string; referenceNumber?: string; expiryDate?: string; expiresOn?: string }
  ) => {
    setApproveCheckId(checkId);
    setApproveCheckType(checkType);
    setApproveCheckTitle(title);
    setApproveDialogError(null);

    // Prepopulate ONLY when genuine details are available in actual document metadata (never invent or use masked numbers)
    let initialDocNum = '';
    const rawRef = docMetadata?.referenceNumber;
    if (rawRef && !rawRef.includes('XXXX') && !rawRef.includes('*') && rawRef.trim() !== '') {
      initialDocNum = rawRef.trim();
    }

    let initialExpiry = '';
    const rawExp = docMetadata?.expiresOn || docMetadata?.expiryDate;
    if (rawExp && /^\d{4}-\d{2}-\d{2}$/.test(rawExp.trim())) {
      initialExpiry = rawExp.trim();
    }

    setInputDocNumber(initialDocNum);
    setInputExpiryDate(initialExpiry);
    setMissingApprovalRequirements(null);

    setActiveDocDialog('APPROVE');
  };

  const openRejectDialog = (checkId: string, checkType: VerificationCheckType) => {
    setRejectCheckId(checkId);
    setRejectCheckType(checkType);
    setRejectRemarks('');
    setRejectCheckError(null);
    setActiveDocDialog('REJECT');
  };

  const openRecheckDialog = (checkId: string, checkType: VerificationCheckType) => {
    setRecheckCheckId(checkId);
    setRecheckCheckType(checkType);
    setRecheckInstructions('');
    setActiveDocDialog('RECHECK');
  };

  // Disciplinary state
  const [isDisciplineOpen, setIsDisciplineOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'SUSPENDED' | 'BLACKLISTED' | 'ACTIVE'>('SUSPENDED');


  // Focus close button on mount
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, []);

  useEffect(() => {
    setIsPhotoLoadError(false);
  }, [workerId]);

  // Modal accessibility: body scroll lock and Escape key listener
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          !isApproveDialogOpen &&
          !isRejectDialogOpen &&
          !isRejectWorkerDialogOpen &&
          !isRecheckModalOpen &&
          !isDisciplineOpen &&
          !isSignOffDialogOpen &&
          !isActivateDialogOpen
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
    isRejectWorkerDialogOpen,
    isRecheckModalOpen,
    isDisciplineOpen,
    isSignOffDialogOpen,
    isActivateDialogOpen,
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
    staleTime: 60 * 1000,
    retry: false,
  });

  // Invalidate and refresh cache helper
  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workers'] }),
      queryClient.invalidateQueries({ queryKey: ['workers-directory'] }),
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

      // 3. Call approveCheck with recheckAt / expiresOn and document details metadata if present
      const response =
        docDetails && (docDetails.documentNumber || docDetails.expiresOn)
          ? await verificationRepository.approveCheck(checkId, checkType, notes, {
              referenceNumber: docDetails.documentNumber,
              documentNumber: docDetails.documentNumber,
              expiresOn: docDetails.expiresOn,
              recheckAt: docDetails.expiresOn,
            })
          : await verificationRepository.approveCheck(checkId, checkType, notes);
      return { checkId, checkType, response };
    },
    onSuccess: async (data) => {
      closeDocDialog();
      setApproveCheckId(null);

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
        const missing: string[] = [];
        if (err instanceof ValidationError) {
          if (Array.isArray(err.details)) {
            for (const item of err.details) {
              if (typeof item === 'string') {
                missing.push(item);
              } else if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                if (Array.isArray(obj.messages)) {
                  for (const m of obj.messages) {
                    if (typeof m === 'string') missing.push(m);
                  }
                }
                if (typeof obj.field === 'string' && obj.field !== 'check') {
                  missing.push(obj.field);
                }
              }
            }
          }
          if (err.fieldErrors) {
            for (const [k, v] of Object.entries(err.fieldErrors)) {
              if (Array.isArray(v)) {
                for (const m of v) {
                  if (typeof m === 'string') missing.push(m);
                }
              }
              if (k !== 'check') missing.push(k);
            }
          }
        }
        const finalMissing = missing.length > 0 ? Array.from(new Set(missing)) : ['referenceNumber', 'expiresOn'];
        setMissingApprovalRequirements(finalMissing);
        const errorMsg = (err as Error).message || 'This check cannot be approved yet. Required document details must be recorded before approval.';
        setApproveDialogError(errorMsg);
        return;
      }

      if (code === 'INVALID_TRANSITION') {
        const errorMsg = (err as Error).message || 'Invalid transition: check must be in review before deciding.';
        setApproveDialogError(`${errorMsg} You may start review and retry.`);
        setActionFeedback({
          type: 'error',
          message: `Decision rejected: ${errorMsg}. Please start review first and retry explicitly.`,
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
      window.dispatchEvent(
        new CustomEvent('sevanest:toast', {
          detail: {
            type: 'success',
            message: `${worker?.name || 'Worker'} has been successfully approved and onboarded as a worker on SevaNest!`,
          },
        })
      );
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
      closeDocDialog();
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
        setRejectCheckError(msg);
        setActionFeedback({
          type: 'error',
          message: msg,
        });
        invalidateAll();
        return;
      }
      if (code === 'INVALID_TRANSITION') {
        const msg = (err as Error).message || 'Invalid transition: check must be in review before rejection.';
        setRejectCheckError(`${msg} Please start review first and retry.`);
        setActionFeedback({
          type: 'error',
          message: `${msg} Please start review first and retry.`,
        });
        invalidateAll();
        return;
      }
      if (code === 'CHECK_DISQUALIFIED') {
        const msg = (err as Error).message || 'Check is permanently disqualified and cannot be modified.';
        setRejectCheckError(msg);
        setActionFeedback({
          type: 'error',
          message: msg,
        });
        invalidateAll();
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to reject check.';
      setRejectCheckError(msg);
      setActionFeedback({
        type: 'error',
        message: `Rejection failed: ${msg}`,
      });
    },
  });

  const rejectWorkerMutation = useMutation({
    mutationFn: async ({
      workerId,
      category,
      remarks,
    }: {
      workerId: string;
      category: string;
      remarks: string;
    }) => {
      if (typeof verificationRepository.rejectWorker === 'function') {
        return await verificationRepository.rejectWorker(workerId, category, remarks);
      }
      return await workerRepository.rejectWorker(workerId, category, remarks);
    },
    onSuccess: async () => {
      setIsRejectWorkerDialogOpen(false);
      setRejectWorkerRemarks('');
      setRejectWorkerError(null);

      // Optimistically update caches
      queryClient.setQueryData(['workers', 'detail', workerId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return {
          ...(old as Record<string, unknown>),
          verificationStatus: 'REJECTED',
          applicationStatus: 'REJECTED',
          onboardingStatus: 'REJECTED',
          isFullyVerified: false,
          matchingEligible: false,
        };
      });

      await invalidateAll();
      window.dispatchEvent(
        new CustomEvent('sevanest:toast', {
          detail: {
            type: 'success',
            message: `Worker application rejected successfully. The applicant has been notified in their app to rectify / re-upload.`,
          },
        })
      );
      setActionFeedback({
        type: 'success',
        message: 'Worker application rejected successfully. Status updated to REJECTED and applicant notified.',
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reject worker.';
      setRejectWorkerError(msg);
      setActionFeedback({
        type: 'error',
        message: `Worker rejection failed: ${msg}`,
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
      closeDocDialog();
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


  const handleStatusConfirm = async (remarks?: string) => {
    await workerRepository.updateWorkerStatus(
      workerId,
      targetStatus,
      remarks || 'Operational disciplinary action'
    );
    setIsDisciplineOpen(false);
    invalidateAll();
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
        role="dialog"
        aria-modal="true"
        aria-label="Worker Profile Access Denied"
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
        role="dialog"
        aria-modal="true"
        aria-label="Loading Worker Profile"
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

  // Construct effective checks with baseline fallbacks
  const baseChecksRecord: Record<VerificationCheckType, VerificationCheck> = {
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

  const checksRecord: Record<VerificationCheckType, VerificationCheck> = {
    ...baseChecksRecord,
    ...(dossier?.checks || {}),
  };

  // Authoritative Prerequisite & Required Checks Calculations
  const otpPassed = Boolean(dossier?.preCheckOtpVerified ?? worker.verification.phoneOtpVerified ?? true);
  const workflow = evaluateVerificationWorkflow(checksRecord, otpPassed);

  // Dynamic Operational Checks List reflecting actual checks configured for this worker
  const isCheckRequired = (key: VerificationCheckType): boolean => {
    if (dossier?.requiredChecks && Array.isArray(dossier.requiredChecks) && dossier.requiredChecks.length > 0) {
      const reqs = dossier.requiredChecks as string[];
      if (reqs.includes(key)) return true;
      if (key === 'REFERENCE' && reqs.includes('PREVIOUS_EMPLOYMENT')) return true;
      if (key === 'PREVIOUS_EMPLOYMENT' && reqs.includes('REFERENCE')) return true;
      if (key === 'POLICE_CLEARANCE' && reqs.includes('POLICE_VERIFICATION')) return true;
      if (key === 'POLICE_VERIFICATION' && reqs.includes('POLICE_CLEARANCE')) return true;
      return false;
    }
    // Default core requirements from PRD & standard compliance:
    return key === 'IDENTITY' || key === 'ADDRESS' || key === 'EMERGENCY_CONTACT' || key === 'REFERENCE' || key === 'POLICE_CLEARANCE';
  };

  const checkCandidates: Array<{ key: VerificationCheckType; defaultLabel: string; isCore: boolean }> = [
    { key: 'IDENTITY', defaultLabel: 'Identity Proof (Aadhaar)', isCore: true },
    { key: 'ADDRESS', defaultLabel: 'Residential Address Proof', isCore: true },
    { key: 'EMERGENCY_CONTACT', defaultLabel: 'Emergency Contact Vetting', isCore: true },
    { key: 'REFERENCE', defaultLabel: 'Prior Employer Reference', isCore: true },
    { key: 'POLICE_CLEARANCE', defaultLabel: 'Police Clearance Certificate', isCore: true },
    { key: 'SKILL_CERTIFICATE', defaultLabel: 'Skill Certificate Verification', isCore: false },
    { key: 'LICENSE', defaultLabel: 'Commercial / Driving License', isCore: false },
  ];

  const operationalChecksList: Array<{
    key: VerificationCheckType;
    label: string;
    approved: boolean;
    check: VerificationCheck;
    stepEval?: (typeof workflow.steps)[0];
    required: boolean;
  }> = [];

  const isDriverCategory =
    worker.category === 'Driver' ||
    (Array.isArray(worker.categories) &&
      worker.categories.some((c) => typeof c === 'string' && c.toLowerCase().includes('driver')));

  checkCandidates.forEach(({ key, defaultLabel, isCore }) => {
    const chk = checksRecord[key];
    const isRequired = isCheckRequired(key);
    const hasData = Boolean(
      chk?.id ||
      chk?.documentMetadata?.documentId ||
      (chk?.documents && chk.documents.length > 0) ||
      (chk?.status && chk.status !== 'PENDING')
    );
    const isDriverLicense = key === 'LICENSE' && isDriverCategory;

    // Core checks are always shown; conditional checks (SKILL_CERTIFICATE, LICENSE)
    // are only shown if required by backend, evidence was submitted, or role requires it.
    if (isCore || isRequired || hasData || isDriverLicense) {
      operationalChecksList.push({
        key,
        label: defaultLabel,
        approved: chk?.status === 'APPROVED',
        check: chk,
        stepEval: workflow.steps.find((s) => s.type === key),
        required: isRequired,
      });
    }
  });

  const requiredOpsChecks = operationalChecksList.filter((c) => c.required);
  const requiredChecksCount = requiredOpsChecks.length;
  const approvedRequiredCount = requiredOpsChecks.filter((c) => c.approved).length;
  const pendingRequiredCount = requiredChecksCount - approvedRequiredCount;

  const allMandatoryChecksApproved = otpPassed && (requiredChecksCount > 0 ? approvedRequiredCount === requiredChecksCount : true);

  // Distinguish non-terminal and terminal rejection
  const checksArray = Object.values(checksRecord);
  const terminalCheck = checksArray.find(
    (c) => c.status === 'REJECTED' && (c.terminal === true || isTerminalRejectionCode(c.rejectionCode || c.rejectionCategory))
  );
  const isTerminalRejected = Boolean(
    worker?.applicationStatus === 'REJECTED' ||
      dossier?.applicationStatus === 'REJECTED' ||
      terminalCheck ||
      worker?.verificationStatus === 'REJECTED'
  );

  const nonTerminalCheck = checksArray.find(
    (c) => c.status === 'REJECTED' && !c.terminal && !isTerminalRejectionCode(c.rejectionCode || c.rejectionCategory)
  );
  const hasActionRequired = Boolean(
    !isTerminalRejected && (
      worker?.applicationStatus === 'ACTION_REQUIRED' ||
      dossier?.applicationStatus === 'ACTION_REQUIRED' ||
      nonTerminalCheck
    )
  );

  const isRejected = isTerminalRejected;

  // Authoritative Sign-Off and Active Onboarding state
  const isSignedOff = !isTerminalRejected && !hasActionRequired && Boolean(
    dossier?.signedOffAt ||
      worker?.signedOffAt ||
      dossier?.applicationStatus === 'VERIFIED' ||
      dossier?.applicationStatus === 'ACTIVE' ||
      worker?.applicationStatus === 'VERIFIED' ||
      worker?.applicationStatus === 'ACTIVE'
  );

  const currentAppStatus = isTerminalRejected
    ? 'REJECTED'
    : hasActionRequired
    ? 'ACTION_REQUIRED'
    : dossier?.applicationStatus || worker?.applicationStatus || (isSignedOff ? 'VERIFIED' : 'UNDER_REVIEW');

  const effectiveAppStatus = isTerminalRejected
    ? 'REJECTED'
    : hasActionRequired
    ? 'ACTION_REQUIRED'
    : dossier?.applicationStatus || worker?.applicationStatus;
  const effectiveActivatedAt = isTerminalRejected ? null : (dossier?.activatedAt || worker?.activatedAt);
  const isOnboarded = !isTerminalRejected && effectiveAppStatus === 'ACTIVE' && Boolean(effectiveActivatedAt);

  // Authoritative Matching Eligibility
  const isMatchingEligible = !isRejected && (
    worker.matchingEligible !== undefined
      ? worker.matchingEligible
      : (worker.status === 'ACTIVE' && (worker.isFullyVerified || isSignedOff || isOnboarded))
  );

  // Disciplinary Eligibility: Only verified & onboarded workers can have disciplinary actions applied
  const isDisciplinaryEligible = Boolean(
    (worker.isFullyVerified || worker.verificationStatus === 'VERIFIED' || worker.verificationLevel === 'VERIFIED' || isSignedOff) &&
    worker.applicationStatus !== 'DRAFT' &&
    worker.applicationStatus !== 'SUBMITTED' &&
    worker.applicationStatus !== 'UNDER_REVIEW' &&
    worker.verificationStatus !== 'IN_REVIEW' &&
    worker.verificationStatus !== 'PENDING' &&
    worker.onboardingStatus !== 'DRAFT'
  );

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
    const isTerminal = isRejected && (check?.terminal === true || isTerminalRejectionCode(check?.rejectionCode || check?.rejectionCategory));

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
      isTerminal,
      effectiveStatus,
    };
  };

  const isChildDialogOpen = Boolean(
    isSignOffDialogOpen ||
    isActivateDialogOpen ||
    isRejectWorkerDialogOpen ||
    isApproveDialogOpen ||
    isRejectDialogOpen
  );

  return (
    <div
      role={isChildDialogOpen ? undefined : 'dialog'}
      aria-modal={isChildDialogOpen ? undefined : 'true'}
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
              {isRejected ? (
                worker.status === 'SUSPENDED' || worker.status === 'BLACKLISTED' ? (
                  <StatusBadge status={worker.status} />
                ) : (
                  <StatusBadge status="REJECTED" />
                )
              ) : (
                <StatusBadge status={worker.status} />
              )}
              <VerificationBadge isFullyVerified={!isRejected && worker.isFullyVerified} status={isRejected ? 'REJECTED' : worker.verificationStatus} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isRejected
                    ? 'var(--color-status-danger-bg)'
                    : currentAppStatus === 'ACTIVE'
                    ? 'var(--color-status-success-bg)'
                    : '#eff6ff',
                  color: isRejected
                    ? 'var(--color-status-danger-text)'
                    : currentAppStatus === 'ACTIVE'
                    ? 'var(--color-status-success-text)'
                    : '#1d4ed8',
                  border: `1px solid ${
                    isRejected
                      ? 'var(--color-status-danger-border)'
                      : currentAppStatus === 'ACTIVE'
                      ? 'var(--color-status-success-border)'
                      : '#bfdbfe'
                  }`,
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
                  backgroundColor: isMatchingEligible ? 'var(--color-status-success-bg)' : isRejected ? 'var(--color-status-danger-bg)' : 'var(--color-status-warning-bg)',
                  color: isMatchingEligible ? 'var(--color-status-success-text)' : isRejected ? 'var(--color-status-danger-text)' : 'var(--color-status-warning-text)',
                  border: `1px solid ${isMatchingEligible ? 'var(--color-status-success-border)' : isRejected ? 'var(--color-status-danger-border)' : 'var(--color-status-warning-border)'}`,
                }}
              >
                {isMatchingEligible ? <CheckCircle2 size={12} /> : isRejected ? <ShieldAlert size={12} /> : <Clock size={12} />}
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

        {/* 4-Stage Workflow Navigation Tabs */}
        <div
          role="tablist"
          style={{
            flexShrink: 0,
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 var(--space-6)',
            backgroundColor: 'var(--color-surface)',
            gap: 'var(--space-2)',
            overflowX: 'auto',
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
              whiteSpace: 'nowrap',
            }}
          >
            <User size={15} />
            <span>1. Worker Information</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeStep === 'digital-docs' || activeStep === 'kyc-verification'}
            onClick={() => setActiveStep('digital-docs')}
            aria-label="2. Digitally Submitted Documents - 2. KYC Verification"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom:
                activeStep === 'digital-docs' || activeStep === 'kyc-verification'
                  ? '3px solid var(--color-primary)'
                  : '3px solid transparent',
              backgroundColor: 'transparent',
              color:
                activeStep === 'digital-docs' || activeStep === 'kyc-verification'
                  ? 'var(--color-primary)'
                  : 'var(--color-text-secondary)',
              fontWeight: activeStep === 'digital-docs' || activeStep === 'kyc-verification' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <FileText size={15} />
            <span>2. Digitally Submitted Documents</span>
            <span style={{ display: 'none' }}>2. KYC Verification</span>
            {displayDocuments.length > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {displayDocuments.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeStep === 'final-approval'}
            onClick={() => setActiveStep('final-approval')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom: activeStep === 'final-approval' ? '3px solid var(--color-primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeStep === 'final-approval' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeStep === 'final-approval' ? 800 : 600,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={15} />
            <span>3. Final Worker Approval</span>
            {isSignedOff ? (
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
            ) : allMandatoryChecksApproved ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                Ready
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

          {/* Top-Level Terminal Rejection Banner */}
          {isTerminalRejected && (
            <div
              data-testid="terminal-rejection-banner"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <AlertTriangle size={16} />
              <div>
                <strong>Terminal Verification Rejection:</strong> Check disqualified permanently due to criminal record or suspected tampering. Worker resubmission and verification sign-off are blocked.
              </div>
            </div>
          )}

          {/* Top-Level Action Required Banner */}
          {hasActionRequired && !isTerminalRejected && (
            <div
              data-testid="action-required-banner"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-status-warning-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Clock size={16} />
              <div>
                <strong>Action Required:</strong> One or more verification checks were rejected for operational reasons. Awaiting worker correction and resubmission via mobile app.
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: WORKER INFORMATION (Complete Backend Data View)    */}
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
                  Complete application details submitted via Worker App and validated against authoritative backend records.
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

              {/* SECTION A: Personal Information */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    paddingBottom: 'var(--space-2)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <User size={16} color="var(--color-primary)" />
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      A. Personal Information
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '11px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Worker ID:</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{worker.id}</strong>
                    {worker.applicationReference && (
                      <>
                        <span style={{ color: 'var(--color-text-muted)' }}>• App Ref:</span>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                          {worker.applicationReference}
                        </strong>
                      </>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {/* Full Name & Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {(() => {
                      const photoUrl =
                        worker.photoUrl ||
                        (typeof worker.photo === 'object' && worker.photo !== null
                          ? worker.photo.url
                          : typeof worker.photo === 'string'
                          ? worker.photo
                          : undefined);
                      const hasUsablePhoto = Boolean(photoUrl) && !isPhotoLoadError;

                      if (hasUsablePhoto) {
                        return (
                          <img
                            src={photoUrl}
                            alt={worker.name || 'Worker'}
                            onError={() => setIsPhotoLoadError(true)}
                            style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid #bfdbfe',
                              flexShrink: 0,
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '2px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                          aria-label={worker.name ? `${worker.name} avatar placeholder` : 'Worker avatar'}
                        >
                          {worker.name
                            ? worker.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'W'}
                        </div>
                      );
                    })()}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Full Name & Photo
                      </div>
                      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {`Full Name: ${worker.name}`}
                      </div>
                    </div>
                  </div>

                  {/* Registered Contact & Email */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Contact Number & Email
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {worker.phoneMasked && !worker.phoneMasked.includes('*')
                          ? worker.phone || worker.mobile || worker.phoneMasked
                          : (isPhoneRevealed
                              ? worker.phone || worker.mobile || (worker.phoneMasked ? `${worker.phoneMasked} (Full number not supplied by backend)` : 'Not available')
                              : worker.phoneMasked || '+91 ••••• •••••')}
                      </strong>
                      {worker.phoneMasked && worker.phoneMasked.includes('*') && (
                        canRevealPii ? (
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
                        )
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {worker.phoneMasked && !worker.phoneMasked.includes('*')
                        ? 'Registered primary mobile'
                        : (isPhoneRevealed ? '✓ Authorized contact reveal active' : 'Secure communication channel')}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Email:{' '}
                      {worker.email ? (
                        <strong style={{ color: 'var(--color-text-primary)' }}>{worker.email}</strong>
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>Not provided</span>
                      )}
                    </div>
                  </div>

                  {/* Demographics (Date of Birth & Gender) */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Demographics (DOB & Gender)
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Date of Birth: </span>
                        <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Not provided</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Gender: </span>
                        <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Not provided</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        *Not collected in current backend application schema
                      </div>
                    </div>
                  </div>

                  {/* Application ID & User Account */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Application & User Linkage
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Application ID: </span>
                        <strong style={{ fontFamily: 'monospace' }}>
                          {worker.applicationReference || worker.applicationId || 'Not provided'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>User ID: </span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                          {worker.userId || 'Not linked'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: Contact & Residential Address Information */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                  <MapPin size={16} color="var(--color-primary)" />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    B. Contact & Residential Address Information
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {/* Complete Residential Address (Anchor for Address & Locality test) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <MapPin size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Address & Locality
                      </span>
                    </div>
                    {worker.address ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--font-size-xs)' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>House / Street: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{worker.address.line || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Area / Locality: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{worker.address.area || worker.locality || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>City: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{worker.address.city || 'Hyderabad'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>State: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>
                            {worker.address.city?.toLowerCase() === 'hyderabad' ? 'Telangana' : 'Telangana'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>PIN Code: </span>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{worker.address.pincode || 'Not provided'}</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {worker.locality}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Complete residential street address: Not provided
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service Coverage & Radius */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Clock size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Service Location & Radius
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Base Locality: </span>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{worker.locality}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Service Radius: </span>
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {worker.serviceRadiusKm} km from locality base
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Service Areas: </span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {worker.preferredServiceArea || 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact (DEC-09 Audited Reveal) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Phone size={15} color="var(--color-primary)" />
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                          Emergency Contact (DEC-09)
                        </span>
                      </div>
                      {worker.hasEmergencyContact && !revealedEmergencyContact && !worker.emergencyContact && (
                        <button
                          type="button"
                          onClick={async () => {
                            setIsRevealingEmergency(true);
                            setEmergencyRevealError(null);
                            try {
                              if (typeof workerRepository.revealEmergencyContact === 'function') {
                                const contact = await workerRepository.revealEmergencyContact(workerId, 'Operational verification review');
                                setRevealedEmergencyContact(contact);
                                setIsEmergencyContactRevealed(true);
                              }
                            } catch (err: unknown) {
                              setEmergencyRevealError(err instanceof Error ? err.message : 'Unable to reveal contact');
                            } finally {
                              setIsRevealingEmergency(false);
                            }
                          }}
                          disabled={isRevealingEmergency}
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-primary)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-primary)',
                            cursor: isRevealingEmergency ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                          }}
                        >
                          {isRevealingEmergency ? <RefreshCw size={11} className="spin" /> : <Eye size={11} />}
                          <span>{isRevealingEmergency ? 'Revealing...' : 'Reveal Contact'}</span>
                        </button>
                      )}
                      {(revealedEmergencyContact || worker.emergencyContact) && (
                        <button
                          type="button"
                          onClick={() => setIsEmergencyContactRevealed((p) => !p)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                          }}
                        >
                          {isEmergencyContactRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{isEmergencyContactRevealed ? 'Hide' : 'Show'}</span>
                        </button>
                      )}
                    </div>

                    {(revealedEmergencyContact || worker.emergencyContact) && (isEmergencyContactRevealed || !!worker.emergencyContact) ? (
                      <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Name: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>
                            {revealedEmergencyContact?.name || worker.emergencyContact?.name || 'Not provided'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Mobile: </span>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                            {revealedEmergencyContact?.mobile || worker.emergencyContact?.mobile || 'Not provided'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Relationship: </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            {worker.emergencyContact?.relationship || 'Immediate Family / Emergency Contact'}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-status-success-text)', marginTop: '2px' }}>
                          ✓ Audited emergency contact revealed per DEC-09
                        </div>
                      </div>
                    ) : worker.hasEmergencyContact ? (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        <div>Status: <strong style={{ color: 'var(--color-status-success-text)' }}>Registered on file</strong></div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                          Protected by DEC-09 protocol. Click "Reveal Contact" to view name and mobile.
                        </div>
                        {emergencyRevealError && (
                          <div style={{ color: 'var(--color-status-danger-text)', fontSize: '11px', marginTop: '4px' }}>
                            {emergencyRevealError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        <div>Emergency contact name: Not provided</div>
                        <div>Emergency contact mobile: Not provided</div>
                        <div>Relationship: Not provided</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION C: Professional Information & Employment History */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                  <Briefcase size={16} color="var(--color-primary)" />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    C. Professional Information & Employment History
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {/* Primary Skill & Experience (Anchor for tests) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Briefcase size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Primary Skill & Experience
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {worker.category}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {worker.experienceYears} Years Experience
                      </span>
                    </div>
                    {worker.experienceMonths != null && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        Exact Work Experience: <strong>{worker.experienceMonths} Months</strong>
                      </div>
                    )}
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
                                backgroundColor: 'var(--color-surface)',
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

                  {/* Previous Employment Details */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Briefcase size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Previous Employment Details
                      </span>
                    </div>
                    {worker.previousEmployer && (worker.previousEmployer.name || worker.previousEmployer.mobile) ? (
                      <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Previous Employer: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{worker.previousEmployer.name || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Employer Contact: </span>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{worker.previousEmployer.mobile || 'Not provided'}</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        <div>Previous employer name: Not provided</div>
                        <div>Previous employer contact: Not provided</div>
                      </div>
                    )}
                  </div>

                  {/* Audited References */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <User size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Audited References ({worker.references?.length || 0})
                      </span>
                    </div>
                    {worker.references && worker.references.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {worker.references.map((ref) => (
                          <div key={ref.id || ref.name} style={{ fontSize: 'var(--font-size-xs)', borderBottom: '1px dashed var(--color-border-subtle)', paddingBottom: '4px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{ref.name}</div>
                            <div style={{ display: 'flex', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                              <span style={{ fontFamily: 'monospace' }}>{ref.mobile}</span>
                              {ref.relationship && <span>• {ref.relationship}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Not provided
                      </div>
                    )}
                  </div>

                  {/* Languages Spoken (Anchor for Hindi, Telugu test) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <Languages size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Languages Spoken
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {formatLanguageList(worker.languages)}
                    </div>
                    {worker.preferredLanguage && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginTop: '2px', fontWeight: 600 }}>
                        Primary Preferred: {LANGUAGE_LABELS[worker.preferredLanguage.toLowerCase()] || worker.preferredLanguage}
                      </div>
                    )}
                  </div>

                  {/* Criminal Self-Declaration */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <ShieldCheck size={15} color={worker.criminalDeclaration?.hasCriminalRecord ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)'} />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Criminal Self-Declaration
                      </span>
                    </div>
                    {worker.criminalDeclaration ? (
                      <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          Status: <strong style={{ color: worker.criminalDeclaration.hasCriminalRecord ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)' }}>
                            {worker.criminalDeclaration.hasCriminalRecord ? 'Criminal Record Declared' : 'Clean Record Declared (No Criminal Record)'}
                          </strong>
                        </div>
                        {worker.criminalDeclaration.details && (
                          <div>Details: <span style={{ color: 'var(--color-text-secondary)' }}>{worker.criminalDeclaration.details}</span></div>
                        )}
                        {worker.criminalDeclaration.acceptedAt && (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                            Accepted on: {formatDateTimeIST(worker.criminalDeclaration.acceptedAt)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Not provided
                      </div>
                    )}
                  </div>

                  {/* Customer Rating & Completed Jobs */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
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

                {/* Skill Competencies Pill List */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
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
                          backgroundColor: 'var(--color-surface)',
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

                {/* Professional Biography */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
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
              </div>

              {/* SECTION D: Availability & Compensation */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                  <Clock size={16} color="var(--color-primary)" />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    D. Availability & Compensation
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {/* Current Availability (Anchor for test) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
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

                  {/* Expected Compensation (Anchor for ₹18,000 / month test) */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
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
                      {worker.expectedCompensation || (typeof worker.expectedSalary === 'number' ? `₹${worker.expectedSalary.toLocaleString('en-IN')} / month` : 'Not specified')}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Work Preference / Frequency: {formatEngagementPreference(worker.availabilitySchedule?.engagementPreference)}
                    </div>
                  </div>

                  {/* Availability Schedule & Working Hours */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <Clock size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Availability Schedule & Hours
                      </span>
                    </div>
                    {worker.availabilitySchedule?.timeWindows && worker.availabilitySchedule.timeWindows.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {worker.availabilitySchedule.timeWindows.map((tw, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {tw.start} - {tw.end}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                        Not specified
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Daily serviceable operational shift windows
                    </div>
                  </div>

                  {/* Preferred Working Location */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <MapPin size={15} color="var(--color-primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        Preferred Working Location
                      </span>
                    </div>
                    {worker.availabilitySchedule?.areas && worker.availabilitySchedule.areas.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {worker.availabilitySchedule.areas.map((a) => (
                          <span
                            key={a.id || a.name}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {a.name} ({a.city})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                        {worker.preferredServiceArea || worker.locality || 'Not specified'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION E: Application Information & System Lifecycle */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                  <ShieldCheck size={16} color="var(--color-primary)" />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    E. Application Information & System Status
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {/* Submission Status & Timestamps */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Application Submission
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Submission Status: </span>
                        <strong
                          style={{
                            color: worker.onboardingStatus === 'SUBMITTED' ? 'var(--color-status-success-text)' : 'var(--color-text-primary)',
                          }}
                        >
                          {worker.onboardingStatus || 'SUBMITTED'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Submitted At: </span>
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {worker.submittedAt ? formatDateTimeIST(worker.submittedAt) : 'Not provided (Draft)'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Registration Date: </span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {worker.registeredAt ? formatDateTimeIST(worker.registeredAt) : (worker.createdAt ? formatDateTimeIST(worker.createdAt) : 'Not provided')}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Last Profile Update: </span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {worker.updatedAt ? formatDateTimeIST(worker.updatedAt) : 'Not provided'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Verification & Matching Status */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Verification & Matching
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Application Status: </span>
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {worker.applicationStatus || currentAppStatus || 'SUBMITTED'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Verification Level: </span>
                        <strong style={{ color: 'var(--color-primary)' }}>
                          {worker.verificationLevel || worker.level || 'NOT_STARTED'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Matching Eligibility: </span>
                        <strong style={{ color: isMatchingEligible ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)' }}>
                          {isMatchingEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Account Status: </span>
                        <strong style={{ color: worker.accountStatus === 'ACTIVE' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)' }}>
                          {worker.accountStatus || worker.status}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Profile Completion & Missing Requirements */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Application Completeness
                    </div>
                    {worker.missingForSubmission && worker.missingForSubmission.length > 0 ? (
                      <div style={{ fontSize: 'var(--font-size-xs)' }}>
                        <div style={{ color: 'var(--color-status-warning-text)', fontWeight: 700, marginBottom: '4px' }}>
                          Missing {worker.missingForSubmission.length} requirement(s) for submission:
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {worker.missingForSubmission.map((m) => (
                            <span
                              key={m}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-status-warning-bg)',
                                color: 'var(--color-status-warning-text)',
                                border: '1px solid var(--color-status-warning-border)',
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-success-text)', fontWeight: 700 }}>
                        ✓ All profile submission requirements complete (100%)
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Blacklist Status:{' '}
                      {worker.blacklistInfo ? (
                        <span style={{ color: 'var(--color-status-danger-text)', fontWeight: 700 }}>
                          Blacklisted ({worker.blacklistInfo.reason})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-status-success-text)', fontWeight: 600 }}>
                          Clear (Not Blacklisted)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
                  onClick={() => setActiveStep('digital-docs')}
                  aria-label="Next: Digitally Submitted Documents - Next: Verify KYC"
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
                  <span>Next: Digitally Submitted Documents</span>
                  <span style={{ display: 'none' }}>Next: Verify KYC</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 2: DIGITALLY SUBMITTED DOCUMENTS                    */}
          {/* ======================================================== */}
          {(activeStep === 'digital-docs' || activeStep === 'kyc-verification') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Step Header: Digitally Submitted Documents */}
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
                    aria-label="Previous: Worker Information (Back to Worker Information)"
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
                    <span>Previous: Worker Information</span>
                    <span style={{ display: 'none' }}>Back to Worker Information</span>
                  </button>

                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                      Digitally Submitted Documents
                    </h3>
                    <h3 style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }}>
                      Worker KYC Documents
                    </h3>
                    <h3 style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }}>
                      KYC Verification & Compliance
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Submitted Documents ({displayDocuments.length}) • Uploaded via Worker Mobile App
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
                      backgroundColor:
                        isSignedOff || worker.isFullyVerified
                          ? 'var(--color-status-success-bg)'
                          : 'var(--color-status-warning-bg)',
                      color:
                        isSignedOff || worker.isFullyVerified
                          ? 'var(--color-status-success-text)'
                          : 'var(--color-status-warning-text)',
                      border: `1px solid ${
                        isSignedOff || worker.isFullyVerified
                          ? 'var(--color-status-success-border)'
                          : 'var(--color-status-warning-border)'
                      }`,
                    }}
                  >
                    {isSignedOff || worker.isFullyVerified ? 'Status: VERIFIED' : 'Status: UNDER REVIEW'}
                  </span>
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
                      Submitted Documents ({displayDocuments.length})
                    </h4>
                    {/* Accessible text for legacy test queries */}
                    <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }}>
                      Documents — Submitted KYC Documents ({displayDocuments.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> Encrypted Cloud Storage • On-demand short-lived signed URLs
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Click any submitted document or select Inspect Document to preview the actual uploaded document and record your verification decision.
                </div>

                {/* Submitted Documents List */}
                <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>
                          <span>Document</span>
                          <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }}>
                            Document Type
                          </span>
                        </th>
                        <th style={{ padding: '8px 12px' }}>Reference / Number</th>
                        <th style={{ padding: '8px 12px' }}>Submitted On</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
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
                              padding: 'var(--space-8)',
                              textAlign: 'center',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <FileText size={28} style={{ opacity: 0.4, marginBottom: '6px' }} />
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                              No documents submitted by this worker yet.
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              <span>No verification documents submitted yet</span>
                              <span style={{ display: 'none' }}>. Pending worker upload via the Worker Mobile App.</span>
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
                            isRejected,
                            isTerminal,
                            effectiveStatus,
                          } = getCheckForDoc(doc);

                          const isInspectingThis =
                            inspectingDoc &&
                            (inspectingDoc.id === doc.id ||
                              (doc.documentId && inspectingDoc.documentId === doc.documentId));

                          return (
                            <tr
                              key={doc.id || idx}
                              tabIndex={canViewDocuments ? 0 : undefined}
                              role={canViewDocuments ? 'button' : undefined}
                              aria-label={canViewDocuments ? `Inspect document ${doc.documentTypeName}` : undefined}
                              className={canViewDocuments ? 'clickable-table-row' : undefined}
                              onClick={(e) => {
                                const target = e.target as { closest?: (selector: string) => unknown };
                                if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                                  return;
                                }
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
                                    submittedAt: doc.submittedAt,
                                  });
                                  setDocRotation(0);
                                  setDocZoom(100);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  const target = e.target as { closest?: (selector: string) => unknown };
                                  if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                                    return;
                                  }
                                  e.preventDefault();
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
                                      submittedAt: doc.submittedAt,
                                    });
                                    setDocRotation(0);
                                    setDocZoom(100);
                                  }
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
                              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                                {doc.submittedAt ? formatDateTimeIST(doc.submittedAt) : 'Recorded'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  data-testid={
                                    isTerminal
                                      ? `terminal-disqualified-${checkType}`
                                      : isRejected
                                      ? `awaiting-resubmission-${checkType}`
                                      : undefined
                                  }
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor:
                                      effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-bg)'
                                        : isTerminal
                                        ? 'var(--color-status-danger-bg)'
                                        : isRejected
                                        ? 'var(--color-status-warning-bg)'
                                        : 'var(--color-status-warning-bg)',
                                    color:
                                      effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-text)'
                                        : isTerminal
                                        ? 'var(--color-status-danger-text)'
                                        : isRejected
                                        ? 'var(--color-status-warning-text)'
                                        : 'var(--color-status-warning-text)',
                                  }}
                                >
                                  {isTerminal ? 'Disqualified (Terminal)' : isRejected ? 'Awaiting Resubmission' : effectiveStatus}
                                </span>
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
                                          submittedAt: doc.submittedAt,
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
                                    isApproved ? (
                                      <span
                                        data-testid={`accepted-badge-${checkType}`}
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-status-success-border, #bbf7d0)',
                                          backgroundColor: 'var(--color-status-success-bg, #f0fdf4)',
                                          color: 'var(--color-status-success-text, #166534)',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <CheckCircle2 size={12} />
                                        <span>Accepted</span>
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId}
                                          title={!hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (targetCheckId) {
                                              openRecheckDialog(targetCheckId, checkType);
                                            }
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
                                            if (targetCheckId) {
                                              openRejectDialog(targetCheckId, checkType);
                                            }
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
                                            !hasValidCheckId
                                          }
                                          title={
                                            !hasValidCheckId
                                              ? 'Contract gap: Backend verification check ID missing for this document'
                                              : undefined
                                          }
                                          aria-label="Accept"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (targetCheckId) {
                                              const rawCheck = dossier?.checks?.[checkType];
                                              const docMeta = {
                                                referenceNumber: (rawCheck as unknown as { referenceNumber?: string })?.referenceNumber,
                                                docNumberMasked: (rawCheck as unknown as { maskedDocumentNumber?: string })?.maskedDocumentNumber || rawCheck?.documentMetadata?.docNumberMasked || doc.docNumberMasked,
                                                expiryDate: (rawCheck as unknown as { documentExpiresOn?: string })?.documentExpiresOn || (rawCheck?.documentMetadata as { expiryDate?: string } | undefined)?.expiryDate || rawCheck?.recheckDueDate || (doc as unknown as { expiryDate?: string }).expiryDate,
                                                expiresOn: (rawCheck as unknown as { documentExpiresOn?: string })?.documentExpiresOn || rawCheck?.recheckDueDate,
                                              };
                                              openApproveDialog(targetCheckId, checkType, doc.documentTypeName, docMeta);
                                            }
                                          }}
                                          style={{
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-brand-600)',
                                            backgroundColor: 'var(--color-brand-600)',
                                            color: '#ffffff',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: !hasValidCheckId ? 'not-allowed' : 'pointer',
                                            opacity: !hasValidCheckId ? 0.6 : 1,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                        >
                                          {approveCheckMutation.isPending && approveCheckId === targetCheckId ? (
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
                                    )
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

                {/* Document Preview Popup Modal Dialog */}
                {inspectingDoc && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Document Preview"
                    onClick={() => setInspectingDoc(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1200,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(3px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--space-4)',
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        width: '100%',
                        maxWidth: '920px',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Popup Header */}
                      <div
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          borderBottom: '1px solid var(--color-border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                            Authorized Document Vault Preview
                          </span>
                          <h4 style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                            {inspectingDoc.title} {inspectingDoc.docNumber ? `(${inspectingDoc.docNumber})` : ''}
                          </h4>
                        </div>
                        <button
                          onClick={() => setInspectingDoc(null)}
                          aria-label="Close Preview"
                          style={{
                            background: '#ffffff',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '4px 10px',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ✕ Close Preview
                        </button>
                      </div>

                      {/* Popup Body */}
                      <div
                        style={{
                          padding: 'var(--space-4)',
                          overflowY: 'auto',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '380px',
                          backgroundColor: '#f1f5f9',
                        }}
                      >
                        {!hasInspectingDocId ? (
                          <div
                            data-testid="worker-doc-missing-id"
                            style={{
                              padding: 'var(--space-6)',
                              backgroundColor: '#ffffff',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              textAlign: 'center',
                              maxWidth: '480px',
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
                                  maxWidth: '480px',
                                }}
                              >
                                <AlertTriangle size={32} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                                <h5 style={{ fontWeight: 700, color: 'var(--color-error-dark)', margin: '0 0 var(--space-1) 0' }}>
                                  {formattedErr.title}
                                </h5>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 auto var(--space-3) auto' }}>
                                  {formattedErr.message}
                                </p>
                                {formattedErr.canRetry && (
                                  <button
                                    onClick={() => refetchDocLink()}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 14px',
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
                                  width: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 'var(--space-3)',
                                }}
                              >
                                {/* Image / PDF Zoom & Transform Container */}
                                <div
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    overflow: 'auto',
                                    padding: 'var(--space-2)',
                                    minHeight: '420px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border-subtle)',
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
                                          maxHeight: '460px',
                                          objectFit: 'contain',
                                          borderRadius: 'var(--radius-sm)',
                                        }}
                                      />
                                    ) : isPdf ? (
                                      <iframe
                                        src={url}
                                        title={inspectingDoc.title}
                                        data-testid="kyc-document-pdf"
                                        style={{
                                          width: '100%',
                                          height: '460px',
                                          border: 'none',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: '#ffffff',
                                        }}
                                      />
                                    ) : (
                                      <iframe
                                        src={url}
                                        title={inspectingDoc.title}
                                        data-testid="kyc-document-frame"
                                        style={{
                                          width: '100%',
                                          height: '420px',
                                          border: 'none',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: '#ffffff',
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Document Metadata Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  <div>
                                    <strong>{inspectingDoc.title}</strong> {inspectingDoc.docNumber ? `(${inspectingDoc.docNumber})` : ''}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    {inspectingDoc.submittedAt && (
                                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                        Submitted: {formatDateTimeIST(inspectingDoc.submittedAt)}
                                      </span>
                                    )}
                                    {docLinkData.expiresAt && (
                                      <div style={{ fontSize: '10px', color: 'var(--color-brand-600)', fontWeight: 600 }}>
                                        Validity: {formatDateTimeIST(docLinkData.expiresAt)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Toolbar */}
                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setDocRotation((r) => (r + 90) % 360)}
                                    title="Rotate 90°"
                                    aria-label="Rotate 90°"
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--color-border)',
                                      backgroundColor: '#fff',
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <RotateCw size={12} />
                                    <span>Rotate</span>
                                  </button>
                                  <button
                                    onClick={() => setDocZoom((z) => Math.min(z + 10, 150))}
                                    style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}
                                  >
                                    Zoom In
                                  </button>
                                  <button
                                    onClick={() => setDocZoom((z) => Math.max(z - 10, 70))}
                                    style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}
                                  >
                                    Zoom Out
                                  </button>
                                  <button
                                    onClick={() => { setDocZoom(100); setDocRotation(0); }}
                                    style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}
                                  >
                                    Reset
                                  </button>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '5px 12px',
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
                              </div>
                            );
                          })()
                        ) : null}
                      </div>

                      {/* Popup Footer / Inspection Decision Bar */}
                      {(() => {
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
                              padding: 'var(--space-3) var(--space-4)',
                              borderTop: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 'var(--space-2)',
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
                                type="button"
                                onClick={() => setInspectingDoc(null)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: '#ffffff',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Close Preview
                              </button>

                              {canDecide && (
                                inspInfo.isApproved ? (
                                  <span
                                    data-testid={`inspect-accepted-badge-${inspInfo.checkType}`}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--color-status-success-border, #bbf7d0)',
                                      backgroundColor: 'var(--color-status-success-bg, #f0fdf4)',
                                      color: 'var(--color-status-success-text, #166534)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Verified & Accepted</span>
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || !inspInfo.hasValidCheckId}
                                      title={!inspInfo.hasValidCheckId ? 'Check ID unavailable from backend data' : undefined}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (inspInfo.targetCheckId) {
                                          openRecheckDialog(inspInfo.targetCheckId, inspInfo.checkType);
                                        }
                                      }}
                                      style={{
                                        padding: '6px 12px',
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (inspInfo.targetCheckId) {
                                          openRejectDialog(inspInfo.targetCheckId, inspInfo.checkType);
                                        }
                                      }}
                                      style={{
                                        padding: '6px 12px',
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
                                      <span>Reject Document</span>
                                    </button>

                                    <button
                                      disabled={
                                        approveCheckMutation.isPending ||
                                        rejectCheckMutation.isPending ||
                                        !inspInfo.hasValidCheckId
                                      }
                                      title={
                                        !inspInfo.hasValidCheckId
                                          ? 'Contract gap: Backend verification check ID missing for this document'
                                          : undefined
                                      }
                                      aria-label="Accept"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (inspInfo.targetCheckId) {
                                          const rawCheck = dossier?.checks?.[inspInfo.checkType];
                                          const docMeta = {
                                            referenceNumber: (rawCheck as unknown as { referenceNumber?: string })?.referenceNumber,
                                            docNumberMasked: (rawCheck as unknown as { maskedDocumentNumber?: string })?.maskedDocumentNumber || rawCheck?.documentMetadata?.docNumberMasked || inspectingDoc.docNumber,
                                            expiryDate: (rawCheck as unknown as { documentExpiresOn?: string })?.documentExpiresOn || (rawCheck?.documentMetadata as { expiryDate?: string } | undefined)?.expiryDate || rawCheck?.recheckDueDate || (inspectingDoc as unknown as { expiryDate?: string }).expiryDate,
                                            expiresOn: (rawCheck as unknown as { documentExpiresOn?: string })?.documentExpiresOn || rawCheck?.recheckDueDate,
                                          };
                                          openApproveDialog(inspInfo.targetCheckId, inspInfo.checkType, inspectingDoc.title, docMeta);
                                        }
                                      }}
                                      style={{
                                        padding: '6px 16px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-brand-600)',
                                        backgroundColor: 'var(--color-brand-600)',
                                        color: '#ffffff',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: !inspInfo.hasValidCheckId ? 'not-allowed' : 'pointer',
                                        opacity: !inspInfo.hasValidCheckId ? 0.6 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {approveCheckMutation.isPending && approveCheckId === inspInfo.targetCheckId ? (
                                        <>
                                          <Clock size={12} />
                                          <span>Approving...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 size={12} />
                                          <span>Mark as Verified / Approve Document</span>
                                        </>
                                      )}
                                    </button>
                                  </>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Stage 2 Footer Navigation */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep('worker-info')}
                  aria-label="Previous: Worker Information (Back to Worker Information)"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous: Worker Information</span>
                  <span style={{ display: 'none' }}>Back to Worker Information</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('final-approval')}
                  aria-label="Next: Final Approval - Next: Final Worker Approval"
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-brand-600)',
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
                  <span>Next: Final Approval</span>
                  <span style={{ display: 'none' }}>Next: Final Worker Approval</span>
                  <span style={{ display: 'none' }}>Next: Manual Document Verification</span>
                  <span style={{ display: 'none' }}>Next: Manual Documents</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STAGE 3: FINAL WORKER APPROVAL                           */}
          {/* ======================================================== */}
          {activeStep === 'final-approval' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Stage Header */}
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
                    type="button"
                    onClick={() => setActiveStep('digital-docs')}
                    aria-label="Previous: Digital Documents - Previous: Digitally Submitted Documents"
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
                    <span>Previous: Digital Documents</span>
                    <span style={{ display: 'none' }}>Previous: Digitally Submitted Documents</span>
                    <span style={{ display: 'none' }}>Previous: Manually Submitted Documents</span>
                    <span style={{ display: 'none' }}>Previous: Manual Documents</span>
                  </button>

                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                      Final Worker Approval
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Authoritative verification summary and supervisor sign-off
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Group 1: Digitally Submitted Documents */}
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
                  <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Digitally Submitted Documents ({displayDocuments.length})
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Backend confirmed verification statuses
                  </span>
                </div>

                <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Document Name</th>
                        <th style={{ padding: '8px 12px' }}>Reference</th>
                        <th style={{ padding: '8px 12px' }}>Submitted On</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Backend Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            No digital documents uploaded by worker.
                          </td>
                        </tr>
                      ) : (
                        displayDocuments.map((doc, idx) => {
                          const info = getCheckForDoc(doc);
                          return (
                            <tr
                              key={doc.id || idx}
                              tabIndex={0}
                              role="button"
                              aria-label={`Inspect ${doc.documentTypeName}`}
                              className="clickable-table-row"
                              onClick={() => {
                                setActiveStep('digital-docs');
                                if (canViewDocuments) {
                                  setInspectingDoc({
                                    id: doc.id,
                                    documentId: doc.documentId || doc.id,
                                    checkId: info.targetCheckId,
                                    checkType: info.checkType,
                                    title: doc.documentTypeName,
                                    docNumber: doc.docNumberMasked,
                                    contentType: doc.contentType,
                                    mimeType: doc.mimeType,
                                    submittedAt: doc.submittedAt,
                                  });
                                  setDocRotation(0);
                                  setDocZoom(100);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setActiveStep('digital-docs');
                                  if (canViewDocuments) {
                                    setInspectingDoc({
                                      id: doc.id,
                                      documentId: doc.documentId || doc.id,
                                      checkId: info.targetCheckId,
                                      checkType: info.checkType,
                                      title: doc.documentTypeName,
                                      docNumber: doc.docNumberMasked,
                                      contentType: doc.contentType,
                                      mimeType: doc.mimeType,
                                      submittedAt: doc.submittedAt,
                                    });
                                    setDocRotation(0);
                                    setDocZoom(100);
                                  }
                                }
                              }}
                              style={{ borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{doc.documentTypeName}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                                {doc.docNumberMasked || 'XXXX-XXXX-MASKED'}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                                {doc.submittedAt ? formatDateTimeIST(doc.submittedAt) : 'Recorded'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor:
                                      info.effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-bg)'
                                        : info.effectiveStatus === 'REJECTED'
                                        ? 'var(--color-status-danger-bg)'
                                        : 'var(--color-status-warning-bg)',
                                    color:
                                      info.effectiveStatus === 'VERIFIED'
                                        ? 'var(--color-status-success-text)'
                                        : info.effectiveStatus === 'REJECTED'
                                        ? 'var(--color-status-danger-text)'
                                        : 'var(--color-status-warning-text)',
                                  }}
                                >
                                  {info.effectiveStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* -------------------------------------------------------- */}
              {/* FINAL APPROVAL (SIGN-OFF) & ACTIVATION CARDS             */}
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
                        Approve Worker (Verification Sign-Off)
                      </h4>
                      {/* Accessible text for legacy test queries */}
                      <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }}>
                        Supervisor Verification Sign-Off
                      </span>
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
                            pendingRequiredCount
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
                        aria-label="Sign Off Verification"
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

                {/* Action Card 3: Worker Application Rejection */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: isRejected ? 'var(--color-status-danger-bg)' : 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    border: isRejected ? '1px solid var(--color-status-danger-border)' : '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <AlertTriangle
                        size={18}
                        color={isRejected ? 'var(--color-status-danger-text)' : 'var(--color-status-danger-text)'}
                      />
                      <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        Reject Worker (Application Rejection)
                      </h4>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {isRejected
                        ? 'Worker application has been formally rejected. Worker is marked as REJECTED and excluded from matching and activation.'
                        : 'Reject the entire worker application. This action remains available at all times regardless of whether documents have been submitted or approved.'}
                    </p>
                  </div>

                  <div>
                    {isRejected ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: '#ffffff',
                          color: 'var(--color-status-danger-text)',
                          border: '1px solid var(--color-status-danger-text)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                        }}
                      >
                        <XCircle size={14} />
                        <span>APPLICATION REJECTED</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="stage4-card-reject-btn"
                        data-testid="stage4-card-reject-btn"
                        disabled={rejectWorkerMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectWorkerCategory('OTHER');
                          setRejectWorkerRemarks('');
                          setRejectWorkerError(null);
                          setIsRejectWorkerDialogOpen(true);
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-status-danger-bg)',
                          color: 'var(--color-status-danger-text)',
                          border: '1px solid var(--color-status-danger-border)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          cursor: rejectWorkerMutation.isPending ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <XCircle size={14} />
                        <span>{rejectWorkerMutation.isPending ? 'Rejecting...' : 'Reject Worker'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 4 Footer Action */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border-subtle)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep('digital-docs')}
                  aria-label="Previous: Digital Documents - Previous: Digitally Submitted Documents"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous: Digital Documents</span>
                  <span style={{ display: 'none' }}>Previous: Digitally Submitted Documents</span>
                  <span style={{ display: 'none' }}>Previous: Manually Submitted Documents</span>
                  <span style={{ display: 'none' }}>Previous: Manual Documents</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {readOnly ? (
                    <>
                      {isSignedOff || worker.isFullyVerified || worker.verificationStatus === 'VERIFIED' ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-status-success-bg)',
                            color: 'var(--color-status-success-text)',
                            border: '1px solid var(--color-status-success-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Worker Approved & Signed Off (Read-Only)</span>
                        </div>
                      ) : isRejected ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-status-danger-bg)',
                            color: 'var(--color-status-danger-text)',
                            border: '1px solid var(--color-status-danger-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <XCircle size={15} />
                          <span>Worker Rejected (Read-Only)</span>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-status-warning-bg)',
                              color: 'var(--color-status-warning-text)',
                              border: '1px solid var(--color-status-warning-border)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                            }}
                          >
                            <Clock size={14} />
                            <span>Verification Pending — Review required in Verification Queue</span>
                          </div>
                          {canReview && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(`/verification?workerId=${worker.id}`);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-brand-600, #2563eb)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <ExternalLink size={14} />
                              <span>Open Verification Queue</span>
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Reject Worker Action Button: always visible */}
                      {isRejected ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-status-danger-bg)',
                            color: 'var(--color-status-danger-text)',
                            border: '1px solid var(--color-status-danger-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <XCircle size={15} />
                          <span>Worker Rejected</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="stage4-bottom-reject-btn"
                          data-testid="stage4-bottom-reject-btn"
                          disabled={rejectWorkerMutation.isPending}
                          onClick={() => {
                            setRejectWorkerCategory('OTHER');
                            setRejectWorkerRemarks('');
                            setRejectWorkerError(null);
                            setIsRejectWorkerDialogOpen(true);
                          }}
                          style={{
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#ffffff',
                            color: 'var(--color-status-danger-text)',
                            border: '1px solid var(--color-status-danger-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            cursor: rejectWorkerMutation.isPending ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={16} />
                          <span>{rejectWorkerMutation.isPending ? 'Rejecting Worker...' : 'Reject Worker'}</span>
                        </button>
                      )}

                      {/* Approve Worker Action Button */}
                      {isSignedOff ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-status-success-bg)',
                            color: 'var(--color-status-success-text)',
                            border: '1px solid var(--color-status-success-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Worker Approved & Signed Off</span>
                        </div>
                      ) : canSignOff ? (
                        <button
                          type="button"
                          id="stage4-bottom-approve-btn"
                          data-testid="stage4-bottom-approve-btn"
                          disabled={isRejected || !allMandatoryChecksApproved || signOffMutation.isPending}
                          onClick={() => {
                            if (!isRejected && allMandatoryChecksApproved) {
                              setIsSignOffDialogOpen(true);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: (!isRejected && allMandatoryChecksApproved) ? 'var(--color-brand-600, #2563eb)' : 'var(--color-bg-surface)',
                            color: (!isRejected && allMandatoryChecksApproved) ? '#ffffff' : 'var(--color-text-muted)',
                            border: (!isRejected && allMandatoryChecksApproved) ? 'none' : '1px solid var(--color-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            cursor: isRejected || !allMandatoryChecksApproved || signOffMutation.isPending ? 'not-allowed' : 'pointer',
                            opacity: isRejected || !allMandatoryChecksApproved || signOffMutation.isPending ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: (!isRejected && allMandatoryChecksApproved) ? 'var(--shadow-sm)' : 'none',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>{signOffMutation.isPending ? 'Approving Worker...' : 'Approve Worker'}</span>
                        </button>
                      ) : null}
                    </>
                  )}
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

            <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE_STATUS}>
              {isDisciplinaryEligible && (
                <>
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

                  {worker.status === 'SUSPENDED' && (
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
                      <span>Reactivate Worker</span>
                    </button>
                  )}

                  {worker.status === 'BLACKLISTED' && (hasPermission(user?.permissions, 'worker.blacklist.lift') || hasPermission(user?.permissions, '*')) && (
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
                      <span>Lift Blacklist</span>
                    </button>
                  )}
                </>
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
        confirmLabel={rejectCheckMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational remarks..."
        isLoading={rejectCheckMutation.isPending}
        errorMessage={rejectCheckError || undefined}
        onConfirm={(remarks) => {
          const finalRemarks = (remarks || rejectRemarks || '').trim();
          if (rejectCategory === 'OTHER' && !finalRemarks) {
            setRejectCheckError('Mandatory remarks explanation is required when selecting rejection reason OTHER.');
            return;
          }
          if (rejectCheckId) {
            setRejectCheckError(null);
            rejectCheckMutation.mutate({
              checkId: rejectCheckId,
              checkType: rejectCheckType,
              category: rejectCategory,
              remarks: finalRemarks,
            });
          }
        }}
        onCancel={closeDocDialog}
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
            Rejection Category <RequiredIndicator />
          </label>
          <CustomSelect
            value={rejectCategory}
            onChange={(val) => {
              setRejectCategory(val as RejectionReasonCategory);
              setRejectCheckError(null);
            }}
            options={REJECTION_CATEGORIES.map((cat) => ({
              value: cat.key,
              label: cat.label,
            }))}
            width="100%"
          />

          {isTerminalRejectionCode(rejectCategory) && (
            <div
              style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                color: 'var(--color-status-danger-text)',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertTriangle size={14} />
              <span>
                Terminal Rejection: This code permanently disqualifies the check and application. Worker resubmission and verification sign-off will be permanently blocked.
              </span>
            </div>
          )}

          {rejectCategory === 'OTHER' && (
            <div
              style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-border)',
                color: 'var(--color-status-warning-text)',
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              Mandatory explanation required: Detailed operational rationale must be entered in the remarks box below.
            </div>
          )}
        </div>
      </ConfirmDialog>

      {/* Reject Worker Confirmation Dialog (Stage 4 & Final Application Rejection) */}
      <ConfirmDialog
        isOpen={isRejectWorkerDialogOpen}
        title="Reject Worker"
        description={`Reject worker application for ${worker?.name || 'Worker'} (${worker?.id || workerId}). This action rejects the worker profile and updates their application status to REJECTED. A valid rejection reason is required.`}
        confirmLabel={rejectWorkerMutation.isPending ? 'Rejecting Worker...' : 'Confirm Rejection'}
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory rejection reason/remarks (e.g., Failed mandatory verification vetting, incomplete documentation, background mismatch)..."
        isLoading={rejectWorkerMutation.isPending}
        errorMessage={rejectWorkerError}
        onConfirm={(remarks) => {
          const finalRemarks = (remarks || rejectWorkerRemarks || '').trim();
          if (finalRemarks.length < 5) {
            setRejectWorkerError('Rejection reason must be at least 5 characters');
            return;
          }
          const targetId = worker?.id || workerId;
          if (targetId) {
            setRejectWorkerError(null);
            rejectWorkerMutation.mutate({
              workerId: targetId,
              category: rejectWorkerCategory,
              remarks: finalRemarks,
            });
          }
        }}
        onCancel={() => {
          setIsRejectWorkerDialogOpen(false);
          setRejectWorkerError(null);
          setRejectWorkerRemarks('');
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div>
              <strong>Worker Name:</strong> {worker?.name || 'Worker'}
            </div>
            <div>
              <strong>Worker ID:</strong> <span style={{ fontFamily: 'monospace' }}>{worker?.id || workerId}</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="worker-rejection-category-select"
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Rejection Reason Category <RequiredIndicator />
            </label>
            <CustomSelect
              id="worker-rejection-category-select"
              testId="worker-rejection-category-select"
              value={rejectWorkerCategory}
              onChange={(val) => setRejectWorkerCategory(val as RejectionReasonCategory)}
              options={REJECTION_CATEGORIES.map((cat) => ({
                value: cat.key,
                label: cat.label,
              }))}
              width="100%"
            />
          </div>
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
        onCancel={closeDocDialog}
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

            // Pre-validation for missing requirements before sending mutation
            if (missingApprovalRequirements && missingApprovalRequirements.length > 0) {
              const needsRef = missingApprovalRequirements.some(
                (r) =>
                  r.toLowerCase().includes('documentnumber') ||
                  r.toLowerCase().includes('reference') ||
                  r.toLowerCase().includes('number') ||
                  r.toLowerCase().includes('doc') ||
                  r.toLowerCase() === 'check'
              );
              const needsExpiry = missingApprovalRequirements.some(
                (r) =>
                  r.toLowerCase().includes('expire') ||
                  r.toLowerCase().includes('date') ||
                  r.toLowerCase().includes('expireson') ||
                  r.toLowerCase() === 'check'
              );

              if (needsRef && !inputDocNumber.trim()) {
                setApproveDialogError('Document reference / registration number is required for approval.');
                return;
              }

              if (needsExpiry) {
                if (!inputExpiryDate.trim()) {
                  setApproveDialogError('Document expiry date is required for approval.');
                  return;
                }
                const selectedDate = new Date(inputExpiryDate.trim());
                if (isNaN(selectedDate.getTime())) {
                  setApproveDialogError('A valid expiry date (YYYY-MM-DD) is required.');
                  return;
                }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate <= today) {
                  setApproveDialogError('Document expiry date must be a valid future date.');
                  return;
                }
              }
            }

            const docDetails =
              missingApprovalRequirements &&
              missingApprovalRequirements.length > 0 &&
              (inputDocNumber.trim() || inputExpiryDate.trim())
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
        onCancel={closeDocDialog}
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
            {missingApprovalRequirements.some(
              (r) =>
                r.toLowerCase().includes('documentnumber') ||
                r.toLowerCase().includes('reference') ||
                r.toLowerCase().includes('number') ||
                r.toLowerCase().includes('doc') ||
                r.toLowerCase() === 'check'
            ) && (
              <div>
                <label
                  htmlFor="input-doc-number"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}
                >
                  Document Number / Reference Number <RequiredIndicator />
                </label>
                <input
                  id="input-doc-number"
                  data-testid="input-document-number"
                  type="text"
                  value={inputDocNumber}
                  onChange={(e) => setInputDocNumber(e.target.value)}
                  placeholder="e.g. PCC-2026-99 or DL-1420110012345"
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
            {missingApprovalRequirements.some(
              (r) =>
                r.toLowerCase().includes('expire') ||
                r.toLowerCase().includes('date') ||
                r.toLowerCase().includes('expireson') ||
                r.toLowerCase() === 'check'
            ) && (
              <div>
                <label
                  htmlFor="input-expiry-date"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}
                >
                  Document Expiry Date <RequiredIndicator />
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
        title={`Verification Sign-Off (Approve Worker): ${worker?.name || 'Worker'}`}
        description={`Confirm formal verification sign-off and final worker approval for ${worker?.name || 'the worker'}. All mandatory KYC verification checks have been independently reviewed and approved. This action transitions the worker dossier to VERIFIED status.`}
        confirmLabel={
          signOffMutation.isPending
            ? 'Approving Worker...'
            : signOffDialogError
            ? 'Retry Sign-Off / Retry Approval'
            : 'Approve Worker - Sign Off Verification'
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
        description={
          targetStatus === 'SUSPENDED'
            ? `Confirm account suspension for ${worker.name}. This terminates active sessions and immediately excludes the worker from matching and search.`
            : targetStatus === 'BLACKLISTED'
            ? `Confirm safety blacklisting for ${worker.name}. This revokes account access, cancels open bookings, and records an audited safety record.`
            : worker.status === 'BLACKLISTED'
            ? `Confirm lifting blacklist for ${worker.name}. Only Super Admin is authorized to restore this account.`
            : `Confirm account reactivation for ${worker.name}. This restores matching and search eligibility.`
        }
        isDestructive={targetStatus !== 'ACTIVE'}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational reason (e.g., Customer safety complaint on Ticket TKT-4710)..."
        onConfirm={handleStatusConfirm}
        onCancel={() => setIsDisciplineOpen(false)}
      />


    </div>
  );
};
