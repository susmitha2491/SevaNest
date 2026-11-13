import { LucideIcon, LayoutDashboard, Users, Briefcase, UserCheck, CalendarCheck, ClipboardCheck, Star, CreditCard, LifeBuoy, BarChart3, Sliders, History } from 'lucide-react';
import { PERMISSIONS, hasPermission } from './permissions';
import { AdminUser } from '../auth/authTypes';

export interface NavSubItem {
  id: string;
  name: string;
  path: string;
  requiredPermission?: string;
  end?: boolean;
}

export interface NavModule {
  id: string;
  name: string;
  path: string;
  icon: LucideIcon;
  requiredPermission: string;
  end?: boolean;
  subItems?: NavSubItem[];
}

/**
 * Action-level permissions distinct from view-level route permissions.
 * PRD Rule: Having view permission to a page must NOT grant action permissions.
 */
export const ACTION_PERMISSIONS = {
  CUSTOMER_MANAGE: PERMISSIONS.CUSTOMER_MANAGE,
  USER_STATUS_MANAGE: PERMISSIONS.USER_STATUS_MANAGE,
  WORKER_MANAGE: PERMISSIONS.WORKER_MANAGE,
  WORKER_ACTIVATE: PERMISSIONS.WORKER_ACTIVATE,
  VERIFICATION_DECIDE: PERMISSIONS.VERIFICATION_DECIDE,
  VERIFICATION_SIGNOFF: PERMISSIONS.VERIFICATION_SIGNOFF,
  BOOKING_MANAGE: PERMISSIONS.BOOKINGS_MANAGE,
  REFUND_MANAGE: PERMISSIONS.REFUNDS_MANAGE,
  SUPPORT_MANAGE: PERMISSIONS.SUPPORT_MANAGE,
  EXPORT_GENERATE: PERMISSIONS.EXPORTS_GENERATE,
  CONFIG_MANAGE: PERMISSIONS.CONFIGURATION_MANAGE,
  ROLES_MANAGE: PERMISSIONS.ROLES_MANAGE,
} as const;

/**
 * Derives the active, authorized navigation structure strictly from the authenticated
 * user's backend-issued permissions and operational persona.
 * Guarantees zero hardcoded role-to-module arrays and ensures sidebar items match accessible routes.
 */
export function getAccessibleNavigation(user: AdminUser | null | undefined): NavModule[] {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return [];
  }

  const permissions = user.permissions;
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || permissions.includes('*');
  const isOpsAdmin = user.role === 'OPERATIONS_ADMIN' || (user.role as string) === 'OPERATIONS_MANAGER';
  const isSupportExec = user.role === 'SUPPORT_EXECUTIVE';

  const modules: NavModule[] = [];

  if (isSupportExec) {
    if (hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW)) {
      modules.push({
        id: 'dashboard',
        name: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
        end: true,
      });
    }
    if (hasPermission(permissions, PERMISSIONS.SUPPORT_VIEW)) {
      modules.push({
        id: 'support',
        name: 'Support',
        path: '/support',
        icon: LifeBuoy,
        requiredPermission: PERMISSIONS.SUPPORT_VIEW,
        end: false,
      });
    }
    if (hasPermission(permissions, PERMISSIONS.WORKER_VIEW) || hasPermission(permissions, PERMISSIONS.CUSTOMER_VIEW)) {
      modules.push({
        id: 'directory',
        name: 'Directory',
        path: '/directory',
        icon: Users,
        requiredPermission: hasPermission(permissions, PERMISSIONS.WORKER_VIEW)
          ? PERMISSIONS.WORKER_VIEW
          : PERMISSIONS.CUSTOMER_VIEW,
        end: true,
      });
    }
    if (hasPermission(permissions, PERMISSIONS.WORKER_VIEW)) {
      modules.push({
        id: 'workers',
        name: 'Worker Management',
        path: '/workers',
        icon: Briefcase,
        requiredPermission: PERMISSIONS.WORKER_VIEW,
        end: true,
      });
    }
    if (hasPermission(permissions, PERMISSIONS.CUSTOMER_VIEW)) {
      modules.push({
        id: 'customers',
        name: 'Customer Management',
        path: '/customers',
        icon: Users,
        requiredPermission: PERMISSIONS.CUSTOMER_VIEW,
        end: false,
      });
    }
    return modules;
  }

  // 1. Dashboard
  if (hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW)) {
    modules.push({
      id: 'dashboard',
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
      end: true,
    });
  }

  // 2. Customer Management
  if (hasPermission(permissions, PERMISSIONS.CUSTOMER_VIEW)) {
    modules.push({
      id: 'customers',
      name: 'Customer Management',
      path: '/customers',
      icon: Users,
      requiredPermission: PERMISSIONS.CUSTOMER_VIEW,
      end: false,
    });
  }

  // 3. Worker Management & Directory
  if (hasPermission(permissions, PERMISSIONS.WORKER_VIEW)) {
    const hasWorkerManage = isSuperAdmin || isOpsAdmin || hasPermission(permissions, PERMISSIONS.WORKER_MANAGE);
    const hasVerificationReview = hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW);
    const isVerifExecutive = hasVerificationReview && !hasWorkerManage;

    if (hasWorkerManage) {
      modules.push({
        id: 'workers',
        name: 'Worker Management',
        path: '/workers',
        icon: Briefcase,
        requiredPermission: PERMISSIONS.WORKER_VIEW,
        end: true,
      });

      // Super Admin sees Directory (unified Workers & Customers) and Worker Management directly in primary navigation
      if (isSuperAdmin) {
        modules.push({
          id: 'directory',
          name: 'Directory',
          path: '/directory',
          icon: Users,
          requiredPermission: PERMISSIONS.WORKER_VIEW,
          end: true,
        });
      }
    } else if (!isVerifExecutive) {
      // Unified Directory (Workers & Customers) for Support Executive
      modules.push({
        id: 'directory',
        name: 'Directory',
        path: '/directory',
        icon: Users,
        requiredPermission: PERMISSIONS.WORKER_VIEW,
        end: true,
      });
    }
  }

  // 4. Verification Management
  if (hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW)) {
    modules.push({
      id: 'verification',
      name: isOpsAdmin ? 'Verification Management' : 'Verification',
      path: '/verification',
      icon: UserCheck,
      requiredPermission: PERMISSIONS.VERIFICATION_REVIEW,
      end: false,
    });

    // For Verification Executive, place Workers Management right near the Verification menu
    const hasWorkerManage = isSuperAdmin || isOpsAdmin || hasPermission(permissions, PERMISSIONS.WORKER_MANAGE);
    const isVerifExecutive = !hasWorkerManage;
    if (isVerifExecutive && hasPermission(permissions, PERMISSIONS.WORKER_VIEW)) {
      modules.push({
        id: 'workers',
        name: 'Workers Management',
        path: '/workers',
        icon: Briefcase,
        requiredPermission: PERMISSIONS.WORKER_VIEW,
        end: true,
      });
    }
  }

  // 5. Booking Management
  if (hasPermission(permissions, PERMISSIONS.BOOKINGS_VIEW)) {
    modules.push({
      id: 'bookings',
      name: 'Booking Management',
      path: '/bookings',
      icon: CalendarCheck,
      requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
      end: false,
    });
  }

  // 5a. Attendance & Daily Logs
  if (hasPermission(permissions, PERMISSIONS.ATTENDANCE_VIEW)) {
    modules.push({
      id: 'attendance',
      name: 'Attendance & Daily Logs',
      path: '/attendance',
      icon: ClipboardCheck,
      requiredPermission: PERMISSIONS.ATTENDANCE_VIEW,
      end: false,
    });
  }

  // 5b. Ratings & Reviews
  if (hasPermission(permissions, PERMISSIONS.RATING_VIEW)) {
    modules.push({
      id: 'ratings',
      name: 'Ratings & Reviews',
      path: '/ratings',
      icon: Star,
      requiredPermission: PERMISSIONS.RATING_VIEW,
      end: false,
    });
  }

  // 6. Payments
  if (hasPermission(permissions, PERMISSIONS.PAYMENTS_VIEW)) {
    modules.push({
      id: 'payments',
      name: isOpsAdmin ? 'Payments Management' : 'Payments',
      path: '/payments',
      icon: CreditCard,
      requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
      end: false,
    });
  }

  // 7. Support Management
  if (hasPermission(permissions, PERMISSIONS.SUPPORT_VIEW)) {
    modules.push({
      id: 'support',
      name: isOpsAdmin ? 'Support Management' : 'Support',
      path: '/support',
      icon: LifeBuoy,
      requiredPermission: PERMISSIONS.SUPPORT_VIEW,
      end: false,
    });
  }

  // 8. Reports & Analytics
  if (hasPermission(permissions, PERMISSIONS.REPORTS_VIEW)) {
    modules.push({
      id: 'reports',
      name: isOpsAdmin ? 'Reports & Analytics' : 'Reports',
      path: '/reports',
      icon: BarChart3,
      requiredPermission: PERMISSIONS.REPORTS_VIEW,
      end: false,
    });
  }

  // 9. Configuration
  if (hasPermission(permissions, PERMISSIONS.CONFIGURATION_MANAGE)) {
    modules.push({
      id: 'configuration',
      name: 'Configuration',
      path: '/configuration',
      icon: Sliders,
      requiredPermission: PERMISSIONS.CONFIGURATION_MANAGE,
      end: false,
    });
  }

  // 10. Audit Trail
  if (hasPermission(permissions, PERMISSIONS.AUDIT_VIEW)) {
    modules.push({
      id: 'audit',
      name: 'Audit Trail',
      path: '/audit',
      icon: History,
      requiredPermission: PERMISSIONS.AUDIT_VIEW,
      end: false,
    });
  }

  return modules;
}

/**
 * Returns the canonical permission required for any given route pathname.
 */
export function getRequiredPermissionForRoute(pathname: string): string {
  const normalized = pathname.toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';

  if (normalized === '/dashboard') return PERMISSIONS.DASHBOARD_VIEW;
  if (normalized === '/customers') return PERMISSIONS.CUSTOMER_VIEW;
  if (normalized === '/workers') return PERMISSIONS.WORKER_VIEW;
  if (normalized === '/workers/directory') return PERMISSIONS.WORKER_VIEW;
  if (normalized === '/directory') return PERMISSIONS.WORKER_VIEW;
  if (normalized.startsWith('/verification')) return PERMISSIONS.VERIFICATION_REVIEW;
  if (normalized === '/bookings') return PERMISSIONS.BOOKINGS_VIEW;
  if (normalized === '/replacements') return PERMISSIONS.BOOKINGS_VIEW;
  if (normalized === '/payments') return PERMISSIONS.PAYMENTS_VIEW;
  if (normalized.startsWith('/support')) return PERMISSIONS.SUPPORT_VIEW;
  if (normalized === '/reports') return PERMISSIONS.REPORTS_VIEW;
  if (normalized === '/configuration') return PERMISSIONS.CONFIGURATION_MANAGE;
  if (normalized === '/audit') return PERMISSIONS.AUDIT_VIEW;

  return '';
}

/**
 * Determines whether a route pathname is accessible to the user based on their
 * server-issued permissions and operational workspace boundaries.
 */
export function isRouteAccessibleForUser(
  pathname: string,
  user: AdminUser | null | undefined
): boolean {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  const permissions = user.permissions;

  // Wildcard permissions (Super Admin) grants unrestricted operational access
  if (permissions.includes('*') || user.role === 'SUPER_ADMIN') {
    return true;
  }

  const normalized = pathname.toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';

  // Public / non-module routes
  if (normalized === '/' || normalized.startsWith('/auth') || normalized === '/account') {
    return true;
  }

  // Directory route is accessible to Super Admin and Support Executive (users with worker.view or customer.view without worker.manage or verification.review)
  if (normalized === '/directory') {
    const hasWorkerManage = hasPermission(permissions, PERMISSIONS.WORKER_MANAGE);
    const hasVerificationReview = hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW);
    if (hasWorkerManage || hasVerificationReview) {
      return false;
    }
    return hasPermission(permissions, PERMISSIONS.WORKER_VIEW) || hasPermission(permissions, PERMISSIONS.CUSTOMER_VIEW);
  }

  // 1. Dashboard
  if (normalized === '/dashboard') {
    return hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW);
  }

  // 2. Customers
  if (normalized === '/customers') {
    return hasPermission(permissions, PERMISSIONS.CUSTOMER_VIEW);
  }

  // 3. Workers
  if (normalized === '/workers' || normalized === '/workers/directory') {
    return hasPermission(permissions, PERMISSIONS.WORKER_VIEW);
  }

  // 4. Verification
  if (normalized.startsWith('/verification')) {
    return hasPermission(permissions, PERMISSIONS.VERIFICATION_REVIEW);
  }

  // 5. Bookings
  if (normalized === '/bookings') {
    return hasPermission(permissions, PERMISSIONS.BOOKINGS_VIEW);
  }
  if (normalized === '/replacements') {
    return hasPermission(permissions, PERMISSIONS.BOOKINGS_VIEW);
  }

  // 6. Payments
  if (normalized === '/payments') {
    return hasPermission(permissions, PERMISSIONS.PAYMENTS_VIEW);
  }

  // 7. Support
  if (normalized.startsWith('/support')) {
    return hasPermission(permissions, PERMISSIONS.SUPPORT_VIEW);
  }

  // 8. Reports
  if (normalized === '/reports') {
    return hasPermission(permissions, PERMISSIONS.REPORTS_VIEW);
  }

  // 9. Configuration
  if (normalized === '/configuration') {
    return hasPermission(permissions, PERMISSIONS.CONFIGURATION_MANAGE);
  }

  // 10. Audit
  if (normalized === '/audit') {
    return hasPermission(permissions, PERMISSIONS.AUDIT_VIEW);
  }

  // Non-registered routes (e.g., /non-existent-subpage) should be allowed through to 404 NotFoundView
  return true;
}
