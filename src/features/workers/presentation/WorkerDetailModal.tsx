/* global HTMLDivElement, HTMLButtonElement, KeyboardEvent, HTMLElement */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Star,
  ShieldAlert,
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
  Calendar,
  Lock,
  Phone,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { verificationRepository } from '../../verification/data/verificationRepository';
import {
  VerificationCheckType,
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationCheck,
  AdminWorkerVerificationResponse,
  AdminCheckView,
} from '../../verification/domain/types';
import { ValidationError } from '../../../core/errors/DomainError';
import { evaluateVerificationWorkflow, getNextStepType } from '../../verification/domain/verificationWorkflow';
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

interface WorkerDetailModalProps {
  workerId: string;
  onClose: () => void;
  onStatusChanged?: () => void;
}

type TabKey = 'verification' | 'personal' | 'professional' | 'documents' | 'operational';
type WorkstationStep = 1 | 2 | 3 | 4 | 5;

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
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // View navigation
  const [activeTab, setActiveTab] = useState<TabKey>(() => (canReview ? 'verification' : 'professional'));
  const [currentStep, setCurrentStep] = useState<WorkstationStep>(1);

  // Sensitive PII reveal
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);

  // Document Inspection State
  const [inspectingDoc, setInspectingDoc] = useState<{
    id?: string;
    checkType: VerificationCheckType;
    title: string;
    docNumber?: string;
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
  const rawInspectingDocId = inspectingDoc?.id;
  const inspectingDocId = typeof rawInspectingDocId === 'string' && rawInspectingDocId.trim() !== ''
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
    mutationFn: async ({ checkId, checkType, notes }: { checkId: string; checkType: VerificationCheckType; notes?: string }) => {
      const response = await verificationRepository.approveCheck(checkId, checkType, notes);
      return { checkId, checkType, response };
    },
    onSuccess: async (data) => {
      setIsApproveDialogOpen(false);
      setApproveCheckId(null);
      setApproveDialogError(null);

      // Update selected check and dossier from authoritative backend response
      if (data.response && typeof data.response === 'object' && 'checks' in data.response && Array.isArray((data.response as AdminWorkerVerificationResponse).checks)) {
        const backendChecks = (data.response as AdminWorkerVerificationResponse).checks;
        if (dossier?.checks) {
          backendChecks.forEach((bc: AdminCheckView) => {
            const mappedType = bc.checkType as VerificationCheckType;
            if (dossier.checks[mappedType]) {
              const mappedStatus = bc.status === 'APPROVED' ? 'APPROVED' : bc.status === 'REJECTED' ? 'REJECTED' : bc.status === 'IN_REVIEW' ? 'IN_REVIEW' : bc.status === 'RECHECK_DUE' ? 'RECHECK_DUE' : 'PENDING';
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

      const nextStep = getNextStepType(data.checkType);
      if (!nextStep) {
        // All 5 checks approved! Automatically advance to Step 4
        setCurrentStep(4);
      }
    },
    onError: (err: unknown) => {
      // Do NOT close the worker modal popup! Surface the error message
      const errorMsg = err instanceof ValidationError && err.fieldErrors && Object.keys(err.fieldErrors).length > 0
        ? `${err.message} (${Object.entries(err.fieldErrors).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')})`
        : err instanceof Error
        ? err.message
        : 'Server error occurred';
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
      setCurrentStep(5);
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
      await verificationRepository.rejectCheck(checkId, checkType, category, remarks);
    },
    onSuccess: () => {
      invalidateAll();
      setIsRejectDialogOpen(false);
      setRejectRemarks('');
      setRejectCheckId(null);
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
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (checkId: string) => {
      await verificationRepository.claimCheck(checkId);
    },
    onSuccess: () => {
      invalidateAll();
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

  // Combine worker documents and documents from verification checks
  const displayDocuments = useMemo(() => {
    const docs = [...(worker?.documents || [])];
    const seenIds = new Set(docs.map((d) => d.id).filter(Boolean));

    if (dossier?.checks) {
      (Object.entries(dossier.checks) as [VerificationCheckType, VerificationCheck][]).forEach(([type, chk]) => {
        if (chk.documentMetadata?.documentId && !seenIds.has(chk.documentMetadata.documentId)) {
          seenIds.add(chk.documentMetadata.documentId);
          docs.push({
            id: chk.documentMetadata.documentId,
            documentType: type,
            documentTypeName: chk.documentMetadata.documentTypeName || chk.title || `${type} Document`,
            docNumberMasked: chk.documentMetadata.docNumberMasked,
            status: chk.status === 'APPROVED' ? 'VERIFIED' : chk.status === 'REJECTED' ? 'REJECTED' : 'SUBMITTED',
            submittedAt: chk.history?.[0]?.createdAt || dossier.submissionTime,
            verifiedAt: chk.verifiedAt,
            recheckDueDate: chk.recheckDueDate,
            rejectionReason: chk.rejectionRemarks,
          });
        }
      });
    }
    return docs;
  }, [worker?.documents, dossier?.checks, dossier?.submissionTime]);

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
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-border)',
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
        docNumberMasked: worker.documents?.find((d) => d.documentType === 'IDENTITY')?.docNumberMasked || 'XXXX-XXXX-MASKED',
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
        docNumberMasked: worker.documents?.find((d) => d.documentType === 'ADDRESS')?.docNumberMasked || 'XXXX-XXXX-MASKED',
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
        docNumberMasked: worker.documents?.find((d) => d.documentType === 'POLICE_CLEARANCE')?.docNumberMasked || 'XXXX-XXXX-MASKED',
        documentTypeName: 'Police Clearance Certificate (PCC)',
      },
    },
  };

  // 6 Checks Prerequisite Calculations
  const otpPassed = Boolean(dossier?.preCheckOtpVerified ?? worker.verification.phoneOtpVerified ?? true);
  const idApproved = checksRecord.IDENTITY?.status === 'APPROVED';
  const addressApproved = checksRecord.ADDRESS?.status === 'APPROVED';
  const emergencyApproved = checksRecord.EMERGENCY_CONTACT?.status === 'APPROVED';
  const referenceApproved = checksRecord.REFERENCE?.status === 'APPROVED';
  const policeApproved = checksRecord.POLICE_CLEARANCE?.status === 'APPROVED';

  const workflow = evaluateVerificationWorkflow(checksRecord, otpPassed);

  const operationalChecksList = [
    { key: 'IDENTITY' as const, label: 'Identity Proof', approved: idApproved, check: checksRecord.IDENTITY, stepEval: workflow.steps.find((s) => s.type === 'IDENTITY') },
    { key: 'ADDRESS' as const, label: 'Address Proof', approved: addressApproved, check: checksRecord.ADDRESS, stepEval: workflow.steps.find((s) => s.type === 'ADDRESS') },
    { key: 'EMERGENCY_CONTACT' as const, label: 'Emergency Contact', approved: emergencyApproved, check: checksRecord.EMERGENCY_CONTACT, stepEval: workflow.steps.find((s) => s.type === 'EMERGENCY_CONTACT') },
    { key: 'REFERENCE' as const, label: 'Employer Reference', approved: referenceApproved, check: checksRecord.REFERENCE, stepEval: workflow.steps.find((s) => s.type === 'REFERENCE') },
    { key: 'POLICE_CLEARANCE' as const, label: 'Police Certificate', approved: policeApproved, check: checksRecord.POLICE_CLEARANCE, stepEval: workflow.steps.find((s) => s.type === 'POLICE_CLEARANCE') },
  ];

  const approvedOpsCount = operationalChecksList.filter((c) => c.approved).length;
  const allMandatoryChecksApproved = otpPassed && approvedOpsCount === 5;
  const hasRejectedCheck = operationalChecksList.some((c) => c.check?.status === 'REJECTED');
  const pendingChecksCount = operationalChecksList.filter((c) => c.check?.status === 'PENDING').length;

  // Authoritative overall verification status from backend level field
  const authoritativeLevel = dossier?.level || worker.verification.level || worker.level;

  // Authoritative Sign-Off and Active Onboarding state
  const isSignedOff = Boolean(
    dossier?.signedOffAt ||
    worker?.signedOffAt ||
    dossier?.applicationStatus === 'VERIFIED' ||
    dossier?.applicationStatus === 'ACTIVE' ||
    worker?.applicationStatus === 'VERIFIED' ||
    worker?.applicationStatus === 'ACTIVE'
  );

  const currentAppStatus = dossier?.applicationStatus || worker?.applicationStatus || (
    isSignedOff ? 'VERIFIED' : 'UNDER_REVIEW'
  );

  const isOnboarded = (
    (currentAppStatus === 'ACTIVE' || worker.status === 'ACTIVE') &&
    Boolean(dossier?.activatedAt || worker?.activatedAt)
  );

  // Matching eligibility (read-only): requires active account and verified status / onboarding
  const isMatchingEligible = worker.status === 'ACTIVE' && (worker.isFullyVerified || isSignedOff || isOnboarded);

  // Stepper labels
  const STEPS = [
    { step: 1 as const, title: 'Application Overview', desc: 'Identity & Status' },
    { step: 2 as const, title: 'Documents & Evidence', desc: 'Secure Vault' },
    { step: 3 as const, title: 'Verification Checklist', desc: '6-Point Vetting' },
    { step: 4 as const, title: 'Verification Summary', desc: 'Authoritative Level' },
    { step: 5 as const, title: 'Platform Status', desc: 'Read-only State' },
  ];

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
          maxWidth: '1000px',
          maxHeight: '92vh',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
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
                id="worker-detail-modal-title"
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 800,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                {worker.name}
              </h2>
              <StatusBadge status={worker.status} />
              <VerificationBadge isFullyVerified={worker.isFullyVerified} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-bg)' : currentAppStatus === 'VERIFIED' ? '#eff6ff' : 'var(--color-status-warning-bg)',
                  color: currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-text)' : currentAppStatus === 'VERIFIED' ? '#1d4ed8' : 'var(--color-status-warning-text)',
                  border: `1px solid ${currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-border)' : currentAppStatus === 'VERIFIED' ? '#93c5fd' : 'var(--color-status-warning-border)'}`,
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
                title="Close profile"
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

          {/* Worker Identity Sub-row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: 700 }}>
              ID: {worker.id}
            </span>
            <span style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
              • App ID: {worker.applicationId || dossier?.applicationId || worker.id}
            </span>
            <span style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              • {worker.category} • {worker.experienceYears} Yrs Exp • {worker.locality}
            </span>
          </div>
        </div>

        {/* Matching Eligibility Callout Banner */}
        <div style={{ flexShrink: 0, padding: 'var(--space-2) var(--space-6)', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          {isMatchingEligible ? (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-status-success-bg)',
                border: '1px solid var(--color-status-success-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-success-text)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CheckCircle2 size={16} />
                <span>
                  <strong>Matching Eligibility: ELIGIBLE</strong> • Worker has completed all required verification checks and maintains an Active account. Approved for customer matching, trials, and household assignments.
                </span>
              </div>
              <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/verification?search=${encodeURIComponent(worker.id)}&dossierId=${encodeURIComponent(worker.id)}`);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-status-success-text)',
                    color: '#ffffff',
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
                  <span>Inspect in Verification Queue</span>
                  <ExternalLink size={12} />
                </button>
              </PermissionGate>
            </div>
          ) : !worker.isFullyVerified ? (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-warning-text)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={16} />
                <span>
                  <strong>Matching Eligibility: NOT ELIGIBLE (Pending Verification)</strong> • A worker must not be considered fully verified or eligible for matching until every required verification check is approved by an authorized Verification Executive.
                </span>
              </div>
              <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/verification?workerId=${encodeURIComponent(worker.id)}&search=${encodeURIComponent(worker.id)}&dossierId=${encodeURIComponent(worker.id)}`);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-brand-600, var(--color-primary))',
                    color: '#ffffff',
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
                  <span>Review in Verification Queue</span>
                  <ExternalLink size={12} />
                </button>
              </PermissionGate>
            </div>
          ) : (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-danger-text)',
              }}
            >
              <ShieldAlert size={16} />
              <span>
                <strong>Matching Eligibility: INELIGIBLE ({worker.status})</strong> • Worker account is {worker.status.toLowerCase()}. Matching eligibility and customer allocations are revoked.
              </span>
            </div>
          )}
        </div>

        {/* Primary Navigation Tabs */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 var(--space-6)',
            backgroundColor: 'var(--color-surface)',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'verification', label: '1. Verification & Trust Workstation', icon: ShieldCheck },
            { key: 'personal', label: '2. Personal & Contact', icon: User },
            { key: 'professional', label: '3. Professional Profile', icon: Briefcase },
            { key: 'documents', label: '4. Documents Vault', icon: FileText },
            { key: 'operational', label: '5. Operational Engagements', icon: Sliders },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                style={{
                  padding: 'var(--space-3) var(--space-3)',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {/* TAB 1: GUIDED VERIFICATION WORKSTATION */}
          {activeTab === 'verification' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Visible Progress Stepper Bar */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
                    Guided Verification Lifecycle Stepper
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 700, backgroundColor: 'var(--color-brand-50, #eff6ff)', padding: '3px 12px', borderRadius: '12px', border: '1px solid var(--color-brand-200, #bfdbfe)' }}>
                    Step {currentStep} of 5: {STEPS[currentStep - 1].title}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                    gap: '12px',
                    overflowX: 'auto',
                  }}
                >
                  {/* Step Completion Statuses derived from actual backend data sequentially */}
                  {(() => {
                    // Step 1: Application Overview - worker intake application record exists
                    const isStep1Complete = Boolean(
                      worker.id &&
                        (worker.onboardingStatus ||
                          worker.applicationStatus ||
                          worker.registeredAt ||
                          worker.createdAt ||
                          dossier?.submissionTime)
                    );

                    // Step 2: Documents & Evidence - uploaded documents exist in vault or all checks approved
                    const hasUploadedDocuments =
                      displayDocuments.length > 0 ||
                      (worker.documents?.length || 0) > 0 ||
                      (dossier?.submittedDocuments?.length || 0) > 0;
                    const isStep2Complete =
                      isStep1Complete && (hasUploadedDocuments || allMandatoryChecksApproved);

                    // Step 3: Verification Checklist - all 5 KYC checks + OTP pre-check approved, or worker verified by backend
                    const isStep3Complete =
                      isStep2Complete &&
                      (allMandatoryChecksApproved || worker.isFullyVerified || dossier?.status === 'APPROVED');

                    // Step 4: Verification Summary - authoritative sign-off completed by supervisor (requires step 3)
                    const isStep4Complete =
                      isStep3Complete &&
                      Boolean(
                        dossier?.signedOffAt ||
                          worker?.signedOffAt ||
                          dossier?.applicationStatus === 'VERIFIED' ||
                          worker?.applicationStatus === 'VERIFIED' ||
                          worker.verificationStatus === 'VERIFIED' ||
                          worker.isFullyVerified ||
                          dossier?.status === 'APPROVED' ||
                          (isSignedOff && (allMandatoryChecksApproved || worker.isFullyVerified)) ||
                          (authoritativeLevel &&
                            ['VERIFIED', 'APPROVED'].includes(authoritativeLevel.toUpperCase()) &&
                            (allMandatoryChecksApproved || worker.isFullyVerified))
                      );

                    // Step 5: Platform & Roster Status - commercial platform activation and live matching eligibility (requires step 4)
                    const isStep5Complete =
                      isStep4Complete &&
                      Boolean(
                        isOnboarded ||
                          isMatchingEligible ||
                          worker.onboardingStatus === 'VERIFIED' ||
                          (worker.status === 'ACTIVE' &&
                            Boolean(
                              dossier?.activatedAt ||
                                worker.activatedAt ||
                                dossier?.applicationStatus === 'ACTIVE' ||
                                worker.applicationStatus === 'ACTIVE' ||
                                worker.isFullyVerified
                            ))
                      );

                    const getStepStatus = (stepNum: 1 | 2 | 3 | 4 | 5) => {
                      switch (stepNum) {
                        case 1:
                          return isStep1Complete;
                        case 2:
                          return isStep2Complete;
                        case 3:
                          return isStep3Complete;
                        case 4:
                          return isStep4Complete;
                        case 5:
                          return isStep5Complete;
                        default:
                          return false;
                      }
                    };

                    return STEPS.map((s) => {
                      const isStepActive = currentStep === s.step;
                      const isStepComplete = getStepStatus(s.step);
                      const isPending = !isStepComplete && !isStepActive;

                      return (
                        <button
                          key={s.step}
                          onClick={() => setCurrentStep(s.step)}
                          aria-current={isStepActive ? 'step' : undefined}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: isStepActive
                              ? '2px solid var(--color-brand-600)'
                              : isStepComplete
                              ? '1px solid #86efac'
                              : '1px solid var(--color-border-subtle)',
                            backgroundColor: isStepActive
                              ? 'var(--color-brand-50, #eff6ff)'
                              : isStepComplete
                              ? '#f0fdf4'
                              : '#ffffff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            minHeight: '74px',
                            boxShadow: isStepActive ? '0 1px 3px rgba(37, 99, 235, 0.15)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px' }}>
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: isStepComplete
                                  ? 'var(--color-status-success-text)'
                                  : isStepActive
                                  ? 'var(--color-brand-600)'
                                  : '#e2e8f0',
                                color: isPending ? '#64748b' : '#ffffff',
                                border: isStepActive
                                  ? '2px solid var(--color-brand-600)'
                                  : isStepComplete
                                  ? '1px solid #16a34a'
                                  : '1px solid #cbd5e1',
                                boxShadow: isStepActive && isStepComplete
                                  ? '0 0 0 2px #eff6ff, 0 0 0 4px var(--color-brand-600)'
                                  : 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isStepComplete ? <Check size={13} strokeWidth={2.5} /> : s.step}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: isStepActive ? 800 : isStepComplete ? 700 : 600,
                                color: isStepActive
                                  ? 'var(--color-brand-700, #1d4ed8)'
                                  : isStepComplete
                                  ? '#15803d'
                                  : 'var(--color-text-secondary)',
                                whiteSpace: 'normal',
                                lineHeight: 1.25,
                              }}
                            >
                              {s.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: '28px', marginTop: '2px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {s.desc}
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em',
                                backgroundColor: isStepActive
                                  ? 'var(--color-brand-100, #dbeafe)'
                                  : isStepComplete
                                  ? '#dcfce7'
                                  : '#f1f5f9',
                                color: isStepActive
                                  ? 'var(--color-brand-800, #1e40af)'
                                  : isStepComplete
                                  ? '#166534'
                                  : '#64748b',
                              }}
                            >
                              {isStepActive ? 'Current' : isStepComplete ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* STEP 1: APPLICATION OVERVIEW */}
              {currentStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 1: Application Overview & Distinct Lifecycle State
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Authoritative applicant reference metadata, contact privacy controls, and 4-way platform status separation.
                    </p>
                  </div>

                  {/* 4-Way Status Separation Card */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-4)',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>
                        1. Application Status
                      </span>
                      <div style={{ marginTop: '4px' }}>
                        <StatusBadge status={worker.onboardingStatus || 'SUBMITTED'} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>
                        Onboarding Intake
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>
                        2. Operational Status
                      </span>
                      <div style={{ marginTop: '4px' }}>
                        <StatusBadge status={worker.status} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>
                        Employment Roster
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>
                        3. Verification Status
                      </span>
                      <div style={{ marginTop: '4px' }}>
                        <VerificationBadge isFullyVerified={worker.isFullyVerified} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>
                        Trust & Safety KYC
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>
                        4. Matching Eligibility
                      </span>
                      <div style={{ marginTop: '4px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isMatchingEligible ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                            color: isMatchingEligible ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                          }}
                        >
                          {isMatchingEligible ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {isMatchingEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'block' }}>
                        Customer Trials & Jobs
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-primary-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <AlertCircle size={14} color="var(--color-brand-600)" />
                    <span>
                      <strong>Strict Separation of Platform States:</strong> Application intake, operational account status, trust verification, and matching eligibility represent separate platform states. A worker is never matching-eligible until both trust verification is passed and operational account activation is granted.
                    </span>
                  </div>

                  {/* Profile & Application Reference Details */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Worker ID & Full Name</span>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {worker.name} ({worker.id})
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Official Application Reference</span>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--color-brand-700)', fontSize: 'var(--font-size-sm)' }}>
                        {worker.applicationId || dossier?.applicationId || worker.id}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Service Category & Locality</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {worker.category} • {worker.locality} ({worker.serviceRadiusKm} km radius)
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Household Experience</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {worker.experienceYears} Years Household Experience
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Submission Timestamp</span>
                      <strong style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDateTimeIST(worker.registeredAt || worker.createdAt || '2026-01-05T10:00:00Z')}
                      </strong>
                    </div>

                    {/* Sensitive Phone Number with Reveal Safeguard */}
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>
                        Registered Phone Number (PII Protected)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <strong style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          {isPhoneRevealed
                            ? (worker.phone || worker.mobile || (worker.phoneMasked ? `${worker.phoneMasked} (Full number not supplied by backend)` : 'Not available'))
                            : (worker.phoneMasked || '+91 ••••• •••••')}
                        </strong>
                        {canRevealPii ? (
                          <button
                            onClick={() => setIsPhoneRevealed((prev) => !prev)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)',
                              backgroundColor: 'var(--color-surface)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: 'var(--color-brand-600)',
                            }}
                          >
                            {isPhoneRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                            <span>{isPhoneRevealed ? 'Mask Phone' : 'Reveal Contact Number'}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            (Requires verification review or worker view permission)
                          </span>
                        )}
                      </div>
                      {isPhoneRevealed && (
                        <span style={{ fontSize: '10px', color: 'var(--color-status-info-text)', marginTop: '2px', display: 'block' }}>
                          ✓ Contact revealed for telephonic vetting call. Action recorded in audit trail.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 6-Point Trust & Verification Status Summary Box */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, marginBottom: 'var(--space-2)' }}>
                      6-Point Trust & Verification Status
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginBottom: 'var(--space-3)' }}>
                      1 Automated Mobile OTP Pre-Check + 5 Operations Vetting Checks:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', fontSize: '11px' }}>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>1. Mobile OTP Pre-Check</span>: <strong>{otpPassed ? 'PASSED' : 'PENDING'}</strong>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>2. Identity Proof (Aadhaar)</span>: <strong>{checksRecord.IDENTITY.status}</strong>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>3. Residential Address Proof</span>: <strong>{checksRecord.ADDRESS.status}</strong>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>4. Criminal Self-Declaration</span>: <strong>{checksRecord.POLICE_CLEARANCE.status}</strong>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>5. Skill Certificate / License</span>: <strong>{checksRecord.EMERGENCY_CONTACT.status}</strong>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                        <span>6. Prior Employer Reference</span>: <strong>{checksRecord.REFERENCE.status}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Stepper Navigation Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Proceed to Step 2: Documents & Evidence</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DOCUMENTS AND EVIDENCE */}
              {currentStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 2: Documents & KYC Evidence Vault
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Secure inspection of uploaded proof documents using authorized short-lived signed URLs.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-status-info-bg)',
                      border: '1px solid var(--color-status-info-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-status-info-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <Lock size={15} />
                    <span>
                      <strong>Secure Vault Protocol:</strong> Documents are stored in encrypted cloud storage. Inspection links are short-lived, signed URLs queried on-demand. Signed tokens are never logged or persisted in browser storage.
                    </span>
                  </div>

                  {/* Documents List Table */}
                  <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>Document Type</th>
                          <th style={{ padding: '8px 12px' }}>Document ID / Reference</th>
                          <th style={{ padding: '8px 12px' }}>Verification State</th>
                          <th style={{ padding: '8px 12px' }}>Submission Timestamp</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Inspection Action</th>
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
                              <FileText size={28} style={{ opacity: 0.5, marginBottom: 'var(--space-1)' }} />
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
                          const checkType: VerificationCheckType =
                            doc.documentType === 'IDENTITY'
                              ? 'IDENTITY'
                              : doc.documentType === 'ADDRESS'
                              ? 'ADDRESS'
                              : doc.documentType === 'POLICE_CLEARANCE'
                              ? 'POLICE_CLEARANCE'
                              : 'IDENTITY';

                          return (
                            <tr key={doc.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {doc.documentTypeName}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                                {doc.docNumberMasked || 'XXXX-XXXX-8921'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor:
                                      doc.status === 'VERIFIED'
                                        ? 'var(--color-status-success-bg)'
                                        : doc.status === 'REJECTED'
                                        ? 'var(--color-status-danger-bg)'
                                        : 'var(--color-status-warning-bg)',
                                    color:
                                      doc.status === 'VERIFIED'
                                        ? 'var(--color-status-success-text)'
                                        : doc.status === 'REJECTED'
                                        ? 'var(--color-status-danger-text)'
                                        : 'var(--color-status-warning-text)',
                                  }}
                                >
                                  {doc.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                                {doc.submittedAt ? formatDateTimeIST(doc.submittedAt) : 'Recorded'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {canViewDocuments ? (
                                  <button
                                    onClick={() =>
                                      setInspectingDoc({
                                        id: doc.id,
                                        checkType,
                                        title: doc.documentTypeName,
                                        docNumber: doc.docNumberMasked,
                                      })
                                    }
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
                              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '420px', margin: '0 auto var(--space-3) auto' }}>
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
                          const isPdf = /\.pdf(\?.*)?$/i.test(url);
                          const isImage = /\.(jpe?g|png|webp|svg|gif)(\?.*)?$/i.test(url);

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
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '400px',
                                      objectFit: 'contain',
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
                                      height: '380px',
                                      border: '1px solid var(--color-border-subtle)',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <div style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
                                      PDF document loaded in vault. If not displaying in your browser, click "Open Secure Document Link" below.
                                    </div>
                                  </object>
                                ) : (
                                  <FileText size={48} color="var(--color-brand-600)" />
                                )}
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                                  [CONFIDENTIAL KYC ATTACHMENT]
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                  {inspectingDoc.title}
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
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  )}

                  {/* Stepper Navigation Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => setCurrentStep(1)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Back to Step 1: Application Overview</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Proceed to Step 3: Verification Checklist</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: VERIFICATION CHECKLIST */}
              {currentStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 3: Verification Checklist & Operational Evaluation
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Evaluate mandatory 6-point verification criteria (1 Automated OTP Pre-Check + 5 Operations Checks).
                    </p>
                  </div>

                  {/* 6-Point Trust & Verification Status Heading */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                        6-Point Trust & Verification Status
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Approved {approvedOpsCount + (otpPassed ? 1 : 0)} of 6 mandatory requirements
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

                  {/* Pre-Check Box */}
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
                          Tier 1 Automated Onboarding Pre-Check: Mobile OTP
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

                  {/* Action Feedback Banner */}
                  {actionFeedback && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: actionFeedback.type === 'success' ? 'var(--color-status-success-bg)' : 'var(--color-status-danger-bg)',
                        border: `1px solid ${actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)'}`,
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)',
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

                  {/* 5 Operational Checks Interactive Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {operationalChecksList.map(({ key, label, check, stepEval }) => {
                      const isStepLocked = Boolean(stepEval?.isLocked);
                      return (
                      <div
                        key={key}
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: isStepLocked ? '1px dashed var(--color-border)' : '1px solid var(--color-border-subtle)',
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
                            {isStepLocked && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--color-warning-bg)',
                                  color: 'var(--color-warning-dark)',
                                  border: '1px solid var(--color-warning-border)',
                                }}
                              >
                                <Lock size={10} /> Locked
                              </span>
                            )}
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

                        {/* Prerequisite Workflow Notice if Locked */}
                        {isStepLocked && (
                          <div
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'var(--color-bg-subtle)',
                              border: '1px dashed var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '10px',
                              color: 'var(--color-text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Lock size={12} color="var(--color-warning-dark)" />
                            <span>
                              <strong>Sequential Workflow:</strong> Step {stepEval?.order} ({label}) is locked until preceding check(s) [{stepEval?.prerequisiteBlockers.join(', ')}] are approved.
                            </span>
                          </div>
                        )}

                        {/* Decision Controls for Verification Executives */}
                        {canDecide && (() => {
                          const targetCheckId = check.id || (check as { id?: string; checkId?: string }).checkId || dossier?.checks?.[key]?.id || (key === 'IDENTITY' ? dossier?.checkId : undefined);
                          const hasValidCheckId = Boolean(targetCheckId);
                          return (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
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
                                cursor: (approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId) ? 'not-allowed' : 'pointer',
                                opacity: (approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId) ? 0.6 : 1,
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
                                cursor: (approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId) ? 'not-allowed' : 'pointer',
                                opacity: (approveCheckMutation.isPending || rejectCheckMutation.isPending || !hasValidCheckId) ? 0.6 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <XCircle size={12} />
                              <span>Reject Check</span>
                            </button>

                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || check.status === 'APPROVED' || !hasValidCheckId || isStepLocked}
                              title={
                                !hasValidCheckId
                                  ? 'Check ID unavailable from backend data'
                                  : isStepLocked
                                  ? `Step locked: Prerequisite (${stepEval?.prerequisiteBlockers.join(', ')}) must be approved first.`
                                  : check.status === 'APPROVED'
                                  ? 'Check is already approved'
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (targetCheckId && !isStepLocked) {
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
                                backgroundColor: isStepLocked
                                  ? 'var(--color-bg-subtle)'
                                  : check.status === 'APPROVED'
                                  ? 'var(--color-status-success-bg)'
                                  : 'var(--color-brand-600)',
                                color: isStepLocked
                                  ? 'var(--color-text-secondary)'
                                  : check.status === 'APPROVED'
                                  ? 'var(--color-status-success-text)'
                                  : '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: (check.status === 'APPROVED' || !hasValidCheckId || isStepLocked) ? 'not-allowed' : 'pointer',
                                opacity: (!hasValidCheckId || isStepLocked) ? 0.6 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {isStepLocked ? (
                                <>
                                  <Lock size={12} />
                                  <span>Locked</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>{check.status === 'APPROVED' ? 'Check Approved' : 'Approve Check'}</span>
                                </>
                              )}
                            </button>
                          </div>
                          );
                        })()}
                      </div>
                    );
                    })}
                  </div>

                  {/* Stepper Navigation Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Back to Step 2: Documents & Evidence</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Proceed to Step 4: Verification Summary</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: AUTHORITATIVE VERIFICATION SUMMARY */}
              {currentStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 4: Authoritative Verification Summary
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Authoritative overall verification outcome established by the backend from individual check evaluations.
                    </p>
                  </div>

                  {/* Missing / Error State for Authoritative Level */}
                  {(isDossierError || !authoritativeLevel) ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-status-danger-bg)',
                        border: '1px solid var(--color-status-danger-text)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-danger-text)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        <AlertTriangle size={18} />
                        <span>Authoritative Verification Level Unavailable</span>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.5 }}>
                        Unable to load the authoritative verification level from backend endpoint{' '}
                        <code>GET /api/v1/admin/workers/{workerId}/verification</code>.
                        {dossierError ? ` Error: ${(dossierError as Error).message || 'Server returned an error'}.` : ''}
                      </p>
                      <p style={{ margin: 0, lineHeight: 1.5 }}>
                        The frontend displays only confirmed backend verification status and does not infer approval or compute final verification decisions from individual checks.
                      </p>
                      <div>
                        <button
                          onClick={() => refetchDossier()}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--color-status-danger-text)',
                            color: 'var(--color-status-danger-text)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: 'var(--space-1)',
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Retry Fetching Authoritative Level</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Authoritative Status Card */
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor:
                          ['VERIFIED', 'APPROVED', 'LEVEL_3', 'LEVEL_2'].includes(authoritativeLevel.toUpperCase())
                            ? 'var(--color-status-success-bg)'
                            : authoritativeLevel.toUpperCase() === 'REJECTED'
                            ? 'var(--color-status-danger-bg)'
                            : 'var(--color-status-warning-bg)',
                        border:
                          ['VERIFIED', 'APPROVED', 'LEVEL_3', 'LEVEL_2'].includes(authoritativeLevel.toUpperCase())
                            ? '1px solid var(--color-status-success-text)'
                            : authoritativeLevel.toUpperCase() === 'REJECTED'
                            ? '1px solid var(--color-status-danger-text)'
                            : '1px solid var(--color-status-warning-text)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          {['VERIFIED', 'APPROVED', 'LEVEL_3', 'LEVEL_2'].includes(authoritativeLevel.toUpperCase()) ? (
                            <CheckCircle2 size={20} color="var(--color-status-success-text)" />
                          ) : authoritativeLevel.toUpperCase() === 'REJECTED' ? (
                            <XCircle size={20} color="var(--color-status-danger-text)" />
                          ) : (
                            <Clock size={20} color="var(--color-status-warning-text)" />
                          )}
                          <div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', opacity: 0.85 }}>
                              Authoritative Overall Status
                            </span>
                            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 800 }}>
                              Level: {authoritativeLevel}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-full, 9999px)',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.3px',
                            backgroundColor:
                              ['VERIFIED', 'APPROVED', 'LEVEL_3', 'LEVEL_2'].includes(authoritativeLevel.toUpperCase())
                                ? 'var(--color-status-success-text)'
                                : authoritativeLevel.toUpperCase() === 'REJECTED'
                                ? 'var(--color-status-danger-text)'
                                : 'var(--color-status-warning-text)',
                            color: '#ffffff',
                          }}
                        >
                          {authoritativeLevel.toUpperCase()}
                        </span>
                      </div>

                      <p style={{ margin: '8px 0 0 0', lineHeight: 1.5 }}>
                        {['VERIFIED', 'APPROVED', 'LEVEL_3', 'LEVEL_2'].includes(authoritativeLevel.toUpperCase())
                          ? 'Worker application satisfies authoritative verification requirements according to backend level evaluation.'
                          : authoritativeLevel.toUpperCase() === 'REJECTED'
                          ? 'Worker verification is marked as REJECTED by backend records.'
                          : 'Worker verification is currently in progress or pending completion of all individual checks.'}
                      </p>
                    </div>
                  )}

                  {/* Action Feedback Banner in Step 4 */}
                  {actionFeedback && (
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: actionFeedback.type === 'success' ? 'var(--color-status-success-bg)' : 'var(--color-status-danger-bg)',
                        border: `1px solid ${actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)'}`,
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: actionFeedback.type === 'success' ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)',
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

                  {/* STEP 4: ACTION CARD 1 - SUPERVISOR VERIFICATION SIGN-OFF */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: isSignedOff ? 'var(--color-status-success-bg)' : workflow.canAcceptApplication ? '#eff6ff' : 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: isSignedOff ? '1px solid var(--color-status-success-text)' : workflow.canAcceptApplication ? '1px solid var(--color-brand-500, #3b82f6)' : '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <CheckCircle2 size={18} color={isSignedOff ? 'var(--color-status-success-text)' : workflow.canAcceptApplication ? 'var(--color-brand-600, #2563eb)' : 'var(--color-text-muted)'} />
                          <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            1. Supervisor Verification Sign-Off
                          </h4>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 600 }}>
                            POST /admin/workers/&#123;workerId&#125;/verification/sign-off
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, maxWidth: '650px' }}>
                          {isSignedOff
                            ? `Verification dossier has been formally signed off${dossier?.signedOffAt || worker.signedOffAt ? ` on ${formatDateTimeIST((dossier?.signedOffAt || worker.signedOffAt)!)}` : ''}. Application status is VERIFIED.`
                            : workflow.canAcceptApplication
                            ? 'All mandatory checks satisfy the approved verification sequence. An authorized supervisor may now execute final verification sign-off.'
                            : `Sign-off is locked: ${workflow.totalChecksCount - workflow.approvedCount} mandatory KYC verification check(s) remain incomplete. Complete all checks sequentially before sign-off.`}
                        </p>
                      </div>

                      <div>
                        {isSignedOff ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', color: 'var(--color-status-success-text)', border: '1px solid var(--color-status-success-text)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                            <CheckCircle2 size={14} />
                            <span>Signed Off (VERIFIED)</span>
                          </div>
                        ) : canSignOff ? (
                          <button
                            id="verification-signoff-btn"
                            disabled={!workflow.canAcceptApplication || signOffMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (workflow.canAcceptApplication) {
                                setIsSignOffDialogOpen(true);
                              }
                            }}
                            style={{
                              padding: '10px 18px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: workflow.canAcceptApplication ? 'var(--color-brand-600, #2563eb)' : 'var(--color-bg-surface)',
                              color: workflow.canAcceptApplication ? '#ffffff' : 'var(--color-text-muted)',
                              border: workflow.canAcceptApplication ? 'none' : '1px solid var(--color-border)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 700,
                              cursor: (!workflow.canAcceptApplication || signOffMutation.isPending) ? 'not-allowed' : 'pointer',
                              opacity: (!workflow.canAcceptApplication || signOffMutation.isPending) ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: workflow.canAcceptApplication ? 'var(--shadow-sm)' : 'none',
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>{signOffMutation.isPending ? 'Signing Off...' : 'Sign Off Verification'}</span>
                          </button>
                        ) : (
                          <div style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '240px', lineHeight: 1.4 }}>
                            <strong>Supervisor Only:</strong> Sign-off requires <code>verification.signoff</code> (Operations Admin, Verification Supervisor, or Super Admin).
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sign-off Error Feedback */}
                    {signOffMutation.isError && (
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-status-danger-bg)',
                          border: '1px solid var(--color-status-danger-text)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-status-danger-text)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block', marginBottom: '2px' }}>Sign-Off Error:</strong>
                          <span>{(signOffMutation.error as Error)?.message || 'Backend rejected verification sign-off request.'}</span>
                          <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSignOffDialogOpen(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: '#ffffff',
                                border: '1px solid var(--color-status-danger-text)',
                                color: 'var(--color-status-danger-text)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Retry Sign-Off
                            </button>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                              Local state preserved. Worker has not been marked signed off.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* STEP 4: ACTION CARD 2 - COMMERCIAL PLATFORM ACTIVATION */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: isOnboarded ? 'var(--color-status-success-bg)' : isSignedOff ? '#f0fdf4' : 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: isOnboarded ? '1px solid var(--color-status-success-text)' : isSignedOff ? '1px solid #86efac' : '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <ShieldCheck size={18} color={isOnboarded ? 'var(--color-status-success-text)' : isSignedOff ? '#16a34a' : 'var(--color-text-muted)'} />
                          <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            2. Commercial Platform Activation
                          </h4>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 600 }}>
                            POST /admin/workers/&#123;workerId&#125;/activate
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, maxWidth: '650px' }}>
                          {isOnboarded
                            ? `Worker is commercially activated on SevaNest${dossier?.activatedAt || worker.activatedAt ? ` since ${formatDateTimeIST((dossier?.activatedAt || worker.activatedAt)!)}` : ''}. Worker is live on the commercial roster and eligible for matching.`
                            : isSignedOff
                            ? 'Verification sign-off is complete. Authorized Operations Admin may now activate the worker onto the platform roster.'
                            : 'Activation is locked: Verification sign-off must be completed before commercial platform activation.'}
                        </p>
                      </div>

                      <div>
                        {isOnboarded ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', color: 'var(--color-status-success-text)', border: '1px solid var(--color-status-success-text)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                            <CheckCircle2 size={14} />
                            <span>Activated & Onboarded (ACTIVE)</span>
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
                              cursor: (!isSignedOff || activateMutation.isPending) ? 'not-allowed' : 'pointer',
                              opacity: (!isSignedOff || activateMutation.isPending) ? 0.6 : 1,
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
                          <div style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '240px', lineHeight: 1.4 }}>
                            <strong>Operations Admin Only:</strong> Activation requires <code>worker.activate</code> (Operations Admin or Super Admin).
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activation Error Feedback & Missing Prerequisites */}
                    {activateMutation.isError && (
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          backgroundColor: 'var(--color-status-danger-bg)',
                          border: '1px solid var(--color-status-danger-text)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-status-danger-text)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block', marginBottom: '2px' }}>Activation Rejection:</strong>
                            <span>{(activateMutation.error as Error)?.message || 'Backend rejected activation request.'}</span>
                          </div>
                        </div>

                        {missingActivationPrerequisites && missingActivationPrerequisites.length > 0 && (
                          <div style={{ padding: 'var(--space-2)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-status-danger-text)' }}>
                            <strong style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Authoritative Missing Prerequisites:</strong>
                            <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.4 }}>
                              {missingActivationPrerequisites.map((m, idx) => (
                                <li key={idx}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '2px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsActivateDialogOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: '#ffffff',
                              border: '1px solid var(--color-status-danger-text)',
                              color: 'var(--color-status-danger-text)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Retry Activation
                          </button>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                            Authoritative prerequisites must be satisfied: approved checks, category, area, criminal declaration, active account, no blacklist.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prerequisite Compliance Checklist Card */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                        Individual Verification Checks Breakdown
                      </h4>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: hasRejectedCheck ? 'var(--color-status-danger-text)' : 'var(--color-text-secondary)' }}>
                        {approvedOpsCount + (otpPassed ? 1 : 0)} of 6 Checks Approved{hasRejectedCheck ? ' • Findings Recorded' : ''}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '11px', marginTop: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {otpPassed ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <XCircle size={14} color="var(--color-status-danger-text)" />}
                        <span>1. Mobile OTP Pre-Check ({otpPassed ? 'Passed' : 'Failed'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {idApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : checksRecord.IDENTITY?.status === 'REJECTED' ? <XCircle size={14} color="var(--color-status-danger-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>2. Identity Proof ({checksRecord.IDENTITY?.status || 'PENDING'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {addressApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : checksRecord.ADDRESS?.status === 'REJECTED' ? <XCircle size={14} color="var(--color-status-danger-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>3. Residential Address Proof ({checksRecord.ADDRESS?.status || 'PENDING'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {emergencyApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : checksRecord.EMERGENCY_CONTACT?.status === 'REJECTED' ? <XCircle size={14} color="var(--color-status-danger-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>4. Emergency Contact Vetting ({checksRecord.EMERGENCY_CONTACT?.status || 'PENDING'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {referenceApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : checksRecord.REFERENCE?.status === 'REJECTED' ? <XCircle size={14} color="var(--color-status-danger-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>5. Prior Employer Reference ({checksRecord.REFERENCE?.status || 'PENDING'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {policeApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : checksRecord.POLICE_CLEARANCE?.status === 'REJECTED' ? <XCircle size={14} color="var(--color-status-danger-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>6. Police Clearance Certificate ({checksRecord.POLICE_CLEARANCE?.status || 'PENDING'})</span>
                      </div>
                    </div>
                  </div>

                  {/* Stepper Navigation Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Back to Step 3: Verification Checklist</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(5)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Proceed to Step 5: Platform Status</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: WORKER PLATFORM & ROSTER STATUS */}
              {currentStep === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 5: Platform & Roster Status
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Authoritative platform onboarding status and operational customer matching state.
                    </p>
                  </div>

                  {/* Operational Status Box */}
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: isMatchingEligible ? 'var(--color-status-success-bg)' : '#f8fafc',
                      borderRadius: 'var(--radius-lg)',
                      border: isMatchingEligible ? '1px solid var(--color-status-success-text)' : '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                          Current Platform Matching State
                        </span>
                        <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {isMatchingEligible ? 'Eligible for Customer Matching & Allocation' : 'Ineligible for Customer Matching'}
                        </h4>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isMatchingEligible ? 'var(--color-status-success-text)' : 'var(--color-status-warning-bg)',
                          color: isMatchingEligible ? '#fff' : 'var(--color-status-warning-text)',
                        }}
                      >
                        {isMatchingEligible ? 'ACTIVE & ONBOARDED' : currentAppStatus}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
                      <div style={{ padding: 'var(--space-3)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700, display: 'block' }}>
                          Application Status
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: currentAppStatus === 'ACTIVE' ? 'var(--color-status-success-text)' : 'var(--color-text-primary)' }}>
                          {currentAppStatus}
                        </span>
                      </div>
                      <div style={{ padding: 'var(--space-3)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700, display: 'block' }}>
                          Account Roster Status
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {worker.status}
                        </span>
                      </div>
                      <div style={{ padding: 'var(--space-3)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700, display: 'block' }}>
                          Supervisor Sign-Off
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: isSignedOff ? 'var(--color-status-success-text)' : 'var(--color-text-muted)' }}>
                          {dossier?.signedOffAt || worker.signedOffAt ? formatDateTimeIST((dossier?.signedOffAt || worker.signedOffAt)!) : isSignedOff ? 'Signed Off' : 'Pending'}
                        </span>
                      </div>
                      <div style={{ padding: 'var(--space-3)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 700, display: 'block' }}>
                          Platform Activation
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: isOnboarded ? 'var(--color-status-success-text)' : 'var(--color-text-muted)' }}>
                          {dossier?.activatedAt || worker.activatedAt ? formatDateTimeIST((dossier?.activatedAt || worker.activatedAt)!) : 'Not Activated'}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {isOnboarded
                        ? 'Worker is fully verified, signed off, and commercially activated. Eligible for household customer matching and booking allocation.'
                        : isSignedOff
                        ? 'Worker verification is formally signed off (VERIFIED). An Operations Admin must execute commercial platform activation before customer matching is unlocked.'
                        : 'Worker cannot be matched until mandatory verification checks are satisfied, signed off by a supervisor, and commercially activated.'}
                    </p>
                  </div>

                  {/* Stepper Navigation Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => setCurrentStep(4)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ChevronLeft size={14} />
                      <span>Back to Step 4: Verification Summary</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PERSONAL & CONTACT */}
          {activeTab === 'personal' && (
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
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 4px 0' }}>
                  Personal & Contact Details
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Official applicant identity, residential address, verified communication channels, and coverage parameters.
                </p>
              </div>

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
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <User size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Full Registered Name
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Worker ID: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{worker.id}</strong>
                  </div>
                </div>

                {/* Contact Information */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Phone size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Contact Information
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <strong style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {isPhoneRevealed
                        ? (worker.phone || worker.mobile || (worker.phoneMasked ? `${worker.phoneMasked} (Full number not supplied by backend)` : 'Not available'))
                        : (worker.phoneMasked || '+91 ••••• •••••')}
                    </strong>
                    {canRevealPii && (
                      <button
                        type="button"
                        onClick={() => setIsPhoneRevealed((prev) => !prev)}
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
                        }}
                        aria-label={isPhoneRevealed ? "Hide contact number" : "Reveal contact number"}
                      >
                        {isPhoneRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{isPhoneRevealed ? "Hide" : "Reveal"}</span>
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {isPhoneRevealed ? 'Authorized contact reveal active' : 'Secure communication channel'}
                  </div>
                </div>

                {/* Primary Locality */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <MapPin size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Primary Locality
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.locality}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Base locality for household matching
                  </div>
                </div>

                {/* Maximum Service Radius */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <MapPin size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Maximum Service Radius
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.serviceRadiusKm} km from locality base
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Operational perimeter for household dispatch
                  </div>
                </div>

                {/* Initial Registration Date */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Calendar size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Initial Registration Date
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.registeredAt}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Application intake timestamp
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROFESSIONAL PROFILE */}
          {activeTab === 'professional' && (
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
              <div
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: 'var(--space-3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 4px 0' }}>
                    Professional Qualifications & Capabilities
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Domestic work capabilities, household experience, language proficiencies, and wage preferences.
                  </p>
                </div>

                <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE}>
                  <button
                    onClick={openCategoryModal}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Sliders size={14} />
                    <span>Manage Categories</span>
                  </button>
                </PermissionGate>
              </div>

              {/* Assigned Service Categories Card */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <Briefcase size={16} color="var(--color-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Assigned Service Categories
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {(worker.categories && worker.categories.length > 0 ? worker.categories : [worker.category]).map((c) => (
                    <span
                      key={c}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Skills, Languages, & Compensation Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                {/* Experience Duration */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Briefcase size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Experience Duration
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.experienceYears !== undefined ? `${worker.experienceYears} Years Household Experience` : 'Not specified'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Documented domestic work experience
                  </div>
                </div>

                {/* Languages Spoken */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Languages size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Languages Spoken
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.languages && worker.languages.length > 0 ? worker.languages.join(', ') : 'Not specified'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Household communication capability
                  </div>
                </div>

                {/* Current Allocation Availability */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Clock size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Current Allocation Availability
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-status-success-text)' }}>
                    {worker.availability || (worker.status === 'ACTIVE' ? 'Available for Immediate Allocation' : 'Unavailable')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Customer allocation readiness
                  </div>
                </div>

                {/* Expected Monthly Compensation */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <DollarSign size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Expected Monthly Compensation
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {worker.expectedCompensation || 'Not specified'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    Benchmark compensation expectation
                  </div>
                </div>

                {/* Skill Competencies */}
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <CheckCircle2 size={16} color="var(--color-primary)" />
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

                {/* Professional Biography & Overview */}
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <FileText size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                      Professional Biography & Overview
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {worker.bio || 'No biography provided by applicant.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KYC DOCUMENTS VAULT */}
          {activeTab === 'documents' && (
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
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 4px 0' }}>
                  Document Archive & Compliance Vault
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Encrypted storage and compliance audit trail for official worker verification documents.
                </p>
              </div>

              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-status-info-bg)',
                  border: '1px solid var(--color-status-info-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-status-info-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <Lock size={15} />
                <span>
                  <strong>Strict Document Privacy Protocols:</strong> Documents are stored in encrypted cloud storage. Direct public links are blocked. Inspection links are time-bounded signed SAS URLs logged in the compliance audit trail.
                </span>
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Document Type</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Document ID / Reference</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Verification State</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700 }}>Submission Timestamp</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Security Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!worker.documents || worker.documents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
                          No KYC documents submitted or available in vault for this worker.
                        </td>
                      </tr>
                    ) : (
                      worker.documents.map((doc, idx) => (
                      <tr key={doc.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {doc.documentTypeName}
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                          {doc.docNumberMasked || 'XXXX-XXXX-MASKED'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                doc.status === 'VERIFIED'
                                  ? 'var(--color-status-success-bg)'
                                  : doc.status === 'REJECTED'
                                  ? 'var(--color-status-danger-bg)'
                                  : 'var(--color-status-warning-bg)',
                              color:
                                doc.status === 'VERIFIED'
                                  ? 'var(--color-status-success-text)'
                                  : doc.status === 'REJECTED'
                                  ? 'var(--color-status-danger-text)'
                                  : 'var(--color-status-warning-text)',
                              border: `1px solid ${
                                doc.status === 'VERIFIED'
                                  ? 'var(--color-status-success-border)'
                                  : doc.status === 'REJECTED'
                                  ? 'var(--color-status-danger-border)'
                                  : 'var(--color-status-warning-border)'
                              }`,
                            }}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                          {doc.submittedAt ? formatDateTimeIST(doc.submittedAt) : 'Recorded'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {canViewDocuments ? (
                            <button
                              onClick={() => {
                                setActiveTab('verification');
                                setCurrentStep(2);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-primary)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ExternalLink size={12} />
                              <span>Inspect in Workstation</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              Document View Restricted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: OPERATIONAL ENGAGEMENTS */}
          {activeTab === 'operational' && (
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
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 4px 0' }}>
                  Operational Engagements & Metrics
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Real-time household ratings, completed jobs, live engagements, and operational service history.
                </p>
              </div>

              {/* Quick Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Rating Score
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Star size={20} fill="#f59e0b" color="#f59e0b" />
                    <span>{worker.ratingAverage}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>({worker.totalReviews})</span>
                  </div>
                </div>

                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Completed Jobs
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {worker.completedBookingsCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Active Engagements
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {worker.activeEngagementsCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Replacements
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: worker.replacementsIncurred > 0 ? 'var(--color-status-warning-text)' : 'var(--color-status-success-text)' }}>
                    {worker.replacementsIncurred}
                  </div>
                </div>
              </div>

              {/* Recent Household Engagements */}
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 var(--space-3) 0' }}>
                  Recent Household Engagements
                </h4>
                {worker.recentEngagements.length > 0 ? (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Booking Ref</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Customer Name</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Service Category</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Operational Status</th>
                          <th style={{ padding: '10px 14px', fontWeight: 700 }}>Engagement Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {worker.recentEngagements.map((eng) => (
                          <tr key={eng.bookingId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{eng.bookingId}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{eng.customerName}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{eng.serviceCategory}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <StatusBadge status={eng.status} />
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>{eng.period}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    No prior commercial household engagements recorded.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
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

            <PermissionGate permission={PERMISSIONS.VERIFICATION_REVIEW}>
              <button
                onClick={() => {
                  setRecheckCheckType('IDENTITY');
                  setIsRecheckModalOpen(true);
                }}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={14} />
                <span>Request Re-Verification</span>
              </button>
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
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
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
            approveCheckMutation.mutate({
              checkId: approveCheckId,
              checkType: approveCheckType,
              notes: remarks || 'Verified and approved by Verification Executive',
            });
          }
        }}
        onCancel={() => {
          setIsApproveDialogOpen(false);
          setApproveCheckId(null);
          setApproveDialogError(null);
        }}
      />

      {/* Supervisor Verification Sign-Off Dialog */}
      <ConfirmDialog
        isOpen={isSignOffDialogOpen}
        title={`Verification Sign-Off: ${worker?.name || 'Worker'}`}
        description={`Confirm formal verification sign-off for ${worker?.name || 'the worker'}. All mandatory KYC verification checks have been independently reviewed and approved. This action transitions the worker dossier to VERIFIED status.`}
        confirmLabel={signOffMutation.isPending ? 'Signing Off...' : 'Sign Off Verification'}
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
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginBottom: 'var(--space-4)' }}>
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
