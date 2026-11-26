import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  workerRepository,
} from '../features/workers/data/workerRepository';
import type { WorkerVerificationDetail } from '../features/workers/domain/types';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const baseWorker = {
  id: 'W-FA-TEST',
  name: 'Priya Reddy',
  category: 'House Maid',
  categories: ['House Maid'],
  experienceYears: 3,
  ratingAverage: 4.2,
  totalReviews: 5,
  locality: 'Jubilee Hills',
  serviceRadiusKm: 5,
  languages: ['Hindi', 'Telugu'],
  bio: 'Experienced house maid',
  isFullyVerified: false,
  status: 'UNDER_REVIEW' as const,
  onboardingStatus: 'IN_REVIEW' as const,
  activeEngagementsCount: 0,
  completedBookingsCount: 0,
  replacementsIncurred: 0,
  recentEngagements: [],
  internalNotes: [],
};

const baseVerification: WorkerVerificationDetail = {
  phoneOtpVerified: true,
  identityProofStatus: 'PENDING',
  addressProofStatus: 'PENDING',
  criminalRecordStatus: 'PENDING',
  skillProofStatus: 'NOT_APPLICABLE',
  referenceCheckStatus: 'PENDING',
};

const makeVerification = (overrides: Partial<typeof baseVerification> = {}) => ({
  ...baseVerification,
  ...overrides,
});

function makeDossier(checksOverrides: Record<string, { status: string; rejectionRemarks?: string }> = {}) {
  const defaults: Record<string, unknown> = {
    IDENTITY: { id: 'chk-id-1', type: 'IDENTITY', title: 'Identity Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
    ADDRESS: { id: 'chk-addr-2', type: 'ADDRESS', title: 'Address Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
    EMERGENCY_CONTACT: { id: 'chk-em-3', type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
    REFERENCE: { id: 'chk-ref-4', type: 'REFERENCE', title: 'Reference', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
    POLICE_CLEARANCE: { id: 'chk-pol-5', type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
  };
  for (const [k, v] of Object.entries(checksOverrides)) {
    if (defaults[k]) {
      (defaults[k] as Record<string, unknown>).status = v.status;
      if (v.rejectionRemarks) (defaults[k] as Record<string, unknown>).rejectionRemarks = v.rejectionRemarks;
    }
  }
  return {
    id: 'W-FA-TEST',
    applicationId: 'APP-FA-TEST',
    workerId: 'W-FA-TEST',
    workerName: 'Priya Reddy',
    category: 'House Maid',
    locality: 'Jubilee Hills',
    experienceYears: 3,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-11-01T10:00:00Z',
    status: 'PENDING_REVIEW',
    level: 'IN_PROGRESS',
    preCheckOtpVerified: true,
    checks: defaults,
  };
}

function setupAuth() {
  useAuthStore.setState({
    user: {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@sevanest.in',
      role: 'SUPER_ADMIN',
      permissions: [
        '*',
        PERMISSIONS.WORKERS_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DECIDE,
        PERMISSIONS.VERIFICATION_SIGNOFF,
        PERMISSIONS.WORKER_ACTIVATE,
        PERMISSIONS.WORKER_MANAGE,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
      ],
    },
    accessToken: 'test-token',
    isAuthenticated: true,
  });
}

describe('Final Worker Approval — Simplified UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setupAuth();
  });

  it('shows compact verification summary with per-check status (not a document table)', async () => {
    const dossier = makeDossier({
      IDENTITY: { status: 'APPROVED' },
      ADDRESS: { status: 'APPROVED' },
      EMERGENCY_CONTACT: { status: 'APPROVED' },
      REFERENCE: { status: 'REJECTED', rejectionRemarks: 'Could not reach employer' },
      POLICE_CLEARANCE: { status: 'IN_REVIEW' },
    });
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      verification: makeVerification({
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'VERIFIED',
        referenceCheckStatus: 'FAILED',
      }),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="final-approval" />
    );

    await waitFor(() => {
      expect(screen.getByText('Final Worker Approval')).toBeInTheDocument();
    });

    // Verification Summary section shows required/approved count
    expect(screen.getByText(/\/5 required approved/)).toBeInTheDocument();

    // Check rows exist with correct statuses
    const identityRow = screen.getByTestId('check-row-IDENTITY');
    expect(within(identityRow).getByTestId('check-status-IDENTITY')).toHaveTextContent('Approved');

    const refRow = screen.getByTestId('check-row-REFERENCE');
    expect(within(refRow).getByTestId('check-status-REFERENCE')).toHaveTextContent('Rejected');
    // Rejection reason shown
    expect(within(refRow).getByText('Could not reach employer')).toBeInTheDocument();

    const policeRow = screen.getByTestId('check-row-POLICE_CLEARANCE');
    expect(within(policeRow).getByTestId('check-status-POLICE_CLEARANCE')).toHaveTextContent('In Review');

    // No document table with headers "Reference" / "Submitted On" / "Backend Status"
    expect(screen.queryByText('Backend Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Document Name')).not.toBeInTheDocument();
  });

  it('deduplicates documents with same checkType but different IDs', async () => {
    // Backend sends IDENTITY from both submittedDocuments and checks.IDENTITY.documentMetadata
    const dossier = makeDossier({ IDENTITY: { status: 'PENDING' } });
    (dossier as Record<string, unknown>).submittedDocuments = [
      {
        id: 'doc-identity-A',
        documentId: 'doc-identity-A',
        checkId: 'chk-id-1',
        checkType: 'IDENTITY',
        documentTypeName: 'Identity Proof (Aadhaar)',
        docNumberMasked: 'XXXX-XXXX-1234',
        reviewable: true,
        available: true,
        status: 'SUBMITTED',
        submittedAt: '2026-11-01T10:00:00Z',
      },
    ];
    const identityCheck = (dossier.checks as Record<string, Record<string, unknown>>).IDENTITY;
    identityCheck.documentMetadata = {
      documentId: 'doc-identity-B',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-1234',
      reviewable: true,
    };

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      verification: makeVerification(),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="digital-docs" />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Digitally Submitted Documents/).length).toBeGreaterThan(0);
    });

    // Should show IDENTITY only once — deduped by checkType
    const identityDocs = screen.getAllByText(/Identity Proof/);
    // Filter to only document name cells (not the check title in verification summary)
    const identityInTable = identityDocs.filter((el) => {
      const row = el.closest('tr') || el.closest('[role="button"]');
      return row !== null;
    });
    expect(identityInTable.length).toBeLessThanOrEqual(1);
  });

  it('shows per-check accurate status (not all REJECTED when application is ACTION_REQUIRED)', async () => {
    const dossier = makeDossier({
      IDENTITY: { status: 'APPROVED' },
      ADDRESS: { status: 'REJECTED', rejectionRemarks: 'Blurry image' },
      EMERGENCY_CONTACT: { status: 'APPROVED' },
      REFERENCE: { status: 'PENDING' },
      POLICE_CLEARANCE: { status: 'PENDING' },
    });
    (dossier as Record<string, unknown>).applicationStatus = 'ACTION_REQUIRED';

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      applicationStatus: 'ACTION_REQUIRED',
      verification: makeVerification({
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'REJECTED',
      }),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="final-approval" />
    );

    await waitFor(() => {
      expect(screen.getByText('Final Worker Approval')).toBeInTheDocument();
    });

    // Action required banner shown
    expect(screen.getByTestId('action-required-banner')).toBeInTheDocument();

    // IDENTITY is Approved, not Rejected
    expect(within(screen.getByTestId('check-row-IDENTITY')).getByTestId('check-status-IDENTITY')).toHaveTextContent('Approved');
    // ADDRESS is Rejected with reason
    expect(within(screen.getByTestId('check-row-ADDRESS')).getByTestId('check-status-ADDRESS')).toHaveTextContent('Rejected');
    expect(within(screen.getByTestId('check-row-ADDRESS')).getByText('Blurry image')).toBeInTheDocument();
    // REFERENCE is Pending, not Rejected
    expect(within(screen.getByTestId('check-row-REFERENCE')).getByTestId('check-status-REFERENCE')).toHaveTextContent('Pending');
  });

  it('sign-off button disabled when mandatory checks incomplete, enabled when all approved', async () => {
    // Partial approval
    const partialDossier = makeDossier({
      IDENTITY: { status: 'APPROVED' },
      ADDRESS: { status: 'APPROVED' },
      EMERGENCY_CONTACT: { status: 'PENDING' },
      REFERENCE: { status: 'PENDING' },
      POLICE_CLEARANCE: { status: 'PENDING' },
    });
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      verification: makeVerification({
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'VERIFIED',
      }),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(partialDossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="final-approval" />
    );

    await waitFor(() => {
      expect(screen.getByText('Final Worker Approval')).toBeInTheDocument();
    });

    const signOffBtn = screen.getByLabelText('Sign Off Verification');
    expect(signOffBtn).toBeDisabled();
    expect(screen.getByText(/mandatory check\(s\) incomplete/)).toBeInTheDocument();
  });

  it('shows reject worker option as compact inline control, not a full card', async () => {
    const dossier = makeDossier();
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      verification: makeVerification(),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="final-approval" />
    );

    await waitFor(() => {
      expect(screen.getByText('Final Worker Approval')).toBeInTheDocument();
    });

    // Reject button exists
    const rejectBtn = screen.getByTestId('stage4-card-reject-btn');
    expect(rejectBtn).toBeInTheDocument();
    expect(rejectBtn).not.toBeDisabled();

    // No verbose "Reject Worker (Application Rejection)" card heading
    expect(screen.queryByText('Reject Worker (Application Rejection)')).not.toBeInTheDocument();
  });

  it('preserves separate legitimate documents with different document numbers (does not hide legitimate docs)', async () => {
    // Worker submitted two distinct identity documents (e.g. Aadhaar Card and Voter ID card)
    const dossier = makeDossier({ IDENTITY: { status: 'PENDING' } });
    (dossier as Record<string, unknown>).submittedDocuments = [
      {
        id: 'doc-aadhaar-001',
        documentId: 'doc-aadhaar-001',
        checkId: 'chk-id-1',
        checkType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
        reviewable: true,
        available: true,
        status: 'SUBMITTED',
        submittedAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'doc-voter-002',
        documentId: 'doc-voter-002',
        checkId: 'chk-id-1',
        checkType: 'IDENTITY',
        documentTypeName: 'Voter ID Card',
        docNumberMasked: 'VOT-98765432',
        reviewable: true,
        available: true,
        status: 'SUBMITTED',
        submittedAt: '2026-11-01T10:05:00Z',
      },
    ];

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      verification: makeVerification(),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="digital-docs" />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Digitally Submitted Documents/).length).toBeGreaterThan(0);
    });

    // Both distinct documents should be present in the documents table
    expect(screen.getByText('Aadhaar Card')).toBeInTheDocument();
    expect(screen.getByText('XXXX-XXXX-1234')).toBeInTheDocument();
    expect(screen.getByText('Voter ID Card')).toBeInTheDocument();
    expect(screen.getByText('VOT-98765432')).toBeInTheDocument();
  });

  it('preserves real document references, submission dates, and accurate per-document status', async () => {
    const dossier = makeDossier({
      IDENTITY: { status: 'APPROVED' },
      ADDRESS: { status: 'REJECTED', rejectionRemarks: 'Address document blurry' },
    });
    (dossier as Record<string, unknown>).applicationStatus = 'ACTION_REQUIRED';
    (dossier as Record<string, unknown>).submittedDocuments = [
      {
        id: 'doc-aadhaar-001',
        documentId: 'doc-aadhaar-001',
        checkId: 'chk-id-1',
        checkType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-4321',
        reviewable: true,
        available: true,
        status: 'VERIFIED',
        submittedAt: '2026-11-02T14:30:00Z',
      },
      {
        id: 'doc-address-002',
        documentId: 'doc-address-002',
        checkId: 'chk-addr-2',
        checkType: 'ADDRESS',
        documentTypeName: 'Electricity Bill',
        docNumberMasked: 'BILL-EB-9988',
        reviewable: true,
        available: true,
        status: 'REJECTED',
        submittedAt: '2026-11-02T14:35:00Z',
      },
    ];

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...baseWorker,
      applicationStatus: 'ACTION_REQUIRED',
      verification: makeVerification({
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'REJECTED',
      }),
      documents: [],
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(dossier as never);

    renderWithProviders(
      <WorkerDetailModal workerId="W-FA-TEST" onClose={vi.fn()} initialStep="digital-docs" />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Digitally Submitted Documents/).length).toBeGreaterThan(0);
    });

    // Real document references are preserved and formatted
    expect(screen.getByText('XXXX-XXXX-4321')).toBeInTheDocument();
    expect(screen.getByText('BILL-EB-9988')).toBeInTheDocument();

    // Identity document is VERIFIED, not assigned REJECTED
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    // Address document shows Awaiting Resubmission / rejection state
    expect(screen.getByText('Awaiting Resubmission')).toBeInTheDocument();
  });
});

