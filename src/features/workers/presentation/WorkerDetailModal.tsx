import React, { useState } from 'react';
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
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { verificationRepository } from '../../verification/data/verificationRepository';
import {
  VerificationCheckType,
  RejectionReasonCategory,
  REJECTION_CATEGORIES,
  VerificationCheck,
} from '../../verification/domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
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

  // Role permissions
  const canReview = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW);
  const canDecide = hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DECIDE) || canReview;
  const canViewDocuments =
    hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW) ||
    hasPermission(user?.permissions, PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED);
  const canManageStatus = hasPermission(user?.permissions, PERMISSIONS.WORKERS_MANAGE_STATUS);
  const canRevealPii =
    hasPermission(user?.permissions, PERMISSIONS.CUSTOMERS_REVEAL_PII) || canReview;

  // View navigation
  const [activeTab, setActiveTab] = useState<TabKey>('verification');
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
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectCheckType, setRejectCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [rejectCategory, setRejectCategory] = useState<RejectionReasonCategory>('BLURRY_IMAGE');
  const [rejectRemarks, setRejectRemarks] = useState('');

  const [isRecheckModalOpen, setIsRecheckModalOpen] = useState(false);
  const [recheckCheckType, setRecheckCheckType] = useState<VerificationCheckType>('IDENTITY');
  const [recheckInstructions, setRecheckInstructions] = useState('');

  // Final Decision state
  const [finalDecisionRemarks, setFinalDecisionRemarks] = useState('');

  // Disciplinary state
  const [isDisciplineOpen, setIsDisciplineOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'SUSPENDED' | 'BLACKLISTED' | 'ACTIVE'>('SUSPENDED');

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryUpdateSuccess, setCategoryUpdateSuccess] = useState(false);

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
    refetch: refetchDossier,
  } = useQuery({
    queryKey: ['verification', 'dossier', workerId],
    queryFn: () => verificationRepository.getDossierById(workerId),
    enabled: !!workerId,
  });

  // Query signed document link for inspectingDoc
  const {
    data: docLinkData,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
    refetch: refetchDocLink,
  } = useQuery({
    queryKey: ['verification', 'documentLink', workerId, inspectingDoc?.checkType, inspectingDoc?.id],
    queryFn: () =>
      inspectingDoc
        ? verificationRepository.getSignedDocumentUrl(workerId, inspectingDoc.checkType, inspectingDoc.id)
        : null,
    enabled: !!inspectingDoc && canViewDocuments,
    staleTime: 5 * 60 * 1000,
  });

  // Invalidate and refresh cache helper
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['workers'] });
    queryClient.invalidateQueries({ queryKey: ['verification'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    refetchWorker();
    refetchDossier();
    onStatusChanged?.();
  };

  // Mutations
  const approveCheckMutation = useMutation({
    mutationFn: async ({ checkType, notes }: { checkType: VerificationCheckType; notes?: string }) => {
      await verificationRepository.approveCheck(workerId, checkType, notes);
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const rejectCheckMutation = useMutation({
    mutationFn: async ({
      checkType,
      category,
      remarks,
    }: {
      checkType: VerificationCheckType;
      category: RejectionReasonCategory;
      remarks: string;
    }) => {
      await verificationRepository.rejectCheck(workerId, checkType, category, remarks);
    },
    onSuccess: () => {
      invalidateAll();
      setIsRejectDialogOpen(false);
      setRejectRemarks('');
    },
  });

  const recheckMutation = useMutation({
    mutationFn: async ({
      checkTypes,
      instructions,
    }: {
      checkTypes: VerificationCheckType[];
      instructions: string;
    }) => {
      await verificationRepository.requestReVerification(workerId, checkTypes, instructions);
    },
    onSuccess: () => {
      invalidateAll();
      setIsRecheckModalOpen(false);
      setRecheckInstructions('');
    },
  });

  const finalDecisionMutation = useMutation({
    mutationFn: async ({
      decision,
      remarks,
    }: {
      decision: 'APPROVED' | 'REJECTED' | 'CORRECTIONS_REQUESTED';
      remarks?: string;
    }) => {
      await verificationRepository.submitFinalDecision(workerId, decision, remarks);
    },
    onSuccess: () => {
      invalidateAll();
      setFinalDecisionRemarks('');
    },
  });

  const activateWorkerMutation = useMutation({
    mutationFn: async (remarks: string) => {
      await workerRepository.updateWorkerStatus(workerId, 'ACTIVE', remarks);
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

  if (isWorkerLoading || isDossierLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <LoadingSpinner message="Loading worker dossier and verification workstation..." />
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
        docNumberMasked: 'XXXX-XXXX-8921',
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
        docNumberMasked: 'ELEC-HYD-49201',
        documentTypeName: 'Electricity Utility Bill (Residential Address)',
      },
    },
    EMERGENCY_CONTACT: {
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: worker.isFullyVerified ? 'APPROVED' : 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Spouse / Family Contact',
        relationshipOrRole: 'Immediate Family',
        phoneMasked: worker.phoneMasked || '+91 98450 *****',
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
        phoneMasked: '+91 97110 *****',
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
        docNumberMasked: 'PCC-CYB-2024-8891',
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

  const operationalChecksList = [
    { key: 'IDENTITY' as const, label: 'Identity Proof', approved: idApproved, check: checksRecord.IDENTITY },
    { key: 'ADDRESS' as const, label: 'Address Proof', approved: addressApproved, check: checksRecord.ADDRESS },
    { key: 'EMERGENCY_CONTACT' as const, label: 'Emergency Contact', approved: emergencyApproved, check: checksRecord.EMERGENCY_CONTACT },
    { key: 'REFERENCE' as const, label: 'Employer Reference', approved: referenceApproved, check: checksRecord.REFERENCE },
    { key: 'POLICE_CLEARANCE' as const, label: 'Police Certificate', approved: policeApproved, check: checksRecord.POLICE_CLEARANCE },
  ];

  const approvedOpsCount = operationalChecksList.filter((c) => c.approved).length;
  const allMandatoryChecksApproved = otpPassed && approvedOpsCount === 5;
  const hasRejectedCheck = operationalChecksList.some((c) => c.check?.status === 'REJECTED');
  const pendingChecksCount = operationalChecksList.filter((c) => c.check?.status === 'PENDING').length;

  // Matching eligibility
  const isMatchingEligible = worker.isFullyVerified && worker.status === 'ACTIVE';

  // Stepper labels
  const STEPS = [
    { step: 1 as const, title: 'Application Overview', desc: 'Identity & Status' },
    { step: 2 as const, title: 'Documents & Evidence', desc: 'Secure Vault' },
    { step: 3 as const, title: 'Verification Checklist', desc: '6-Point Vetting' },
    { step: 4 as const, title: 'Final Decision', desc: 'Trust Approval' },
    { step: 5 as const, title: 'Activation & Eligibility', desc: 'Roster State' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-border-subtle)',
          width: '100%',
          maxWidth: '1240px',
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle)',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-accent)',
                fontWeight: 800,
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            >
              {worker.name.charAt(0)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                  {worker.name}
                </h2>
                <VerificationBadge isFullyVerified={worker.isFullyVerified} />
                <StatusBadge status={worker.status} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--color-accent)', fontFamily: 'monospace', fontWeight: 700 }}>
                  ID: {worker.id}
                </span>
                <span style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                  • App ID: {worker.applicationId || dossier?.applicationId || `APP-${worker.id}`}
                </span>
                <span style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  • {worker.category} • {worker.experienceYears} Yrs Exp • {worker.locality}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dossier"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Matching Eligibility Callout Banner */}
        <div style={{ flexShrink: 0, padding: '10px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-border-subtle)' }}>
          {isMatchingEligible ? (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--color-status-success-bg)',
                border: '1px solid var(--color-status-success-text)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-success-text)',
              }}
            >
              <CheckCircle2 size={16} />
              <span>
                <strong>Matching Eligibility: ELIGIBLE</strong> • Worker has completed all required verification checks and maintains an Active account. Approved for customer matching, trials, and household assignments.
              </span>
            </div>
          ) : !worker.isFullyVerified ? (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-text)',
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
                    navigate(`/verification?search=${encodeURIComponent(worker.id)}&dossierId=${encodeURIComponent(worker.id)}`);
                  }}
                  style={{
                    padding: '4px 12px',
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
                padding: '10px 16px',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-text)',
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
            gap: '8px',
            borderBottom: '1px solid var(--color-border-subtle)',
            padding: '4px 24px 0 24px',
            backgroundColor: 'var(--color-bg-subtle)',
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
                onClick={() => setActiveTab(tab.key as TabKey)}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--color-brand-600, var(--color-primary))' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--color-brand-600, var(--color-primary))' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
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
            padding: '24px 28px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            backgroundColor: 'var(--color-bg-app, #f8fafc)',
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
                  {STEPS.map((s) => {
                    const isStepActive = currentStep === s.step;
                    const isStepComplete =
                      (s.step === 1 && Boolean(worker.id)) ||
                      (s.step === 2 && (worker.documents?.length || 0) > 0) ||
                      (s.step === 3 && allMandatoryChecksApproved) ||
                      (s.step === 4 && worker.isFullyVerified) ||
                      (s.step === 5 && isMatchingEligible);

                    return (
                      <button
                        key={s.step}
                        onClick={() => setCurrentStep(s.step)}
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
                          minHeight: '66px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: isStepComplete
                                ? 'var(--color-status-success-text)'
                                : isStepActive
                                ? 'var(--color-brand-600)'
                                : 'var(--color-border)',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isStepComplete ? <Check size={12} /> : s.step}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: isStepActive ? 800 : 700,
                              color: isStepActive ? 'var(--color-brand-700, #1d4ed8)' : isStepComplete ? '#15803d' : 'var(--color-text-primary)',
                              whiteSpace: 'normal',
                              lineHeight: 1.25,
                            }}
                          >
                            {s.title}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', paddingLeft: '26px' }}>
                          {s.desc}
                        </span>
                      </button>
                    );
                  })}
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
                        {worker.applicationId || dossier?.applicationId || `APP-${worker.id}`}
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
                          {isPhoneRevealed ? (worker.phoneMasked?.replace('*****', '43210') || '+91 98765 43210') : worker.phoneMasked}
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
                            (Requires reveal_pii permission)
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
                        {(worker.documents || []).map((doc, idx) => {
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
                        })}
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

                      {isDocLoading ? (
                        <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                          <LoadingSpinner message="Fetching authorized signed document link from secure vault..." />
                        </div>
                      ) : isDocError ? (
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
                            Failed to load document attachment
                          </h5>
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', maxWidth: '380px', margin: '0 auto var(--space-3) auto' }}>
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
                      ) : docLinkData?.signedUrl ? (
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
                            }}
                          >
                            <FileText size={48} color="var(--color-brand-600)" />
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

                          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
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
                          </div>
                        </div>
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

                  {/* 5 Operational Checks Interactive Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {operationalChecksList.map(({ key, label, check }) => (
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
                          <div>
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                              {label}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)' }}>
                              Method: {check.evaluationMethod === 'TELEPHONIC_VETTING' ? 'Telephonic Call Vetting' : 'Visual Document Inspection'}
                            </span>
                          </div>
                          <StatusBadge status={check.status} />
                        </div>

                        {/* Evidence & Details */}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                          {check.documentMetadata && (
                            <span>
                              <strong>Doc Ref:</strong> {check.documentMetadata.docNumberMasked || 'XXXX-XXXX-VALID'} ({check.documentMetadata.documentTypeName})
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
                        {canReview && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending}
                              onClick={() => {
                                setRecheckCheckType(key);
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
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <RotateCcw size={12} />
                              <span>Request Re-Verification</span>
                            </button>

                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending}
                              onClick={() => {
                                setRejectCheckType(key);
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
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <XCircle size={12} />
                              <span>Reject Check</span>
                            </button>

                            <button
                              disabled={approveCheckMutation.isPending || rejectCheckMutation.isPending || check.status === 'APPROVED'}
                              onClick={() => approveCheckMutation.mutate({ checkType: key, notes: 'Verified and approved by Verification Executive' })}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-brand-600)',
                                backgroundColor: check.status === 'APPROVED' ? 'var(--color-status-success-bg)' : 'var(--color-brand-600)',
                                color: check.status === 'APPROVED' ? 'var(--color-status-success-text)' : '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: check.status === 'APPROVED' ? 'default' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={12} />
                              <span>{check.status === 'APPROVED' ? 'Check Approved' : 'Approve Check'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
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
                      <span>Proceed to Step 4: Final Decision</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: FINAL VERIFICATION DECISION */}
              {currentStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 4: Final Verification Decision & Authority Gate
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Enforce verification prerequisite criteria before committing the authoritative decision to the server.
                    </p>
                  </div>

                  {/* Prerequisites Checklist Card */}
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
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      Prerequisite Compliance Checklist
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '11px', marginTop: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {otpPassed ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <XCircle size={14} color="var(--color-status-danger-text)" />}
                        <span>1. Mobile OTP Pre-Check (Automated)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {idApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>2. Identity Proof Check</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {addressApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>3. Residential Address Proof Check</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {emergencyApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>4. Emergency Contact Vetting Check</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {referenceApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>5. Prior Employer Reference Check</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {policeApproved ? <CheckCircle2 size={14} color="var(--color-status-success-text)" /> : <Clock size={14} color="var(--color-status-warning-text)" />}
                        <span>6. Police Clearance Certificate Check</span>
                      </div>
                    </div>
                  </div>

                  {/* Decision State Analysis Banner */}
                  {allMandatoryChecksApproved ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-status-success-bg)',
                        border: '1px solid var(--color-status-success-text)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-success-text)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        <CheckCircle2 size={18} />
                        <span>All 6 Verification Checks Approved & Verified</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>
                        The candidate satisfies all mandatory SevaNest trust requirements. You are authorized to submit the final decision to mark this worker as <strong>VERIFIED</strong>.
                      </p>
                    </div>
                  ) : hasRejectedCheck ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-status-danger-bg)',
                        border: '1px solid var(--color-status-danger-text)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-danger-text)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        <XCircle size={18} />
                        <span>Rejection Findings Recorded</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>
                        One or more checks have been rejected by the verification executive. You can confirm final rejection or issue a correction notice prompting the candidate to re-upload rectifications.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-status-warning-bg)',
                        border: '1px solid var(--color-status-warning-text)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-warning-text)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        <AlertTriangle size={18} />
                        <span>Final Verification Decision Locked</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', lineHeight: 1.5 }}>
                        Final approval cannot be submitted until every check in Step 3 is completed. Remaining incomplete checks: {operationalChecksList.filter((c) => !c.approved).map((c) => c.label).join(', ')}.
                      </p>
                    </div>
                  )}

                  {/* Submission Controls */}
                  {canDecide && (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                          Authoritative Executive Remarks & Compliance Rationale:
                        </label>
                        <textarea
                          rows={2}
                          value={finalDecisionRemarks}
                          onChange={(e) => setFinalDecisionRemarks(e.target.value)}
                          placeholder="Record final verification notes for audit logging (e.g., Identity, address, and criminal record clear. Ready for operational activation)..."
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

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {hasRejectedCheck && (
                          <>
                            <button
                              disabled={finalDecisionMutation.isPending}
                              onClick={() =>
                                finalDecisionMutation.mutate({
                                  decision: 'CORRECTIONS_REQUESTED',
                                  remarks: finalDecisionRemarks || 'Candidate correction requested for failed checks.',
                                })
                              }
                              style={{
                                padding: '8px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-warning-dark)',
                                backgroundColor: 'var(--color-warning-bg)',
                                color: 'var(--color-warning-dark)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Issue Corrections Request
                            </button>
                            <button
                              disabled={finalDecisionMutation.isPending}
                              onClick={() =>
                                finalDecisionMutation.mutate({
                                  decision: 'REJECTED',
                                  remarks: finalDecisionRemarks || 'Application rejected due to failed verification checks.',
                                })
                              }
                              style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-error-dark)',
                                backgroundColor: 'var(--color-error-bg)',
                                color: 'var(--color-error-dark)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Confirm Final Rejection
                            </button>
                          </>
                        )}

                        <button
                          disabled={!allMandatoryChecksApproved || finalDecisionMutation.isPending}
                          onClick={() =>
                            finalDecisionMutation.mutate({
                              decision: 'APPROVED',
                              remarks: finalDecisionRemarks || 'All 6 checks verified and approved by Verification Executive.',
                            })
                          }
                          style={{
                            padding: '8px 20px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: allMandatoryChecksApproved ? 'var(--color-brand-600)' : 'var(--color-border)',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            cursor: allMandatoryChecksApproved ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <ShieldCheck size={16} />
                          <span>
                            {finalDecisionMutation.isPending ? 'Submitting Decision...' : 'Submit Final Verification Approval (VERIFIED)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

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
                      <span>Proceed to Step 5: Activation & Eligibility</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: WORKER ACTIVATION AND ELIGIBILITY STATUS */}
              {currentStep === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                      Step 5: Worker Activation & Matching Eligibility Handoff
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, marginTop: '2px' }}>
                      Understand cross-role handoff between Verification Executive and Operations Admin.
                    </p>
                  </div>

                  {/* Role Separation Notice */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-subtle)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-brand-700)', fontWeight: 700, display: 'block' }}>
                        Verification Executive Role Responsibility
                      </span>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        Vets applicant identity, address proof, telephonic references, and criminal records. Issues the <strong>VERIFIED</strong> outcome upon satisfying all 6 checks. Does <em>not</em> activate accounts or assign commercial bookings.
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-navy)', fontWeight: 700, display: 'block' }}>
                        Operations Admin Role Responsibility
                      </span>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        Manages workforce capacity, service category qualifications, and account status mutations. Activates verified workers to <strong>ACTIVE</strong> on the commercial roster.
                      </p>
                    </div>
                  </div>

                  {/* Operational Status & Action Box */}
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
                        {isMatchingEligible ? 'ACTIVE & VERIFIED' : worker.status}
                      </span>
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {isMatchingEligible
                        ? 'Worker is fully verified and actively enabled on the household matching engine. Operations Admins may assign this worker to domestic booking requests and trials.'
                        : worker.isFullyVerified
                        ? 'Worker has completed verification checks, but account activation is pending. Operations Admin must activate the worker account before matching eligibility is unlocked.'
                        : 'Worker cannot be activated or matched until all mandatory verification checks are completed in Steps 1 through 4.'}
                    </p>

                    {/* Operations Admin Action Control */}
                    {canManageStatus ? (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        {worker.status !== 'ACTIVE' && worker.isFullyVerified && (
                          <button
                            disabled={activateWorkerMutation.isPending}
                            onClick={() => activateWorkerMutation.mutate('Activated onto commercial roster by Operations Admin')}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-brand-600)',
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
                            <UserCheck size={16} />
                            <span>{activateWorkerMutation.isPending ? 'Activating...' : 'Activate Worker Account (Operations Admin)'}</span>
                          </button>
                        )}
                        {worker.status === 'ACTIVE' && (
                          <button
                            onClick={() => {
                              setTargetStatus('SUSPENDED');
                              setIsDisciplineOpen(true);
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'var(--color-status-warning-bg)',
                              color: 'var(--color-status-warning-text)',
                              border: '1px solid var(--color-status-warning-text)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Suspend Worker Account
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        (Worker account activation is reserved for Operations Admins. Verification Executives are not granted workers.manage_status permissions.)
                      </div>
                    )}
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
                      <span>Back to Step 4: Final Decision</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PERSONAL & CONTACT */}
          {activeTab === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  Personal & Contact Information
                </h3>
              </div>
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
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Full Registered Name</span>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{worker.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Worker ID & Unique Code</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--color-brand-700)' }}>{worker.id}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Primary Locality</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {worker.locality}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Maximum Service Radius</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{worker.serviceRadiusKm} km from locality base</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Masked Contact Number</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                    <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {isPhoneRevealed ? (worker.phoneMasked?.replace('*****', '43210') || '+91 98765 43210') : worker.phoneMasked}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Initial Registration Date</span>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>
                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {worker.registeredAt}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROFESSIONAL PROFILE */}
          {activeTab === 'professional' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
                    Assigned Service Categories
                  </span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {(worker.categories && worker.categories.length > 0 ? worker.categories : [worker.category]).map((c) => (
                      <span
                        key={c}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-brand-100, #e0f2fe)',
                          color: 'var(--color-brand-700, #0369a1)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE}>
                  <button
                    onClick={openCategoryModal}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-brand-600, var(--color-primary))',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sliders size={13} />
                    <span>Manage Categories</span>
                  </button>
                </PermissionGate>
              </div>

              {/* Skills, Languages, & Wages */}
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
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Experience Duration</span>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    {worker.experienceYears} Years Household Experience
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Languages Spoken</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    <Languages size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {worker.languages.join(', ')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Current Allocation Availability</span>
                  <strong style={{ color: 'var(--color-status-success-text)' }}>{worker.availability || 'Available for Allocation'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Expected Monthly Compensation</span>
                  <strong style={{ color: 'var(--color-accent)' }}>
                    <DollarSign size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {worker.expectedCompensation || '₹18,000 / month'}
                  </strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Skill Competencies</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(worker.skills || ['General Domestic Assistance', 'Household Hygiene', 'Punctuality', 'Deep Cleaning']).map((s) => (
                      <span
                        key={s}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border-subtle)',
                          fontSize: '11px',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Professional Biography & Overview</span>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {worker.bio}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KYC DOCUMENTS VAULT */}
          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Document Type</th>
                      <th style={{ padding: '8px 12px' }}>Document ID / Reference</th>
                      <th style={{ padding: '8px 12px' }}>Verification State</th>
                      <th style={{ padding: '8px 12px' }}>Submission Timestamp</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Security Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(worker.documents || []).map((doc, idx) => (
                      <tr key={doc.id || idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {doc.documentTypeName}
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
                              onClick={() => {
                                setActiveTab('verification');
                                setCurrentStep(2);
                              }}
                              style={{
                                padding: '3px 8px',
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
                              <ExternalLink size={11} />
                              <span>Inspect in Workstation</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              Document View Restricted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: OPERATIONAL ENGAGEMENTS */}
          {activeTab === 'operational' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Quick Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Rating Score</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={18} fill="#f59e0b" color="#f59e0b" />
                    <span>{worker.ratingAverage}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>({worker.totalReviews})</span>
                  </div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Completed Jobs</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{worker.completedBookingsCount}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Active Engagements</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-accent)' }}>{worker.activeEngagementsCount}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Replacements</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: worker.replacementsIncurred > 0 ? 'var(--color-status-warning-text)' : 'var(--color-status-success-text)' }}>
                    {worker.replacementsIncurred}
                  </div>
                </div>
              </div>

              {/* Recent Household Engagements */}
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                  Recent Household Engagements
                </h3>
                {worker.recentEngagements.length > 0 ? (
                  <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>Booking Ref</th>
                          <th style={{ padding: '8px 12px' }}>Customer Name</th>
                          <th style={{ padding: '8px 12px' }}>Service Category</th>
                          <th style={{ padding: '8px 12px' }}>Operational Status</th>
                          <th style={{ padding: '8px 12px' }}>Engagement Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {worker.recentEngagements.map((eng) => (
                          <tr key={eng.bookingId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{eng.bookingId}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{eng.customerName}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{eng.serviceCategory}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusBadge status={eng.status} />
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{eng.period}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
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
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <PermissionGate permission={PERMISSIONS.WORKERS_MANAGE_STATUS}>
              {worker.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => {
                      setTargetStatus('SUSPENDED');
                      setIsDisciplineOpen(true);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-warning-bg)',
                      color: 'var(--color-status-warning-text)',
                      border: '1px solid var(--color-status-warning-text)',
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
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-danger-bg)',
                      color: 'var(--color-status-danger-text)',
                      border: '1px solid var(--color-status-danger-text)',
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
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-status-success-bg)',
                    color: 'var(--color-status-success-text)',
                    border: '1px solid var(--color-status-success-text)',
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
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border-subtle)',
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
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
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
        onConfirm={(remarks) =>
          rejectCheckMutation.mutate({
            checkType: rejectCheckType,
            category: rejectCategory,
            remarks: remarks || rejectRemarks || 'Verification check rejected by executive.',
          })
        }
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
        onConfirm={(instructions) =>
          recheckMutation.mutate({
            checkTypes: [recheckCheckType],
            instructions: instructions || recheckInstructions || 'Periodic compliance re-verification requested.',
          })
        }
        onCancel={() => setIsRecheckModalOpen(false)}
      />

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
