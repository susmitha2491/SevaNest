/**
 * Canonical Permission Keys for SevaNest Admin Portal.
 * All UI gates evaluate server-issued permission strings.
 */

export const PERMISSIONS = {
  ALERT_VIEW: 'alert.view',
  ALERT_MANAGE: 'alert.manage',
  DASHBOARD_VIEW: 'dashboard.view', // Backward-compatible view key, maps to alert.view in hasPermission
  CUSTOMER_VIEW: 'customer.view', // Canonical singular backend code
  CUSTOMERS_VIEW: 'customer.view', // Backward-compatible alias
  CUSTOMER_MANAGE: 'customer.manage', // Canonical singular backend code
  CUSTOMERS_MANAGE: 'customer.manage', // Backward-compatible alias
  CUSTOMERS_MANAGE_STATUS: 'user.status.manage', // Canonical backend user status manage
  USER_STATUS_MANAGE: 'user.status.manage', // Canonical backend user status manage
  USER_VIEW: 'user.view',
  WORKER_VIEW: 'worker.view',
  WORKERS_VIEW: 'worker.view', // Canonical singular backend code
  WORKER_MANAGE: 'worker.manage', // Canonical singular backend code
  WORKERS_MANAGE: 'worker.manage', // Backward-compatible alias
  WORKERS_MANAGE_STATUS: 'user.status.manage', // Canonical backend user status manage
  WORKER_ACTIVATE: 'worker.activate',
  WORKER_REVEAL_EMERGENCY_CONTACT: 'worker.reveal_emergency_contact',
  WORKER_BLACKLIST: 'worker.blacklist',
  WORKER_BLACKLIST_LIFT: 'worker.blacklist.lift',
  VERIFICATION_REVIEW: 'verification.review',
  VERIFICATION_DECIDE: 'verification.decide',
  VERIFICATION_SIGNOFF: 'verification.signoff',
  VERIFICATION_REASSIGN: 'verification.reassign',
  VERIFICATION_DOCUMENT_VIEW: 'verification.document.view',
  DOCUMENTS_VIEW_RESTRICTED: 'verification.document.view', // Aliased to canonical verification.document.view
  VERIFICATION_CONFIGURE: 'verification.configure',
  BOOKING_VIEW: 'booking.view',
  BOOKINGS_VIEW: 'bookings.view',
  BOOKING_MANAGE: 'booking.manage',
  BOOKINGS_MANAGE: 'bookings.manage',
  MATCHING_RUN: 'matching.run',
  REPLACEMENT_VIEW: 'replacement.view',
  REPLACEMENT_MANAGE: 'replacement.manage',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  RATING_VIEW: 'rating.view',
  RATING_MODERATE: 'rating.moderate',
  PAYMENT_VIEW: 'payment.view',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENT_MANAGE: 'payment.manage',
  PAYMENT_REFUND: 'payment.refund',
  REFUNDS_MANAGE: 'refunds.manage',
  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage',
  SUPPORT_CATEGORY_MANAGE: 'support.category.manage',
  REPORT_VIEW: 'report.view',
  REPORTS_VIEW: 'reports.view',
  EXPORTS_GENERATE: 'exports.generate',
  CATEGORY_MANAGE: 'category.manage',
  AREA_MANAGE: 'area.manage',
  NOTIFICATION_MANAGE: 'notification.manage',
  CONFIG_MANAGE: 'config.manage',
  CONFIGURATION_MANAGE: 'configuration.manage',
  ROLE_MANAGE: 'role.manage',
  ROLES_MANAGE: 'roles.manage',
  ADMIN_MANAGE_USERS: 'admin.manage_users',
  AUDIT_VIEW: 'audit.view',
} as const;

export const SUPER_ADMIN_ONLY_PERMISSIONS: ReadonlySet<string> = new Set([
  'admin.manage_users',
  'audit.view',
  'role.manage',
  'worker.blacklist.lift',
]);

export function isSuperAdminOnlyPermission(code: string): boolean {
  return SUPER_ADMIN_ONLY_PERMISSIONS.has(code);
}

export function mapLegacyPermissionToCanonical(code: string): string {
  switch (code) {
    case 'dashboard.view':
      return 'alert.view';
    case 'customers.view':
      return 'customer.view';
    case 'customers.manage':
      return 'customer.manage';
    case 'customers.manage_status':
    case 'workers.manage_status':
      return 'user.status.manage';
    case 'workers.view':
      return 'worker.view';
    case 'workers.manage':
      return 'worker.manage';
    case 'documents.view_restricted':
      return 'verification.document.view';
    case 'bookings.view':
      return 'booking.view';
    case 'bookings.manage':
      return 'booking.manage';
    case 'payments.view':
      return 'payment.view';
    case 'refunds.manage':
      return 'payment.refund';
    case 'reports.view':
    case 'exports.generate':
    case 'report.export':
    case 'reports.export':
      return 'report.view';
    case 'configuration.manage':
      return 'config.manage';
    case 'roles.manage':
      return 'role.manage';
    default:
      return code;
  }
}

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | string;

export function hasPermission(userPermissions: string[] | undefined, required: PermissionKey): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  const canonicalRequired = mapLegacyPermissionToCanonical(required);
  if (userPermissions.includes(canonicalRequired)) return true;
  if (userPermissions.some((p) => mapLegacyPermissionToCanonical(p) === canonicalRequired)) {
    return true;
  }
  // Support canonical dashboard overview via dashboard.view, alert.view, or support.view / support.manage
  if (
    (canonicalRequired === 'alert.view' || required === 'dashboard.view') &&
    (userPermissions.includes('dashboard.view') ||
     userPermissions.includes('alert.view') ||
     userPermissions.includes('support.view') ||
     userPermissions.includes('support.manage'))
  ) {
    return true;
  }
  return false;
}

export function hasAllPermissions(userPermissions: string[] | undefined, required: PermissionKey[]): boolean {
  if (!required.length) return true;
  return required.every((key) => hasPermission(userPermissions, key));
}

export function hasAnyPermission(userPermissions: string[] | undefined, required: PermissionKey[]): boolean {
  if (!required.length) return true;
  return required.some((key) => hasPermission(userPermissions, key));
}

/**
 * Derives the canonical operational landing route for an administrative user
 * based on their server-issued granular permissions.
 *
 * Every authenticated role (Super Admin, Operations Admin, Verification Executive,
 * Support Executive) consistently lands on the unified Dashboard (/dashboard).
 */
export function getDefaultLandingRoute(user: { permissions?: string[]; role?: string } | null | undefined): string {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return '/auth/login';
  }
  const permissions = user.permissions;

  // If user has zero permissions and is an unassigned / unknown role
  if (permissions.length === 0 && (!user.role || user.role === 'UNKNOWN')) {
    return '/account';
  }

  // Consistent landing route: Every authenticated role lands on the unified Dashboard (/dashboard)
  return '/dashboard';
}

export { getRoleLabel, ROLE_LABELS } from './roleLabels';
