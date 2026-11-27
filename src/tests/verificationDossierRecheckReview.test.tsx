import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier } from '../features/verification/domain/types';
import { ConcurrencyConflictError } from '../core/errors/DomainError';

const createTestDossier = (overrides?: Partial<VerificationDossier>): VerificationDossier => ({
  id: 'dossier-recheck-test',
  workerId: 'w-recheck-001',
  applicationId: 'APP-RECHECK-001',
  checkId: 'chk-identity-001',
  workerName: 'Vishnu Kumar',
  category: 'General Housekeeper',
  skills: ['Cleaning', 'Cooking'],
  locality: 'Madhapur, Hyderabad',
  experienceYears: 3,
  phoneMasked: '+91 98765 *****',
  phone: '+91 98765 43210',
  submissionTime: '2026-11-20T09:00:00Z',
  status: 'IN_REVIEW',
  preCheckOtpVerified: true,
  submittedDocuments: [
    {
      id: '01a21b4a-c2ce-769c-b1de-1a444a023b96',
      documentId: '01a21b4a-c2ce-769c-b1de-1a444a023b96',
      checkId: 'chk-identity-001',
      checkType: 'IDENTITY',
      checkTitle: 'Identity Proof',
      documentTypeName: 'Identity Proof',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1300,
      status: 'IN_REVIEW',
      reviewable: true,
      available: true,
    },
    {
      id: '01a21b4a-cb14-742c-b773-4f6a87fb438b',
      documentId: '01a21b4a-cb14-742c-b773-4f6a87fb438b',
      checkId: 'chk-address-001',
      checkType: 'ADDRESS',
      checkTitle: 'Address Proof',
      documentTypeName: 'Address Proof',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      sizeBytes: 2400,
      status: 'APPROVED',
      reviewable: true,
      available: true,
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-identity-001',
      checkId: 'chk-identity-001',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'IN_REVIEW',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      history: [
        {
          fromStatus: 'APPROVED',
          toStatus: 'IN_REVIEW',
          actorUserId: 'admin-1',
          actorName: 'Verification Executive',
          remarks: '2123555555555555555555555555555555555555555555555555555555555555555555555555',
          createdAt: '2026-11-21T10:00:00Z',
        },
      ],
      documentMetadata: {
        documentId: '01a21b4a-c2ce-769c-b1de-1a444a023b96',
        documentTypeName: 'Identity Proof',
        contentType: 'application/pdf',
        sizeBytes: 1300,
      },
    },
    ADDRESS: {
      id: 'chk-address-001',
      checkId: 'chk-address-001',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      verifiedAt: '2026-11-21T10:15:00Z',
      verifiedBy: 'admin-1',
      documentMetadata: {
        documentId: '01a21b4a-cb14-742c-b773-4f6a87fb438b',
        documentTypeName: 'Address Proof',
        contentType: 'image/jpeg',
        sizeBytes: 2400,
      },
    },
  },
  ...overrides,
});

describe('Verification Dossier — Documents Review UI & Re-verification Lifecycle', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();

    useAuthStore.setState({
      user: {
        id: 'VERIF-EXEC-01',
        name: 'Verification Executive',
        email: 'verification.executive@sevanest.example.com',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('1. wraps very long re-verification reasons within the document card without overflow', async () => {
    const user = userEvent.setup();
    const dossier = createTestDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    render(
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

    // Navigate to Step 2: Documents Review
    await user.click(await screen.findByTestId('step-bubble-2'));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Check the identity card containing the long re-verification reason
    const idCard = screen.getByTestId('document-box-01a21b4a-c2ce-769c-b1de-1a444a023b96');
    expect(idCard).toBeInTheDocument();

    // Verify card has minWidth: 0 to prevent grid column blowout
    expect(idCard).toHaveStyle({ overflow: 'hidden' });
    expect(idCard.style.minWidth).toBe('0');

    // Verify the re-verification reason element has word break / overflow wrap styles
    const reasonContainer = within(idCard).getByTestId('recheck-reason-01a21b4a-c2ce-769c-b1de-1a444a023b96');
    expect(reasonContainer).toBeInTheDocument();
    expect(reasonContainer).toHaveStyle({
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
    });

    // Verify full reason text is preserved and accessible
    expect(reasonContainer).toHaveTextContent(
      '2123555555555555555555555555555555555555555555555555555555555555555555555555'
    );
  });

  it('2. requests re-verification for an eligible document submitting the correct checkId and reason', async () => {
    const user = userEvent.setup();
    let currentDossier = createTestDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () => currentDossier);

    const recheckSpy = vi.spyOn(verificationRepository, 'requestReVerification').mockImplementation(
      async (checkId, _checkTypes, instructions) => {
        currentDossier = {
          ...currentDossier,
          checks: {
            ...currentDossier.checks,
            ADDRESS: {
              ...currentDossier.checks.ADDRESS,
              status: 'IN_REVIEW',
              history: [
                {
                  fromStatus: 'APPROVED',
                  toStatus: 'IN_REVIEW',
                  actorUserId: 'VERIF-EXEC-01',
                  actorName: 'Verification Executive',
                  remarks: instructions || 'Address proof scan is blurry',
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          },
        };
        return {
          workerId: currentDossier.workerId,
          level: 'IN_PROGRESS',
          requiredChecks: ['IDENTITY', 'ADDRESS'],
          checks: [
            {
              checkId,
              checkType: 'ADDRESS',
              status: 'IN_REVIEW',
              required: true,
              history: [
                {
                  fromStatus: 'APPROVED',
                  toStatus: 'IN_REVIEW',
                  actorUserId: 'VERIF-EXEC-01',
                  remarks: instructions,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          ],
        };
      }
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkerVerificationReviewModal
            dossierId={currentDossier.workerId}
            initialDossier={currentDossier}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId('step-bubble-2'));

    // Address card is APPROVED and eligible for re-verification
    const addrCard = screen.getByTestId('document-box-01a21b4a-cb14-742c-b773-4f6a87fb438b');
    const reqBtn = within(addrCard).getByTestId('request-reverification-doc-01a21b4a-cb14-742c-b773-4f6a87fb438b');
    expect(reqBtn).toBeInTheDocument();

    await user.click(reqBtn);

    // Confirm dialog appears
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Re-verification/i });
    expect(confirmBtn).toBeDisabled();

    // Type mandatory reason
    const reasonInput = screen.getByPlaceholderText(/Enter reason \/ instructions for re-verification/i);
    await user.type(reasonInput, 'Electricity bill is older than 3 months. Upload latest bill.');
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);

    // Correct checkId 'chk-address-001' and reason submitted
    await waitFor(() => {
      expect(recheckSpy).toHaveBeenCalledWith(
        'chk-address-001',
        ['ADDRESS'],
        'Electricity bill is older than 3 months. Upload latest bill.'
      );
    });

    // Successful request updates status and displays pending state
    await waitFor(() => {
      expect(screen.getByTestId('recheck-pending-badge-ADDRESS')).toHaveTextContent('Re-verification Pending');
      expect(
        within(addrCard).getByTestId('recheck-pending-btn-01a21b4a-cb14-742c-b773-4f6a87fb438b')
      ).toBeDisabled();
      expect(
        within(addrCard).queryByTestId('request-reverification-doc-01a21b4a-cb14-742c-b773-4f6a87fb438b')
      ).not.toBeInTheDocument();
    });
  });

  it('3. shows clear error on API failure without falsely displaying success or pending status', async () => {
    const user = userEvent.setup();
    const dossier = createTestDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    vi.spyOn(verificationRepository, 'requestReVerification').mockRejectedValue(
      new ConcurrencyConflictError('A check that is IN_REVIEW cannot move to IN_REVIEW (allowed from: APPROVED).', {
        statusCode: 409,
        errorCode: 'INVALID_TRANSITION',
      })
    );

    render(
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

    await user.click(await screen.findByTestId('step-bubble-2'));
    const addrCard = screen.getByTestId('document-box-01a21b4a-cb14-742c-b773-4f6a87fb438b');
    const reqBtn = within(addrCard).getByTestId('request-reverification-doc-01a21b4a-cb14-742c-b773-4f6a87fb438b');
    await user.click(reqBtn);

    const reasonInput = await screen.findByPlaceholderText(/Enter reason \/ instructions for re-verification/i);
    await user.type(reasonInput, 'Attempting re-verification');
    await user.click(screen.getByRole('button', { name: /Confirm Re-verification/i }));

    // Error message is displayed
    expect(
      (await screen.findAllByText(/cannot move to IN_REVIEW \(allowed from: APPROVED\)/i)).length
    ).toBeGreaterThan(0);

    // Status is not falsely changed to pending
    expect(screen.queryByTestId('recheck-pending-badge-ADDRESS')).not.toBeInTheDocument();
  });

  it('4. prevents duplicate requests: already-pending documents show disabled button and block re-submission', async () => {
    const user = userEvent.setup();
    const dossier = createTestDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    render(
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

    await user.click(await screen.findByTestId('step-bubble-2'));

    // Identity document is already pending re-verification
    const idCard = screen.getByTestId('document-box-01a21b4a-c2ce-769c-b1de-1a444a023b96');

    // Shows Re-verification Pending badge
    expect(within(idCard).getByTestId('recheck-pending-badge-IDENTITY')).toHaveTextContent('Re-verification Pending');

    // Shows disabled Re-verification Pending button, NOT Request Re-verification
    const disabledBtn = within(idCard).getByTestId('recheck-pending-btn-01a21b4a-c2ce-769c-b1de-1a444a023b96');
    expect(disabledBtn).toBeDisabled();
    expect(disabledBtn).toHaveTextContent('Re-verification Pending');
    expect(
      within(idCard).queryByTestId('request-reverification-doc-01a21b4a-c2ce-769c-b1de-1a444a023b96')
    ).not.toBeInTheDocument();
  });
});
