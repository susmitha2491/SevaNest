import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Worker Application & Verification Complete Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

      // Review KYC CTA link exists for unverified workers
      const reviewKycButtons = screen.getAllByRole('button', { name: /Review KYC/i });
      expect(reviewKycButtons.length).toBeGreaterThan(0);
    });

    it('enforces matching ineligibility in WorkerDetailModal with explanatory callout and verification link', async () => {
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      // Check matching ineligibility callout banner
      expect(
        await screen.findByText(/Matching Eligibility: NOT ELIGIBLE/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/until every required verification check is approved/i)
      ).toBeInTheDocument();

      // Check review queue CTA button
      expect(
        screen.getByRole('button', { name: /Review in Verification Queue/i })
      ).toBeInTheDocument();
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

      const approveBtn = await screen.findByRole('button', { name: /Approve Check/i });
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

      const rejectBtn = await screen.findByRole('button', { name: /Reject Check/i });
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

      const recheckBtn = await screen.findByRole('button', { name: /Request Re-Verification/i });
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
    it('opens WorkerDetailModal across structured tabs: Verification, Personal, Professional, Documents Vault, and Operations', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Default is Verification tab
      expect(await screen.findByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();

      // Switch to Personal & Contact tab
      const personalTab = screen.getByRole('button', { name: /Personal & Contact/i });
      await user.click(personalTab);
      expect(await screen.findByText(/Contact Information/i)).toBeInTheDocument();
      expect(screen.getByText(/\+91 98765 \*\*\*\*\*/i)).toBeInTheDocument();

      // Switch to Professional Profile tab
      const profTab = screen.getByRole('button', { name: /Professional Profile/i });
      await user.click(profTab);
      expect(await screen.findByText(/Deep Cleaning/i)).toBeInTheDocument();

      // Switch to Documents Vault tab
      const docsTab = screen.getByRole('button', { name: /Documents Vault/i });
      await user.click(docsTab);
      expect(await screen.findByText(/Aadhaar Card/i)).toBeInTheDocument();

      // Switch to Operational Engagements tab
      const opsTab = screen.getByRole('button', { name: /Operational Engagements/i });
      await user.click(opsTab);
      expect(await screen.findByText(/Active Engagements/i)).toBeInTheDocument();
    });

    it('automatically opens worker detail modal when workerId is provided in URL query params', async () => {
      renderWithProviders(<WorkersListPage />, '/workers?workerId=W-10482');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(await screen.findByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();
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

      // Navigate to Professional tab
      const profTab = await screen.findByRole('button', { name: /Professional Profile/i });
      await user.click(profTab);

      // Find and click "Manage Categories"
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
    it('navigates through all 5 guided workstation steps with progress stepper controls', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10482"
          onClose={() => {}}
        />
      );

      // Step 1: Application Overview is displayed by default
      expect(await screen.findByText(/Step 1: Application Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/1. Application Status/i)).toBeInTheDocument();
      expect(screen.getByText(/2. Operational Status/i)).toBeInTheDocument();
      expect(screen.getByText(/3. Verification Status/i)).toBeInTheDocument();
      expect(screen.getByText(/4. Matching Eligibility/i)).toBeInTheDocument();

      // Test PII Reveal toggle on Step 1
      const revealBtn = screen.getByRole('button', { name: /Reveal Contact Number/i });
      await user.click(revealBtn);
      expect(screen.getByText(/Contact revealed for telephonic vetting call/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mask Phone/i })).toBeInTheDocument();

      // Proceed to Step 2: Documents & Evidence
      const step2Btn = screen.getByRole('button', { name: /Proceed to Step 2: Documents & Evidence/i });
      await user.click(step2Btn);
      expect(await screen.findByText(/Step 2: Documents & KYC Evidence Vault/i)).toBeInTheDocument();

      // Proceed to Step 3: Verification Checklist
      const step3Btn = screen.getByRole('button', { name: /Proceed to Step 3: Verification Checklist/i });
      await user.click(step3Btn);
      expect(await screen.findByText(/Step 3: Verification Checklist & Operational Evaluation/i)).toBeInTheDocument();
      expect(screen.getByText(/6-Point Trust & Verification Status/i)).toBeInTheDocument();

      // Proceed to Step 4: Verification Summary
      const step4Btn = screen.getByRole('button', { name: /Proceed to Step 4: Verification Summary/i });
      await user.click(step4Btn);
      expect(await screen.findByText(/Step 4: Authoritative Verification Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Individual Verification Checks Breakdown/i)).toBeInTheDocument();

      // Proceed to Step 5: Platform Status
      const step5Btn = screen.getByRole('button', { name: /Proceed to Step 5: Platform Status/i });
      await user.click(step5Btn);
      expect(await screen.findByText(/Step 5: Platform & Roster Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Activation Flow Notice \(Unconfirmed Backend Contract\)/i)).toBeInTheDocument();
    });

    it('displays authoritative overall verification level in Step 4 and does not expose unsupported decision controls', async () => {
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

      // Navigate to Step 4 directly via stepper pill
      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      expect(await screen.findByText(/Step 4: Authoritative Verification Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Authoritative Overall Status/i)).toBeInTheDocument();
      expect(screen.getByText(/There is no worker-level final-decision endpoint/i)).toBeInTheDocument();

      // Ensure no unsupported final decision mutation buttons are exposed
      expect(screen.queryByRole('button', { name: /Submit Final Verification Approval/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm Final Rejection/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Issue Corrections Request/i })).not.toBeInTheDocument();
    });

    it('displays unavailable state when authoritative verification level cannot be loaded and does not fabricate approval', async () => {
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValueOnce({
        id: 'W-TEST-ERR',
        applicationId: 'W-TEST-ERR',
        workerId: 'W-TEST-ERR',
        workerName: 'Test Worker',
        category: 'Cook',
        locality: 'Banjara Hills',
        experienceYears: 3,
        phoneMasked: '+91 99999 *****',
        submissionTime: new Date().toISOString(),
        status: 'PENDING_REVIEW',
        level: undefined,
        preCheckOtpVerified: true,
        checks: {
          IDENTITY: { type: 'IDENTITY', title: 'Identity Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' },
          ADDRESS: { type: 'ADDRESS', title: 'Address Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' },
          EMERGENCY_CONTACT: { type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' },
          REFERENCE: { type: 'REFERENCE', title: 'Reference', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' },
          POLICE_CLEARANCE: { type: 'POLICE_CLEARANCE', title: 'Police Certificate', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' },
        },
      });

      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      const step4Pill = await screen.findByRole('button', { name: /Verification Summary/i });
      await user.click(step4Pill);

      // Even if individual checks are approved, missing authoritative level must render unavailable error
      expect(await screen.findByText(/Authoritative Verification Level Unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/does not infer approval or compute final verification decisions/i)).toBeInTheDocument();
    });

    it('renders read-only platform status in Step 5 without exposing unconfirmed activation controls or calling updateWorkerStatus', async () => {
      const updateStatusSpy = vi.spyOn(workerRepository, 'updateWorkerStatus');
      const user = userEvent.setup();

      renderWithProviders(
        <WorkerDetailModal
          workerId="W-10483"
          onClose={() => {}}
        />
      );

      const step5Pill = await screen.findByRole('button', { name: /Platform Status/i });
      await user.click(step5Pill);

      expect(
        await screen.findByText(/Activation Flow Notice \(Unconfirmed Backend Contract\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Worker activation and deactivation endpoints are not confirmed by the backend contract/i)
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate Worker Account/i })).not.toBeInTheDocument();
      expect(updateStatusSpy).not.toHaveBeenCalled();
    });
  });
});
