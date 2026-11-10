import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../core/rbac/permissions';

const WorkersDirectoryPage = React.lazy(() =>
  import('../../features/workers/presentation/WorkersDirectoryPage').then((m) => ({ default: m.WorkersDirectoryPage }))
);

export const WorkersDirectoryRouteWrapper: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.permissions?.includes('*');
  const isSupportExecutive =
    user?.role === 'SUPPORT_EXECUTIVE' ||
    (!hasPermission(user?.permissions, PERMISSIONS.WORKER_MANAGE) &&
      !hasPermission(user?.permissions, PERMISSIONS.VERIFICATION_REVIEW) &&
      hasPermission(user?.permissions, PERMISSIONS.WORKER_VIEW));

  if (isSuperAdmin || isSupportExecutive) {
    return <Navigate to="/directory" replace />;
  }
  return <WorkersDirectoryPage />;
};

