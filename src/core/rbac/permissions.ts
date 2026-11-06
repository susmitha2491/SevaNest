/**
 * Canonical Permission Keys for SevaNest Admin Portal.
 * All UI gates evaluate server-issued permission strings.
 */

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CUSTOMER_VIEW: 'customer.view', // Canonical singular backend code
  CUSTOMERS_VIEW: 'customer.view', // Backward-compatible alias
  CUSTOMER_MANAGE: 'customer.manage', // Canonical singular backend code
  CUSTOMERS_MANAGE: 'customer.manage', // Backward-compatible alias
  CUSTOMERS_MANAGE_STATUS: 'user.status.manage', // Canonical backend user status manage
  USER_STATUS_MANAGE: 'user.status.manage', // Canonical backend user status manage
  WORKER_VIEW: 'worker.view',
  WORKERS_VIEW: 'worker.view', // Canonical singular backend code
  WORKER_MANAGE: 'worker.manage', // Canonical singular backend code
  WORKERS_MANAGE: 'worker.manage', // Backward-compatible alias
  WORKERS_MANAGE_STATUS: 'user.status.manage', // Canonical backend user status manage
  WORKER_ACTIVATE: 'worker.activate',
  VERIFICATION_REVIEW: 'verification.review',
  VERIFICATION_DECIDE: 'verification.decide',
  VERIFICATION_SIGNOFF: 'verification.signoff',
  VERIFICATION_DOCUMENT_VIEW: 'verification.document.view',
  DOCUMENTS_VIEW_RESTRICTED: 'verification.document.view', // Aliased to canonical verification.document.view
  BOOKINGS_VIEW: 'bookings.view',
  BOOKINGS_MANAGE: 'bookings.manage',
  PAYMENTS_VIEW: 'payments.view',
  REFUNDS_MANAGE: 'refunds.manage',
  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage',
  REPORTS_VIEW: 'reports.view',
  EXPORTS_GENERATE: 'exports.generate',
  CONFIGURATION_MANAGE: 'configuration.manage',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS] | string;

export function hasPermission(userPermissions: string[] | undefined, required: PermissionKey): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  // Support legacy documents.view_restricted string when checking VERIFICATION_DOCUMENT_VIEW
  if (required === PERMISSIONS.VERIFICATION_DOCUMENT_VIEW && userPermissions.includes('documents.view_restricted')) {
    return true;
  }
  // Support canonical customer.view and legacy customers.view interchangeably
  if (
    (required === PERMISSIONS.CUSTOMER_VIEW || required === 'customers.view' || required === 'customer.view') &&
    (userPermissions.includes('customer.view') || userPermissions.includes('customers.view'))
  ) {
    return true;
  }
  // Support canonical customer.manage and legacy customers.manage interchangeably
  if (
    (required === PERMISSIONS.CUSTOMER_MANAGE || required === 'customers.manage' || required === 'customer.manage') &&
    (userPermissions.includes('customer.manage') || userPermissions.includes('customers.manage'))
  ) {
    return true;
  }
  // Support canonical worker.view and legacy workers.view interchangeably
  if (
    (required === PERMISSIONS.WORKER_VIEW || required === 'workers.view' || required === 'worker.view') &&
    (userPermissions.includes('worker.view') || userPermissions.includes('workers.view'))
  ) {
    return true;
  }
  // Support canonical worker.manage and legacy workers.manage interchangeably
  if (
    (required === PERMISSIONS.WORKER_MANAGE || required === 'workers.manage' || required === 'worker.manage') &&
    (userPermissions.includes('worker.manage') || userPermissions.includes('workers.manage'))
  ) {
    return true;
  }
  // Support canonical user.status.manage and legacy manage_status keys interchangeably
  if (
    (required === PERMISSIONS.USER_STATUS_MANAGE || required === 'user.status.manage' || required === 'customers.manage_status' || required === 'workers.manage_status') &&
    (userPermissions.includes('user.status.manage') || userPermissions.includes('customers.manage_status') || userPermissions.includes('workers.manage_status'))
  ) {
    return true;
  }
  // Support canonical dashboard overview via dashboard.view, alert.view, or support.view / support.manage
  if (
    (required === PERMISSIONS.DASHBOARD_VIEW || required === 'dashboard.view') &&
    (userPermissions.includes('dashboard.view') ||
     userPermissions.includes('alert.view') ||
     userPermissions.includes('support.view') ||
     userPermissions.includes('support.manage'))
  ) {
    return true;
  }
  // Support canonical booking.view and bookings.view interchangeably
  if (
    (required === PERMISSIONS.BOOKINGS_VIEW || required === 'bookings.view' || required === 'booking.view') &&
    (userPermissions.includes('bookings.view') || userPermissions.includes('booking.view'))
  ) {
    return true;
  }
  // Support canonical booking.manage and bookings.manage interchangeably
  if (
    (required === PERMISSIONS.BOOKINGS_MANAGE || required === 'bookings.manage' || required === 'booking.manage') &&
    (userPermissions.includes('bookings.manage') || userPermissions.includes('booking.manage'))
  ) {
    return true;
  }
  // Support canonical payment.view and payments.view interchangeably
  if (
    (required === PERMISSIONS.PAYMENTS_VIEW || required === 'payments.view' || required === 'payment.view') &&
    (userPermissions.includes('payments.view') || userPermissions.includes('payment.view'))
  ) {
    return true;
  }
  // Support canonical payment.refund and refunds.manage interchangeably
  if (
    (required === PERMISSIONS.REFUNDS_MANAGE || required === 'refunds.manage' || required === 'payment.refund') &&
    (userPermissions.includes('refunds.manage') || userPermissions.includes('payment.refund'))
  ) {
    return true;
  }
  // Support canonical report.view and reports.view interchangeably
  if (
    (required === PERMISSIONS.REPORTS_VIEW || required === 'reports.view' || required === 'report.view') &&
    (userPermissions.includes('reports.view') || userPermissions.includes('report.view'))
  ) {
    return true;
  }
  // Support canonical export generation via exports.generate, report.export, or reporting access
  if (
    (required === PERMISSIONS.EXPORTS_GENERATE || required === 'exports.generate' || required === 'report.export' || required === 'reports.export') &&
    (userPermissions.includes('exports.generate') ||
     userPermissions.includes('report.export') ||
     userPermissions.includes('reports.export') ||
     userPermissions.includes('report.view') ||
     userPermissions.includes('reports.view'))
  ) {
    return true;
  }
  // Support canonical verification access via verification.review, verification.signoff, or verification.reassign
  if (
    (required === PERMISSIONS.VERIFICATION_REVIEW || required === 'verification.review') &&
    (userPermissions.includes('verification.review') || userPermissions.includes('verification.signoff') || userPermissions.includes('verification.reassign'))
  ) {
    return true;
  }
  // Support canonical role.manage and roles.manage interchangeably
  if (
    (required === PERMISSIONS.ROLES_MANAGE || required === 'roles.manage' || required === 'role.manage') &&
    (userPermissions.includes('roles.manage') || userPermissions.includes('role.manage'))
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
 * Ensures specialized personas (e.g., Verification Executive) land directly on their
 * authorized workstation without triggering 403 / Access Restricted guards.
 */
export function getDefaultLandingRoute(user: { permissions?: string[]; role?: string } | null | undefined): string {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return '/auth/login';
  }
  const permissions = user.permissions;

  // 1. Role-specific primary operational workstations
  if (
    user.role === 'SUPPORT_EXECUTIVE' &&
    (hasPermission(permissions, PERMISSIONS.SUPPORT_VIEW) || hasPermission(permissions, PERMISSIONS.SUPPORT_MANAGE))
  ) {
    return '/support';
  }

  // 2. Command center / dashboard when explicitly authorized with dashboard.view
  if (permissions.includes(PERMISSIONS.DASHBOARD_VIEW) || permissions.includes('dashboard.view') || permissions.includes('*')) {
    return '/dashboard';
  }

  if (
    (user.role === 'VERIFICATION_EXECUTIVE' || user.role === 'VERIFICATION_SUPERVISOR') &&
    hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW)
  ) {
    return '/verification';
  }

  // 3. Fallback: Role-specific command center / dashboard via alias permissions
  if (hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW)) {
    return '/dashboard';
  }

  // 3. Granular fallbacks to authorized operational workstations
  if (hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW)) {
    return '/verification';
  }
  if (
    hasPermission(permissions, PERMISSIONS.SUPPORT_VIEW) ||
    hasPermission(permissions, PERMISSIONS.SUPPORT_MANAGE)
  ) {
    return '/support';
  }
  if (
    hasPermission(permissions, PERMISSIONS.BOOKINGS_VIEW) ||
    hasPermission(permissions, PERMISSIONS.BOOKINGS_MANAGE)
  ) {
    return '/bookings';
  }
  if (
    hasPermission(permissions, PERMISSIONS.WORKER_VIEW) ||
    hasPermission(permissions, PERMISSIONS.WORKERS_MANAGE)
  ) {
    return '/workers';
  }
  if (
    hasPermission(permissions, PERMISSIONS.CUSTOMERS_VIEW) ||
    hasPermission(permissions, PERMISSIONS.CUSTOMERS_MANAGE)
  ) {
    return '/customers';
  }
  if (hasPermission(permissions, PERMISSIONS.PAYMENTS_VIEW) || hasPermission(permissions, PERMISSIONS.REFUNDS_MANAGE)) {
    return '/payments';
  }
  if (hasPermission(permissions, PERMISSIONS.REPORTS_VIEW) || hasPermission(permissions, PERMISSIONS.EXPORTS_GENERATE)) {
    return '/reports';
  }
  if (hasPermission(permissions, PERMISSIONS.CONFIGURATION_MANAGE) || hasPermission(permissions, PERMISSIONS.ROLES_MANAGE)) {
    return '/configuration';
  }
  if (hasPermission(permissions, PERMISSIONS.AUDIT_VIEW)) {
    return '/audit';
  }

  return '/auth/login';
}

export { getRoleLabel, ROLE_LABELS } from './roleLabels';
