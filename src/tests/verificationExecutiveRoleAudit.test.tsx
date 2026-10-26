import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS, getRoleLabel } from '../core/rbac/permissions';
import { mapBackendUserToAdminUser, RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';

function renderApp(initialEntry = '/auth/login', state?: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname: initialEntry, state }],
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

describe('SevaNest Admin Portal: Verification Executive Role Audit & Identity Verification', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Authenticated User Identity & Canonical Role Labels', () => {
    it('formats canonical role labels correctly for all administrative personas', () => {
      expect(getRoleLabel('VERIFICATION_EXECUTIVE')).toBe('Verification Executive');
      expect(getRoleLabel('VERIFICATION_OFFICER')).toBe('Verification Executive');
      expect(getRoleLabel('VERIF_EXEC')).toBe('Verification Executive');
      expect(getRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
      expect(getRoleLabel('OPERATIONS_ADMIN')).toBe('Operations Admin');
      expect(getRoleLabel('OPERATIONS_MANAGER')).toBe('Operations Admin');
      expect(getRoleLabel('SUPPORT_EXECUTIVE')).toBe('Support Executive');
      expect(getRoleLabel('SUPPORT_EXEC')).toBe('Support Executive');
      expect(getRoleLabel(null)).toBe('Account');
      expect(getRoleLabel('')).toBe('Account');
    });

    it('displays the authenticated user name and "Verification Executive" role label in both header and sidebar', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Priya Sharma',
          email: 'priya.sharma@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        'mock-token-ve'
      );

      renderApp('/verification');

      // Top-right header identity check
      const headerName = await screen.findByTestId('header-user-name');
      const headerRole = screen.getByTestId('header-user-role');
      expect(headerName).toHaveTextContent('Priya Sharma');
      expect(headerRole).toHaveTextContent('Verification Executive');

      // Bottom-left sidebar identity check
      const sidebarName = screen.getByTestId('sidebar-user-name');
      const sidebarRole = screen.getByTestId('sidebar-user-role');
      expect(sidebarName).toHaveTextContent('Priya Sharma');
      expect(sidebarRole).toHaveTextContent('Verification Executive');

      // Must not contain misleading fallback
      expect(screen.queryByText('Administrative User')).not.toBeInTheDocument();
    });

    it('falls back to "Account" when display name is omitted by the backend, preserving the correct role label', () => {
      const mapped = mapBackendUserToAdminUser({
        id: 'usr-unnamed',
        email: 'unnamed.exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: ['verification.review'],
      });

      expect(mapped.name).toBe('Account');
      expect(mapped.role).toBe('VERIFICATION_EXECUTIVE');
      expect(getRoleLabel(mapped.role)).toBe('Verification Executive');
    });

    it('extracts combined first and last names from backend responses when name is absent', () => {
      const mapped = mapBackendUserToAdminUser({
        id: 'usr-firstlast',
        firstName: 'Anjali',
        lastName: 'Rao',
        email: 'anjali@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: ['verification.review'],
      });

      expect(mapped.name).toBe('Anjali Rao');
      expect(mapped.role).toBe('VERIFICATION_EXECUTIVE');
    });

    it('extracts user profile from nested backend envelopes ({ user: { name: ... } })', () => {
      const mapped = mapBackendUserToAdminUser({
        role: 'VERIFICATION_EXECUTIVE',
        user: {
          id: 'usr-nested',
          name: 'Kavita Reddy',
          email: 'kavita@sevanest.internal',
        },
        permissions: ['verification.review', 'worker.view'],
      });

      expect(mapped.name).toBe('Kavita Reddy');
      expect(mapped.email).toBe('kavita@sevanest.internal');
      expect(mapped.role).toBe('VERIFICATION_EXECUTIVE');
      expect(mapped.permissions).toContain(PERMISSIONS.WORKER_VIEW);
    });
  });

  describe('2. Verification Executive Navigation & Module Access Boundaries', () => {
    it('displays only authorized navigation items (Verification Review, Workers) and hides prohibited modules', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/verification');

      // Authorized items must be present in navigation
      expect(await screen.findByRole('link', { name: /Verification (Review|Queue)/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Workers( Directory)?/i })).toBeInTheDocument();

      // Prohibited items MUST NOT be rendered in navigation
      expect(screen.queryByRole('link', { name: /Customers/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Booking Pipeline/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Support Tickets/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Transactions & Fees/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Reports & Analytics/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Configuration Masters/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Audit Trail/i })).not.toBeInTheDocument();
    });

    it('renders Verification Dashboard in navigation when dashboard.view is granted by backend', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/verification');

      expect(await screen.findByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Verification (Review|Queue)/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Workers( Directory)?/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Customers/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Route Guards & Direct URL Access Protection', () => {
    it('restricts direct URL access to /customers and renders Access Restricted', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/customers');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: customer\.view/i)).toBeInTheDocument();
    });

    it('restricts direct URL access to /bookings and renders Access Restricted', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/bookings');
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: bookings\.view/i)).toBeInTheDocument();
    });

    it('restricts direct URL access to /payments and renders Access Restricted', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/payments');
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: payments\.view/i)).toBeInTheDocument();
    });

    it('restricts direct URL access to /configuration and renders Access Restricted', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'token-ve'
      );

      renderApp('/configuration');
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: configuration\.manage/i)).toBeInTheDocument();
    });
  });

  describe('4. Other Roles Regression Coverage', () => {
    it('displays "Super Admin" and full control navigation for Super Admin', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Administrator',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'super-token'
      );

      renderApp('/dashboard');

      expect(await screen.findByTestId('header-user-name')).toHaveTextContent('Super Administrator');
      expect(screen.getByTestId('header-user-role')).toHaveTextContent('Super Admin');
      expect(screen.getByTestId('sidebar-user-role')).toHaveTextContent('Super Admin');

      // Super Admin sees all navigation modules
      expect(screen.getByRole('link', { name: /Customers/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Configuration Masters/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Audit Trail/i })).toBeInTheDocument();
    });

    it('displays "Operations Admin" and operational navigation for Operations Admin', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-002',
          name: 'Operations Manager',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMERS_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
          ],
        },
        'ops-token'
      );

      renderApp('/dashboard');

      expect(await screen.findByTestId('header-user-name')).toHaveTextContent('Operations Manager');
      expect(screen.getByTestId('header-user-role')).toHaveTextContent('Operations Admin');
      expect(screen.getByTestId('sidebar-user-role')).toHaveTextContent('Operations Admin');

      // Operations Admin sees Customers, Bookings, Payments, but NOT Configuration or Audit
      expect(screen.getByRole('link', { name: /Customers/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Booking Pipeline/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Configuration Masters/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Audit Trail/i })).not.toBeInTheDocument();
    });

    it('displays "Support Executive" and support navigation for Support Executive', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-004',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMERS_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
          ],
        },
        'support-token'
      );

      renderApp('/support');

      expect(await screen.findByTestId('header-user-name')).toHaveTextContent('Support Executive');
      expect(screen.getByTestId('header-user-role')).toHaveTextContent('Support Executive');
      expect(screen.getByTestId('sidebar-user-role')).toHaveTextContent('Support Executive');
      expect(screen.getByRole('link', { name: /Support Tickets/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Verification (Review|Queue)/i })).not.toBeInTheDocument();
    });
  });

  describe('5. RealAuthRepository Session Restoration & Identity Integrity', () => {
    it('restores real backend user identity with correct role label and permissions', async () => {
      const realRepo = new RealAuthRepository();

      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              id: 'adm-real-ve',
              fullName: 'Sunita Mehra',
              email: 'sunita.mehra@sevanest.internal',
              role: 'VERIFICATION_EXECUTIVE',
              permissions: [
                'worker.view',
                'verification.review',
                'verification.decide',
                'verification.document.view',
              ],
            },
          },
        },
      });

      const session = await realRepo.getCurrentSession('token-live-session');
      expect(session).not.toBeNull();
      expect(session?.name).toBe('Sunita Mehra');
      expect(session?.role).toBe('VERIFICATION_EXECUTIVE');
      expect(getRoleLabel(session?.role)).toBe('Verification Executive');
      expect(session?.permissions).toContain(PERMISSIONS.WORKER_VIEW);
      expect(session?.permissions).toContain(PERMISSIONS.VERIFICATION_REVIEW);
    });
  });
});
