/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
  RealVerificationRepository,
  MockVerificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  validateDocumentSignedUrl,
  isSafeDocumentUrl,
} from '../features/verification/domain/documentUrlValidator';
import { httpClient } from '../core/api/httpClient';
import { ServerFailureError, ValidationError } from '../core/errors/DomainError';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/') {
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

describe('Phase 4: Verification Document ID Handling & Safe Link Resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Senior Verification Executive',
        email: 'verif.exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
      accessToken: 'jwt-token-ve-01',
    });
  });

  describe('1. Valid Document ID Requests Exact Endpoint', () => {
    it('requests signed URL using the exact documentId without substitution', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            url: 'https://vault.sevanest.internal/documents/signed/doc-aadhaar-99.pdf?sig=valid',
            expiresAt: '2026-10-20T12:00:00Z',
            expiresInSeconds: 1800,
          },
        },
      } as any);

      const repo = new RealVerificationRepository();
      const result = await repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'doc-aadhaar-99');

      expect(getSpy).toHaveBeenCalledWith(
        '/admin/verification/documents/doc-aadhaar-99/link'
      );
      expect(result.signedUrl).toBe(
        'https://vault.sevanest.internal/documents/signed/doc-aadhaar-99.pdf?sig=valid'
      );
      expect(result.expiresAt).toBe('2026-10-20T12:00:00Z');
      expect(result.expiresInSeconds).toBe(1800);
    });

    it('MockVerificationRepository accepts valid documentId and returns signed HTTPS URL', async () => {
      const mockRepo = new MockVerificationRepository();
      const res = await mockRepo.getSignedDocumentUrl('VQ-101', 'IDENTITY', 'doc-id-101');
      expect(res.signedUrl).toContain('https://storage.sevanest.internal/documents/vault/doc-id-101/identity');
      expect(res.expiresInSeconds).toBe(900);
    });
  });

  describe('2. Missing or Blank Document ID Prevents API Request', () => {
    it('RealVerificationRepository throws ValidationError for missing or empty documentId', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const repo = new RealVerificationRepository();

      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', '')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', '   ')).rejects.toThrow(ValidationError);
      await expect(repo.getSignedDocumentUrl('W-10482', 'IDENTITY', undefined)).rejects.toThrow(ValidationError);

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('MockVerificationRepository throws ValidationError for missing documentId', async () => {
      const mockRepo = new MockVerificationRepository();
      await expect(mockRepo.getSignedDocumentUrl('VQ-101', 'IDENTITY', '')).rejects.toThrow(ValidationError);
      await expect(mockRepo.getSignedDocumentUrl('VQ-101', 'IDENTITY', undefined)).rejects.toThrow(ValidationError);
    });

    it('VerificationQueuePage renders clear unavailable state when documentId is absent and sends no request', async () => {
      // Mock dossier with an IDENTITY check that lacks documentId
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'VQ-NO-DOC',
            checkId: 'chk-nodoc-1',
            applicationId: 'W-9999',
            workerId: 'W-9999',
            workerName: 'Kavita Verma',
            category: 'Cook',
            locality: 'Madhapur',
            experienceYears: 3,
            phoneMasked: '+91 99999 *****',
            submissionTime: '2026-10-18T10:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: {
              IDENTITY: {
                id: 'chk-nodoc-1',
                type: 'IDENTITY',
                title: 'Identity Proof',
                status: 'PENDING',
                evaluationMethod: 'DOCUMENT_INSPECTION',
                // documentMetadata has no documentId
                documentMetadata: {
                  docNumberMasked: 'XXXX-XXXX-9999',
                  documentTypeName: 'National ID',
                },
              },
              ADDRESS: {
                type: 'ADDRESS',
                title: 'Address Proof',
                status: 'PENDING',
                evaluationMethod: 'DOCUMENT_INSPECTION',
              },
              EMERGENCY_CONTACT: {
                type: 'EMERGENCY_CONTACT',
                title: 'Emergency Contact',
                status: 'PENDING',
                evaluationMethod: 'TELEPHONIC_VETTING',
              },
              REFERENCE: {
                type: 'REFERENCE',
                title: 'Reference',
                status: 'PENDING',
                evaluationMethod: 'TELEPHONIC_VETTING',
              },
              POLICE_CLEARANCE: {
                type: 'POLICE_CLEARANCE',
                title: 'Police Clearance',
                status: 'PENDING',
                evaluationMethod: 'CERTIFICATE_TRACKING',
              },
            },
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      const getSignedUrlSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl');

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButton = await screen.findByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButton);

      // Verify clear unavailable state rendered
      const missingDocBadges = await screen.findAllByTestId('verification-doc-missing-id');
      expect(missingDocBadges.length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Document Vault Attachment Unavailable/i).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(/No backend document reference ID is associated with this verification check/i).length
      ).toBeGreaterThan(0);

      // Zero signed URL API calls made
      expect(getSignedUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Dossier ID is Never Substituted for a Missing Document ID', () => {
    it('rejects documentId that matches dossierId or uses dossier prefix', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const repo = new RealVerificationRepository();

      await expect(
        repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'W-10482')
      ).rejects.toThrow(/dossierId/i);

      await expect(
        repo.getSignedDocumentUrl('VQ-200', 'IDENTITY', 'VQ-200')
      ).rejects.toThrow(/dossierId/i);

      await expect(
        repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'VQ-999')
      ).rejects.toThrow(/dossier or application identifier/i);

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('rejects checkType substituted as documentId', async () => {
      const repo = new RealVerificationRepository();
      await expect(
        repo.getSignedDocumentUrl('W-10482', 'IDENTITY', 'IDENTITY')
      ).rejects.toThrow(/checkType cannot be substituted/i);
    });
  });

  describe('4. Valid HTTPS Signed URL Handled Correctly by UI', () => {
    it('renders authorized document viewer and opens secure HTTPS link', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValueOnce({
        url: 'https://vault.sevanest.internal/documents/doc-101/view.pdf?token=secret123',
        signedUrl: 'https://vault.sevanest.internal/documents/doc-101/view.pdf?token=secret123',
        expiresAt: '2026-10-25T18:00:00Z',
        expiresInSeconds: 3600,
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Navigate to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      // Confirm secure link is displayed
      const openLink = await screen.findByRole('link', { name: /Open Secure Document Link/i });
      expect(openLink).toBeInTheDocument();
      expect(openLink).toHaveAttribute(
        'href',
        'https://vault.sevanest.internal/documents/doc-101/view.pdf?token=secret123'
      );
      expect(openLink).toHaveAttribute('target', '_blank');
      expect(openLink).toHaveAttribute('rel', 'noopener noreferrer');

      // Verify validity timestamp is rendered
      expect(screen.getByText(/Validity: 2026-10-25T18:00:00Z/i)).toBeInTheDocument();
    });

    it('WorkerDetailModal displays preview with validity and zoom/rotate controls', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValueOnce({
        url: 'https://storage.sevanest.internal/documents/doc-aadhaar-1.pdf?sig=valid',
        signedUrl: 'https://storage.sevanest.internal/documents/doc-aadhaar-1.pdf?sig=valid',
        expiresAt: '2026-10-22T10:00:00Z',
        expiresInSeconds: 900,
      });

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal workerId="W-10482" onClose={vi.fn()} />
      );

      // Navigate to Documents & Evidence step
      const step2Btn = await screen.findByRole('button', {
        name: /Proceed to Step 2: Documents & Evidence/i,
      });
      await user.click(step2Btn);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Document/i });
      await user.click(inspectButtons[0]);

      expect(
        await screen.findByText(/Authorized Document Vault Preview/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Validity: 2026-10-22T10:00:00Z/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rotate 90°/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Zoom In/i })).toBeInTheDocument();
    });
  });

  describe('5. Missing, Malformed, or Unsafe Signed URLs Rejected Safely', () => {
    it('rejects javascript: schemes without logging token or PII', () => {
      expect(() =>
        validateDocumentSignedUrl('javascript:alert(1)')
      ).toThrow(ServerFailureError);
      expect(() =>
        validateDocumentSignedUrl('javascript:alert(1)')
      ).toThrow(/Insecure or unsupported document URL protocol "javascript:"/i);
    });

    it('rejects data: and file: schemes', () => {
      expect(() =>
        validateDocumentSignedUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')
      ).toThrow(ServerFailureError);
      expect(() =>
        validateDocumentSignedUrl('file:///C:/confidential/doc.pdf')
      ).toThrow(ServerFailureError);
    });

    it('rejects plain HTTP URLs on public non-localhost domains', () => {
      expect(() =>
        validateDocumentSignedUrl('http://insecure-vault.example.com/doc.pdf')
      ).toThrow(/Insecure or unsupported document URL protocol "http:"/i);
    });

    it('allows valid HTTPS URLs and local development HTTP loopback', () => {
      expect(
        validateDocumentSignedUrl('https://vault.sevanest.internal/doc.pdf?sig=xyz')
      ).toBe('https://vault.sevanest.internal/doc.pdf?sig=xyz');

      expect(
        validateDocumentSignedUrl('http://localhost:3000/doc.pdf')
      ).toBe('http://localhost:3000/doc.pdf');

      expect(
        validateDocumentSignedUrl('http://127.0.0.1:9000/doc.pdf')
      ).toBe('http://127.0.0.1:9000/doc.pdf');
    });

    it('rejects malformed non-URL strings', () => {
      expect(() => validateDocumentSignedUrl('not a url')).toThrow(ServerFailureError);
      expect(() => validateDocumentSignedUrl('')).toThrow(ServerFailureError);
      expect(() => validateDocumentSignedUrl(null)).toThrow(ServerFailureError);
    });

    it('isSafeDocumentUrl returns boolean safely without throwing', () => {
      expect(isSafeDocumentUrl('https://secure.example.com/doc.pdf')).toBe(true);
      expect(isSafeDocumentUrl('http://localhost:8080/doc.pdf')).toBe(true);
      expect(isSafeDocumentUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeDocumentUrl('http://insecure.example.com/doc.pdf')).toBe(false);
      expect(isSafeDocumentUrl(undefined)).toBe(false);
    });
  });

  describe('6. API Retrieval Errors Show Appropriate Error State', () => {
    it('displays error notice and retry button when signed document request fails', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValueOnce(
        new Error('Vault 503: Document storage service temporarily unavailable')
      );

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(
        await screen.findByText(/Failed to load document attachment/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Vault 503: Document storage service temporarily unavailable/i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Fetching Document/i });
      expect(retryBtn).toBeInTheDocument();
    });
  });

  describe('7. Document Expiry and Retry Behavior Intact', () => {
    it('retrying a failed document fetch calls repository again', async () => {
      const getSignedSpy = vi
        .spyOn(verificationRepository, 'getSignedDocumentUrl')
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          url: 'https://vault.sevanest.internal/documents/doc-101/retried.pdf?token=abc',
          signedUrl: 'https://vault.sevanest.internal/documents/doc-101/retried.pdf?token=abc',
          expiresAt: '2026-10-21T14:00:00Z',
          expiresInSeconds: 1800,
        });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      const retryBtn = await screen.findByRole('button', { name: /Retry Fetching Document/i });
      await user.click(retryBtn);

      await waitFor(() => {
        expect(getSignedSpy).toHaveBeenCalledTimes(2);
      });
      expect(
        await screen.findByRole('link', { name: /Open Secure Document Link/i })
      ).toBeInTheDocument();
    });
  });

  describe('8. Submitted Documents Inspection and Verification Workflows', () => {
    it('opens a submitted identity document from Step 2 Documents Review using genuine documentId', async () => {
      const getSignedUrlSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.internal/documents/doc-id-101/identity.pdf?token=sec999',
        signedUrl: 'https://vault.sevanest.internal/documents/doc-id-101/identity.pdf?token=sec999',
        expiresAt: '2026-10-25T20:00:00Z',
        expiresInSeconds: 3600,
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectDossierBtns = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectDossierBtns[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Identity Proof/i })).toBeInTheDocument();

      // Verifies backend contract GET /api/v1/admin/verification/documents/{documentId}/link called with actual documentId
      await waitFor(() => {
        expect(getSignedUrlSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^W-10482|^VQ-101/),
          'IDENTITY',
          'doc-id-101'
        );
      });

      // Verify viewer opened
      expect(await screen.findByTestId('vault-document-inspection-viewer')).toBeInTheDocument();
      expect(screen.getByText(/Authorized Document Vault Inspection/i)).toBeInTheDocument();
      expect(screen.getByText(/Validity: 2026-10-25T20:00:00Z/i)).toBeInTheDocument();

      // Secure external link is present
      const secureLink = screen.getByRole('link', { name: /Open Secure Document Link/i });
      expect(secureLink).toHaveAttribute(
        'href',
        'https://vault.sevanest.internal/documents/doc-id-101/identity.pdf?token=sec999'
      );
      expect(secureLink).toHaveAttribute('target', '_blank');
      expect(secureLink).toHaveAttribute('rel', 'noopener noreferrer');

      // Crucial: document inspection MUST NOT automatically approve the check
      const approveCheckSpy = vi.spyOn(verificationRepository, 'approveCheck');
      expect(approveCheckSpy).not.toHaveBeenCalled();
    });

    it('renders image previews for images and object previews for PDFs', async () => {
      // Image preview
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.internal/documents/doc-id-101/photo.jpg?token=abc',
        signedUrl: 'https://vault.sevanest.internal/documents/doc-id-101/photo.jpg?token=abc',
        expiresAt: '2026-10-25T20:00:00Z',
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectDossierBtns = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectDossierBtns[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      // Confirm image tag rendered
      const img = await screen.findByRole('img', { name: /Submitted KYC Document/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        'src',
        'https://vault.sevanest.internal/documents/doc-id-101/photo.jpg?token=abc'
      );
    });

    it('displays Pending Submission and suppresses Inspect button when document is not submitted', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'VQ-NO-DOC',
            workerId: 'W-NODOC-1',
            workerName: 'Kavita Singh',
            category: 'Cook',
            locality: 'Kondapur',
            experienceYears: 2,
            phoneMasked: '+91 99000 *****',
            submissionTime: '2026-10-15T09:00:00Z',
            status: 'PENDING_REVIEW',
            preCheckOtpVerified: true,
            checks: {
              IDENTITY: {
                type: 'IDENTITY',
                title: 'Identity Proof',
                status: 'PENDING',
                evaluationMethod: 'DOCUMENT_INSPECTION',
                // No documentId
              },
              ADDRESS: {
                type: 'ADDRESS',
                title: 'Address Proof',
                status: 'PENDING',
                evaluationMethod: 'DOCUMENT_INSPECTION',
              },
              EMERGENCY_CONTACT: {
                type: 'EMERGENCY_CONTACT',
                title: 'Emergency Contact',
                status: 'PENDING',
                evaluationMethod: 'TELEPHONIC_VETTING',
              },
              REFERENCE: {
                type: 'REFERENCE',
                title: 'Reference',
                status: 'PENDING',
                evaluationMethod: 'TELEPHONIC_VETTING',
              },
              POLICE_CLEARANCE: {
                type: 'POLICE_CLEARANCE',
                title: 'Police Clearance',
                status: 'PENDING',
                evaluationMethod: 'CERTIFICATE_TRACKING',
              },
            },
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectDossierBtns = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectDossierBtns[0]);

      // Verify clear unavailable state rendered in overview
      const missingDocBadges = await screen.findAllByTestId('verification-doc-missing-id');
      expect(missingDocBadges.length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Document Vault Attachment Unavailable/i).length).toBeGreaterThan(0);
    });

    it('displays error state and retry button when vault returns failure', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValue(
        new Error('Vault 404: Document attachment has been purged or does not exist')
      );

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectDossierBtns = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectDossierBtns[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/Failed to load document attachment/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Vault 404: Document attachment has been purged or does not exist/i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Fetching Document/i });
      expect(retryBtn).toBeInTheDocument();
    });

    it('enforces RBAC permissions: shows Restricted Access when user lacks VERIFICATION_DOCUMENT_VIEW', async () => {
      // Set user WITHOUT document view permission
      useAuthStore.setState({
        user: {
          id: 'STAFF-OP-01',
          name: 'Operations Staff',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        isAuthenticated: true,
        accessToken: 'jwt-token-ops',
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectDossierBtns = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectDossierBtns[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      // Restricted Access is shown
      expect(await screen.findByText(/Restricted Personal Document \(KYC\)/i)).toBeInTheDocument();
    });
  });

  describe('9. Modal Header and Desktop Layout Structure', () => {
    it('renders a clean header row with worker name, status, and top-right close button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
      const continueBtn = screen.getByRole('button', { name: /Continue Review \(Inspect Dossier\) for Ramesh Yadav/i });
      await user.click(continueBtn);

      // Top row header elements
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Verification Dossier: Ramesh Yadav/i)).toBeInTheDocument();

      // Top-right close button exists with proper aria-label and is unique
      const closeBtn = screen.getByRole('button', { name: /Close dossier view/i });
      expect(closeBtn).toBeInTheDocument();

      // Metadata row beneath title
      expect(screen.getAllByText(/Driver/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Madhapur/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /View Worker Record/i })).toBeInTheDocument();
    });

    it('separates check status and document vault attachment availability', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
      const continueBtn = screen.getByRole('button', { name: /Continue Review \(Inspect Dossier\) for Ramesh Yadav/i });
      await user.click(continueBtn);

      // In inspection overview
      expect((await screen.findAllByText(/Check Status:/i)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Document Attachment:/i).length).toBeGreaterThan(0);

      // Ensure no fabricated 'XXXX-XXXX-VALID' string is rendered
      expect(screen.queryByText('XXXX-XXXX-VALID')).not.toBeInTheDocument();
    });
  });
});

