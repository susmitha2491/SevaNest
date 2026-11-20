import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import {
  formatDocumentSize,
  isSuspiciousMinimalDocument,
  isEmptyDocument,
} from '../features/verification/domain/documentUtils';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier } from '../features/verification/domain/types';
import { verificationRepository } from '../features/verification/data/verificationRepository';

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

describe('Worker Document Preview, Validation & Size Handling', () => {
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

  describe('1. Document File Size Formatting Helper (formatDocumentSize)', () => {
    it('returns empty string for null, undefined, or NaN', () => {
      expect(formatDocumentSize(null)).toBe('');
      expect(formatDocumentSize(undefined)).toBe('');
      expect(formatDocumentSize(NaN)).toBe('');
    });

    it('formats 0 bytes as "0 B (Empty)"', () => {
      expect(formatDocumentSize(0)).toBe('0 B (Empty)');
    });

    it('accurately formats small byte counts without rounding down to "0 KB"', () => {
      expect(formatDocumentSize(193)).toBe('193 B');
      expect(formatDocumentSize(328)).toBe('328 B');
      expect(formatDocumentSize(512)).toBe('512 B');
      expect(formatDocumentSize(1023)).toBe('1023 B');
    });

    it('formats kilobyte ranges accurately', () => {
      expect(formatDocumentSize(1024)).toBe('1.0 KB');
      expect(formatDocumentSize(3295)).toBe('3.2 KB');
      expect(formatDocumentSize(72377)).toBe('71 KB');
      expect(formatDocumentSize(148787)).toBe('145 KB');
      expect(formatDocumentSize(366033)).toBe('357 KB');
    });

    it('formats megabyte ranges accurately', () => {
      expect(formatDocumentSize(1048576)).toBe('1.00 MB');
      expect(formatDocumentSize(2500000)).toBe('2.38 MB');
    });
  });

  describe('2. Empty and Minimal Stub Document Detection', () => {
    it('isSuspiciousMinimalDocument identifies files under 500 bytes as minimal stubs', () => {
      expect(isSuspiciousMinimalDocument(193)).toBe(true);
      expect(isSuspiciousMinimalDocument(328)).toBe(true);
      expect(isSuspiciousMinimalDocument(499)).toBe(true);
      expect(isSuspiciousMinimalDocument(500)).toBe(false);
      expect(isSuspiciousMinimalDocument(148787)).toBe(false);
      expect(isSuspiciousMinimalDocument(0)).toBe(false);
      expect(isSuspiciousMinimalDocument(undefined)).toBe(false);
    });

    it('isEmptyDocument identifies 0-byte files', () => {
      expect(isEmptyDocument(0)).toBe(true);
      expect(isEmptyDocument(193)).toBe(false);
      expect(isEmptyDocument(undefined)).toBe(false);
    });
  });

  describe('3. Content Security Policy (CSP) Directives for Document Embedding', () => {
    it('nginx.conf includes frame-src and object-src allowing Supabase Storage', () => {
      const nginxContent = fs.readFileSync(path.resolve(process.cwd(), 'nginx.conf'), 'utf-8');
      expect(nginxContent).toContain("frame-src 'self' https://*.supabase.co blob: data:;");
      expect(nginxContent).toContain("object-src 'self' https://*.supabase.co blob:;");
      expect(nginxContent).toContain('connect-src');
      expect(nginxContent).toContain('https://*.supabase.co');
    });

    it('vercel.json includes frame-src and object-src allowing Supabase Storage', () => {
      const vercelContent = fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8');
      expect(vercelContent).toContain("frame-src 'self' https://*.supabase.co blob: data:;");
      expect(vercelContent).toContain("object-src 'self' https://*.supabase.co blob:;");
      expect(vercelContent).toContain('connect-src');
      expect(vercelContent).toContain('https://*.supabase.co');
    });
  });

  describe('4. WorkerVerificationReviewModal Viewer Displays Correct Size and Warning', () => {
    const createMockDossier = (sizeBytes: number): VerificationDossier => ({
      id: 'VQ-TEST-01',
      checkId: 'chk-test-identity',
      applicationId: 'APP-TEST-01',
      workerId: '01a11ef1-66c8-7703-a9b6-4e54bd93cafc',
      workerName: 'Sarojini Kolla',
      category: 'House Maid',
      locality: 'Kondapur',
      experienceYears: 5,
      phoneMasked: '+91 98765 *****',
      preCheckOtpVerified: true,
      status: 'APPROVED',
      phone: '+91 98765 43210',
      email: 'sarojini@sevanest.worker',
      submissionTime: '2026-10-09T04:38:50Z',
      checks: {
        IDENTITY: {
          id: 'chk-identity-test',
          type: 'IDENTITY',
          title: 'Identity Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: '01a11ef4-e095-7049-b64e-f7cf18d8d3e9',
            docNumberMasked: 'XXXX-XXXX-1234',
            documentTypeName: 'Identity Proof',
            contentType: 'application/pdf',
            sizeBytes: sizeBytes,
          },
        },
      },
    });

    it('renders exact "193 B" size and displays minimal stub warning banner for 193-byte PDF', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValueOnce({
        signedUrl: 'https://dufqgsgcymrasyxpvbiz.storage.supabase.co/storage/v1/s3/kyc/doc.pdf',
        expiresAt: '2026-10-25T18:00:00Z',
        expiresInSeconds: 120,
      });

      const dossier = createMockDossier(193);

      renderWithProviders(
        <WorkerVerificationReviewModal
          dossierId="VQ-TEST-01"
          initialDossier={dossier}
          onClose={vi.fn()}
        />
      );

      // Step 2 is Documents Review
      const step2Bubble = screen.getByTestId('step-bubble-2');
      await userEvent.click(step2Bubble);

      // Find and click View Document button
      const viewDocBtn = await screen.findByRole('button', { name: /View Document/i });
      await userEvent.click(viewDocBtn);

      // Verify that Format & Size displays "193 B" and NOT "0 KB"
      expect(screen.getAllByText(/application\/pdf/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/193 B/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/0 KB/i)).not.toBeInTheDocument();

      // Verify that the minimal stub warning banner is displayed
      const warningBanner = await screen.findByTestId('minimal-stub-warning');
      expect(warningBanner).toBeInTheDocument();
      expect(warningBanner).toHaveTextContent(/Minimal Document File \(193 B\)/i);
      expect(warningBanner).toHaveTextContent(/renders as a blank page/i);

      // Verify the Secure Document Link is provided
      const openDocLink = screen.getByTestId('open-document-new-tab');
      expect(openDocLink).toBeInTheDocument();
      expect(openDocLink).toHaveAttribute(
        'href',
        'https://dufqgsgcymrasyxpvbiz.storage.supabase.co/storage/v1/s3/kyc/doc.pdf'
      );
    });

    it('renders normal document size (e.g. 145 KB) without minimal stub warning for genuine files', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValueOnce({
        signedUrl: 'https://dufqgsgcymrasyxpvbiz.storage.supabase.co/storage/v1/s3/kyc/doc.pdf',
        expiresAt: '2026-10-25T18:00:00Z',
        expiresInSeconds: 120,
      });

      const dossier = createMockDossier(148787);

      renderWithProviders(
        <WorkerVerificationReviewModal
          dossierId="VQ-TEST-01"
          initialDossier={dossier}
          onClose={vi.fn()}
        />
      );

      const step2Bubble = screen.getByTestId('step-bubble-2');
      await userEvent.click(step2Bubble);

      const viewDocBtn = await screen.findByRole('button', { name: /View Document/i });
      await userEvent.click(viewDocBtn);

      // Verify size displays "145 KB"
      expect(screen.getAllByText(/145 KB/i).length).toBeGreaterThanOrEqual(1);

      // Verify that minimal stub warning banner is NOT present
      expect(screen.queryByTestId('minimal-stub-warning')).not.toBeInTheDocument();
      expect(screen.queryByTestId('empty-file-warning')).not.toBeInTheDocument();
    });
  });
});
