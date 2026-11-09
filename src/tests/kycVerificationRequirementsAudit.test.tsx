import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { WorkerDetail } from '../features/workers/domain/types';
import { VerificationDossier } from '../features/verification/domain/types';

function renderModal(workerId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

const mockDomesticWorker: WorkerDetail = {
  id: 'W-DOM-001',
  applicationId: 'APP-DOM-001',
  name: 'Lakshmi Bai',
  category: 'House Cook',
  categories: ['House Cook'],
  experienceYears: 4,
  ratingAverage: 4.7,
  totalReviews: 12,
  locality: 'Madhapur',
  serviceRadiusKm: 5,
  languages: ['Hindi', 'Telugu'],
  bio: 'Specialist in North and South Indian cooking.',
  skills: ['Cooking', 'Kitchen Hygiene'],
  isFullyVerified: false,
  status: 'ACTIVE',
  phoneMasked: '+91 98450 *****',
  phone: '+91 98450 11223',
  email: 'lakshmi.bai@example.com',
  onboardingStatus: 'IN_REVIEW',
  verificationStatus: 'IN_REVIEW',
  createdAt: '2026-02-01T10:00:00Z',
  registeredAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-15T12:00:00Z',
  preferredServiceArea: 'Madhapur, Hitec City',
  expectedCompensation: '₹20,000 / month',
  availability: 'Available Immediately',
  activeEngagementsCount: 0,
  completedBookingsCount: 0,
  replacementsIncurred: 0,
  recentEngagements: [],
  internalNotes: [],
  documents: [
    {
      id: 'doc-aadhaar-lakshmi',
      documentId: 'doc-aadhaar-lakshmi',
      documentType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-9911',
      status: 'VERIFIED',
      submittedAt: '2026-02-01T10:05:00Z',
      verifiedAt: '2026-02-02T11:00:00Z',
      reviewable: true,
      available: true,
    },
  ],
  verification: {
    level: 'L1',
    identityProofStatus: 'VERIFIED',
    identityDocName: 'Aadhaar Card',
    addressProofStatus: 'VERIFIED',
    criminalRecordStatus: 'VERIFIED',
    referenceCheckStatus: 'VERIFIED',
    phoneOtpVerified: true,
    skillProofStatus: 'PENDING',
    overallRemarks: 'All verified',
  },
};

const mockDriverWorker: WorkerDetail = {
  ...mockDomesticWorker,
  id: 'W-DRV-002',
  applicationId: 'APP-DRV-002',
  name: 'Rajesh Kumar',
  category: 'Driver',
  categories: ['Driver'],
  documents: [
    {
      id: 'doc-license-rajesh',
      documentId: 'doc-license-rajesh',
      documentType: 'LICENSE',
      documentTypeName: 'Commercial Driving License',
      docNumberMasked: 'DL-TS-0920190012',
      status: 'SUBMITTED',
      submittedAt: '2026-02-01T10:05:00Z',
      reviewable: true,
      available: true,
    },
  ],
};

describe('KYC Verification Requirements Audit & Correction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'sup-01',
        name: 'Verification Supervisor',
        email: 'supervisor@sevanest.internal',
        role: 'VERIFICATION_SUPERVISOR',
        permissions: [
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_SIGNOFF,
        ],
      },
      'token-sup'
    );
  });

  it('1. Removes unsupported "Criminal Self-Declaration" check from UI', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockDomesticWorker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
      id: 'dossier-lakshmi',
      checkId: 'chk-identity-lakshmi',
      applicationId: 'APP-DOM-001',
      workerId: 'W-DOM-001',
      workerName: 'Lakshmi Bai',
      category: 'House Cook',
      skills: ['Cooking'],
      locality: 'Madhapur',
      experienceYears: 4,
      phoneMasked: '+91 98450 *****',
      submissionTime: '2026-02-01T10:00:00Z',
      status: 'VERIFIED',
      preCheckOtpVerified: true,
      requiredChecks: ['IDENTITY'],
      submittedDocuments: mockDomesticWorker.documents || [],
      checks: {
        IDENTITY: {
          id: 'chk-identity-lakshmi',
          type: 'IDENTITY',
          title: 'Identity Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
      },
    } as unknown as VerificationDossier);

    const user = userEvent.setup();
    renderModal('W-DOM-001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // KYC Documents heading is rendered
    expect(await screen.findByRole('heading', { name: /^Worker KYC Documents$/i })).toBeInTheDocument();

    // Verify "Criminal Self-Declaration" is completely absent from verification checks
    expect(screen.queryByText(/Criminal Self-Declaration/i)).not.toBeInTheDocument();
  });

  it('2. Does not show Skill Certificate for domestic helpers unless submitted or required', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockDomesticWorker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
      id: 'dossier-lakshmi',
      checkId: 'chk-identity-lakshmi',
      applicationId: 'APP-DOM-001',
      workerId: 'W-DOM-001',
      workerName: 'Lakshmi Bai',
      category: 'House Cook',
      status: 'VERIFIED',
      preCheckOtpVerified: true,
      requiredChecks: ['IDENTITY'],
      submittedDocuments: mockDomesticWorker.documents || [],
      checks: {
        IDENTITY: {
          id: 'chk-identity-lakshmi',
          type: 'IDENTITY',
          title: 'Identity Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
      },
    } as unknown as VerificationDossier);

    const user = userEvent.setup();
    renderModal('W-DOM-001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Skill certificate should NOT be rendered for domestic cooks without certificate upload
    expect(screen.queryByText(/Skill Certificate Verification/i)).not.toBeInTheDocument();
  });

  it('3. Conditionally renders Commercial / Driving License for Driver role', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockDriverWorker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
      id: 'dossier-rajesh',
      checkId: 'chk-lic-rajesh',
      applicationId: 'APP-DRV-002',
      workerId: 'W-DRV-002',
      workerName: 'Rajesh Kumar',
      category: 'Driver',
      status: 'PENDING_REVIEW',
      preCheckOtpVerified: true,
      requiredChecks: ['IDENTITY', 'LICENSE'],
      submittedDocuments: mockDriverWorker.documents || [],
      checks: {
        LICENSE: {
          id: 'chk-lic-rajesh',
          type: 'LICENSE',
          title: 'Commercial / Driving License',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
      },
    } as unknown as VerificationDossier);

    const user = userEvent.setup();
    renderModal('W-DRV-002');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Commercial Driving License must be present for Driver
    expect((await screen.findAllByText(/Commercial Driving License/i)).length).toBeGreaterThan(0);
  });

  it('4. Calculates progress and required counts dynamically from backend required checks (not hardcoded to 6)', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockDomesticWorker);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
      id: 'dossier-lakshmi',
      checkId: 'chk-identity-lakshmi',
      applicationId: 'APP-DOM-001',
      workerId: 'W-DOM-001',
      workerName: 'Lakshmi Bai',
      category: 'House Cook',
      status: 'VERIFIED',
      preCheckOtpVerified: true,
      requiredChecks: ['IDENTITY'], // Backend requires only IDENTITY
      submittedDocuments: mockDomesticWorker.documents || [],
      checks: {
        IDENTITY: {
          id: 'chk-identity-lakshmi',
          type: 'IDENTITY',
          title: 'Identity Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
      },
    } as unknown as VerificationDossier);

    const user = userEvent.setup();
    renderModal('W-DOM-001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Displays exactly the submitted document (1) and does not hardcode 6 requirements or progress bars
    expect(await screen.findByRole('heading', { name: /^Worker KYC Documents$/i })).toBeInTheDocument();
    expect((await screen.findAllByText(/Submitted Documents/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/of 6 Requirements Satisfied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 6/i)).not.toBeInTheDocument();
  });

  it('5. Unlocks Supervisor Sign-Off when all dynamic required checks are satisfied', async () => {
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
      ...mockDomesticWorker,
      verificationStatus: 'IN_REVIEW',
    });
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
      id: 'dossier-lakshmi',
      checkId: 'chk-identity-lakshmi',
      applicationId: 'APP-DOM-001',
      workerId: 'W-DOM-001',
      workerName: 'Lakshmi Bai',
      category: 'House Cook',
      status: 'PENDING_REVIEW',
      preCheckOtpVerified: true,
      requiredChecks: ['IDENTITY'],
      submittedDocuments: mockDomesticWorker.documents || [],
      checks: {
        IDENTITY: {
          id: 'chk-identity-lakshmi',
          type: 'IDENTITY',
          title: 'Identity Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
      },
    } as unknown as VerificationDossier);

    const user = userEvent.setup();
    renderModal('W-DOM-001');

    const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
    await user.click(nextBtn);

    // Navigate to Stage 3 (Final Approval) where Sign-Off lives
    const nextFinalBtn = await screen.findByRole('button', { name: /Next: Final Worker Approval|Next: Final Approval/i });
    await user.click(nextFinalBtn);

    // Final Supervisor Sign-off button is unlocked & enabled
    const signOffBtn = await screen.findByRole('button', { name: /Approve Worker/i });
    expect(signOffBtn).toBeEnabled();
  });
});
