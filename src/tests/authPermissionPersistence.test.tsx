import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository, RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ForbiddenError } from '../core/errors/DomainError';
import { restoreSession } from '../core/auth/sessionRestoration';
import { resetRefreshCoordinator } from '../core/auth/tokenRefreshCoordinator';

function renderAuthFlow(initialEntry = '/auth/login', state?: unknown) {
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

describe('SevaNest Admin Portal: Authentication & Permission Persistence Across Browser Refreshes', () => {
  beforeEach(() => {
    resetRefreshCoordinator();
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Verification Executive Login & Initial Landing', () => {
    it('authenticates Verification Executive and redirects them directly to /verification workstation', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verif.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Required permission: worker.view/i)).not.toBeInTheDocument();
    });
  });

  describe('2. Refreshing /verification While Authenticated', () => {
    it('restores administrative session authoritatively and preserves access to /verification', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-verification-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'refresh-verification-1720000000',
      });

      const { router } = renderAuthFlow('/verification');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      expect(router.state.location.pathname).toBe('/verification');
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Refreshing /workers When worker.view Is Granted by Server', () => {
    it('restores session from backend and allows access to /workers when server grants worker.view', async () => {
      const realRepo = new RealAuthRepository();
      const realRepoSpy = vi.spyOn(authRepository, 'refreshToken').mockImplementation(async (token?: string) => {
        return realRepo.refreshToken(token);
      });
      const getCurrentSessionSpy = vi.spyOn(authRepository, 'getCurrentSession').mockImplementation(async (token?: string) => {
        return realRepo.getCurrentSession(token);
      });

      // Mock backend token refresh endpoint
      vi.spyOn(httpClient, 'post').mockImplementation(async (url: string) => {
        if (url === '/auth/token/refresh') {
          return {
            data: {
              success: true,
              data: {
                accessToken: 'jwt-fresh-verif-token',
                refreshToken: 'jwt-rotated-verif-refresh',
              },
            },
          } as never;
        }
        throw new Error(`Unexpected POST to ${url}`);
      });

      // Mock authoritative backend GET /users/me response granting worker.view
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/users/me') {
          return {
            data: {
              success: true,
              data: {
                id: 'adm-003',
                name: 'Verification Officer',
                email: 'verification.exec@sevanest.internal',
                role: 'VERIFICATION_EXECUTIVE',
                permissions: [
                  'worker.view',
                  'verification.review',
                  'verification.document.view',
                ],
              },
            },
          } as never;
        }
        throw new Error(`Unexpected GET to ${url}`);
      });

      window.localStorage.setItem('sevanest_refresh_token', 'jwt-stored-refresh-token');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'jwt-stored-refresh-token',
      });

      const { router } = renderAuthFlow('/workers');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      const restoredUser = useAuthStore.getState().user;
      expect(restoredUser?.role).toBe('VERIFICATION_EXECUTIVE');
      expect(restoredUser?.permissions).toContain(PERMISSIONS.WORKER_VIEW);

      // Verify the workforce roster renders without Access Restricted
      expect(await screen.findByText('Domestic Worker Roster & Profiles', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/workers');

      realRepoSpy.mockRestore();
      getCurrentSessionSpy.mockRestore();
    });
  });

  describe('4. Denying /workers When worker.view Is Genuinely Absent', () => {
    it('restricts /workers and renders NoAccessView when backend explicitly omits worker.view', async () => {
      const realRepo = new RealAuthRepository();
      const realRepoSpy = vi.spyOn(authRepository, 'refreshToken').mockImplementation(async (token?: string) => {
        return realRepo.refreshToken(token);
      });
      const getCurrentSessionSpy = vi.spyOn(authRepository, 'getCurrentSession').mockImplementation(async (token?: string) => {
        return realRepo.getCurrentSession(token);
      });

      vi.spyOn(httpClient, 'post').mockImplementation(async (url: string) => {
        if (url === '/auth/token/refresh') {
          return {
            data: {
              accessToken: 'jwt-fresh-verif-token',
              refreshToken: 'jwt-stored-refresh-token',
            },
          } as never;
        }
        throw new Error(`Unexpected POST to ${url}`);
      });

      // Authoritative backend response WITHOUT worker.view
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/users/me') {
          return {
            data: {
              id: 'adm-003',
              name: 'Strict Verification Officer',
              email: 'strict.verif@sevanest.internal',
              role: 'VERIFICATION_EXECUTIVE',
              permissions: [
                'verification.review',
                'verification.document.view',
              ],
            },
          } as never;
        }
        throw new Error(`Unexpected GET to ${url}`);
      });

      window.localStorage.setItem('sevanest_refresh_token', 'jwt-stored-refresh-token');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'jwt-stored-refresh-token',
      });

      const { router } = renderAuthFlow('/workers');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      const restoredUser = useAuthStore.getState().user;
      expect(restoredUser?.permissions).not.toContain(PERMISSIONS.WORKER_VIEW);

      // Verify Access Restricted view is displayed with required permission key
      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: worker.view/i)).toBeInTheDocument();

      // Ensure return link points to user's authorized workstation (/verification)
      const returnBtn = screen.getByRole('link', { name: /Return to Primary Workstation/i });
      expect(returnBtn).toHaveAttribute('href', '/verification');
      expect(router.state.location.pathname).toBe('/workers');

      realRepoSpy.mockRestore();
      getCurrentSessionSpy.mockRestore();
    });
  });

  describe('5. Session Restoration While Permissions Are Still Loading', () => {
    it('displays loading state and prevents premature permission denial during in-flight session restoration', async () => {
      let resolveRefresh: ((val: unknown) => void) | null = null;
      const delayedRefreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      vi.spyOn(authRepository, 'refreshToken').mockImplementation(async () => {
        await delayedRefreshPromise;
        return {
          accessToken: 'token-delayed-123',
          refreshToken: 'refresh-delayed-123',
        };
      });

      vi.spyOn(authRepository, 'getCurrentSession').mockResolvedValue({
        id: 'adm-003',
        name: 'Verification Executive',
        email: 'verif@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      });

      window.localStorage.setItem('sevanest_refresh_token', 'token-pending-123');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'token-pending-123',
      });

      renderAuthFlow('/workers');

      // Before restoration completes: Must display loading screen and NOT Access Restricted or login redirect
      expect(screen.getByText('Verifying administrative session...')).toBeInTheDocument();
      expect(screen.getByLabelText('Restoring session')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('name@sevanest.internal')).not.toBeInTheDocument();

      // Resolve the restoration
      resolveRefresh!(null);

      // After restoration completes: Worker Roster must appear
      expect(await screen.findByText('Domestic Worker Roster & Profiles', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByText('Verifying administrative session...')).not.toBeInTheDocument();
    });
  });

  describe('6. Expired Sessions & Failed Session Restoration', () => {
    it('clears stored session and redirects to /auth/login with destination state when token refresh fails', async () => {
      vi.spyOn(authRepository, 'refreshToken').mockRejectedValue(new Error('Refresh token has expired or is invalid'));

      window.localStorage.setItem('sevanest_refresh_token', 'expired-bad-token');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'expired-bad-token',
      });

      const { router } = renderAuthFlow('/workers');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

      // Preserves original destination for post-login seamless recovery
      expect(router.state.location.state).toEqual({
        from: expect.objectContaining({ pathname: '/workers' }),
      });
    });
  });

  describe('7. Preserving Super Admin and Operations Admin Access Across Refreshes', () => {
    it('restores Super Admin wildcard permissions and preserves access to /dashboard and /configuration', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-super-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'refresh-super-1720000000',
      });

      const { router } = renderAuthFlow('/configuration');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      const session = useAuthStore.getState().user;
      expect(session?.role).toBe('SUPER_ADMIN');
      expect(session?.permissions).toContain('*');
      expect(router.state.location.pathname).toBe('/configuration');
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });

    it('restores Operations Admin operational permissions and preserves access to /workers', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: 'refresh-oper-1720000000',
      });

      const { router } = renderAuthFlow('/workers');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      const session = useAuthStore.getState().user;
      expect(session?.role).toBe('OPERATIONS_ADMIN');
      expect(session?.permissions).toContain(PERMISSIONS.WORKER_VIEW);
      expect(router.state.location.pathname).toBe('/workers');
      expect(await screen.findByText('Domestic Worker Roster & Profiles', {}, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('8. Ensuring No Fabricated Permissions or Real-Mode Fallback Data', () => {
    it('RealAuthRepository unpacks nested envelopes and extracts server permissions without inventing keys', async () => {
      const realRepo = new RealAuthRepository();

      // Test 1: Nested { data: { user: { ... } } } with structured permissions array
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              id: 'adm-verif-nested',
              name: 'Nested Verif Executive',
              email: 'verif.nested@sevanest.internal',
              role: 'VERIFICATION_EXECUTIVE',
              permissions: ['worker.view', 'verification.review', 'verification.document.view'],
            },
          },
        },
      });

      const user1 = await realRepo.getCurrentSession('token-test-1');
      expect(user1).not.toBeNull();
      expect(user1?.role).toBe('VERIFICATION_EXECUTIVE');
      expect(user1?.permissions).toEqual(['worker.view', 'verification.review', 'verification.document.view']);

      // Test 2: Structured permission objects [{ code: 'worker.view' }, { code: 'verification.review' }]
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'adm-verif-objs',
          name: 'Object Verif Executive',
          email: 'verif.objs@sevanest.internal',
          roleCode: 'VERIFICATION_EXECUTIVE',
          permissions: [
            { code: 'worker.view', name: 'View Workers' },
            { code: 'verification.review', name: 'Review Verifications' },
          ],
        },
      });

      const user2 = await realRepo.getCurrentSession('token-test-2');
      expect(user2?.permissions).toEqual(['worker.view', 'verification.review']);

      // Test 3: Explicit absence of worker.view from backend server
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'adm-verif-absent',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: ['verification.review', 'verification.document.view'],
        },
      });

      const user3 = await realRepo.getCurrentSession('token-test-3');
      expect(user3?.permissions).not.toContain('worker.view');
      expect(user3?.permissions).toEqual(['verification.review', 'verification.document.view']);

      // Test 4: Rejection of invalid administrative roles
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'invalid-actor',
          role: 'REGULAR_CUSTOMER',
          permissions: ['*'],
        },
      });

      await expect(realRepo.getCurrentSession('token-test-4')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('9. Deduplicating Concurrent Session Restoration and Token Refresh Requests', () => {
    it('dispatches only one POST /auth/token/refresh request when multiple components concurrently restore session', async () => {
      const realRepo = new RealAuthRepository();
      vi.spyOn(authRepository, 'refreshToken').mockImplementation(async (token?: string) => {
        return realRepo.refreshToken(token);
      });
      vi.spyOn(authRepository, 'getCurrentSession').mockImplementation(async (token?: string) => {
        return realRepo.getCurrentSession(token);
      });

      window.localStorage.setItem('sevanest_refresh_token', 'rt-concurrent-single-use');

      let refreshPostCallCount = 0;
      vi.spyOn(httpClient, 'post').mockImplementation(async (url: string) => {
        if (url === '/auth/token/refresh') {
          refreshPostCallCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            data: {
              success: true,
              data: {
                accessToken: 'jwt-deduped-access',
                refreshToken: 'rt-deduped-rotated',
                user: {
                  id: 'adm-dedup',
                  name: 'Dedup Admin',
                  email: 'dedup@sevanest.internal',
                  role: 'OPERATIONS_ADMIN',
                  permissions: [
                    'worker.view',
                    'verification.review',
                  ],
                },
              },
            },
          } as never;
        }
        throw new Error(`Unexpected POST to ${url}`);
      });

      const [result1, result2, result3] = await Promise.all([
        restoreSession(),
        restoreSession(),
        restoreSession(),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);

      expect(refreshPostCallCount).toBe(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('jwt-deduped-access');
      expect(useAuthStore.getState().refreshToken).toBe('rt-deduped-rotated');
      expect(useAuthStore.getState().user?.permissions).toContain('worker.view');
    });

    it('deduplicates concurrent calls to RealAuthRepository.refreshToken directly', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'rt-repo-concurrent');
      const repo = new RealAuthRepository();

      let postCount = 0;
      vi.spyOn(httpClient, 'post').mockImplementation(async (url: string) => {
        if (url === '/auth/token/refresh') {
          postCount++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            data: {
              data: {
                accessToken: 'jwt-repo-fresh',
                refreshToken: 'rt-repo-rotated',
              },
            },
          } as never;
        }
        throw new Error(`Unexpected POST ${url}`);
      });

      const [res1, res2] = await Promise.all([
        repo.refreshToken(),
        repo.refreshToken(),
      ]);

      expect(postCount).toBe(1);
      expect(res1.accessToken).toBe('jwt-repo-fresh');
      expect(res2.accessToken).toBe('jwt-repo-fresh');
      expect(res1.refreshToken).toBe('rt-repo-rotated');
      expect(res2.refreshToken).toBe('rt-repo-rotated');
    });
  });

  describe('10. Preserving Valid Session When Secondary Component Requests Restoration', () => {
    it('does not clear an already-authenticated valid session when another component requests restoration', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-valid',
          name: 'Active Administrator',
          email: 'valid@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: ['worker.view', 'verification.review'],
        },
        'jwt-active-token',
        'rt-active-token'
      );

      const postSpy = vi.spyOn(httpClient, 'post');
      const restored = await restoreSession();

      expect(restored).toBe(true);
      expect(postSpy).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe('adm-valid');
    });
  });

  describe('11. Direct Permission Mapping from Login, Refresh, and /users/me', () => {
    it('reads permissions directly from login response when backend includes them', async () => {
      const repo = new RealAuthRepository();
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: 'jwt-login-token',
            refreshToken: 'rt-login-refresh',
            permissions: [
              'worker.view',
              'verification.review',
              'verification.decide',
              'verification.document.view',
            ],
            user: {
              id: 'adm-login-direct',
              name: 'Direct Login Exec',
              email: 'direct.login@sevanest.internal',
              role: 'VERIFICATION_EXECUTIVE',
            },
          },
        },
      });

      const result = await repo.login({
        email: 'direct.login@sevanest.internal',
        password: 'Password123!',
      });

      expect(result.user.permissions).toEqual([
        'worker.view',
        'verification.review',
        'verification.decide',
        'verification.document.view',
      ]);
      expect(result.user.role).toBe('VERIFICATION_EXECUTIVE');
      expect(result.accessToken).toBe('jwt-login-token');
    });

    it('reads roles and permissions directly from token refresh response', async () => {
      const repo = new RealAuthRepository();
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            accessToken: 'jwt-refreshed-token',
            refreshToken: 'rt-rotated-refresh',
            role: 'VERIFICATION_EXECUTIVE',
            permissions: [
              'worker.view',
              'verification.review',
              'verification.decide',
              'verification.document.view',
            ],
            user: {
              id: 'adm-refreshed',
              name: 'Refreshed Exec',
              email: 'refreshed@sevanest.internal',
            },
          },
        },
      });

      const result = await repo.refreshToken('rt-initial');

      expect(result.accessToken).toBe('jwt-refreshed-token');
      expect(result.refreshToken).toBe('rt-rotated-refresh');
      expect(useAuthStore.getState().user?.permissions).toEqual([
        'worker.view',
        'verification.review',
        'verification.decide',
        'verification.document.view',
      ]);
    });
  });
});
