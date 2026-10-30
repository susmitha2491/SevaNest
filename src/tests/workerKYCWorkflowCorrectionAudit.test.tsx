import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { mapBackendWorkerToWorker, mapBackendWorkerDetailToWorkerDetail } from '../features/workers/data/workerRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier, VerificationCheck, VerificationCheckType } from '../features/verification/domain/types';
import { evaluateVerificationWorkflow } from '../features/verification/domain/verificationWorkflow';

function renderModal(props: {
  dossierId: string;
  initialDossier?: VerificationDossier;
  onClose?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkerVerificationReviewModal
        dossierId={props.dossierId}
        initialDossier={props.initialDossier}
        onClose={props.onClose || vi.fn()}
      />
    </QueryClientProvider>
  );
}

const createBharathiGundlaContradictoryDossier = (): VerificationDossier => ({
  id: 'e2edc165-0965-41c6-bdaa-5da7fc455b8e',
  checkId: 'chk-identity-bharathi',
  applicationId: 'APP-BHARATHI-001',
  workerId: 'e2edc165-0965-41c6-bdaa-5da7fc455b8e',
  workerName: 'Bharathi Gundla',
  category: 'House Cook',
  skills: ['South Indian Cooking'],
  locality: 'Kondapur, Hyderabad',
  experienceYears: 5,
  phoneMasked: '+91 98480 *****',
  phone: '+91 98480 12345',
  email: 'bharathi.gundla@example.com',
  submissionTime: '2026-10-25T10:00:00Z',
  status: 'PENDING_REVIEW', // Correctly kept PENDING_REVIEW because checks are incomplete
  preCheckOtpVerified: true,
  hasContractInconsistency: true,
  contractInconsistency:
    'Backend reports verification level as VERIFIED and signedOffAt is present, but required operational checks remain incomplete (4 check(s) unapproved: ADDRESS, EMERGENCY_CONTACT, REFERENCE, POLICE_CLEARANCE). Status kept as PENDING_REVIEW.',
  signedOffAt: '2026-10-27T08:14:48.336Z',
  signedOffBy: 'SYSTEM_SUPERVISOR',
  applicationStatus: 'ACTIVE',
  submittedDocuments: [
    {
      id: 'doc-id-bharathi',
      documentId: 'doc-id-bharathi',
      documentTypeName: 'Aadhaar Card',
      checkType: 'IDENTITY',
      reviewable: true,
      available: true,
      status: 'VERIFIED',
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-id-bharathi',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-id-bharathi',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-9911',
        nameOnDoc: 'Bharathi Gundla',
        reviewable: true,
      },
    },
    ADDRESS: {
      id: 'chk-addr-bharathi',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    EMERGENCY_CONTACT: {
      id: 'chk-em-bharathi',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-ref-bharathi',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-pol-bharathi',
      type: 'POLICE_CLEARANCE',
      title: 'Police Certificate',
      status: 'PENDING',
      evaluationMethod: 'CERTIFICATE_TRACKING',
    },
  },
});

const createFullyApprovedDossier = (): VerificationDossier => ({
  id: 'dossier-fully-approved',
  checkId: 'chk-id-full',
  applicationId: 'app-full',
  workerId: 'worker-full',
  workerName: 'Lakshmi Narayana',
  category: 'Elderly Caregiver',
  skills: ['Mobility Assistance', 'Elderly Nutrition'],
  locality: 'Banjara Hills, Hyderabad',
  experienceYears: 6,
  phoneMasked: '+91 97000 *****',
  phone: '+91 97000 11223',
  email: 'lakshmi.n@example.com',
  submissionTime: '2026-10-26T09:00:00Z',
  status: 'PENDING_REVIEW',
  preCheckOtpVerified: true,
  submittedDocuments: [
    {
      id: 'doc-identity-uuid',
      documentId: 'doc-identity-uuid',
      documentTypeName: 'Aadhaar Card',
      checkType: 'IDENTITY',
      reviewable: true,
      available: true,
      status: 'SUBMITTED',
    },
    {
      id: 'doc-address-uuid',
      documentId: 'doc-address-uuid',
      documentTypeName: 'Electricity Bill',
      checkType: 'ADDRESS',
      reviewable: true,
      available: true,
      status: 'SUBMITTED',
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-1',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-identity-uuid',
        documentTypeName: 'Aadhaar Card',
        reviewable: true,
      },
    },
    ADDRESS: {
      id: 'chk-2',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-address-uuid',
        documentTypeName: 'Electricity Bill',
        reviewable: true,
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-3',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-4',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-5',
      type: 'POLICE_CLEARANCE',
      title: 'Police Certificate',
      status: 'APPROVED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
    },
  },
});

describe('Critical KYC Workflow Correction Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-exec-01',
        name: 'Anita Sen',
        email: 'verification.executive@sevanest.example.com',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.VERIFICATION_SIGNOFF,
        ],
      },
      isAuthenticated: true,
      accessToken: 'test-token',
    });
  });

  describe('1. KYC Approval Status Correction & Inconsistency Detection', () => {
    it('does NOT display Bharathi Gundla as verified or approved when required checks are incomplete', async () => {
      const contradictoryDossier = createBharathiGundlaContradictoryDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(contradictoryDossier);

      renderModal({
        dossierId: contradictoryDossier.workerId,
        initialDossier: contradictoryDossier,
      });

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Displays the prominent Contract Inconsistency warning banner
      const banner = await screen.findByTestId('kyc-contract-inconsistency-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Contract Inconsistency Detected/i);
      expect(banner).toHaveTextContent(/4 check\(s\) unapproved/i);

      // Dossier status badge must be PENDING_REVIEW, not APPROVED or VERIFIED
      expect(screen.queryByText(/^All 6 Verification Criteria Satisfied$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Authoritative Status: VERIFIED$/i)).not.toBeInTheDocument();
    });

    it('mapBackendWorkerToWorker rejects verified status if onboardingStatus is SUBMITTED', () => {
      const rawWorker = {
        id: 'worker-sub-1',
        name: 'Bharathi Gundla',
        phone: '+91 98480 12345',
        onboardingStatus: 'SUBMITTED',
        level: 'VERIFIED',
      };

      const mapped = mapBackendWorkerToWorker(rawWorker);
      expect(mapped.isFullyVerified).toBe(false);
      expect(mapped.onboardingStatus).toBe('SUBMITTED');
    });

    it('mapBackendWorkerDetailToWorkerDetail marks isFullyVerified as false when checks are incomplete', () => {
      const rawDetail = {
        id: 'worker-sub-1',
        fullName: 'Bharathi Gundla',
        onboardingStatus: 'SUBMITTED',
        verification: {
          level: 'VERIFIED',
          checks: [
            { checkType: 'IDENTITY', status: 'APPROVED' },
            { checkType: 'ADDRESS', status: 'NOT_SUBMITTED' },
            { checkType: 'EMERGENCY_CONTACT', status: 'NOT_SUBMITTED' },
            { checkType: 'PREVIOUS_EMPLOYMENT', status: 'NOT_SUBMITTED' },
            { checkType: 'POLICE_VERIFICATION', status: 'NOT_SUBMITTED' },
          ],
        },
      };

      const mapped = mapBackendWorkerDetailToWorkerDetail(rawDetail);
      expect(mapped.isFullyVerified).toBe(false);
    });
  });

  describe('2. Removal of Document and Check Locking', () => {
    it('evaluateVerificationWorkflow leaves all checks unlocked regardless of order', () => {
      const checks = {
        IDENTITY: { id: 'c1', type: 'IDENTITY' as const, title: 'ID', status: 'SUBMITTED' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
        ADDRESS: { id: 'c2', type: 'ADDRESS' as const, title: 'Address', status: 'SUBMITTED' as const, evaluationMethod: 'DOCUMENT_INSPECTION' as const },
        EMERGENCY_CONTACT: { id: 'c3', type: 'EMERGENCY_CONTACT' as const, title: 'EC', status: 'SUBMITTED' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
        REFERENCE: { id: 'c4', type: 'REFERENCE' as const, title: 'Ref', status: 'SUBMITTED' as const, evaluationMethod: 'TELEPHONIC_VETTING' as const },
        POLICE_CLEARANCE: { id: 'c5', type: 'POLICE_CLEARANCE' as const, title: 'Police', status: 'SUBMITTED' as const, evaluationMethod: 'CERTIFICATE_TRACKING' as const },
      };

      const workflow = evaluateVerificationWorkflow(checks as unknown as Record<VerificationCheckType, VerificationCheck>, true);
      workflow.steps.forEach((step) => {
        expect(step.isLocked).toBe(false);
        expect(step.prerequisiteBlockers).toEqual([]);
      });
    });

    it('renders all 5 checks in Step 3 without locked badges or locked notices', async () => {
      const contradictoryDossier = createBharathiGundlaContradictoryDossier();
      contradictoryDossier.checks.IDENTITY.status = 'SUBMITTED';
      contradictoryDossier.checks.ADDRESS.status = 'SUBMITTED';
      contradictoryDossier.checks.EMERGENCY_CONTACT.status = 'SUBMITTED';
      contradictoryDossier.checks.REFERENCE.status = 'SUBMITTED';
      contradictoryDossier.checks.POLICE_CLEARANCE.status = 'SUBMITTED';

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(contradictoryDossier);

      const user = userEvent.setup();
      renderModal({
        dossierId: contradictoryDossier.workerId,
        initialDossier: contradictoryDossier,
      });

      const dialog = await screen.findByRole('dialog');
      // Advance to Step 3
      await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
      await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

      expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

      // None of the checks should have a locked badge or locked notice
      ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'].forEach((type) => {
        expect(screen.queryByTestId(`badge-locked-${type}`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`locked-notice-${type}`)).not.toBeInTheDocument();
      });

      // All cards have action buttons directly available
      const polCard = screen.getByTestId('check-card-POLICE_CLEARANCE');
      expect(within(polCard).getByRole('button', { name: /Start Review/i })).toBeInTheDocument();
      expect(within(polCard).getByRole('button', { name: /Approve Check/i })).toBeInTheDocument();
      expect(within(polCard).getByRole('button', { name: /Reject Check/i })).toBeInTheDocument();
    });

    it('allows free navigation between Step 1, Step 2, and Step 3', async () => {
      const dossier = createBharathiGundlaContradictoryDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      expect(await screen.findByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();

      // Click directly on Step 3 in progress stepper
      const step3Bubble = screen.getByTestId('step-bubble-3');
      await user.click(step3Bubble);

      expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

      // Click directly back to Step 2
      const step2Bubble = screen.getByTestId('step-bubble-2');
      await user.click(step2Bubble);

      expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

      // Click back to Step 1
      const step1Bubble = screen.getByTestId('step-bubble-1');
      await user.click(step1Bubble);

      expect(await screen.findByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();
    });
  });

  describe('3. Document Inspection, Format Rendering & Vault Error Handling', () => {
    it('opens reviewable document directly from Step 3 check card into Step 2', async () => {
      const dossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      // Navigate to Step 3
      const step3Bubble = screen.getByTestId('step-bubble-3');
      await user.click(step3Bubble);

      const idCard = screen.getByTestId('check-card-IDENTITY');
      const openDocBtn = within(idCard).getByTestId('open-document-IDENTITY');
      expect(openDocBtn).toBeInTheDocument();

      // Click "Open Document"
      await user.click(openDocBtn);

      // Successfully transitions to Step 2
      expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
    });

    it('renders image preview and "Open in New Tab" link for image document', async () => {
      const dossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.internal/documents/doc-identity-uuid.png',
        signedUrl: 'https://vault.sevanest.internal/documents/doc-identity-uuid.png?token=signed123',
        mimeType: 'image/png',
        expiresAt: '2026-10-30T16:00:00Z',
      });

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      // Navigate to Step 2
      const step2Bubble = screen.getByTestId('step-bubble-2');
      await user.click(step2Bubble);

      // Verify image rendered
      const img = await screen.findByTestId('kyc-document-image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('doc-identity-uuid.png'));

      // Verify "Open in New Tab" link
      const openTabLink = screen.getByTestId('open-document-new-tab');
      expect(openTabLink).toHaveAttribute('target', '_blank');
      expect(openTabLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(openTabLink).toHaveTextContent(/Open in New Tab/i);
    });

    it('renders PDF preview object for PDF document', async () => {
      const dossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
        url: 'https://vault.sevanest.internal/documents/doc-address-uuid.pdf',
        signedUrl: 'https://vault.sevanest.internal/documents/doc-address-uuid.pdf?token=signed456',
        mimeType: 'application/pdf',
        expiresAt: '2026-10-30T16:00:00Z',
      });

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      // Select address document
      const step2Bubble = screen.getByTestId('step-bubble-2');
      await user.click(step2Bubble);

      const addressDocTab = await screen.findByText(/Electricity Bill/i);
      await user.click(addressDocTab);

      const pdfObject = await screen.findByTestId('kyc-document-pdf');
      expect(pdfObject).toBeInTheDocument();
      expect(pdfObject).toHaveAttribute('type', 'application/pdf');
    });

    it('displays formatted vault error with retry when document retrieval fails', async () => {
      const dossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValue({
        code: 'DOCUMENT_NOT_AVAILABLE',
        message: 'DOCUMENT_NOT_AVAILABLE: The requested document draft is unavailable',
      });

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      const step2Bubble = screen.getByTestId('step-bubble-2');
      await user.click(step2Bubble);

      const errorContainer = await screen.findByTestId('document-vault-error-container');
      expect(errorContainer).toBeInTheDocument();
      expect(errorContainer).toHaveTextContent(/Document Not Available/i);

      const retryBtn = within(errorContainer).getByRole('button', { name: /Retry Document Access/i });
      expect(retryBtn).toBeInTheDocument();
    });
  });

  describe('4. Check Actions & Rejection Requirements', () => {
    it('claims check before approving check in SUBMITTED status', async () => {
      const dossier = createFullyApprovedDossier();
      dossier.checks.POLICE_CLEARANCE.status = 'SUBMITTED';
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      const step3Bubble = screen.getByTestId('step-bubble-3');
      await user.click(step3Bubble);

      const polCard = screen.getByTestId('check-card-POLICE_CLEARANCE');
      const approveBtn = within(polCard).getByRole('button', { name: /Approve Check/i });
      await user.click(approveBtn);

      // Confirm in dialog
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-5');
        expect(approveSpy).toHaveBeenCalledWith('chk-5', 'POLICE_CLEARANCE', expect.any(String));
      });
    });

    it('claims check before rejecting check in SUBMITTED status with required remarks and category', async () => {
      const dossier = createFullyApprovedDossier();
      dossier.checks.IDENTITY.status = 'SUBMITTED';
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
      const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
      const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck').mockResolvedValue();

      const user = userEvent.setup();
      renderModal({ dossierId: dossier.workerId, initialDossier: dossier });

      const step3Bubble = screen.getByTestId('step-bubble-3');
      await user.click(step3Bubble);

      const idCard = screen.getByTestId('check-card-IDENTITY');
      const rejectBtn = within(idCard).getByRole('button', { name: /Reject Check/i });
      await user.click(rejectBtn);

      // Rejection dialog requires category & remarks
      const remarksInput = await screen.findByPlaceholderText(/Enter mandatory operational remarks/i);
      await user.type(remarksInput, 'Document photo is blurred and unreadable');

      // Check the mandatory confirmation checkbox for destructive rejection
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      const confirmRejectBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      await user.click(confirmRejectBtn);

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('chk-1');
        expect(rejectSpy).toHaveBeenCalledWith(
          'chk-1',
          'IDENTITY',
          expect.any(String),
          'Document photo is blurred and unreadable'
        );
      });
    });
  });

  describe('5. Final Approval & Worker Platform Activation Separation', () => {
    it('allows final sign-off only when all 5 checks and OTP are approved', async () => {
      const fullDossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(fullDossier);

      const user = userEvent.setup();
      renderModal({ dossierId: fullDossier.workerId, initialDossier: fullDossier });

      // In Step 1, all criteria satisfied banner appears
      expect(await screen.findByText(/All 6 Verification Criteria Satisfied/i)).toBeInTheDocument();

      // Advance through Step 2, 3, 4 to Step 5
      const step5Bubble = screen.getByTestId('step-bubble-5');
      await user.click(step5Bubble);

      expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
      const finalApproveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
      expect(finalApproveBtn).toBeEnabled();
    });

    it('hides final approval when user lacks verification.signoff permission', async () => {
      useAuthStore.setState({
        user: {
          id: 'usr-readonly-01',
          name: 'Support Viewer',
          email: 'support@sevanest.example.com',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.VERIFICATION_REVIEW],
        },
        isAuthenticated: true,
        accessToken: 'test-token',
      });

      const fullDossier = createFullyApprovedDossier();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(fullDossier);

      const user = userEvent.setup();
      renderModal({ dossierId: fullDossier.workerId, initialDossier: fullDossier });

      const step5Bubble = screen.getByTestId('step-bubble-5');
      await user.click(step5Bubble);

      expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
      expect(await screen.findByText(/Permission Restricted: You do not have the required permission/i)).toBeInTheDocument();
      const finalApproveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
      expect(finalApproveBtn).toBeDisabled();
    });
  });
});
