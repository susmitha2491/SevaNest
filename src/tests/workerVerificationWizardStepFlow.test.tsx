import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier, VerificationCheck } from '../features/verification/domain/types';

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

const mockDossierPending: VerificationDossier = {
  id: 'VQ-101',
  checkId: 'chk-identity-101',
  applicationId: 'APP-10482',
  workerId: 'W-10482',
  workerName: 'Sunita Devi',
  category: 'House Maid',
  skills: ['Cooking', 'Deep Cleaning', 'Elderly Assistance'],
  locality: 'Kondapur, Hyderabad',
  experienceYears: 6,
  phoneMasked: '+91 98765 *****',
  phone: '+91 98765 43210',
  email: 'sunita.devi@sevanest.worker',
  submissionTime: '2026-10-15T07:15:00Z',
  status: 'PENDING_REVIEW',
  preCheckOtpVerified: true,
  address: {
    line1: 'Flat 302, Sai Residency',
    locality: 'Kondapur',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500084',
  },
  emergencyContact: {
    name: 'Rajesh Devi',
    relationship: 'Spouse',
    phone: '+91 98450 11223',
    phoneMasked: '+91 98450 *****',
  },
  previousEmployer: {
    name: 'Mrs. S. Sharma',
    phone: '+91 99881 67890',
    phoneMasked: '+91 99881 *****',
    feedback: 'Exemplary conduct, trustworthy and punctual.',
  },
  checks: {
    IDENTITY: {
      id: 'chk-identity-101',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-id-101',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-8921',
        nameOnDoc: 'Sunita Devi',
      },
    },
    ADDRESS: {
      id: 'chk-address-101',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-addr-101',
        documentTypeName: 'Electricity Bill',
        docNumberMasked: 'ELEC-HYD-49201',
        nameOnDoc: 'Sunita Devi',
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emergency-101',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Rajesh Devi',
        relationshipOrRole: 'Spouse',
        phoneMasked: '+91 98450 *****',
      },
    },
    REFERENCE: {
      id: 'chk-reference-101',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Mrs. S. Sharma',
        relationshipOrRole: 'Prior Employer',
        phoneMasked: '+91 99881 *****',
      },
    },
    POLICE_CLEARANCE: {
      id: 'chk-police-101',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance',
      status: 'PENDING',
      evaluationMethod: 'CERTIFICATE_TRACKING',
      documentMetadata: {
        documentId: 'doc-pcc-101',
        documentTypeName: 'Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-2024-8891',
        nameOnDoc: 'Sunita Devi',
      },
    },
  } as unknown as Record<string, VerificationCheck>,
};

const mockDossierAllApproved: VerificationDossier = {
  ...mockDossierPending,
  checks: {
    IDENTITY: { ...mockDossierPending.checks.IDENTITY, status: 'APPROVED' },
    ADDRESS: { ...mockDossierPending.checks.ADDRESS, status: 'APPROVED' },
    EMERGENCY_CONTACT: { ...mockDossierPending.checks.EMERGENCY_CONTACT, status: 'APPROVED' },
    REFERENCE: { ...mockDossierPending.checks.REFERENCE, status: 'APPROVED' },
    POLICE_CLEARANCE: { ...mockDossierPending.checks.POLICE_CLEARANCE, status: 'APPROVED' },
  } as unknown as Record<string, VerificationCheck>,
};

describe('Worker Verification & Onboarding Wizard (5 Steps & Progress Bubbles)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'verif-exec-01',
        email: 've@sevanest.local',
        name: 'Pooja Nair',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          PERMISSIONS.WORKER_VIEW,
        ],
      },
      isAuthenticated: true,
    });

    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () => {
      return JSON.parse(JSON.stringify(mockDossierPending));
    });

    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://vault.sevanest.local/docs/doc-id-101-signed.pdf',
      expiresAt: '2026-10-28T14:00:00Z',
    });
  });

  it('renders all 5 progress bubbles with mandatory labels and highlights current step', async () => {
    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierPending });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Check all 5 bubble labels
    expect(screen.getByText('Application')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('KYC Verification')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Final Approval')).toBeInTheDocument();

    // Current step 1 heading
    expect(screen.getByRole('heading', { name: /Step 1 — Worker Application Details/i })).toBeInTheDocument();
  });

  it('displays full unmasked mobile number in Step 1, 4, and 5', async () => {
    const user = userEvent.setup();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(
      JSON.parse(JSON.stringify(mockDossierAllApproved))
    );

    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierAllApproved });

    const dialog = await screen.findByRole('dialog');

    // Step 1: Unmasked phone is displayed
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();

    // Navigate to Step 2
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Navigate to Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Navigate to Step 4: Verification Summary
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();
    expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThan(0);

    // Navigate to Step 5: Final Approval
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));
    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThan(0);
  });

  it('provides backward and forward navigation while preserving review state', async () => {
    const user = userEvent.setup();
    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierPending });

    const dialog = await screen.findByRole('dialog');

    // Step 1 -> Next -> Step 2
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Step 2 -> Previous -> Step 1
    await user.click(within(dialog).getByRole('button', { name: /Previous/i }));
    expect(await screen.findByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();

    // Step 1 -> Next -> Step 2
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Step 2 -> Next -> Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();
  });

  it('displays document retrieval error and offers retry action when signed url fails', async () => {
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValueOnce(
      new Error('S3 signature expired or network timeout.')
    );

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierPending });

    const dialog = await screen.findByRole('dialog');

    // Go to Step 2
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();

    // Error state rendered
    expect(await screen.findByText(/Document Access Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/S3 signature expired or network timeout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Document Access/i })).toBeInTheDocument();
  });

  it('blocks forward navigation from Step 3 when mandatory checks remain incomplete', async () => {
    const user = userEvent.setup();
    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierPending });

    const dialog = await screen.findByRole('dialog');

    // Go to Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Next button on Step 3 must be disabled
    const step3NextBtn = within(dialog).getByRole('button', { name: /^Next/i });
    expect(step3NextBtn).toBeDisabled();

    // Clicking Next does NOT advance
    await user.click(step3NextBtn);
    expect(screen.queryByText(/Step 4 — Verification Summary/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();
  });

  it('prevents jumping ahead to Step 4 or 5 via progress bubbles when checks incomplete', async () => {
    const user = userEvent.setup();
    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierPending });

    await screen.findByRole('dialog');

    // Try clicking Summary or Final Approval bubbles directly from Step 1
    const summaryBubble = screen.getByText('Summary');
    await user.click(summaryBubble);

    // Must remain on Step 1
    expect(screen.getByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();
    expect(screen.queryByText(/Step 4 — Verification Summary/i)).not.toBeInTheDocument();
  });

  it('renders Approve Verification Worker button ONLY on Step 5 and confirms approval', async () => {
    const user = userEvent.setup();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(
      JSON.parse(JSON.stringify(mockDossierAllApproved))
    );

    const approveSpy = vi
      .spyOn(verificationRepository, 'approveApplicationAndOnboardWorker')
      .mockResolvedValue({
        success: true,
        workerId: 'W-10482',
        status: 'ACTIVE',
        message: 'Worker verified and activated.',
      });

    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierAllApproved });

    const dialog = await screen.findByRole('dialog');

    // Assert "Approve Verification Worker" is NOT on Step 1
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();

    // Advance to Step 2
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();

    // Advance to Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();

    // Advance to Step 4
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();

    // Advance to Step 5
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));
    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

    // Approve Verification Worker button is NOW present
    const approveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
    expect(approveBtn).toBeInTheDocument();
    expect(approveBtn).toBeEnabled();

    // Click Approve button to open confirmation dialog
    await user.click(approveBtn);

    expect(await screen.findByText(/Confirm Worker Approval & Platform Onboarding/i)).toBeInTheDocument();

    // Submit confirmation
    const confirmFinalBtn = screen.getByRole('button', { name: /Confirm Final Approval/i });
    await user.click(confirmFinalBtn);

    // Verify repository called
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('W-10482', expect.any(String));
    });

    // Worker Successfully Onboarded success screen appears
    expect(await screen.findByText(/Worker Successfully Onboarded/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sunita Devi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Verification Queue/i })).toBeInTheDocument();
  });

  it('disables final approval button and displays clear message when user lacks permission', async () => {
    // Set user without signoff or decide permission
    useAuthStore.setState({
      user: {
        id: 'readonly-staff',
        email: 'readonly@sevanest.local',
        name: 'Auditor',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.VERIFICATION_REVIEW, PERMISSIONS.VERIFICATION_DOCUMENT_VIEW],
      },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(
      JSON.parse(JSON.stringify(mockDossierAllApproved))
    );

    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierAllApproved });

    const dialog = await screen.findByRole('dialog');

    // Advance through steps to Step 5
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));

    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
    expect(approveBtn).toBeDisabled();
    expect(screen.getByText(/Permission Restricted: You do not have the required permission/i)).toBeInTheDocument();
  });

  it('handles backend approval failure gracefully without showing false success', async () => {
    const user = userEvent.setup();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(
      JSON.parse(JSON.stringify(mockDossierAllApproved))
    );

    vi.spyOn(verificationRepository, 'approveApplicationAndOnboardWorker').mockRejectedValue(
      new Error('Backend 500: Database lock timeout during onboarding.')
    );

    renderModal({ dossierId: 'W-10482', initialDossier: mockDossierAllApproved });

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 5
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));

    const approveBtn = await screen.findByRole('button', { name: /Approve Verification Worker/i });
    await user.click(approveBtn);

    const confirmFinalBtn = await screen.findByRole('button', { name: /Confirm Final Approval/i });
    await user.click(confirmFinalBtn);

    // False success screen is NOT shown
    expect(screen.queryByText(/Worker Successfully Onboarded/i)).not.toBeInTheDocument();

    // Actual backend error banner is shown
    expect(await screen.findByText(/Final approval failed:/i)).toBeInTheDocument();
    expect(screen.getByText(/Database lock timeout during onboarding/i)).toBeInTheDocument();
  });
});
