import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  verificationRepository,
  RealVerificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  workerRepository,
} from '../features/workers/data/workerRepository';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const repoWithDossiers = verificationRepository as unknown as { dossiers?: unknown[] };
const initialDossiersSnapshot = repoWithDossiers.dossiers
  ? JSON.stringify(repoWithDossiers.dossiers)
  : null;

describe('Worker Application & Verification Complete Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (initialDossiersSnapshot && repoWithDossiers.dossiers) {
      repoWithDossiers.dossiers = JSON.parse(initialDossiersSnapshot);
    }
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Senior Verification Executive',
        email: 'verif.exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Queue Ingestion & Separation of Concerns', () => {
    it('displays worker applications awaiting review in the verification queue', async () => {
      renderWithProviders(<VerificationQueuePage />);

      expect(
        await screen.findByRole('heading', { name: /Worker Verification & Trust Operations/i })
      ).toBeInTheDocument();

      // Sunita Devi is in the pending review queue
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText(/W-10482/i)).toBeInTheDocument();
      expect(screen.getByText(/Ordered Oldest-First/i)).toBeInTheDocument();
    });

    it('distinguishes active verified workers from pending verification workers in the Workers List', async () => {
      renderWithProviders(<WorkersListPage />);

      // Filter tabs separating verified roster from pending applications
      expect(await screen.findByRole('button', { name: /All Registered Workers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Active & Verified Roster/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pending Verification \/ Incomplete KYC/i })).toBeInTheDocument();

      // Check Matching Eligibility column exists
      expect(screen.getByText('Matching Eligibility')).toBeInTheDocument();

      // Unverified worker Ramesh Yadav has "Ineligible (KYC Pending)" badge
      const ineligibleBadges = await screen.findAllByText('Ineligible (KYC Pending)');
      expect(ineligibleBadges.length).toBeGreaterThan(0);

      // Verified worker Sunita Devi has "Eligible" badge
      const eligibleBadges = screen.getAllByText('Eligible');
      expect(eligibleBadges.length).toBeGreaterThan(0);

      // Action buttons: Approve and Reject exist in the Actions column
      const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      const rejectButtons = screen.getAllByRole('button', { name: /Reject/i });
      expect(rejectButtons.length).toBeGreaterThan(0);
    });

    it('enforces matching ineligibility in WorkerDetailModal with header badge and verification navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      // Check matching ineligibility badge in header
      expect(
        await screen.findByText(/Matching: INELIGIBLE/i)
      ).toBeInTheDocument();

      // Check navigation to KYC verification
      const nextBtn = screen.getByRole('button', { name: /Next: Verify KYC/i });
      expect(nextBtn).toBeInTheDocument();
      await user.click(nextBtn);

      expect(await screen.findByRole('heading', { name: 'Commercial Platform Activation' })).toBeInTheDocument();
      expect(screen.getByText(/Activation is locked/i)).toBeInTheDocument();
    });
  });

  describe('2. Verification Executive Actions & Permissions', () => {
    it('allows Verification Executive to claim and start review on a pending dossier', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const claimButtons = await screen.findAllByRole('button', { name: /Claim & Review/i });
      expect(claimButtons.length).toBeGreaterThan(0);

      await user.click(claimButtons[0]);

      // Opens dossier view with details
      expect(await screen.findByText(/Verification Dossier:/i)).toBeInTheDocument();
    });

    it('allows Verification Executive to approve an individual verification check', async () => {
      const user = userEvent.setup();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');

      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Navigate through wizard to Step 3: KYC Verification
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      const approveBtn = (await screen.findAllByRole('button', { name: /Approve Check/i }))[0];
      expect(approveBtn).toBeInTheDocument();

      await user.click(approveBtn);

      const confirmApproveBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmApproveBtn);

      expect(approveSpy).toHaveBeenCalledWith('chk-identity-101', 'IDENTITY', expect.any(String));
    });

    it('requires mandatory remarks and category when rejecting a check', async () => {
      const user = userEvent.setup();
      const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck');

      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Navigate to Step 3: KYC Verification
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      const rejectBtn = (await screen.findAllByRole('button', { name: /Reject Check/i }))[0];
      await user.click(rejectBtn);

      expect(await screen.findByText(/Reject Identity Proof/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      expect(confirmBtn).toBeDisabled();

      // Enter remarks and check confirmation
      const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational remarks/i);
      await user.type(remarksInput, 'Aadhaar copy is truncated and unreadable.');

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(confirmBtn).toBeEnabled();
      await user.click(confirmBtn);

      expect(rejectSpy).toHaveBeenCalledWith(
        'chk-identity-101',
        'IDENTITY',
        'BLURRY_IMAGE',
        'Aadhaar copy is truncated and unreadable.'
      );
    });

    it('allows requesting re-verification with mandatory worker instructions', async () => {
      const user = userEvent.setup();
      const recheckSpy = vi.spyOn(verificationRepository, 'requestReVerification');

      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Navigate to Step 3: KYC Verification
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      const recheckBtn = (await screen.findAllByRole('button', { name: /Request Re-Verification/i }))[0];
      await user.click(recheckBtn);

      expect(await screen.findByText(/Request Document Re-Verification/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Issue Re-Verification Request/i });
      expect(confirmBtn).toBeDisabled();

      const remarksInput = screen.getByPlaceholderText(/Enter mandatory instructions for the worker/i);
      await user.type(remarksInput, 'Please upload fresh address proof with matching name.');

      expect(confirmBtn).toBeEnabled();
      await user.click(confirmBtn);

      expect(recheckSpy).toHaveBeenCalledWith(
        'chk-identity-101',
        ['IDENTITY'],
        'Please upload fresh address proof with matching name.'
      );
    });
  });

  describe('3. Role Boundaries & Unauthorized Access Protections', () => {
    it('restricts Operations Admin from approving or rejecting checks', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-OPS-01',
          name: 'Operations Manager',
          email: 'ops.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.WORKERS_MANAGE,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          ],
        },
        isAuthenticated: true,
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      // Can view queue and inspect dossier
      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Navigate to Step 3
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      // Approve and Reject buttons are NOT rendered
      expect(screen.queryByRole('button', { name: /Approve Check/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject Check/i })).not.toBeInTheDocument();

      // Read-only advisory is displayed
      expect(
        screen.getByText(/Verification decisions reserved for Verification Executives/i)
      ).toBeInTheDocument();
    });

    it('blocks Support Executive from accessing verification queue', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-SUPP-01',
          name: 'Support Executive',
          email: 'support.exec@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<VerificationQueuePage />);

      expect(
        await screen.findByRole('heading', { name: /Access Restricted/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/verification\.review/i)).toBeInTheDocument();
    });

    it('hides KYC document attachments when user lacks documents.view_restricted permission', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-AUDITOR',
          name: 'Audit Viewer',
          email: 'auditor@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            // Notice: DOCUMENTS_VIEW_RESTRICTED is absent
          ],
        },
        isAuthenticated: true,
      });

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(
        await screen.findByText(/Restricted Personal Document \(KYC\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/documents\.view_restricted/i)
      ).toBeInTheDocument();
    });
  });

  describe('4. Document Link Handling & Error Resilience', () => {
    it('handles document link fetch failures gracefully with retry action', async () => {
      vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockRejectedValueOnce(
        new Error('Storage Vault 403: Signed token expired')
      );

      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Move to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(
        await screen.findByText(/Failed to load document attachment/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Storage Vault 403: Signed token expired/i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Fetching Document/i });
      expect(retryBtn).toBeInTheDocument();
    });
  });

  describe('5. Real Repository Mode Integrity', () => {
    it('RealVerificationRepository targets configured API contracts and never returns dummy fallback arrays', async () => {
      const realRepo = new RealVerificationRepository();
      expect(realRepo).toBeDefined();

      // Verify that RealVerificationRepository methods throw domain errors when HTTP client fails rather than returning mock records
      await expect(realRepo.getVerificationQueue()).rejects.toBeDefined();
      await expect(realRepo.getDossierById('non-existent')).rejects.toBeDefined();
    });
  });

  describe('6. Complete Worker Profile & Application Lifecycle', () => {
    it('opens WorkerDetailModal across simplified 2-step workflow: Worker Information and KYC Verification', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Step 1: Worker Information is default
      expect(await screen.findByRole('heading', { name: /Sunita Devi/i })).toBeInTheDocument();
      expect(screen.getByText('1. Worker Information')).toBeInTheDocument();
      expect(screen.getByText('2. KYC Verification')).toBeInTheDocument();
      expect(screen.getByText('Primary Skill & Experience')).toBeInTheDocument();
      expect(screen.getByText('Address & Locality')).toBeInTheDocument();
      expect(screen.getByText(/\+91 98765 \*\*\*\*\*/i)).toBeInTheDocument();
      expect(screen.getByText(/Deep Cleaning/i)).toBeInTheDocument();

      // Navigate to Step 2: KYC Verification
      const nextBtn = screen.getByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Aadhaar Card/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Back to Worker Information/i })).toBeInTheDocument();
    });

    it('automatically opens worker detail modal when workerId is provided in URL query params', async () => {
      renderWithProviders(<WorkersListPage />, '/workers?workerId=W-10482');

      expect(await screen.findByText('1. Worker Information')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next: Verify KYC/i })).toBeInTheDocument();
    });
  });

  describe('7. Operational Service Categories & Management', () => {
    it('allows Operations Admin to open Category Management dialog and update service categories', async () => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-OPS-01',
          name: 'Operations Manager',
          email: 'ops.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.WORKERS_MANAGE,
            PERMISSIONS.WORKERS_MANAGE_STATUS,
            PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
          ],
        },
        isAuthenticated: true,
      });

      const updateCategoriesSpy = vi.spyOn(workerRepository, 'updateWorkerCategories');
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Find and click "Manage Categories" in modal footer
      const manageCatBtn = await screen.findByRole('button', { name: /Manage Categories/i });
      await user.click(manageCatBtn);

      // Verify category management dialog opens
      expect(await screen.findByText(/Configure Service Categories/i)).toBeInTheDocument();

      // Select COOK category checkbox
      const cookCheckbox = screen.getByLabelText(/Cook/i);
      await user.click(cookCheckbox);

      // Click "Save Category Configuration"
      const saveBtn = screen.getByRole('button', { name: /Save Category Configuration/i });
      await user.click(saveBtn);

      expect(updateCategoriesSpy).toHaveBeenCalledWith('W-10482', expect.arrayContaining(['Cook']));
    });
  });

  describe('8. Guided Verification Workstation Lifecycle & Cross-Role Handoff', () => {
    it('navigates through the 2-step simplified workflow (Worker Info -> KYC Verification) and back', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Step 1: Worker Information is displayed by default
      expect(await screen.findByRole('heading', { name: 'Worker Information' })).toBeInTheDocument();
      expect(screen.getByText(/Contact Number/i)).toBeInTheDocument();
      expect(screen.getByText(/Address & Locality/i)).toBeInTheDocument();
      expect(screen.getByText(/Primary Skill & Experience/i)).toBeInTheDocument();

      // Test PII Reveal toggle on Step 1
      const revealBtn = screen.getByRole('button', { name: /Reveal contact number/i });
      await user.click(revealBtn);
      expect(screen.getByText(/Authorized contact reveal active/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Hide contact number/i })).toBeInTheDocument();

      // Proceed to Step 2: KYC Verification
      const nextBtn = screen.getByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);
      expect(await screen.findByText(/KYC Verification & Compliance/i)).toBeInTheDocument();
      expect(screen.getByText(/Submitted KYC Documents/i)).toBeInTheDocument();
      expect(screen.getByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor Verification Sign-Off/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Commercial Platform Activation' })).toBeInTheDocument();

      // Return to Step 1: Worker Information
      const backBtn = screen.getByRole('button', { name: /Back to Worker Information/i });
      await user.click(backBtn);
      expect(await screen.findByRole('heading', { name: 'Worker Information' })).toBeInTheDocument();
    });

    it('displays authoritative overall verification level in Step 2 and does not expose unsupported decision controls', async () => {
      await verificationRepository.approveCheck('chk-identity-101', 'IDENTITY');
      await verificationRepository.approveCheck('chk-address-101', 'ADDRESS');
      await verificationRepository.approveCheck('chk-emergency-101', 'EMERGENCY_CONTACT');
      await verificationRepository.approveCheck('chk-reference-101', 'REFERENCE');
      await verificationRepository.approveCheck('chk-police-101', 'POLICE_CLEARANCE');

      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Navigate to Step 2 via Next: Verify KYC
      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/Supervisor Verification Sign-Off/i)).toBeInTheDocument();

      // Ensure no unsupported final decision mutation buttons are exposed
      expect(screen.queryByRole('button', { name: /Submit Final Verification Approval/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm Final Rejection/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Issue Corrections Request/i })).not.toBeInTheDocument();
    });

    it('displays error state when verification dossier fails to load and does not fabricate approval', async () => {
      vi.spyOn(verificationRepository, 'getDossierById').mockRejectedValueOnce(
        new Error('Network error loading dossier')
      );

      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      // When dossier fails to load, error banner is shown with retry
      expect(await screen.findByText(/Failed to fetch verification dossier/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Retry$/i })).toBeInTheDocument();
    });

    it('renders platform status card in Step 2 without exposing unconfirmed activation controls or calling updateWorkerStatus', async () => {
      const updateStatusSpy = vi.spyOn(workerRepository, 'updateWorkerStatus');
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(
        await screen.findByRole('heading', { name: 'Commercial Platform Activation' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Activation is locked/i)
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate Worker Account/i })).not.toBeInTheDocument();
      expect(updateStatusSpy).not.toHaveBeenCalled();
    });

    it('Step 2 displays submitted documents harvested from both worker record and checks, supports viewing/previewing, zoom, rotate, and secure links', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Navigate to Step 2 via button
      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/Submitted KYC Documents/i)).toBeInTheDocument();
      expect(screen.getByText(/Encrypted Cloud Storage/i)).toBeInTheDocument();

      // Verify documents table contains headers
      expect(screen.getByText('Document Type')).toBeInTheDocument();
      expect(screen.getByText('Reference / Number')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();

      // W-10482 has Aadhaar card in documents
      expect((await screen.findAllByText(/Aadhaar Card/i)).length).toBeGreaterThan(0);

      // Inspect Document button
      const inspectButtons = screen.getAllByRole('button', { name: /^Inspect Document$/i });
      expect(inspectButtons.length).toBeGreaterThan(0);
      await user.click(inspectButtons[0]);

      // Preview panel appears
      expect(await screen.findByText(/Authorized Document Vault Preview/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Zoom In/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rotate 90°/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open Secure Document Link/i })).toBeInTheDocument();

      // Close preview
      const closePreviewBtn = screen.getByRole('button', { name: /Close Preview/i });
      await user.click(closePreviewBtn);
      expect(screen.queryByText(/Authorized Document Vault Preview/i)).not.toBeInTheDocument();
    });

    it('Step 2 displays honest empty state when applicant has not uploaded any documents', async () => {
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-NO-DOCS',
        name: 'Applicant Without Documents',
        category: 'Cook',
        categories: ['Cook'],
        experienceYears: 1,
        ratingAverage: 0,
        totalReviews: 0,
        locality: 'Kondapur',
        serviceRadiusKm: 5,
        languages: ['Hindi'],
        bio: '',
        isFullyVerified: false,
        status: 'SUSPENDED',
        onboardingStatus: 'IN_REVIEW',
        phoneMasked: '+91 99999 *****',
        documents: [],
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'PENDING',
          addressProofStatus: 'PENDING',
          criminalRecordStatus: 'PENDING',
          skillProofStatus: 'NOT_APPLICABLE',
          referenceCheckStatus: 'PENDING',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 0,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'W-NO-DOCS',
        applicationId: 'APP-NO-DOCS',
        workerId: 'W-NO-DOCS',
        workerName: 'Applicant Without Documents',
        category: 'Cook',
        locality: 'Kondapur',
        experienceYears: 1,
        phoneMasked: '+91 99999 *****',
        submissionTime: new Date().toISOString(),
        status: 'PENDING_REVIEW',
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: { type: 'IDENTITY', title: 'Identity Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          ADDRESS: { type: 'ADDRESS', title: 'Address Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          EMERGENCY_CONTACT: { type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          REFERENCE: { type: 'REFERENCE', title: 'Reference', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          POLICE_CLEARANCE: { type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
        },
      });

      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-NO-DOCS"
          onClose={() => {}}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByTestId('no-documents-submitted')).toBeInTheDocument();
      expect(screen.getByText(/No verification documents submitted yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending worker upload via the Worker Mobile App\./i)).toBeInTheDocument();
    });

    it('allows approving an active check in Step 2, opening ConfirmDialog, and persisting decision through verificationRepository.approveCheck', async () => {
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck').mockResolvedValueOnce();
      const user = userEvent.setup();

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-PENDING',
        name: 'Pending Worker',
        category: 'House Maid',
        categories: ['House Maid'],
        experienceYears: 2,
        ratingAverage: 0,
        totalReviews: 0,
        locality: 'Kondapur',
        serviceRadiusKm: 5,
        languages: ['Hindi'],
        bio: '',
        isFullyVerified: false,
        status: 'SUSPENDED',
        onboardingStatus: 'IN_REVIEW',
        phoneMasked: '+91 99999 *****',
        documents: [],
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'PENDING',
          addressProofStatus: 'PENDING',
          criminalRecordStatus: 'PENDING',
          skillProofStatus: 'NOT_APPLICABLE',
          referenceCheckStatus: 'PENDING',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 0,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'W-PENDING',
        applicationId: 'APP-PENDING',
        workerId: 'W-PENDING',
        workerName: 'Pending Worker',
        category: 'House Maid',
        locality: 'Kondapur',
        experienceYears: 2,
        phoneMasked: '+91 99999 *****',
        submissionTime: new Date().toISOString(),
        status: 'PENDING_REVIEW',
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: { id: 'chk-id-test', type: 'IDENTITY', title: 'Identity Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          ADDRESS: { id: 'chk-addr-test', type: 'ADDRESS', title: 'Address Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          EMERGENCY_CONTACT: { id: 'chk-em-test', type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          REFERENCE: { id: 'chk-ref-test', type: 'REFERENCE', title: 'Reference', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          POLICE_CLEARANCE: { id: 'chk-pol-test', type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
        },
      });

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-PENDING"
          onClose={() => {}}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();

      // Find the Approve Check button for the active Identity check
      const approveButtons = await screen.findAllByRole('button', { name: /^Approve Check$/i });
      // The first check (Identity) is not locked
      await user.click(approveButtons[0]);

      // ConfirmDialog opens
      expect(await screen.findByRole('button', { name: /Confirm Approval/i })).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      expect(approveSpy).toHaveBeenCalledWith(
        'chk-id-test',
        'IDENTITY',
        expect.any(String)
      );
    });

    it('confirms later checks remain visible and their actions are not disabled solely because earlier checks are pending', async () => {
      const user = userEvent.setup();

      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-PENDING',
        name: 'Pending Worker',
        category: 'House Maid',
        categories: ['House Maid'],
        experienceYears: 2,
        ratingAverage: 0,
        totalReviews: 0,
        locality: 'Kondapur',
        serviceRadiusKm: 5,
        languages: ['Hindi'],
        bio: '',
        isFullyVerified: false,
        status: 'SUSPENDED',
        onboardingStatus: 'IN_REVIEW',
        phoneMasked: '+91 99999 *****',
        documents: [],
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'PENDING',
          addressProofStatus: 'PENDING',
          criminalRecordStatus: 'PENDING',
          skillProofStatus: 'NOT_APPLICABLE',
          referenceCheckStatus: 'PENDING',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 0,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
      });

      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'W-PENDING',
        applicationId: 'APP-PENDING',
        workerId: 'W-PENDING',
        workerName: 'Pending Worker',
        category: 'House Maid',
        locality: 'Kondapur',
        experienceYears: 2,
        phoneMasked: '+91 99999 *****',
        submissionTime: new Date().toISOString(),
        status: 'PENDING_REVIEW',
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: { id: 'chk-id-test', type: 'IDENTITY', title: 'Identity Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          ADDRESS: { id: 'chk-addr-test', type: 'ADDRESS', title: 'Address Proof', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
          EMERGENCY_CONTACT: { id: 'chk-em-test', type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          REFERENCE: { id: 'chk-ref-test', type: 'REFERENCE', title: 'Reference', status: 'PENDING', evaluationMethod: 'TELEPHONIC_VETTING' },
          POLICE_CLEARANCE: { id: 'chk-pol-test', type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'PENDING', evaluationMethod: 'DOCUMENT_INSPECTION' },
        },
      });

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-PENDING"
          onClose={() => {}}
        />
      );

      const nextBtn = await screen.findByRole('button', { name: /Next: Verify KYC/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();

      // Later checks are visible without sequential lock messages or locked badges
      expect(screen.queryByText(/is locked until preceding check\(s\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Locked$/i)).not.toBeInTheDocument();

      // Reviewers can inspect and attempt actions on any check in any order
      const approveButtons = screen.getAllByRole('button', { name: /^Approve Check$/i });
      expect(approveButtons.length).toBe(5);
      approveButtons.forEach((btn) => {
        expect(btn).toBeEnabled();
      });
    });
  });
});
