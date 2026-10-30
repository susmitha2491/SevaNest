import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { RealVerificationRepository, verificationRepository } from '../features/verification/data/verificationRepository';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/verification') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Verification Executive: Queue Audit and Complete Application Retrieval Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: '01a12fa2-3c86-7560-aff4-2da59d4b0a9e',
        name: 'Verification Executive',
        email: 'verification.executive@sevanest.example.com',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
        ],
      },
      accessToken: 'test-token',
      isAuthenticated: true,
    });
  });

  it('1. All tab aggregates applications across all statuses and does not silently behave like Pending', async () => {
    const repo = new RealVerificationRepository();

    // Mock httpClient.get for queue calls
    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: unknown) => {
      if (url === '/admin/verification/queue') {
        const params = (config as { params?: Record<string, unknown> })?.params;
        const status = params?.status;

        if (status === undefined) {
          // Default queue: SUBMITTED and IN_REVIEW
          return {
            data: {
              data: [
                {
                  checkId: 'chk-sub-1',
                  workerId: 'wrk-001',
                  workerName: 'Verification Test Worker',
                  checkType: 'EMERGENCY_CONTACT',
                  status: 'SUBMITTED',
                  submittedAt: '2026-10-15T10:00:00Z',
                  applicationReference: 'SEVA00000014',
                },
                {
                  checkId: 'chk-sub-2',
                  workerId: 'wrk-001',
                  workerName: 'Verification Test Worker',
                  checkType: 'PREVIOUS_EMPLOYMENT',
                  status: 'SUBMITTED',
                  submittedAt: '2026-10-15T10:00:00Z',
                  applicationReference: 'SEVA00000014',
                },
                {
                  checkId: 'chk-sub-3',
                  workerId: 'wrk-002',
                  workerName: 'Vaish Application',
                  checkType: 'POLICE_VERIFICATION',
                  status: 'SUBMITTED',
                  submittedAt: '2026-10-16T10:00:00Z',
                  applicationReference: 'SEVA00000015',
                },
              ],
              meta: { page: 1, limit: 100, total: 3 },
            },
          } as never;
        }

        if (status === 'APPROVED') {
          return {
            data: {
              data: [
                {
                  checkId: 'chk-app-1',
                  workerId: 'wrk-003',
                  workerName: 'Sarojini Kolla',
                  checkType: 'IDENTITY',
                  status: 'APPROVED',
                  submittedAt: '2026-10-09T04:35:00Z',
                  applicationReference: 'SEVA00000001',
                },
                {
                  checkId: 'chk-app-2',
                  workerId: 'wrk-004',
                  workerName: 'Shabana Begum',
                  checkType: 'IDENTITY',
                  status: 'APPROVED',
                  submittedAt: '2026-10-09T04:36:00Z',
                  applicationReference: 'SEVA00000002',
                },
              ],
              meta: { page: 1, limit: 100, total: 2 },
            },
          } as never;
        }

        if (status === 'REJECTED' || status === 'NOT_SUBMITTED') {
          return { data: { data: [], meta: { page: 1, limit: 100, total: 0 } } } as never;
        }
      }
      return { data: { data: [] } } as never;
    });

    const result = await repo.getVerificationQueue({ status: 'ALL', page: 1, pageSize: 10 });

    // Should include wrk-001, wrk-002, wrk-003, wrk-004
    expect(result.totalCount).toBe(4);
    expect(result.items).toHaveLength(4);

    const workerNames = result.items.map((i) => i.workerName);
    expect(workerNames).toContain('Verification Test Worker');
    expect(workerNames).toContain('Vaish Application');
    expect(workerNames).toContain('Sarojini Kolla');
    expect(workerNames).toContain('Shabana Begum');

    // wrk-001 has 2 checks that collapsed into 1 application
    const testWorker = result.items.find((i) => i.workerId === 'wrk-001');
    expect(testWorker?.status).toBe('PENDING_REVIEW');
    expect(testWorker?.checkId).toBe('chk-sub-1');
  });

  it('2. Pending tab returns only applications with pending review status', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (_url: string, config?: unknown) => {
      const params = (config as { params?: Record<string, unknown> })?.params;
      expect(params?.status).toBe('SUBMITTED');

      return {
        data: {
          data: [
            {
              checkId: 'chk-sub-1',
              workerId: 'wrk-001',
              workerName: 'Verification Test Worker',
              checkType: 'EMERGENCY_CONTACT',
              status: 'SUBMITTED',
              submittedAt: '2026-10-15T10:00:00Z',
            },
            {
              checkId: 'chk-sub-2',
              workerId: 'wrk-002',
              workerName: 'Vaish Application',
              checkType: 'POLICE_VERIFICATION',
              status: 'SUBMITTED',
              submittedAt: '2026-10-16T10:00:00Z',
            },
          ],
          meta: { page: 1, limit: 10, total: 2 },
        },
      } as never;
    });

    const result = await repo.getVerificationQueue({ status: 'PENDING_REVIEW', page: 1, pageSize: 10 });
    expect(result.totalCount).toBe(2);
    expect(result.items.every((i) => i.status === 'PENDING_REVIEW')).toBe(true);
  });

  it('3. Approved tab returns approved applications with View Dossier action', async () => {
    vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
      items: [
        {
          id: 'wrk-003',
          workerId: 'wrk-003',
          workerName: 'Sarojini Kolla',
          category: 'House Maid',
          locality: 'Hyderabad',
          experienceYears: 4,
          phoneMasked: '+91 98765 *****',
          submissionTime: '2026-10-09T04:35:00Z',
          status: 'APPROVED',
          preCheckOtpVerified: true,
          checks: {},
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    renderWithProviders(<VerificationQueuePage defaultStatus="APPROVED" />, '/verification?status=APPROVED');

    expect(await screen.findByText('Sarojini Kolla')).toBeInTheDocument();
    const viewBtn = screen.getByRole('button', { name: /View Dossier/i });
    expect(viewBtn).toBeInTheDocument();
  });

  it('4. Re-Check Due tab handles gracefully without 400 error', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (_url: string, config?: unknown) => {
      const params = (config as { params?: Record<string, unknown> })?.params;
      // Must not send RECHECK_DUE to backend as backend returns 400
      expect(params?.status).not.toBe('RECHECK_DUE');
      return {
        data: {
          data: [],
          meta: { page: 1, limit: 10, total: 0 },
        },
      } as never;
    });

    const result = await repo.getVerificationQueue({ status: 'RECHECK_DUE', page: 1, pageSize: 10 });
    expect(result.totalCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('5. Deduplication prevents duplicate applications when worker has multiple checks', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: {
        data: [
          { checkId: 'chk-1', workerId: 'wrk-single', workerName: 'Test Worker', status: 'SUBMITTED', checkType: 'IDENTITY' },
          { checkId: 'chk-2', workerId: 'wrk-single', workerName: 'Test Worker', status: 'SUBMITTED', checkType: 'ADDRESS' },
          { checkId: 'chk-3', workerId: 'wrk-single', workerName: 'Test Worker', status: 'SUBMITTED', checkType: 'POLICE' },
          { checkId: 'chk-4', workerId: 'wrk-single', workerName: 'Test Worker', status: 'SUBMITTED', checkType: 'EMERGENCY' },
          { checkId: 'chk-5', workerId: 'wrk-single', workerName: 'Test Worker', status: 'SUBMITTED', checkType: 'EMPLOYMENT' },
        ],
        meta: { total: 5 },
      },
    } as never);

    const result = await repo.getVerificationQueue({ status: 'PENDING_REVIEW' });
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].workerId).toBe('wrk-single');
  });

  it('6. Slices pages correctly across loaded records according to pagination contract', async () => {
    const repo = new RealVerificationRepository();

    // 15 distinct worker checks
    const mockChecks = Array.from({ length: 15 }, (_, i) => ({
      checkId: `chk-${i + 1}`,
      workerId: `wrk-${i + 1}`,
      workerName: `Worker ${i + 1}`,
      status: 'SUBMITTED',
      checkType: 'IDENTITY',
      submittedAt: new Date(Date.now() - (15 - i) * 3600000).toISOString(),
    }));

    vi.spyOn(httpClient, 'get').mockResolvedValue({
      data: {
        data: mockChecks,
        meta: { total: 15 },
      },
    } as never);

    const page1 = await repo.getVerificationQueue({ status: 'ALL', page: 1, pageSize: 10 });
    expect(page1.totalCount).toBe(15);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0].workerName).toBe('Worker 1');

    const page2 = await repo.getVerificationQueue({ status: 'ALL', page: 2, pageSize: 10 });
    expect(page2.totalCount).toBe(15);
    expect(page2.totalPages).toBe(2);
    expect(page2.items).toHaveLength(5);
    expect(page2.items[0].workerName).toBe('Worker 11');
  });
});
