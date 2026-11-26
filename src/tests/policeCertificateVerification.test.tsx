/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { verificationRepository, RealVerificationRepository } from '../features/verification/data/verificationRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ConcurrencyConflictError, NotFoundError, ValidationError } from '../core/errors/DomainError';
import { VerificationDossier } from '../features/verification/domain/types';

function renderReviewModal(dossier: VerificationDossier) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkerVerificationReviewModal
          dossierId={dossier.workerId}
          initialDossier={dossier}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderDetailModal(workerId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkerDetailModal workerId={workerId} initialStep="digital-docs" onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function createPoliceDossier(overrides?: Partial<VerificationDossier>): VerificationDossier {
  return {
    id: '01a1b06d-41b8-7369-83d4-0b48dc4701d9',
    workerId: '01a1b06d-41b8-7369-83d4-0b48dc4701d9',
    workerName: 'Charan',
    category: 'Housekeeping',
    locality: 'Hyderabad',
    experienceYears: 3,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-11-04T18:36:37.074Z',
    status: 'PENDING_REVIEW',
    applicationStatus: 'UNDER_REVIEW',
    preCheckOtpVerified: true,
    requiredChecks: ['IDENTITY'],
    submittedDocuments: [
      {
        id: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
        documentId: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
        checkId: '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
        checkType: 'POLICE_CLEARANCE',
        checkTitle: 'Police Clearance Certificate',
        documentTypeName: 'Police Clearance Certificate',
        contentType: 'image/jpeg',
        mimeType: 'image/jpeg',
        sizeBytes: 366033,
        status: 'UPLOADED',
        availability: 'AVAILABLE',
        available: true,
        reviewable: true,
      },
    ],
    checks: {
      IDENTITY: {
        id: 'chk-id-1',
        type: 'IDENTITY',
        title: 'Identity Proof',
        status: 'APPROVED',
        required: true,
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
      ADDRESS: {
        id: 'chk-addr-1',
        type: 'ADDRESS',
        title: 'Address Proof',
        status: 'APPROVED',
        required: false,
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
      EMERGENCY_CONTACT: {
        id: 'chk-em-1',
        type: 'EMERGENCY_CONTACT',
        title: 'Emergency Contact',
        status: 'APPROVED',
        required: false,
        evaluationMethod: 'TELEPHONIC_VETTING',
      },
      REFERENCE: {
        id: 'chk-ref-1',
        type: 'REFERENCE',
        title: 'Employer Reference',
        status: 'APPROVED',
        required: false,
        evaluationMethod: 'TELEPHONIC_VETTING',
      },
      POLICE_CLEARANCE: {
        id: '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
        type: 'POLICE_CLEARANCE',
        title: 'Police Clearance Certificate',
        status: 'SUBMITTED',
        required: false,
        evaluationMethod: 'CERTIFICATE_TRACKING',
        documents: [
          {
            id: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
            documentId: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
            checkId: '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
            checkType: 'POLICE_CLEARANCE',
            documentTypeName: 'Police Clearance Certificate',
            contentType: 'image/jpeg',
            mimeType: 'image/jpeg',
            sizeBytes: 366033,
            status: 'UPLOADED',
            availability: 'AVAILABLE',
            available: true,
            reviewable: true,
          },
        ],
      },
    } as VerificationDossier['checks'],
    ...overrides,
  };
}

describe('Police Certificate Document Preview & Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-exec-01',
        email: 'verification.executive@sevanest.example.com',
        name: 'Verification Executive',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('ignores DISCARDED PENDING_UPLOAD stubs and resolves the active POLICE_VERIFICATION document in RealVerificationRepository', async () => {
    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/verification')) {
        return {
          data: {
            workerId: 'wrk-pol-1',
            applicationStatus: 'SUBMITTED',
            requiredChecks: ['IDENTITY'],
            checks: [
              {
                checkId: 'chk-pol-99',
                checkType: 'POLICE_VERIFICATION',
                status: 'SUBMITTED',
                required: false,
                documents: [
                  {
                    id: 'doc-stub-1',
                    documentId: 'doc-stub-1',
                    status: 'PENDING_UPLOAD',
                    availability: 'DISCARDED',
                    available: false,
                    reviewable: false,
                    contentType: 'image/jpeg',
                    sizeBytes: 47,
                  },
                  {
                    id: 'doc-real-pdf',
                    documentId: 'doc-real-pdf',
                    status: 'UPLOADED',
                    availability: 'AVAILABLE',
                    available: true,
                    reviewable: true,
                    contentType: 'application/pdf',
                    sizeBytes: 24500,
                    documentTypeName: 'Police Clearance Certificate',
                  },
                ],
              },
            ],
          },
        } as any;
      }
      return { data: { id: 'wrk-pol-1', name: 'Test Worker', mobile: '+919999999999' } } as any;
    });

    const repo = new RealVerificationRepository();
    const dossier = await repo.getDossierById('wrk-pol-1');

    expect(dossier).not.toBeNull();
    expect(dossier?.checks.POLICE_CLEARANCE.id).toBe('chk-pol-99');
    expect(dossier?.checks.POLICE_CLEARANCE.documentMetadata?.documentId).toBe('doc-real-pdf');
    expect(dossier?.submittedDocuments).toHaveLength(1);
    expect(dossier?.submittedDocuments?.[0].documentId).toBe('doc-real-pdf');
    expect(dossier?.submittedDocuments?.[0].checkType).toBe('POLICE_CLEARANCE');
  });

  it('opens and previews an uploaded Police Certificate document in WorkerVerificationReviewModal', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://dufqgsgcymrasyxpvbiz.storage.supabase.co/storage/v1/s3/kyc-documents/pcc.jpg',
      mimeType: 'image/jpeg',
      expiresAt: '2026-11-25T12:00:00Z',
    });

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const viewBtn = await screen.findByTestId('view-document-btn-01a1b9dd-b836-7621-b8cb-0e90d1a8895e');
    await user.click(viewBtn);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith(
        '01a1b06d-41b8-7369-83d4-0b48dc4701d9',
        'POLICE_CLEARANCE',
        '01a1b9dd-b836-7621-b8cb-0e90d1a8895e'
      );
      expect(screen.getByTestId('kyc-document-image')).toHaveAttribute(
        'src',
        'https://dufqgsgcymrasyxpvbiz.storage.supabase.co/storage/v1/s3/kyc-documents/pcc.jpg'
      );
    });
  });

  it('shows clear missing document notice when Police Certificate has no uploaded document and makes no signed-link call', async () => {
    const dossier = createPoliceDossier({
      submittedDocuments: [],
      checks: {
        ...createPoliceDossier().checks,
        POLICE_CLEARANCE: {
          id: '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'SUBMITTED',
          required: false,
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documents: [],
        },
      } as VerificationDossier['checks'],
    });

    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl');

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    expect(await screen.findByTestId('verification-doc-missing-id')).toBeInTheDocument();
    expect(linkSpy).not.toHaveBeenCalled();

    // Still allows advancing to Step 3 for manual verification
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    const polCard = await screen.findByTestId('check-card-POLICE_CLEARANCE');
    expect(within(polCard).queryByTestId('open-document-POLICE_CLEARANCE')).not.toBeInTheDocument();
    expect(within(polCard).getByRole('button', { name: /Approve Check/i })).toBeInTheDocument();
  });

  it('displays clear error when Police Certificate file is missing or inaccessible in storage without marking verified', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValue(
      new NotFoundError('The document file is missing from storage.', 'req-1', 'DOCUMENT_OBJECT_MISSING')
    );

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(await screen.findByTestId('view-document-btn-01a1b9dd-b836-7621-b8cb-0e90d1a8895e'));

    const errContainer = await screen.findByTestId('document-vault-error-container');
    expect(errContainer).toHaveTextContent(/Document Missing from Storage/i);
    expect(within(errContainer).getByRole('button', { name: /Retry Document Access/i })).toBeInTheDocument();
    expect(dossier.checks.POLICE_CLEARANCE.status).toBe('SUBMITTED');
  });

  it('executes SUBMITTED -> IN_REVIEW -> document-details -> APPROVED with recheckAt when verifying Police Certificate', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const callOrder: string[] = [];
    const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockImplementation(async () => {
      callOrder.push('start-review');
      return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
    });
    const detailsSpy = vi.spyOn(verificationRepository, 'updateDocumentDetails').mockImplementation(async () => {
      callOrder.push('document-details');
    });
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockImplementation(async () => {
      callOrder.push('approve');
      return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
    });

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const polCard = await screen.findByTestId('check-card-POLICE_CLEARANCE');
    await user.click(within(polCard).getByRole('button', { name: /Approve Check/i }));

    await user.type(await screen.findByTestId('police-ref-number-input'), 'PCC-HYD-2026-4455');
    await user.type(screen.getByTestId('police-expiry-date-input'), '2028-12-31');
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith('01a1b9dd-b827-71dc-8492-6edd3ec7943c');
      expect(detailsSpy).toHaveBeenCalledWith('01a1b9dd-b827-71dc-8492-6edd3ec7943c', {
        documentNumber: 'PCC-HYD-2026-4455',
        expiresOn: '2028-12-31',
      });
      expect(approveSpy).toHaveBeenCalledWith(
        '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
        'POLICE_CLEARANCE',
        'Verified authentic by Verification Executive',
        expect.objectContaining({
          referenceNumber: 'PCC-HYD-2026-4455',
          documentNumber: 'PCC-HYD-2026-4455',
          expiresOn: '2028-12-31',
          recheckAt: '2028-12-31',
        })
      );
      expect(callOrder).toEqual(['start-review', 'document-details', 'approve']);
    });
  });

  it('surfaces updateDocumentDetails validation error and does NOT call approveCheck when document-details fails', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue({
      workerId: dossier.workerId,
      level: 'IN_PROGRESS',
      requiredChecks: ['IDENTITY'],
      checks: [],
    });
    vi.spyOn(verificationRepository, 'updateDocumentDetails').mockRejectedValue(
      new ValidationError('expiresOn must be a future date')
    );
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const polCard = await screen.findByTestId('check-card-POLICE_CLEARANCE');
    await user.click(within(polCard).getByRole('button', { name: /Approve Check/i }));

    // Client-side validation catches past date before API call
    await user.type(await screen.findByTestId('police-ref-number-input'), 'PCC-HYD-2026-4455');
    await user.type(screen.getByTestId('police-expiry-date-input'), '2020-01-01');
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    expect(await screen.findByText(/Certificate Expiration Date must be a future date/i)).toBeInTheDocument();
    expect(approveSpy).not.toHaveBeenCalled();

    // Even if backend rejects future date (e.g. server validation error), approveCheck must NOT be called
    await user.clear(screen.getByTestId('police-expiry-date-input'));
    await user.type(screen.getByTestId('police-expiry-date-input'), '2028-12-31');
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Approval failed: expiresOn must be a future date/i).length).toBeGreaterThan(0);
    });
    expect(approveSpy).not.toHaveBeenCalled();
  });

  it('rejects Police Certificate via SUBMITTED -> IN_REVIEW -> REJECTED transition', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const callOrder: string[] = [];
    vi.spyOn(verificationRepository, 'claimCheck').mockImplementation(async () => {
      callOrder.push('start-review');
      return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
    });
    const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck').mockImplementation(async () => {
      callOrder.push('reject');
      return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
    });

    const user = userEvent.setup();
    renderReviewModal(dossier);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const polCard = await screen.findByTestId('check-card-POLICE_CLEARANCE');
    await user.click(within(polCard).getByRole('button', { name: /Reject Check/i }));

    await user.type(await screen.findByPlaceholderText(/Enter mandatory operational remarks/i), 'Blurred police seal');
    await user.click(screen.getByTestId('confirm-destructive-checkbox'));
    await user.click(screen.getByRole('button', { name: /Confirm Rejection/i }));

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(
        '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
        'POLICE_CLEARANCE',
        'BLURRY_IMAGE',
        'Blurred police seal'
      );
      expect(callOrder).toEqual(['start-review', 'reject']);
    });
  });

  it('WorkerDetailModal calls start-review BEFORE updateDocumentDetails when Police Certificate is SUBMITTED', async () => {
    const dossier = createPoliceDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      id: dossier.workerId,
      name: 'Charan',
      category: 'Housekeeping',
      categories: ['Housekeeping'],
      experienceYears: 3,
      ratingAverage: 0,
      totalReviews: 0,
      locality: 'Hyderabad',
      serviceRadiusKm: 10,
      languages: ['Hindi'],
      bio: '',
      isFullyVerified: false,
      status: 'ACTIVE',
      onboardingStatus: 'IN_REVIEW',
      phoneMasked: '+91 98765 *****',
      documents: [
        {
          id: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
          documentId: '01a1b9dd-b836-7621-b8cb-0e90d1a8895e',
          checkId: '01a1b9dd-b827-71dc-8492-6edd3ec7943c',
          checkType: 'POLICE_CLEARANCE',
          documentType: 'POLICE_CLEARANCE',
          documentTypeName: 'Police Clearance Certificate',
          status: 'SUBMITTED',
          contentType: 'image/jpeg',
          mimeType: 'image/jpeg',
          reviewable: true,
          available: true,
        },
      ],
      activeEngagementsCount: 0,
      completedBookingsCount: 0,
      replacementsIncurred: 0,
      recentEngagements: [],
      internalNotes: [],
      verification: {
        phoneOtpVerified: true,
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'VERIFIED',
        criminalRecordStatus: 'PENDING',
        skillProofStatus: 'NOT_APPLICABLE',
        referenceCheckStatus: 'VERIFIED',
      },
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const callOrder: string[] = [];
    vi.spyOn(verificationRepository, 'claimCheck').mockImplementation(async () => {
      callOrder.push('start-review');
      return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
    });
    vi.spyOn(verificationRepository, 'updateDocumentDetails').mockImplementation(async () => {
      if (!callOrder.includes('start-review')) {
        throw new ConcurrencyConflictError(
          'Only a check that is IN_REVIEW can be edited by a reviewer (this one is SUBMITTED)',
          undefined,
          409,
          'INVALID_TRANSITION'
        );
      }
      callOrder.push('document-details');
    });
    vi.spyOn(verificationRepository, 'approveCheck')
      .mockRejectedValueOnce(
        new ValidationError('This check cannot be approved yet (Missing fields: referenceNumber, expiresOn)', {
          errorCode: 'APPROVAL_REQUIREMENTS_MISSING',
          details: ['referenceNumber', 'expiresOn'],
        })
      )
      .mockImplementation(async () => {
        callOrder.push('approve');
        return { workerId: dossier.workerId, level: 'IN_PROGRESS', requiredChecks: ['IDENTITY'], checks: [] };
      });

    const user = userEvent.setup();
    renderDetailModal(dossier.workerId);

    const pccRow = (await screen.findByText('Police Clearance Certificate')).closest('tr');
    await user.click(within(pccRow!).getByRole('button', { name: /^accept$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await user.type(await screen.findByTestId('input-document-number'), 'PCC-HYD-2026-8899');
    await user.type(screen.getByTestId('input-expiry-date'), '2028-12-31');
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      expect(callOrder[0]).toBe('start-review');
      expect(callOrder).toContain('document-details');
      expect(callOrder[callOrder.length - 1]).toBe('approve');
    });
  });
});

