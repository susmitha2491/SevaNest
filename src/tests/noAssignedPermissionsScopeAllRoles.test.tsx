import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { PERMISSIONS, hasPermission } from '../core/rbac/permissions';
import { AdminUser, AdminRole } from '../core/auth/authTypes';

function renderApp(initialEntry = '/account') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    queryClient,
  };
}

interface RoleTestCase {
  role: AdminRole;
  user: AdminUser;
  roleLabel: string;
}

const TEST_ROLES: RoleTestCase[] = [
  {
    role: 'SUPER_ADMIN',
    roleLabel: 'Super Admin',
    user: {
      id: 'usr-super-admin-01',
      staffId: 'STF-SA-001',
      name: 'Priya Sharma',
      email: 'superadmin@sevanest.internal',
      role: 'SUPER_ADMIN',
      permissions: Object.values(PERMISSIONS),
      phone: '+91 98000 11111',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      userType: 'ADMIN',
    },
  },
  {
    role: 'OPERATIONS_ADMIN',
    roleLabel: 'Operations Admin',
    user: {
      id: 'usr-ops-admin-01',
      staffId: 'STF-OPS-002',
      name: 'Vikram Malhotra',
      email: 'opsadmin@sevanest.internal',
      role: 'OPERATIONS_ADMIN',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.WORKER_MANAGE,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.BOOKINGS_MANAGE,
        PERMISSIONS.PAYMENTS_VIEW,
      ],
      phone: '+91 98000 22222',
      status: 'ACTIVE',
      createdAt: '2026-01-05T00:00:00Z',
      userType: 'ADMIN',
    },
  },
  {
    role: 'VERIFICATION_EXECUTIVE',
    roleLabel: 'Verification Executive',
    user: {
      id: 'usr-verif-exec-01',
      staffId: 'STF-VRF-003',
      name: 'Ananya Deshmukh',
      email: 'verif.exec@sevanest.internal',
      role: 'VERIFICATION_EXECUTIVE',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        PERMISSIONS.WORKER_VIEW,
      ],
      phone: '+91 98000 33333',
      status: 'ACTIVE',
      createdAt: '2026-01-10T00:00:00Z',
      userType: 'ADMIN',
    },
  },
  {
    role: 'VERIFICATION_SUPERVISOR',
    roleLabel: 'Verification Supervisor',
    user: {
      id: 'usr-verif-sup-01',
      staffId: 'STF-VSP-004',
      name: 'Rajesh Kulkarni',
      email: 'verif.sup@sevanest.internal',
      role: 'VERIFICATION_SUPERVISOR',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DECIDE,
        PERMISSIONS.VERIFICATION_SIGNOFF,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.WORKER_MANAGE,
      ],
      phone: '+91 98000 44444',
      status: 'ACTIVE',
      createdAt: '2026-01-12T00:00:00Z',
      userType: 'ADMIN',
    },
  },
  {
    role: 'SUPPORT_EXECUTIVE',
    roleLabel: 'Support Executive',
    user: {
      id: 'usr-supp-exec-01',
      staffId: 'STF-SUP-005',
      name: 'Kavita Nair',
      email: 'support.exec@sevanest.internal',
      role: 'SUPPORT_EXECUTIVE',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.CUSTOMER_VIEW,
      ],
      phone: '+91 98000 55555',
      status: 'ACTIVE',
      createdAt: '2026-01-15T00:00:00Z',
      userType: 'ADMIN',
    },
  },
];

describe('Account Page: Removal of Assigned Permissions Scope Across All Admin Roles', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    authRepository.supportsProfileUpdate = false;
    vi.restoreAllMocks();
  });

  TEST_ROLES.forEach(({ role, roleLabel, user }) => {
    describe(`Role: ${roleLabel} (${role})`, () => {
      beforeEach(() => {
        useAuthStore.getState().setSession(user, `token-${role}`);
      });

      it('confirms the Assigned Permissions Scope section is absent from My Account (BUG-001)', async () => {
        renderApp('/account');

        // Confirm page loaded
        expect(await screen.findByTestId('account-profile-card')).toBeInTheDocument();

        // Permissions card and texts must NOT be present
        expect(screen.queryByTestId('account-permissions-scope-card')).not.toBeInTheDocument();
        expect(screen.queryByText(/Assigned Permissions Scope/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Authoritative permissions granted by backend security tokens/i)).not.toBeInTheDocument();
      });

      it('preserves account profile information, role designation, and Staff ID', async () => {
        renderApp('/account');

        expect(await screen.findByTestId('account-user-name')).toHaveTextContent(user.name);
        expect(screen.getByTestId('account-user-email')).toHaveTextContent(user.email);
        expect(screen.getByTestId('account-user-phone')).toHaveTextContent(user.phone || '');
        expect(screen.getByTestId('account-user-role')).toHaveTextContent(roleLabel);
        expect(screen.getByTestId('account-user-status')).toHaveTextContent('ACTIVE');
        expect(screen.getByTestId('account-user-id')).toHaveTextContent(user.staffId || user.id);
      });

      it('confirms the profile picture camera/upload icon and upload controls are absent', async () => {
        renderApp('/account');

        expect(await screen.findByTestId('account-profile-card')).toBeInTheDocument();
        // Initials avatar is present and non-clickable
        expect(screen.getByTestId('account-avatar')).toBeInTheDocument();
        expect(screen.getByTestId('account-avatar')).toHaveTextContent(user.name.charAt(0).toUpperCase());

        // Camera icon, file input, photo upload button must NOT exist
        expect(screen.queryByTitle(/Upload or change profile photo/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId('profile-photo-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('profile-photo-preview')).not.toBeInTheDocument();
        expect(screen.queryByTestId('remove-photo-button')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Save New Photo/i })).not.toBeInTheDocument();
      });

      it('preserves Change Password card and interactive security functionality', async () => {
        renderApp('/account');

        expect(await screen.findByTestId('account-change-password-card')).toBeInTheDocument();
        expect(screen.getByTestId('current-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
      });

      it('retains backend authorization tokens and permissions in auth store', () => {
        const currentUser = useAuthStore.getState().user;
        expect(currentUser).not.toBeNull();
        expect(currentUser?.permissions).toEqual(user.permissions);
        expect(currentUser?.permissions.length).toBeGreaterThan(0);

        // Verify RBAC enforcement function works with backend permissions
        user.permissions.forEach((perm) => {
          expect(hasPermission(currentUser?.permissions, perm)).toBe(true);
        });
      });
    });
  });
});
