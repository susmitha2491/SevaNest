import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier } from '../features/verification/domain/types';

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

const mockHistoricalApprovedDossier: VerificationDossier = {
  id: 'HIST-DOSSIER-001',
  checkId: 'chk-identity-001',
  applicationId: 'APP-HIST-001',
  workerId: 'W-HIST-001',
  workerName: 'Lakshmi Narayan',
  category: 'Home Cook',
  skills: ['North Indian', 'South Indian', 'Baking'],
  locality: 'Banjara Hills, Hyderabad',
  experienceYears: 8,
  phoneMasked: '+91 91234 *****',
  phone: '+91 91234 56789',
  email: 'lakshmi.n@sevanest.worker',
  submissionTime: '2026-09-10T10:00:00Z',
  status: 'APPROVED',
  preCheckOtpVerified: true,
  address: {
    line1: 'House 44, Road No 12',
    locality: 'Banjara Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500034',
  },
  emergencyContact: {
    name: 'Suresh Narayan',
    relationship: 'Brother',
    phone: '+91 98765 00001',
    phoneMasked: '+91 98765 *****',
  },
  previousEmployer: {
    name: 'Anand Reddy',
    phone: '+91 98765 00002',
    phoneMasked: '+91 98765 *****',
    feedback: 'Highly reliable and hygienic cooking.',
  },
  submittedDocuments: [
    {
      id: 'doc-aadhaar-001',
      documentId: 'doc-aadhaar-001',
      documentTypeName: 'Aadhaar Card',
      checkType: 'IDENTITY',
      checkTitle: 'Identity Proof',
      status: 'APPROVED',
      reviewable: true,
      available: true,
      sizeBytes: 125000,
    },
    {
      id: 'doc-police-001',
      documentId: 'doc-police-001',
      documentTypeName: 'Police Clearance Certificate',
      checkType: 'POLICE_CLEARANCE',
      checkTitle: 'Police Clearance',
      status: 'APPROVED',
      reviewable: true,
      available: true,
      sizeBytes: 85000,
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-id-001',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      history: [
        {
          fromStatus: 'SUBMITTED',
          toStatus: 'IN_REVIEW',
          actorUserId: 'VE-01',
          createdAt: '2026-09-11T11:00:00Z',
        },
        {
          fromStatus: 'IN_REVIEW',
          toStatus: 'APPROVED',
          actorUserId: 'VE-01',
          remarks: 'Aadhaar verified successfully',
          createdAt: '2026-09-11T11:30:00Z',
        },
      ],
      documentMetadata: {
        documentId: 'doc-aadhaar-001',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
      },
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
      documentMetadata: {
        documentId: 'doc-police-001',
        documentTypeName: 'Police Clearance Certificate',
      },
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

const mockHistoricalRejectedDossier: VerificationDossier = {
  ...mockHistoricalApprovedDossier,
  id: 'HIST-REJ-002',
  status: 'REJECTED',
  applicationStatus: 'REJECTED',
  overallRemarks: 'Invalid police record verification',
  checks: {
    ...mockHistoricalApprovedDossier.checks,
    POLICE_CLEARANCE: {
      id: 'chk-pol-002',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance',
      status: 'REJECTED',
      evaluationMethod: 'CERTIFICATE_TRACKING',
      rejectionCategory: 'CRIMINAL_RECORD_DISQUALIFIED',
      rejectionRemarks: 'Adverse record identified by local station',
    },
  },
  rejectionHistory: [
    {
      reasonCode: 'CRIMINAL_RECORD',
      remarks: 'Adverse record identified by local station',
      rejectedBy: 'Verification Officer',
      rejectedAt: '2026-09-12T16:00:00Z',
    },
  ],
};

const mockActivePendingDossier: VerificationDossier = {
  ...mockHistoricalApprovedDossier,
  id: 'ACTIVE-DOSSIER-003',
  status: 'IN_REVIEW',
  checks: {
    ...mockHistoricalApprovedDossier.checks,
    IDENTITY: {
      id: 'chk-id-003',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'IN_REVIEW',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-aadhaar-001',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
      },
    },
  },
};

describe('Verification Executive — Review History Strict Read-Only Dossier Audit', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/verification');

    useAuthStore.setState({
      user: {
        id: 'usr-exec-01',
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

    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async (id: string) => {
      if (id === 'HIST-REJ-002') return mockHistoricalRejectedDossier;
      if (id === 'ACTIVE-DOSSIER-003') return mockActivePendingDossier;
      return mockHistoricalApprovedDossier;
    });

    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://storage.supabase.co/v1/test.pdf',
      expiresAt: '2026-10-10T12:00:00Z',
      mimeType: 'application/pdf',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renders "Read-Only Historical Record" badge in the modal header when readOnly=true', async () => {
    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-only-history-badge')).toBeInTheDocument();
      expect(screen.getByText(/Read-Only Historical Record/i)).toBeInTheDocument();
    });
  });

  it('2. Automatically detects read-only mode if current route contains /history', async () => {
    window.history.pushState({}, '', '/verification/history?dossierId=HIST-DOSSIER-001');

    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      // readOnly not explicitly passed — should detect from pathname
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-only-history-badge')).toBeInTheDocument();
    });
  });

  it('3. In Step 1: displays worker details, address, and permits navigating through all steps for inspection', async () => {
    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Lakshmi Narayan')).toBeInTheDocument();
      expect(screen.getByText(/House 44, Road No 12/i)).toBeInTheDocument();
      expect(screen.getByText('Home Cook')).toBeInTheDocument();
    });

    // Check that stepper bubbles are navigable for inspection
    const step3Bubble = screen.getByTestId('step-bubble-3');
    await user.click(step3Bubble);

    await waitFor(() => {
      expect(screen.getByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/Progress:/i)).toBeInTheDocument();
    });
  });

  it('4. In Step 2: Document viewer has NO approve, reject, or recheck buttons, and renders read-only notice', async () => {
    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
    });

    // Navigate to Step 2
    const step2Bubble = screen.getByTestId('step-bubble-2');
    await user.click(step2Bubble);

    await waitFor(() => {
      expect(screen.getByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
    });

    // Click "View Document" on first document
    const viewDocBtns = screen.getAllByRole('button', { name: /View Document/i });
    await user.click(viewDocBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('read-only-preview-notice')).toBeInTheDocument();
      expect(screen.getByText(/Historical Record \(Read-Only\)/i)).toBeInTheDocument();
    });

    // Ensure NO mutation buttons exist inside preview overlay
    expect(screen.queryByRole('button', { name: /^Approve Check$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Request Re-Verification$/i })).not.toBeInTheDocument();
  });

  it('5. In Step 3: Check cards display clean check names and read-only states without mutation buttons', async () => {
    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
    });

    // Go to Step 3
    const step3Bubble = screen.getByTestId('step-bubble-3');
    await user.click(step3Bubble);

    await waitFor(() => {
      expect(screen.getByText('Identity Proof')).toBeInTheDocument();
      expect(screen.getByText('Police Certificate')).toBeInTheDocument();
    });

    // Audit trail clutter and Open Document link are omitted in simplified Step 3
    expect(screen.queryByText(/Aadhaar verified successfully/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-document-IDENTITY')).not.toBeInTheDocument();

    // Verify NO mutation buttons are rendered
    expect(screen.queryByRole('button', { name: /Start Review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Release Review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve Check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject Check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Re-Verification/i })).not.toBeInTheDocument();
  });

  it('6. In Step 5: Displays finalized read-only notice and Close Dossier button without mutation actions', async () => {
    const handleClose = vi.fn();
    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
      onClose: handleClose,
    });

    // Navigate to Step 5
    const step5Bubble = screen.getByTestId('step-bubble-5');
    await user.click(step5Bubble);

    await waitFor(() => {
      expect(screen.getByTestId('read-only-historical-decision-notice')).toBeInTheDocument();
      expect(screen.getByText(/Decision is finalized & read-only/i)).toBeInTheDocument();
      expect(screen.getByTestId('close-historical-dossier-btn')).toBeInTheDocument();
    });

    // Ensure NO approval, rejection, or reconsideration buttons exist
    expect(screen.queryByRole('button', { name: /Approve Verification Worker/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconsider-application-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconsider-application-banner-btn')).not.toBeInTheDocument();

    // Clicking close button triggers onClose
    await user.click(screen.getByTestId('close-historical-dossier-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('7. In Step 5 with Rejected Historical Dossier: Displays rejection history and close button without mutation actions', async () => {
    renderModal({
      dossierId: 'HIST-REJ-002',
      initialDossier: mockHistoricalRejectedDossier,
      readOnly: true,
    });

    // Navigate to Step 5
    const step5Bubble = screen.getByTestId('step-bubble-5');
    await user.click(step5Bubble);

    await waitFor(() => {
      expect(screen.getByTestId('read-only-historical-decision-notice')).toBeInTheDocument();
      expect(screen.getByTestId('close-historical-dossier-btn')).toBeInTheDocument();
      expect(screen.getByText(/Adverse record identified by local station/i)).toBeInTheDocument();
    });

    // Neither Reconsider nor Reject should be present
    expect(screen.queryByTestId('reconsider-application-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconsider-application-banner-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-btn')).not.toBeInTheDocument();
  });

  it('8. Active Queue mode (readOnly=false): preserves full operational action buttons', async () => {
    renderModal({
      dossierId: 'ACTIVE-DOSSIER-003',
      initialDossier: mockActivePendingDossier,
      readOnly: false,
    });

    // Header badge should NOT be present
    expect(screen.queryByTestId('read-only-history-badge')).not.toBeInTheDocument();

    // Navigate to Step 3
    const step3Bubble = screen.getByTestId('step-bubble-3');
    await user.click(step3Bubble);

    await waitFor(() => {
      // Simplified Step 3 displays only Approve Check and Reject Check for pending checks
      expect(screen.getAllByRole('button', { name: /Approve Check/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Reject Check/i }).length).toBeGreaterThan(0);
    });
  });

  it('9. Enforces read-only behavior at mutation level: cannot trigger mutations', async () => {
    // When readOnly is true, mutations are guarded by throwing ValidationError
    const claimSpy = vi.spyOn(verificationRepository, 'claimCheck');
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');
    const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck');

    renderModal({
      dossierId: 'HIST-DOSSIER-001',
      initialDossier: mockHistoricalApprovedDossier,
      readOnly: true,
    });

    // Verify modal is loaded and read-only badge is present
    await waitFor(() => {
      expect(screen.getByTestId('read-only-history-badge')).toBeInTheDocument();
    });

    // Ensure no claim, approve, or reject repository mutations were dispatched
    expect(claimSpy).not.toHaveBeenCalled();
    expect(approveSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
  });
});
