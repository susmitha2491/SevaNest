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
 * Evaluates the sequential dependencies and current review state across all checks
 * for a given worker dossier.
 *
 * Rules:
 * 1. Step 1 (Identity) is actionable first.
 * 2. Step N can only be approved if Steps 1..(N-1) are already APPROVED.
 * 3. If any preceding step is PENDING, IN_REVIEW, REJECTED, or RECHECK_DUE, subsequent steps are LOCKED.
 * 4. The current actionable step is the earliest unapproved step in sequence.
 * 5. Full verification eligibility requires all 5 operations checks to be APPROVED and OTP pre-check passed.
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

    // A step is locked if any preceding step in the sequence is NOT approved
    let isLocked = false;
    let prerequisiteStepNumber: number | undefined = undefined;
    let prerequisiteTitle: string | undefined = undefined;
    const prerequisiteBlockers: string[] = [];

    for (let j = 0; j < i; j++) {
      const prevDef = VERIFICATION_CHECK_ORDER[j];
      const prevCheck = safeChecks[prevDef.type];
      const prevStatus = prevCheck?.status || 'PENDING';
      if (prevStatus !== 'APPROVED') {
        isLocked = true;
        if (!prerequisiteStepNumber) {
          prerequisiteStepNumber = prevDef.stepNumber;
          prerequisiteTitle = prevDef.title;
        }
        prerequisiteBlockers.push(`${prevDef.stepNumber}. ${prevDef.title}`);
      }
    }

    const isCurrentActionable = !firstUnapprovedFound && !isCompleted;
    if (isCurrentActionable) {
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
