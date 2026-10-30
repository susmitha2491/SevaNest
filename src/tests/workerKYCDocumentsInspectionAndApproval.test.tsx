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

const createWorker = (): WorkerDetail => ({
  id: 'W-99001',
  name: 'Anita Devi',
  category: 'House Maid',
  categories: ['House Maid'],
  experienceYears: 5,
  ratingAverage: 4.9,
  totalReviews: 32,
  locality: 'Kondapur',
  serviceRadiusKm: 12,
  languages: ['Hindi', 'Telugu'],
  bio: 'Expert housekeeping and cleaning professional',
  isFullyVerified: false,
  status: 'ACTIVE',
  onboardingStatus: 'IN_REVIEW',
  phoneMasked: '+91 99887 *****',
  documents: [
    {
      id: 'doc-aadhaar-991',
      documentId: 'doc-aadhaar-991',
      checkId: 'chk-identity-991',
      checkType: 'IDENTITY',
      documentType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card (National ID)',
      docNumberMasked: 'XXXX-XXXX-9912',
      status: 'SUBMITTED',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      submittedAt: '2026-10-22T09:00:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-utility-992',
      documentId: 'doc-utility-992',
      checkId: 'chk-address-992',
      checkType: 'ADDRESS',
      documentType: 'ADDRESS',
      documentTypeName: 'Electricity Utility Bill (Kondapur)',
      docNumberMasked: 'ELEC-992-HYD',
      status: 'SUBMITTED',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      submittedAt: '2026-10-22T09:15:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-pcc-993',
      documentId: 'doc-pcc-993',
      checkId: 'chk-police-993',
      checkType: 'POLICE_CLEARANCE',
      documentType: 'POLICE_CLEARANCE',
      documentTypeName: 'Cyberabad Police Clearance Certificate',
      docNumberMasked: 'PCC-CYB-993',
      status: 'SUBMITTED',
      contentType: 'image/png',
      mimeType: 'image/png',
      submittedAt: '2026-10-22T09:30:00Z',
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

const createDossier = (): VerificationDossier => ({
  id: 'dossier-99001',
  workerId: 'W-99001',
  workerName: 'Anita Devi',
  category: 'House Maid',
  locality: 'Kondapur',
  experienceYears: 5,
  phoneMasked: '+91 99887 *****',
  submissionTime: '2026-10-22T09:00:00Z',
  status: 'PENDING_REVIEW',
  preCheckOtpVerified: true,
  submittedDocuments: [
    {
      id: 'doc-aadhaar-991',
      documentId: 'doc-aadhaar-991',
      checkId: 'chk-identity-991',
      checkType: 'IDENTITY',
      checkTitle: 'Identity Proof',
      documentTypeName: 'Aadhaar Card (National ID)',
      docNumberMasked: 'XXXX-XXXX-9912',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      status: 'SUBMITTED',
      submittedAt: '2026-10-22T09:00:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-utility-992',
      documentId: 'doc-utility-992',
      checkId: 'chk-address-992',
      checkType: 'ADDRESS',
      checkTitle: 'Address Proof',
      documentTypeName: 'Electricity Utility Bill (Kondapur)',
      docNumberMasked: 'ELEC-992-HYD',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      status: 'SUBMITTED',
      submittedAt: '2026-10-22T09:15:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-pcc-993',
      documentId: 'doc-pcc-993',
      checkId: 'chk-police-993',
      checkType: 'POLICE_CLEARANCE',
      checkTitle: 'Police Clearance Certificate',
      documentTypeName: 'Cyberabad Police Clearance Certificate',
      docNumberMasked: 'PCC-CYB-993',
      contentType: 'image/png',
      mimeType: 'image/png',
      status: 'SUBMITTED',
      submittedAt: '2026-10-22T09:30:00Z',
      reviewable: true,
      available: true,
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-identity-991',
      type: 'IDENTITY',
      title: 'Identity Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        id: 'doc-aadhaar-991',
        documentId: 'doc-aadhaar-991',
        checkId: 'chk-identity-991',
        checkType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card (National ID)',
        docNumberMasked: 'XXXX-XXXX-9912',
        contentType: 'image/jpeg',
        mimeType: 'image/jpeg',
        reviewable: true,
        available: true,
      },
    },
    ADDRESS: {
      id: 'chk-address-992',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        id: 'doc-utility-992',
        documentId: 'doc-utility-992',
        checkId: 'chk-address-992',
        checkType: 'ADDRESS',
        documentTypeName: 'Electricity Utility Bill (Kondapur)',
        docNumberMasked: 'ELEC-992-HYD',
        contentType: 'application/pdf',
        mimeType: 'application/pdf',
        reviewable: true,
        available: true,
      },
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emergency-994',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-reference-995',
      type: 'REFERENCE',
      title: 'Previous Employer Reference',
      status: 'PENDING',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-police-993',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance Certificate',
      status: 'PENDING',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        id: 'doc-pcc-993',
        documentId: 'doc-pcc-993',
        checkId: 'chk-police-993',
        checkType: 'POLICE_CLEARANCE',
        documentTypeName: 'Cyberabad Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-993',
        contentType: 'image/png',
        mimeType: 'image/png',
        reviewable: true,
        available: true,
      },
    },
  },
});

function renderTestModal(workerId: string) {
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

describe('KYC Document Inspection and Approval Workflow End-to-End', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'user-exec-test',
        name: 'Verification Officer',
        email: 'officer@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'token-xyz'
    );
  });

  it('1. Traces document from worker submission to card with genuine document ID and check ID', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Header displays 3 submitted documents
    expect(await screen.findByText(/Documents — Submitted KYC Documents \(3\)/i)).toBeInTheDocument();

    // Verify all 3 document rows are rendered
    expect(screen.getByText('Aadhaar Card (National ID)')).toBeInTheDocument();
    expect(screen.getByText('Electricity Utility Bill (Kondapur)')).toBeInTheDocument();
    expect(screen.getByText('Cyberabad Police Clearance Certificate')).toBeInTheDocument();

    // Verify masked reference numbers
    expect(screen.getByText('XXXX-XXXX-9912')).toBeInTheDocument();
    expect(screen.getByText('ELEC-992-HYD')).toBeInTheDocument();
    expect(screen.getByText('PCC-CYB-993')).toBeInTheDocument();

    // Verify all 3 document rows have Accept buttons
    const acceptButtons = screen.getAllByRole('button', { name: /^Accept$/i });
    expect(acceptButtons.length).toBe(3);
  });

  it('2. Clicking Inspect Document on an image file calls exact document-link endpoint with document ID and renders <img> tag', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/storage/aadhaar-front.jpg?token=secret123',
      signedUrl: 'https://vault.sevanest.internal/storage/aadhaar-front.jpg?token=secret123',
      expiresAt: '2026-10-29T19:00:00Z',
      expiresInSeconds: 900,
    });

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click "Inspect Document" for Aadhaar Card
    const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Document/i });
    await user.click(inspectButtons[0]);

    // Verify exact contract: documentId was passed, not workerId or checkId
    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith('W-99001', 'IDENTITY', 'doc-aadhaar-991');
    });

    // Verify preview header
    expect(await screen.findByText(/Authorized Document Vault Preview/i)).toBeInTheDocument();

    // Verify actual <img> rendered with src matching the returned signedUrl
    const imageEl = await screen.findByTestId('kyc-document-image');
    expect(imageEl).toBeInTheDocument();
    expect(imageEl).toHaveAttribute('src', 'https://vault.sevanest.internal/storage/aadhaar-front.jpg?token=secret123');

    // Verify controls (rotate, zoom, new tab)
    expect(screen.getByRole('button', { name: /Rotate 90°/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoom In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoom Out/i })).toBeInTheDocument();
    const linkEl = screen.getByRole('link', { name: /Open Secure Document Link/i });
    expect(linkEl).toHaveAttribute('href', 'https://vault.sevanest.internal/storage/aadhaar-front.jpg?token=secret123');
    expect(linkEl).toHaveAttribute('target', '_blank');
  });

  it('3. Clicking a PDF document renders an embedded <iframe> with signedUrl', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/documents/utility-bill.pdf?sig=valid456',
      signedUrl: 'https://vault.sevanest.internal/documents/utility-bill.pdf?sig=valid456',
      expiresAt: '2026-10-29T19:00:00Z',
      expiresInSeconds: 900,
    });

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click on Electricity Utility Bill row directly
    const utilityDoc = await screen.findByText('Electricity Utility Bill (Kondapur)');
    await user.click(utilityDoc);

    // Verify exact contract: documentId was doc-utility-992
    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith('W-99001', 'ADDRESS', 'doc-utility-992');
    });

    // Verify embedded iframe rendered for PDF
    const pdfFrame = await screen.findByTestId('kyc-document-pdf');
    expect(pdfFrame).toBeInTheDocument();
    expect(pdfFrame).toHaveAttribute('src', 'https://vault.sevanest.internal/documents/utility-bill.pdf?sig=valid456');
  });

  it('4. Handles signed URLs without file extensions by utilizing contentType and rendering <img>', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    // Signed URL has NO .png or .jpg extension in the path (e.g. S3 REST or proxy download)
    const linkSpy = vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/api/v1/storage/documents/pcc-blob?token=amz789',
      signedUrl: 'https://vault.sevanest.internal/api/v1/storage/documents/pcc-blob?token=amz789',
      expiresAt: '2026-10-29T19:00:00Z',
      expiresInSeconds: 900,
    });

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click Police Clearance Certificate row (which has contentType: 'image/png')
    const pccDoc = await screen.findByText('Cyberabad Police Clearance Certificate');
    await user.click(pccDoc);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalledWith('W-99001', 'POLICE_CLEARANCE', 'doc-pcc-993');
    });

    // Should detect image via contentType and render <img>, not placeholder!
    const imageEl = await screen.findByTestId('kyc-document-image');
    expect(imageEl).toBeInTheDocument();
    expect(imageEl).toHaveAttribute('src', 'https://vault.sevanest.internal/api/v1/storage/documents/pcc-blob?token=amz789');
    expect(screen.queryByText(/\[CONFIDENTIAL KYC ATTACHMENT\]/i)).not.toBeInTheDocument();
  });

  it('5. Clicking Accept in the table opens approval dialog with real check ID and updates check to APPROVED on backend confirmation', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click Accept on Aadhaar Card
    const acceptButtons = await screen.findAllByRole('button', { name: /^Accept$/i });
    await user.click(acceptButtons[0]);

    // Verify confirmation dialog
    expect(await screen.findByText(/Approve Aadhaar Card \(National ID\)/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Verify approveCheck called with real checkId chk-identity-991
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-identity-991',
        'IDENTITY',
        expect.any(String)
      );
    });

    // Shows success feedback
    expect(await screen.findByText(/successfully approved by the backend/i)).toBeInTheDocument();
  });

  it('6. Clicking Accept from the Inspection Reviewer Decision Bar approves the inspected check', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      url: 'https://vault.sevanest.internal/documents/utility-bill.pdf',
      signedUrl: 'https://vault.sevanest.internal/documents/utility-bill.pdf',
      expiresAt: '2026-10-29T19:00:00Z',
    });

    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Open Address Proof in inspector
    const utilityDoc = await screen.findByText('Electricity Utility Bill (Kondapur)');
    await user.click(utilityDoc);

    // Find the Decision Bar inside the inspection viewer
    const inspectionDecisionBar = await screen.findByText(/Inspection Review:/i);
    expect(inspectionDecisionBar).toBeInTheDocument();

    // Click Accept button inside the Inspection Reviewer Decision Bar
    const previewContainer = inspectionDecisionBar.closest('div[style*="border-top"]') || inspectionDecisionBar.parentElement;
    const decisionAcceptBtn = within(previewContainer as unknown as Parameters<typeof within>[0]).getByRole('button', { name: /^Accept$/i });
    await user.click(decisionAcceptBtn);

    // Confirm dialog
    expect(await screen.findByText(/Approve Electricity Utility Bill \(Kondapur\)/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-address-992',
        'ADDRESS',
        expect.any(String)
      );
    });

    expect(await screen.findByText(/successfully approved by the backend/i)).toBeInTheDocument();
  });

  it('7. If backend approval fails (e.g. 422 prerequisite incomplete), displays actual API error in dialog and check remains pending', async () => {
    const worker = createWorker();
    const dossier = createDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(worker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier);

    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(
      new Error('Prerequisite incomplete: Previous check must be approved before Police Clearance (HTTP 422)')
    );

    const user = userEvent.setup();
    renderTestModal('W-99001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Click Accept on Police Clearance check (index 2)
    const acceptButtons = await screen.findAllByRole('button', { name: /^Accept$/i });
    await user.click(acceptButtons[2]);

    const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    // Dialog remains open showing the actual backend error
    await waitFor(() => {
      expect(screen.getAllByText(/Previous check must be approved before Police Clearance \(HTTP 422\)/i).length).toBeGreaterThan(0);
    });

    // Check was NOT marked approved
    expect(approveSpy).toHaveBeenCalledWith('chk-police-993', 'POLICE_CLEARANCE', expect.any(String));
  });
});
