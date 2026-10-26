/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  RealVerificationRepository,
  verificationRepository,
  normalizeCheckType,
  mapCheckStatus,
  mapChecks,
} from '../features/verification/data/verificationRepository';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { ValidationError, ServerFailureError } from '../core/errors/DomainError';

function renderWithProviders(ui: React.ReactElement, initialEntries = ['/verification']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/verification" element={ui} />
          <Route path="/workers" element={<div data-testid="workers-page">Workers</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 1: Worker Verification Integration Fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-exec-01',
        name: 'Verification Executive',
        email: 'exec@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          'verification.view',
          'verification.review',
          'verification.decide',
          'verification.document.view',
        ],
      },
      accessToken: 'jwt-token-exec',
      isAuthenticated: true,
    });
  });

  describe('1. Worker and Check Identifier Separation & 404 Prevention', () => {
    it('requests dossier details using GET /api/v1/admin/workers/{workerId}/verification', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            workerId: 'wrk-uuid-8812',
            workerName: 'Radha Devi',
            checks: [],
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const dossier = await repo.getDossierById('wrk-uuid-8812');

      expect(getSpy).toHaveBeenCalledWith('/admin/workers/wrk-uuid-8812/verification');
      expect(dossier?.workerId).toBe('wrk-uuid-8812');
      expect(dossier?.id).toBe('wrk-uuid-8812');
    });

    it('rejects substituting checkId into getDossierById with ValidationError', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const repo = new RealVerificationRepository();

      await expect(repo.getDossierById('chk-identity-999')).rejects.toThrow(ValidationError);
      await expect(repo.getDossierById('check-12345')).rejects.toThrow(ValidationError);
      await expect(repo.getDossierById('')).rejects.toThrow(ValidationError);

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('preserves separate workerId and checkId in getVerificationQueue', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'chk-identity-555',
              checkId: 'chk-identity-555',
              workerId: 'wrk-777',
              workerName: 'Gita Bai',
              category: 'Cook',
              status: 'PENDING_REVIEW',
            },
          ],
          meta: { totalItems: 1 },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const queue = await repo.getVerificationQueue();

      expect(queue.items).toHaveLength(1);
      const item = queue.items[0];
      expect(item.workerId).toBe('wrk-777');
      expect(item.checkId).toBe('chk-identity-555');
      // ID uses workerId rather than adopting the check ID
      expect(item.id).toBe('wrk-777');
    });

    it('VerificationQueuePage requests dossier details using genuine workerId upon selection', async () => {
      const getQueueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'W-TARGET-101',
            workerId: 'W-TARGET-101',
            checkId: 'chk-queue-901',
            workerName: 'Suresh Kumar',
            category: 'Driver',
            locality: 'Madhapur',
            experienceYears: 4,
            phoneMasked: '+91 99999 *****',
            submissionTime: '2026-10-18T10:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: mapChecks([]),
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      const getDossierSpy = vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'W-TARGET-101',
        workerId: 'W-TARGET-101',
        checkId: 'chk-queue-901',
        workerName: 'Suresh Kumar',
        category: 'Driver',
        locality: 'Madhapur',
        experienceYears: 4,
        phoneMasked: '+91 99999 *****',
        submissionTime: '2026-10-18T10:00:00Z',
        status: 'PENDING_REVIEW',
        preCheckOtpVerified: true,
        checks: mapChecks([]),
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectBtn);

      await waitFor(() => {
        expect(getDossierSpy).toHaveBeenCalledWith('W-TARGET-101');
        expect(getDossierSpy).not.toHaveBeenCalledWith('chk-queue-901');
      });
      expect(getQueueSpy).toHaveBeenCalled();
    });
  });

  describe('2. Verification Response Check Type & Status Mapping', () => {
    it('normalizes PREVIOUS_EMPLOYMENT to REFERENCE', () => {
      expect(normalizeCheckType('PREVIOUS_EMPLOYMENT')).toBe('REFERENCE');
      expect(normalizeCheckType('previous_employment')).toBe('REFERENCE');
    });

    it('normalizes POLICE_VERIFICATION to POLICE_CLEARANCE', () => {
      expect(normalizeCheckType('POLICE_VERIFICATION')).toBe('POLICE_CLEARANCE');
      expect(normalizeCheckType('police_verification')).toBe('POLICE_CLEARANCE');
    });

    it('handles standard check types', () => {
      expect(normalizeCheckType('IDENTITY')).toBe('IDENTITY');
      expect(normalizeCheckType('ADDRESS')).toBe('ADDRESS');
      expect(normalizeCheckType('EMERGENCY_CONTACT')).toBe('EMERGENCY_CONTACT');
      expect(normalizeCheckType('REFERENCE')).toBe('REFERENCE');
      expect(normalizeCheckType('POLICE_CLEARANCE')).toBe('POLICE_CLEARANCE');
    });

    it('explicitly rejects unknown enums and does not silently assign to unrelated checks', () => {
      expect(normalizeCheckType('SKILL_CERTIFICATE')).toBeNull();
      expect(normalizeCheckType('LICENSE')).toBeNull();
      expect(normalizeCheckType('DRIVING_LICENSE')).toBeNull();
      expect(normalizeCheckType('RANDOM_UNKNOWN')).toBeNull();
      expect(normalizeCheckType(undefined)).toBeNull();
      expect(normalizeCheckType(null)).toBeNull();
    });

    it('maps check statuses accurately', () => {
      expect(mapCheckStatus('APPROVED')).toBe('APPROVED');
      expect(mapCheckStatus('VERIFIED')).toBe('APPROVED');
      expect(mapCheckStatus('REJECTED')).toBe('REJECTED');
      expect(mapCheckStatus('FAILED')).toBe('REJECTED');
      expect(mapCheckStatus('IN_REVIEW')).toBe('IN_REVIEW');
      expect(mapCheckStatus('IN_PROGRESS')).toBe('IN_REVIEW');
      expect(mapCheckStatus('RECHECK_REQUESTED')).toBe('RECHECK_DUE');
      expect(mapCheckStatus('RECHECK_DUE')).toBe('RECHECK_DUE');
      expect(mapCheckStatus('PENDING')).toBe('PENDING');
      expect(mapCheckStatus(undefined)).toBe('PENDING');
    });

    it('mapChecks parses array responses with checkType and preserves checkId', () => {
      const rawBackendChecks = [
        {
          id: 'chk-emp-77',
          checkType: 'PREVIOUS_EMPLOYMENT',
          title: 'Prior Work History',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Anil Sharma',
            relationshipOrRole: 'Manager',
            phoneMasked: '+91 99000 *****',
          },
        },
        {
          id: 'chk-pol-88',
          checkType: 'POLICE_VERIFICATION',
          title: 'State Police Clearance',
          status: 'IN_REVIEW',
          documents: [{ id: 'doc-pcc-881' }],
        },
        {
          id: 'chk-unknown-99',
          checkType: 'SKILL_CERTIFICATE', // Should be explicitly skipped
        },
      ];

      const mapped = mapChecks(rawBackendChecks);

      expect(mapped.REFERENCE.id).toBe('chk-emp-77');
      expect(mapped.REFERENCE.type).toBe('REFERENCE');
      expect(mapped.REFERENCE.status).toBe('APPROVED');
      expect(mapped.REFERENCE.contactDetails?.contactName).toBe('Anil Sharma');

      expect(mapped.POLICE_CLEARANCE.id).toBe('chk-pol-88');
      expect(mapped.POLICE_CLEARANCE.type).toBe('POLICE_CLEARANCE');
      expect(mapped.POLICE_CLEARANCE.status).toBe('IN_REVIEW');
      expect(mapped.POLICE_CLEARANCE.documentMetadata?.documentId).toBe('doc-pcc-881');

      // Unmapped checks remain default pending checks and do not inherit random properties
      expect(mapped.IDENTITY.status).toBe('PENDING');
    });
  });

  describe('3. Document ID Extraction from Backend Contract Structures', () => {
    it('extracts documentId from documents: [{ id: "..." }]', () => {
      const mapped = mapChecks([
        {
          id: 'chk-id-10',
          checkType: 'IDENTITY',
          documents: [{ id: 'vault-doc-12345', documentTypeName: 'Aadhaar Card' }],
        },
      ]);

      expect(mapped.IDENTITY.documentMetadata?.documentId).toBe('vault-doc-12345');
    });

    it('extracts documentId from documents: [{ documentId: "..." }]', () => {
      const mapped = mapChecks([
        {
          id: 'chk-addr-10',
          checkType: 'ADDRESS',
          documents: [{ documentId: 'vault-doc-67890', docNumberMasked: 'ELEC-99' }],
        },
      ]);

      expect(mapped.ADDRESS.documentMetadata?.documentId).toBe('vault-doc-67890');
      expect(mapped.ADDRESS.documentMetadata?.docNumberMasked).toBe('ELEC-99');
    });

    it('extracts documentId from documentMetadata object', () => {
      const mapped = mapChecks([
        {
          id: 'chk-id-20',
          checkType: 'IDENTITY',
          documentMetadata: {
            documentId: 'vault-doc-meta-111',
            docNumberMasked: 'XXXX-XXXX-1111',
          },
        },
      ]);

      expect(mapped.IDENTITY.documentMetadata?.documentId).toBe('vault-doc-meta-111');
    });

    it('leaves documentMetadata.documentId undefined when document array is empty or lacks ID', () => {
      const mapped = mapChecks([
        {
          id: 'chk-id-30',
          checkType: 'IDENTITY',
          documents: [],
        },
      ]);

      expect(mapped.IDENTITY.documentMetadata?.documentId).toBeUndefined();
    });
  });

  describe('4. Check-Level Mutation Identifiers (Approve, Reject, Recheck)', () => {
    it('approveCheck uses genuine checkId and calls POST /admin/verification/checks/{checkId}/approve', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.approveCheck('chk-identity-401', 'IDENTITY', 'Aadhaar confirmed');

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-identity-401/approve',
        { remarks: 'Aadhaar confirmed' }
      );
    });

    it('rejectCheck uses genuine checkId and calls POST /admin/verification/checks/{checkId}/reject', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.rejectCheck('chk-address-402', 'ADDRESS', 'BLURRY_IMAGE', 'Image blurry');

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-address-402/reject',
        { remarks: 'Image blurry' }
      );
    });

    it('requestReVerification uses genuine checkId and calls POST /admin/verification/checks/{checkId}/recheck', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.requestReVerification('chk-police-403', ['POLICE_CLEARANCE'], 'Upload fresh PCC');

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/verification/checks/chk-police-403/recheck',
        { remarks: 'Upload fresh PCC' }
      );
    });

    it('rejects substituting workerId or dossierId in check operations with ValidationError', async () => {
      const postSpy = vi.spyOn(httpClient, 'post');
      const repo = new RealVerificationRepository();

      await expect(repo.approveCheck('W-10482')).rejects.toThrow(ValidationError);
      await expect(repo.approveCheck('wrk-9912')).rejects.toThrow(ValidationError);
      await expect(repo.approveCheck('APP-9912')).rejects.toThrow(ValidationError);
      await expect(repo.approveCheck('VQ-101')).rejects.toThrow(ValidationError);
      await expect(repo.approveCheck('')).rejects.toThrow(ValidationError);

      await expect(repo.rejectCheck('W-10482', 'IDENTITY', 'OTHER', 'bad')).rejects.toThrow(ValidationError);
      await expect(repo.rejectCheck('wrk-9912', 'IDENTITY', 'OTHER', 'bad')).rejects.toThrow(ValidationError);

      await expect(repo.requestReVerification('W-10482', ['IDENTITY'], 'recheck')).rejects.toThrow(ValidationError);
      await expect(repo.requestReVerification('VQ-101', ['IDENTITY'], 'recheck')).rejects.toThrow(ValidationError);

      expect(postSpy).not.toHaveBeenCalled();
    });
  });

  describe('5. Signed Document Link Security & Validation Intact', () => {
    it('validates signed URL and preserves expiration parameters', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            signedUrl: 'https://vault.sevanest.internal/documents/signed-doc.pdf?sig=tok123',
            expiresAt: '2026-10-19T20:00:00Z',
            expiresInSeconds: 900,
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const res = await repo.getSignedDocumentUrl('wrk-88', 'IDENTITY', 'doc-real-123');

      expect(res.signedUrl).toBe('https://vault.sevanest.internal/documents/signed-doc.pdf?sig=tok123');
      expect(res.expiresAt).toBe('2026-10-19T20:00:00Z');
      expect(res.expiresInSeconds).toBe(900);
    });

    it('rejects non-HTTP signed URLs returned by backend vault', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: {
            signedUrl: 'data:text/html,<script>alert(1)</script>',
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      await expect(
        repo.getSignedDocumentUrl('wrk-88', 'IDENTITY', 'doc-real-123')
      ).rejects.toThrow(ServerFailureError);
    });
  });
});
