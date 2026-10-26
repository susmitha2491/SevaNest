/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS, hasPermission } from '../core/rbac/permissions';
import { AuthRepositoryImpl } from '../features/auth/data/authRepository';
import { RealSupportRepository } from '../features/support/data/supportRepository';
import { RealDashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { RealBookingRepository } from '../features/bookings/data/bookingRepository';
import { httpClient } from '../core/api/httpClient';
import { mapHttpErrorToDomainError } from '../core/errors/errorMapper';
import { ConcurrencyConflictError } from '../core/errors/DomainError';
import { KPICard } from '../shared/components/KPICard/KPICard';
import { Clock } from 'lucide-react';

describe('Support Executive Contract Alignment & Backend Verifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Customer Permissions Canonical Key & RBAC Alignment', () => {
    it('uses canonical customer.view permission and aliases legacy customers.view', () => {
      expect(PERMISSIONS.CUSTOMER_VIEW).toBe('customer.view');
      expect(PERMISSIONS.CUSTOMERS_VIEW).toBe('customer.view');
      // customers.reveal_pii must not exist in approved RBAC
      expect((PERMISSIONS as Record<string, string>)['CUSTOMERS_REVEAL_PII']).toBeUndefined();
    });

    it('hasPermission evaluates canonical customer.view when user possesses customer.view or customers.view', () => {
      expect(hasPermission(['customer.view'], 'customer.view')).toBe(true);
      expect(hasPermission(['customers.view'], 'customer.view')).toBe(true);
      expect(hasPermission(['customer.view'], 'customers.view')).toBe(true);
      expect(hasPermission(['support.tickets.view'], 'customer.view')).toBe(false);
    });
  });

  describe('2. Admin Login URL Construction', () => {
    it('invokes /auth/admin/login without duplicating /api/v1 prefix', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            token: 'test-token',
            user: {
              id: 'adm-01',
              name: 'Support Exec',
              email: 'support@sevanest.internal',
              role: 'SUPPORT_EXECUTIVE',
              permissions: ['support.tickets.view', 'customer.view'],
            },
          },
        },
      } as any);

      const realAuth = new AuthRepositoryImpl();
      await realAuth.login({ email: 'support@sevanest.internal', password: 'Password123!' });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [calledUrl] = postSpy.mock.calls[0];
      expect(calledUrl).toBe('/auth/admin/login');
      expect(calledUrl).not.toContain('/api/v1');
    });
  });

  describe('3. Ticket Detail ETag Preservation and If-Match Concurrency Header', () => {
    it('preserves ETag from ticket detail response headers', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/messages')) {
          return { data: { success: true, data: [] } } as any;
        }
        return {
          headers: { etag: '"v4-hash-abc"' },
          data: {
            success: true,
            data: {
              id: 'TKT-991',
              status: 'OPEN',
              subject: 'Delayed response',
              description: 'Customer inquiry',
              creatorKind: 'CUSTOMER',
              creatorUserId: 'u-1',
              category: { id: 'c-1', name: 'General' },
              messages: [],
              createdAt: '2026-10-23T10:00:00Z',
            },
          },
        } as any;
      });

      const repo = new RealSupportRepository();
      const ticket = await repo.getTicketById('TKT-991');

      expect(ticket).not.toBeNull();
      expect(ticket?.etag).toBe('"v4-hash-abc"');
    });

    it('sends If-Match header with current ticket ETag during mutations', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { success: true } } as any);
      const repo = new RealSupportRepository();

      // Priority mutation with ETag
      await repo.setPriority('TKT-991', 'HIGH', '"v4-hash-abc"');
      expect(postSpy).toHaveBeenLastCalledWith(
        '/admin/support/tickets/TKT-991/priority',
        { priority: 'HIGH' },
        { headers: { 'If-Match': '"v4-hash-abc"' } }
      );

      // Resolution mutation with ETag
      await repo.resolveTicket('TKT-991', 'Issue resolved with customer', '"v4-hash-abc"');
      expect(postSpy).toHaveBeenLastCalledWith(
        '/admin/support/tickets/TKT-991/close',
        { resolution: 'Issue resolved with customer' },
        { headers: { 'If-Match': '"v4-hash-abc"' } }
      );

      // Escalation mutation with ETag
      await repo.escalateToOperations('TKT-991', 'Dispute requires manager arbitration', '"v4-hash-abc"');
      expect(postSpy).toHaveBeenLastCalledWith(
        '/admin/support/tickets/TKT-991/escalate',
        { reason: 'Dispute requires manager arbitration' },
        { headers: { 'If-Match': '"v4-hash-abc"' } }
      );

      // Assignment mutation with ETag
      await repo.assignTicket('TKT-991', {
        assigneeUserId: 'usr-44',
        note: 'Assigned to self',
        etag: '"v4-hash-abc"',
      });
      expect(postSpy).toHaveBeenLastCalledWith(
        '/admin/support/tickets/TKT-991/assign',
        { assigneeUserId: 'usr-44', note: 'Assigned to self' },
        { headers: { 'If-Match': '"v4-hash-abc"' } }
      );

      // Mutation without ETag does not send empty headers argument
      await repo.setPriority('TKT-991', 'LOW');
      expect(postSpy).toHaveBeenLastCalledWith(
        '/admin/support/tickets/TKT-991/priority',
        { priority: 'LOW' }
      );
    });
  });

  describe('4. Concurrency Conflict and Stale Version Error Mapping', () => {
    it('maps HTTP 412 (STALE_VERSION) to ConcurrencyConflictError with statusCode 412', () => {
      const err412 = {
        isAxiosError: true,
        response: {
          status: 412,
          data: {
            error: { code: 'STALE_VERSION', message: 'Ticket version has changed. Please refetch.' },
          },
        },
      };

      const domainErr = mapHttpErrorToDomainError(err412);
      expect(domainErr).toBeInstanceOf(ConcurrencyConflictError);
      expect((domainErr as ConcurrencyConflictError).statusCode).toBe(412);
      expect(domainErr.message).toContain('Please reload the latest data and retry');
    });

    it('maps HTTP 428 (PRECONDITION_REQUIRED) to ConcurrencyConflictError with statusCode 428', () => {
      const err428 = {
        isAxiosError: true,
        response: {
          status: 428,
          data: {
            error: { code: 'PRECONDITION_REQUIRED', message: 'If-Match header is mandatory.' },
          },
        },
      };

      const domainErr = mapHttpErrorToDomainError(err428);
      expect(domainErr).toBeInstanceOf(ConcurrencyConflictError);
      expect((domainErr as ConcurrencyConflictError).statusCode).toBe(428);
      expect(domainErr.message).toContain('If-Match');
    });
  });

  describe('5. Dashboard Complaints Metrics and Unknown SLA Handling', () => {
    it('uses actual complaints section from /admin/dashboard and sets unknown SLA to null', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/dashboard') {
          return {
            data: {
              success: true,
              data: {
                sections: {
                  complaints: {
                    open: 8,
                    inProgress: 3,
                    escalated: 2,
                    unassigned: 5,
                  },
                },
              },
            },
          } as any;
        }
        if (url === '/admin/support/tickets') {
          return {
            data: {
              success: true,
              data: [
                { id: 'T-1', status: 'OPEN', slaStatus: 'NORMAL' },
              ],
            },
          } as any;
        }
        throw new Error(`Unhandled url: ${url}`);
      });

      const repo = new RealDashboardRepository();
      const dashboard = await repo.getSupportExecutiveDashboard();

      expect(dashboard.kpis.openUnassignedGrievances).toBe(5);
      expect(dashboard.kpis.myActiveCases).toBe(3);
      // SLA-at-risk count must be null (not fabricated to 0) because backend does not provide it
      expect(dashboard.kpis.slaAtRiskCount).toBeNull();
      expect(dashboard.kpis.slaBreachedCount).toBe(2);
      expect(dashboard.kpis.resolvedTodayCount).toBeNull();
    });

    it('renders "—" in KPICard when metric value is null or undefined', () => {
      const { rerender } = render(
        <KPICard title="SLA At Risk" value={null} subtitle="Awaiting threshold definition" icon={Clock} />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();

      rerender(
        <KPICard title="SLA At Risk" value={undefined} subtitle="Awaiting threshold definition" icon={Clock} />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('6. Candidate Matching Contract (POST /api/v1/admin/matching/candidates)', () => {
    it('sends MatchRequirementDto to /admin/matching/candidates and maps CandidateView response', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          data: [
            {
              workerId: 'w-101',
              userId: 'u-101',
              name: 'Sunita Devi',
              experienceMonths: 48,
              categories: [{ id: 'cat-1', name: 'House Maid' }],
              languages: ['hi', 'te'],
              serviceAreas: [{ id: 'area-1', name: 'Kondapur' }],
              engagementPreference: 'FULL_TIME',
              availability: [],
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          ordering: 'SUBMITTED_ASC',
          ranked: false,
        },
      } as any);

      const repo = new RealBookingRepository();
      const candidates = await repo.matchCandidates({
        category: 'HOUSE_MAID',
        areaId: 'area-1',
        engagement: 'FULL_TIME',
        availableFrom: '09:00',
        availableTo: '17:00',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/matching/candidates', {
        category: 'HOUSE_MAID',
        areaId: 'area-1',
        engagement: 'FULL_TIME',
        availableFrom: '09:00',
        availableTo: '17:00',
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].workerId).toBe('w-101');
      expect(candidates[0].workerName).toBe('Sunita Devi');
      expect(candidates[0].isFullyVerified).toBe(true);
      expect(candidates[0].experienceYears).toBe(4);
    });
  });
});
