import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';
import { getDefaultLandingRoute } from '../../core/rbac/permissions';

export const IndexRedirect: React.FC = () => {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isInitialized || isRestoring) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to={getDefaultLandingRoute(user)} replace />;
};
