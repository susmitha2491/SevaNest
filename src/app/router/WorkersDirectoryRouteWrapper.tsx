import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';

const WorkersDirectoryPage = React.lazy(() =>
  import('../../features/workers/presentation/WorkersDirectoryPage').then((m) => ({ default: m.WorkersDirectoryPage }))
);

export const WorkersDirectoryRouteWrapper: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/directory" replace />;
  }
  return <WorkersDirectoryPage />;
};

