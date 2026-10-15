import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminDashboard } from '../features/dashboard/presentation/SuperAdminDashboard';
import {
  RealDashboardRepository,
  MockDashboardRepository,
  createDashboardRepository,
  dashboardRepository,
} from '../features/dashboard/data/dashboardRepository';
import { httpClient } from '../core/api/httpClient';
import {
  ServerFailureError,
  UnauthorizedError,
  ForbiddenError,
  NetworkError,
} from '../core/errors/DomainError';
import { env } from '../core/config/env';
import { formatCurrencyINR } from '../shared/formatters/currency';

function renderSuperAdminDashboard() {
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
        <SuperAdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Super Admin Dashboard: Real Data Handling & Zero Dummy Policy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RealDashboardRepository Data Validation', () => {
    it('successfully parses valid full backend responses without inventing records', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 1980,
              activeWorkforce: 512,
              verificationQueue: 33,
              activeGrievances: 4,
              replacementVolume: 11,
              platformRevenueINR: 765000,
              scheduledTrials: 22,
              policeVerifDue: 6,
            },
            queues: [
              {
                id: 'REAL-Q-01',
                type: 'VERIFICATION',
                title: 'Urgent Police Clearances Pending',
                source: 'Telangana Police Integration',
                timing: '2 hrs ago',
                status: 'PENDING_REVIEW',
                targetRoute: '/verification',
                actionLabel: 'Inspect',
              },
            ],
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.kpis.grossBookings).toBe(1980);
      expect(result.kpis.activeWorkforce).toBe(512);
      expect(result.kpis.verificationQueue).toBe(33);
      expect(result.kpis.activeGrievances).toBe(4);
      expect(result.kpis.replacementVolume).toBe(11);
      expect(result.kpis.platformRevenueINR).toBe(765000);
      expect(result.kpis.scheduledTrials).toBe(22);
      expect(result.kpis.policeVerifDue).toBe(6);

      expect(result.queues).toHaveLength(1);
      expect(result.queues[0].id).toBe('REAL-Q-01');
      expect(result.queues[0].title).toBe('Urgent Police Clearances Pending');

      // Verify no fabricated records (LIVE-VQ, LIVE-SUPP) are present
      expect(result.queues.some((q) => q.id === 'LIVE-VQ' || q.id === 'LIVE-SUPP')).toBe(false);
    });

    it('distinguishes and accepts genuine zero values without conversion or rejection', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
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
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.kpis.grossBookings).toBe(0);
      expect(result.kpis.activeWorkforce).toBe(0);
      expect(result.kpis.verificationQueue).toBe(0);
      expect(result.kpis.activeGrievances).toBe(0);
      expect(result.kpis.replacementVolume).toBe(0);
      expect(result.kpis.platformRevenueINR).toBe(0);
      expect(result.kpis.scheduledTrials).toBe(0);
      expect(result.kpis.policeVerifDue).toBe(0);
      expect(result.queues).toEqual([]);
    });

    it('handles an explicitly valid empty queues array without inventing fallback items', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 100,
              activeWorkforce: 50,
              verificationQueue: 10,
              activeGrievances: 2,
              replacementVolume: 1,
              platformRevenueINR: 25000,
              scheduledTrials: 5,
              policeVerifDue: 1,
            },
            queues: [],
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.queues).toEqual([]);
      expect(result.queues).not.toContainEqual(expect.objectContaining({ id: 'LIVE-VQ' }));
      expect(result.queues).not.toContainEqual(expect.objectContaining({ id: 'LIVE-SUPP' }));
    });

    it('throws a contract error when a required KPI field is missing rather than converting it to zero', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              // grossBookings is omitted
              activeWorkforce: 50,
              verificationQueue: 10,
              activeGrievances: 2,
              replacementVolume: 1,
              platformRevenueINR: 25000,
              scheduledTrials: 5,
              policeVerifDue: 1,
            },
            queues: [],
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: missing required metric "grossBookings"/i
      );
    });

    it('throws a contract error when a required metric value is negative or non-numeric', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 'corrupt-data',
              activeWorkforce: 50,
              verificationQueue: 10,
              activeGrievances: 2,
              replacementVolume: 1,
              platformRevenueINR: 25000,
              scheduledTrials: 5,
              policeVerifDue: 1,
            },
            queues: [],
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: invalid metric value for "grossBookings"/i
      );
    });

    it('throws a contract error when queues field is missing entirely', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 10,
              activeWorkforce: 10,
              verificationQueue: 1,
              activeGrievances: 0,
              replacementVolume: 0,
              platformRevenueINR: 1000,
              scheduledTrials: 1,
              policeVerifDue: 0,
            },
            // queues is completely omitted
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: missing or malformed operational queues/i
      );
    });

    it('throws a contract error when queues field is malformed (not an array)', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 10,
              activeWorkforce: 10,
              verificationQueue: 1,
              activeGrievances: 0,
              replacementVolume: 0,
              platformRevenueINR: 1000,
              scheduledTrials: 1,
              policeVerifDue: 0,
            },
            queues: { invalid: 'object' },
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: missing or malformed operational queues/i
      );
    });

    it('throws a contract error when response envelope is invalid or null', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: null,
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Invalid response received from dashboard API/i
      );
    });

    it('correctly maps alternative field aliases from flat response envelope', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          totalBookings: 1250,
          totalWorkers: 320,
          pendingVerifications: 28,
          openTickets: 3,
          replacementsPending: 9,
          totalRevenueINR: 410000,
          activeTrials: 16,
          expiringClearances: 4,
          queues: [],
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.kpis.grossBookings).toBe(1250);
      expect(result.kpis.activeWorkforce).toBe(320);
      expect(result.kpis.verificationQueue).toBe(28);
      expect(result.kpis.activeGrievances).toBe(3);
      expect(result.kpis.replacementVolume).toBe(9);
      expect(result.kpis.platformRevenueINR).toBe(410000);
      expect(result.kpis.scheduledTrials).toBe(16);
      expect(result.kpis.policeVerifDue).toBe(4);
      expect(result.queues).toEqual([]);
    });

    it('propagates UnauthorizedError when backend returns HTTP 401', async () => {
      const axios401Error = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { code: 'UNAUTHENTICATED', message: 'Authentication is required' },
          headers: { 'x-request-id': 'req-test-401' },
        },
      };
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios401Error);

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(UnauthorizedError);
    });

    it('propagates ForbiddenError when backend returns HTTP 403', async () => {
      const axios403Error = {
        isAxiosError: true,
        response: {
          status: 403,
          data: { code: 'FORBIDDEN', message: 'Access denied: dashboard.view required' },
          headers: { 'x-request-id': 'req-test-403' },
        },
      };
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios403Error);

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(ForbiddenError);
    });

    it('propagates ServerFailureError when backend returns HTTP 500', async () => {
      const axios500Error = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' },
          headers: { 'x-request-id': 'req-test-500' },
        },
      };
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios500Error);

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(ServerFailureError);
    });

    it('propagates NetworkError when network failure or CORS error occurs', async () => {
      const networkError = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network Error',
      };
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(networkError);

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(NetworkError);
    });

    it('verifies API connectivity and proxy endpoint path convention', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: {
            kpis: {
              grossBookings: 10,
              activeWorkforce: 5,
              verificationQueue: 1,
              activeGrievances: 0,
              replacementVolume: 0,
              platformRevenueINR: 1000,
              scheduledTrials: 1,
              policeVerifDue: 0,
            },
            queues: [],
          },
        },
      });

      const repo = new RealDashboardRepository();
      await repo.getSuperAdminDashboard();

      // Confirms standard relative endpoint path forwarded to reverse proxy
      expect(getSpy).toHaveBeenCalledWith('/admin/dashboard');
      // Confirms base URL defaults to /api/v1 (or valid URL for proxying)
      expect(httpClient.defaults.baseURL).toBe(env.VITE_API_BASE_URL);
    });

    it('successfully parses the observed backend sections payload without fabricating missing metrics or guessing grossBookings', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          generatedAt: '2026-10-15T06:31:28.064Z',
          sections: {
            bookings: {
              byStatus: [
                { status: 'ACTIVE', count: 2 },
                { status: 'CANCELLED', count: 1 },
                { status: 'COMPLETED', count: 3 },
                { status: 'CONFIRMED', count: 1 },
                { status: 'INTERVIEW_TRIAL_COMPLETED', count: 1 },
                { status: 'INTERVIEW_TRIAL_SCHEDULED', count: 1 },
                { status: 'MATCHED', count: 2 },
                { status: 'PENDING_PAYMENT', count: 2 },
                { status: 'REPLACEMENT_REQUESTED', count: 1 },
              ],
            },
            workers: {
              registered: 13,
              verifiedAndActive: 9,
            },
            pendingKyc: {
              submitted: 1,
              inReview: 1,
            },
            complaints: {
              open: 1,
              inProgress: 1,
              escalated: 0,
              unassigned: 1,
            },
            replacements: {
              requested: 0,
              approved: 1,
            },
            alerts: {
              open: 0,
              critical: 0,
              warning: 0,
            },
            collections: [
              {
                currency: 'INR',
                todayMinor: 0,
                monthToDateMinor: 350000,
              },
            ],
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      // Confirmed semantic mappings:
      // Active Workforce: verifiedAndActive staff
      expect(result.kpis.activeWorkforce).toBe(9);
      // Verification Queue: submitted + inReview pending KYC cases
      expect(result.kpis.verificationQueue).toBe(2);
      // Active Grievances: open + inProgress + escalated unresolved complaints
      expect(result.kpis.activeGrievances).toBe(2);
      // Replacement Volume: genuine 0 requested replacements
      expect(result.kpis.replacementVolume).toBe(0);
      // Gross Collections: INR 350,000 paise / 100 = 3,500 INR
      expect(result.kpis.platformRevenueINR).toBe(3500);
      // Scheduled Trials: INTERVIEW_TRIAL_SCHEDULED status count
      expect(result.kpis.scheduledTrials).toBe(1);

      // Missing / Ambiguous metrics:
      // grossBookings is NOT assumed to be sum of all statuses (14) or non-cancelled (13)
      expect(result.kpis.grossBookings).toBeNull();
      // policeVerifDue is omitted from sections response
      expect(result.kpis.policeVerifDue).toBeNull();

      // Queues: empty array when omitted in sections response, without inventing fake records
      expect(result.queues).toEqual([]);
    });

    it('preserves genuine zero values in sections envelope and parses explicit grossBookings when provided', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          sections: {
            bookings: {
              total: 50,
              byStatus: [],
            },
            workers: {
              registered: 0,
              verifiedAndActive: 0,
            },
            pendingKyc: {
              submitted: 0,
              inReview: 0,
            },
            complaints: {
              open: 0,
              inProgress: 0,
              escalated: 0,
            },
            replacements: {
              requested: 0,
            },
            collections: [
              {
                currency: 'INR',
                monthToDateMinor: 0,
              },
            ],
          },
        },
      });

      const repo = new RealDashboardRepository();
      const result = await repo.getSuperAdminDashboard();

      expect(result.kpis.grossBookings).toBe(50);
      expect(result.kpis.activeWorkforce).toBe(0);
      expect(result.kpis.verificationQueue).toBe(0);
      expect(result.kpis.activeGrievances).toBe(0);
      expect(result.kpis.replacementVolume).toBe(0);
      expect(result.kpis.platformRevenueINR).toBe(0);
      expect(result.kpis.scheduledTrials).toBe(0);
      expect(result.kpis.policeVerifDue).toBeNull();
      expect(result.queues).toEqual([]);
    });

    it('throws contract error when a metric value in sections is negative or non-numeric', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          sections: {
            workers: {
              verifiedAndActive: -5,
            },
          },
        },
      });

      const repo = new RealDashboardRepository();
      await expect(repo.getSuperAdminDashboard()).rejects.toThrow(
        /Dashboard contract violation: invalid metric value for "activeWorkforce"/i
      );
    });
  });

  describe('Super Admin Dashboard Presentation UI with Real Data', () => {
    it('renders real KPI numbers and genuine empty queue state', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: 9999,
          activeWorkforce: 888,
          verificationQueue: 77,
          activeGrievances: 6,
          replacementVolume: 5,
          platformRevenueINR: 1234567,
          scheduledTrials: 4,
          policeVerifDue: 3,
        },
        queues: [],
      });

      renderSuperAdminDashboard();

      expect(await screen.findByText('9999')).toBeInTheDocument();
      expect(await screen.findByText('888')).toBeInTheDocument();
      expect(await screen.findByText('77')).toBeInTheDocument();
      expect(await screen.findByText(formatCurrencyINR(1234567))).toBeInTheDocument();

      // Empty queues notification is rendered
      expect(
        await screen.findByText(/No operational queues requiring executive attention at this time/i)
      ).toBeInTheDocument();

      // Ensure mock/fabricated records are NOT in the document
      expect(screen.queryByText('Worker Verification Backlog (42 pending)')).not.toBeInTheDocument();
      expect(screen.queryByText('Operational Verification Queue')).not.toBeInTheDocument();
      expect(screen.queryByText('Customer Grievances & Disputes')).not.toBeInTheDocument();
    });

    it('renders real queue items when provided by the backend API', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: 10,
          activeWorkforce: 20,
          verificationQueue: 2,
          activeGrievances: 1,
          replacementVolume: 1,
          platformRevenueINR: 5000,
          scheduledTrials: 2,
          policeVerifDue: 1,
        },
        queues: [
          {
            id: 'AUTH-REAL-101',
            type: 'GRIEVANCE',
            title: 'Actual Escalation from Live Ops',
            source: 'Live Escalation Queue',
            timing: '5 mins ago',
            status: 'ESCALATED',
            targetRoute: '/support',
            actionLabel: 'Inspect Escalation',
          },
        ],
      });

      renderSuperAdminDashboard();

      expect(await screen.findByText('Actual Escalation from Live Ops')).toBeInTheDocument();
      expect(await screen.findByText(/Source: Live Escalation Queue • 5 mins ago/i)).toBeInTheDocument();
      expect(screen.queryByText(/No operational queues requiring executive attention/i)).not.toBeInTheDocument();
    });

    it('displays explicit error state when API contract violation occurs (missing required fields)', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockRejectedValueOnce(
        new ServerFailureError('Dashboard contract violation: missing required metric "grossBookings".')
      );

      renderSuperAdminDashboard();

      expect(
        await screen.findByText('Dashboard contract violation: missing required metric "grossBookings".')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();

      // Zeroes or fake queues must NOT be rendered
      expect(screen.queryByText('Gross Bookings')).not.toBeInTheDocument();
      expect(screen.queryByText('LIVE-VQ')).not.toBeInTheDocument();
    });

    it('triggers refetch when Refresh Metrics button is clicked', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValue({
        kpis: {
          grossBookings: 100,
          activeWorkforce: 50,
          verificationQueue: 10,
          activeGrievances: 2,
          replacementVolume: 1,
          platformRevenueINR: 25000,
          scheduledTrials: 5,
          policeVerifDue: 1,
        },
        queues: [],
      });

      renderSuperAdminDashboard();

      // Initial fetch call
      expect(await screen.findByText('100')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(1);

      const refreshBtn = screen.getByRole('button', { name: /Refresh Metrics/i });
      await userEvent.click(refreshBtn);

      // Verify that getSuperAdminDashboard was refetched
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('displays clear error state on HTTP 401 Unauthorized without falling back to zeros', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockRejectedValueOnce(
        new UnauthorizedError('Session expired or unauthenticated.')
      );

      renderSuperAdminDashboard();

      expect(await screen.findByText('Session expired or unauthenticated.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      expect(screen.queryByText('Gross Bookings')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('displays clear error state on HTTP 403 Forbidden without falling back to zeros', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockRejectedValueOnce(
        new ForbiddenError('Action forbidden by server authorization policy.')
      );

      renderSuperAdminDashboard();

      expect(await screen.findByText('Action forbidden by server authorization policy.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      expect(screen.queryByText('Gross Bookings')).not.toBeInTheDocument();
    });

    it('displays clear error state on HTTP 500 Server Failure with working Retry button', async () => {
      const getSpy = vi.spyOn(dashboardRepository, 'getSuperAdminDashboard')
        .mockRejectedValueOnce(new ServerFailureError('Internal server error occurred.'))
        .mockResolvedValueOnce({
          kpis: {
            grossBookings: 50,
            activeWorkforce: 20,
            verificationQueue: 5,
            activeGrievances: 1,
            replacementVolume: 1,
            platformRevenueINR: 12000,
            scheduledTrials: 2,
            policeVerifDue: 0,
          },
          queues: [],
        });

      renderSuperAdminDashboard();

      expect(await screen.findByText('Internal server error occurred.')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      await userEvent.click(retryBtn);

      expect(await screen.findByText('50')).toBeInTheDocument();
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('renders dashboard with sections response: shows values for confirmed metrics and placeholder for missing metrics', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        kpis: {
          grossBookings: null,
          activeWorkforce: 9,
          verificationQueue: 2,
          activeGrievances: 2,
          replacementVolume: 0,
          platformRevenueINR: 3500,
          scheduledTrials: 1,
          policeVerifDue: null,
        },
        queues: [],
      });

      renderSuperAdminDashboard();

      // Confirmed metrics rendered
      expect(await screen.findByText('9')).toBeInTheDocument();
      const twos = await screen.findAllByText('2');
      expect(twos).toHaveLength(2);
      expect(await screen.findByText('0')).toBeInTheDocument();
      expect(await screen.findByText(formatCurrencyINR(3500))).toBeInTheDocument();
      expect(await screen.findByText('1')).toBeInTheDocument();

      // Missing/uncontracted metrics rendered as unavailable placeholder with explanatory subtitle
      const dashes = await screen.findAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Metric unavailable (pending contract definition)')).toBeInTheDocument();
      expect(screen.getByText('Metric unavailable in backend response')).toBeInTheDocument();

      // Genuine empty queues rendered
      expect(
        screen.getByText(/No operational queues requiring executive attention at this time/i)
      ).toBeInTheDocument();

      // Ensure no crash or violation text
      expect(screen.queryByText(/Dashboard contract violation/i)).not.toBeInTheDocument();
    });

    it('renders all granular backend sections: bookings by status, collections, workforce, complaints, alerts, and timestamp', async () => {
      vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
        generatedAt: '2026-10-15T06:31:28.064Z',
        kpis: {
          grossBookings: null,
          activeWorkforce: 9,
          verificationQueue: 2,
          activeGrievances: 2,
          replacementVolume: 0,
          platformRevenueINR: 485200,
          scheduledTrials: 1,
          policeVerifDue: null,
        },
        queues: [],
        sections: {
          bookings: {
            byStatus: [
              { status: 'ACTIVE', count: 2 },
              { status: 'CANCELLED', count: 1 },
              { status: 'COMPLETED', count: 3 },
              { status: 'CONFIRMED', count: 1 },
              { status: 'INTERVIEW_TRIAL_COMPLETED', count: 1 },
              { status: 'INTERVIEW_TRIAL_SCHEDULED', count: 1 },
              { status: 'MATCHED', count: 2 },
              { status: 'PENDING_PAYMENT', count: 2 },
              { status: 'REPLACEMENT_REQUESTED', count: 1 },
            ],
          },
          workers: {
            registered: 13,
            verifiedAndActive: 9,
          },
          pendingKyc: {
            submitted: 1,
            inReview: 1,
          },
          complaints: {
            open: 1,
            inProgress: 1,
            escalated: 0,
            unassigned: 1,
          },
          replacements: {
            requested: 0,
            approved: 1,
          },
          alerts: {
            open: 0,
            critical: 0,
            warning: 0,
          },
          collections: [
            {
              currency: 'INR',
              todayMinor: 0,
              monthToDateMinor: 48520000,
              todayINR: 0,
              monthToDateINR: 485200,
              todayFormatted: '₹0.00',
              monthToDateFormatted: '₹4,85,200.00',
            },
          ],
        },
      });

      renderSuperAdminDashboard();

      // 1. Snapshot timestamp in header
      expect(await screen.findByText(/Snapshot:/i)).toBeInTheDocument();

      // 2. Bookings by Status Section
      expect(screen.getByText('Marketplace Bookings by Status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Interview Trial Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Matched')).toBeInTheDocument();
      expect(screen.getByText('Pending Payment')).toBeInTheDocument();
      expect(screen.getByText('Replacement Requested')).toBeInTheDocument();

      // 3. Collections Section
      expect(screen.getByText('Collections & Financial Realization')).toBeInTheDocument();
      expect(screen.getByText('INR Currency Account')).toBeInTheDocument();
      expect(screen.getAllByText('₹4,85,200.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('View Financial Ledger')).toBeInTheDocument();

      // 4. Workforce & Trust Verification Tri-Panel
      expect(screen.getByText('Workforce & Trust Verification')).toBeInTheDocument();
      expect(screen.getByText('Registered Domestic Staff')).toBeInTheDocument();
      expect(screen.getByText('13')).toBeInTheDocument();

      // 5. Grievance Triage & Rematching
      expect(screen.getByText('Grievance Triage & Rematching')).toBeInTheDocument();
      expect(screen.getByText('Unassigned Complaints')).toBeInTheDocument();

      // 6. System Alerts & Health
      expect(screen.getByText('System Alerts & Platform Health')).toBeInTheDocument();
      expect(screen.getByText('ALL SYSTEMS OPERATIONAL')).toBeInTheDocument();
    });
  });

  describe('Isolation of Mock vs Real Modes', () => {
    it('ensures MockDashboardRepository is only instantiated when explicitly requested', () => {
      const mockRepo = createDashboardRepository(true);
      expect(mockRepo).toBeInstanceOf(MockDashboardRepository);

      const realRepo = createDashboardRepository(false);
      expect(realRepo).toBeInstanceOf(RealDashboardRepository);
    });

    it('ensures RealDashboardRepository never returns MockDashboardRepository static fixtures', async () => {
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('Network error'));

      const realRepo = new RealDashboardRepository();
      await expect(realRepo.getSuperAdminDashboard()).rejects.toThrow();

      // Under no circumstances does real repository catch an error and return mock data:
      const mockRepo = new MockDashboardRepository();
      const mockResult = await mockRepo.getSuperAdminDashboard();
      expect(mockResult.kpis.grossBookings).toBe(1420);
      expect(mockResult.kpis.platformRevenueINR).toBe(485200);
      expect(mockResult.queues[0].id).toBe('VQ-1048');
    });
  });
});
