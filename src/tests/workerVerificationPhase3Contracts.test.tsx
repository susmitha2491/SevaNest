/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  RealVerificationRepository,
  MockVerificationRepository,
  verificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  VerificationQueuePage,
} from '../features/verification/presentation/VerificationQueuePage';
import { resolveClaimOwnership } from '../features/verification/domain/claimOwnership';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ConcurrencyConflictError, ValidationError } from '../core/errors/DomainError';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 3: Verification Claim Handling and Queue Filtering Contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'rev-current-user',
        name: 'Verification Officer',
        email: 'vo@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. My Reviews Server-Side Filtering (assignedTo=me)', () => {
    it('sends assignedTo=me query parameter in RealVerificationRepository', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          items: [],
          meta: { totalItems: 0, totalPages: 1, currentPage: 1 },
        },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.getVerificationQueue({ assignedTo: 'me' });

      expect(getSpy).toHaveBeenCalledWith('/admin/verification/queue', {
        params: expect.objectContaining({
          assignedTo: 'me',
        }),
      });
      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(calledParams.reviewerId).toBeUndefined();
    });

    it('filters by current user in MockVerificationRepository when assignedTo=me', async () => {
      useAuthStore.setState({
        user: {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 've@sevanest.local',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.VERIFICATION_REVIEW, PERMISSIONS.VERIFICATION_DECIDE],
        },
        isAuthenticated: true,
      });

      const repo = new MockVerificationRepository();
      const res = await repo.getVerificationQueue({ assignedTo: 'me' });

      expect(res.items.length).toBeGreaterThan(0);
      res.items.forEach((item) => {
        expect(item.reviewerUserId).toBe('adm-003');
      });
    });

    it('makes VerificationQueuePage call getVerificationQueue with assignedTo=me on My Reviews view', async () => {
      const queueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      renderWithProviders(<VerificationQueuePage viewMode="my-reviews" />, '/verification/my-reviews');

      expect(await screen.findByText(/Reviewer Assignment & Claim Scope:/i)).toBeInTheDocument();
      expect(screen.getByText(/assignedTo=me/i)).toBeInTheDocument();
      // Verifies old disclaimer is removed
      expect(screen.queryByText(/is pending backend contract enhancement/i)).not.toBeInTheDocument();

      // Verifies assignedTo: 'me' is passed to repository
      expect(queueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: 'me',
        })
      );
    });
  });

  describe('2. reviewerId and assignedTo Are Never Sent Together (HTTP 400 Prevention)', () => {
    it('strictly enforces mutual exclusion: reviewerId is never sent together with assignedTo=me', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: [], meta: { totalItems: 0 } },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.getVerificationQueue({ assignedTo: 'me', reviewerId: 'rev-uuid-123' });

      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(calledParams.assignedTo).toBe('me');
      expect(calledParams.reviewerId).toBeUndefined();
    });

    it('filters strictly by assignedTo=me in MockVerificationRepository even if reviewerId is also provided', async () => {
      useAuthStore.setState({
        user: {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 've@sevanest.local',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.VERIFICATION_REVIEW, PERMISSIONS.VERIFICATION_DECIDE],
        },
        isAuthenticated: true,
      });

      const repo = new MockVerificationRepository();
      const res = await repo.getVerificationQueue({ assignedTo: 'me', reviewerId: 'rev-uuid-123' });
      res.items.forEach((item) => {
        expect(item.reviewerUserId).toBe('adm-003');
      });
    });
  });

  describe('3. Claiming Uses Real checkId Only', () => {
    it('targets POST /admin/verification/checks/{checkId}/start-review with real checkId', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.claimCheck('chk-identity-8891');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-8891/start-review');
    });

    it('delegates claimDossier to claimCheck with valid checkId', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.claimDossier('VQ-101', 'chk-identity-8891');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-8891/start-review');
    });
  });

  describe('4. No Claim Request Occurs When Real checkId Is Unavailable', () => {
    it('rejects claimCheck when checkId is empty or undefined', async () => {
      const postSpy = vi.spyOn(httpClient, 'post');
      const repo = new RealVerificationRepository();

      await expect(repo.claimCheck('')).rejects.toThrow(ValidationError);
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('rejects claimDossier without checkId and refuses to fall back to dossierId or workerId', async () => {
      const postSpy = vi.spyOn(httpClient, 'post');
      const repo = new RealVerificationRepository();

      await expect(repo.claimDossier('VQ-101')).rejects.toThrow(ValidationError);
      await expect(repo.claimDossier('W-10482')).rejects.toThrow(ValidationError);
      await expect(repo.claimCheck('W-10482')).rejects.toThrow(ValidationError);
      await expect(repo.claimCheck('VQ-101')).rejects.toThrow(ValidationError);
      await expect(repo.claimCheck('APP-9011')).rejects.toThrow(ValidationError);

      expect(postSpy).not.toHaveBeenCalled();
    });

    it('renders disabled Claim Unavailable button in table row when queue item lacks checkId', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'q-row-1',
            workerId: 'W-991',
            workerName: 'Anita Roy',
            category: 'Cook',
            locality: 'Gachibowli',
            experienceYears: 3,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T10:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: {} as any,
            // checkId is deliberately omitted
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Anita Roy')).toBeInTheDocument();
      const claimBtn = screen.getByRole('button', { name: /Claim Unavailable/i });
      expect(claimBtn).toBeDisabled();
      expect(claimBtn).toHaveAttribute(
        'title',
        expect.stringContaining('checkId not provided in queue response')
      );
    });
  });

  describe('5. Successful Claim Proceeds to Dossier Workflow (Non-Optimistic)', () => {
    it('claims with real checkId and opens dossier only after success', async () => {
      const user = userEvent.setup();

      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'VQ-CLAIM-1',
            checkId: 'chk-identity-777',
            workerId: 'W-777',
            workerName: 'Gita Sharma',
            category: 'House Maid',
            locality: 'Kondapur',
            experienceYears: 5,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T10:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: {} as any,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
        id: 'VQ-CLAIM-1',
        checkId: 'chk-identity-777',
        workerId: 'W-777',
        workerName: 'Gita Sharma',
        category: 'House Maid',
        locality: 'Kondapur',
        experienceYears: 5,
        phoneMasked: '+91 *****',
        submissionTime: '2026-10-15T10:00:00Z',
        status: 'IN_REVIEW',
        reviewerUserId: 'rev-current-user',
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: {
            id: 'chk-identity-777',
            type: 'IDENTITY',
            title: 'Identity Proof',
            status: 'IN_REVIEW',
            evaluationMethod: 'DOCUMENT_INSPECTION',
          },
        } as any,
      });

      const claimCheckSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValueOnce();

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Gita Sharma')).toBeInTheDocument();
      // Dossier is not yet open
      expect(screen.queryByText(/Verification Dossier: Gita Sharma/i)).not.toBeInTheDocument();

      const claimBtn = screen.getByRole('button', { name: /Claim & Review/i });
      await user.click(claimBtn);

      // Verified: claimCheck called with real checkId
      expect(claimCheckSpy).toHaveBeenCalledWith('chk-identity-777');

      // Verified: dossier opens only after claim mutation resolves
      await waitFor(() => {
        expect(screen.getByText(/Verification Dossier: Gita Sharma/i)).toBeInTheDocument();
      });
    });
  });

  describe('6 & 7. 409 CHECK_ALREADY_ASSIGNED Conflict Handling', () => {
    it('does not open dossier optimistically when claim fails with 409 CHECK_ALREADY_ASSIGNED', async () => {
      const user = userEvent.setup();

      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
        items: [
          {
            id: 'VQ-CONFLICT-1',
            checkId: 'chk-identity-999',
            workerId: 'W-999',
            workerName: 'Rajesh Kumar',
            category: 'Driver',
            locality: 'Madhapur',
            experienceYears: 4,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T10:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: {} as any,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      // Simulate 409 ConcurrencyConflictError
      vi.spyOn(verificationRepository, 'claimCheck').mockRejectedValueOnce(
        new ConcurrencyConflictError('Check is already assigned to another reviewer.')
      );

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();
      const claimBtn = screen.getByRole('button', { name: /Claim & Review/i });
      await user.click(claimBtn);

      // Confirmed: User stays on the queue, dossier is NOT opened
      expect(screen.queryByText(/Verification Dossier: Rajesh Kumar/i)).not.toBeInTheDocument();

      // Confirmed: Informative alert displayed to user
      expect(
        await screen.findByText(/Another reviewer has already claimed this verification check/i)
      ).toBeInTheDocument();

      // Confirmed: No reassignment is offered
      expect(screen.queryByRole('button', { name: /Reassign/i })).not.toBeInTheDocument();
    });
  });

  describe('8 & 9. Claim Ownership Display and Reviewer Identity', () => {
    it('correctly resolves Unclaimed ownership when no reviewerUserId or claimedAt exist', () => {
      const ownership = resolveClaimOwnership(undefined, undefined, 'rev-current-user');
      expect(ownership.status).toBe('UNCLAIMED');
      expect(ownership.label).toBe('Unclaimed');
    });

    it('correctly resolves Claimed by you when reviewerUserId matches current user', () => {
      const ownership = resolveClaimOwnership('rev-current-user', '2026-10-15T08:00:00Z', 'rev-current-user');
      expect(ownership.status).toBe('CLAIMED_BY_YOU');
      expect(ownership.label).toBe('Claimed by you');
      expect(ownership.claimedAtFormatted).toBeDefined();
    });

    it('correctly resolves Claimed by another reviewer using real ID without fabricated names', () => {
      const ownership = resolveClaimOwnership('rev-other-88', '2026-10-15T08:00:00Z', 'rev-current-user');
      expect(ownership.status).toBe('CLAIMED_BY_OTHER');
      expect(ownership.label).toBe('Claimed by Reviewer (rev-other-88)');
      // Never fabricates a name like "Verification Executive" or invented person
      expect(ownership.label).not.toContain('Executive');
      expect(ownership.label).not.toContain('Sharma');
    });

    it('resolves neutral unavailable state when current user ID is not available', () => {
      const ownership = resolveClaimOwnership('rev-other-88', '2026-10-15T08:00:00Z', undefined);
      expect(ownership.status).toBe('UNAVAILABLE');
      expect(ownership.label).toContain('rev-other-88');
    });

    it('displays Claim Ownership column in queue table with real data', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'row-1',
            checkId: 'chk-1',
            workerId: 'W-01',
            workerName: 'Worker One',
            category: 'Maid',
            locality: 'Kondapur',
            experienceYears: 2,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T11:00:00Z',
            status: 'PENDING_REVIEW',
            reviewerUserId: undefined,
            claimedAt: undefined,
            preCheckOtpVerified: true,
            checks: {} as any,
          },
          {
            id: 'row-2',
            checkId: 'chk-2',
            workerId: 'W-02',
            workerName: 'Worker Two',
            category: 'Cook',
            locality: 'Madhapur',
            experienceYears: 4,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T11:30:00Z',
            status: 'IN_REVIEW',
            reviewerUserId: 'rev-current-user',
            claimedAt: '2026-10-15T12:00:00Z',
            preCheckOtpVerified: true,
            checks: {} as any,
          },
          {
            id: 'row-3',
            checkId: 'chk-3',
            workerId: 'W-03',
            workerName: 'Worker Three',
            category: 'Driver',
            locality: 'Gachibowli',
            experienceYears: 6,
            phoneMasked: '+91 *****',
            submissionTime: '2026-10-15T11:45:00Z',
            status: 'IN_REVIEW',
            reviewerUserId: 'rev-external-42',
            claimedAt: '2026-10-15T12:30:00Z',
            preCheckOtpVerified: true,
            checks: {} as any,
          },
        ],
        totalCount: 3,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Worker One')).toBeInTheDocument();
      expect(screen.getByText('Claim Ownership')).toBeInTheDocument();
      expect(screen.getByText('Unclaimed')).toBeInTheDocument();
      expect(screen.getByText('Claimed by you')).toBeInTheDocument();
      expect(screen.getByText('Claimed by Reviewer (rev-external-42)')).toBeInTheDocument();
    });
  });

  describe('10. Existing Individual Check Operations Remain Unaffected', () => {
    it('approves an individual check via POST /admin/verification/checks/{id}/approve', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.approveCheck('chk-identity-101', 'IDENTITY', 'Aadhaar authentic');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-101/approve', {
        remarks: 'Aadhaar authentic',
      });
    });

    it('rejects an individual check via POST /admin/verification/checks/{id}/reject', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.rejectCheck('chk-address-101', 'ADDRESS', 'BLURRY_IMAGE', 'Utility bill illegible');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-address-101/reject', {
        reasonCode: 'BLURRY_IMAGE',
        remarks: 'Utility bill illegible',
      });
    });

    it('requests recheck via POST /admin/verification/checks/{id}/recheck', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.requestReVerification('chk-police-101', ['POLICE_CLEARANCE'], 'Provide latest PCC');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-police-101/recheck', {
        remarks: 'Provide latest PCC',
      });
    });
  });
});
