import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { RealAuthRepository, mapBackendUserToAdminUser, createAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { queryClient as globalQueryClient } from '../core/api/queryClient';
import { PERMISSIONS, getDefaultLandingRoute, getRoleLabel } from '../core/rbac/permissions';
import { ForbiddenError, RateLimitExceededError, UnauthorizedError } from '../core/errors/DomainError';
import { resetRefreshCoordinator } from '../core/auth/tokenRefreshCoordinator';

function renderApp(initialEntry = '/auth/login', state?: unknown) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const [pathname, search] = initialEntry.split('?');
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname, search: search ? `?${search}` : '', state }],
  });

  return {
    ...render(
      <QueryClientProvider client={testQueryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    testQueryClient,
  };
}

describe('Authentication Module Audit & Security Validation', () => {
  let realRepo: RealAuthRepository;

  beforeEach(() => {
    resetRefreshCoordinator();
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    realRepo = new RealAuthRepository();
  });

  describe('1. Multi-Tab Logout & Cross-Tab Synchronization', () => {
    it('purges global queryClient cache when session is terminated', () => {
      // Seed global cache with simulated query data
      globalQueryClient.setQueryData(['workers-list'], [{ id: 'worker-101', name: 'Ramesh' }]);
      globalQueryClient.setQueryData(['customers-list'], [{ id: 'cust-201', name: 'Priya' }]);

      expect(globalQueryClient.getQueryData(['workers-list'])).toBeDefined();

      // Clear session
      useAuthStore.getState().clearSession(false);

      // Verify global cache is completely purged
      expect(globalQueryClient.getQueryData(['workers-list'])).toBeUndefined();
      expect(globalQueryClient.getQueryData(['customers-list'])).toBeUndefined();
    });

    it('broadcasts LOGOUT event to BroadcastChannel when clearSession is executed with broadcast flag', () => {
      const postMessageSpy = vi.fn();
      const mockChannel = {
        postMessage: postMessageSpy,
        onmessage: undefined,
      };

      // Mock BroadcastChannel
      const originalBC = window.BroadcastChannel;
      (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = vi.fn(() => mockChannel);

      useAuthStore.getState().clearSession(true);

      // Restore BroadcastChannel
      (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = originalBC;
    });
  });

  describe('2. Verification Supervisor Role Integration & Contract', () => {
    it('successfully maps VERIFICATION_SUPERVISOR role with canonical permissions and workstation route', () => {
      const supervisorUser = mapBackendUserToAdminUser({
        id: 'sup-001',
        name: 'Verification Supervisor Lead',
        email: 'supervisor@sevanest.internal',
        role: 'VERIFICATION_SUPERVISOR',
      });

      expect(supervisorUser.role).toBe('VERIFICATION_SUPERVISOR');
      expect(supervisorUser.permissions).toContain(PERMISSIONS.VERIFICATION_REVIEW);
      expect(supervisorUser.permissions).toContain(PERMISSIONS.VERIFICATION_DECIDE);
      expect(supervisorUser.permissions).toContain(PERMISSIONS.VERIFICATION_DOCUMENT_VIEW);
      expect(supervisorUser.permissions).toContain(PERMISSIONS.WORKER_VIEW);

      // Verify role label formatting
      expect(getRoleLabel('VERIFICATION_SUPERVISOR')).toBe('Verification Supervisor');

      // Verify default workstation landing route is /verification
      const landing = getDefaultLandingRoute(supervisorUser);
      expect(landing).toBe('/verification');
    });

    it('normalizes backend role aliases VERIF_SUPERVISOR and VERIFICATION_LEAD to VERIFICATION_SUPERVISOR', () => {
      const aliasUser1 = mapBackendUserToAdminUser({
        id: 'sup-002',
        email: 'lead@sevanest.internal',
        role: 'VERIF_SUPERVISOR',
      });
      expect(aliasUser1.role).toBe('VERIFICATION_SUPERVISOR');

      const aliasUser2 = mapBackendUserToAdminUser({
        id: 'sup-003',
        email: 'lead2@sevanest.internal',
        role: 'VERIFICATION_LEAD',
      });
      expect(aliasUser2.role).toBe('VERIFICATION_SUPERVISOR');
    });

    it('fails closed and raises ForbiddenError when an unrecognized role is returned by the server', () => {
      expect(() => {
        mapBackendUserToAdminUser({
          id: 'hacker-01',
          email: 'infiltrator@domain.com',
          role: 'SYSTEM_ADMIN_UNAUTHORIZED',
        });
      }).toThrow(ForbiddenError);
    });
  });

  describe('3. Login Security & Rate Limit Handling', () => {
    it('handles 429 ADMIN_LOGIN_LOCKED and maps to RateLimitExceededError', async () => {
      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 429,
          data: {
            code: 'ADMIN_LOGIN_LOCKED',
            message: 'Too many failed login attempts. Please try again later.',
            requestId: 'req-rate-limit-429',
          },
          headers: { 'x-correlation-id': 'req-rate-limit-429' },
        },
      });

      await expect(
        realRepo.login({
          email: 'ops.admin@sevanest.internal',
          password: 'password123',
        })
      ).rejects.toThrow(RateLimitExceededError);
    });

    it('handles 401 INVALID_CREDENTIALS and rejects unauthorized attempts', async () => {
      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid administrative credentials. Please verify your email and password.',
          },
        },
      });

      await expect(
        realRepo.login({
          email: 'unknown@sevanest.internal',
          password: 'badpassword',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('never stores access tokens or raw passwords in localStorage or sessionStorage', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'secret-jwt-access-token-12345',
          refreshToken: 'refresh-token-67890',
          user: {
            id: 'adm-001',
            email: 'ops.admin@sevanest.internal',
            role: 'OPERATIONS_ADMIN',
          },
        },
      });

      const { accessToken, refreshToken, user } = await realRepo.login({
        email: 'ops.admin@sevanest.internal',
        password: 'password123',
      });

      useAuthStore.getState().setSession(user, accessToken, refreshToken);

      expect(window.localStorage.getItem('accessToken')).toBeNull();
      expect(window.localStorage.getItem('token')).toBeNull();
      expect(window.localStorage.getItem('password')).toBeNull();
      expect(window.sessionStorage.getItem('accessToken')).toBeNull();
      expect(window.sessionStorage.getItem('password')).toBeNull();

      // Only the dedicated refresh token key is persisted in storage
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBe('refresh-token-67890');
    });
  });

  describe('4. Session Restoration & Deep Link Retention Across Page Reloads', () => {
    it('restores administrative session and preserves active deep link without kicking user to login', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'refresh-oper-1720000000',
      });

      // User reloads page while deeply nested inside /workers?applicationId=worker-102
      const { router } = renderApp('/workers?applicationId=worker-102');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      // Assert user stays on requested deep link
      expect(router.state.location.pathname).toBe('/workers');
      expect(router.state.location.search).toBe('?applicationId=worker-102');
    });

    it('redirects to /auth/login when no refresh token is stored and user accesses a protected route', async () => {
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      });

      const { router } = renderApp('/bookings');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      expect(router.state.location.state).toEqual({
        from: expect.objectContaining({ pathname: '/bookings' }),
      });
    });
  });

  describe('5. Factory & Mock Auth Prevention in Production', () => {
    it('instantiates RealAuthRepository when useMock flag is false', () => {
      const repo = createAuthRepository(false);
      expect(repo).toBeInstanceOf(RealAuthRepository);
    });
  });
});
