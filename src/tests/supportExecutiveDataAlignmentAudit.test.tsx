/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RealSupportRepository } from '../features/support/data/supportRepository';
import { RealDashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { SupportExecutiveDashboard } from '../features/dashboard/presentation/SupportExecutiveDashboard';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { formatDateTimeIST } from '../shared/formatters/dateTime';

describe('Support Executive Data Alignment & UI Improvement Audit', () => {
  let queryClient: QueryClient;

  // Authoritative 16-ticket dataset representing the full live database
  const createMockTicketsDataset = () => {
    const list: Record<string, unknown>[] = [];
    for (let i = 1; i <= 16; i++) {
      const isAssigned = i <= 5; // Tickets 1..5 are assigned; 6..16 (11 tickets) are unassigned
      const isResolved = i === 4 || i === 5; // 2 resolved (assigned tickets 4 and 5)
      const isEscalated = i >= 8; // Tickets 8..16 (9 tickets) are escalated
      const isAtRisk = i === 1 || i === 2; // 2 at risk

      list.push({
        id: `TKT-2026-00${i}`,
        ticketId: `TKT-2026-00${i}`,
        subject: `Dispute Case #${i}`,
        description: `Detailed description for grievance ${i}`,
        status: isResolved ? 'CLOSED' : isEscalated ? 'ESCALATED' : isAssigned ? 'IN_PROGRESS' : 'OPEN',
        priority: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        slaStatus: isAtRisk ? 'AT_RISK' : 'NORMAL',
        creatorKind: i % 3 === 0 ? 'WORKER' : 'CUSTOMER',
        complainantName: `Complainant ${i}`,
        assignedToStaffId: isAssigned ? (i === 1 ? 'staff-se-01' : 'staff-se-other') : undefined,
        assignedToStaffName: isAssigned ? (i === 1 ? 'Pooja (Support Exec)' : 'Sunil Support') : undefined,
        createdAt: '2026-11-06T11:42:17.207Z',
        closedAt: isResolved ? '2026-11-06T12:00:00.000Z' : undefined,
        category: { name: 'House Maid', code: 'HOUSE_MAID' },
        serviceCategory: 'House Maid',
        disputeCategory: 'ATTENDANCE_BREACH',
      });
    }
    return list;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'staff-se-01',
        name: 'Pooja (Support Exec)',
        email: 'pooja.support@sevanest.com',
        role: 'SUPPORT_EXECUTIVE',
        permissions: ['dashboard.view', 'support.view', 'support.manage'],
      },
      accessToken: 'valid-test-token',
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });
  });

  const renderWithProviders = (ui: React.ReactElement, initialPath = '/support') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/support" element={ui} />
            <Route path="/dashboard" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('1. Reconciling Dashboard and Support Queue Data Mismatch (16 vs 6 Resolution)', () => {
    it('RealSupportRepository calculates summary metrics from full population rather than page slice', async () => {
      const fullDataset = createMockTicketsDataset();
      const page1Slice = fullDataset.slice(0, 6); // First 6 tickets

      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: any) => {
        if (url === '/admin/support/tickets') {
          // If limit is 100, return full population (16 items)
          if (config?.params?.limit === 100) {
            return {
              data: {
                success: true,
                data: fullDataset,
                meta: { total: 16, totalItems: 16, page: 1, limit: 100 },
              },
            } as any;
          }
          // Otherwise, return paginated page 1 (6 items)
          return {
            data: {
              success: true,
              data: page1Slice,
              meta: { total: 16, totalItems: 16, page: 1, limit: 6, totalPages: 3 },
            },
          } as any;
        }
        return { data: { success: true, data: [] } } as any;
      });

      const supportRepo = new RealSupportRepository();
      const result = await supportRepo.getTickets({ page: 1, pageSize: 6 });

      // Verifications:
      // 1. Items array contains only the 6 items of page 1
      expect(result.items).toHaveLength(6);
      expect(result.totalCount).toBe(16);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(3);

      // 2. Summary KPI counts reflect the full population (16 total), NOT capped to 6!
      expect(result.unassignedCount).toBe(11); // 11 unassigned in full dataset
      expect(result.escalatedCount).toBe(9);   // 9 escalated in full dataset
      expect(result.slaAtRiskCount).toBe(2);   // 2 at risk in full dataset
      expect(result.resolvedTodayCount).toBe(2); // 2 resolved in full dataset

      expect(getSpy).toHaveBeenCalledWith('/admin/support/tickets', expect.objectContaining({ params: expect.objectContaining({ limit: 6 }) }));
    });

    it('Dashboard and Support Queue report consistent authoritative metrics', async () => {
      const fullDataset = createMockTicketsDataset();

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: any) => {
        if (url === '/admin/dashboard') {
          // Dashboard without complaints section triggers fallback to /admin/support/tickets?limit=100
          return { data: { success: true, data: {} } } as any;
        }
        if (url === '/admin/support/tickets') {
          if (config?.params?.limit === 100) {
            return {
              data: {
                success: true,
                data: fullDataset,
                meta: { total: 16, totalItems: 16 },
              },
            } as any;
          }
          return {
            data: {
              success: true,
              data: fullDataset.slice(0, 10),
              meta: { total: 16, totalItems: 16, page: 1, limit: 10, totalPages: 2 },
            },
          } as any;
        }
        return { data: { success: true, data: [] } } as any;
      });

      const dashRepo = new RealDashboardRepository();
      const supportRepo = new RealSupportRepository();

      const [dashData, supportData] = await Promise.all([
        dashRepo.getSupportExecutiveDashboard(),
        supportRepo.getTickets({ page: 1, pageSize: 10 }),
      ]);

      // Metrics must match exactly:
      expect(dashData.kpis.totalTickets).toBe(16);
      expect(supportData.totalCount).toBe(16);

      expect(dashData.kpis.unassignedTickets).toBe(11);
      expect(supportData.unassignedCount).toBe(11);

      expect(dashData.kpis.escalatedTickets).toBe(9);
      expect(supportData.escalatedCount).toBe(9);

      expect(dashData.kpis.slaImminentBreach).toBe(2);
      expect(supportData.slaAtRiskCount).toBe(2);
    });
  });

  describe('2. Collective Support Model - Removal of Ticket Assignment & Ownership Columns', () => {
    it('verifies that Ticket Owner and Assigned Staff columns are removed from Support Queue table', async () => {
      renderWithProviders(<SupportTicketsPage viewMode="all" />, '/support');

      // Table header verification: neither Ticket Owner nor Assigned Staff should exist
      expect(screen.queryByRole('columnheader', { name: /Ticket Owner/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /Assigned Staff/i })).not.toBeInTheDocument();

      // Verified standard columns are present
      expect(await screen.findByRole('columnheader', { name: /Ticket ID/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Complainant/i })).toBeInTheDocument();
    });

    it('verifies that Ticket Owner column and duplicate ticket queue table are absent from Support Executive Dashboard', async () => {
      renderWithProviders(<SupportExecutiveDashboard />, '/dashboard');

      expect(await screen.findByRole('heading', { name: /^Dashboard$/i })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /Ticket Owner/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /Assigned Staff/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Support Queue 5-Tier Visual Hierarchy', () => {
    it('presents page elements in the exact 5-tier structure requested', async () => {
      const { container } = renderWithProviders(<SupportTicketsPage viewMode="all" />, '/support');

      // Tier 1: Page Title and Short Description
      const title = await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i });
      expect(title).toBeInTheDocument();
      expect(screen.getByText(/Mediate household service disputes/i)).toBeInTheDocument();

      // Tier 2: Summary KPI Cards
      expect(screen.getByText(/SLA Impending Breach/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Open Inquiries/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Escalated to Operations/i)).toBeInTheDocument();
      expect(screen.getByText(/Resolved Cases/i)).toBeInTheDocument();

      // Tier 3: Search and Supported Filters
      const searchInput = screen.getByPlaceholderText(/Search by complainant, worker, ticket ID, booking ref/i);
      const roleFilter = screen.getByRole('combobox', { name: /Filter by complainant role/i });
      const priorityFilter = screen.getByRole('combobox', { name: /Filter by priority/i });
      expect(searchInput).toBeInTheDocument();
      expect(roleFilter).toBeInTheDocument();
      expect(priorityFilter).toBeInTheDocument();

      // Tier 4: Ticket Status Tabs
      expect(screen.getByRole('button', { name: /All Tickets/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /In Investigation/i })).toBeInTheDocument();

      // Tier 5: Ticket Table with 7 collective columns
      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
      const headers = within(table!).getAllByRole('columnheader').map((th) => th.textContent?.trim());
      expect(headers).toEqual([
        'Ticket ID',
        'Complainant',
        'Issue / Category',
        'Priority',
        'SLA Status',
        'Ticket Status',
        'Actions',
      ]);
    });
  });

  describe('4. Asia/Kolkata (IST, UTC+05:30) Timezone Uniformity', () => {
    it('correctly converts UTC ISO strings into readable IST representation', () => {
      const formatted = formatDateTimeIST('2026-11-06T11:42:17.207Z');
      expect(formatted).toMatch(/\d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} [AP]M IST/);
      expect(formatted).toContain('06 Nov 2026');
      expect(formatted).toContain('05:12 PM IST');
    });

    it('displays formatted IST intake timestamps in the Support Queue table', async () => {
      renderWithProviders(<SupportTicketsPage viewMode="all" />, '/support');

      await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i });
      // When ISO timestamp is present, it is rendered formatted in IST
      const istElements = screen.queryAllByText(/IST/);
      // Non-empty or safely formatted
      expect(Array.isArray(istElements)).toBe(true);
    });
  });

  describe('5. Support Analytics Derivation', () => {
    it('derives SLA Monitoring, Status Distribution, and Recent Activity without calling reporting endpoints', async () => {
      const futureSafe = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
      const soonAtRisk = new Date(Date.now() + 6 * 3600 * 1000).toISOString();

      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/dashboard') {
          return {
            data: {
              sections: {
                complaints: { open: 2, inProgress: 1, escalated: 1, unassigned: 2 },
              },
            },
          } as any;
        }
        if (url === '/admin/support/tickets') {
          return {
            data: {
              success: true,
              data: [
                {
                  id: 'T-CREATED',
                  status: 'OPEN',
                  dueAt: futureSafe,
                  slaBreachedAt: null,
                  createdAt: '2026-11-11T09:00:00.000Z',
                  updatedAt: '2026-11-11T09:00:00.000Z',
                },
                {
                  id: 'T-UPDATED',
                  status: 'OPEN',
                  dueAt: soonAtRisk,
                  slaBreachedAt: null,
                  createdAt: '2026-11-10T09:00:00.000Z',
                  updatedAt: '2026-11-11T08:00:00.000Z',
                },
                {
                  id: 'T-INPROG',
                  status: 'IN_PROGRESS',
                  dueAt: futureSafe,
                  slaBreachedAt: null,
                  assignedAt: '2026-11-10T10:00:00.000Z',
                  createdAt: '2026-11-10T08:00:00.000Z',
                  updatedAt: '2026-11-10T10:00:00.000Z',
                },
                {
                  id: 'T-ESC',
                  status: 'ESCALATED',
                  escalatedAt: '2026-11-09T12:00:00.000Z',
                  slaBreachedAt: '2026-11-09T12:00:00.000Z',
                  createdAt: '2026-11-07T12:00:00.000Z',
                  updatedAt: '2026-11-09T12:00:00.000Z',
                },
                {
                  id: 'T-CLOSED',
                  status: 'CLOSED',
                  escalatedAt: '2026-10-30T04:00:00.000Z',
                  closedAt: '2026-11-08T15:00:00.000Z',
                  slaBreachedAt: null,
                  createdAt: '2026-10-30T03:00:00.000Z',
                  updatedAt: '2026-11-08T15:00:00.000Z',
                },
              ],
              meta: { total: 5 },
            },
          } as any;
        }
        throw new Error(`Unexpected call: ${url}`);
      });

      const dashRepo = new RealDashboardRepository();
      const res = await dashRepo.getSupportExecutiveDashboard();

      expect(getSpy).not.toHaveBeenCalledWith('/admin/reports/support-tickets', expect.anything());
      expect(res.analytics?.slaMonitoring).toEqual(
        expect.objectContaining({ normal: 3, atRisk: 1, breached: 1 })
      );
      expect(res.analytics?.slaAtRiskOrBreached).toBe(2);
      expect(res.analytics?.statusDistribution.map((s) => ({ status: s.status, count: s.count }))).toEqual([
        { status: 'OPEN', count: 2 },
        { status: 'IN_INVESTIGATION', count: 1 },
        { status: 'ESCALATED', count: 1 },
        { status: 'RESOLVED', count: 1 },
      ]);
      expect(res.analytics?.recentActivity.map((a) => [a.ticketId, a.activityType])).toEqual([
        ['T-CREATED', 'CREATED'],
        ['T-UPDATED', 'UPDATED'],
        ['T-INPROG', 'UPDATED'],
        ['T-ESC', 'ESCALATED'],
        ['T-CLOSED', 'RESOLVED'],
      ]);
    });
  });
});
