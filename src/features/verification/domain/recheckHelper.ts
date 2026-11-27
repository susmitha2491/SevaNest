import { VerificationCheck, VerificationCheckType } from './types';

export function getLatestReVerificationEvent(check?: VerificationCheck) {
  if (!check?.history || check.history.length === 0) return undefined;
  const recheckEvents = check.history.filter(
    (ev) => ev.fromStatus === 'APPROVED' && ev.toStatus === 'IN_REVIEW'
  );
  if (recheckEvents.length === 0) return undefined;
  if (recheckEvents.length === 1) return recheckEvents[0];
  return [...recheckEvents].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  })[0];
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
  if (check?.notes && check.notes.length > 0) {
    const lastNote = check.notes[check.notes.length - 1];
    if (lastNote && lastNote.trim()) return lastNote.trim();
  }
  return undefined;
}

/**
 * Backend POST /admin/verification/checks/{checkId}/recheck strictly transitions APPROVED -> IN_REVIEW.
 */
export function canRequestReVerification(check?: VerificationCheck, fallbackCheckId?: string): boolean {
  if (!check) return false;
  const checkId = (check.id || check.checkId || fallbackCheckId || '').trim();
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

