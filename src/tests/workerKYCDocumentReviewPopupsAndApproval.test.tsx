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
import { ValidationError } from '../core/errors/DomainError';

const createWorker = (): WorkerDetail => ({
  id: 'W-20480',
  name: 'Sunita Devi',
  category: 'House Maid',
  categories: ['House Maid'],
  experienceYears: 5,
  ratingAverage: 4.8,
  totalReviews: 24,
  locality: 'Kondapur',
  serviceRadiusKm: 10,
  languages: ['Hindi', 'Telugu'],
  bio: 'Experienced housekeeper and domestic assistant.',
  isFullyVerified: false,
  status: 'ACTIVE',
  onboardingStatus: 'IN_REVIEW',
  phoneMasked: '+91 98450 *****',
  documents: [
    {
      id: 'doc-aadhaar-01',
      documentId: 'doc-aadhaar-01',
      checkId: 'chk-identity-01',
      checkType: 'IDENTITY',
      documentType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-4512',
      status: 'SUBMITTED',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      submittedAt: '2026-10-20T08:00:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-pcc-01',
      documentId: 'doc-pcc-01',
      checkId: 'chk-police-01',
      checkType: 'POLICE_CLEARANCE',
      documentType: 'POLICE_CLEARANCE',
      documentTypeName: 'Police Clearance Certificate',
      docNumberMasked: 'PCC-HYD-2026-88',
      status: 'SUBMITTED',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      submittedAt: '2026-10-20T08:30:00Z',
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
  id: 'dossier-20480',
  workerId: 'W-20480',
  workerName: 'Sunita Devi',
  category: 'House Maid',
  locality: 'Kondapur',
  experienceYears: 5,
  phoneMasked: '+91 98450 *****',
  submissionTime: '2026-10-20T08:00:00Z',
  status: 'IN_REVIEW',
  reviewerUserId: 'adm-001',
  preCheckOtpVerified: true,
  submittedDocuments: [
    {
      id: 'doc-aadhaar-01',
      documentId: 'doc-aadhaar-01',
      checkId: 'chk-identity-01',
      checkType: 'IDENTITY',
      checkTitle: 'Identity Proof',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-4512',
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
      status: 'SUBMITTED',
      submittedAt: '2026-10-20T08:00:00Z',
      reviewable: true,
      available: true,
    },
    {
      id: 'doc-pcc-01',
      documentId: 'doc-pcc-01',
      checkId: 'chk-police-01',
      checkType: 'POLICE_CLEARANCE',
      checkTitle: 'Police Clearance Certificate',
      documentTypeName: 'Police Clearance Certificate',
      docNumberMasked: 'PCC-HYD-2026-88',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      status: 'SUBMITTED',
      submittedAt: '2026-10-20T08:30:00Z',
      reviewable: true,
      available: true,
    },
  ],
  checks: {
    IDENTITY: {
      id: 'chk-identity-01',
      type: 'IDENTITY',
      title: 'Identity Proof (Aadhaar)',
      status: 'IN_REVIEW',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documentMetadata: {
        documentId: 'doc-aadhaar-01',
        docNumberMasked: 'XXXX-XXXX-4512',
        nameOnDoc: 'Sunita Devi',
        documentTypeName: 'Aadhaar Card',
      },
    },
    ADDRESS: {
      id: 'chk-address-01',
      type: 'ADDRESS',
      title: 'Address Proof',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
    },
    EMERGENCY_CONTACT: {
      id: 'chk-emergency-01',
      type: 'EMERGENCY_CONTACT',
      title: 'Emergency Contact Vetting',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    REFERENCE: {
      id: 'chk-reference-01',
      type: 'REFERENCE',
      title: 'Previous Employer Reference',
      status: 'APPROVED',
      evaluationMethod: 'TELEPHONIC_VETTING',
    },
    POLICE_CLEARANCE: {
      id: 'chk-police-01',
      type: 'POLICE_CLEARANCE',
      title: 'Police Clearance Certificate',
      status: 'IN_REVIEW',
      evaluationMethod: 'CERTIFICATE_TRACKING',
      documentMetadata: {
        documentId: 'doc-pcc-01',
        docNumberMasked: 'PCC-HYD-2026-88',
        nameOnDoc: 'Sunita Devi',
        documentTypeName: 'Police Clearance Certificate',
      },
    },
  },
});

describe('Worker KYC Document Review – Popup State Management & Backend Approval Validation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'adm-001',
        email: 'verifier@sevanest.com',
        name: 'Verification Executive',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      isAuthenticated: true,
    });

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(createWorker());
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(createDossier());
    vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValue({
      workerId: 'W-20480',
      level: 'IN_PROGRESS',
      requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
      checks: [],
    });
    vi.spyOn(verificationRepository, 'updateDocumentDetails').mockResolvedValue();
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://storage.sevanest.internal/documents/sample.pdf',
      expiresAt: '2026-11-02T12:00:00Z',
    });
  });

  const renderModal = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkerDetailModal workerId="W-20480" initialStep="digital-docs" onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const navigateToKycTab = async () => {
    await waitFor(() => {
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Digitally Submitted Documents')).toBeInTheDocument();
    });
  };

  it('ISSUE 1: Action buttons open their corresponding popups independently without opening others', async () => {
    const user = userEvent.setup();
    renderModal();
    await navigateToKycTab();

    // Locate the table row for Aadhaar Card
    const aadhaarRow = screen.getByText('Aadhaar Card').closest('tr');
    expect(aadhaarRow).toBeInTheDocument();

    // 1. Click "Re-verify" -> only Re-Verification dialog opens
    const recheckBtn = within(aadhaarRow!).getByRole('button', { name: /re-verify/i });
    await user.click(recheckBtn);

    await waitFor(() => {
      expect(screen.getByText(/request re-verification: IDENTITY/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/reject IDENTITY verification check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve Aadhaar Card/i)).not.toBeInTheDocument();

    // Cancel closes recheck dialog
    const cancelBtn1 = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtn1);

    await waitFor(() => {
      expect(screen.queryByText(/request re-verification: IDENTITY/i)).not.toBeInTheDocument();
    });

    // 2. Click "Reject" -> only Rejection dialog opens
    const rejectBtn = within(aadhaarRow!).getByRole('button', { name: /^reject$/i });
    await user.click(rejectBtn);

    await waitFor(() => {
      expect(screen.getByText(/reject IDENTITY verification check/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/request re-verification: IDENTITY/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve Aadhaar Card/i)).not.toBeInTheDocument();

    // Cancel closes rejection dialog
    const cancelBtn2 = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtn2);

    await waitFor(() => {
      expect(screen.queryByText(/reject IDENTITY verification check/i)).not.toBeInTheDocument();
    });

    // 3. Click "Accept" -> only Approval dialog opens
    const acceptBtn = within(aadhaarRow!).getByRole('button', { name: /^accept$/i });
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/approve Aadhaar Card/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/reject IDENTITY verification check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/request re-verification: IDENTITY/i)).not.toBeInTheDocument();

    // Cancel closes approval dialog
    const cancelBtn3 = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtn3);

    await waitFor(() => {
      expect(screen.queryByText(/approve Aadhaar Card/i)).not.toBeInTheDocument();
    });
  });

  it('ISSUE 1: Document Preview modal actions open dialogs immediately on top of the preview with no stacked popups', async () => {
    const user = userEvent.setup();
    renderModal();
    await navigateToKycTab();

    // Open document preview for Aadhaar
    const inspectBtn = screen.getAllByRole('button', { name: /inspect/i })[0];
    await user.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText('Close Preview')).toBeInTheDocument();
    });

    // In preview decision bar, click "Reject Document"
    const rejectDocBtn = screen.getByRole('button', { name: /reject document/i });
    await user.click(rejectDocBtn);

    // Rejection dialog opens immediately
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /reject IDENTITY verification check/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { level: 2, name: /request re-verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /approve/i })).not.toBeInTheDocument();

    // Cancel closes ONLY the rejection dialog, leaving preview modal open
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /reject IDENTITY verification check/i })).not.toBeInTheDocument();
    });
    // Preview modal is still open
    expect(screen.getByText('Close Preview')).toBeInTheDocument();

    // Now click "Request Re-Verification" inside preview
    const recheckDocBtn = screen.getByRole('button', { name: /request re-verification/i });
    await user.click(recheckDocBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /request re-verification: IDENTITY/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { level: 2, name: /reject IDENTITY verification check/i })).not.toBeInTheDocument();

    // Cancel closes only re-verification dialog
    const cancelBtnRecheck = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtnRecheck);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /request re-verification: IDENTITY/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Close Preview')).toBeInTheDocument();
  });

  it('ISSUE 2: Police clearance check requires referenceNumber and future expiresOn, validating before submit', async () => {
    const user = userEvent.setup();
    renderModal();
    await navigateToKycTab();

    const error422 = new ValidationError('This check cannot be approved yet. Missing fields: referenceNumber, expiresOn', {
      errorCode: 'APPROVAL_REQUIREMENTS_MISSING',
      details: ['referenceNumber', 'expiresOn'],
    });

    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck')
      .mockRejectedValueOnce(error422)
      .mockResolvedValue({
        workerId: 'W-20480',
        level: 'IN_PROGRESS',
        requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
        checks: [
          {
            checkId: 'chk-police-01',
            checkType: 'POLICE_CLEARANCE',
            status: 'APPROVED',
            required: true,
            submittedAt: '2026-10-20T08:30:00Z',
            reviewedAt: '2026-11-02T08:00:00Z',
            remarks: 'Approved',
            recheckAt: '2027-11-02',
            reviewerUserId: 'adm-001',
            claimedAt: null,
          },
        ],
      });

    const updateDocSpy = vi.spyOn(verificationRepository, 'updateDocumentDetails').mockResolvedValue();

    // Locate the table row for Police Clearance Certificate
    const pccRow = screen.getByText('Police Clearance Certificate').closest('tr');
    expect(pccRow).toBeInTheDocument();

    const acceptBtn = within(pccRow!).getByRole('button', { name: /^accept$/i });
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/approve Police Clearance Certificate/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirm approval/i });
    await user.click(confirmBtn);

    // Approval dialog displays 422 error and renders missing input fields
    await waitFor(() => {
      expect(screen.getByText(/this check cannot be approved yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('approval-requirements-inputs')).toBeInTheDocument();
      expect(screen.getByTestId('input-document-number')).toBeInTheDocument();
      expect(screen.getByTestId('input-expiry-date')).toBeInTheDocument();
    });

    const docNumberInput = screen.getByTestId('input-document-number');
    const expiryInput = screen.getByTestId('input-expiry-date');

    // Provide reference number first, but leave expiry empty
    await user.type(docNumberInput, 'PCC-HYD-2026-990');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/document expiry date is required for approval/i)).toBeInTheDocument();
    });
    expect(approveSpy).toHaveBeenCalledTimes(1);

    // Enter a past expiry date
    await user.type(expiryInput, '2020-01-01');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/document expiry date must be a valid future date/i)).toBeInTheDocument();
    });
    expect(approveSpy).toHaveBeenCalledTimes(1);

    // Clear reference number and verify it requires reference number
    await user.clear(docNumberInput);
    await user.clear(expiryInput);
    await user.type(expiryInput, '2028-12-31');
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/document reference \/ registration number is required for approval/i)).toBeInTheDocument();
    });
    expect(approveSpy).toHaveBeenCalledTimes(1);

    // Now provide valid reference number and valid future expiry date
    await user.type(docNumberInput, 'PCC-HYD-2026-990');
    await user.click(confirmBtn);

    await waitFor(() => {
      // updateDocumentDetails called first with documentNumber and expiresOn
      expect(updateDocSpy).toHaveBeenCalledWith('chk-police-01', {
        documentNumber: 'PCC-HYD-2026-990',
        expiresOn: '2028-12-31',
      });
      // approveCheck called with exact payload
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-police-01',
        'POLICE_CLEARANCE',
        'Verified and approved by Verification Executive',
        expect.objectContaining({
          documentNumber: 'PCC-HYD-2026-990',
          expiresOn: '2028-12-31',
          recheckAt: '2028-12-31',
        })
      );
    });
  });

  it('ISSUE 2: Handles backend HTTP 422 APPROVAL_REQUIREMENTS_MISSING gracefully without marking check as VERIFIED', async () => {
    const user = userEvent.setup();
    renderModal();
    await navigateToKycTab();

    // Mock approveCheck to fail with 422 APPROVAL_REQUIREMENTS_MISSING
    const error422 = new ValidationError('This check cannot be approved yet. Missing fields: referenceNumber, expiresOn', {
      errorCode: 'APPROVAL_REQUIREMENTS_MISSING',
      details: ['referenceNumber', 'expiresOn'],
    });

    vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValue(error422);

    // Click Accept on Aadhaar Card (which does not require referenceNumber upfront)
    const aadhaarRow = screen.getByText('Aadhaar Card').closest('tr');
    const acceptBtn = within(aadhaarRow!).getByRole('button', { name: /^accept$/i });
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/approve Aadhaar Card/i)).toBeInTheDocument();
    });

    // Confirm without extra fields
    const confirmBtn = screen.getByRole('button', { name: /confirm approval/i });
    await user.click(confirmBtn);

    // Dialog stays open and displays 422 error and renders inputs for missing fields
    await waitFor(() => {
      expect(screen.getByText(/this check cannot be approved yet\. missing fields: referenceNumber, expiresOn/i)).toBeInTheDocument();
      expect(screen.getByTestId('approval-requirements-inputs')).toBeInTheDocument();
      expect(screen.getByTestId('input-document-number')).toBeInTheDocument();
      expect(screen.getByTestId('input-expiry-date')).toBeInTheDocument();
    });

    // Verify check status in the background was NOT changed to VERIFIED or Accepted
    expect(screen.queryByText('Accepted...')).not.toBeInTheDocument();
  });

  it('ISSUE 2: Approval endpoint is NOT called if recording document details fails', async () => {
    const user = userEvent.setup();
    renderModal();
    await navigateToKycTab();

    const error422 = new ValidationError('This check cannot be approved yet. Missing fields: referenceNumber, expiresOn', {
      errorCode: 'APPROVAL_REQUIREMENTS_MISSING',
      details: ['referenceNumber', 'expiresOn'],
    });

    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockRejectedValueOnce(error422);

    // Mock updateDocumentDetails to fail
    vi.spyOn(verificationRepository, 'updateDocumentDetails').mockRejectedValue(
      new ValidationError('Failed to record document details in backend vault.')
    );

    const pccRow = screen.getByText('Police Clearance Certificate').closest('tr');
    const acceptBtn = within(pccRow!).getByRole('button', { name: /^accept$/i });
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/approve Police Clearance Certificate/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirm approval/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('input-expiry-date')).toBeInTheDocument();
    });

    const docNumberInput = screen.getByTestId('input-document-number');
    const expiryInput = screen.getByTestId('input-expiry-date');
    await user.clear(docNumberInput);
    await user.type(docNumberInput, 'PCC-HYD-9988');
    await user.type(expiryInput, '2028-12-31');

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/failed to record document details in backend vault/i).length).toBeGreaterThan(0);
    });

    // Approval endpoint must NOT be called if document details recording fails (only the 1st 422 trigger call occurred)
    expect(approveSpy).toHaveBeenCalledTimes(1);
  });
});
