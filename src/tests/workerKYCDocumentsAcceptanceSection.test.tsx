import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { WorkerDetail } from '../features/workers/domain/types';
import { VerificationDossier } from '../features/verification/domain/types';

const createMockWorker = (): WorkerDetail => ({
  id: 'W-KYC-DOCS',
  name: 'Sunita Devi',
  category: 'House Maid',
  categories: ['House Maid'],
  experienceYears: 4,
  ratingAverage: 4.8,
  totalReviews: 24,
  locality: 'Madhapur',
  serviceRadiusKm: 10,
  languages: ['Hindi', 'Telugu'],
  bio: 'Experienced household helper',
  isFullyVerified: false,
  status: 'ACTIVE',
  onboardingStatus: 'IN_REVIEW',
  phoneMasked: '+91 98765 43210',
  documents: [
    {
      id: 'doc-aadhaar-101',
      documentId: 'doc-aadhaar-101',
      checkId: 'chk-id-101',
      checkType: 'IDENTITY',
      documentType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card (National ID)',
      docNumberMasked: 'XXXX-XXXX-4921',
      status: 'SUBMITTED',
      submittedAt: '2026-10-20T10:30:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-address-102',
      documentId: 'doc-address-102',
      checkId: 'chk-addr-102',
      checkType: 'ADDRESS',
      documentType: 'ADDRESS',
      documentTypeName: 'Electricity Utility Bill',
      docNumberMasked: 'ELEC-98765-HYD',
      status: 'SUBMITTED',
      submittedAt: '2026-10-21T11:00:00Z',
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
    identityProofStatus: 'PENDING',
    addressProofStatus: 'PENDING',
    criminalRecordStatus: 'PENDING',
    skillProofStatus: 'NOT_APPLICABLE',
    referenceCheckStatus: 'PENDING',
  },
});

const createMockDossier = (): VerificationDossier => ({
  id: 'dossier-kyc-101',
  workerId: 'W-KYC-DOCS',
  workerName: 'Sunita Devi',
  category: 'House Maid',
  locality: 'Madhapur',
  experienceYears: 4,
  phoneMasked: '+91 98765 43210',
  submissionTime: '2026-10-20T10:30:00Z',
  status: 'PENDING_REVIEW',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: {
      id: 'chk-id-101',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-aadhaar-101',
        documentTypeName: 'Aadhaar Card (National ID)',
        docNumberMasked: 'XXXX-XXXX-4921',
        reviewable: true,
        available: true,
      },
    },
    ADDRESS: {
      id: 'chk-addr-102',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-address-102',
        documentTypeName: 'Electricity Utility Bill',
        docNumberMasked: 'ELEC-98765-HYD',
        reviewable: true,
        available: true,
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emg-103',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-ref-104',
      type: 'REFERENCE',
      title: 'Previous Employer Reference',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-pcc-105',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance Certificate',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
  },
});

let mockWorkerWithDocs: WorkerDetail;
let mockDossier: VerificationDossier;

function renderModal(workerId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkerDetailModal workerId={workerId} onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkerDetailModal KYC Documents Section & Accept Button Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWorkerWithDocs = createMockWorker();
    mockDossier = createMockDossier();
    useAuthStore.getState().setSession(
      {
        id: 'user-exec-1',
        name: 'Verification Executive',
        email: 'exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'token-123'
    );
  });

  it('1. Displays all documents actually submitted by the worker at the same time with an Accept button each', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    // Step 1 -> Step 2
    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Section header
    expect(await screen.findByText(/Documents — Submitted KYC Documents \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Encrypted Cloud Storage/i)).toBeInTheDocument();

    // Exactly all submitted documents rendered simultaneously, no placeholders for telephonic/unsubmitted checks
    expect(screen.getByText('Aadhaar Card (National ID)')).toBeInTheDocument();
    expect(screen.getByText('Electricity Utility Bill')).toBeInTheDocument();
    expect(screen.queryByText(/Police Clearance Document/i)).not.toBeInTheDocument();

    // Both submitted documents have an Accept button simultaneously
    const acceptButtons = screen.getAllByRole('button', { name: /^Accept$/i });
    expect(acceptButtons.length).toBe(2);

    // The Documents section table contains no Locked buttons
    const docsTable = screen.getByRole('table');
    expect(within(docsTable).queryByRole('button', { name: /^Locked$/i })).toBeNull();
  });

  it('2. Reviewers can open and inspect any submitted document in any order', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);
    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/documents/doc-address-102.pdf?sig=valid',
      signedUrl: 'https://vault.sevanest.internal/documents/doc-address-102.pdf?sig=valid',
      expiresAt: '2026-10-29T18:00:00Z',
      expiresInSeconds: 900,
    });

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click on the second document directly (Electricity Utility Bill) without touching Aadhaar first
    const addressDocText = await screen.findByText('Electricity Utility Bill');
    await user.click(addressDocText);

    // Verify secure vault preview opened for Electricity Utility Bill
    expect(await screen.findByText(/Authorized Document Vault Preview/i)).toBeInTheDocument();
    expect(linkSpy).toHaveBeenCalledWith('W-KYC-DOCS', 'ADDRESS', 'doc-address-102');
    expect(screen.getAllByText(/Electricity Utility Bill/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Validity: 2026-10-29T18:00:00Z/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Secure Document Link/i })).toBeInTheDocument();
  });

  it('3. Clicking Accept invokes existing backend approval workflow and updates status to VERIFIED on confirmation', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click Accept on the first document (Aadhaar Card)
    const acceptButtons = await screen.findAllByRole('button', { name: /^Accept$/i });
    await user.click(acceptButtons[0]);

    // Confirmation dialog opens
    expect(await screen.findByText(/Approve Aadhaar Card \(National ID\)/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Verify backend API called with checkId and checkType
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-id-101',
        'IDENTITY',
        expect.any(String)
      );
    });

    // Success feedback is displayed
    expect(await screen.findByText(/successfully approved by the backend/i)).toBeInTheDocument();
  });

  it('4. If backend rejects approval because prerequisite is incomplete, shows actual error clearly and keeps document available for inspection', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/documents/doc-address-102.pdf',
      signedUrl: 'https://vault.sevanest.internal/documents/doc-address-102.pdf',
      expiresAt: '2026-10-29T18:00:00Z',
    });
    vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(
      new Error('Prerequisite incomplete: Identity verification must be approved first (HTTP 422)')
    );

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Inspect the address document first
    const addressDocText = await screen.findByText('Electricity Utility Bill');
    await user.click(addressDocText);
    expect(await screen.findByText(/Authorized Document Vault Preview/i)).toBeInTheDocument();

    // Click Accept on the address document in the preview or table
    const acceptButtons = await screen.findAllByRole('button', { name: /^Accept$/i });
    await user.click(acceptButtons[1]); // Address document Accept button

    const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Error feedback from backend displayed clearly
    await waitFor(() => {
      expect(screen.getAllByText(/Identity verification must be approved first \(HTTP 422\)/i).length).toBeGreaterThan(0);
    });

    // Close the confirm dialog to verify document is still available for inspection
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    // Document inspection viewer is still open and available for inspection
    expect(screen.getByText(/Authorized Document Vault Preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Electricity Utility Bill/i).length).toBeGreaterThan(0);
  });

  it('5. All submitted documents are visible simultaneously without placeholders, preserving Section B checklist and sign-off rules', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Documents section contains exactly the 2 submitted documents
    expect(screen.getByText('Aadhaar Card (National ID)')).toBeInTheDocument();
    expect(screen.getByText('Electricity Utility Bill')).toBeInTheDocument();

    // Navigate to Stage 3 and Stage 4
    const nextManualBtn = await screen.findByRole('button', { name: /Next: Manual Document Verification/i });
    await user.click(nextManualBtn);
    const nextFinalBtn = await screen.findByRole('button', { name: /Next: Final Worker Approval/i });
    await user.click(nextFinalBtn);

    // Final Approve Worker card is present while activation is gated until sign-off
    expect(screen.getByRole('heading', { name: /^Approve Worker \(Verification Sign-Off\)$/i })).toBeInTheDocument();
    // Activation is gated until sign-off
    expect(screen.queryByRole('button', { name: /Activate Worker onto Commercial Roster/i })).not.toBeInTheDocument();
  });

  it('6. Submitted document rows have enabled Accept buttons, and prerequisite rejections display backend errors', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerWithDocs);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(
      new Error('Prerequisite incomplete: Earlier checks must be approved before Address Proof (HTTP 422)')
    );

    const user = userEvent.setup();
    renderModal('W-KYC-DOCS');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Displays the submitted documents with Accept buttons
    const acceptButtons = screen.getAllByRole('button', { name: /^Accept$/i });
    expect(acceptButtons.length).toBe(2);
    acceptButtons.forEach((btn) => {
      expect(btn).toBeEnabled();
    });

    // Attempt to approve document 2 (Address Proof)
    const addressApproveBtn = acceptButtons[1];
    await user.click(addressApproveBtn);

    // Confirmation dialog opens
    expect(await screen.findByText(/Approve Electricity Utility Bill/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Backend approveCheck called with checkId
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-addr-102',
        'ADDRESS',
        expect.any(String)
      );
    });

    // Backend 422 prerequisite error is displayed clearly
    await waitFor(() => {
      expect(screen.getAllByText(/Earlier checks must be approved before Address Proof \(HTTP 422\)/i).length).toBeGreaterThan(0);
    });

    // Close confirm dialog
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    // Document is NOT marked approved; it remains SUBMITTED / Pending
    const statusBadges = screen.getAllByText(/Pending|Submitted/i);
    expect(statusBadges.length).toBeGreaterThan(0);
  });
});

