import { AdminRole } from '../auth/authTypes';

/**
 * Authoritative, user-friendly role labels for SevaNest administrative personas.
 * Conforms to SevaNest Admin Portal Architecture and Role-Wise Specifications.
 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_ADMIN: 'Operations Admin',
  VERIFICATION_EXECUTIVE: 'Verification Executive',
  VERIFICATION_SUPERVISOR: 'Verification Supervisor',
  SUPPORT_EXECUTIVE: 'Support Executive',
};

/**
 * Derives a human-readable, canonical role label for any administrative user.
 * Normalizes backend role codes and provides a clean Title-Case fallback for novel roles.
 */
export function getRoleLabel(role?: string | null): string {
  if (!role || typeof role !== 'string' || !role.trim()) {
    return 'Account';
  }

  const raw = role.trim().toUpperCase();

  // Normalized alias checks
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN' || raw === 'SUPER_ADMINISTRATOR') {
    return ROLE_LABELS.SUPER_ADMIN;
  }
  if (
    raw === 'OPERATIONS_ADMIN' ||
    raw === 'OPERATIONS_MANAGER' ||
    raw === 'OPS_MANAGER' ||
    raw === 'OPS_ADMIN'
  ) {
    return ROLE_LABELS.OPERATIONS_ADMIN;
  }
  if (
    raw === 'VERIFICATION_EXECUTIVE' ||
    raw === 'VERIFICATION_OFFICER' ||
    raw === 'VERIF_EXEC' ||
    raw === 'VERIFICATION_SPECIALIST'
  ) {
    return ROLE_LABELS.VERIFICATION_EXECUTIVE;
  }
  if (
    raw === 'VERIFICATION_SUPERVISOR' ||
    raw === 'VERIF_SUPERVISOR' ||
    raw === 'VERIFICATION_LEAD'
  ) {
    return ROLE_LABELS.VERIFICATION_SUPERVISOR;
  }
  if (
    raw === 'SUPPORT_EXECUTIVE' ||
    raw === 'SUPPORT_EXEC' ||
    raw === 'SUPPORT_MANAGER' ||
    raw === 'SUPPORT_SPECIALIST'
  ) {
    return ROLE_LABELS.SUPPORT_EXECUTIVE;
  }

  // Fallback: Convert SNAKE_CASE or kebab-case to Title Case words
  return raw
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
