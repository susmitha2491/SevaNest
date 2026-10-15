import React from 'react';
import { useAuthStore } from '../auth/authStore';
import { PermissionKey, hasPermission, hasAllPermissions, hasAnyPermission } from './permissions';

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: PermissionKey;
  allPermissions?: PermissionKey[];
  anyPermission?: PermissionKey[];
  fallback?: React.ReactNode;
}

/**
 * Declarative component gate for rendering UI elements based on server-issued permission keys.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  allPermissions,
  anyPermission,
  fallback = null,
}) => {
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions;

  if (permission && !hasPermission(permissions, permission)) {
    return <>{fallback}</>;
  }

  if (allPermissions && !hasAllPermissions(permissions, allPermissions)) {
    return <>{fallback}</>;
  }

  if (anyPermission && !hasAnyPermission(permissions, anyPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
