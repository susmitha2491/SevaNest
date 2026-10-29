import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository, RealVerificationRepository } from '../features/verification/data/verificationRepository';
import { httpClient } from '../core/api/httpClient';
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

const createMockDossier = (overrides?: Partial<VerificationDossier>): VerificationDossier => ({
  id: 'VQ-TEST-001',
  checkId: 'chk-identity-001',
  applicationId: 'APP-TEST-001',
  workerId: 'W-TEST-001',
  workerName: 'Kamla Devi',
  category: 'House Cook',
  skills: ['Vegetarian Cooking', 'Kitchen Hygiene'],
  locality: 'Madhapur, Hyderabad',
  experienceYears: 4,
  phoneMasked: '+91 98765 *****',
  phone: '+91 98765 12345',
  email: 'kamla.devi@sevanest.worker',
  submissionTime: '2026-10-20T10:00:00Z',
  status: 'IN_REVIEW',
  preCheckOtpVerified: true,
  address: {
    line1: 'House 42, Ayyappa Society',
    locality: 'Madhapur',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
  },
  emergencyContact: {
    name: 'Ramesh Devi',
    relationship: 'Brother',
    phone: '+91 98450 99887',
    phoneMasked: '+91 98450 *****',
  },
  previousEmployer: {
    name: 'Dr. A. Verma',
    phone: '+91 91234 56789',
    phoneMasked: '+91 91234 *****',
    feedback: 'Highly reliable and punctual home cook.',
  },
  checks: {
    IDENTITY: {
      id: 'chk-id-001',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-id-001',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
        nameOnDoc: 'Kamla Devi',
      },
    },
    ADDRESS: {
      id: 'chk-addr-001',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-addr-001',
        documentTypeName: 'Electricity Bill',
        docNumberMasked: 'ELEC-HYD-55667',
        nameOnDoc: 'Kamla Devi',
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-em-001',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Ramesh Devi',
        relationshipOrRole: 'Brother',
        phoneMasked: '+91 98450 *****',
        callNotes: 'Phone verification confirmed kinship.',
      },
    },
    REFERENCE: {
      id: 'chk-ref-001',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'SUBMITTED',
      evaluationMethod: 'TELEPHONIC_VETTING',
      contactDetails: {
        contactName: 'Dr. A. Verma',
        relationshipOrRole: 'Prior Employer',
        phoneMasked: '+91 91234 *****',
      },
    },
    POLICE_CLEARANCE: {
      id: 'chk-pol-001',
      type: 'POLICE_CLEARANCE',
      title: 'Police Certificate',
      status: 'SUBMITTED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
      // Manual verification: No digital document required
    },
  } as unknown as Record<string, VerificationCheck>,
  ...overrides,
});

describe('Manual Approval for Employer Reference and Police Certificate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-exec-01',
        email: 'exec@sevanest.local',
        name: 'Executive Reviewer',
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
  });

  it('keeps Police Certificate locked while Employer Reference is in SUBMITTED state', async () => {
    const dossier = createMockDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');

    // Advance from Step 1 to Step 2, then Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Employer Reference is unlocked and shows Start Review + Approve Check
    const refCard = screen.getByTestId('check-card-REFERENCE');
    expect(within(refCard).getByRole('button', { name: /Start Review/i })).toBeInTheDocument();
    expect(within(refCard).getByRole('button', { name: /Approve Check/i })).toBeInTheDocument();

    // Police Certificate must be LOCKED
    const polCard = screen.getByTestId('check-card-POLICE_CLEARANCE');
    expect(within(polCard).getByTestId('badge-locked-POLICE_CLEARANCE')).toBeInTheDocument();
    expect(within(polCard).getByTestId('locked-notice-POLICE_CLEARANCE')).toHaveTextContent(
      /Step 5 \(Police Certificate\) is locked until preceding check\(s\) \[Employer Reference\] are approved/i
    );

    // Police Certificate action buttons must NOT be present
    expect(within(polCard).queryByRole('button', { name: /Approve Check/i })).not.toBeInTheDocument();
    expect(within(polCard).queryByRole('button', { name: /Start Review/i })).not.toBeInTheDocument();
  });

  it('allows executive to start review explicitly on Employer Reference transitioning to IN_REVIEW', async () => {
    const dossier = createMockDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const refCard = await screen.findByTestId('check-card-REFERENCE');
    const startReviewBtn = within(refCard).getByRole('button', { name: /Start Review/i });

    await user.click(startReviewBtn);

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith('chk-ref-001');
    });

    expect(await screen.findByText(/Check review started\. Status updated to In Review\./i)).toBeInTheDocument();
  });

  it('approves Employer Reference when SUBMITTED via auto-transition SUBMITTED -> IN_REVIEW -> APPROVED', async () => {
    const dossier = createMockDossier();
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const refCard = await screen.findByTestId('check-card-REFERENCE');
    const approveBtn = within(refCard).getByRole('button', { name: /Approve Check/i });

    // Click Approve Check to open ConfirmDialog
    await user.click(approveBtn);

    expect(await screen.findByText(/Approve Employer Reference/i)).toBeInTheDocument();

    // Confirm approval
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      // Must call claimCheck first for SUBMITTED check, then approveCheck
      expect(claimSpy).toHaveBeenCalledWith('chk-ref-001');
      expect(approveSpy).toHaveBeenCalledWith('chk-ref-001', 'REFERENCE', expect.any(String));
    });

    expect(await screen.findByText(/Check marked as verified & approved\./i)).toBeInTheDocument();
  });

  it('validates that Employer Reference cannot be approved without call notes and displays validation error', async () => {
    // Dossier with no feedback or callNotes
    const dossier = createMockDossier();
    dossier.previousEmployer = {
      name: 'Prior Employer Co.',
      phone: '+91 99999 88888',
      phoneMasked: '+91 99999 *****',
      feedback: '',
    };
    if (dossier.checks.REFERENCE.contactDetails) {
      dossier.checks.REFERENCE.contactDetails.callNotes = undefined;
    }

    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();
    const noteSpy = vi.spyOn(verificationRepository, 'addCheckNote').mockResolvedValue();

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const refCard = await screen.findByTestId('check-card-REFERENCE');
    const approveBtn = within(refCard).getByRole('button', { name: /Approve Check/i });

    await user.click(approveBtn);
    expect(await screen.findByText(/Approve Employer Reference/i)).toBeInTheDocument();

    // Confirm button without call notes should trigger validation error
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    expect(
      await screen.findByText(/Employer Reference approval requires actual call notes \(check: callNote\)/i)
    ).toBeInTheDocument();
    expect(approveSpy).not.toHaveBeenCalled();

    // Fill in call notes
    const callNotesInput = screen.getByTestId('verification-call-notes-input');
    await user.type(callNotesInput, 'Spoke with prior employer. Verified 2 years experience with good performance.');

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(noteSpy).toHaveBeenCalledWith(
        'chk-ref-001',
        'Spoke with prior employer. Verified 2 years experience with good performance.',
        'CALL'
      );
      expect(approveSpy).toHaveBeenCalledWith('chk-ref-001', 'REFERENCE', expect.any(String));
    });
  });

  it('unlocks Police Certificate once Employer Reference is approved, allowing manual approval without digital documents', async () => {
    // Dossier where Employer Reference is already APPROVED
    const dossier = createMockDossier();
    dossier.checks.REFERENCE.status = 'APPROVED';

    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    const claimSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue();

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Police Certificate must now be UNLOCKED
    const polCard = screen.getByTestId('check-card-POLICE_CLEARANCE');
    expect(within(polCard).queryByTestId('badge-locked-POLICE_CLEARANCE')).not.toBeInTheDocument();
    expect(within(polCard).queryByTestId('locked-notice-POLICE_CLEARANCE')).not.toBeInTheDocument();

    // Action buttons must be present
    expect(within(polCard).getByRole('button', { name: /Start Review/i })).toBeInTheDocument();
    const polApproveBtn = within(polCard).getByRole('button', { name: /Approve Check/i });
    expect(polApproveBtn).toBeInTheDocument();

    // Approve Police Certificate directly without digital document attachment
    await user.click(polApproveBtn);

    expect(await screen.findByText(/Approve Police Certificate/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith('chk-pol-001');
      expect(approveSpy).toHaveBeenCalledWith('chk-pol-001', 'POLICE_CLEARANCE', expect.any(String));
    });

    expect(await screen.findByText(/Check marked as verified & approved\./i)).toBeInTheDocument();
  });

  it('displays clear error and does not falsely mark check approved when backend API rejects the request', async () => {
    const dossier = createMockDossier();
    dossier.checks.REFERENCE.status = 'APPROVED';

    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue();
    vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(
      new Error('Database lock timeout on verification check')
    );

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-001', initialDossier: dossier });

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    const polCard = screen.getByTestId('check-card-POLICE_CLEARANCE');
    const polApproveBtn = within(polCard).getByRole('button', { name: /Approve Check/i });

    await user.click(polApproveBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Error banner displayed with backend error message
    const errorElements = await screen.findAllByText(/Approval failed: Database lock timeout on verification check/i);
    expect(errorElements.length).toBeGreaterThan(0);

    // Status in card remains SUBMITTED, not approved
    expect(within(polCard).queryByText(/Check Approved & Verified/i)).not.toBeInTheDocument();
  });

  it('RealVerificationRepository.approveCheck intercepts SUBMITTED cannot move to APPROVED and automatically retries after start-review', async () => {
    const repo = new RealVerificationRepository();
    const axiosError = Object.assign(
      new Error('A check that is SUBMITTED cannot move to APPROVED. Please retry.'),
      {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'A check that is SUBMITTED cannot move to APPROVED. Please retry.' },
        },
      }
    );

    const postSpy = vi
      .spyOn(httpClient, 'post')
      .mockRejectedValueOnce(axiosError)
      .mockResolvedValueOnce({
        data: { success: true },
      } as unknown as { data: { success: boolean } })
      .mockResolvedValueOnce({
        data: {
          workerId: 'W-TEST-001',
          level: 'VERIFIED',
          checks: [],
        },
      } as unknown as { data: { workerId: string; level: string; checks: [] } });

    const result = await repo.approveCheck('chk-reference-881', 'REFERENCE', 'Verified with prior employer');

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      '/admin/verification/checks/chk-reference-881/approve',
      { remarks: 'Verified with prior employer' }
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      '/admin/verification/checks/chk-reference-881/start-review'
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      3,
      '/admin/verification/checks/chk-reference-881/approve',
      { remarks: 'Verified with prior employer' }
    );
    expect(result).toBeDefined();
  });
});
