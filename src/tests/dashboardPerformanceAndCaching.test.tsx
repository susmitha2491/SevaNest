import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminDashboard } from '../features/dashboard/presentation/SuperAdminDashboard';
import { VerificationExecutiveDashboard } from '../features/dashboard/presentation/VerificationExecutiveDashboard';
import {
  RealDashboardRepository,
  dashboardRepository,
} from '../features/dashboard/data/dashboardRepository';
import { httpClient } from '../core/api/httpClient';
import { queryClient as globalQueryClient } from '../core/api/queryClient';
import { ServerFailureError, TimeoutError } from '../core/errors/DomainError';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

describe('Dashboard Performance, Concurrency, Caching & Retry Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
  });

  it('SuperAdminDashboard renders main KPI cards immediately without blocking on the 12 analytics reports or duplicating payment-collections', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/dashboard') {
        return {
          data: {
            generatedAt: '2026-11-25T09:00:00.000Z',
            sections: {
              bookings: { byStatus: [{ status: 'ACTIVE', count: 4 }] },
              workers: { registered: 20, verifiedAndActive: 15 },
              pendingKyc: { submitted: 3, inReview: 1 },
              complaints: { open: 1, inProgress: 0, escalated: 0, unassigned: 1 },
              replacements: { requested: 0, approved: 0 },
              alerts: { open: 0, critical: 0, warning: 0 },
              collections: [{ currency: 'INR', todayMinor: 10000, monthToDateMinor: 400000 }],
            },
          },
        } as never;
      }
      if (url.startsWith('/admin/reports/')) {
        // Keep analytics pending initially to prove KPI cards do not block on all 12 reports
        return new Promise(() => {}) as never;
      }
      return { data: null } as never;
    });

    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockImplementation(() =>
      new RealDashboardRepository().getSuperAdminDashboard()
    );
    vi.spyOn(dashboardRepository, 'getSuperAdminAnalytics').mockImplementation(() =>
      new RealDashboardRepository().getSuperAdminAnalytics()
    );

    const qc = createTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SuperAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Main KPI cards must appear immediately even while all 12 analytics reports are still pending
    expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
    expect(screen.getByText('Active Workforce')).toBeInTheDocument();
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Loading Business Analytics & Trends...')).toBeInTheDocument();

    // Ensure /admin/reports/payment-collections is requested at most ONCE (no duplicate KPI call)
    const paymentCollectionCalls = getSpy.mock.calls.filter(
      ([url]) => url === '/admin/reports/payment-collections'
    );
    expect(paymentCollectionCalls.length).toBeLessThanOrEqual(1);
  });

  it('VerificationExecutiveDashboard uses cached data immediately on remount and refreshes in background when invalidated without clearing valid data', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'verif-1',
        name: 'Verif Exec',
        email: 'verif@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      },
      'tok-verif'
    );

    const makeVerifPayload = (pending: number) => ({
      overview: { pendingApplications: pending, inReview: 1, correctionsRequired: 0, recheckDue: 0 },
      kpis: { pendingReview: pending, inProgressReview: 1, reCheckDue: 0, decisionsToday: 0 },
      queues: { PENDING_REVIEW: [], IN_REVIEW: [], RECHECK_DUE: [], REJECTED: [] },
    });

    let resolveBackground!: (v: ReturnType<typeof makeVerifPayload>) => void;
    const bgPromise = new Promise<ReturnType<typeof makeVerifPayload>>((r) => {
      resolveBackground = r;
    });

    const getSpy = vi
      .spyOn(dashboardRepository, 'getVerificationExecutiveDashboard')
      .mockResolvedValueOnce(makeVerifPayload(31))
      .mockReturnValueOnce(bgPromise);

    const qc = createTestQueryClient();
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <VerificationExecutiveDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect((await screen.findAllByText('31')).length).toBeGreaterThanOrEqual(1);
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Unmount and remount while cache is fresh -> zero extra requests
    unmount();
    const { unmount: unmount2 } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <VerificationExecutiveDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getAllByText('31').length).toBeGreaterThanOrEqual(1);
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Invalidate cache and remount -> shows cached 31 immediately (no LoadingSpinner) while refreshing in background
    unmount2();
    await qc.invalidateQueries({ queryKey: ['dashboard', 'verification-exec'] });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <VerificationExecutiveDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getAllByText('31').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Loading Trust & Verification Workstation/i)).not.toBeInTheDocument();
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));

    resolveBackground(makeVerifPayload(29));
    expect((await screen.findAllByText('29')).length).toBeGreaterThanOrEqual(1);
  });

  it('RealDashboardRepository.getVerificationExecutiveDashboard runs /admin/dashboard concurrently with verification queue and workers requests', async () => {
    const startedUrls: string[] = [];
    let releaseDashboard!: () => void;
    const dashboardGate = new Promise<void>((r) => {
      releaseDashboard = r;
    });

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      startedUrls.push(url);
      if (url === '/admin/dashboard') {
        await dashboardGate;
        return { data: { sections: { workers: { registered: 10, verifiedAndActive: 8 } } } } as never;
      }
      if (url === '/admin/verification/queue') {
        return { data: { data: [], meta: { total: 0 } } } as never;
      }
      if (url === '/admin/workers') {
        return { data: { data: [] } } as never;
      }
      return { data: null } as never;
    });

    const repo = new RealDashboardRepository();
    const pending = repo.getVerificationExecutiveDashboard();

    // Before /admin/dashboard resolves, queue and workers requests must already be in flight
    await waitFor(() => {
      expect(startedUrls).toContain('/admin/dashboard');
      expect(startedUrls).toContain('/admin/verification/queue');
      expect(startedUrls).toContain('/admin/workers');
    });

    releaseDashboard();
    const res = await pending;
    expect(res.kpis.registeredWorkers).toBe(10);
  });

  it('RealDashboardRepository.getSupportExecutiveDashboard runs /admin/dashboard and /admin/support/tickets concurrently', async () => {
    const startedUrls: string[] = [];
    let releaseDashboard!: () => void;
    const dashboardGate = new Promise<void>((r) => {
      releaseDashboard = r;
    });

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      startedUrls.push(url);
      if (url === '/admin/dashboard') {
        await dashboardGate;
        return { data: { sections: { complaints: { open: 2, inProgress: 1, escalated: 0, unassigned: 2 } } } } as never;
      }
      if (url === '/admin/support/tickets') {
        return { data: { success: true, data: [], meta: { total: 0 } } } as never;
      }
      return { data: null } as never;
    });

    const repo = new RealDashboardRepository();
    const pending = repo.getSupportExecutiveDashboard();

    await waitFor(() => {
      expect(startedUrls).toContain('/admin/dashboard');
      expect(startedUrls).toContain('/admin/support/tickets');
    });

    releaseDashboard();
    const res = await pending;
    expect(res.kpis.unassignedTickets).toBe(2);
  });

  it('global queryClient does not retry TimeoutError, ServerFailureError, or 5xx responses to avoid retry amplification', () => {
    const retry = globalQueryClient.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe('function');
    if (typeof retry !== 'function') return;

    expect(retry(0, new TimeoutError('Request timed out'))).toBe(false);
    expect(retry(0, new ServerFailureError('Backend failure'))).toBe(false);
    expect(retry(0, { response: { status: 503 } } as unknown as Error)).toBe(false);
    expect(retry(0, { response: { status: 429 } } as unknown as Error)).toBe(false);
    expect(globalQueryClient.getDefaultOptions().queries?.placeholderData).toBe(keepPreviousData);
  });
});

