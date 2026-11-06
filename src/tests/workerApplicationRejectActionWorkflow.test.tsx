import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
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
      mutations: { retry: false },
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

const mockDossierApprovedChecks: VerificationDossier = {
  id: 'VQ-TEST-01',
  workerId: 'W-TEST-REJECT-01',
  workerName: 'Ramesh Patel',
  category: 'Driver',
  locality: 'Banjara Hills, Hyderabad',
  experienceYears: 5,
  phone: '+91 91234 56789',
  phoneMasked: '+91 91234 *****',
  submissionTime: '2026-10-20T10:00:00Z',
  status: 'IN_REVIEW',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: {
      id: 'chk-id-01',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    ADDRESS: {
      id: 'chk-addr-01',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emg-01',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-ref-01',
      type: 'REFERENCE',
      title: 'Employer Reference',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-pol-01',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance',
      status: 'APPROVED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
    },
  } as unknown as Record<string, VerificationCheck>,
};

describe('Worker Application Reject Action Workflow', () => {
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
          PERMISSIONS.WORKER_VIEW,
        ],
      },
      isAuthenticated: true,
    });

    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async () => {
      return JSON.parse(JSON.stringify(mockDossierApprovedChecks));
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Reject Application button on Step 5 and enables application-level rejection', async () => {
    const user = userEvent.setup();
    const rejectSpy = vi.spyOn(verificationRepository, 'rejectWorker').mockResolvedValue({
      workerId: 'W-TEST-REJECT-01',
      applicationStatus: 'REJECTED',
      level: 'NOT_STARTED',
      requiredChecks: [],
      checks: [],
    });

    renderModal({ dossierId: 'W-TEST-REJECT-01', initialDossier: mockDossierApprovedChecks });

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 5
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));

    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

    // Reject Application button is present in Step 5 footer
    const rejectBtn = screen.getByTestId('reject-application-btn');
    expect(rejectBtn).toBeInTheDocument();
    expect(rejectBtn).toHaveTextContent(/Reject Application/i);

    // Click Reject Application
    await user.click(rejectBtn);

    // Confirmation dialog is displayed
    expect(await screen.findByText(/Reject Application: Ramesh Patel/i)).toBeInTheDocument();
    expect(screen.getByTestId('reject-app-reason-category-select')).toBeInTheDocument();

    // Fill remarks (at least 5 characters) and acknowledge destructive checkbox
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory rejection remarks \/ rationale/i);
    await user.type(remarksInput, 'Document tampered and unverified background check.');

    const confirmCheckbox = screen.getByRole('checkbox');
    await user.click(confirmCheckbox);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Reject Application/i });
    await user.click(confirmBtn);

    // Assert repository rejectWorker was called with workerId, category, and remarks
    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(
        'W-TEST-REJECT-01',
        expect.any(String),
        'Document tampered and unverified background check.'
      );
    });
  });

  it('validates mandatory remarks length (minimum 5 characters) before allowing application rejection', async () => {
    const user = userEvent.setup();
    const rejectSpy = vi.spyOn(verificationRepository, 'rejectWorker');

    renderModal({ dossierId: 'W-TEST-REJECT-01', initialDossier: mockDossierApprovedChecks });

    const dialog = await screen.findByRole('dialog');

    // Advance to Step 5
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /Continue to Final Approval/i }));

    const rejectBtn = screen.getByTestId('reject-application-btn');
    await user.click(rejectBtn);

    // Acknowledge destructive checkbox
    const confirmCheckbox = screen.getByRole('checkbox');
    await user.click(confirmCheckbox);

    // Attempt to submit with short remarks (< 5 characters)
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory rejection remarks \/ rationale/i);
    await user.type(remarksInput, 'bad');

    const confirmBtn = screen.getByRole('button', { name: /Confirm Reject Application/i });
    await user.click(confirmBtn);

    // Validation error message appears
    expect(
      await screen.findByText(/Mandatory remarks must be at least 5 characters/i)
    ).toBeInTheDocument();
    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it('allows Reject Application directly from Step 3 during active review', async () => {
    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-REJECT-01', initialDossier: mockDossierApprovedChecks });

    const dialog = await screen.findByRole('dialog');

    // Step 1 -> Next -> Step 2 -> Next -> Step 3
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));
    await user.click(within(dialog).getByRole('button', { name: /^Next/i }));

    expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();

    // Step 3 header contains Reject Application button
    const step3RejectBtn = screen.getByTestId('step3-reject-application-btn');
    expect(step3RejectBtn).toBeInTheDocument();

    await user.click(step3RejectBtn);
    expect(await screen.findByText(/Reject Application: Ramesh Patel/i)).toBeInTheDocument();
  });

  it('renders application-rejected-notice and Close Dossier button when dossier is already rejected', async () => {
    const rejectedDossier: VerificationDossier = {
      ...mockDossierApprovedChecks,
      status: 'REJECTED',
      applicationStatus: 'REJECTED',
    };

    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(
      JSON.parse(JSON.stringify(rejectedDossier))
    );

    const user = userEvent.setup();
    renderModal({ dossierId: 'W-TEST-REJECT-01', initialDossier: rejectedDossier });

    await screen.findByRole('dialog');

    // Header banner shows rejected state
    expect(screen.getByTestId('application-rejected-header-banner')).toBeInTheDocument();

    // Navigate to Step 5
    const finalStepBubble = screen.getByTestId('step-bubble-5');
    await user.click(finalStepBubble);

    expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();
    expect(screen.getByTestId('application-rejected-notice')).toBeInTheDocument();

    // Close dossier button for rejected application is present
    expect(
      screen.getByRole('button', { name: /Worker Application Rejected — Close Dossier/i })
    ).toBeInTheDocument();

    // Action buttons for approve or secondary reject are NOT present
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-btn')).not.toBeInTheDocument();
  });
});
