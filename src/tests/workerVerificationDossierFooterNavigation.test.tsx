import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier } from '../features/verification/domain/types';

const mockApprovedDossier: VerificationDossier = {
  id: 'DOSSIER-APP-001',
  checkId: 'chk-identity-001',
  applicationId: 'APP-APP-001',
  workerId: 'W-APP-001',
  workerName: 'Lakshmi Narayan',
  category: 'Home Cook',
  skills: ['North Indian', 'South Indian'],
  locality: 'Banjara Hills, Hyderabad',
  experienceYears: 8,
  phoneMasked: '+91 91234 *****',
  phone: '+91 91234 56789',
  submissionTime: '2026-09-10T10:00:00Z',
  status: 'APPROVED',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: {
      id: 'chk-id-001',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    ADDRESS: {
      id: 'chk-addr-001',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emg-001',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-ref-001',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-pol-001',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance',
      status: 'APPROVED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
    },
  },
  approvalHistory: [
    {
      approvedBy: 'Admin Supervisor',
      approvedAt: '2026-09-12T14:00:00Z',
      remarks: 'All 5 checks verified satisfactorily.',
    },
  ],
};

const mockPendingDossier: VerificationDossier = {
  ...mockApprovedDossier,
  id: 'DOSSIER-PEND-002',
  workerId: 'W-PEND-002',
  status: 'IN_REVIEW',
  checks: {
    ...mockApprovedDossier.checks,
  },
};

const mockRejectedDossier: VerificationDossier = {
  ...mockApprovedDossier,
  id: 'DOSSIER-REJ-003',
  workerId: 'W-REJ-003',
  status: 'REJECTED',
  applicationStatus: 'REJECTED',
  checks: {
    ...mockApprovedDossier.checks,
    POLICE_CLEARANCE: {
      id: 'chk-pol-003',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance',
      status: 'REJECTED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
      rejectionRemarks: 'Failed police verification.',
    },
  },
  rejectionHistory: [
    {
      reasonCode: 'POLICE_RECORD',
      remarks: 'Failed police verification.',
      rejectedBy: 'Verification Officer',
      rejectedAt: '2026-09-12T16:00:00Z',
    },
  ],
};

function renderModal(props: {
  dossierId: string;
  initialDossier?: VerificationDossier;
  onClose?: () => void;
  readOnly?: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkerVerificationReviewModal
        dossierId={props.dossierId}
        initialDossier={props.initialDossier}
        onClose={props.onClose || vi.fn()}
        readOnly={props.readOnly}
      />
    </QueryClientProvider>
  );
}

describe('Worker Verification Dossier Modal Footer Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-ve-01',
        name: 'Verification Executive',
        email: 've@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_SIGNOFF,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('1. Approved dossier, Step 4 → displays "View Final Approval" and Step 5 remains completed', async () => {
    const user = userEvent.setup();
    renderModal({
      dossierId: 'DOSSIER-APP-001',
      initialDossier: mockApprovedDossier,
      readOnly: true,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 4 via step bubble
    const step4Bubble = screen.getByTestId('step-bubble-4');
    await user.click(step4Bubble);

    await waitFor(() => {
      expect(screen.getByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();
    });

    // Step 5 bubble must remain marked completed
    const step5Bubble = screen.getByTestId('step-bubble-5');
    expect(step5Bubble).toHaveAttribute('title', 'Step 5: Final Approval (Completed)');

    // Step 4 footer button must say "View Final Approval", NOT "Continue to Final Approval"
    const viewFinalApproveBtn = screen.getByRole('button', { name: /^View Final Approval$/i });
    expect(viewFinalApproveBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue to Final Approval/i })).not.toBeInTheDocument();

    // Previous button must be present on Step 4
    expect(screen.getByRole('button', { name: /^Previous$/i })).toBeInTheDocument();
  });

  it('2. Clicking "View Final Approval" on Step 4 navigates to Step 5 without calling approval API', async () => {
    const user = userEvent.setup();
    const finalApproveSpy = vi.spyOn(verificationRepository, 'approveApplicationAndOnboardWorker');
    const approveCheckSpy = vi.spyOn(verificationRepository, 'approveCheck');

    renderModal({
      dossierId: 'DOSSIER-APP-001',
      initialDossier: mockApprovedDossier,
      readOnly: true,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 4
    await user.click(screen.getByTestId('step-bubble-4'));
    await waitFor(() => {
      expect(screen.getByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();
    });

    // Click "View Final Approval"
    const viewFinalApproveBtn = screen.getByRole('button', { name: /^View Final Approval$/i });
    await user.click(viewFinalApproveBtn);

    // Navigates to Step 5
    await waitFor(() => {
      expect(screen.getByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    });

    // Zero approval APIs called
    expect(finalApproveSpy).not.toHaveBeenCalled();
    expect(approveCheckSpy).not.toHaveBeenCalled();
  });

  it('3. Approved dossier, Step 5 → displays "Close Dossier" as primary action and no approval dialog', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderModal({
      dossierId: 'DOSSIER-APP-001',
      initialDossier: mockApprovedDossier,
      onClose: handleClose,
      readOnly: true,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 5
    await user.click(screen.getByTestId('step-bubble-5'));
    await waitFor(() => {
      expect(screen.getByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    });

    // Must show "Close Dossier" button in footer
    const closeBtn = screen.getByRole('button', { name: /^Close Dossier$/i });
    expect(closeBtn).toBeInTheDocument();

    // Must NOT show any mutation or approval buttons
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Final Approval/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-btn')).not.toBeInTheDocument();

    // Clicking "Close Dossier" closes modal immediately without confirmation dialog
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Confirm Worker Approval/i)).not.toBeInTheDocument();
  });

  it('4. Approved dossier without readOnly prop (e.g. opened from active list) also shows "Close Dossier"', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderModal({
      dossierId: 'DOSSIER-APP-001',
      initialDossier: mockApprovedDossier,
      onClose: handleClose,
      readOnly: false,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 4
    await user.click(screen.getByTestId('step-bubble-4'));
    const step4Btn = screen.getByRole('button', { name: /^View Final Approval$/i });
    expect(step4Btn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue to Final Approval/i })).not.toBeInTheDocument();

    // Advance to Step 5
    await user.click(step4Btn);
    await waitFor(() => {
      expect(screen.getByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    });

    // Must display "Close Dossier"
    const closeBtn = screen.getByRole('button', { name: /^Close Dossier$/i });
    expect(closeBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();

    // Clicking it triggers onClose
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('5. Pending dossier retains legitimate approval workflow ("Continue to Final Approval" on Step 4 and "Approve Verification Worker" on Step 5)', async () => {
    const user = userEvent.setup();

    renderModal({
      dossierId: 'DOSSIER-PEND-002',
      initialDossier: mockPendingDossier,
      readOnly: false,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 4
    await user.click(screen.getByTestId('step-bubble-4'));
    await waitFor(() => {
      expect(screen.getByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();
    });

    // Pending dossier MUST say "Continue to Final Approval"
    const continueBtn = screen.getByRole('button', { name: /^Continue to Final Approval$/i });
    expect(continueBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Final Approval/i })).not.toBeInTheDocument();

    // Advance to Step 5
    await user.click(continueBtn);
    await waitFor(() => {
      expect(screen.getByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    });

    // Pending dossier MUST show legitimate approval action
    expect(screen.getByRole('button', { name: /Approve Verification Worker/i })).toBeInTheDocument();
    expect(screen.getByTestId('reject-application-btn')).toBeInTheDocument();
  });

  it('6. Rejected dossier on Step 4 shows "View Final Decision" and on Step 5 does not show approval action', async () => {
    const user = userEvent.setup();

    renderModal({
      dossierId: 'DOSSIER-REJ-003',
      initialDossier: mockRejectedDossier,
      readOnly: false,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 4
    await user.click(screen.getByTestId('step-bubble-4'));
    await waitFor(() => {
      expect(screen.getByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();
    });

    // Rejected dossier on Step 4 says "View Final Decision"
    const viewDecisionBtn = screen.getByRole('button', { name: /^View Final Decision$/i });
    expect(viewDecisionBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue to Final Approval/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Final Approval/i })).not.toBeInTheDocument();

    // Advance to Step 5
    await user.click(viewDecisionBtn);
    await waitFor(() => {
      expect(screen.getByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    });

    // Rejected dossier MUST NOT show any approval button
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Final Approval/i })).not.toBeInTheDocument();

    // Must show Close Dossier for rejected application
    expect(screen.getByRole('button', { name: /Worker Application Rejected — Close Dossier/i })).toBeInTheDocument();
  });

  it('7. Previous button allows backward navigation from Step 5 to Step 4 and Step 4 to Step 3', async () => {
    const user = userEvent.setup();

    renderModal({
      dossierId: 'DOSSIER-APP-001',
      initialDossier: mockApprovedDossier,
      readOnly: true,
    });

    await screen.findByRole('dialog');

    // Navigate to Step 5
    await user.click(screen.getByTestId('step-bubble-5'));
    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

    // Click Previous -> goes to Step 4
    const prevBtnStep5 = screen.getByRole('button', { name: /^Previous$/i });
    await user.click(prevBtnStep5);
    expect(await screen.findByText(/Step 4 — Verification Summary/i)).toBeInTheDocument();

    // Click Previous -> goes to Step 3
    const prevBtnStep4 = screen.getByRole('button', { name: /^Previous$/i });
    await user.click(prevBtnStep4);
    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();
  });
});
