import {
  VerificationCheckType,
  VerificationCheckStatus,
  VerificationCheck,
} from './types';

export interface VerificationStepDefinition {
  type: VerificationCheckType;
  stepNumber: number;
  title: string;
  shortTitle: string;
  evaluationMethod: 'DOCUMENT_INSPECTION' | 'TELEPHONIC_VETTING' | 'CERTIFICATE_TRACKING';
  isDocumentRequired: boolean;
}

/**
 * Authoritative 5 Operations Checks Review Order according to:
 * - SevaNest PRD Section 9 (Trust, Verification & Safety Framework)
 * - SevaNest Verification Executive Operational Specification Section 4.1 & 4.3
 */
export const VERIFICATION_CHECK_ORDER: VerificationStepDefinition[] = [
  {
    type: 'IDENTITY',
    stepNumber: 1,
    title: 'Identity Proof',
    shortTitle: '1. Identity Proof',
    evaluationMethod: 'DOCUMENT_INSPECTION',
    isDocumentRequired: true,
  },
  {
    type: 'ADDRESS',
    stepNumber: 2,
    title: 'Address Proof',
    shortTitle: '2. Address Proof',
    evaluationMethod: 'DOCUMENT_INSPECTION',
    isDocumentRequired: true,
  },
  {
    type: 'EMERGENCY_CONTACT',
    stepNumber: 3,
    title: 'Emergency Contact',
    shortTitle: '3. Emergency Contact',
    evaluationMethod: 'TELEPHONIC_VETTING',
    isDocumentRequired: false,
  },
  {
    type: 'REFERENCE',
    stepNumber: 4,
    title: 'Employer Reference',
    shortTitle: '4. Employer Reference',
    evaluationMethod: 'TELEPHONIC_VETTING',
    isDocumentRequired: false,
  },
  {
    type: 'POLICE_CLEARANCE',
    stepNumber: 5,
    title: 'Police Certificate',
    shortTitle: '5. Police Certificate',
    evaluationMethod: 'CERTIFICATE_TRACKING',
    isDocumentRequired: false,
  },
];

export interface OrderedCheckState {
  type: VerificationCheckType;
  stepNumber: number;
  order: number;
  title: string;
  shortTitle: string;
  evaluationMethod: 'DOCUMENT_INSPECTION' | 'TELEPHONIC_VETTING' | 'CERTIFICATE_TRACKING';
  isDocumentRequired: boolean;
  check?: VerificationCheck;
  status: VerificationCheckStatus;
  isCompleted: boolean;
  isCurrentActionable: boolean;
  isLocked: boolean;
  prerequisiteStepNumber?: number;
  prerequisiteTitle?: string;
  prerequisiteBlockers: string[];
}

export interface VerificationWorkflowEvaluation {
  orderedSteps: OrderedCheckState[];
  steps: OrderedCheckState[];
  currentActionableType: VerificationCheckType | null;
  currentActionableStepNumber: number | null;
  allMandatoryChecksApproved: boolean;
  allApproved: boolean;
  hasRejectedCheck: boolean;
  hasRecheckDue: boolean;
  approvedCount: number;
  totalChecksCount: number;
  otpPreCheckPassed: boolean;
  isFullyEligibleForVerification: boolean;
  canAcceptApplication: boolean;
}

/**
 * Evaluates the review state across all checks for a given worker dossier.
 *
 * Rules:
 * 1. All reviewable documents and checks are independently accessible in any order (no frontend locking).
 * 2. An individual check is actionable when not yet approved.
 * 3. Full verification eligibility strictly requires all 5 operations checks to be APPROVED and OTP pre-check passed.
 * 4. Final verification sign-off is gated on all mandatory checks being approved.
 */
export function evaluateVerificationWorkflow(
  checks?: Record<VerificationCheckType, VerificationCheck> | null,
  otpPreCheckPassed: boolean = true
): VerificationWorkflowEvaluation {
  const safeChecks = checks || ({} as Record<VerificationCheckType, VerificationCheck>);

  let firstUnapprovedFound = false;
  let currentActionableType: VerificationCheckType | null = null;
  let currentActionableStepNumber: number | null = null;

  let approvedCount = 0;
  let hasRejectedCheck = false;
  let hasRecheckDue = false;

  const orderedSteps: OrderedCheckState[] = [];

  for (let i = 0; i < VERIFICATION_CHECK_ORDER.length; i++) {
    const stepDef = VERIFICATION_CHECK_ORDER[i];
    const check = safeChecks[stepDef.type];
    const status: VerificationCheckStatus = check?.status || 'PENDING';
    const isCompleted = status === 'APPROVED';

    if (isCompleted) {
      approvedCount++;
    }
    if (status === 'REJECTED') {
      hasRejectedCheck = true;
    }
    if (status === 'RECHECK_DUE') {
      hasRecheckDue = true;
    }

    // Frontend sequential locking is removed. All reviewable documents and checks
    // remain independently accessible and reviewable in any order.
    const isLocked = false;
    let prerequisiteStepNumber: number | undefined = undefined;
    let prerequisiteTitle: string | undefined = undefined;
    const prerequisiteBlockers: string[] = [];

    if (stepDef.type === 'ADDRESS') {
      const idStatus = safeChecks['IDENTITY']?.status;
      if (idStatus !== 'APPROVED') {
        prerequisiteStepNumber = 1;
        prerequisiteTitle = 'Identity Proof';
        prerequisiteBlockers.push('Step 1 (Identity Proof) must be approved first');
      }
    } else if (stepDef.type === 'EMERGENCY_CONTACT') {
      const addrStatus = safeChecks['ADDRESS']?.status;
      if (addrStatus !== 'APPROVED') {
        prerequisiteStepNumber = 2;
        prerequisiteTitle = 'Address Proof';
        prerequisiteBlockers.push('Step 2 (Address Proof) must be approved first');
      }
    } else if (stepDef.type === 'REFERENCE' || (stepDef.type as string) === 'PREVIOUS_EMPLOYMENT') {
      const emergStatus = safeChecks['EMERGENCY_CONTACT']?.status;
      if (emergStatus !== 'APPROVED') {
        prerequisiteStepNumber = 3;
        prerequisiteTitle = 'Emergency Contact';
        prerequisiteBlockers.push('Step 3 (Emergency Contact) must be approved first');
      }
    } else if (stepDef.type === 'POLICE_CLEARANCE' || (stepDef.type as string) === 'POLICE_VERIFICATION') {
      const idStatus = safeChecks['IDENTITY']?.status;
      const addrStatus = safeChecks['ADDRESS']?.status;
      if (idStatus !== 'APPROVED') {
        prerequisiteStepNumber = 1;
        prerequisiteTitle = 'Identity Proof';
        prerequisiteBlockers.push('Step 1 (Identity Proof) must be approved first');
      }
      if (addrStatus !== 'APPROVED') {
        if (!prerequisiteStepNumber) {
          prerequisiteStepNumber = 2;
          prerequisiteTitle = 'Address Proof';
        }
        prerequisiteBlockers.push('Step 2 (Address Proof) must be approved first');
      }
    }

    const isCurrentActionable = !isCompleted;
    if (isCurrentActionable && !firstUnapprovedFound) {
      firstUnapprovedFound = true;
      currentActionableType = stepDef.type;
      currentActionableStepNumber = stepDef.stepNumber;
    }

    orderedSteps.push({
      type: stepDef.type,
      stepNumber: stepDef.stepNumber,
      order: stepDef.stepNumber,
      title: stepDef.title,
      shortTitle: stepDef.shortTitle,
      evaluationMethod: stepDef.evaluationMethod,
      isDocumentRequired: stepDef.isDocumentRequired,
      check,
      status,
      isCompleted,
      isCurrentActionable,
      isLocked,
      prerequisiteStepNumber,
      prerequisiteTitle,
      prerequisiteBlockers,
    });
  }

  const allMandatoryChecksApproved = approvedCount === VERIFICATION_CHECK_ORDER.length;
  const isFullyEligibleForVerification = allMandatoryChecksApproved && otpPreCheckPassed;

  return {
    orderedSteps,
    steps: orderedSteps,
    currentActionableType,
    currentActionableStepNumber,
    allMandatoryChecksApproved,
    allApproved: allMandatoryChecksApproved,
    hasRejectedCheck,
    hasRecheckDue,
    approvedCount,
    totalChecksCount: VERIFICATION_CHECK_ORDER.length,
    otpPreCheckPassed,
    isFullyEligibleForVerification,
    canAcceptApplication: isFullyEligibleForVerification,
  };
}

/**
 * Returns the next check type in the sequence, or null if this is the last step.
 */
export function getNextStepType(currentType: VerificationCheckType): VerificationCheckType | null {
  const currentIndex = VERIFICATION_CHECK_ORDER.findIndex((s) => s.type === currentType);
  if (currentIndex >= 0 && currentIndex < VERIFICATION_CHECK_ORDER.length - 1) {
    return VERIFICATION_CHECK_ORDER[currentIndex + 1].type;
  }
  return null;
}

export interface VerificationProgressStage {
  stage: string;
  stageNumber: number;
  totalStages: number;
  approvedCount: number;
  percent: number;
  label: string;
}

/**
 * Calculates current verification stage, completed check count, and progress summary for a worker dossier.
 */
export function getVerificationProgressStage(dossier?: {
  checks?: Record<string, VerificationCheck>;
  status?: string;
} | null): VerificationProgressStage {
  if (!dossier) {
    return { stage: 'Not Started', stageNumber: 0, totalStages: 5, approvedCount: 0, percent: 0, label: '0/5 Checks' };
  }

  const checks = dossier.checks || {};
  let approvedCount = 0;
  for (const step of VERIFICATION_CHECK_ORDER) {
    const chk = checks[step.type] || checks[step.type === 'REFERENCE' ? 'PREVIOUS_EMPLOYMENT' : step.type === 'POLICE_CLEARANCE' ? 'POLICE_VERIFICATION' : step.type];
    if (chk?.status === 'APPROVED') {
      approvedCount++;
    }
  }

  if (dossier.status === 'APPROVED') {
    return { stage: 'Approved & Signed Off', stageNumber: 5, totalStages: 5, approvedCount: 5, percent: 100, label: '5/5 Approved' };
  }
  if (dossier.status === 'RECHECK_DUE') {
    return { stage: 'Re-Check Due', stageNumber: approvedCount, totalStages: 5, approvedCount, percent: Math.round((approvedCount / 5) * 100), label: 'Recheck Due' };
  }
  if (dossier.status === 'REJECTED') {
    return { stage: 'Corrections Required', stageNumber: approvedCount, totalStages: 5, approvedCount, percent: Math.round((approvedCount / 5) * 100), label: 'Corrections Needed' };
  }

  // Find first unapproved step
  for (const step of VERIFICATION_CHECK_ORDER) {
    const chk = checks[step.type] || checks[step.type === 'REFERENCE' ? 'PREVIOUS_EMPLOYMENT' : step.type === 'POLICE_CLEARANCE' ? 'POLICE_VERIFICATION' : step.type];
    if (chk?.status !== 'APPROVED') {
      return {
        stage: step.title,
        stageNumber: step.stepNumber,
        totalStages: 5,
        approvedCount,
        percent: Math.round((approvedCount / 5) * 100),
        label: `${approvedCount}/5 • ${step.title}`,
      };
    }
  }

  return { stage: 'Ready for Sign-Off', stageNumber: 5, totalStages: 5, approvedCount: 5, percent: 100, label: '5/5 Approved • Pending Sign-Off' };
}

/**
 * Calculates the next required operational action description for a worker dossier.
 */
export function getNextActionDescription(dossier?: {
  checks?: Record<string, VerificationCheck>;
  status?: string;
} | null): string {
  if (!dossier) return 'Open Dossier';
  if (dossier.status === 'APPROVED') return 'Verification Completed';
  if (dossier.status === 'RECHECK_DUE') return 'Review Expired Credentials';
  if (dossier.status === 'REJECTED') return 'Review Corrections';
  if (dossier.status === 'PENDING_REVIEW') return 'Start Review / Claim';

  const checks = dossier.checks || {};
  for (const step of VERIFICATION_CHECK_ORDER) {
    const chk = checks[step.type] || checks[step.type === 'REFERENCE' ? 'PREVIOUS_EMPLOYMENT' : step.type === 'POLICE_CLEARANCE' ? 'POLICE_VERIFICATION' : step.type];
    if (chk?.status !== 'APPROVED') {
      switch (step.type) {
        case 'IDENTITY':
          return 'Inspect Identity Proof';
        case 'ADDRESS':
          return 'Inspect Address Proof';
        case 'EMERGENCY_CONTACT':
          return 'Vet Emergency Contact';
        case 'REFERENCE':
          return 'Call Employer Reference';
        case 'POLICE_CLEARANCE':
          return 'Record Police Certificate';
        default:
          return `Verify ${step.title}`;
      }
    }
  }

  return 'Supervisor Sign-Off';
}
