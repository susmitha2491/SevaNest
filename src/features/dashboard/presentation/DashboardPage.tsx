import React from 'react';
import { useAuthStore } from '../../../core/auth/authStore';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { OperationsAdminDashboard } from './OperationsAdminDashboard';
import { VerificationExecutiveDashboard } from './VerificationExecutiveDashboard';
import { SupportExecutiveDashboard } from './SupportExecutiveDashboard';

/**
 * Universal Dashboard Entry Page.
 * Dynamically mounts the role-specific operational dashboard based on authenticated administrative persona.
 */
export const DashboardPage: React.FC = () => {
  const role = useAuthStore((state) => state.user?.role);

  switch (role) {
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard />;
    case 'OPERATIONS_ADMIN':
      return <OperationsAdminDashboard />;
    case 'VERIFICATION_EXECUTIVE':
      return <VerificationExecutiveDashboard />;
    case 'SUPPORT_EXECUTIVE':
      return <SupportExecutiveDashboard />;
    default:
      return <OperationsAdminDashboard />;
  }
};
