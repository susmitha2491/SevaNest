import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { VerificationExecutiveDashboard } from '../features/dashboard/presentation/VerificationExecutiveDashboard';
import { SupportExecutiveDashboard } from '../features/dashboard/presentation/SupportExecutiveDashboard';
import {
  RealDashboardRepository,
  dashboardRepository,
} from '../features/dashboard/data/dashboardRepository';
import { httpClient } from '../core/api/httpClient';
import { ServerFailureError } from '../core/errors/DomainError';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('All Role Dashboards: Real Data Handling & Strict Contract Policy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Operations Admin Dashboard Data Handling', () => {
    const validOpsResponse = {
      data: {
        success: true,
        data: {
          kpis: {
            totalCustomers: 120,
            totalWorkers: 150,
            newBookingRequests: 25,
            bookingsAwaitingMatching: 10,
            scheduledTrialsToday: 5,
            bookingsAwaitingConfirmation: 3,
            activeLiveEngagements: 300,
            replacementRequests: 8,
            pendingVerificationCases: 15,
            openDisputes: 0, // genuine zero
            pendingRefunds: 0, // genuine zero
            expiringVerifications: 4,
          },
          queues: {
            NEW_REQUESTS: [],
            MATCHING: [],
            TRIALS: [],
            CONFIRMATIONS: [],
            ACTIVE_SERVICES: [],
            REPLACEMENTS: [],
            REFUNDS: [],
            FOLLOW_UPS: [],
            SUPPORT_HANDOFFS: [],
          },
        },
      },
    };

    it('preserves genuine zero values without inventing fake numbers', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce(validOpsResponse);
      const repo = new RealDashboardRepository();
      const result = await repo.getOperationsAdminDashboard();

      expect(result.kpis.openDisputes).toBe(0);
      expect(result.kpis.pendingRefunds).toBe(0);
      expect(result.kpis.totalCustomers).toBe(120);
      expect(result.queues.NEW_REQUESTS).toEqual([]);
    });

    it('throws ServerFailureError when required KPI field is missing', async () => {
      const corrupt = JSON.parse(JSON.stringify(validOpsResponse));
      delete corrupt.data.data.kpis.newBookingRequests;

      vi.spyOn(httpClient, 'get').mockResolvedValue(corrupt);
      const repo = new RealDashboardRepository();

      await expect(repo.getOperationsAdminDashboard()).rejects.toThrow(
        /missing required metric "newBookingRequests"/
      );
    });

    it('renders genuine empty queue state in UI without fabricating records', async () => {
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValueOnce({
        kpis: {
          totalCustomers: 10,
          totalWorkers: 20,
          newBookingRequests: 0,
          bookingsAwaitingMatching: 0,
          scheduledTrialsToday: 0,
          bookingsAwaitingConfirmation: 0,
          activeLiveEngagements: 5,
          replacementRequests: 0,
          pendingVerificationCases: 0,
          openDisputes: 0,
          pendingRefunds: 0,
          expiringVerifications: 0,
        },
        queues: {
          NEW_REQUESTS: [],
          MATCHING: [],
          TRIALS: [],
          CONFIRMATIONS: [],
          ACTIVE_SERVICES: [],
          REPLACEMENTS: [],
          REFUNDS: [],
          FOLLOW_UPS: [],
          SUPPORT_HANDOFFS: [],
        },
      });

      renderWithClient(<OperationsAdminDashboard />);

      expect(await screen.findByRole('heading', { name: /Operations Command Console/i })).toBeInTheDocument();
      expect(await screen.findByText(/No open operational alerts or complaints recorded/i)).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });

    it('maps backend /admin/dashboard sections payload without inventing omitted pendingKyc, customers, or refunds', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            generatedAt: '2026-11-12T05:11:54.906Z',
            sections: {
              bookings: {
                byStatus: [
                  { status: 'NEW_REQUEST', count: 10 },
                  { status: 'MATCHED', count: 9 },
                  { status: 'INTERVIEW_TRIAL_SCHEDULED', count: 2 },
                  { status: 'INTERVIEW_TRIAL_COMPLETED', count: 1 },
                  { status: 'CONFIRMED', count: 6 },
                  { status: 'ACTIVE', count: 2 },
                  { status: 'COMPLETED', count: 3 },
                  { status: 'CANCELLED', count: 17 },
                ],
              },
              workers: { registered: 70, verifiedAndActive: 28 },
              complaints: { open: 5, inProgress: 0, escalated: 9, unassigned: 14 },
              replacements: { requested: 0, approved: 0 },
              alerts: { open: 30, critical: 2, warning: 20 },
              collections: [{ currency: 'INR', todayMinor: 50000, monthToDateMinor: 350000 }],
            },
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getOperationsAdminDashboard();

      expect(result.kpis.totalBookings).toBe(50);
      expect(result.kpis.newBookingRequests).toBe(10);
      expect(result.kpis.bookingsAwaitingMatching).toBe(9);
      expect(result.kpis.scheduledTrialsToday).toBe(2);
      expect(result.kpis.bookingsAwaitingConfirmation).toBe(7);
      expect(result.kpis.activeLiveEngagements).toBe(2);
      expect(result.kpis.totalWorkers).toBe(70);
      expect(result.kpis.verifiedAndActiveWorkers).toBe(28);
      expect(result.kpis.replacementRequests).toBe(0);
      expect(result.kpis.openDisputes).toBe(14);
      // Omitted permission-gated/unavailable metrics remain null rather than fabricated 0
      expect(result.kpis.totalCustomers).toBeNull();
      expect(result.kpis.pendingVerificationCases).toBeNull();
      expect(result.kpis.pendingRefunds).toBeNull();
      expect(result.kpis.expiringVerifications).toBeNull();
      expect(result.sections?.alerts).toEqual({ open: 30, critical: 2, warning: 20 });
      expect(result.sections?.collections?.[0].monthToDateFormatted).toBe('₹3,500.00');
    });

    it('renders backend sections UI cleanly and omits Pending KYC card when backend omits pendingKyc', async () => {
      useAuthStore.setState({
        user: {
          id: 'ops-real-01',
          name: 'Operations Manager',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
          ],
        },
        isAuthenticated: true,
        isInitialized: true,
      });

      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValueOnce({
        generatedAt: '2026-11-12T05:11:54.906Z',
        kpis: {
          totalBookings: 50,
          totalCustomers: null,
          totalWorkers: 70,
          verifiedAndActiveWorkers: 28,
          newBookingRequests: 10,
          bookingsAwaitingMatching: 9,
          scheduledTrialsToday: 2,
          bookingsAwaitingConfirmation: 7,
          activeLiveEngagements: 2,
          replacementRequests: 0,
          pendingVerificationCases: null,
          openDisputes: 14,
          pendingRefunds: null,
          expiringVerifications: null,
        },
        queues: {
          NEW_REQUESTS: [],
          MATCHING: [],
          TRIALS: [],
          CONFIRMATIONS: [],
          ACTIVE_SERVICES: [],
          REPLACEMENTS: [],
          REFUNDS: [],
          FOLLOW_UPS: [],
          SUPPORT_HANDOFFS: [],
        },
        sections: {
          bookings: {
            byStatus: [
              { status: 'NEW_REQUEST', count: 10 },
              { status: 'MATCHED', count: 9 },
              { status: 'INTERVIEW_TRIAL_SCHEDULED', count: 2 },
              { status: 'INTERVIEW_TRIAL_COMPLETED', count: 1 },
              { status: 'CONFIRMED', count: 6 },
              { status: 'ACTIVE', count: 2 },
              { status: 'COMPLETED', count: 3 },
              { status: 'CANCELLED', count: 17 },
            ],
          },
          workers: { registered: 70, verifiedAndActive: 28 },
          complaints: { open: 5, inProgress: 0, escalated: 9, unassigned: 14 },
          replacements: { requested: 0, approved: 0 },
          alerts: { open: 30, critical: 2, warning: 20 },
          collections: [
            {
              currency: 'INR',
              todayMinor: 50000,
              monthToDateMinor: 350000,
              todayINR: 500,
              monthToDateINR: 3500,
              todayFormatted: '₹500.00',
              monthToDateFormatted: '₹3,500.00',
            },
          ],
        },
      });

      renderWithClient(<OperationsAdminDashboard />);

      expect(await screen.findByRole('heading', { name: 'Operations Command Console' })).toBeInTheDocument();
      expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('₹3,500.00')).toBeInTheDocument();
      expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
      expect(screen.getByText('Unassigned Complaints')).toBeInTheDocument();
      expect(screen.queryByText('Pending KYC')).not.toBeInTheDocument();
    });

    it('displays domain error message with Retry button upon API failure', async () => {
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockRejectedValueOnce(
        new ServerFailureError('Dashboard contract violation: missing required metric "totalCustomers".')
      );

      renderWithClient(<OperationsAdminDashboard />);

      expect(
        await screen.findByText(/Dashboard contract violation: missing required metric "totalCustomers"./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  describe('Verification Executive Dashboard Data Handling', () => {
    const validVerifResponse = {
      data: {
        success: true,
        data: {
          kpis: {
            pendingReview: 18,
            inProgressReview: 4,
            reCheckDue: 0, // genuine zero
            decisionsToday: 0, // genuine zero
          },
          queues: {
            PENDING_REVIEW: [],
            IN_REVIEW: [],
            RECHECK_DUE: [],
          },
        },
      },
    };

    it('preserves genuine zero metrics and does not invent rechecks or decisions', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce(validVerifResponse);
      const repo = new RealDashboardRepository();
      const result = await repo.getVerificationExecutiveDashboard();

      expect(result.kpis.reCheckDue).toBe(0);
      expect(result.kpis.decisionsToday).toBe(0);
      expect(result.kpis.pendingReview).toBe(18);
    });

    it('throws ServerFailureError when verification metric is null or missing', async () => {
      const corrupt = JSON.parse(JSON.stringify(validVerifResponse));
      delete corrupt.data.data.kpis.pendingReview;

      vi.spyOn(httpClient, 'get').mockResolvedValue(corrupt);
      const repo = new RealDashboardRepository();

      await expect(repo.getVerificationExecutiveDashboard()).rejects.toThrow(
        /missing required metric "pendingReview"/
      );
    });

    it('renders genuine empty state when verification queues are cleared', async () => {
      vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          pendingReview: 0,
          inProgressReview: 0,
          reCheckDue: 0,
          decisionsToday: 0,
        },
        queues: {
          PENDING_REVIEW: [],
          IN_REVIEW: [],
          RECHECK_DUE: [],
          REJECTED: [],
        },
      });

      renderWithClient(<VerificationExecutiveDashboard />);

      expect(await screen.findByText(/Trust & Verification Console/i)).toBeInTheDocument();
      expect(screen.getByText(/All verification queues are up to date/i)).toBeInTheDocument();
    });

    it('displays domain error message with Retry button upon verification API failure', async () => {
      vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockRejectedValueOnce(
        new ServerFailureError('Dashboard contract violation: missing required metric "pendingReview".')
      );

      renderWithClient(<VerificationExecutiveDashboard />);

      expect(
        await screen.findByText(/Dashboard contract violation: missing required metric "pendingReview"./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  describe('Support Executive Dashboard Data Handling', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'supp-01',
          name: 'Support Executive',
          email: 'support@sevanest.in',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SUPPORT_VIEW],
        },
        isAuthenticated: true,
        isInitialized: true,
      });
    });

    const validSupportResponse = {
      data: {
        success: true,
        data: {
          kpis: {
            openUnassignedGrievances: 7,
            myActiveCases: 2,
            slaAtRiskCount: 1,
            slaBreachedCount: 0, // genuine zero
            resolvedTodayCount: 0, // genuine zero
          },
          queues: {
            AT_RISK: [],
            UNASSIGNED: [],
            MY_CASES: [],
            ESCALATED: [],
          },
        },
      },
    };

    it('preserves genuine zero metrics for breached SLAs and resolutions', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce(validSupportResponse);
      const repo = new RealDashboardRepository();
      const result = await repo.getSupportExecutiveDashboard();

      expect(result.kpis.slaBreachedCount).toBe(0);
      expect(result.kpis.resolvedTodayCount).toBe(0);
      expect(result.kpis.openUnassignedGrievances).toBe(7);
    });

    it('throws ServerFailureError when support metric is missing', async () => {
      const corrupt = JSON.parse(JSON.stringify(validSupportResponse));
      delete corrupt.data.data.kpis.openUnassignedGrievances;

      vi.spyOn(httpClient, 'get').mockResolvedValue(corrupt);
      const repo = new RealDashboardRepository();

      await expect(repo.getSupportExecutiveDashboard()).rejects.toThrow(
        /missing required metric "openUnassignedGrievances"/
      );
    });

    it('renders genuine empty state when support queues are cleared', async () => {
      vi.spyOn(dashboardRepository, 'getSupportExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          openUnassignedGrievances: 0,
          myActiveCases: 0,
          slaAtRiskCount: 0,
          slaBreachedCount: 0,
          resolvedTodayCount: 0,
        },
        queues: {
          AT_RISK: [],
          UNASSIGNED: [],
          MY_CASES: [],
          ESCALATED: [],
        },
      });

      renderWithClient(<SupportExecutiveDashboard />);

      expect(await screen.findByRole('heading', { name: /^Dashboard$/i })).toBeInTheDocument();
      expect(await screen.findByText(/No recent support ticket activity recorded/i)).toBeInTheDocument();
    });

    it('displays domain error message with Retry button upon support API failure', async () => {
      vi.spyOn(dashboardRepository, 'getSupportExecutiveDashboard').mockRejectedValueOnce(
        new ServerFailureError('Dashboard contract violation: missing required metric "openUnassignedGrievances".')
      );

      renderWithClient(<SupportExecutiveDashboard />);

      expect(
        await screen.findByText(/Dashboard contract violation: missing required metric "openUnassignedGrievances"./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
