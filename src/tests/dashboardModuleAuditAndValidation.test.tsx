import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../features/dashboard/presentation/DashboardPage';
import { SuperAdminDashboard } from '../features/dashboard/presentation/SuperAdminDashboard';
import {
  RealDashboardRepository,
  dashboardRepository,
} from '../features/dashboard/data/dashboardRepository';
import { useAuthStore } from '../core/auth/authStore';
import { httpClient } from '../core/api/httpClient';
import { ServerFailureError } from '../core/errors/DomainError';
import { formatCurrencyINR } from '../shared/formatters/currency';

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

describe('Dashboard Module Audit & Validation (PRD Section 7 & Section 3 Compliance)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
  });

  describe('1. PRD Section 7: Six Core Categories Coverage on Super Admin Dashboard', () => {
    const fullMockData = {
      kpis: {
        grossBookings: 1420,
        activeWorkforce: 385,
        verificationQueue: 42,
        activeGrievances: 7,
        replacementVolume: 14,
        platformRevenueINR: 485200,
        scheduledTrials: 18,
        policeVerifDue: 9,
      },
      queues: [
        {
          id: 'Q-01',
          type: 'VERIFICATION' as const,
          title: 'Worker Verification Backlog',
          source: 'Trust & Safety',
          timing: '10m ago',
          status: 'PENDING_REVIEW',
          targetRoute: '/verification',
          actionLabel: 'Inspect',
        },
      ],
      sections: {
        bookings: {
          byStatus: [
            { status: 'ACTIVE', count: 12 },
            { status: 'CONFIRMED', count: 5 },
          ],
          grossBookings: 1420,
        },
        workers: {
          registered: 500,
          verifiedAndActive: 385,
        },
        pendingKyc: {
          submitted: 25,
          inReview: 17,
        },
        complaints: {
          open: 3,
          inProgress: 3,
          escalated: 1,
          unassigned: 0,
        },
        replacements: {
          requested: 10,
          approved: 4,
        },
        alerts: {
          open: 0,
          critical: 0,
          warning: 0,
        },
        collections: [
          {
            currency: 'INR',
            todayMinor: 500000,
            monthToDateMinor: 48520000,
            todayINR: 5000,
            monthToDateINR: 485200,
            todayFormatted: '₹5,000',
            monthToDateFormatted: '₹4,85,200',
          },
        ],
      },
    };

    it('displays all 6 PRD Section 7 categories: Bookings, Active Workers, Pending KYC, Complaints, Replacements, Collections', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce(fullMockData);

      renderWithClient(<SuperAdminDashboard />);

      // 1. Bookings
      expect(await screen.findByText('Gross Bookings')).toBeInTheDocument();
      expect(screen.getByText('1420')).toBeInTheDocument();

      // 2. Active Workers
      expect(screen.getByText('Active Workforce')).toBeInTheDocument();
      expect(screen.getByText('385 verified of 500 registered')).toBeInTheDocument();

      // 3. Pending KYC
      expect(screen.getByText('Verification Queue')).toBeInTheDocument();
      expect(screen.getByText('25 submitted, 17 in review')).toBeInTheDocument();

      // 4. Complaints
      expect(screen.getByText('Active Grievances')).toBeInTheDocument();
      expect(screen.getByText('3 open, 3 in progress, 1 escalated')).toBeInTheDocument();

      // 5. Replacements
      expect(screen.getByText('Replacement Volume')).toBeInTheDocument();
      expect(screen.getByText('10 requested, 4 approved')).toBeInTheDocument();

      // 6. Collections
      expect(screen.getByText('Gross Collections')).toBeInTheDocument();
      expect(screen.getByText(formatCurrencyINR(485200))).toBeInTheDocument();
    });

    it('honestly renders unavailable indicators when optional financial/booking metrics are omitted by backend', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: null,
          activeWorkforce: 100,
          verificationQueue: 10,
          activeGrievances: 2,
          replacementVolume: 3,
          platformRevenueINR: null, // Omitted financial summary
          scheduledTrials: 5,
          policeVerifDue: null,
        },
        queues: [],
      });

      renderWithClient(<SuperAdminDashboard />);

      // Verify em-dash rendered for unavailable metrics without dummy data
      expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);

      // Verify explanatory unavailable subtitles
      expect(screen.getAllByText('Metric unavailable (pending contract definition)').length).toBeGreaterThanOrEqual(2);
    });

    it('renders genuine zero values as valid data without converting them to dashes or dummy values', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: 0,
          activeWorkforce: 0,
          verificationQueue: 0,
          activeGrievances: 0,
          replacementVolume: 0,
          platformRevenueINR: 0,
          scheduledTrials: 0,
          policeVerifDue: 0,
        },
        queues: [],
      });

      renderWithClient(<SuperAdminDashboard />);

      expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
      expect(screen.getByText(formatCurrencyINR(0))).toBeInTheDocument();
      const zeroCards = screen.getAllByText('0');
      expect(zeroCards.length).toBeGreaterThanOrEqual(5);
    });

    it('renders empty queue state when backend returns zero queue records', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: fullMockData.kpis,
        queues: [],
      });

      renderWithClient(<SuperAdminDashboard />);

      expect(await screen.findByText(/No operational queues requiring executive attention at this time/i)).toBeInTheDocument();
    });
  });

  describe('2. PRD Section 3: Four Standard Administrative Roles Mount Correct Consoles', () => {
    it('mounts SuperAdminDashboard when role is SUPER_ADMIN', async () => {
      useAuthStore.getState().setSession(
        { id: 'usr-1', name: 'Super Admin', email: 'sa@sevanest.internal', role: 'SUPER_ADMIN', permissions: ['*'] },
        'tok-1'
      );
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: 10,
          activeWorkforce: 5,
          verificationQueue: 1,
          activeGrievances: 0,
          replacementVolume: 0,
          platformRevenueINR: 5000,
          scheduledTrials: 1,
          policeVerifDue: 0,
        },
        queues: [],
      });

      renderWithClient(<DashboardPage />);
      expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
    });

    it('mounts OperationsAdminDashboard when role is OPERATIONS_ADMIN', async () => {
      useAuthStore.getState().setSession(
        { id: 'usr-2', name: 'Ops Admin', email: 'ops@sevanest.internal', role: 'OPERATIONS_ADMIN', permissions: ['dashboard.view'] },
        'tok-2'
      );
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValueOnce({
        kpis: {
          totalCustomers: 50,
          totalWorkers: 80,
          newBookingRequests: 5,
          bookingsAwaitingMatching: 2,
          scheduledTrialsToday: 1,
          bookingsAwaitingConfirmation: 1,
          activeLiveEngagements: 20,
          replacementRequests: 2,
          pendingVerificationCases: 3,
          openDisputes: 0,
          pendingRefunds: 0,
          expiringVerifications: 1,
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

      renderWithClient(<DashboardPage />);
      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();
    });

    it('mounts VerificationExecutiveDashboard when role is VERIFICATION_EXECUTIVE', async () => {
      useAuthStore.getState().setSession(
        { id: 'usr-3', name: 'Verif Exec', email: 've@sevanest.internal', role: 'VERIFICATION_EXECUTIVE', permissions: ['dashboard.view'] },
        'tok-3'
      );
      vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          pendingReview: 10,
          inProgressReview: 4,
          reCheckDue: 2,
          decisionsToday: 0,
        },
        queues: {
          PENDING_REVIEW: [],
          IN_REVIEW: [],
          RECHECK_DUE: [],
          REJECTED: [],
        },
      });

      renderWithClient(<DashboardPage />);
      expect(await screen.findByText('Trust & Verification Console')).toBeInTheDocument();
    });

    it('mounts SupportExecutiveDashboard when role is SUPPORT_EXECUTIVE', async () => {
      useAuthStore.getState().setSession(
        { id: 'usr-4', name: 'Support Exec', email: 'se@sevanest.internal', role: 'SUPPORT_EXECUTIVE', permissions: ['dashboard.view'] },
        'tok-4'
      );
      vi.spyOn(dashboardRepository, 'getSupportExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          openUnassignedGrievances: 3,
          myActiveCases: 5,
          slaAtRiskCount: 1,
          slaBreachedCount: 0,
          resolvedTodayCount: 2,
        },
        queues: {
          AT_RISK: [],
          UNASSIGNED: [],
          MY_CASES: [],
          ESCALATED: [],
        },
      });

      renderWithClient(<DashboardPage />);
      expect(await screen.findByText('Support Operations Console')).toBeInTheDocument();
    });
  });

  describe('3. Error Handling and Retry Interactions', () => {
    it('displays error notice and provides functional retry action when request fails', async () => {
      const errorMock = vi.spyOn(dashboardRepository, 'getSuperAdminDashboard')
        .mockRejectedValueOnce(new ServerFailureError('Simulated network failure on dashboard endpoint.'))
        .mockResolvedValueOnce({
          kpis: {
            grossBookings: 10,
            activeWorkforce: 5,
            verificationQueue: 1,
            activeGrievances: 0,
            replacementVolume: 0,
            platformRevenueINR: 5000,
            scheduledTrials: 1,
            policeVerifDue: 0,
          },
          queues: [],
        });

      renderWithClient(<SuperAdminDashboard />);

      // Verify error state
      expect(await screen.findByText('Simulated network failure on dashboard endpoint.')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryBtn);

      // Verify recovered state
      expect(await screen.findByText('Super Admin Executive Console')).toBeInTheDocument();
      expect(errorMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. RealDashboardRepository Contract Parsing Integrity', () => {
    it('parses sections payload accurately from backend /admin/dashboard response', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            sections: {
              bookings: {
                total: 200,
                byStatus: [{ status: 'CONFIRMED', count: 50 }],
              },
              workers: {
                registered: 80,
                verifiedAndActive: 65,
              },
              pendingKyc: {
                submitted: 10,
                inReview: 5,
              },
              complaints: {
                open: 2,
                inProgress: 1,
                escalated: 1,
              },
              replacements: {
                requested: 4,
              },
              collections: [
                {
                  currency: 'INR',
                  monthToDateMinor: 15000000,
                },
              ],
            },
            queues: [],
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.kpis.grossBookings).toBe(200);
      expect(result.kpis.activeWorkforce).toBe(65);
      expect(result.kpis.verificationQueue).toBe(15);
      expect(result.kpis.activeGrievances).toBe(4);
      expect(result.kpis.replacementVolume).toBe(4);
      expect(result.kpis.platformRevenueINR).toBe(150000);
    });

    it('rejects malformed queue items with ServerFailureError without accepting corrupted records', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 10,
              activeWorkforce: 5,
              verificationQueue: 1,
              activeGrievances: 0,
              replacementVolume: 0,
              platformRevenueINR: 5000,
              scheduledTrials: 1,
              policeVerifDue: 0,
            },
            queues: [
              { invalidField: 'missing id, title, targetRoute' },
            ],
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: queue item at index 0 missing required fields/
      );
    });
  });
});
