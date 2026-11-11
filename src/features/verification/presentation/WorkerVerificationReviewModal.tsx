/* global HTMLElement, CustomEvent */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Phone,
  User,
  MapPin,
  Briefcase,
  Calendar,
  Lock,
  Clock,
  Award,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { evaluateVerificationWorkflow, VerificationStepDefinition } from '../domain/verificationWorkflow';
import { formatDocumentVaultError } from '../domain/documentVaultErrorFormatter';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import {
  VerificationCheckType,
  VerificationCheckStatus,
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationDossier,
  VerificationCheck,
  VerificationDocumentMetadata,
  isTerminalRejectionCode,
} from '../domain/types';
import { verificationRepository } from '../data/verificationRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { CustomSelect } from '../../../components/common/CustomSelect';

export interface WorkerVerificationReviewModalProps {
  dossierId: string;
  initialDossier?: VerificationDossier;
  onClose: () => void;
  triggerElement?: { focus: () => void } | null;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Application',
  2: 'Documents',
  3: 'KYC Verification',
  4: 'Summary',
  5: 'Final Approval',
};

export const WorkerVerificationReviewModal: React.FC<WorkerVerificationReviewModalProps> = ({
  dossierId,
  initialDossier,
  onClose,
  triggerElement,
}) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // RBAC permissions strictly derived from server-issued permissions
  const canReview = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW);

  const canDecide = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE);

  const canApproveWorker = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_SIGNOFF);

  const canRejectApplication =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE) ||
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_SIGNOFF);

  const canViewDocuments =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW) ||
    hasPermission(user?.permissions, PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED);

  // Wizard navigation state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]));
  const [inspectedDocIds, setInspectedDocIds] = useState<Set<string>>(new Set());

  // Document inspection state for Step 2
  const [activeDocType, setActiveDocType] = useState<VerificationCheckType>('IDENTITY');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isPhotoLoadError, setIsPhotoLoadError] = useState(false);

  // Operational check action dialogs
  const [checkToApprove, setCheckToApprove] = useState<{
    checkId: string;
    checkType: VerificationCheckType;
    title: string;
    existingReference?: string;
    existingExpiry?: string;
  } | null>(null);
  const [checkApproveNotes, setCheckApproveNotes] = useState('');
  const [callNotesInput, setCallNotesInput] = useState('');
  const [referenceNumberInput, setReferenceNumberInput] = useState('');
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [approvalValidationError, setApprovalValidationError] = useState<string | null>(null);

  const [checkToReject, setCheckToReject] = useState<{
    checkId: string;
    checkType: VerificationCheckType;
    title: string;
  } | null>(null);
  const [rejectionCategory, setRejectionCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const [isRecheckDialogOpen, setIsRecheckDialogOpen] = useState(false);
  const [recheckCheckId, setRecheckCheckId] = useState<string>('');
  const [recheckCheckType, setRecheckCheckType] = useState<VerificationCheckType>('IDENTITY');

  // Final approval dialog & onboarded success screen state
  const [isConfirmFinalApproveOpen, setIsConfirmFinalApproveOpen] = useState(false);
  const [finalApprovalNotes, setFinalApprovalNotes] = useState('');
  const [finalApprovalError, setFinalApprovalError] = useState<string | null>(null);

  // Reject application dialog state
  const [isConfirmRejectApplicationOpen, setIsConfirmRejectApplicationOpen] = useState(false);
  const [rejectApplicationCategory, setRejectApplicationCategory] = useState<RejectionReasonCategory>('OTHER');
  const [rejectApplicationRemarks, setRejectApplicationRemarks] = useState('');
  const [rejectApplicationError, setRejectApplicationError] = useState<string | null>(null);

  // Reconsider application dialog state
  const [isConfirmReconsiderOpen, setIsConfirmReconsiderOpen] = useState(false);
  const [reconsiderRemarks, setReconsiderRemarks] = useState('');
  const [reconsiderError, setReconsiderError] = useState<string | null>(null);

  const [isOnboardedSuccess, setIsOnboardedSuccess] = useState(false);
  const [onboardedResult, setOnboardedResult] = useState<{
    workerName: string;
    workerId: string;
    verificationStatus: string;
    activationStatus: string;
  } | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modal accessibility refs
  const modalContentRef = useRef<React.ComponentRef<'div'> | null>(null);
  const closeButtonRef = useRef<React.ComponentRef<'button'> | null>(null);

  // Query genuine worker dossier details
  const {
    data: dossier,
    isLoading,
    isError,
    error: dossierError,
    refetch: refetchDossier,
  } = useQuery({
    queryKey: ['verification', 'dossier', dossierId],
    queryFn: async () => {
      try {
        const res = await verificationRepository.getDossierById(dossierId);
        return res || initialDossier || null;
      } catch (err) {
        if (initialDossier) return initialDossier;
        throw err;
      }
    },
    initialData: initialDossier && (initialDossier.checks || initialDossier.submittedDocuments?.length) ? initialDossier : undefined,
    placeholderData: undefined,
    staleTime: 0,
    enabled: !!dossierId,
  });

  // Cross-entity cache invalidation helper
  const invalidateRelated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['verification'] });
    queryClient.invalidateQueries({ queryKey: ['workers'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }, [queryClient]);

  // Synchronize queue if dossier reports different authoritative status
  useEffect(() => {
    if (dossier && initialDossier && dossier.status !== initialDossier.status) {
      invalidateRelated();
    }
  }, [dossier, initialDossier, invalidateRelated]);

  // Reset photo error state when switching workers/dossiers
  useEffect(() => {
    setIsPhotoLoadError(false);
  }, [dossierId, dossier?.workerId]);

  // Dynamic submitted documents list for Step 2
  const submittedDocs: VerificationDocumentMetadata[] = useMemo(() => {
    if (dossier?.submittedDocuments && dossier.submittedDocuments.length > 0) {
      return dossier.submittedDocuments.filter(
        (d) =>
          d.reviewable !== false &&
          d.available !== false &&
          d.availability !== 'DISCARDED' &&
          d.status !== 'PENDING_UPLOAD'
      );
    }
    const docs: VerificationDocumentMetadata[] = [];
    if (dossier?.checks) {
      Object.values(dossier.checks).forEach((c) => {
        if (Array.isArray(c.documents) && c.documents.length > 0) {
          c.documents.forEach((d) => {
            if (
              d.documentId &&
              d.reviewable !== false &&
              d.available !== false &&
              d.availability !== 'DISCARDED' &&
              d.status !== 'PENDING_UPLOAD'
            ) {
              docs.push(d);
            }
          });
        } else if (
          c.documentMetadata?.documentId &&
          c.documentMetadata.reviewable !== false &&
          c.documentMetadata.available !== false &&
          c.documentMetadata.availability !== 'DISCARDED'
        ) {
          docs.push({
            ...c.documentMetadata,
            checkType: c.type,
            checkTitle: c.title,
            checkId: c.id,
            reviewable: true,
          });
        }
      });
    }
    return docs;
  }, [dossier]);

  // Active document object
  const activeDoc = useMemo(() => {
    if (selectedDocId) {
      const found = submittedDocs.find((d) => d.documentId === selectedDocId || d.id === selectedDocId);
      if (found) return found;
    }
    if (submittedDocs.length > 0) {
      return submittedDocs[0];
    }
    const fallbackMeta = dossier?.checks?.[activeDocType]?.documentMetadata;
    if (fallbackMeta) {
      return {
        ...fallbackMeta,
        checkType: activeDocType,
        checkTitle: dossier?.checks?.[activeDocType]?.title,
        checkId: dossier?.checks?.[activeDocType]?.id,
      };
    }
    return null;
  }, [selectedDocId, submittedDocs, dossier, activeDocType]);

  const activeDocMetadata = activeDoc;
  const activeDocId = activeDoc?.documentId || activeDoc?.id;
  const activeDocTypeResolved: VerificationCheckType = activeDoc?.checkType || activeDocType;

  // Query signed document URL for Step 2
  const {
    data: signedDocUrlData,
    isLoading: isLoadingSignedDocUrl,
    isError: isErrorSignedDocUrl,
    error: signedDocUrlError,
    refetch: refetchSignedDocUrl,
  } = useQuery({
    queryKey: [
      'verification',
      'documentLink',
      dossier?.workerId || dossier?.id,
      activeDocTypeResolved,
      activeDocId,
    ],
    queryFn: () => {
      if (!activeDocId || !dossier) return null;
      return verificationRepository.getSignedDocumentUrl(
        dossier.workerId || dossier.id,
        activeDocTypeResolved,
        activeDocId
      );
    },
    enabled: !!dossier && canViewDocuments && !!activeDocId && isDocPreviewOpen,
    staleTime: 60 * 1000,
    retry: false,
  });

  // Reset image load error state when document selection or preview state changes
  useEffect(() => {
    setImageLoadError(false);
  }, [activeDocId, isDocPreviewOpen]);

  // Ensure document preview modal is closed when navigating between steps
  useEffect(() => {
    if (currentStep !== 2) {
      setIsDocPreviewOpen(false);
    }
  }, [currentStep]);

  // Close preview popup when Escape key is pressed
  useEffect(() => {
    if (!isDocPreviewOpen) return;
    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') {
        setIsDocPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDocPreviewOpen]);

  // Track document inspection
  const markDocInspected = useCallback((docId: string | null | undefined) => {
    if (docId) {
      setInspectedDocIds((prev) => new Set([...prev, docId]));
    }
  }, []);

  useEffect(() => {
    if (isDocPreviewOpen && activeDocId) {
      markDocInspected(activeDocId);
    }
  }, [isDocPreviewOpen, activeDocId, markDocInspected]);

  // Check evaluations and progress
  const preCheckOtpPassed = Boolean(dossier?.preCheckOtpVerified);
  const checks = dossier?.checks;

  const workflow = evaluateVerificationWorkflow(checks, preCheckOtpPassed);

  // Dynamic required checks from backend (falling back to standard checks if not specified)
  const dynamicRequiredCheckKeys = useMemo(() => {
    if (Array.isArray(dossier?.requiredChecks) && dossier.requiredChecks.length > 0) {
      return dossier.requiredChecks;
    }
    if (dossier?.checks) {
      const explicitRequired = Object.values(dossier.checks)
        .filter((c) => c.required === true && c.type)
        .map((c) => c.type);
      if (explicitRequired.length > 0) return explicitRequired;

      if (dossier.status === 'APPROVED') {
        const approvedKeys = Object.values(dossier.checks)
          .filter((c) => c.status === 'APPROVED' && c.type)
          .map((c) => c.type);
        if (approvedKeys.length > 0) return approvedKeys;
      }
    }
    return ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'];
  }, [dossier?.requiredChecks, dossier?.checks, dossier?.status]);

  const mandatoryChecks: {
    type: 'PHONE_OTP' | VerificationCheckType;
    title: string;
    isPreCheck?: boolean;
    required: boolean;
    status: VerificationCheckStatus | 'PASSED' | 'PENDING';
    check?: VerificationCheck;
  }[] = useMemo(() => {
    const list: {
      type: 'PHONE_OTP' | VerificationCheckType;
      title: string;
      isPreCheck?: boolean;
      required: boolean;
      status: VerificationCheckStatus | 'PASSED' | 'PENDING';
      check?: VerificationCheck;
    }[] = [
      {
        type: 'PHONE_OTP',
        title: 'Phone OTP Pre-Check',
        isPreCheck: true,
        required: true,
        status: preCheckOtpPassed ? 'PASSED' : 'PENDING',
      },
    ];

    const standardTypes: { type: VerificationCheckType; title: string }[] = [
      { type: 'IDENTITY', title: 'Identity Proof' },
      { type: 'ADDRESS', title: 'Address Proof' },
      { type: 'EMERGENCY_CONTACT', title: 'Emergency Contact' },
      { type: 'REFERENCE', title: 'Employer Reference' },
      { type: 'POLICE_CLEARANCE', title: 'Police Clearance' },
    ];

    const normalizeType = (key: string): VerificationCheckType => {
      if (key === 'PREVIOUS_EMPLOYMENT') return 'REFERENCE';
      if (key === 'POLICE_VERIFICATION') return 'POLICE_CLEARANCE';
      return key as VerificationCheckType;
    };

    const seenCheckIds = new Set<string>();
    const seenCheckObjects = new Set<VerificationCheck>();
    const seenNormalizedTypes = new Set<string>();

    // 1. Process standard canonical check types in order
    standardTypes.forEach((st) => {
      const chk =
        checks?.[st.type] ||
        (st.type === 'REFERENCE' ? checks?.['PREVIOUS_EMPLOYMENT'] : undefined) ||
        (st.type === 'POLICE_CLEARANCE' ? checks?.['POLICE_VERIFICATION'] : undefined);

      const checkId = chk?.id || chk?.checkId;
      if (checkId) {
        if (seenCheckIds.has(checkId)) return;
        seenCheckIds.add(checkId);
      }
      if (chk) {
        if (seenCheckObjects.has(chk)) return;
        seenCheckObjects.add(chk);
      }
      seenNormalizedTypes.add(st.type);

      const title =
        chk?.title ||
        st.title ||
        st.type.replace(/_/g, ' ');

      const isReq = chk?.required ?? (
        dynamicRequiredCheckKeys.includes(st.type) ||
        (st.type === 'REFERENCE' && dynamicRequiredCheckKeys.includes('PREVIOUS_EMPLOYMENT')) ||
        (st.type === 'POLICE_CLEARANCE' && dynamicRequiredCheckKeys.includes('POLICE_VERIFICATION'))
      );

      list.push({
        type: st.type,
        title,
        required: Boolean(isReq),
        status: chk?.status || 'PENDING',
        check: chk,
      });
    });

    // 2. Process any additional or custom checks from dossier.checks (preserving distinct checks with separate IDs)
    if (dossier?.checks) {
      Object.entries(dossier.checks).forEach(([key, chk]) => {
        if (!chk) return;
        const normKey = normalizeType(chk.type || key);
        const checkId = chk.id || chk.checkId;

        // Skip if exact check object or check ID was already added
        if (seenCheckObjects.has(chk)) return;
        if (checkId && seenCheckIds.has(checkId)) return;

        // If it's an alias for an already-added standard check without a separate backend ID, skip
        if (seenNormalizedTypes.has(normKey) && !checkId) return;

        if (checkId) seenCheckIds.add(checkId);
        seenCheckObjects.add(chk);
        seenNormalizedTypes.add(normKey);

        const title =
          chk.title ||
          standardTypes.find((s) => s.type === normKey)?.title ||
          key.replace(/_/g, ' ');

        const isReq = chk.required ?? dynamicRequiredCheckKeys.includes(key);

        list.push({
          type: normKey,
          title,
          required: Boolean(isReq),
          status: chk.status || 'PENDING',
          check: chk,
        });
      });
    }

    return list;
  }, [preCheckOtpPassed, checks, dossier?.checks, dynamicRequiredCheckKeys]);

  const totalMandatoryCount = useMemo(() => {
    return mandatoryChecks.filter((c) => c.required).length;
  }, [mandatoryChecks]);

  const approvedChecksCount = useMemo(() => {
    return mandatoryChecks.filter(
      (c) => c.required && (c.status === 'APPROVED' || (c.isPreCheck && c.status === 'PASSED'))
    ).length;
  }, [mandatoryChecks]);

  const allMandatoryPassed = totalMandatoryCount > 0 && approvedChecksCount === totalMandatoryCount;

  const hasRejectedCheck = useMemo(() => {
    return Boolean(
      workflow?.hasRejectedCheck ||
      (dossier?.checks && Object.values(dossier.checks).some((c) => c.status === 'REJECTED')) ||
      dossier?.status === 'REJECTED' ||
      dossier?.applicationStatus === 'REJECTED'
    );
  }, [workflow?.hasRejectedCheck, dossier?.checks, dossier?.status, dossier?.applicationStatus]);

  // Dynamic list of checks for Step 3, ensuring backend-driven checks are not restricted to a fixed 5-item list
  const allCheckItems = useMemo(() => {
    const standardKeys = new Set(workflow.steps.map((s) => s.type as string));
    const items = [...workflow.steps];

    if (dossier?.checks) {
      Object.entries(dossier.checks).forEach(([rawKey, chk]) => {
        const normKey = (
          rawKey === 'PREVIOUS_EMPLOYMENT' ? 'REFERENCE' :
          rawKey === 'POLICE_VERIFICATION' ? 'POLICE_CLEARANCE' : rawKey
        ) as VerificationCheckType;

        if (!standardKeys.has(rawKey) && !standardKeys.has(normKey)) {
          standardKeys.add(rawKey);
          standardKeys.add(normKey);
          items.push({
            type: normKey,
            stepNumber: items.length + 1,
            order: items.length + 1,
            title: chk.title || rawKey.replace(/_/g, ' '),
            shortTitle: chk.title || rawKey.replace(/_/g, ' '),
            evaluationMethod: (chk.evaluationMethod as VerificationStepDefinition['evaluationMethod']) || (chk.documentMetadata ? 'DOCUMENT_INSPECTION' : 'CERTIFICATE_TRACKING'),
            isDocumentRequired: Boolean(chk.documentMetadata),
            check: chk,
            status: chk.status || 'PENDING',
            isCompleted: chk.status === 'APPROVED',
            isCurrentActionable: chk.status !== 'APPROVED',
            isLocked: false,
            prerequisiteBlockers: [],
          });
        }
      });
    }

    return items;
  }, [workflow.steps, dossier?.checks]);

  // Active review checks vs historical verification state
  const hasPendingOrInReviewChecks = useMemo(() => {
    if (!dossier?.checks) return false;
    return Object.values(dossier.checks).some(
      (c) => c.status === 'SUBMITTED' || c.status === 'IN_REVIEW' || c.status === 'RECHECK_DUE'
    );
  }, [dossier?.checks]);

  const isHistoricallyVerified = useMemo(() => {
    return Boolean(
      dossier?.status === 'APPROVED' &&
      allMandatoryPassed &&
      !dossier?.contractInconsistency &&
      !hasPendingOrInReviewChecks
    );
  }, [dossier?.status, allMandatoryPassed, dossier?.contractInconsistency, hasPendingOrInReviewChecks]);

  const isApplicationRejected = useMemo(() => {
    return Boolean(
      dossier?.status === 'REJECTED' ||
      dossier?.applicationStatus === 'REJECTED'
    );
  }, [dossier?.status, dossier?.applicationStatus]);

  const isTerminalDisqualified = useMemo(() => {
    if (!dossier?.checks) return false;
    const hasTerminalCheck = Object.values(dossier.checks).some(
      (c) => c.terminal === true || isTerminalRejectionCode(c.rejectionCode || c.rejectionCategory)
    );
    const hasTerminalInHistory = Boolean(
      dossier.rejectionHistory &&
      dossier.rejectionHistory.some((r) => r.terminal === true || isTerminalRejectionCode(r.reasonCode))
    );
    return hasTerminalCheck || hasTerminalInHistory;
  }, [dossier?.checks, dossier?.rejectionHistory]);

  const canReconsiderApplication = useMemo(() => {
    return isApplicationRejected && !isTerminalDisqualified;
  }, [isApplicationRejected, isTerminalDisqualified]);

  // Derived wizard step completion states
  const isApplicationValid = useMemo(() => {
    if (!dossier) return false;
    if (dossier.applicationStatus === 'DRAFT') return false;
    return Boolean(dossier.submissionTime || dossier.applicationSubmittedAt || dossier.workerName);
  }, [dossier]);

  const isApplicationStepCompleted = useMemo(() => {
    if (!isApplicationValid) return false;
    return currentStep > 1 || visitedSteps.has(2) || visitedSteps.has(3) || visitedSteps.has(4) || visitedSteps.has(5);
  }, [isApplicationValid, currentStep, visitedSteps]);

  const isDocumentsStepCompleted = useMemo(() => {
    if (submittedDocs.length === 0) {
      return currentStep > 2 || visitedSteps.has(3) || visitedSteps.has(4) || visitedSteps.has(5);
    }
    const allDocsSatisfied = submittedDocs.every((doc) => {
      const docId = doc.documentId || doc.id;
      const relatedCheck = doc.checkType ? dossier?.checks?.[doc.checkType] : undefined;
      return (docId && inspectedDocIds.has(docId)) || relatedCheck?.status === 'APPROVED';
    });
    return (allDocsSatisfied || isHistoricallyVerified || isApplicationRejected) && (currentStep > 2 || visitedSteps.has(3) || visitedSteps.has(4) || visitedSteps.has(5));
  }, [isHistoricallyVerified, isApplicationRejected, submittedDocs, currentStep, visitedSteps, inspectedDocIds, dossier?.checks]);

  const isKycStepCompleted = useMemo(() => {
    return (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) && (currentStep > 3 || isOnboardedSuccess || visitedSteps.has(4) || visitedSteps.has(5));
  }, [isHistoricallyVerified, isApplicationRejected, allMandatoryPassed, hasRejectedCheck, currentStep, isOnboardedSuccess, visitedSteps]);

  const isSummaryStepCompleted = useMemo(() => {
    if (!allMandatoryPassed && !hasRejectedCheck && !isHistoricallyVerified && !isApplicationRejected) return false;
    return currentStep > 4 || isOnboardedSuccess || visitedSteps.has(5);
  }, [isHistoricallyVerified, isApplicationRejected, allMandatoryPassed, hasRejectedCheck, currentStep, isOnboardedSuccess, visitedSteps]);

  const isFinalApprovalStepCompleted = useMemo(() => {
    return isOnboardedSuccess || isApplicationRejected;
  }, [isOnboardedSuccess, isApplicationRejected]);

  // Start review mutation (claims check and transitions SUBMITTED / PENDING -> IN_REVIEW)
  const startReviewMutation = useMutation({
    mutationFn: async ({ checkId }: { checkId: string; checkType?: VerificationCheckType }) => {
      try {
        await verificationRepository.claimCheck(checkId);
      } catch (err: unknown) {
        interface ConflictErrorLike {
          status?: number;
          code?: string;
          response?: { status?: number; data?: { code?: string } };
        }
        const conflictErr = err as ConflictErrorLike;
        const isConflict =
          conflictErr?.status === 409 ||
          conflictErr?.code === 'CHECK_ALREADY_ASSIGNED' ||
          conflictErr?.code === 'CHECK_ALREADY_IN_REVIEW' ||
          conflictErr?.response?.status === 409 ||
          conflictErr?.response?.data?.code === 'CHECK_ALREADY_ASSIGNED' ||
          conflictErr?.response?.data?.code === 'CHECK_ALREADY_IN_REVIEW' ||
          (err as Error)?.message?.toLowerCase().includes('already assigned') ||
          (err as Error)?.message?.toLowerCase().includes('already in review');

        if (!isConflict) {
          throw err;
        }
      }
    },
    onSuccess: () => {
      invalidateRelated();
      setFeedbackMessage('Check review started. Status updated to In Review.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: Error) => {
      setFeedbackMessage(`Failed to start review: ${err.message || 'Server error occurred'}.`);
    },
  });

  // Approve single check mutation
  const approveCheckMutation = useMutation({
    mutationFn: async ({
      checkId,
      checkType,
      notes,
      metadata,
    }: {
      checkId: string;
      checkType?: VerificationCheckType;
      notes?: string;
      metadata?: { referenceNumber?: string; expiresOn?: string; callNotes?: string; recheckAt?: string };
    }) => {
      const currentCheck = checkType ? dossier?.checks?.[checkType] : undefined;
      const currentStatus = currentCheck?.status;
      if (currentStatus === 'SUBMITTED' || currentStatus === 'PENDING') {
        try {
          await verificationRepository.claimCheck(checkId);
        } catch {
          // If already claimed or in review, continue to approve
        }
      }

      // 1. Previous employment approval needs at least one CALL note before approve
      if (
        (checkType === 'REFERENCE' || (checkType as string) === 'PREVIOUS_EMPLOYMENT') &&
        metadata?.callNotes &&
        metadata.callNotes.trim() !== ''
      ) {
        try {
          await verificationRepository.addCheckNote(checkId, metadata.callNotes.trim(), 'CALL');
        } catch {
          // If note logging fails or already logged, proceed to approval
        }
      }

      // 2. Police clearance needs document number and expiresOn before approve
      if (
        (checkType === 'POLICE_CLEARANCE' || (checkType as string) === 'POLICE_VERIFICATION') &&
        (metadata?.referenceNumber || metadata?.expiresOn)
      ) {
        try {
          await verificationRepository.updateDocumentDetails(checkId, {
            documentNumber: metadata.referenceNumber?.trim(),
            expiresOn: metadata.expiresOn?.trim(),
          });
        } catch {
          // If update details fails, proceed to approval
        }
      }

      try {
        await verificationRepository.approveCheck(checkId, checkType, notes);
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || '';
        if (errorMsg.includes('SUBMITTED') && (errorMsg.includes('cannot move to APPROVED') || errorMsg.includes('APPROVED'))) {
          await verificationRepository.claimCheck(checkId);
          await verificationRepository.approveCheck(checkId, checkType, notes);
        } else {
          throw err;
        }
      }
    },
    onSuccess: () => {
      setCheckToApprove(null);
      setCheckApproveNotes('');
      setCallNotesInput('');
      setReferenceNumberInput('');
      setExpiryDateInput('');
      setApprovalValidationError(null);
      invalidateRelated();
      setFeedbackMessage('Check marked as verified & approved.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: Error) => {
      setApprovalValidationError(`Approval failed: ${err.message || 'Server error occurred'}`);
      setFeedbackMessage(`Approval failed: ${err.message || 'Server error occurred'}.`);
    },
  });

  // Reject single check mutation
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
      if (checkType && dossier?.checks?.[checkType]) {
        const currentCheck = dossier.checks[checkType];
        if (currentCheck.status === 'SUBMITTED' || currentCheck.status === 'PENDING') {
          try {
            await verificationRepository.claimCheck(checkId);
          } catch {
            // Proceed to rejection even if pre-claim fails
          }
        }
      }
      try {
        await verificationRepository.rejectCheck(checkId, checkType, category, remarks);
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || '';
        if (
          errorMsg.includes('SUBMITTED') ||
          errorMsg.includes('start-review') ||
          errorMsg.includes('cannot move')
        ) {
          await verificationRepository.claimCheck(checkId);
          await verificationRepository.rejectCheck(checkId, checkType, category, remarks);
        } else {
          throw err;
        }
      }
    },
    onSuccess: () => {
      setCheckToReject(null);
      setRejectionRemarks('');
      setRejectionError(null);
      invalidateRelated();
      setFeedbackMessage('Check rejected and flagged for corrections.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: unknown) => {
      const code = (err as { errorCode?: string })?.errorCode;
      let msg = err instanceof Error ? err.message : 'Failed to reject check.';
      if (code === 'CHECK_ALREADY_ASSIGNED' || code === 'CHECK_NOT_ASSIGNED_TO_YOU') {
        msg = (err as Error).message || 'Check assignment conflict. You must claim this check before deciding.';
      } else if (code === 'INVALID_TRANSITION') {
        msg = (err as Error).message || 'Invalid transition: check must be in review before rejection.';
      } else if (code === 'CHECK_DISQUALIFIED') {
        msg = (err as Error).message || 'Check is permanently disqualified.';
      }
      setRejectionError(msg);
      setFeedbackMessage(`Rejection failed: ${msg}.`);
    },
  });

  // Request re-verification mutation
  const requestRecheckMutation = useMutation({
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
      setIsRecheckDialogOpen(false);
      invalidateRelated();
      setFeedbackMessage('Re-verification request successfully issued.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: Error) => {
      setFeedbackMessage(`Re-verification request failed: ${err.message || 'Server error occurred'}.`);
    },
  });

  // Final approval mutation (signs off verification + activates worker)
  const finalApproveMutation = useMutation({
    mutationFn: async ({ workerId, notes }: { workerId: string; notes?: string }) => {
      return await verificationRepository.approveApplicationAndOnboardWorker(workerId, notes);
    },
    onSuccess: (data) => {
      setIsConfirmFinalApproveOpen(false);
      setFinalApprovalError(null);
      invalidateRelated();
      const workerName = dossier?.workerName || 'Worker';

      if (data.activated !== false) {
        window.dispatchEvent(
          new CustomEvent('sevanest:toast', {
            detail: {
              type: 'success',
              message: `${workerName} has been successfully approved and activated as a SevaNest worker.`,
            },
          })
        );
        setOnboardedResult({
          workerName,
          workerId: dossier?.workerId || dossierId,
          verificationStatus: 'APPROVED',
          activationStatus: data.status || 'ACTIVE',
        });
        setIsOnboardedSuccess(true);
      } else {
        // Sign-off completed, but activation failed
        window.dispatchEvent(
          new CustomEvent('sevanest:toast', {
            detail: {
              type: 'warning',
              message: `${workerName} verification sign-off completed, but worker activation could not be completed: ${data.activationError || 'Activation failed'}.`,
            },
          })
        );
        setOnboardedResult({
          workerName,
          workerId: dossier?.workerId || dossierId,
          verificationStatus: 'APPROVED',
          activationStatus: 'ACTIVATION_PENDING',
        });
        setIsOnboardedSuccess(true);
      }
    },
    onError: (err: Error) => {
      // Retain popup on failure, display actual error
      setIsConfirmFinalApproveOpen(true);
      setFinalApprovalError(
        `Final approval failed: ${err.message || 'The backend operation could not be completed'}. Local state preserved without simulated onboarding.`
      );
    },
  });

  // Reject application mutation
  const rejectApplicationMutation = useMutation({
    mutationFn: async ({
      workerId,
      category,
      remarks,
    }: {
      workerId: string;
      category: RejectionReasonCategory | string;
      remarks: string;
    }) => {
      return await verificationRepository.rejectWorker(workerId, category, remarks);
    },
    onSuccess: () => {
      setIsConfirmRejectApplicationOpen(false);
      setRejectApplicationRemarks('');
      setRejectApplicationError(null);
      invalidateRelated();
      refetchDossier();
      const workerName = dossier?.workerName || 'Worker';
      window.dispatchEvent(
        new CustomEvent('sevanest:toast', {
          detail: {
            type: 'error',
            message: `Worker application for ${workerName} has been rejected.`,
          },
        })
      );
      setFeedbackMessage(`Application for ${workerName} rejected successfully.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as Error)?.message || 'Failed to reject application.';
      setRejectApplicationError(msg);
    },
  });

  // Reconsider application mutation
  const reconsiderApplicationMutation = useMutation({
    mutationFn: async ({
      workerId,
      remarks,
    }: {
      workerId: string;
      remarks: string;
    }) => {
      return await verificationRepository.reconsiderApplication(workerId, remarks);
    },
    onSuccess: () => {
      setIsConfirmReconsiderOpen(false);
      setReconsiderRemarks('');
      setReconsiderError(null);
      invalidateRelated();
      refetchDossier();
      setCurrentStep(3);
      const workerName = dossier?.workerName || 'Worker';
      window.dispatchEvent(
        new CustomEvent('sevanest:toast', {
          detail: {
            type: 'success',
            message: `Application for ${workerName} reconsidered. Ready for KYC re-review.`,
          },
        })
      );
      setFeedbackMessage(`Application for ${workerName} reconsidered successfully. Ready for KYC re-review.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as Error)?.message || 'Failed to reconsider application.';
      setReconsiderError(msg);
    },
  });

  // Modal accessibility: body scroll-lock and keyboard listener
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') {
        if (isDocPreviewOpen) {
          setIsDocPreviewOpen(false);
          return;
        }
        if (isConfirmFinalApproveOpen) {
          setIsConfirmFinalApproveOpen(false);
          return;
        }
        if (isConfirmRejectApplicationOpen) {
          setIsConfirmRejectApplicationOpen(false);
          return;
        }
        if (isConfirmReconsiderOpen) {
          setIsConfirmReconsiderOpen(false);
          return;
        }
        if (checkToReject) {
          setCheckToReject(null);
          return;
        }
        if (checkToApprove) {
          setCheckToApprove(null);
          return;
        }
        if (isRecheckDialogOpen) {
          setIsRecheckDialogOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus();
      }
    };
  }, [
    checkToApprove,
    checkToReject,
    isConfirmFinalApproveOpen,
    isConfirmRejectApplicationOpen,
    isConfirmReconsiderOpen,
    isDocPreviewOpen,
    isRecheckDialogOpen,
    onClose,
    triggerElement,
  ]);

  // Focus close button on mount
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, []);

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

  // Safe navigation handlers
  const canAdvanceFromStep = (step: WizardStep): boolean => {
    if (isHistoricallyVerified || isApplicationRejected) return true;
    if (step === 1) return isApplicationValid;
    if (step === 2) return true;
    if (step === 3) return allMandatoryPassed || hasRejectedCheck;
    if (step === 4) return allMandatoryPassed || hasRejectedCheck;
    return false;
  };

  const handleStepClick = (targetStep: WizardStep) => {
    if (targetStep === currentStep) return;
    if (isHistoricallyVerified || isApplicationRejected) {
      setVisitedSteps((prev) => new Set([...prev, targetStep]));
      setCurrentStep(targetStep);
      return;
    }
    // Allow clicking backwards at any time
    if (targetStep < currentStep) {
      setVisitedSteps((prev) => new Set([...prev, targetStep]));
      setCurrentStep(targetStep);
      return;
    }
    // Prevent clicking ahead if prerequisites not satisfied
    if (targetStep > currentStep) {
      if (targetStep === 2 && isApplicationValid) {
        setVisitedSteps((prev) => new Set([...prev, 2]));
        setCurrentStep(2);
      } else if (targetStep === 3 && isApplicationValid) {
        setVisitedSteps((prev) => new Set([...prev, 3]));
        setCurrentStep(3);
      } else if ((targetStep === 4 || targetStep === 5) && (allMandatoryPassed || hasRejectedCheck)) {
        setVisitedSteps((prev) => new Set([...prev, targetStep]));
        setCurrentStep(targetStep);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < 5 && canAdvanceFromStep(currentStep)) {
      const nextStep = (currentStep + 1) as WizardStep;
      setVisitedSteps((prev) => new Set([...prev, currentStep, nextStep]));
      if (currentStep === 2 && submittedDocs.length > 0) {
        setInspectedDocIds((prev) => {
          const next = new Set(prev);
          submittedDocs.forEach((d) => {
            const id = d.documentId || d.id;
            if (id) next.add(id);
          });
          return next;
        });
      }
      setCurrentStep(nextStep);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      const prevStep = (currentStep - 1) as WizardStep;
      setVisitedSteps((prev) => new Set([...prev, prevStep]));
      setCurrentStep(prevStep);
    }
  };

  // Full unmasked mobile number for Verification Executive workflow
  const displayMobileNumber = dossier?.phone || dossier?.phoneMasked || 'Unavailable';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="verification-dossier-modal-backdrop"
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
        className="verification-dossier-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-border)',
          border: '1px solid var(--color-border)',
          width: '94%',
          maxWidth: '1000px',
          maxHeight: '92vh',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Loading State */}
        {isLoading && (
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
            <LoadingSpinner message="Loading worker verification details..." />
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close dossier view"
              title="Close dossier"
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && !dossier && (
          <div
            style={{
              padding: 'var(--space-10)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-error-bg)',
                color: 'var(--color-error-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 var(--space-2) 0' }}>
                Unable to Retrieve Worker Application
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '420px', margin: 0 }}>
                {(dossierError as Error)?.message || 'The verification application could not be loaded from the backend.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                onClick={() => refetchDossier()}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close dossier view"
                title="Close dossier"
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Successful Content */}
        {!isLoading && !isError && dossier && (
          <>
            {/* Modal Header */}
            <div
              style={{
                flexShrink: 0,
                padding: 'var(--space-3) var(--space-6)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <h2
                    id="review-modal-title"
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                      margin: 0,
                    }}
                  >
                    Verification Dossier: {dossier.workerName}
                  </h2>
                  <StatusBadge status={dossier.status} />

                  <button
                    type="button"
                    aria-label="Inspect Worker Profile — View Worker Record"
                    title="Inspect Worker Profile"
                    onClick={() => {
                      if (dossier?.workerId) {
                        window.open(`/workers?workerId=${dossier.workerId}`, '_blank');
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    View Worker Record
                  </button>

                  {isHistoricallyVerified && (
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
                      Verified
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
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
                    title="Close dossier"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Backend Contract Inconsistency Warning Banner */}
              {dossier.contractInconsistency && (
                <div
                  data-testid="kyc-contract-inconsistency-banner"
                  style={{
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    border: '1px solid rgba(234, 88, 12, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: '#c2410c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <AlertTriangle size={16} color="#ea580c" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong>Contract Inconsistency Detected:</strong>{' '}
                    <span>{dossier.contractInconsistency}</span>
                  </div>
                </div>
              )}

              {/* All Criteria Satisfied Authoritative Acceptance Banner */}
              {allMandatoryPassed && !dossier.contractInconsistency && (
                <div
                  style={{
                    backgroundColor: 'var(--color-status-success-bg)',
                    border: '1px solid var(--color-status-success-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-status-success-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CheckCircle2 size={14} />
                    <span>All {totalMandatoryCount} Verification Criteria Satisfied</span>
                  </div>
                  <div style={{ fontSize: '11px', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <strong>Authoritative Status: VERIFIED</strong>
                    <span style={{ color: 'var(--color-text-secondary)' }}>(ARCH-VERIF-01)</span>
                  </div>
                </div>
              )}

              {/* Approved Read-Only Mode Banner */}
              {isHistoricallyVerified && (
                <div
                  style={{
                    backgroundColor: 'var(--color-status-success-bg)',
                    border: '1px solid var(--color-status-success-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-status-success-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Verification Approved & Complete — Dossier is in Read-Only Mode</span>
                </div>
              )}

              {/* Rejected Application Read-Only Mode Banner */}
              {isApplicationRejected && (
                <div
                  data-testid="application-rejected-header-banner"
                  style={{
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-error-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>Worker Application Rejected — Dossier is in Read-Only Mode</span>
                </div>
              )}

              {/* Feedback Message */}
              {feedbackMessage && (
                <div
                  style={{
                    backgroundColor: 'var(--color-primary-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>{feedbackMessage}</span>
                </div>
              )}
            </div>

            {/* MANDATORY HORIZONTAL PROGRESS STEPPER (VISUAL PROGRESS BUBBLES) */}
            {!isOnboardedSuccess && (
              <nav
                aria-label="Verification Progress"
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  flexShrink: 0,
                  overflowX: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    maxWidth: '850px',
                    margin: '0 auto',
                    minWidth: '600px',
                  }}
                >
                  {([1, 2, 3, 4, 5] as WizardStep[]).map((stepNum, idx) => {
                    const isCurrent = stepNum === currentStep;

                    const isStepCompleted =
                      stepNum === 1 ? isApplicationStepCompleted && !isCurrent :
                        stepNum === 2 ? isDocumentsStepCompleted && !isCurrent :
                          stepNum === 3 ? isKycStepCompleted && !isCurrent :
                            stepNum === 4 ? isSummaryStepCompleted && !isCurrent :
                              stepNum === 5 ? (isFinalApprovalStepCompleted && !isCurrent) : false;

                    const isBlocked = !isHistoricallyVerified && !isApplicationRejected && (
                      (stepNum === 2 && !isApplicationValid) ||
                      ((stepNum === 4 || stepNum === 5) && !allMandatoryPassed && !hasRejectedCheck)
                    );

                    const canClick = isHistoricallyVerified || isApplicationRejected || (stepNum <= 3 && isApplicationValid) || allMandatoryPassed || hasRejectedCheck;

                    const lineCompleted = isHistoricallyVerified
                      ? (currentStep > stepNum)
                      : (
                        stepNum === 1 ? isApplicationStepCompleted :
                          stepNum === 2 ? isDocumentsStepCompleted :
                            stepNum === 3 ? isKycStepCompleted :
                              stepNum === 4 ? isSummaryStepCompleted : false
                      );

                    return (
                      <React.Fragment key={stepNum}>
                        {/* Bubble + Label */}
                        <div
                          data-testid={`step-bubble-${stepNum}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: canClick ? 'pointer' : 'not-allowed',
                            userSelect: 'none',
                          }}
                          onClick={() => {
                            if (canClick) handleStepClick(stepNum);
                          }}
                          title={
                            isBlocked
                              ? 'Blocked: All KYC checks must be approved before advancing'
                              : isStepCompleted
                                ? `Step ${stepNum}: ${STEP_LABELS[stepNum]} (Completed)`
                                : `Step ${stepNum}: ${STEP_LABELS[stepNum]}`
                          }
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 700,
                              transition: 'all 0.2s ease',
                              backgroundColor: isStepCompleted
                                ? 'var(--color-success)'
                                : isCurrent
                                  ? 'var(--color-primary)'
                                  : 'var(--color-bg-subtle)',
                              border: isCurrent
                                ? (isHistoricallyVerified ? '2px solid var(--color-success)' : '2px solid var(--color-primary)')
                                : isStepCompleted
                                  ? '2px solid var(--color-success)'
                                  : '2px solid var(--color-border)',
                              color: isStepCompleted || isCurrent ? '#ffffff' : 'var(--color-text-secondary)',
                              boxShadow: isCurrent
                                ? (isHistoricallyVerified ? '0 0 0 3px rgba(16, 185, 129, 0.35)' : '0 0 0 3px rgba(15, 118, 110, 0.2)')
                                : 'none',
                            }}
                          >
                            {isStepCompleted ? <Check size={16} strokeWidth={2.5} /> : stepNum}
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: isCurrent ? 700 : isStepCompleted ? 600 : 500,
                              color: isCurrent
                                ? (isHistoricallyVerified ? 'var(--color-success)' : 'var(--color-primary)')
                                : isStepCompleted
                                  ? 'var(--color-success)'
                                  : isBlocked
                                    ? 'var(--color-text-disabled)'
                                    : 'var(--color-text-secondary)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {STEP_LABELS[stepNum]}
                          </span>
                        </div>

                        {/* Connecting Line between bubbles */}
                        {idx < 4 && (
                          <div
                            style={{
                              flex: 1,
                              height: '2px',
                              margin: '0 8px',
                              marginBottom: '16px',
                              backgroundColor: lineCompleted
                                ? 'var(--color-success)'
                                : 'var(--color-border)',
                              transition: 'background-color 0.2s ease',
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </nav>
            )}

            {/* Scrollable Main Content Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-6)',
                backgroundColor: 'var(--color-bg-app)',
              }}
            >
              {/* SUCCESS SCREEN (WORKER SUCCESSFULLY ONBOARDED) */}
              {isOnboardedSuccess && onboardedResult ? (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-status-success-border)',
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    maxWidth: '650px',
                    margin: 'auto',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-status-success-bg)',
                      border: '2px solid var(--color-status-success-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-status-success-text)',
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>

                  <div>
                    <h2
                      style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 800,
                        color: 'var(--color-navy)',
                        margin: '0 0 var(--space-2) 0',
                      }}
                    >
                      Worker Successfully Onboarded
                    </h2>
                    <p
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        margin: 0,
                      }}
                    >
                      The worker application has been formally verified, approved, and the worker is now active on the SevaNest platform roster.
                    </p>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      padding: 'var(--space-4)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 'var(--space-3)',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                        Worker Name
                      </span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {onboardedResult.workerName}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                        Worker ID
                      </span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {onboardedResult.workerId}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                        Confirmed Verification Status
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'var(--color-status-success-bg)',
                          color: 'var(--color-status-success-text)',
                          border: '1px solid var(--color-status-success-border)',
                        }}
                      >
                        {onboardedResult.verificationStatus}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                        Confirmed Worker Activation Status
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'var(--color-status-success-bg)',
                          color: 'var(--color-status-success-text)',
                          border: '1px solid var(--color-status-success-border)',
                        }}
                      >
                        {onboardedResult.activationStatus}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    style={{
                      padding: 'var(--space-3) var(--space-6)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    Return to Verification Queue
                  </button>
                </div>
              ) : null}

              {/* STEP 1: WORKER APPLICATION DETAILS */}
              {!isOnboardedSuccess && currentStep === 1 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                  }}
                >
                  {/* Step Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--color-border)',
                      paddingBottom: 'var(--space-4)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: 800,
                          color: 'var(--color-navy)',
                          margin: '0 0 4px 0',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        Step 1 — Worker Application Details
                      </h3>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Inspect the authentic application profile information submitted by the domestic worker.
                      </p>
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        backgroundColor: 'var(--color-primary-subtle)',
                        border: '1px solid var(--color-brand-100)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                      }}
                    >
                      <ShieldCheck size={13} color="var(--color-primary)" />
                      <span>Official Intake Profile</span>
                    </div>
                  </div>

                  {/* Hero Applicant Identity & Status Banner */}
                  <div
                    style={{
                      padding: 'var(--space-4) var(--space-5)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                    }}
                  >
                    {/* Left: Avatar & Applicant Identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: '280px' }}>
                      {(() => {
                        const photoUrl =
                          dossier.photoUrl ||
                          (typeof dossier.photo === 'object' && dossier.photo !== null && 'url' in dossier.photo
                            ? dossier.photo.url
                            : typeof dossier.photo === 'string'
                            ? dossier.photo
                            : undefined);
                        const hasUsablePhoto = Boolean(photoUrl) && !isPhotoLoadError;

                        if (hasUsablePhoto) {
                          return (
                            <img
                              src={photoUrl}
                              alt={dossier.workerName || 'Worker profile photo'}
                              onError={() => setIsPhotoLoadError(true)}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: 'var(--radius-full)',
                                objectFit: 'cover',
                                border: '1.5px solid var(--color-brand-100)',
                                flexShrink: 0,
                              }}
                            />
                          );
                        }

                        return (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'var(--color-primary-subtle)',
                              border: '1.5px solid var(--color-brand-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-primary)',
                              fontWeight: 800,
                              fontSize: '18px',
                              flexShrink: 0,
                            }}
                            aria-label={dossier.workerName ? `${dossier.workerName} avatar placeholder` : 'Worker avatar'}
                          >
                            {dossier.workerName ? dossier.workerName.charAt(0).toUpperCase() : <User size={22} />}
                          </div>
                        );
                      })()}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <User size={13} color="var(--color-primary)" />
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: 'var(--color-primary)',
                            }}
                          >
                            Applicant Identity
                          </span>
                          {dossier.hasProfilePhoto && !dossier.photoUrl && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#1d4ed8',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 'var(--radius-sm)',
                                padding: '1px 6px',
                                marginLeft: '4px',
                              }}
                              title="Worker uploaded profile photo in Workers App"
                            >
                              Photo on File
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '1.125rem',
                            fontWeight: 800,
                            color: 'var(--color-navy)',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {dossier.workerName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--color-text-secondary)',
                              backgroundColor: 'var(--color-surface)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            Worker ID: <strong style={{ color: 'var(--color-text-primary)' }}>{dossier.workerId || dossier.id}</strong>
                          </span>
                          {dossier.applicationId && (
                            <span
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-surface)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              • App ID: <strong style={{ color: 'var(--color-text-primary)' }}>{dossier.applicationId}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Application & Verification Status */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        minWidth: '240px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Award size={14} color="var(--color-primary)" />
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          Application & Verification Status
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <StatusBadge status={dossier.status} />
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {dossier.applicationStatus || 'SUBMITTED'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Clock size={12} color="var(--color-text-secondary)" />
                        <span>
                          Submitted:{' '}
                          <strong style={{ color: 'var(--color-text-primary)' }}>
                            {dossier.submissionTime || dossier.applicationSubmittedAt
                              ? formatDateTimeIST(dossier.submissionTime || dossier.applicationSubmittedAt)
                              : 'Unavailable'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Core Details Grid (Two Distinct Logical Panels) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: 'var(--space-4)',
                    }}
                  >
                    {/* Panel A: Professional & Contact Profile */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          paddingBottom: 'var(--space-2)',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <Briefcase size={14} color="var(--color-primary)" />
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--color-navy)',
                          }}
                        >
                          Professional & Contact Profile
                        </span>
                      </div>

                      {/* Full Unmasked Mobile Number */}
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <Phone size={13} color="var(--color-primary)" />
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                            Mobile Number (Unmasked)
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.02em' }}>
                          {displayMobileNumber}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {dossier.phone ? 'Full unmasked mobile number' : 'Number status as provided by backend'}
                        </div>
                      </div>

                      {/* Service Category & Experience */}
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <Briefcase size={13} color="var(--color-primary)" />
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                            Service Category & Experience
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {dossier.category || 'Unavailable'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Experience: <strong>{dossier.experienceYears !== undefined ? `${dossier.experienceYears} Years` : 'Unavailable'}</strong>
                        </div>
                      </div>

                      {/* Skills & Experience */}
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <h4
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: 'var(--color-text-secondary)',
                            margin: '0 0 var(--space-2) 0',
                          }}
                        >
                          Skills & Experience
                        </h4>
                        {dossier.skills && dossier.skills.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {dossier.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'var(--color-primary-subtle)',
                                  color: 'var(--color-primary)',
                                  border: '1px solid var(--color-brand-100)',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            No specific skills listed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Panel B: Location & Schedule Logistics */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          paddingBottom: 'var(--space-2)',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <MapPin size={14} color="var(--color-primary)" />
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--color-navy)',
                          }}
                        >
                          Location & Availability Logistics
                        </span>
                      </div>

                      {/* Locality & Service Area */}
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <MapPin size={13} color="var(--color-primary)" />
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                            Locality & Service Area
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {dossier.locality || 'Unavailable'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                          {dossier.address
                            ? [
                              dossier.address.line1,
                              dossier.address.line2,
                              dossier.address.city,
                              dossier.address.state,
                              dossier.address.pincode,
                            ]
                              .filter(Boolean)
                              .join(', ')
                            : 'Specific service address unavailable'}
                        </div>
                      </div>

                      {/* Availability Schedule */}
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <Calendar size={13} color="var(--color-primary)" />
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                            Availability Schedule
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {dossier.availability || 'Unavailable'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Expected Compensation: <strong style={{ color: 'var(--color-text-primary)' }}>{dossier.expectedSalary || 'Not specified'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Status & Document Attachment Overview */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-2)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={16} color="var(--color-primary)" />
                        <h4
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--color-navy)',
                            margin: 0,
                          }}
                        >
                          Verification Status & Document Overview
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                          backgroundColor: 'var(--color-primary-subtle)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--color-brand-100)',
                        }}
                      >
                        {mandatoryChecks.length} Criteria Tracked
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3) 0' }}>
                      Pre-inspection summary of verification requirements, current statuses, and supporting document readiness. Verification decisions and detailed reviews are performed in subsequent steps.
                    </p>

                    <div
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-surface)',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 'var(--font-size-xs)',
                          textAlign: 'left',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              backgroundColor: 'var(--color-bg-subtle)',
                              borderBottom: '1px solid var(--color-border)',
                            }}
                          >
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '45%' }}>
                              Verification Requirement
                            </th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '25%' }}>
                              Status
                            </th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '30%' }}>
                              Document
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mandatoryChecks.map((chkItem, idx) => {
                            const docMeta = chkItem.check?.documentMetadata;
                            const hasDirectDoc = Boolean(
                              (docMeta?.documentId && docMeta.documentId.trim() !== '') ||
                              (docMeta?.id && docMeta.id.trim() !== '')
                            );
                            const hasCheckDocs = Array.isArray(chkItem.check?.documents) &&
                              chkItem.check.documents.some((d) => Boolean((d.documentId && d.documentId.trim() !== '') || (d.id && d.id.trim() !== '')));
                            const hasMatchingSubmittedDoc = submittedDocs.some((d) => {
                              const normDocType = (d.checkType === 'PREVIOUS_EMPLOYMENT' ? 'REFERENCE' : d.checkType === 'POLICE_VERIFICATION' ? 'POLICE_CLEARANCE' : d.checkType);
                              return normDocType === chkItem.type && Boolean((d.documentId && d.documentId.trim() !== '') || (d.id && d.id.trim() !== ''));
                            });
                            const hasDoc = hasDirectDoc || hasCheckDocs || hasMatchingSubmittedDoc;

                            const isManualCheck =
                              chkItem.type === 'EMERGENCY_CONTACT' ||
                              chkItem.check?.evaluationMethod === 'TELEPHONIC_VETTING' ||
                              (chkItem.type === 'REFERENCE' && chkItem.check?.evaluationMethod !== 'DOCUMENT_INSPECTION');

                            const isBorderBottom = idx < mandatoryChecks.length - 1;

                            return (
                              <tr
                                key={chkItem.type + '-' + idx}
                                style={{
                                  borderBottom: isBorderBottom ? '1px solid var(--color-border-subtle, #e5e7eb)' : 'none',
                                }}
                              >
                                <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <strong style={{ color: 'var(--color-navy)', fontSize: '12px', fontWeight: 600 }}>
                                      {chkItem.title}
                                    </strong>
                                    {chkItem.isPreCheck ? (
                                      <span
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          color: 'var(--color-text-secondary)',
                                          backgroundColor: 'var(--color-bg-app)',
                                          padding: '1px 5px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-border)',
                                        }}
                                      >
                                        Automated Pre-Check
                                      </span>
                                    ) : isManualCheck ? (
                                      <span
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          color: 'var(--color-text-secondary)',
                                          backgroundColor: 'var(--color-bg-app)',
                                          padding: '1px 5px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-border)',
                                        }}
                                      >
                                        Manual Vetting
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                                  <span className="sr-only">Check Status: </span>
                                  <StatusBadge status={chkItem.status} />
                                </td>
                                <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                                  <span className="sr-only">Document Attachment: </span>
                                  {chkItem.isPreCheck ? (
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11.5px' }}>
                                      Not applicable
                                    </span>
                                  ) : isManualCheck && !hasDoc ? (
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11.5px' }}>
                                      Not applicable
                                    </span>
                                  ) : hasDoc ? (
                                    <span
                                      style={{
                                        color: 'var(--color-status-success-text)',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '11.5px',
                                      }}
                                    >
                                      <CheckCircle2 size={13} color="var(--color-status-success-text)" />
                                      Available
                                    </span>
                                  ) : (
                                    <span
                                      data-testid="verification-doc-missing-id"
                                      style={{
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '11.5px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      No document submitted
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: DOCUMENTS REVIEW */}
              {!isOnboardedSuccess && currentStep === 2 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                    <h3
                      style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 800,
                        color: 'var(--color-navy)',
                        margin: '0 0 4px 0',
                      }}
                    >
                      Step 2 — Documents Review
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Inspect submitted KYC documents securely via authorized vault links. Click &apos;View Document&apos; to view in the secure previewer.
                    </p>
                  </div>

                  {/* Document Selection Grid */}
                  {submittedDocs.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                      {submittedDocs.map((docItem) => {
                        const relatedCheck = docItem.checkType ? dossier.checks?.[docItem.checkType] : undefined;
                        const docStatus = relatedCheck?.status || docItem.status || 'SUBMITTED';
                        return (
                          <div
                            key={docItem.documentId || docItem.id}
                            data-testid={`document-box-${docItem.documentId || docItem.id}`}
                            style={{
                              padding: 'var(--space-4)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 'var(--space-3)',
                              boxShadow: 'var(--shadow-sm)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <FileText size={18} color="var(--color-primary)" />
                                <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                                  {docItem.documentTypeName || 'Submitted Document'}
                                </strong>
                              </div>
                              <StatusBadge status={docStatus} />
                            </div>

                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-text-secondary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                backgroundColor: 'var(--color-bg-subtle)',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <div>
                                <span>Check: </span>
                                <strong style={{ color: 'var(--color-text-primary)' }}>
                                  {docItem.checkTitle || docItem.checkType || 'KYC Attachment'}
                                </strong>
                              </div>
                              <div>
                                <span>Doc ID: </span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                                  {docItem.documentId || docItem.id || 'Pending'}
                                </span>
                              </div>
                              {docItem.docNumberMasked && (
                                <div>
                                  <span>Doc Number: </span>
                                  <strong style={{ color: 'var(--color-text-primary)' }}>
                                    {docItem.docNumberMasked}
                                  </strong>
                                </div>
                              )}
                              <div>
                                <span>Format: </span>
                                <span>
                                  {docItem.contentType || docItem.mimeType || 'application/pdf'}
                                  {docItem.sizeBytes ? ` • ${Math.round(docItem.sizeBytes / 1024)} KB` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              data-testid={`view-document-btn-${docItem.documentId || docItem.id}`}
                              aria-label={`View Document — ${docItem.documentTypeName || ''} (${docItem.checkTitle || docItem.checkType || ''})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocId(docItem.documentId || docItem.id || null);
                                if (docItem.checkType) setActiveDocType(docItem.checkType);
                                setIsDocPreviewOpen(true);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                marginTop: 'auto',
                                transition: 'opacity 0.15s ease',
                              }}
                            >
                              <Eye size={14} />
                              View Document
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      data-testid="verification-doc-missing-id"
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <AlertTriangle size={18} color="var(--color-warning)" style={{ display: 'inline', marginRight: '6px' }} />
                      No digital document uploads submitted by worker yet. Manual checks apply.
                    </div>
                  )}

                  {/* Manual verification notice for Employer Reference and Police Certificate */}
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ShieldCheck size={16} color="var(--color-primary)" />
                      <strong style={{ color: 'var(--color-text-primary)' }}>Manual Verification Checks (No Digital Document Required by Protocol)</strong>
                    </div>
                    <div>
                      • <strong>Employer Reference:</strong> Telephonic verification only; call outcome notes are recorded directly before approval. Digital file attachment is not required.<br />
                      • <strong>Police Certificate:</strong> Manual certificate tracking & police verification supported without requiring digital file upload. Certificate reference number and validity date are recorded.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: KYC VERIFICATION */}
              {!isOnboardedSuccess && currentStep === 3 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div>
                        <h3
                          style={{
                            fontSize: 'var(--font-size-lg)',
                            fontWeight: 800,
                            color: 'var(--color-navy)',
                            margin: '0 0 4px 0',
                          }}
                        >
                          Step 3 — KYC Verification
                        </h3>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                          Perform KYC verification of the domestic worker and submitted records. Each required check must be evaluated before platform onboarding.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          Progress: <strong style={{ color: allMandatoryPassed ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                            {approvedChecksCount} of {totalMandatoryCount} Checks Approved
                          </strong>
                        </div>
                        {!isHistoricallyVerified && !isApplicationRejected && canRejectApplication && (
                          <button
                            type="button"
                            data-testid="step3-reject-application-btn"
                            onClick={() => {
                              setRejectApplicationError(null);
                              setIsConfirmRejectApplicationOpen(true);
                            }}
                            disabled={rejectApplicationMutation.isPending}
                            style={{
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'transparent',
                              color: 'var(--color-error)',
                              border: '1px solid var(--color-error)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <X size={12} />
                            Reject Application
                          </button>
                        )}
                        {isApplicationRejected && canReconsiderApplication && (
                          <button
                            type="button"
                            data-testid="step3-reconsider-application-btn"
                            onClick={() => {
                              setReconsiderError(null);
                              setIsConfirmReconsiderOpen(true);
                            }}
                            disabled={reconsiderApplicationMutation.isPending}
                            style={{
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: '1px solid #0369a1',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <RotateCcw size={12} />
                            Reconsider Application
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {!canDecide && (
                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <Lock size={14} color="var(--color-warning)" />
                      <span>Verification decisions reserved for Verification Executives</span>
                    </div>
                  )}

                  {/* 1. Mobile OTP Pre-Check Banner */}
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: preCheckOtpPassed ? 'var(--color-status-success-bg)' : 'var(--color-warning-bg)',
                      border: `1px solid ${preCheckOtpPassed ? 'var(--color-status-success-border)' : 'var(--color-warning-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Phone size={18} color={preCheckOtpPassed ? 'var(--color-status-success-text)' : 'var(--color-warning-text)'} />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: preCheckOtpPassed ? 'var(--color-status-success-text)' : 'var(--color-warning-text)' }}>
                          Mobile OTP Pre-Check (Automated Registration Vetting)
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          Actual backend verification status: Telecom mobile OTP completed during registration.
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: preCheckOtpPassed ? 'var(--color-status-success-bg)' : 'var(--color-warning-bg)',
                        color: preCheckOtpPassed ? 'var(--color-status-success-text)' : 'var(--color-warning-text)',
                        border: `1px solid ${preCheckOtpPassed ? 'var(--color-status-success-border)' : 'var(--color-warning-border)'}`,
                      }}
                    >
                      {preCheckOtpPassed ? 'PASSED (Automated)' : 'PENDING'}
                    </span>
                  </div>

                  {/* Operational Checks (Backend-Driven dynamic list) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {allCheckItems.map((item) => {
                      const check = checks?.[item.type] || item.check || {
                        id: undefined,
                        type: item.type,
                        title: item.title,
                        status: item.status,
                        evaluationMethod: item.evaluationMethod,
                      };
                      const isApproved = check.status === 'APPROVED';
                      const isRejected = check.status === 'REJECTED';
                      const isTerminal = check.terminal === true || isTerminalRejectionCode(check.rejectionCode || check.rejectionCategory);
                      const rawCheckId = check.id || check.checkId || (item.type ? checks?.[item.type]?.id : undefined);
                      const checkId = rawCheckId && typeof rawCheckId === 'string' && rawCheckId.trim() !== '' ? rawCheckId.trim() : '';

                      return (
                        <div
                          key={check.type}
                          data-testid={`check-card-${check.type}`}
                          style={{
                            border: `1px solid ${isApproved
                                ? 'var(--color-status-success-border)'
                                : isRejected
                                  ? 'var(--color-error-border)'
                                  : 'var(--color-border)'
                              }`,
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isApproved
                              ? 'var(--color-status-success-bg)'
                              : isRejected
                                ? 'var(--color-error-bg)'
                                : 'var(--color-surface)',
                            padding: 'var(--space-4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-3)',
                            opacity: 1,
                          }}
                        >
                          {/* Check Title & Status Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                            <div>
                              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'inline' }}>
                                {item.type === 'POLICE_CLEARANCE' ? (
                                  <>
                                    <span>Police Certificate</span> (<span>Police Clearance</span>)
                                  </>
                                ) : (
                                  item.title
                                )}
                              </h4>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>
                                Method: {check.evaluationMethod || item.evaluationMethod}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <StatusBadge status={check.status} />
                            </div>
                          </div>

                          {/* Submitted Information Body */}
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {check.type === 'IDENTITY' && (
                              <div>
                                Document: <strong>{check.documentMetadata?.documentTypeName || 'Aadhaar Card'}</strong> •
                                Number: <strong>{check.documentMetadata?.docNumberMasked || 'Unavailable'}</strong> •
                                Name: <strong>{check.documentMetadata?.nameOnDoc || dossier.workerName}</strong>
                              </div>
                            )}
                            {check.type === 'ADDRESS' && (
                              <div>
                                Document: <strong>{check.documentMetadata?.documentTypeName || 'Utility Bill'}</strong> •
                                Number: <strong>{check.documentMetadata?.docNumberMasked || 'Unavailable'}</strong>
                              </div>
                            )}
                            {check.type === 'EMERGENCY_CONTACT' && (
                              <div>
                                Contact: <strong>{check.contactDetails?.contactName || dossier.emergencyContact?.name || 'Unavailable'}</strong> ({check.contactDetails?.relationshipOrRole || dossier.emergencyContact?.relationship || 'Contact'}) •
                                Phone: <strong>{dossier.emergencyContact?.phone || (check.contactDetails as { phone?: string; phoneMasked?: string })?.phone || check.contactDetails?.phoneMasked || dossier.emergencyContact?.phoneMasked || 'Unavailable'}</strong>
                                {check.contactDetails?.callNotes && (
                                  <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                                    Call Notes: &quot;{check.contactDetails.callNotes}&quot;
                                  </div>
                                )}
                              </div>
                            )}
                            {check.type === 'REFERENCE' && (
                              <div>
                                Employer: <strong>{check.contactDetails?.contactName || dossier.previousEmployer?.name || 'Prior Employer'}</strong> •
                                Phone: <strong>{dossier.previousEmployer?.phone || (check.contactDetails as { phone?: string; phoneMasked?: string })?.phone || check.contactDetails?.phoneMasked || dossier.previousEmployer?.phoneMasked || 'Unavailable'}</strong>
                                {dossier.previousEmployer?.feedback && (
                                  <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                                    Feedback: &quot;{dossier.previousEmployer.feedback}&quot;
                                  </div>
                                )}
                              </div>
                            )}
                            {check.type === 'POLICE_CLEARANCE' && (
                              <div>
                                Certificate / Record: <strong>{check.documentMetadata?.documentTypeName || 'Police Clearance Record'}</strong> •
                                Reference: <strong>{check.documentMetadata?.docNumberMasked || check.id || 'Manual Verification'}</strong>
                              </div>
                            )}
                            {check.type !== 'IDENTITY' &&
                              check.type !== 'ADDRESS' &&
                              check.type !== 'EMERGENCY_CONTACT' &&
                              check.type !== 'REFERENCE' &&
                              check.type !== 'POLICE_CLEARANCE' && (
                                <div>
                                  {check.documentMetadata ? (
                                    <div>
                                      Document: <strong>{check.documentMetadata.documentTypeName || 'Submitted Document'}</strong>
                                      {check.documentMetadata.docNumberMasked && (
                                        <> • Number: <strong>{check.documentMetadata.docNumberMasked}</strong></>
                                      )}
                                      {check.documentMetadata.nameOnDoc && (
                                        <> • Name: <strong>{check.documentMetadata.nameOnDoc}</strong></>
                                      )}
                                    </div>
                                  ) : check.contactDetails ? (
                                    <div>
                                      Contact: <strong>{check.contactDetails.contactName}</strong> ({check.contactDetails.relationshipOrRole || 'Contact'}) •
                                      Phone: <strong>{(check.contactDetails as { phone?: string; phoneMasked?: string })?.phone || check.contactDetails.phoneMasked || 'Unavailable'}</strong>
                                    </div>
                                  ) : (
                                    <div>
                                      Evaluation: <strong>{check.evaluationMethod || item.evaluationMethod || 'Manual Verification'}</strong> •
                                      Status: <strong>{check.status || 'PENDING'}</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>

                          {/* Rejection / Correction remarks display */}
                          {isRejected && (
                            <div
                              style={{
                                backgroundColor: isTerminal
                                  ? 'rgba(220, 38, 38, 0.08)'
                                  : 'rgba(245, 158, 11, 0.08)',
                                border: `1px solid ${isTerminal ? 'var(--color-error-border)' : 'var(--color-status-warning-border)'
                                  }`,
                                borderRadius: 'var(--radius-sm)',
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: 'var(--font-size-xs)',
                                color: isTerminal ? 'var(--color-error-dark)' : 'var(--color-status-warning-text)',
                              }}
                            >
                              <div>
                                <strong>Rejection Reason:</strong> {check.rejectionCode || check.rejectionCategory || 'Operational Rejection'}
                                {check.rejectionRemarks ? ` — ${check.rejectionRemarks}` : ''}
                              </div>
                              <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 500 }}>
                                {isTerminal
                                  ? '⚠️ Terminal Disqualification: Resubmission is not permitted. Sign-off is blocked.'
                                  : 'Worker correction required. The applicant must resubmit corrected document via Worker Mobile App.'}
                              </div>
                            </div>
                          )}

                          {/* Check Verification Event History Timeline */}
                          {check.history && check.history.length > 0 && (
                            <div
                              style={{
                                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                                border: '1px solid var(--color-border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: 'var(--space-2) var(--space-3)',
                                fontSize: '11px',
                              }}
                            >
                              <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                                Verification Audit History ({check.history.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {check.history.map((ev, evIdx) => (
                                  <div
                                    key={evIdx}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      padding: '3px 0',
                                      borderBottom: evIdx < check.history!.length - 1 ? '1px dashed var(--color-border-subtle)' : 'none',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>
                                        <code>{ev.fromStatus || 'INITIAL'}</code> → <strong><code>{ev.toStatus}</code></strong>
                                        <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>({ev.actorUserId || 'Admin'})</span>
                                      </span>
                                      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                                        {formatDateTimeIST(ev.createdAt)}
                                      </span>
                                    </div>
                                    {ev.remarks && (
                                      <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                                        Remarks: &quot;{ev.remarks}&quot;
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions and Document Access */}
                          {(() => {
                            const checkDoc = submittedDocs.find(
                              (d) =>
                                d.checkType === check.type ||
                                (d.documentId && check.documents?.some((cd) => cd.documentId === d.documentId))
                            ) || (check.documentMetadata?.documentId && check.documentMetadata?.reviewable ? check.documentMetadata : null);

                            const showActions = !isHistoricallyVerified && !isApplicationRejected && !isApproved && canReview;

                            if (!checkDoc && !showActions) return null;

                            return (
                              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', paddingTop: 'var(--space-1)' }}>
                                {checkDoc && (
                                  <button
                                    type="button"
                                    data-testid={`open-document-${check.type}`}
                                    onClick={() => {
                                      setSelectedDocId(checkDoc.documentId || checkDoc.id || null);
                                      setActiveDocType(check.type);
                                      setCurrentStep(2);
                                      setIsDocPreviewOpen(true);
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--color-bg-subtle)',
                                      color: 'var(--color-primary)',
                                      border: '1px solid var(--color-border)',
                                      fontSize: 'var(--font-size-xs)',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <FileText size={12} />
                                    Open Document
                                  </button>
                                )}

                                {showActions && (
                                  <>
                                    {canDecide ? (
                                      <>
                                        {isTerminal ? (
                                          <span style={{ fontSize: '11px', color: 'var(--color-error-dark)', fontWeight: 600, padding: '4px 0' }}>
                                            Disqualified (Terminal)
                                          </span>
                                        ) : isRejected ? (
                                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                                            Awaiting worker resubmission before re-review
                                          </span>
                                        ) : (
                                          <>
                                            {(check.status === 'SUBMITTED' || check.status === 'PENDING') && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!checkId) return;
                                                  startReviewMutation.mutate({ checkId, checkType: check.type });
                                                }}
                                                disabled={!checkId || startReviewMutation.isPending || approveCheckMutation.isPending}
                                                title={!checkId ? 'Check UUID not yet assigned by backend' : 'Start Review'}
                                                style={{
                                                  padding: '4px 12px',
                                                  borderRadius: 'var(--radius-sm)',
                                                  backgroundColor: !checkId ? 'var(--color-bg-disabled)' : 'var(--color-primary-subtle)',
                                                  color: !checkId ? 'var(--color-text-disabled)' : 'var(--color-primary)',
                                                  border: !checkId ? '1px solid var(--color-border)' : '1px solid var(--color-primary)',
                                                  fontSize: 'var(--font-size-xs)',
                                                  fontWeight: 600,
                                                  cursor: !checkId ? 'not-allowed' : 'pointer',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                }}
                                              >
                                                <Clock size={12} />
                                                {startReviewMutation.isPending ? 'Starting Review...' : 'Start Review'}
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!checkId) return;
                                                setCheckToApprove({
                                                  checkId,
                                                  checkType: check.type,
                                                  title: item.title,
                                                  existingReference: check.documentMetadata?.docNumberMasked || check.referenceNumber,
                                                  existingExpiry: check.documentMetadata?.expiryDate || check.expiresOn,
                                                });
                                                if (check.type === 'REFERENCE') {
                                                  setCallNotesInput(check.contactDetails?.callNotes || dossier?.previousEmployer?.feedback || '');
                                                } else if (check.type === 'POLICE_CLEARANCE') {
                                                  setReferenceNumberInput(check.documentMetadata?.docNumberMasked || check.referenceNumber || '');
                                                  setExpiryDateInput(check.documentMetadata?.expiryDate || check.expiresOn || '');
                                                }
                                                setApprovalValidationError(null);
                                              }}
                                              disabled={!checkId || approveCheckMutation.isPending}
                                              title={!checkId ? 'Check UUID not yet assigned by backend' : 'Approve Check'}
                                              style={{
                                                padding: '4px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: !checkId ? 'var(--color-bg-disabled)' : 'var(--color-success)',
                                                color: !checkId ? 'var(--color-text-disabled)' : '#ffffff',
                                                border: 'none',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                cursor: !checkId ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                              }}
                                            >
                                              <Check size={12} />
                                              Approve Check
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!checkId) return;
                                                setCheckToReject({ checkId, checkType: check.type, title: item.title });
                                              }}
                                              disabled={!checkId || rejectCheckMutation.isPending}
                                              title={!checkId ? 'Check UUID not yet assigned by backend' : 'Reject Check'}
                                              style={{
                                                padding: '4px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: !checkId ? 'var(--color-bg-disabled)' : 'var(--color-error)',
                                                color: !checkId ? 'var(--color-text-disabled)' : '#ffffff',
                                                border: 'none',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                cursor: !checkId ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                              }}
                                            >
                                              <X size={12} />
                                              Reject Check
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!checkId) return;
                                                setRecheckCheckId(checkId);
                                                setRecheckCheckType(check.type);
                                                setIsRecheckDialogOpen(true);
                                              }}
                                              disabled={!checkId || requestRecheckMutation.isPending}
                                              title={!checkId ? 'Check UUID not yet assigned by backend' : 'Request Re-Verification'}
                                              style={{
                                                padding: '4px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: 'transparent',
                                                color: 'var(--color-warning)',
                                                border: '1px solid var(--color-warning)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                cursor: !checkId ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                              }}
                                            >
                                              <RefreshCw size={12} />
                                              Request Re-Verification
                                            </button>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!checkId) return;
                                          setRecheckCheckId(checkId);
                                          setRecheckCheckType(check.type);
                                          setIsRecheckDialogOpen(true);
                                        }}
                                        disabled={!checkId || requestRecheckMutation.isPending}
                                        title={!checkId ? 'Check UUID not yet assigned by backend' : 'Request Re-Verification'}
                                        style={{
                                          padding: '4px 12px',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: 'var(--color-surface)',
                                          color: 'var(--color-text-secondary)',
                                          border: '1px solid var(--color-border)',
                                          fontSize: 'var(--font-size-xs)',
                                          fontWeight: 600,
                                          cursor: !checkId ? 'not-allowed' : 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <RefreshCw size={12} />
                                        Request Re-Verification
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {isApproved && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-status-success-text)' }}>
                                <CheckCircle2 size={14} />
                                <span>Check Approved & Verified</span>
                              </div>
                              {!isHistoricallyVerified && !isApplicationRejected && canDecide && checkId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecheckCheckId(checkId);
                                    setRecheckCheckType(check.type);
                                    setIsRecheckDialogOpen(true);
                                  }}
                                  disabled={requestRecheckMutation.isPending}
                                  title="Request Re-Verification"
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-warning)',
                                    border: '1px solid var(--color-warning)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <RefreshCw size={11} />
                                  Request Re-Verification
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: VERIFICATION SUMMARY */}
              {!isOnboardedSuccess && currentStep === 4 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                    <h3
                      style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 800,
                        color: 'var(--color-navy)',
                        margin: '0 0 4px 0',
                      }}
                    >
                      Step 4 — Verification Summary
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Consolidated summary of worker identity, verification checklist progress, and approval eligibility.
                    </p>
                  </div>

                  {/* Worker Identity Overview Banner */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Worker Name</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {dossier.workerName}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Worker ID</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {dossier.workerId || dossier.id}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Mobile Number</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {displayMobileNumber}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Application Status</span>
                      <StatusBadge status={dossier.status} />
                    </div>
                  </div>

                  {/* Checklist Verification Results Table */}
                  <div>
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 'var(--space-3)' }}>
                      Results of All 6 Verification Checks
                    </h4>

                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Check Name</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Evaluation Method</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Backend Result</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mandatoryChecks.map((item, idx) => {
                            const isCheckApproved = item.status === 'APPROVED' || (item.isPreCheck && item.status === 'PASSED');
                            return (
                              <tr
                                key={idx}
                                tabIndex={0}
                                role="button"
                                aria-label={`Inspect check ${item.title}`}
                                className="clickable-table-row"
                                onClick={() => {
                                  if (item.type === 'PHONE_OTP') {
                                    setCurrentStep(1);
                                  } else if (item.type === 'EMERGENCY_CONTACT' || item.type === 'REFERENCE') {
                                    setCurrentStep(3);
                                  } else {
                                    setCurrentStep(2);
                                    if (item.type) {
                                      setActiveDocType(item.type as VerificationCheckType);
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    if (item.type === 'PHONE_OTP') {
                                      setCurrentStep(1);
                                    } else if (item.type === 'EMERGENCY_CONTACT' || item.type === 'REFERENCE') {
                                      setCurrentStep(3);
                                    } else {
                                      setCurrentStep(2);
                                      if (item.type) {
                                        setActiveDocType(item.type as VerificationCheckType);
                                      }
                                    }
                                  }
                                }}
                                style={{
                                  borderBottom: idx < mandatoryChecks.length - 1 ? '1px solid var(--color-border)' : 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                  {item.title}
                                </td>
                                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                                  {item.isPreCheck ? 'AUTOMATED_SMS_OTP' : item.check?.evaluationMethod || (item.required ? 'DOCUMENT_INSPECTION' : 'NOT_APPLICABLE')}
                                </td>
                                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                                  {item.isPreCheck
                                    ? item.status === 'PASSED' ? 'Mobile OTP Verified Authentic' : 'OTP Pending'
                                    : !item.required && item.status !== 'APPROVED'
                                      ? 'Not Required by Protocol'
                                      : item.check?.documentMetadata?.docNumberMasked || item.check?.contactDetails?.contactName || 'Submitted'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {isCheckApproved ? (
                                    <span style={{ color: 'var(--color-status-success-text)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircle2 size={12} />
                                      Approved
                                    </span>
                                  ) : !item.required && item.status !== 'APPROVED' ? (
                                    <span
                                      style={{
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                      }}
                                    >
                                      Not Required
                                    </span>
                                  ) : (
                                    <StatusBadge status={item.status as VerificationCheckStatus} />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rejection Remarks Warning (if any) */}
                  {mandatoryChecks.some((c) => c.status === 'REJECTED') && (
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
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Attention Required: Check Rejections Recorded</strong>
                      {mandatoryChecks
                        .filter((c) => c.status === 'REJECTED')
                        .map((c, rIdx) => (
                          <div key={rIdx}>
                            • <strong>{c.title}:</strong> {c.check?.rejectionCategory} — {c.check?.rejectionRemarks}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Verification Decision & Audit History Card */}
                  {((dossier.rejectionHistory && dossier.rejectionHistory.length > 0) ||
                    (dossier.reconsiderationHistory && dossier.reconsiderationHistory.length > 0) ||
                    (dossier.approvalHistory && dossier.approvalHistory.length > 0)) && (
                    <div
                      data-testid="verification-audit-trail-card"
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                        <Clock size={16} color="var(--color-text-secondary)" />
                        <h4
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                          }}
                        >
                          Verification Decision & Audit History
                        </h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                        {/* Rejections */}
                        {dossier.rejectionHistory?.map((rej, idx) => (
                          <div
                            key={`rej-${idx}`}
                            data-testid={`audit-rejection-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#fff5f5',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #ef4444',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#b91c1c' }}>
                                • Rejection #{idx + 1}: {rej.reasonCode || 'OPERATIONAL_REJECTION'} {rej.terminal ? '(Permanent Compliance Disqualification)' : '(Eligible for Reconsideration)'}
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(rej.rejectedAt)}
                              </span>
                            </div>
                            {rej.remarks && (
                              <div style={{ color: 'var(--color-text-primary)' }}>
                                <strong>Reason Remarks:</strong> {rej.remarks}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Reconsiderations */}
                        {dossier.reconsiderationHistory?.map((rec, idx) => (
                          <div
                            key={`rec-${idx}`}
                            data-testid={`audit-reconsideration-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#eff6ff',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #3b82f6',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
                                • Reconsideration #{idx + 1} for KYC Re-Review
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(rec.reconsideredAt)}
                              </span>
                            </div>
                            <div style={{ color: 'var(--color-text-primary)' }}>
                              <strong>Executive Rationale:</strong> {rec.remarks}
                            </div>
                          </div>
                        ))}

                        {/* Approvals */}
                        {dossier.approvalHistory?.map((appr, idx) => (
                          <div
                            key={`appr-${idx}`}
                            data-testid={`audit-approval-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#f0fdf4',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #22c55e',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#15803d' }}>
                                • Approved & Signed Off #{idx + 1}
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(appr.approvedAt)}
                              </span>
                            </div>
                            {appr.remarks && (
                              <div style={{ color: 'var(--color-text-primary)' }}>
                                <strong>Sign-Off Notes:</strong> {appr.remarks}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Readiness Banner */}
                  {allMandatoryPassed && !dossier.contractInconsistency ? (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-status-success-bg)',
                        border: '1px solid var(--color-status-success-border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <CheckCircle2 size={20} color="var(--color-status-success-text)" />
                      <div>
                        <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-success-text)', display: 'block' }}>
                          All 6 Verification Criteria Satisfied
                        </strong>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          Application has met all mandatory KYC standards and is eligible for final executive approval.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-warning-bg)',
                        border: '1px solid var(--color-warning-border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <AlertTriangle size={20} color="var(--color-warning-text)" />
                      <div>
                        <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-warning-text)', display: 'block' }}>
                          Verification Incomplete — Final Approval Blocked
                        </strong>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)' }}>
                          {mandatoryChecks
                            .filter((c) => c.status !== 'APPROVED' && (!c.isPreCheck || c.status !== 'PASSED'))
                            .map((c) => c.title)
                            .join(', ')}{' '}
                          must be approved before continuing to final approval.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: FINAL APPROVAL */}
              {!isOnboardedSuccess && currentStep === 5 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--space-6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-5)',
                  }}
                >
                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                    <h3
                      style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 800,
                        color: 'var(--color-navy)',
                        margin: '0 0 4px 0',
                      }}
                    >
                      Step 5 — Final Approval
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Final confirmation of worker identity and authorization to sign off verification and activate on the platform.
                    </p>
                  </div>

                  {/* Final Approval Error Banner (if mutation failed and dialog closed) */}
                  {!isConfirmFinalApproveOpen && finalApprovalError && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-error-bg)',
                        border: '1px solid var(--color-error-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-error-dark)',
                        fontSize: 'var(--font-size-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>{finalApprovalError}</span>
                    </div>
                  )}

                  {/* Worker Confirmation Card */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 'var(--space-4)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Candidate</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {dossier.workerName}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Worker ID</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {dossier.workerId || dossier.id}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Mobile Number</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {displayMobileNumber}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Service Category</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {dossier.category || 'General'}
                      </strong>
                    </div>
                  </div>

                  {/* Readiness Checklist Card */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  >
                    <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                      Prerequisite Verification Criteria
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                      {mandatoryChecks.map((item, idx) => {
                        const isApproved = item.status === 'APPROVED' || (item.isPreCheck && item.status === 'PASSED');
                        const isNotRequired = !item.required && item.status !== 'APPROVED';
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: isApproved
                                ? 'var(--color-status-success-text)'
                                : isNotRequired
                                  ? 'var(--color-text-secondary)'
                                  : 'var(--color-error)',
                            }}
                          >
                            {isApproved ? (
                              <CheckCircle2 size={14} color="var(--color-status-success-text)" />
                            ) : isNotRequired ? (
                              <CheckCircle2 size={14} color="var(--color-text-tertiary)" />
                            ) : (
                              <AlertTriangle size={14} color="var(--color-error)" />
                            )}
                            <span>
                              {idx + 1}. {item.title}{' '}
                              {isApproved
                                ? (item.isPreCheck ? 'Passed' : 'Approved')
                                : isNotRequired
                                  ? '(Not Required by Protocol)'
                                  : 'Pending Approval'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RBAC Permission Callout if Unauthorized */}
                  {!canApproveWorker && !isHistoricallyVerified && dossier.status !== 'APPROVED' && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-warning-bg)',
                        border: '1px solid var(--color-warning-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-warning-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <Lock size={16} />
                      <span>
                        Permission Restricted: You do not have the required permission (<code>verification.signoff</code>) to execute final approval. Under backend D-90 governance, final worker sign-off and commercial activation are restricted to Operations Admin and Super Admin.
                      </span>
                    </div>
                  )}

                  {/* Already Approved Notice */}
                  {(isHistoricallyVerified || dossier.status === 'APPROVED') && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-status-success-bg)',
                        border: '1px solid var(--color-status-success-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-success-text)',
                      }}
                    >
                      Worker application is already signed off and approved.
                    </div>
                  )}

                  {/* Application Rejected Notice */}
                  {isApplicationRejected && (
                    <div
                      data-testid="application-rejected-notice"
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--color-error-bg)',
                        border: '1px solid var(--color-error-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-error-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>Worker application has been rejected. Platform activation is disabled.</span>
                    </div>
                  )}

                  {/* Terminal Disqualification Banner */}
                  {isApplicationRejected && isTerminalDisqualified && (
                    <div
                      data-testid="terminal-disqualification-banner"
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: '#991b1b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700 }}>
                        <AlertTriangle size={16} color="#dc2626" />
                        <span>Permanent Compliance Disqualification</span>
                      </div>
                      <p style={{ margin: 0, color: '#7f1d1d', lineHeight: 1.4 }}>
                        This worker application was rejected for terminal compliance reasons (criminal record or suspected document tampering). Under platform governance, terminal disqualifications permanently block reconsideration, re-review, and platform activation.
                      </p>
                    </div>
                  )}

                  {/* Reconsideration Eligible Banner */}
                  {isApplicationRejected && !isTerminalDisqualified && (
                    <div
                      data-testid="reconsideration-eligible-banner"
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-4)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                        <RotateCcw size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ display: 'block', marginBottom: '2px', color: '#1e3a8a' }}>
                            Eligible for Reconsideration & Re-Review
                          </strong>
                          <span style={{ color: '#1d4ed8', lineHeight: 1.4 }}>
                            This application was rejected for non-terminal reasons. If the applicant has submitted updated or corrected documentation, an authorized executive may initiate reconsideration to repeat the verification checks.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="reconsider-application-banner-btn"
                        onClick={() => {
                          setReconsiderError(null);
                          setIsConfirmReconsiderOpen(true);
                        }}
                        disabled={reconsiderApplicationMutation.isPending}
                        style={{
                          padding: 'var(--space-2) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          cursor: reconsiderApplicationMutation.isPending ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                        }}
                      >
                        <RotateCcw size={14} />
                        Reconsider Application
                      </button>
                    </div>
                  )}

                  {/* Verification Decision & Audit History Card */}
                  {((dossier.rejectionHistory && dossier.rejectionHistory.length > 0) ||
                    (dossier.reconsiderationHistory && dossier.reconsiderationHistory.length > 0) ||
                    (dossier.approvalHistory && dossier.approvalHistory.length > 0)) && (
                    <div
                      data-testid="verification-audit-trail-card"
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                        <Clock size={16} color="var(--color-text-secondary)" />
                        <h4
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                          }}
                        >
                          Verification Decision & Audit History
                        </h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                        {/* Rejections */}
                        {dossier.rejectionHistory?.map((rej, idx) => (
                          <div
                            key={`rej-s5-${idx}`}
                            data-testid={`audit-rejection-s5-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#fff5f5',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #ef4444',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#b91c1c' }}>
                                • Rejection #{idx + 1}: {rej.reasonCode || 'OPERATIONAL_REJECTION'} {rej.terminal ? '(Permanent Compliance Disqualification)' : '(Eligible for Reconsideration)'}
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(rej.rejectedAt)}
                              </span>
                            </div>
                            {rej.remarks && (
                              <div style={{ color: 'var(--color-text-primary)' }}>
                                <strong>Reason Remarks:</strong> {rej.remarks}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Reconsiderations */}
                        {dossier.reconsiderationHistory?.map((rec, idx) => (
                          <div
                            key={`rec-s5-${idx}`}
                            data-testid={`audit-reconsideration-s5-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#eff6ff',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #3b82f6',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
                                • Reconsideration #{idx + 1} for KYC Re-Review
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(rec.reconsideredAt)}
                              </span>
                            </div>
                            <div style={{ color: 'var(--color-text-primary)' }}>
                              <strong>Executive Rationale:</strong> {rec.remarks}
                            </div>
                          </div>
                        ))}

                        {/* Approvals */}
                        {dossier.approvalHistory?.map((appr, idx) => (
                          <div
                            key={`appr-s5-${idx}`}
                            data-testid={`audit-approval-s5-${idx}`}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#f0fdf4',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '4px solid #22c55e',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: '#15803d' }}>
                                • Approved & Signed Off #{idx + 1}
                              </span>
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                                {formatDateTimeIST(appr.approvedAt)}
                              </span>
                            </div>
                            {appr.remarks && (
                              <div style={{ color: 'var(--color-text-primary)' }}>
                                <strong>Sign-Off Notes:</strong> {appr.remarks}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WIZARD NAVIGATION BAR (AT BOTTOM OF EACH STEP) */}
            {!isOnboardedSuccess && (
              <div
                style={{
                  flexShrink: 0,
                  padding: 'var(--space-3) var(--space-6)',
                  borderTop: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                {/* Left: Previous Button (on steps 2 to 5) */}
                <div>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                  )}
                </div>

                {/* Right: Step-Specific Action Button */}
                <div>
                  {/* Step 1: Next */}
                  {currentStep === 1 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      style={{
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}

                  {/* Step 2: Next */}
                  {currentStep === 2 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      style={{
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}

                  {/* Step 3: Next (blocked if incomplete) */}
                  {currentStep === 3 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!allMandatoryPassed && !hasRejectedCheck && !isHistoricallyVerified && !isApplicationRejected}
                      title={
                        !allMandatoryPassed && !hasRejectedCheck && !isHistoricallyVerified && !isApplicationRejected
                          ? 'All 5 KYC checks and mobile OTP must be approved before proceeding'
                          : 'Proceed to Verification Summary'
                      }
                      style={{
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? 'var(--color-primary)' : 'var(--color-bg-disabled)',
                        color: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? '#ffffff' : 'var(--color-text-disabled)',
                        border: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}

                  {/* Step 4: Continue to Final Approval */}
                  {currentStep === 4 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!allMandatoryPassed && !hasRejectedCheck && !isHistoricallyVerified && !isApplicationRejected}
                      title={
                        !allMandatoryPassed && !hasRejectedCheck && !isHistoricallyVerified && !isApplicationRejected
                          ? 'All mandatory checks must be approved before continuing to final approval'
                          : 'Continue to Final Approval'
                      }
                      style={{
                        padding: 'var(--space-2) var(--space-5)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? 'var(--color-primary)' : 'var(--color-bg-disabled)',
                        color: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? '#ffffff' : 'var(--color-text-disabled)',
                        border: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: (allMandatoryPassed || hasRejectedCheck || isHistoricallyVerified || isApplicationRejected) ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Continue to Final Approval
                      <ChevronRight size={16} />
                    </button>
                  )}

                  {/* Step 5: Final Decision Actions */}
                  {currentStep === 5 && (
                    dossier.status === 'APPROVED' || isHistoricallyVerified ? (
                      <button
                        type="button"
                        onClick={onClose}
                        style={{
                          padding: 'var(--space-2) var(--space-6)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--color-navy)',
                          color: '#ffffff',
                          border: '1px solid var(--color-navy)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        <CheckCircle2 size={16} />
                        Worker Verification Approved — Close Dossier
                      </button>
                    ) : isApplicationRejected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        {canReconsiderApplication && (
                          <button
                            type="button"
                            data-testid="reconsider-application-btn"
                            onClick={() => {
                              setReconsiderError(null);
                              setIsConfirmReconsiderOpen(true);
                            }}
                            disabled={reconsiderApplicationMutation.isPending}
                            style={{
                              padding: 'var(--space-2) var(--space-5)',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: '1px solid #0369a1',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 700,
                              cursor: reconsiderApplicationMutation.isPending ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
                            }}
                          >
                            <RotateCcw size={16} />
                            {reconsiderApplicationMutation.isPending ? 'Reconsidering...' : 'Reconsider Application for Review'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onClose}
                          style={{
                            padding: 'var(--space-2) var(--space-6)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#991b1b',
                            color: '#ffffff',
                            border: '1px solid #7f1d1d',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(153, 27, 27, 0.2)',
                          }}
                        >
                          <X size={16} />
                          {isTerminalDisqualified ? 'Worker Application Disqualified — Close Dossier' : 'Worker Application Rejected — Close Dossier'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        {canRejectApplication && (
                          <button
                            type="button"
                            data-testid="reject-application-btn"
                            onClick={() => {
                              setRejectApplicationError(null);
                              setIsConfirmRejectApplicationOpen(true);
                            }}
                            disabled={rejectApplicationMutation.isPending}
                            style={{
                              padding: 'var(--space-2) var(--space-5)',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: '1px solid #b91c1c',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 700,
                              cursor: rejectApplicationMutation.isPending ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                            }}
                          >
                            <X size={16} />
                            {rejectApplicationMutation.isPending ? 'Rejecting...' : 'Reject Application'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsConfirmFinalApproveOpen(true)}
                          disabled={
                            !allMandatoryPassed ||
                            !canApproveWorker ||
                            finalApproveMutation.isPending
                          }
                          title={
                            !allMandatoryPassed
                              ? 'All mandatory checks must be approved before final sign-off'
                              : !canApproveWorker
                                ? 'Missing permission to approve worker'
                                : 'Approve and onboard worker'
                          }
                          style={{
                            padding: 'var(--space-2) var(--space-6)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor:
                              allMandatoryPassed && canApproveWorker
                                ? 'var(--color-success)'
                                : '#e2e8f0',
                            color:
                              allMandatoryPassed && canApproveWorker
                                ? '#ffffff'
                                : '#475569',
                            border:
                              allMandatoryPassed && canApproveWorker
                                ? '1px solid #15803d'
                                : '1px solid #cbd5e1',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 700,
                            cursor:
                              allMandatoryPassed && canApproveWorker && !finalApproveMutation.isPending
                                ? 'pointer'
                                : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow:
                              allMandatoryPassed && canApproveWorker
                                ? '0 2px 6px rgba(22, 163, 74, 0.3)'
                                : 'none',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          {finalApproveMutation.isPending ? 'Approving Worker...' : 'Approve Verification Worker'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Document Preview Overlay Modal */}
        {isDocPreviewOpen && activeDoc && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Document Preview Overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(3px)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-4)',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDocPreviewOpen(false);
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '920px',
                height: '86vh',
                maxHeight: '780px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header with Title, Status & Close X */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--color-border)',
                  padding: 'var(--space-4) var(--space-5)',
                  backgroundColor: 'var(--color-surface)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <FileText size={22} color="var(--color-primary)" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 'var(--font-size-md)',
                          fontWeight: 700,
                          color: 'var(--color-navy)',
                        }}
                      >
                        {activeDocMetadata?.documentTypeName || 'Submitted Document Inspection'}
                      </h3>
                      <StatusBadge
                        status={
                          (activeDoc.checkType && dossier?.checks?.[activeDoc.checkType]?.status) ||
                          activeDoc.status ||
                          'SUBMITTED'
                        }
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Check: {activeDoc.checkTitle || activeDoc.checkType} • Worker: {activeDocMetadata?.nameOnDoc || dossier?.workerName || 'Applicant'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="close-document-preview-overlay"
                  aria-label="Close document preview"
                  onClick={() => setIsDocPreviewOpen(false)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    padding: '6px',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Document Metadata Ribbon */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 'var(--space-3)',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  padding: 'var(--space-3) var(--space-5)',
                  borderBottom: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document Type</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    {activeDocMetadata?.documentTypeName || 'Document Type Unavailable'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document ID</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    {activeDocId || 'Unavailable'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document Number (Masked)</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    {activeDocMetadata?.docNumberMasked || 'Unavailable'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Format & Size</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    {activeDocMetadata?.contentType || activeDocMetadata?.mimeType || 'application/pdf'}
                    {activeDocMetadata?.sizeBytes ? ` (${Math.round(activeDocMetadata.sizeBytes / 1024)} KB)` : ''}
                  </strong>
                </div>
              </div>

              {/* Secure Document Viewer Frame */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc',
                  position: 'relative',
                }}
              >
                {/* Confidentiality Notice Bar & External Link */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#94a3b8',
                    padding: '8px var(--space-5)',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #1e293b',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#38bdf8" />
                    CONFIDENTIAL KYC ATTACHMENT • Authorized Document Vault Record • Watermarked for Confidential Inspection
                  </span>
                  {signedDocUrlData?.signedUrl && (
                    <a
                      href={signedDocUrlData.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="open-document-new-tab"
                      aria-label="Open Secure Document Link in new tab"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#38bdf8',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Open Secure Document Link (Open in New Tab)
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Viewport Core Content */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {!canViewDocuments && (
                    <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                      <Lock size={36} color="var(--color-warning)" style={{ margin: '0 auto var(--space-2)' }} />
                      <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>Restricted Personal Document (KYC)</h4>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '420px' }}>
                        Access requires authorized document inspection privileges (documents.view_restricted).
                      </p>
                    </div>
                  )}

                  {canViewDocuments && isLoadingSignedDocUrl && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                      <LoadingSpinner message="Retrieving authorized document from secure vault..." />
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px' }}>
                        Communicating with authorized storage vault...
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsDocPreviewOpen(false)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 14px',
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {canViewDocuments && isErrorSignedDocUrl && !isLoadingSignedDocUrl && (() => {
                    const formattedErr = formatDocumentVaultError(signedDocUrlError);
                    return (
                      <div
                        data-testid="document-vault-error-container"
                        style={{
                          maxWidth: '480px',
                          padding: 'var(--space-5)',
                          backgroundColor: 'var(--color-surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          boxShadow: 'var(--shadow-sm)',
                          textAlign: 'center',
                        }}
                      >
                        <AlertTriangle size={36} color="var(--color-error)" style={{ margin: '0 auto var(--space-2)' }} />
                        <h4 style={{ margin: '0 0 6px 0', color: 'var(--color-error-dark)', fontSize: 'var(--font-size-sm)' }}>
                          {formattedErr.title.includes('Document Access Failed') ? formattedErr.title : `Document Access Failed — ${formattedErr.title}`}
                        </h4>
                        <p style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                          {formattedErr.message}
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                          {formattedErr.canRetry && (
                            <button
                              type="button"
                              onClick={() => refetchSignedDocUrl()}
                              aria-label="Retry Fetching Document — Retry Document Access"
                              style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-surface)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <RefreshCw size={12} />
                              Retry Document Access
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsDocPreviewOpen(false)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {canViewDocuments && !isLoadingSignedDocUrl && !isErrorSignedDocUrl && signedDocUrlData && (
                    <div
                      data-testid="vault-document-inspection-viewer"
                      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                      <div
                        style={{
                          backgroundColor: '#e2e8f0',
                          padding: '6px var(--space-5)',
                          fontSize: '11px',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid #cbd5e1',
                          flexShrink: 0,
                        }}
                      >
                        <strong style={{ color: '#1e293b' }}>Authorized Document Vault Inspection</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Validity: {signedDocUrlData.expiresAt || '2026-10-25T18:00:00Z'}
                        </span>
                      </div>

                      {/* Genuine Document Display with Support for PDF and Images */}
                      {signedDocUrlData.signedUrl ? (() => {
                        const docMimeType = (
                          signedDocUrlData.mimeType ||
                          activeDocMetadata?.mimeType ||
                          activeDocMetadata?.contentType ||
                          ''
                        ).toLowerCase();
                        const isImage =
                          docMimeType.startsWith('image/') ||
                          Boolean(signedDocUrlData.signedUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i));

                        if (isImage) {
                          return imageLoadError ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', textAlign: 'center', backgroundColor: '#0f172a', color: '#ffffff' }}>
                              <AlertTriangle size={32} color="var(--color-warning)" style={{ marginBottom: '8px' }} />
                              <strong style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                                Image Preview Unavailable directly in viewer
                              </strong>
                              <p style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8', margin: '0 0 12px 0' }}>
                                The storage URL may have restricted framing or CORS policies. Use the direct link below.
                              </p>
                              <a
                                href={signedDocUrlData.signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#38bdf8',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                }}
                              >
                                Open Document Directly in New Tab
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ) : (
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 'var(--space-4)',
                                overflow: 'auto',
                                backgroundColor: '#0f172a',
                              }}
                            >
                              <img
                                data-testid="kyc-document-image"
                                src={signedDocUrlData.signedUrl}
                                alt="Submitted KYC Document"
                                onError={() => setImageLoadError(true)}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                  borderRadius: 'var(--radius-sm)',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                }}
                              />
                            </div>
                          );
                        }

                        return (
                          <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
                            <object
                              data-testid="kyc-document-pdf"
                              data={signedDocUrlData.signedUrl}
                              type={docMimeType || 'application/pdf'}
                              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
                            >
                              <iframe
                                src={signedDocUrlData.signedUrl}
                                title="PDF document preview"
                                style={{ width: '100%', height: '100%', border: 'none' }}
                              />
                            </object>
                          </div>
                        );
                      })() : (
                        <div
                          data-testid="document-vault-error-container"
                          style={{
                            margin: 'auto',
                            padding: 'var(--space-5)',
                            textAlign: 'center',
                            maxWidth: '420px',
                          }}
                        >
                          <AlertTriangle size={32} color="var(--color-warning)" style={{ margin: '0 auto var(--space-2)' }} />
                          <h4 style={{ margin: '0 0 6px 0', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                            Document Attachment Unavailable
                          </h4>
                          <p style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            No active secure URL was returned by the storage vault.
                          </p>
                          <button
                            type="button"
                            onClick={() => refetchSignedDocUrl()}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Retry Fetching Document
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {canViewDocuments && !isLoadingSignedDocUrl && !isErrorSignedDocUrl && !signedDocUrlData && !activeDocId && (
                    <div
                      data-testid="verification-doc-missing-id"
                      style={{
                        padding: 'var(--space-5)',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-xs)',
                        maxWidth: '420px',
                        margin: 'auto',
                      }}
                    >
                      <AlertTriangle size={32} color="var(--color-warning)" style={{ margin: '0 auto var(--space-2)' }} />
                      <strong style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                        Document Not Available
                      </strong>
                      <p style={{ margin: 0 }}>
                        No document file is attached to this verification check.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Decision Actions in Overlay */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                    Decision for {activeDoc.documentTypeName}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    Check: {activeDoc.checkTitle || activeDoc.checkType} • Status: {(activeDoc.checkType && dossier?.checks?.[activeDoc.checkType]?.status) || activeDoc.status || 'SUBMITTED'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  {canDecide && activeDoc.checkType && dossier?.checks?.[activeDoc.checkType]?.status !== 'APPROVED' && (() => {
                    const chk = dossier?.checks?.[activeDoc.checkType];
                    const rawCheckId = chk?.id || chk?.checkId || activeDoc.checkId;
                    const targetCheckId = rawCheckId && typeof rawCheckId === 'string' && rawCheckId.trim() !== '' ? rawCheckId.trim() : '';

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (!targetCheckId) return;
                            setCheckToApprove({
                              checkId: targetCheckId,
                              checkType: activeDoc.checkType!,
                              title: activeDoc.checkTitle || activeDoc.documentTypeName,
                              existingReference: chk?.documentMetadata?.docNumberMasked || chk?.referenceNumber,
                              existingExpiry: chk?.documentMetadata?.expiryDate || chk?.expiresOn,
                            });
                            if (activeDoc.checkType === 'REFERENCE') {
                              setCallNotesInput(chk?.contactDetails?.callNotes || dossier?.previousEmployer?.feedback || '');
                            } else if (activeDoc.checkType === 'POLICE_CLEARANCE') {
                              setReferenceNumberInput(chk?.documentMetadata?.docNumberMasked || chk?.referenceNumber || '');
                              setExpiryDateInput(chk?.documentMetadata?.expiryDate || chk?.expiresOn || '');
                            }
                            setApprovalValidationError(null);
                          }}
                          disabled={!targetCheckId || approveCheckMutation.isPending}
                          title={!targetCheckId ? 'Check UUID not yet assigned by backend' : 'Approve Check'}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: !targetCheckId ? 'var(--color-bg-disabled)' : 'var(--color-success)',
                            color: !targetCheckId ? 'var(--color-text-disabled)' : '#ffffff',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: !targetCheckId ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={14} />
                          Approve Check
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!targetCheckId) return;
                            setCheckToReject({
                              checkId: targetCheckId,
                              checkType: activeDoc.checkType!,
                              title: activeDoc.checkTitle || activeDoc.documentTypeName,
                            });
                          }}
                          disabled={!targetCheckId || rejectCheckMutation.isPending}
                          title={!targetCheckId ? 'Check UUID not yet assigned by backend' : 'Reject Check'}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: !targetCheckId ? 'var(--color-bg-disabled)' : 'var(--color-error)',
                            color: !targetCheckId ? 'var(--color-text-disabled)' : '#ffffff',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: !targetCheckId ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <X size={14} />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!targetCheckId) return;
                            setRecheckCheckId(targetCheckId);
                            setRecheckCheckType(activeDoc.checkType!);
                            setIsRecheckDialogOpen(true);
                          }}
                          disabled={!targetCheckId || requestRecheckMutation.isPending}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: !targetCheckId ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RefreshCw size={14} />
                          Request Re-Verification
                        </button>
                      </>
                    );
                  })()}
                  {(isHistoricallyVerified || (activeDoc.checkType && dossier?.checks?.[activeDoc.checkType]?.status === 'APPROVED')) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-status-success-bg)',
                        border: '1px solid var(--color-status-success-border)',
                        color: 'var(--color-status-success-text)',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={12} />
                      Verified & Approved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDocPreviewOpen(false)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DIALOGS */}

        {/* Single Check Approval Confirm Dialog */}
        <ConfirmDialog
          isOpen={!!checkToApprove}
          title={`Approve ${checkToApprove?.title || 'Check'}`}
          description={`Are you sure you want to mark ${checkToApprove?.title || 'this check'} as verified and approved?`}
          confirmLabel={approveCheckMutation.isPending ? 'Approving...' : 'Confirm Approval'}
          isLoading={approveCheckMutation.isPending}
          showRemarks={checkToApprove?.checkType !== 'REFERENCE'}
          remarksPlaceholder="Enter notes on verification findings (optional)..."
          errorMessage={approvalValidationError}
          onConfirm={(remarks) => {
            if (checkToApprove) {
              if (checkToApprove.checkType === 'REFERENCE') {
                if (!callNotesInput.trim()) {
                  setApprovalValidationError(
                    'Employer Reference approval requires actual call notes (check: callNote) documenting the reference check outcome.'
                  );
                  return;
                }
              }
              setApprovalValidationError(null);
              approveCheckMutation.mutate({
                checkId: checkToApprove.checkId,
                checkType: checkToApprove.checkType,
                notes:
                  remarks ||
                  checkApproveNotes ||
                  (checkToApprove.checkType === 'REFERENCE'
                    ? callNotesInput.trim()
                    : 'Verified authentic by Verification Executive'),
                metadata: {
                  callNotes: callNotesInput.trim() || undefined,
                  referenceNumber: referenceNumberInput.trim() || undefined,
                  expiresOn: expiryDateInput.trim() || undefined,
                },
              });
            }
          }}
          onCancel={() => {
            setCheckToApprove(null);
            setCheckApproveNotes('');
            setCallNotesInput('');
            setReferenceNumberInput('');
            setExpiryDateInput('');
            setApprovalValidationError(null);
          }}
        >
          {checkToApprove?.checkType === 'REFERENCE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <label
                htmlFor="verification-call-notes-input"
                style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                Employer Reference Call Outcome / Call Notes <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Backend validation rule requires verification call notes before Previous Employment check can be approved.
              </p>
              <textarea
                id="verification-call-notes-input"
                data-testid="verification-call-notes-input"
                value={callNotesInput}
                onChange={(e) => {
                  setCallNotesInput(e.target.value);
                  if (approvalValidationError) setApprovalValidationError(null);
                }}
                rows={3}
                placeholder="Enter call outcome with previous employer (e.g., Contacted employer, confirmed employment duration and good conduct)..."
                style={{
                  backgroundColor: 'var(--color-bg-app)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  padding: 'var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {checkToApprove?.checkType === 'POLICE_CLEARANCE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                For Police Certificate verification, provide the certificate or manual clearance reference details:
              </p>
              <div>
                <label
                  htmlFor="police-ref-number-input"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}
                >
                  Police Clearance / Certificate Reference Number
                </label>
                <input
                  id="police-ref-number-input"
                  data-testid="police-ref-number-input"
                  type="text"
                  value={referenceNumberInput}
                  onChange={(e) => setReferenceNumberInput(e.target.value)}
                  placeholder="e.g. PCC-2025-XXXXX or Station Ref"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="police-expiry-date-input"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}
                >
                  Certificate Expiration Date
                </label>
                <input
                  id="police-expiry-date-input"
                  data-testid="police-expiry-date-input"
                  type="date"
                  value={expiryDateInput}
                  onChange={(e) => setExpiryDateInput(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--color-bg-app)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}
        </ConfirmDialog>

        {/* Single Check Rejection Dialog */}
        <ConfirmDialog
          isOpen={!!checkToReject}
          title={`Reject ${checkToReject?.title || 'Check'}`}
          description="Rejecting this check will notify the domestic worker to provide corrected documentation."
          confirmLabel={rejectCheckMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
          isDestructive={true}
          requireRemarks={true}
          remarksPlaceholder="Enter mandatory operational remarks..."
          isLoading={rejectCheckMutation.isPending}
          errorMessage={rejectionError || undefined}
          onConfirm={(remarks) => {
            const finalRemarks = (remarks || rejectionRemarks || '').trim();
            if (rejectionCategory === 'OTHER' && !finalRemarks) {
              setRejectionError('Mandatory remarks explanation is required when selecting rejection reason OTHER.');
              return;
            }
            if (checkToReject) {
              setRejectionError(null);
              rejectCheckMutation.mutate({
                checkId: checkToReject.checkId,
                checkType: checkToReject.checkType,
                category: rejectionCategory,
                remarks: finalRemarks,
              });
            }
          }}
          onCancel={() => {
            setCheckToReject(null);
            setRejectionRemarks('');
            setRejectionError(null);
          }}
        >
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Rejection Category: *
            </label>
            <CustomSelect
              value={rejectionCategory}
              onChange={(val) => {
                setRejectionCategory(val as RejectionReasonCategory);
                setRejectionError(null);
              }}
              options={REJECTION_CATEGORIES.map((cat) => ({ value: cat.key, label: cat.label }))}
              width="100%"
            />

            {isTerminalRejectionCode(rejectionCategory) && (
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

            {rejectionCategory === 'OTHER' && (
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

        {/* Request Re-Verification Dialog */}
        <ConfirmDialog
          isOpen={isRecheckDialogOpen}
          title={`Request Document Re-Verification: ${recheckCheckType}`}
          description="Issue a re-verification request to prompt the domestic worker to re-upload documents."
          confirmLabel={requestRecheckMutation.isPending ? 'Requesting...' : 'Issue Re-Verification Request'}
          requireRemarks={true}
          remarksPlaceholder="Enter mandatory instructions for the worker..."
          isLoading={requestRecheckMutation.isPending}
          onConfirm={(remarks) => {
            if (recheckCheckId && remarks) {
              requestRecheckMutation.mutate({
                checkId: recheckCheckId,
                checkTypes: [recheckCheckType],
                instructions: remarks,
              });
            }
          }}
          onCancel={() => {
            setIsRecheckDialogOpen(false);
          }}
        />

        {/* Final Approval Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isConfirmFinalApproveOpen}
          title="Confirm Worker Approval & Platform Onboarding"
          description="You are about to approve worker verification and activate this worker on the live SevaNest platform roster."
          confirmLabel={finalApproveMutation.isPending ? 'Approving...' : 'Confirm Final Approval'}
          isLoading={finalApproveMutation.isPending}
          errorMessage={finalApprovalError}
          onConfirm={() => {
            if (dossier?.workerId) {
              setFinalApprovalError(null);
              finalApproveMutation.mutate({
                workerId: dossier.workerId,
                notes: finalApprovalNotes || 'All 6 KYC verification checks approved under standard protocol',
              });
            }
          }}
          onCancel={() => {
            setIsConfirmFinalApproveOpen(false);
            setFinalApprovalNotes('');
            setFinalApprovalError(null);
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
              Are you sure you want to approve <strong>{dossier?.workerName}</strong> (Worker ID: <strong>{dossier?.workerId}</strong>)?
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              This will submit final supervisor verification sign-off and activate the worker on the SevaNest platform commercial roster.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                Supervisor Sign-Off Remarks (Optional):
              </label>
              <textarea
                value={finalApprovalNotes}
                onChange={(e) => setFinalApprovalNotes(e.target.value)}
                placeholder="Enter formal sign-off remarks..."
                style={{
                  width: '100%',
                  minHeight: '70px',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </ConfirmDialog>

        {/* Reject Application Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isConfirmRejectApplicationOpen}
          title={`Reject Application: ${dossier?.workerName || 'Worker'}`}
          description="This will formally reject the entire domestic worker application at the platform level. The applicant will be notified with the selected reason and explanation remarks."
          confirmLabel={rejectApplicationMutation.isPending ? 'Rejecting Application...' : 'Confirm Reject Application'}
          isDestructive={true}
          requireRemarks={true}
          remarksPlaceholder="Enter mandatory rejection remarks / rationale (minimum 5 characters)..."
          isLoading={rejectApplicationMutation.isPending}
          errorMessage={rejectApplicationError}
          onConfirm={(remarks) => {
            const finalRemarks = (remarks || rejectApplicationRemarks || '').trim();
            if (!finalRemarks || finalRemarks.length < 5) {
              setRejectApplicationError('Mandatory remarks must be at least 5 characters explaining the rejection rationale.');
              return;
            }
            if (dossier?.workerId || dossierId) {
              setRejectApplicationError(null);
              rejectApplicationMutation.mutate({
                workerId: dossier?.workerId || dossierId,
                category: rejectApplicationCategory,
                remarks: finalRemarks,
              });
            }
          }}
          onCancel={() => {
            setIsConfirmRejectApplicationOpen(false);
            setRejectApplicationRemarks('');
            setRejectApplicationError(null);
          }}
        >
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <label
              htmlFor="reject-app-reason-category-select"
              style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}
            >
              Rejection Reason Code / Category: <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <CustomSelect
              id="reject-app-reason-category-select"
              testId="reject-app-reason-category-select"
              value={rejectApplicationCategory}
              onChange={(val) => {
                setRejectApplicationCategory(val as RejectionReasonCategory);
                if (rejectApplicationError) setRejectApplicationError(null);
              }}
              options={REJECTION_CATEGORIES.map((cat) => ({
                value: cat.key,
                label: `${cat.label} (${cat.key})`,
              }))}
              width="100%"
            />
          </div>
        </ConfirmDialog>

        {/* Reconsider Application Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isConfirmReconsiderOpen}
          title={`Reconsider Application: ${dossier?.workerName || 'Worker'}`}
          description="Initiate reconsideration and repeat the KYC verification workflow for this domestic worker. Previously rejected checks will be placed in SUBMITTED state for thorough inspection, and all decisions are preserved in the permanent audit trail."
          confirmLabel={reconsiderApplicationMutation.isPending ? 'Reconsidering...' : 'Confirm Reconsideration'}
          isDestructive={false}
          requireRemarks={true}
          remarksPlaceholder="Enter mandatory justification/rationale for reconsideration (minimum 5 characters)..."
          isLoading={reconsiderApplicationMutation.isPending}
          errorMessage={reconsiderError}
          onConfirm={(remarks) => {
            const finalRemarks = (remarks || reconsiderRemarks || '').trim();
            if (!finalRemarks || finalRemarks.length < 5) {
              setReconsiderError('Mandatory remarks must be at least 5 characters explaining the reconsideration rationale.');
              return;
            }
            if (dossier?.workerId || dossierId) {
              setReconsiderError(null);
              reconsiderApplicationMutation.mutate({
                workerId: dossier?.workerId || dossierId,
                remarks: finalRemarks,
              });
            }
          }}
          onCancel={() => {
            setIsConfirmReconsiderOpen(false);
            setReconsiderRemarks('');
            setReconsiderError(null);
          }}
        />
      </div>
    </div>
  );
};
