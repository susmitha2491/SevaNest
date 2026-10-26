/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealVerificationRepository } from '../features/verification/data/verificationRepository';
import { RealWorkerRepository, mapBackendWorkerToWorker, mapBackendWorkerDetailToWorkerDetail } from '../features/workers/data/workerRepository';
import { httpClient } from '../core/api/httpClient';
import { ConcurrencyConflictError, ServerFailureError, ValidationError } from '../core/errors/DomainError';

describe('Phase 1: Verification Repository and API Contract Fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Verification Queue Filter Mutual Exclusion & Parameter Forwarding', () => {
    it('forwards assignedTo=me and does not include reviewerId', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: [], meta: { totalItems: 0 } },
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

    it('forwards reviewerId and does not include assignedTo', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: [], meta: { totalItems: 0 } },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.getVerificationQueue({ reviewerId: 'rev-uuid-101' });

      expect(getSpy).toHaveBeenCalledWith('/admin/verification/queue', {
        params: expect.objectContaining({
          reviewerId: 'rev-uuid-101',
        }),
      });
      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(calledParams.assignedTo).toBeUndefined();
    });

    it('strictly enforces mutual exclusion when both assignedTo and reviewerId are provided', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: [], meta: { totalItems: 0 } },
      } as any);

      const repo = new RealVerificationRepository();
      // Caller inadvertently provides both
      await repo.getVerificationQueue({ assignedTo: 'me', reviewerId: 'rev-uuid-101' });

      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      // Never send both together; backend returns HTTP 400 if both are supplied
      expect(calledParams.assignedTo).toBe('me');
      expect(calledParams.reviewerId).toBeUndefined();
    });

    it('forwards categoryId, search, and pagination parameters correctly', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: [], meta: { totalItems: 0 } },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.getVerificationQueue({
        categoryId: 'cat-uuid-housemaid',
        searchTerm: 'Sunita',
        page: 2,
        pageSize: 15,
      });

      expect(getSpy).toHaveBeenCalledWith('/admin/verification/queue', {
        params: expect.objectContaining({
          categoryId: 'cat-uuid-housemaid',
          search: 'Sunita',
          page: 2,
          limit: 15,
        }),
      });
    });
  });

  describe('2. Queue Response Field Mapping (applicationSubmittedAt, reviewerUserId, claimedAt, workerName)', () => {
    it('maps applicationSubmittedAt, reviewerUserId, claimedAt, and workerName from queue response', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'chk-501',
              workerId: 'wrk-901',
              workerName: 'Pooja Sharma',
              category: 'Cook',
              status: 'IN_REVIEW',
              applicationSubmittedAt: '2026-10-15T09:30:00Z',
              reviewerUserId: 'rev-uuid-88',
              claimedAt: '2026-10-15T10:00:00Z',
              level: 'TIER_1',
            },
          ],
          meta: { totalItems: 1 },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const res = await repo.getVerificationQueue();

      expect(res.items).toHaveLength(1);
      const item = res.items[0];
      expect(item.workerId).toBe('wrk-901');
      expect(item.applicationId).toBe('wrk-901'); // real workerId used as application identity
      expect(item.workerName).toBe('Pooja Sharma');
      expect(item.applicationSubmittedAt).toBe('2026-10-15T09:30:00Z');
      expect(item.submissionTime).toBe('2026-10-15T09:30:00Z');
      expect(item.reviewerUserId).toBe('rev-uuid-88');
      expect(item.claimedAt).toBe('2026-10-15T10:00:00Z');
      expect(item.level).toBe('TIER_1');
    });
  });

  describe('3. Worker Identity (No Fabricated APP-... Identifiers)', () => {
    it('uses real workerId as applicationId without fabricating APP-... in workerRepository', () => {
      const worker = mapBackendWorkerToWorker({
        id: 'W-99881',
        fullName: 'Kavita Devi',
        category: 'House Maid',
      });

      expect(worker.id).toBe('W-99881');
      expect(worker.applicationId).toBe('W-99881');
      expect(worker.applicationId).not.toMatch(/^APP-/);
    });

    it('uses real workerId as applicationId in RealVerificationRepository.getDossierById', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'dossier-11',
            workerId: 'W-10482',
            workerName: 'Sunita Devi',
            level: 'VERIFIED',
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const dossier = await repo.getDossierById('W-10482');

      expect(dossier).not.toBeNull();
      expect(dossier?.workerId).toBe('W-10482');
      expect(dossier?.applicationId).toBe('W-10482');
      expect(dossier?.applicationId).not.toMatch(/^APP-/);
    });
  });

  describe('4. Overall Verification Status from Backend `level` Field', () => {
    it('maps level: "VERIFIED" to status: "APPROVED" in getDossierById', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'verif-1',
          workerId: 'W-10482',
          level: 'VERIFIED',
        },
      } as any);

      const repo = new RealVerificationRepository();
      const dossier = await repo.getDossierById('W-10482');

      expect(dossier?.level).toBe('VERIFIED');
      expect(dossier?.status).toBe('APPROVED');
    });

    it('maps level: "REJECTED" to status: "REJECTED" in getDossierById', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'verif-2',
          workerId: 'W-10483',
          level: 'REJECTED',
        },
      } as any);

      const repo = new RealVerificationRepository();
      const dossier = await repo.getDossierById('W-10483');

      expect(dossier?.level).toBe('REJECTED');
      expect(dossier?.status).toBe('REJECTED');
    });

    it('maps authoritative level field directly in mapBackendWorkerDetailToWorkerDetail', () => {
      const workerDetail = mapBackendWorkerDetailToWorkerDetail(
        { id: 'W-10482', fullName: 'Sunita Devi' },
        { level: 'VERIFIED' }
      );

      expect(workerDetail.verification.level).toBe('VERIFIED');
      expect(workerDetail.level).toBe('VERIFIED');
      expect(workerDetail.isFullyVerified).toBe(true);
    });

    it('treats level: "PENDING" as unverified without inferring from unrelated fields', () => {
      const workerDetail = mapBackendWorkerDetailToWorkerDetail(
        { id: 'W-10483', fullName: 'Ramesh Yadav' },
        { level: 'PENDING' }
      );

      expect(workerDetail.verification.level).toBe('PENDING');
      expect(workerDetail.isFullyVerified).toBe(false);
    });
  });

  describe('5. Worker Roster Query Parameters (verified=true / verified=false)', () => {
    it('sends verified=true when filtering by VERIFIED status', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { items: [] },
      } as any);

      const repo = new RealWorkerRepository();
      await repo.getWorkers({ verificationStatus: 'VERIFIED' });

      expect(getSpy).toHaveBeenCalledWith('/admin/workers', {
        params: expect.objectContaining({
          verified: true,
        }),
      });
      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(calledParams.onboardingStatus).toBeUndefined();
    });

    it('sends verified=false when filtering by unverified status', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { items: [] },
      } as any);

      const repo = new RealWorkerRepository();
      await repo.getWorkers({ verificationStatus: 'PENDING' });

      expect(getSpy).toHaveBeenCalledWith('/admin/workers', {
        params: expect.objectContaining({
          verified: false,
        }),
      });
      const calledParams = getSpy.mock.calls[0][1]?.params as Record<string, unknown>;
      expect(calledParams.onboardingStatus).toBeUndefined();
    });

    it('respects explicit verified boolean filter', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { items: [] },
      } as any);

      const repo = new RealWorkerRepository();
      await repo.getWorkers({ verified: true });

      expect(getSpy).toHaveBeenCalledWith('/admin/workers', {
        params: expect.objectContaining({
          verified: true,
        }),
      });
    });
  });

  describe('6. Signed Document Links & Document ID Handling', () => {
    it('requests signed URL using exact genuine documentId and preserves expiry metadata', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            url: 'https://vault.sevanest.internal/docs/aadhaar.pdf?sig=abc',
            signedUrl: 'https://vault.sevanest.internal/docs/aadhaar.pdf?sig=abc',
            expiresAt: '2026-10-16T15:00:00Z',
            expiresInSeconds: 3600,
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const link = await repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'doc-101');

      expect(getSpy).toHaveBeenCalledWith(
        '/admin/verification/documents/doc-101/link'
      );
      expect(link.url).toBe('https://vault.sevanest.internal/docs/aadhaar.pdf?sig=abc');
      expect(link.signedUrl).toBe('https://vault.sevanest.internal/docs/aadhaar.pdf?sig=abc');
      expect(link.expiresAt).toBe('2026-10-16T15:00:00Z');
      expect(link.expiresInSeconds).toBe(3600);
    });

    it('rejects missing or blank documentId with ValidationError and prevents API request', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const repo = new RealVerificationRepository();

      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', '')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', '   ')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', undefined)).rejects.toThrow(ValidationError);

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('never substitutes dossierId or checkType for a missing documentId', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const repo = new RealVerificationRepository();

      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'W-10482')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('VQ-101', 'IDENTITY', 'VQ-101')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'IDENTITY')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'VQ-999')).rejects.toThrow(ValidationError);

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('derives expiresAt from expiresInSeconds when expiresAt is absent', async () => {
      const now = 1792000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          url: 'https://vault.sevanest.internal/docs/pcc.pdf?sig=xyz',
          expiresInSeconds: 600,
        },
      } as any);

      const repo = new RealVerificationRepository();
      const link = await repo.getSignedDocumentUrl('W-10482', 'POLICE_CLEARANCE', 'doc-102');

      expect(link.signedUrl).toBe('https://vault.sevanest.internal/docs/pcc.pdf?sig=xyz');
      expect(link.expiresInSeconds).toBe(600);
      expect(link.expiresAt).toBe(new Date(now + 600 * 1000).toISOString());
    });

    it('throws ServerFailureError when no valid document URL is provided', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { success: false, data: {} },
      } as any);

      const repo = new RealVerificationRepository();
      await expect(
        repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'doc-missing')
      ).rejects.toThrow(ServerFailureError);
    });

    it('rejects unsafe or non-HTTP(S) URLs returned by the backend vault', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: { url: 'javascript:alert(document.cookie)' },
        },
      } as any);

      const repo = new RealVerificationRepository();
      await expect(
        repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'doc-xss')
      ).rejects.toThrow(ServerFailureError);
    });

    it('permits local development HTTP URLs on loopback addresses', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: { url: 'http://localhost:9000/vault/doc-103.pdf' },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const link = await repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'doc-103');
      expect(link.signedUrl).toBe('http://localhost:9000/vault/doc-103.pdf');
    });
  });

  describe('7. Claiming a Verification Check & Conflict Handling', () => {
    it('uses checkId when provided to call POST /admin/verification/checks/{checkId}/start-review', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.claimDossier('W-10482', 'chk-9912');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-9912/start-review');
    });

    it('maps HTTP 409 CHECK_ALREADY_ASSIGNED to ConcurrencyConflictError', async () => {
      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 409,
          data: {
            code: 'CHECK_ALREADY_ASSIGNED',
            message: 'This check is already claimed by another reviewer.',
          },
        },
      });

      const repo = new RealVerificationRepository();
      await expect(repo.claimDossier('W-10482', 'chk-assigned')).rejects.toThrow(
        ConcurrencyConflictError
      );
    });
  });
});
