import { describe, it, expect } from 'vitest';
import { hasPermission, hasAllPermissions, hasAnyPermission, PERMISSIONS } from '../core/rbac/permissions';

describe('RBAC Permission Utilities', () => {
  it('correctly evaluates presence of specific permission key', () => {
    const permissions = [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW];

    expect(hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
    expect(hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW)).toBe(true);
    expect(hasPermission(permissions, PERMISSIONS.CONFIGURATION_MANAGE)).toBe(false);
  });

  it('honors Super Admin wildcard permission (*)', () => {
    const superAdminPermissions = ['*'];

    expect(hasPermission(superAdminPermissions, PERMISSIONS.CONFIGURATION_MANAGE)).toBe(true);
    expect(hasPermission(superAdminPermissions, PERMISSIONS.AUDIT_VIEW)).toBe(true);
    expect(hasPermission(superAdminPermissions, 'arbitrary.custom.key')).toBe(true);
  });

  it('returns false when permissions array is undefined or empty', () => {
    expect(hasPermission(undefined, PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
    expect(hasPermission([], PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
  });

  it('correctly checks hasAllPermissions', () => {
    const permissions = [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_MANAGE];

    expect(hasAllPermissions(permissions, [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_MANAGE])).toBe(true);
    expect(hasAllPermissions(permissions, [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.REFUNDS_MANAGE])).toBe(false);
  });

  it('correctly checks hasAnyPermission', () => {
    const permissions = [PERMISSIONS.SUPPORT_VIEW];

    expect(hasAnyPermission(permissions, [PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.REFUNDS_MANAGE])).toBe(true);
    expect(hasAnyPermission(permissions, [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.CONFIGURATION_MANAGE])).toBe(false);
  });
});
