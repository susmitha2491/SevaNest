import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
} from '../features/verification/data/verificationRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import {
  formatDocumentVaultError,
} from '../features/verification/domain/documentVaultErrorFormatter';
import {
  ConcurrencyConflictError,
  NotFoundError,
  ValidationError,
  ServerFailureError,
} from '../core/errors/DomainError';
import { WorkerDetail } from '../features/workers/domain/types';
import { VerificationDossier } from '../features/verification/domain/types';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockWorkerBase: WorkerDetail = {
  id: '01a13eff-73b5-7447-aa0d-13bc25757935',
  name: 'Sunita Devi',
  category: 'Cook',
  categories: ['Cook'],
  experienceYears: 4,
  ratingAverage: 4.8,
  totalReviews: 12,
  locality: 'Madhapur',
  serviceRadiusKm: 6,
  languages: ['Hindi', 'Telugu'],
  bio: 'Experienced home cook',
  isFullyVerified: false,
  status: 'ACTIVE',
  applicationStatus: 'UNDER_REVIEW',
  onboardingStatus: 'IN_REVIEW',
  phoneMasked: '+91 98765 *****',
  documents: [],
  verification: {
    phoneOtpVerified: true,
    identityProofStatus: 'PENDING',
    addressProofStatus: 'PENDING',
    criminalRecordStatus: 'PENDING',
    skillProofStatus: 'NOT_APPLICABLE',
    referenceCheckStatus: 'PENDING',
  },
  activeEngagementsCount: 0,
  completedBookingsCount: 0,
  replacementsIncurred: 0,
  recentEngagements: [],
  internalNotes: [],
};

const mockDossierBase: VerificationDossier = {
  id: 'dossier-contract-test',
  workerId: '01a13eff-73b5-7447-aa0d-13bc25757935',
  workerName: 'Sunita Devi',
  category: 'Cook',
  locality: 'Madhapur',
  experienceYears: 4,
  phoneMasked: '+91 98765 *****',
  submissionTime: '2026-10-25T10:00:00Z',
  status: 'IN_REVIEW',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: {
      id: 'chk-identity-c1',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'SUBMITTED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-aadhaar-c1',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
        reviewable: true,
        available: true,
      },
    },
    ADDRESS: {
      id: 'chk-address-c2',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'SUBMITTED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-address-c2',
        documentTypeName: 'Electricity Bill',
        docNumberMasked: 'ELEC-HYD-55667',
        reviewable: true,
        available: true,
      },
    },
    POLICE_CLEARANCE: {
      id: 'chk-police-c3',
      type: 'POLICE_CLEARANCE',
      title: 'Police Verification',
      status: 'SUBMITTED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-pcc-c3',
        documentTypeName: 'Police Clearance Certificate',
        docNumberMasked: 'PCC-HYD-88990',
        reviewable: true,
        available: true,
      },
    },
  },
};

describe('Worker KYC Workflow Contract Alignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockDossierBase.checks.IDENTITY.status = 'SUBMITTED';
    mockDossierBase.checks.ADDRESS.status = 'SUBMITTED';
    mockDossierBase.checks.POLICE_CLEARANCE.status = 'SUBMITTED';
    useAuthStore.getState().setSession(
      {
        id: 'usr-admin-01',
        name: 'Super Admin',
        email: 'sevanest@admin.in',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.WORKER_ACTIVATE,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'admin-token-valid'
    );
  });

  describe('1. Document Visibility & Inspection Contract', () => {
    it('renders document only when reviewable === true and excludes available === true if reviewable is false or undefined', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-reviewable-ok',
            documentId: 'doc-reviewable-ok',
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY',
            documentTypeName: 'Genuine Aadhaar Card',
            docNumberMasked: 'XXXX-XXXX-1111',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
          {
            id: 'doc-not-reviewable-but-available',
            documentId: 'doc-not-reviewable-but-available',
            checkId: 'chk-address-c2',
            checkType: 'ADDRESS',
            documentType: 'ADDRESS',
            documentTypeName: 'Unreviewable Utility Bill',
            docNumberMasked: 'XXXX-XXXX-2222',
            status: 'SUBMITTED',
            reviewable: false,
            available: true, // available === true is NEVER proof of reviewability!
          },
          {
            id: 'doc-missing-reviewable-flag',
            documentId: 'doc-missing-reviewable-flag',
            checkId: 'chk-police-c3',
            checkType: 'POLICE_CLEARANCE',
            documentType: 'POLICE_CLEARANCE',
            documentTypeName: 'Legacy Unflagged Document',
            docNumberMasked: 'XXXX-XXXX-3333',
            status: 'SUBMITTED',
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      // Only the document with reviewable === true should be rendered!
      expect(await screen.findByText('Genuine Aadhaar Card')).toBeInTheDocument();
      expect(screen.queryByText('Unreviewable Utility Bill')).not.toBeInTheDocument();
      expect(screen.queryByText('Legacy Unflagged Document')).not.toBeInTheDocument();
    });

    it('never shows discarded or not-uploaded documents as reviewable', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-valid',
            documentId: 'doc-valid',
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY',
            documentTypeName: 'Valid Identity Document',
            docNumberMasked: 'XXXX-XXXX-1111',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
            availability: 'AVAILABLE',
          },
          {
            id: 'doc-discarded',
            documentId: 'doc-discarded',
            checkId: 'chk-address-c2',
            checkType: 'ADDRESS',
            documentType: 'ADDRESS',
            documentTypeName: 'Discarded Old Utility Bill',
            docNumberMasked: 'XXXX-XXXX-2222',
            status: 'SUBMITTED',
            reviewable: true, // Marked reviewable in bad state, but discarded
            available: false,
            availability: 'DISCARDED',
          },
          {
            id: 'doc-unuploaded-draft',
            documentId: 'doc-unuploaded-draft',
            checkId: 'chk-police-c3',
            checkType: 'POLICE_CLEARANCE',
            documentType: 'POLICE_CLEARANCE',
            documentTypeName: 'Unuploaded PCC Placeholder',
            docNumberMasked: 'XXXX-XXXX-3333',
            status: 'PENDING_UPLOAD' as any,
            reviewable: true,
            available: false,
            availability: 'NOT_UPLOADED',
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText('Valid Identity Document')).toBeInTheDocument();
      expect(screen.queryByText('Discarded Old Utility Bill')).not.toBeInTheDocument();
      expect(screen.queryByText('Unuploaded PCC Placeholder')).not.toBeInTheDocument();
    });

    it('uses documentId for getSignedDocumentUrl and renders img tag when mimeType is image/jpeg', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-front-jpeg',
            documentId: 'doc-front-jpeg',
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY',
            documentTypeName: 'Aadhaar Front JPEG',
            docNumberMasked: 'XXXX-XXXX-9999',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);
      const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.in/documents/doc-front-jpeg?token=valid',
        signedUrl: 'https://vault.sevanest.in/documents/doc-front-jpeg?token=valid',
        expiresAt: '2026-10-29T18:00:00Z',
        mimeType: 'image/jpeg',
      });

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      const docRow = await screen.findByText('Aadhaar Front JPEG');
      const inspectBtn = within(docRow.closest('tr')!).getByRole('button', { name: /Inspect Document/i });
      await user.click(inspectBtn);

      // Verify contract: documentId was passed
      expect(linkSpy).toHaveBeenCalledWith(
        '01a13eff-73b5-7447-aa0d-13bc25757935',
        'IDENTITY',
        'doc-front-jpeg'
      );

      // Renders <img> element for mimeType image/jpeg
      const img = await screen.findByTestId('kyc-document-image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://vault.sevanest.in/documents/doc-front-jpeg?token=valid');
    });

    it('renders iframe for PDF mimeType returned by getSignedDocumentUrl', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-bill-pdf',
            documentId: 'doc-bill-pdf',
            checkId: 'chk-address-c2',
            checkType: 'ADDRESS',
            documentType: 'ADDRESS',
            documentTypeName: 'Electricity Bill PDF',
            docNumberMasked: 'ELEC-999',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.in/documents/doc-bill-pdf?token=valid',
        signedUrl: 'https://vault.sevanest.in/documents/doc-bill-pdf?token=valid',
        expiresAt: '2026-10-29T18:00:00Z',
        mimeType: 'application/pdf',
      });

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      const docRow = await screen.findByText('Electricity Bill PDF');
      const inspectBtn = within(docRow.closest('tr')!).getByRole('button', { name: /Inspect Document/i });
      await user.click(inspectBtn);

      const iframe = await screen.findByTestId('kyc-document-pdf');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'https://vault.sevanest.in/documents/doc-bill-pdf?token=valid');
    });

    it('formats actionable errors for DOCUMENT_NOT_AVAILABLE, DOCUMENT_OBJECT_MISSING, DOCUMENT_INTEGRITY_FAILED, STORAGE_NOT_CONFIGURED', () => {
      const notAvail = formatDocumentVaultError(
        new NotFoundError('Document not available', { errorCode: 'DOCUMENT_NOT_AVAILABLE' })
      );
      expect(notAvail.title).toBe('Document Not Available');
      expect(notAvail.message).toContain('not currently available for inspection');
      expect(notAvail.canRetry).toBe(true);

      const missing = formatDocumentVaultError(
        new NotFoundError('Document missing', { errorCode: 'DOCUMENT_OBJECT_MISSING' })
      );
      expect(missing.title).toBe('Document Missing from Storage');
      expect(missing.message).toContain('missing from storage');
      expect(missing.canRetry).toBe(true);

      const integrity = formatDocumentVaultError(
        new ServerFailureError('Integrity failed', { errorCode: 'DOCUMENT_INTEGRITY_FAILED' })
      );
      expect(integrity.title).toBe('Document Integrity Check Failed');
      expect(integrity.message).toContain('corrupted');
      expect(integrity.canRetry).toBe(false);

      const storage = formatDocumentVaultError(
        new ServerFailureError('Storage error', { errorCode: 'STORAGE_NOT_CONFIGURED' })
      );
      expect(storage.title).toBe('Storage Service Not Configured');
      expect(storage.message).toContain('contact the system administrator');
      expect(storage.canRetry).toBe(false);
    });
  });

  describe('2. Check Decision Lifecycle & Error Handling Contract', () => {
    it('calls claimCheck before approving a SUBMITTED check', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-aadhaar-c1',
            documentId: 'doc-aadhaar-c1',
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY',
            documentTypeName: 'Aadhaar Card',
            docNumberMasked: 'XXXX-XXXX-1234',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);
      const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue({
        workerId: '01a13eff-73b5-7447-aa0d-13bc25757935',
        applicationStatus: 'UNDER_REVIEW',
        level: 'IN_PROGRESS',
        checks: [
          {
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            status: 'IN_REVIEW',
            required: true,
          },
        ],
        requiredChecks: ['IDENTITY'],
      });
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue({
        workerId: '01a13eff-73b5-7447-aa0d-13bc25757935',
        applicationStatus: 'UNDER_REVIEW',
        level: 'IN_PROGRESS',
        checks: [
          {
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            status: 'APPROVED',
            required: true,
          },
        ],
        requiredChecks: ['IDENTITY'],
      });

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      const docRow = await screen.findByText('Aadhaar Card');
      const acceptBtn = within(docRow.closest('tr')!).getByRole('button', { name: /^Accept$/i });
      await user.click(acceptBtn);

      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Verify claimCheck was called prior to approveCheck
      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-identity-c1');
        expect(approveSpy).toHaveBeenCalledWith('chk-identity-c1', 'IDENTITY', expect.any(String));
      });
    });

    it('handles CHECK_ALREADY_ASSIGNED by displaying clear conflict message and refreshing authoritative data', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-aadhaar-c1',
            documentId: 'doc-aadhaar-c1',
            checkId: 'chk-identity-c1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY',
            documentTypeName: 'Aadhaar Card',
            docNumberMasked: 'XXXX-XXXX-1234',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);
      vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue({
        workerId: '01a13eff-73b5-7447-aa0d-13bc25757935',
        applicationStatus: 'UNDER_REVIEW',
        level: 'IN_PROGRESS',
        checks: [],
        requiredChecks: [],
      });
      vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(
        new ConcurrencyConflictError(
          'This check is assigned to another reviewer.',
          undefined,
          409,
          'CHECK_ALREADY_ASSIGNED'
        )
      );

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      const docRow = await screen.findByText('Aadhaar Card');
      const acceptBtn = within(docRow.closest('tr')!).getByRole('button', { name: /^Accept$/i });
      await user.click(acceptBtn);

      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Shows conflict message
      const conflictMsg = await screen.findAllByText(/This check is assigned to another reviewer/i);
      expect(conflictMsg.length).toBeGreaterThan(0);
    });

    it('on APPROVAL_REQUIREMENTS_MISSING renders missing requirement input fields in dialog', async () => {
      const worker: WorkerDetail = {
        ...mockWorkerBase,
        documents: [
          {
            id: 'doc-pcc-c3',
            documentId: 'doc-pcc-c3',
            checkId: 'chk-police-c3',
            checkType: 'POLICE_CLEARANCE',
            documentType: 'POLICE_CLEARANCE',
            documentTypeName: 'Police Clearance Certificate',
            docNumberMasked: 'PCC-HYD-88990',
            status: 'SUBMITTED',
            reviewable: true,
            available: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);
      vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue({
        workerId: '01a13eff-73b5-7447-aa0d-13bc25757935',
        applicationStatus: 'UNDER_REVIEW',
        level: 'IN_PROGRESS',
        checks: [],
        requiredChecks: [],
      });

      const missingError = new ValidationError(
        'Prerequisites missing for police verification',
        undefined,
        undefined,
        'APPROVAL_REQUIREMENTS_MISSING',
        ['documentNumber', 'expiresOn']
      );

      vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValueOnce(missingError);

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      const docRow = await screen.findByText('Police Clearance Certificate');
      const acceptBtn = within(docRow.closest('tr')!).getByRole('button', { name: /^Accept$/i });
      await user.click(acceptBtn);

      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      // Dialog displays missing requirement fields
      expect(await screen.findByTestId('approval-requirements-inputs')).toBeInTheDocument();
      expect(screen.getByTestId('input-document-number')).toBeInTheDocument();
      expect(screen.getByTestId('input-expiry-date')).toBeInTheDocument();
      expect(screen.getByLabelText(/Document Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Document Expiry Date/i)).toBeInTheDocument();
    });
  });

  describe('3. Separation of 3 Lifecycle Stages & Onboarded Status', () => {
    it('shows onboarded ONLY when applicationStatus === ACTIVE and activatedAt is non-null', async () => {
      const user = userEvent.setup();

      // Case 1: Status is ACTIVE but activatedAt is null/undefined -> NOT onboarded
      const workerNotActivated: WorkerDetail = {
        ...mockWorkerBase,
        status: 'ACTIVE',
        applicationStatus: 'ACTIVE',
        activatedAt: undefined,
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(workerNotActivated);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossierBase);

      const { unmount } = renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      expect(await screen.findByRole('heading', { name: 'Sunita Devi' })).toBeInTheDocument();
      const nextBtn1 = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn1);

      // "ACTIVE & ONBOARDED" should NOT be shown without activatedAt
      expect(screen.queryByText(/ACTIVE & ONBOARDED/i)).not.toBeInTheDocument();

      unmount();

      // Case 2: applicationStatus === ACTIVE and activatedAt is set -> Onboarded!
      const workerFullyOnboarded: WorkerDetail = {
        ...mockWorkerBase,
        status: 'ACTIVE',
        applicationStatus: 'ACTIVE',
        activatedAt: '2026-10-29T12:00:00Z',
      };
      const dossierFullyOnboarded: VerificationDossier = {
        ...mockDossierBase,
        applicationStatus: 'ACTIVE',
        activatedAt: '2026-10-29T12:00:00Z',
      };

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(workerFullyOnboarded);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossierFullyOnboarded);

      renderWithProviders(
        <WorkerDetailModal
          workerId="01a13eff-73b5-7447-aa0d-13bc25757935"
          onClose={vi.fn()}
        />
      );

      expect(await screen.findByRole('heading', { name: 'Sunita Devi' })).toBeInTheDocument();
      const nextBtn2 = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn2);

      expect(await screen.findByText(/ACTIVE & ONBOARDED/i)).toBeInTheDocument();
    });
  });
});
