import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  verificationRepository,
  RealVerificationRepository,
  clearWorkerEnrichmentCache,
  mapChecks,
} from '../features/verification/data/verificationRepository';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import {
  getVerificationProgressStage,
  getNextActionDescription,
} from '../features/verification/domain/verificationWorkflow';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier } from '../features/verification/domain/types';

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

const buildHyyDossier = (overrides?: Partial<VerificationDossier>): VerificationDossier => ({
  id: '01a21242-5b6b-76bd-a126-094762056d18',
  workerId: '01a21242-5b6b-76bd-a126-094762056d18',
  applicationId: 'SEVA00000052',
  workerName: 'Hyy',
  category: 'House Maid',
  locality: 'Hyderabad',
  experienceYears: 3,
  phoneMasked: '+91 98*** *****',
  submissionTime: '2026-11-25T10:31:08.395Z',
  status: 'IN_REVIEW',
  level: 'VERIFIED',
  applicationStatus: 'UNDER_REVIEW',
  preCheckOtpVerified: true,
  requiredChecks: ['IDENTITY'],
  checks: mapChecks([
    { checkType: 'IDENTITY', checkId: 'chk-hyy-id', status: 'APPROVED', required: true },
    { checkType: 'ADDRESS', checkId: 'chk-hyy-addr', status: 'APPROVED', required: false },
    { checkType: 'EMERGENCY_CONTACT', checkId: 'chk-hyy-ec', status: 'APPROVED', required: false },
    { checkType: 'PREVIOUS_EMPLOYMENT', checkId: '', status: 'NOT_SUBMITTED', required: false },
    { checkType: 'POLICE_VERIFICATION', checkId: 'chk-hyy-pcc', status: 'APPROVED', required: false },
    { checkType: 'SKILL_CERTIFICATE', checkId: 'chk-hyy-skill', status: 'APPROVED', required: false },
    { checkType: 'LICENSE', checkId: '', status: 'NOT_SUBMITTED', required: false },
  ]),
  ...overrides,
});

describe('Worker Verification Queue Final Approval Status & Stage Accuracy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearWorkerEnrichmentCache();
    useAuthStore.setState({
      user: {
        id: 'adm-supervisor',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.WORKER_ACTIVATE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  afterEach(() => {
    clearWorkerEnrichmentCache();
  });

  it('1. Mandatory checks approved with signedOffAt=null and UNDER_REVIEW must NOT mark queue as Approved', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: unknown) => {
      if (url === '/admin/workers') {
        return {
          data: {
            data: [
              {
                id: 'w-hyy',
                name: 'Hyy',
                applicationStatus: 'UNDER_REVIEW',
                verificationLevel: 'VERIFIED',
                isFullyVerified: true,
                signedOffAt: null,
                activatedAt: null,
                categories: [{ name: 'House Maid' }],
              },
            ],
          },
        } as never;
      }
      if (url === '/admin/verification/queue') {
        const statusParam = (config as { params?: { status?: string } })?.params?.status;
        if (statusParam === 'APPROVED') {
          return {
            data: {
              data: [
                {
                  checkId: 'chk-hyy-id',
                  workerId: 'w-hyy',
                  workerName: 'Hyy',
                  checkType: 'IDENTITY',
                  status: 'APPROVED',
                  submittedAt: '2026-11-25T10:31:08Z',
                },
              ],
              meta: { total: 1, totalPages: 1 },
            },
          } as never;
        }
        return { data: { data: [], meta: { total: 0, totalPages: 1 } } } as never;
      }
      return { data: { data: [] } } as never;
    });

    const allQueue = await repo.getVerificationQueue({ status: 'ALL', page: 1, pageSize: 10 });
    expect(allQueue.items).toHaveLength(1);
    const hyyQueueItem = allQueue.items[0];

    expect(hyyQueueItem.status).toBe('IN_REVIEW');
    expect(hyyQueueItem.status).not.toBe('APPROVED');
    expect(hyyQueueItem.applicationStatus).toBe('UNDER_REVIEW');
    expect(hyyQueueItem.signedOffAt).toBeUndefined();

    // Stage and Next Action reflect awaiting final approval rather than completed sign-off
    const stage = getVerificationProgressStage(hyyQueueItem);
    const nextAction = getNextActionDescription(hyyQueueItem);
    expect(stage.stage).toBe('Awaiting Final Approval');
    expect(stage.stage).not.toBe('Approved & Signed Off');
    expect(nextAction).toBe('Pending Final Approval');
    expect(nextAction).not.toBe('Verification Completed');

    // Approved filter tab must NOT list unsigned-off worker
    const approvedTabQueue = await repo.getVerificationQueue({ status: 'APPROVED', page: 1, pageSize: 10 });
    expect(approvedTabQueue.items).toHaveLength(0);
  });

  it('2. Final approval confirmed by backend (signedOffAt & ACTIVE) marks queue Approved / Approved & Signed Off / Verification Completed', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: unknown) => {
      if (url === '/admin/workers') {
        return {
          data: {
            data: [
              {
                id: 'w-radha',
                name: 'Radha',
                applicationStatus: 'ACTIVE',
                verificationLevel: 'VERIFIED',
                isFullyVerified: true,
                signedOffAt: '2026-11-25T09:52:17.489Z',
                activatedAt: '2026-11-25T09:52:17.895Z',
                categories: [{ name: 'Cook' }],
              },
            ],
          },
        } as never;
      }
      if (url === '/admin/verification/queue') {
        const statusParam = (config as { params?: { status?: string } })?.params?.status;
        if (statusParam === 'APPROVED') {
          return {
            data: {
              data: [
                {
                  checkId: 'chk-radha-id',
                  workerId: 'w-radha',
                  workerName: 'Radha',
                  checkType: 'IDENTITY',
                  status: 'APPROVED',
                  submittedAt: '2026-11-25T09:00:00Z',
                },
              ],
              meta: { total: 1, totalPages: 1 },
            },
          } as never;
        }
        return { data: { data: [], meta: { total: 0, totalPages: 1 } } } as never;
      }
      return { data: { data: [] } } as never;
    });

    const allQueue = await repo.getVerificationQueue({ status: 'ALL', page: 1, pageSize: 10 });
    expect(allQueue.items[0].status).toBe('APPROVED');
    expect(getVerificationProgressStage(allQueue.items[0]).stage).toBe('Approved & Signed Off');
    expect(getNextActionDescription(allQueue.items[0])).toBe('Verification Completed');
  });

  it('3. Optional checks marked Not Required do not block final approval in Step 5', async () => {
    const user = userEvent.setup();
    const hyyDossier = buildHyyDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(hyyDossier);
    const finalApproveSpy = vi.spyOn(verificationRepository, 'approveApplicationAndOnboardWorker').mockResolvedValue({
      success: true,
      workerId: hyyDossier.workerId,
      status: 'ACTIVE',
      activated: true,
      signedOff: true,
    });

    renderWithProviders(
      <WorkerVerificationReviewModal
        dossierId={hyyDossier.workerId}
        initialDossier={hyyDossier}
        onClose={vi.fn()}
      />
    );

    const step5Bubble = await screen.findByTestId('step-bubble-5');
    await user.click(step5Bubble);

    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    const approveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
    expect(approveBtn).toBeEnabled();

    await user.click(approveBtn);
    await user.click(await screen.findByRole('button', { name: /Confirm Final Approval/i }));

    await waitFor(() => {
      expect(finalApproveSpy).toHaveBeenCalledWith(hyyDossier.workerId, expect.any(String));
    });
  });

  it('4. Rejected / ACTION_REQUIRED workers retain REJECTED status and Corrections Required stage', async () => {
    const repo = new RealVerificationRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: unknown) => {
      if (url === '/admin/workers') {
        return {
          data: {
            data: [
              {
                id: 'w-angel',
                name: 'Angel',
                applicationStatus: 'ACTION_REQUIRED',
                verificationLevel: 'IN_PROGRESS',
                isFullyVerified: false,
                signedOffAt: null,
                activatedAt: null,
                categories: [{ name: 'House Maid' }],
              },
            ],
          },
        } as never;
      }
      if (url === '/admin/verification/queue') {
        const statusParam = (config as { params?: { status?: string } })?.params?.status;
        if (statusParam === 'REJECTED') {
          return {
            data: {
              data: [
                {
                  checkId: 'chk-angel-id',
                  workerId: 'w-angel',
                  workerName: 'Angel',
                  checkType: 'IDENTITY',
                  status: 'REJECTED',
                  submittedAt: '2026-11-24T10:00:00Z',
                },
              ],
              meta: { total: 1, totalPages: 1 },
            },
          } as never;
        }
        return { data: { data: [], meta: { total: 0, totalPages: 1 } } } as never;
      }
      return { data: { data: [] } } as never;
    });

    const queue = await repo.getVerificationQueue({ status: 'ALL', page: 1, pageSize: 10 });
    expect(queue.items[0].status).toBe('REJECTED');
    expect(getVerificationProgressStage(queue.items[0]).stage).toBe('Corrections Required');
    expect(getNextActionDescription(queue.items[0])).toBe('Review Corrections');
  });

  it('5. Queue updates from Awaiting Final Approval to Approved only after successful sign-off, and stays unapproved on API failure', async () => {
    const user = userEvent.setup();
    let isSignedOffOnBackend = false;

    vi.spyOn(verificationRepository, 'getVerificationQueue').mockImplementation(async () => ({
      items: [
        buildHyyDossier({
          status: isSignedOffOnBackend ? 'APPROVED' : 'IN_REVIEW',
          applicationStatus: isSignedOffOnBackend ? 'ACTIVE' : 'UNDER_REVIEW',
          signedOffAt: isSignedOffOnBackend ? '2026-11-25T11:00:00Z' : undefined,
        }),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }));

    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () =>
      buildHyyDossier({
        status: isSignedOffOnBackend ? 'APPROVED' : 'IN_REVIEW',
        applicationStatus: isSignedOffOnBackend ? 'ACTIVE' : 'UNDER_REVIEW',
        signedOffAt: isSignedOffOnBackend ? '2026-11-25T11:00:00Z' : undefined,
      })
    );

    const onboardSpy = vi
      .spyOn(verificationRepository, 'approveApplicationAndOnboardWorker')
      .mockRejectedValueOnce(new Error('Sign-off service temporarily unavailable'))
      .mockImplementationOnce(async () => {
        isSignedOffOnBackend = true;
        return {
          success: true,
          workerId: '01a21242-5b6b-76bd-a126-094762056d18',
          status: 'ACTIVE',
          activated: true,
          signedOff: true,
        };
      });

    renderWithProviders(<VerificationQueuePage />);

    // Initially: In review / Awaiting Final Approval / Pending Final Approval
    const hyyRow = (await screen.findByText('Hyy')).closest('tr')!;
    expect(within(hyyRow).getByText('Awaiting Final Approval')).toBeInTheDocument();
    expect(within(hyyRow).getByText('In review')).toBeInTheDocument();
    expect(within(hyyRow).getByText('Pending Final Approval')).toBeInTheDocument();
    expect(within(hyyRow).queryByText('Approved & Signed Off')).not.toBeInTheDocument();
    expect(within(hyyRow).queryByText('Verification Completed')).not.toBeInTheDocument();

    // Open dossier and attempt Final Approval that fails on backend
    await user.click(hyyRow);
    await user.click(await screen.findByTestId('step-bubble-5'));
    await user.click(await screen.findByRole('button', { name: /Approve Verification Worker/i }));
    await user.click(await screen.findByRole('button', { name: /Confirm Final Approval/i }));

    expect(await screen.findByText(/Sign-off service temporarily unavailable/i)).toBeInTheDocument();
    // Queue row remains unapproved after API failure
    const rowAfterFailure = within(screen.getByRole('table')).getByText('Hyy').closest('tr')!;
    expect(within(rowAfterFailure).getByText('Awaiting Final Approval')).toBeInTheDocument();
    expect(within(rowAfterFailure).queryByText('Approved & Signed Off')).not.toBeInTheDocument();

    // Retry Final Approval -> succeeds on backend -> queue updates to Approved & Signed Off
    await user.click(screen.getByRole('button', { name: /Confirm Final Approval/i }));

    await waitFor(() => {
      expect(onboardSpy).toHaveBeenCalledTimes(2);
      const updatedRow = within(screen.getByRole('table')).getByText('Hyy').closest('tr')!;
      expect(within(updatedRow).getByText('Approved & Signed Off')).toBeInTheDocument();
      expect(within(updatedRow).getByText('Verification Completed')).toBeInTheDocument();
      expect(within(updatedRow).getByText('Approved')).toBeInTheDocument();
    });
  });
});

