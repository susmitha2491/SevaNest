import { VerificationCheck, VerificationCheckType } from './types';

export function getLatestReVerificationEvent(check?: VerificationCheck) {
  if (!check?.history || check.history.length === 0) return undefined;
  const lastEvent = check.history[check.history.length - 1];
  if (lastEvent.fromStatus === 'APPROVED' && lastEvent.toStatus === 'IN_REVIEW') {
    return lastEvent;
  }
  return undefined;
}

/**
 * Determines from backend check status and event history whether re-verification is already pending.
 */
export function hasPendingReVerification(check?: VerificationCheck): boolean {
  if (!check) return false;
  if (check.status === 'RECHECK_DUE') return true;
  if (check.status === 'IN_REVIEW' && Boolean(getLatestReVerificationEvent(check))) {
    return true;
  }
  return false;
}

/**
 * Extracts the backend-recorded re-verification reason when pending.
 */
export function getPendingReVerificationReason(check?: VerificationCheck): string | undefined {
  const ev = getLatestReVerificationEvent(check);
  if (ev?.remarks && ev.remarks.trim() !== '') {
    return ev.remarks.trim();
  }
  if (check?.rejectionRemarks && check.rejectionRemarks.trim() !== '') {
    return check.rejectionRemarks.trim();
  }
  return undefined;
}

/**
 * Backend POST /admin/verification/checks/{checkId}/recheck strictly transitions APPROVED -> IN_REVIEW.
 */
export function canRequestReVerification(check?: VerificationCheck): boolean {
  if (!check) return false;
  const checkId = (check.id || check.checkId || '').trim();
  if (!checkId) return false;
  return check.status === 'APPROVED' && !hasPendingReVerification(check);
}

export function formatCheckTypeLabel(checkType?: VerificationCheckType | string): string {
  switch (checkType) {
    case 'IDENTITY':
      return 'Identity Proof';
    case 'ADDRESS':
      return 'Address Proof';
    case 'EMERGENCY_CONTACT':
      return 'Emergency Contact';
    case 'REFERENCE':
    case 'PREVIOUS_EMPLOYMENT':
      return 'Employer Reference';
    case 'POLICE_CLEARANCE':
    case 'POLICE_VERIFICATION':
      return 'Police Certificate';
    case 'SKILL_CERTIFICATE':
      return 'Skill Certificate';
    case 'LICENSE':
      return 'Driving License';
    default:
      return String(checkType || 'Document').replace(/_/g, ' ');
  }
}

