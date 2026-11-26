import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import {
  verificationRepository,
  RealVerificationRepository,
  mapCheckStatus,
  mapChecks,
} from '../features/verification/data/verificationRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';
import { AdminWorkerVerificationResponse, VerificationCheckEvent, VerificationDossier } from '../features/verification/domain/types';
import { WorkerDetail } from '../features/workers/domain/types';
import { ConcurrencyConflictError } from '../core/errors/DomainError';

const createTestDossier = (overrides?: Partial<VerificationDossier>): VerificationDossier => ({
  id: 'dossier-recheck-1',
  workerId: 'w-recheck-001',
  applicationId: 'APP-RECHECK-001',
  checkId: 'chk-identity-001',
  workerName: 'Kavita Sharma',
  category: 'House Maid',
  skills: ['Cooking', 'Cleaning'],
  locality: 'Madhapur, Hyderabad',
  experienceYears: 4,
  phoneMasked: '+91 98765 *****',
  phone: '+91 98765 43210',
  submissionTime: '2026-11-20T09:00:00Z',
  status: 'IN_REVIEW',
  preCheckOtpVerified: true,
  submittedDocuments: [
    {
      id: 'doc-aadhaar-001',
      documentId: 'doc-aadhaar-001',
      checkId: 'chk-identity-001',
      checkType: 'IDENTITY',
      checkTitle: 'Identity Proof',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-9988',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      status: 'VERIFIED',
      submittedAt: '2026-11-20T09:00:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-address-001',
      documentId: 'doc-address-001',
      checkId: 'chk-address-001',
      checkType: 'ADDRESS',
      checkTitle: 'Address Proof',
      documentTypeName: 'Electricity Bill',
      docNumberMasked: 'EB-4455',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      status: 'SUBMITTED',
      submittedAt: '2026-11-20T09:05:00Z',
      reviewable: true,
      available: true,
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-identity-001',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      verifiedAt: '2026-11-21T10:00:00Z',
      verifiedBy: 'adm-verifier',
      documentMetadata: {
        documentId: 'doc-aadhaar-001',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-9988',
        nameOnDoc: 'Kavita Sharma',
      },
      history: [
        {
          action: 'APPROVED',
          fromStatus: 'IN_REVIEW',
          toStatus: 'APPROVED',
          actorUserId: 'adm-verifier',
          createdAt: '2026-11-21T10:00:00Z',
          remarks: 'Audit trail entry that should not clutter Step 3',
        },
      ],
    },
    ADDRESS: {
      id: 'chk-address-001',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'SUBMITTED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-address-001',
        documentTypeName: 'Electricity Bill',
        docNumberMasked: 'EB-4455',
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-ec-001',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact',
      status: 'SUBMITTED',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Ramesh Sharma',
        relationshipOrRole: 'Husband',
        phoneMasked: '+91 90000 *****',
      },
    },
    REFERENCE: {
      id: 'chk-ref-001',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'SUBMITTED',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Dr. Nair',
        relationshipOrRole: 'Former Employer',
        phoneMasked: '+91 91111 *****',
      },
    },
    POLICE_CLEARANCE: {
      id: 'chk-pcc-001',
      type: 'POLICE_CLEARANCE',
      title: 'Police Certificate',
      status: 'SUBMITTED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
    },
  },
  ...overrides,
});

const createTestWorkerDetail = (): WorkerDetail => ({
  id: 'w-recheck-001',
  name: 'Kavita Sharma',
  phoneMasked: '+91 98765 *****',
  category: 'House Maid',
  locality: 'Madhapur',
  skills: ['Cooking'],
  experienceYears: 4,
  ratingAverage: 0,
  totalReviews: 0,
  isFullyVerified: false,
  status: 'UNDER_REVIEW',
  serviceRadiusKm: 10,
  languages: ['Hindi'],
  bio: 'Experienced domestic helper',
  activeEngagementsCount: 0,
  completedBookingsCount: 0,
  replacementsIncurred: 0,
  recentEngagements: [],
  internalNotes: [],
  verificationStatus: 'IN_REVIEW',
  verificationLevel: 'IN_PROGRESS',
  accountStatus: 'ACTIVE',
  verification: {
    phoneOtpVerified: true,
    identityProofStatus: 'VERIFIED',
    addressProofStatus: 'PENDING',
    criminalRecordStatus: 'PENDING',
    skillProofStatus: 'NOT_APPLICABLE',
    referenceCheckStatus: 'PENDING',
  },
  documents: [
    {
      id: 'doc-aadhaar-001',
      documentId: 'doc-aadhaar-001',
      checkId: 'chk-identity-001',
      checkType: 'IDENTITY',
      documentType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-9988',
      status: 'VERIFIED',
      submittedAt: '2026-11-20T09:00:00Z',
    },
    {
      id: 'doc-address-001',
      documentId: 'doc-address-001',
      checkId: 'chk-address-001',
      checkType: 'ADDRESS',
      documentType: 'ADDRESS',
      documentTypeName: 'Electricity Bill',
      docNumberMasked: 'EB-4455',
      status: 'SUBMITTED',
      submittedAt: '2026-11-20T09:05:00Z',
    },
  ],
});

describe('Simplified KYC Verification Page & Document Re-verification', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    useAuthStore.setState({
      user: {
        id: 'adm-verifier',
        name: 'Verification Executive',
        email: 've@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });

    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://vault.sevanest.internal/doc-aadhaar-001.jpg',
      expiresAt: '2026-12-01T00:00:00Z',
      mimeType: 'image/jpeg',
    });
  });

  describe('1. Simplified KYC Verification Page (Step 3)', () => {
    it('displays only check names with Approve and Reject buttons and removes audit history and metadata clutter', async () => {
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

      const step3Container = await screen.findByTestId('step-bubble-3');
      await user.click(step3Container);

      const simplifiedPage = await screen.findByTestId('simplified-kyc-verification-page');
      expect(simplifiedPage).toBeInTheDocument();

      // Check names visible
      expect(within(simplifiedPage).getByRole('heading', { name: 'Identity Proof' })).toBeInTheDocument();
      expect(within(simplifiedPage).getByRole('heading', { name: 'Address Proof' })).toBeInTheDocument();
      expect(within(simplifiedPage).getByRole('heading', { name: 'Emergency Contact' })).toBeInTheDocument();
      expect(within(simplifiedPage).getByRole('heading', { name: 'Employer Reference' })).toBeInTheDocument();
      expect(within(simplifiedPage).getByRole('heading', { name: 'Police Certificate' })).toBeInTheDocument();

      // Pending check displays ONLY Approve and Reject buttons
      const addrCard = within(simplifiedPage).getByTestId('check-card-ADDRESS');
      expect(within(addrCard).getByRole('button', { name: /Approve Check/i })).toBeInTheDocument();
      expect(within(addrCard).getByRole('button', { name: /Reject Check/i })).toBeInTheDocument();
      expect(within(addrCard).queryByRole('button', { name: /Start Review|Release Review|Open Document|Request Re-verification/i })).not.toBeInTheDocument();

      // Clutter removed: audit trail, pre-check banner, method labels, metadata
      expect(screen.queryByText(/Verification Audit History/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Audit trail entry that should not clutter Step 3/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Mobile OTP Pre-Check/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Method:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ramesh Sharma/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dr\. Nair/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/XXXX-XXXX-9988/i)).not.toBeInTheDocument();

      // Previous & Next navigation preserved
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('button', { name: /^Previous$/i })).toBeEnabled();
      expect(within(dialog).getByRole('button', { name: /^Next$/i })).toBeDisabled();
    });

    it('preserves functional Approve and Reject mutations with backend transitions and RBAC enforcement', async () => {
      const user = userEvent.setup();
      const dossier = createTestDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();
      const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck').mockResolvedValue();

      const { rerender } = render(
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

      await user.click(await screen.findByTestId('step-bubble-3'));
      const addrCard = await screen.findByTestId('check-card-ADDRESS');

      await user.click(within(addrCard).getByRole('button', { name: /Approve Check/i }));
      await user.click(await screen.findByRole('button', { name: /Confirm Approval/i }));

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-address-001');
        expect(approveSpy).toHaveBeenCalledWith('chk-address-001', 'ADDRESS', expect.any(String));
      });

      // Reject emergency contact check
      const ecCard = screen.getByTestId('check-card-EMERGENCY_CONTACT');
      await user.click(within(ecCard).getByRole('button', { name: /Reject Check/i }));
      const remarksInput = await screen.findByPlaceholderText(/Enter mandatory operational remarks/i);
      await user.type(remarksInput, 'Contact unreachable after 3 attempts');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /Confirm Rejection/i }));

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-ec-001');
        expect(rejectSpy).toHaveBeenCalledWith(
          'chk-ec-001',
          'EMERGENCY_CONTACT',
          expect.any(String),
          'Contact unreachable after 3 attempts'
        );
      });

      // RBAC check: Operations Admin without VERIFICATION_DECIDE sees no Approve/Reject buttons
      useAuthStore.setState({
        user: {
          id: 'ops-1',
          name: 'Ops Admin',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
        },
        isAuthenticated: true,
        accessToken: 'test-token',
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkerVerificationReviewModal
              dossierId={dossier.workerId}
              initialDossier={createTestDossier()}
              onClose={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByRole('button', { name: /Approve Check/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject Check/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Document Re-verification Workflow & Backend Integration', () => {
    it('submits re-verification for an APPROVED document in Step 2, shows actual backend status, and prevents duplicates', async () => {
      const user = userEvent.setup();
      let currentDossier = createTestDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () => currentDossier);

      const historyEvents: VerificationCheckEvent[] = [
        {
          fromStatus: 'APPROVED',
          toStatus: 'IN_REVIEW',
          actorUserId: 'adm-verifier',
          remarks: 'Aadhaar photo expired; re-verify clear scan',
          createdAt: '2026-11-25T10:15:00Z',
        },
      ];
      const backendResponse: AdminWorkerVerificationResponse = {
        workerId: 'w-recheck-001',
        level: 'IN_PROGRESS',
        requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
        checks: [
          {
            checkId: 'chk-identity-001',
            checkType: 'IDENTITY',
            status: 'IN_REVIEW',
            required: true,
            remarks: null,
            recheckAt: null,
            history: historyEvents as unknown as Array<Record<string, unknown>>,
          },
        ],
      };

      const recheckSpy = vi.spyOn(verificationRepository, 'requestReVerification').mockImplementation(async () => {
        currentDossier = {
          ...currentDossier,
          checks: {
            ...currentDossier.checks,
            IDENTITY: {
              ...currentDossier.checks.IDENTITY,
              status: 'IN_REVIEW',
              history: historyEvents,
            },
          },
        };
        return backendResponse;
      });

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
      expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

      // Eligible APPROVED document has Request Re-verification button; non-approved ADDRESS doc does NOT
      const aadhaarBox = screen.getByTestId('document-box-doc-aadhaar-001');
      const addrBox = screen.getByTestId('document-box-doc-address-001');
      const recheckBtn = within(aadhaarBox).getByTestId('request-reverification-doc-doc-aadhaar-001');
      expect(within(addrBox).queryByTestId('request-reverification-doc-doc-address-001')).not.toBeInTheDocument();

      await user.click(recheckBtn);

      // Confirmation dialog requires reason
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Re-verification/i });
      expect(confirmBtn).toBeDisabled();

      const reasonInput = screen.getByPlaceholderText(/Enter reason \/ instructions for re-verification/i);
      await user.type(reasonInput, 'Aadhaar photo expired; re-verify clear scan');
      expect(confirmBtn).toBeEnabled();

      await user.click(confirmBtn);

      await waitFor(() => {
        expect(recheckSpy).toHaveBeenCalledWith(
          'chk-identity-001',
          ['IDENTITY'],
          'Aadhaar photo expired; re-verify clear scan'
        );
      });

      // Actual backend response displayed
      expect(
        await screen.findByText(/Backend status: IN_REVIEW \(Level: IN_PROGRESS\)/i)
      ).toBeInTheDocument();

      // Pending state shown & duplicate request button disabled/prevented
      await waitFor(() => {
        expect(screen.getByTestId('recheck-pending-badge-IDENTITY')).toHaveTextContent('Re-verification Pending');
        expect(screen.queryByTestId('request-reverification-doc-doc-aadhaar-001')).not.toBeInTheDocument();
        expect(screen.getByTestId('recheck-pending-btn-doc-aadhaar-001')).toBeDisabled();
      });
    });

    it('keeps dialog open and shows error without faking status when backend re-verification API fails', async () => {
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
      await user.click(await screen.findByTestId('request-reverification-doc-doc-aadhaar-001'));

      const reasonInput = await screen.findByPlaceholderText(/Enter reason \/ instructions for re-verification/i);
      await user.type(reasonInput, 'Invalid state attempt');
      await user.click(screen.getByRole('button', { name: /Confirm Re-verification/i }));

      // Real error displayed inside confirmation dialog; status NOT falsely changed to Re-verification Pending
      expect(
        (await screen.findAllByText(/cannot move to IN_REVIEW \(allowed from: APPROVED\)/i)).length
      ).toBeGreaterThan(0);
      expect(screen.queryByTestId('recheck-pending-badge-IDENTITY')).not.toBeInTheDocument();
    });

    it('supports Request Re-verification in WorkerDetailModal document table and reflects pending/resubmitted status', async () => {
      const user = userEvent.setup();
      let currentDossier = createTestDossier();
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(createTestWorkerDetail());
      vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () => currentDossier);
      const recheckSpy = vi.spyOn(verificationRepository, 'requestReVerification').mockImplementation(async () => {
        const updatedHistory = [
          {
            fromStatus: 'APPROVED',
            toStatus: 'IN_REVIEW',
            actorUserId: 'adm-verifier',
            remarks: 'Annual KYC renewal',
            createdAt: '2026-11-25T10:20:00Z',
          },
        ];
        currentDossier = {
          ...currentDossier,
          checks: {
            ...currentDossier.checks,
            IDENTITY: {
              ...currentDossier.checks.IDENTITY,
              status: 'IN_REVIEW',
              history: updatedHistory,
            },
          },
        };
        return {
          workerId: 'w-recheck-001',
          level: 'IN_PROGRESS',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-identity-001',
              checkType: 'IDENTITY',
              status: 'IN_REVIEW',
              required: true,
              history: updatedHistory,
            },
          ],
        };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkerDetailModal workerId="w-recheck-001" initialStep="digital-docs" onClose={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const recheckBtn = await screen.findByTestId('request-reverification-IDENTITY');
      expect(screen.queryByTestId('request-reverification-ADDRESS')).not.toBeInTheDocument();
      await user.click(recheckBtn);

      const reasonInput = await screen.findByPlaceholderText(/Enter reason for document re-verification/i);
      await user.type(reasonInput, 'Annual KYC renewal');
      await user.click(screen.getByRole('button', { name: /Confirm Re-verification/i }));

      await waitFor(() => {
        expect(recheckSpy).toHaveBeenCalledWith('chk-identity-001', ['IDENTITY'], 'Annual KYC renewal');
      });

      expect(await screen.findByTestId('pending-recheck-IDENTITY')).toHaveTextContent('Re-verification Pending');
      expect(screen.getByTestId('reverification-pending-btn-IDENTITY')).toBeDisabled();
    });

    it('calls exact backend endpoint POST /admin/verification/checks/{checkId}/recheck and enforces backend transition rules', async () => {
      const repo = new RealVerificationRepository();
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: {
          workerId: 'w-recheck-001',
          level: 'IN_PROGRESS',
          requiredChecks: ['IDENTITY'],
          checks: [
            {
              checkId: 'chk-identity-001',
              checkType: 'IDENTITY',
              status: 'IN_REVIEW',
              required: true,
              history: [
                {
                  fromStatus: 'APPROVED',
                  toStatus: 'IN_REVIEW',
                  actorUserId: 'adm-verifier',
                  remarks: 'Verify updated ID card',
                  createdAt: '2026-11-25T10:30:00Z',
                },
              ],
            },
          ],
        } as AdminWorkerVerificationResponse,
      } as never);

      const response = await repo.requestReVerification('chk-identity-001', ['IDENTITY'], 'Verify updated ID card');

      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-001/recheck', {
        remarks: 'Verify updated ID card',
      });
      expect(response.checks[0].status).toBe('IN_REVIEW');
      expect(response.checks[0].history?.[0].fromStatus).toBe('APPROVED');
    });
  });

  describe('3. Employer Reference & Commercial / Driving License Button Eligibility & Workflows', () => {
    it('preserves NOT_SUBMITTED status and required flags from backend verification checks', () => {
      expect(mapCheckStatus('NOT_SUBMITTED')).toBe('NOT_SUBMITTED');

      const mapped = mapChecks([
        { checkType: 'IDENTITY', checkId: 'chk-id-1', status: 'APPROVED', required: true },
        { checkType: 'PREVIOUS_EMPLOYMENT', checkId: '', status: 'NOT_SUBMITTED', required: false },
        { checkType: 'LICENSE', checkId: null, status: 'NOT_SUBMITTED', required: false },
      ]);

      expect(mapped.IDENTITY.status).toBe('APPROVED');
      expect(mapped.IDENTITY.required).toBe(true);
      expect(mapped.REFERENCE.status).toBe('NOT_SUBMITTED');
      expect(mapped.REFERENCE.required).toBe(false);
      expect(mapped.REFERENCE.id).toBeUndefined();
      expect(mapped.LICENSE.status).toBe('NOT_SUBMITTED');
      expect(mapped.LICENSE.required).toBe(false);
      expect(mapped.LICENSE.id).toBeUndefined();
    });

    it('renders Not Required without disabled Approve/Reject buttons when optional Employer Reference and License are NOT_SUBMITTED', async () => {
      const user = userEvent.setup();
      const mappedChecks = mapChecks([
        { checkType: 'IDENTITY', checkId: 'chk-hyy-id', status: 'APPROVED', required: true },
        { checkType: 'ADDRESS', checkId: 'chk-hyy-addr', status: 'APPROVED', required: false },
        { checkType: 'EMERGENCY_CONTACT', checkId: 'chk-hyy-ec', status: 'APPROVED', required: false },
        { checkType: 'PREVIOUS_EMPLOYMENT', checkId: '', status: 'NOT_SUBMITTED', required: false },
        { checkType: 'POLICE_VERIFICATION', checkId: 'chk-hyy-pcc', status: 'APPROVED', required: false },
        { checkType: 'SKILL_CERTIFICATE', checkId: 'chk-hyy-skill', status: 'APPROVED', required: false },
        { checkType: 'LICENSE', checkId: '', status: 'NOT_SUBMITTED', required: false },
      ]);

      const hyyDossier = createTestDossier({
        id: 'w-hyy-001',
        workerId: 'w-hyy-001',
        workerName: 'Hyy',
        status: 'IN_REVIEW',
        level: 'VERIFIED',
        requiredChecks: ['IDENTITY'],
        checks: mappedChecks,
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(hyyDossier);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkerVerificationReviewModal
              dossierId={hyyDossier.workerId}
              initialDossier={hyyDossier}
              onClose={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await user.click(await screen.findByTestId('step-bubble-3'));
      const simplifiedPage = await screen.findByTestId('simplified-kyc-verification-page');

      // Progress 2 of 2 (PHONE_OTP + IDENTITY) preserved cleanly
      expect(within(simplifiedPage).getByText(/2 of 2 Checks Approved/i)).toBeInTheDocument();
      expect(screen.getByText(/All 2 Mandatory KYC Verification Criteria Satisfied/i)).toBeInTheDocument();

      // Mandatory vs Optional clearly distinguished
      expect(within(simplifiedPage).getByTestId('check-requirement-IDENTITY')).toHaveTextContent('(Required)');
      expect(within(simplifiedPage).getByTestId('check-requirement-REFERENCE')).toHaveTextContent('(Optional)');
      expect(within(simplifiedPage).getByTestId('check-requirement-LICENSE')).toHaveTextContent('(Optional)');

      // Employer Reference and Commercial / Driving License show Not Required instead of disabled buttons
      const refCard = within(simplifiedPage).getByTestId('check-card-REFERENCE');
      const licCard = within(simplifiedPage).getByTestId('check-card-LICENSE');
      expect(within(refCard).getByText('Not Required')).toBeInTheDocument();
      expect(within(licCard).getByText('Not Required')).toBeInTheDocument();
      expect(within(refCard).queryByRole('button', { name: /Approve Check|Reject Check/i })).not.toBeInTheDocument();
      expect(within(licCard).queryByRole('button', { name: /Approve Check|Reject Check/i })).not.toBeInTheDocument();
    });

    it('renders Awaiting Submission without disabled buttons when a required check is NOT_SUBMITTED without checkId', async () => {
      const user = userEvent.setup();
      const mappedChecks = mapChecks([
        { checkType: 'IDENTITY', checkId: 'chk-drv-id', status: 'APPROVED', required: true },
        { checkType: 'LICENSE', checkId: '', status: 'NOT_SUBMITTED', required: true },
      ]);

      const driverDossier = createTestDossier({
        id: 'w-drv-awaiting',
        workerId: 'w-drv-awaiting',
        workerName: 'Driver Awaiting',
        category: 'Driver',
        status: 'PENDING_REVIEW',
        requiredChecks: ['IDENTITY', 'LICENSE'],
        checks: mappedChecks,
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(driverDossier);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <WorkerVerificationReviewModal
              dossierId={driverDossier.workerId}
              initialDossier={driverDossier}
              onClose={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await user.click(await screen.findByTestId('step-bubble-3'));
      const simplifiedPage = await screen.findByTestId('simplified-kyc-verification-page');
      const licCard = within(simplifiedPage).getByTestId('check-card-LICENSE');

      expect(within(licCard).getByTestId('check-requirement-LICENSE')).toHaveTextContent('(Required)');
      expect(within(licCard).getByText('Awaiting Submission')).toBeInTheDocument();
      expect(within(licCard).queryByRole('button', { name: /Approve Check|Reject Check/i })).not.toBeInTheDocument();
    });

    it('enables Approve and Reject and completes backend transitions for SUBMITTED Employer Reference and License checks', async () => {
      const user = userEvent.setup();
      const mappedChecks = mapChecks([
        { checkType: 'IDENTITY', checkId: 'chk-sub-id', status: 'APPROVED', required: true },
        { checkType: 'ADDRESS', checkId: 'chk-sub-addr', status: 'APPROVED', required: false },
        { checkType: 'EMERGENCY_CONTACT', checkId: 'chk-sub-ec', status: 'APPROVED', required: false },
        { checkType: 'PREVIOUS_EMPLOYMENT', checkId: 'chk-sub-ref', status: 'SUBMITTED', required: false },
        { checkType: 'POLICE_VERIFICATION', checkId: 'chk-sub-pcc', status: 'APPROVED', required: false },
        { checkType: 'LICENSE', checkId: 'chk-sub-lic', status: 'SUBMITTED', required: true },
      ]);

      const dossier = createTestDossier({
        id: 'w-sub-drv',
        workerId: 'w-sub-drv',
        workerName: 'Submitted Driver',
        category: 'Driver',
        status: 'IN_REVIEW',
        requiredChecks: ['IDENTITY', 'LICENSE'],
        checks: mappedChecks,
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
      const noteSpy = vi.spyOn(verificationRepository, 'addCheckNote').mockResolvedValue();
      const updateDocSpy = vi.spyOn(verificationRepository, 'updateDocumentDetails').mockResolvedValue();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();
      const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck').mockResolvedValue();

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

      await user.click(await screen.findByTestId('step-bubble-3'));
      const simplifiedPage = await screen.findByTestId('simplified-kyc-verification-page');

      // Employer Reference Approve & Reject buttons enabled
      const refCard = within(simplifiedPage).getByTestId('check-card-REFERENCE');
      const refApproveBtn = within(refCard).getByRole('button', { name: /Approve Check/i });
      const refRejectBtn = within(refCard).getByRole('button', { name: /Reject Check/i });
      expect(refApproveBtn).toBeEnabled();
      expect(refRejectBtn).toBeEnabled();

      // Commercial / Driving License Approve & Reject buttons enabled
      const licCard = within(simplifiedPage).getByTestId('check-card-LICENSE');
      const licApproveBtn = within(licCard).getByRole('button', { name: /Approve Check/i });
      const licRejectBtn = within(licCard).getByRole('button', { name: /Reject Check/i });
      expect(licApproveBtn).toBeEnabled();
      expect(licRejectBtn).toBeEnabled();

      // 1. Approve Employer Reference with call notes
      await user.click(refApproveBtn);
      const callNotesInput = await screen.findByTestId('verification-call-notes-input');
      await user.type(callNotesInput, 'Verified 3 years safe driving history with prior employer.');
      await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-sub-ref');
        expect(noteSpy).toHaveBeenCalledWith(
          'chk-sub-ref',
          'Verified 3 years safe driving history with prior employer.',
          'CALL'
        );
        expect(approveSpy).toHaveBeenCalledWith('chk-sub-ref', 'REFERENCE', expect.any(String));
      });

      // 2. Approve Commercial / Driving License with required future expiresOn date
      await user.click(licApproveBtn);
      await user.click(await screen.findByRole('button', { name: /Confirm Approval/i }));
      expect(
        await screen.findByText(/License Expiration Date is required/i)
      ).toBeInTheDocument();
      expect(approveSpy).not.toHaveBeenCalledWith('chk-sub-lic', expect.anything(), expect.anything(), expect.anything());

      const licExpiryInput = screen.getByTestId('license-expiry-date-input');
      await user.type(licExpiryInput, '2029-12-31');
      await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-sub-lic');
        expect(updateDocSpy).toHaveBeenCalledWith('chk-sub-lic', { expiresOn: '2029-12-31' });
        expect(approveSpy).toHaveBeenCalledWith(
          'chk-sub-lic',
          'LICENSE',
          expect.any(String),
          expect.objectContaining({ expiresOn: '2029-12-31', recheckAt: '2029-12-31' })
        );
      });

      // 3. Reject Commercial / Driving License works cleanly
      await user.click(licRejectBtn);
      const remarksInput = await screen.findByPlaceholderText(/Enter mandatory operational remarks/i);
      await user.type(remarksInput, 'License category is non-commercial');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /Confirm Rejection/i }));

      await waitFor(() => {
        expect(rejectSpy).toHaveBeenCalledWith(
          'chk-sub-lic',
          'LICENSE',
          expect.any(String),
          'License category is non-commercial'
        );
      });
    });
  });
});
