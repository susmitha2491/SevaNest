import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { dashboardRepository, RealDashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { httpClient } from '../core/api/httpClient';
import { VerificationExecutiveDashboard } from '../features/dashboard/presentation/VerificationExecutiveDashboard';
import { ServerFailureError } from '../core/errors/DomainError';

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

describe('Verification Executive Dashboard Access & Landing Experience', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Login & Default Landing Routing', () => {
    it('redirects Verification Executive to their authorized workstation (/verification) upon sign-in', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verif.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      // Verification Executive must land on /verification, NOT /dashboard
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      // Ensure sidebar displays Verification Review and Workers, but NOT Dashboard
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Required permission: dashboard.view/i)).not.toBeInTheDocument();
    });

    it('redirects already-authenticated Verification Executive to /verification when visiting /auth/login', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          ],
        },
        'verif-token'
      );

      const { router } = renderApp('/auth/login');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
    });

    it('redirects root route (/) to /verification for Verification Executive', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          ],
        },
        'verif-token'
      );

      const { router } = renderApp('/');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
    });

    it('preserves root route (/) redirect to /dashboard for Super Admin and Operations Admin', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'super-token'
      );

      const { router } = renderApp('/');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Route Guard & Permission Enforcement on /dashboard', () => {
    it('enforces dashboard.view permission on /dashboard and renders Access Restricted with return link to /verification', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          ],
        },
        'verif-token'
      );

      // Explicitly try navigating to /dashboard without dashboard.view
      renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: dashboard.view/i)).toBeInTheDocument();

      // Return button must link to the user's primary workstation (/verification)
      const returnBtn = screen.getByRole('link', { name: /Return to Primary Workstation/i });
      expect(returnBtn).toBeInTheDocument();
      expect(returnBtn).toHaveAttribute('href', '/verification');
    });

    it('mounts VerificationExecutiveDashboard when user possesses dashboard.view', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'verif-token'
      );

      renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
    });
  });

  describe('Live Data Loading, Derivation & Fallback Safety', () => {
    it('derives real metrics and queues from authorized /admin/verification/queue when no dedicated dashboard endpoint exists', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: Parameters<typeof httpClient.get>[1]) => {
        if (url === '/admin/dashboard') {
          // Simulate 403 Forbidden on unified ops dashboard
          const error = new Error('Forbidden') as Error & { response: { status: number; data: { message: string } } };
          error.response = { status: 403, data: { message: 'Unauthorized for dashboard' } };
          throw error;
        }

        if (url === '/admin/verification/queue') {
          const status = (config?.params as Record<string, unknown> | undefined)?.status;
          if (status === 'PENDING_REVIEW') {
            return {
              data: {
                success: true,
                data: [
                  {
                    id: 'VQ-REAL-01',
                    workerId: 'W-9901',
                    workerName: 'Geeta Kumari',
                    category: 'Cook',
                    status: 'PENDING_REVIEW',
                    pendingCheckTypes: ['Aadhaar', 'Address'],
                  },
                ],
                meta: { totalItems: 25 },
              },
            } as never;
          }
          if (status === 'IN_REVIEW') {
            return {
              data: {
                success: true,
                data: [
                  {
                    id: 'VQ-REAL-02',
                    workerId: 'W-9902',
                    workerName: 'Mohan Lal',
                    category: 'Driver',
                    status: 'IN_REVIEW',
                    pendingCheckTypes: ['Driving License'],
                  },
                ],
                meta: { totalItems: 8 },
              },
            } as never;
          }
          if (status === 'RECHECK_DUE') {
            return {
              data: {
                success: true,
                data: [],
                meta: { totalItems: 2 },
              },
            } as never;
          }
          if (status === 'APPROVED') {
            return {
              data: {
                success: true,
                data: [],
                meta: { totalItems: 142 },
              },
            } as never;
          }
        }
        throw new Error(`Unexpected request: ${url}`);
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getVerificationExecutiveDashboard();

      expect(getSpy).toHaveBeenCalledWith('/admin/dashboard');
      expect(result.kpis.pendingReview).toBe(25);
      expect(result.kpis.inProgressReview).toBe(8);
      expect(result.kpis.reCheckDue).toBe(2);
      expect(result.kpis.completedReviews).toBe(142);
      expect(result.kpis.decisionsToday).toBe(0);

      expect(result.queues.PENDING_REVIEW).toHaveLength(1);
      expect(result.queues.PENDING_REVIEW[0].workerName).toBe('Geeta Kumari');
      expect(result.queues.IN_REVIEW).toHaveLength(1);
      expect(result.queues.IN_REVIEW[0].workerName).toBe('Mohan Lal');
      expect(result.queues.RECHECK_DUE).toHaveLength(0);
    });

    it('renders genuine empty queue state in UI without fabricating records', async () => {
      vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          pendingReview: 0,
          inProgressReview: 0,
          reCheckDue: 0,
          decisionsToday: 0,
          completedReviews: 50,
        },
        queues: {
          PENDING_REVIEW: [],
          IN_REVIEW: [],
          RECHECK_DUE: [],
          REJECTED: [],
        },
      });

      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
        },
        'token'
      );

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <VerificationExecutiveDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i })).toBeInTheDocument();
      expect(screen.getByText(/All verification queues are up to date\. Zero pending worker documents awaiting review\./i)).toBeInTheDocument();
      expect(screen.getByText('Completed Reviews')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('renders error message with Retry button when verification queue API fails', async () => {
      vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockRejectedValueOnce(
        new ServerFailureError('Unable to connect to verification queue service. Please retry.')
      );

      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
        },
        'token'
      );

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <VerificationExecutiveDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText(/Unable to connect to verification queue service\. Please retry\./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
