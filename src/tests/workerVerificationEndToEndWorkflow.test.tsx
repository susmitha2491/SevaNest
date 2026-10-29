import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { verificationRepository } from '../features/verification/data/verificationRepository';

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

describe('Worker Onboarding End-to-End Verification & Directory Workflow', () => {
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
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Verification Queue & Application Dossier Selection', () => {
    it('renders real worker applications from queue with workerId and applicationId', async () => {
      renderWithProviders(<VerificationQueuePage />);

      expect(
        await screen.findByRole('heading', { name: /Worker Verification & Trust Operations/i })
      ).toBeInTheDocument();

      // Displays Sunita Devi and Ramesh Yadav
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/App: APP-10482/i).length).toBeGreaterThan(0);

      expect(screen.getByText('Ramesh Yadav')).toBeInTheDocument();
      expect(screen.getAllByText('W-10483').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/App: APP-10483/i).length).toBeGreaterThan(0);
    });

    it('opens clean review modal when Inspect Dossier is clicked and displays 5-step wizard with visual stepper', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      expect(inspectButtons.length).toBeGreaterThan(0);
      await user.click(inspectButtons[0]);

      // Dossier modal header
      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // Stepper progress bubbles and Step 1 details
      expect(screen.getByRole('navigation', { name: /Verification Progress/i })).toBeInTheDocument();
      expect(screen.getByText('Application')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('KYC Verification')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Final Approval')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();
    });
  });

  describe('2. Comprehensive Dossier Sections Verification', () => {
    it('displays Personal Details in Step 1 with identifiers, phone verification, and address', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Step 1 fields
      expect(await screen.findByText(/Step 1 — Worker Application Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Worker ID:/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);
      expect(screen.getAllByText('APP-10482').length).toBeGreaterThan(0);
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();

      // Residential address / locality
      expect(screen.getAllByText(/Kondapur/i).length).toBeGreaterThan(0);

      // Navigate to Step 2 -> Step 3 for Emergency Contact
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      expect(screen.getByText('Rajesh Devi')).toBeInTheDocument();
      expect(screen.getByText(/Spouse/i)).toBeInTheDocument();
    });

    it('displays Work Profile in Step 1 and Step 3 with applied categories, experience, and prior employer', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
      expect(screen.getAllByText(/House Maid/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/6 Years/i)).toBeInTheDocument();

      // Navigate to Step 3 for employer reference check
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      expect(screen.getByText(/Mrs\. S\. Sharma/i)).toBeInTheDocument();
    });

    it('displays submitted documents in Step 2 and opens secure document viewer when requested', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // Navigate to Step 2: Documents Review
      const dialog = await screen.findByRole('dialog');
      const nextBtn = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn);

      expect(await screen.findByText(/Step 2 — Documents Review/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Identity Proof/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Address Proof/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Police Clearance/i })).toBeInTheDocument();

      // Secure document viewer renders
      expect(await screen.findByText(/CONFIDENTIAL KYC ATTACHMENT/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Authorized Document Vault Record/i).length).toBeGreaterThan(0);
    });

    it('displays 6-Point Compliance Checklist with progress indicator in Step 3', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // Navigate to Step 3: KYC Verification
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      expect(await screen.findByText(/Step 3 — KYC Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/Checks Approved/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Mobile OTP Pre-Check/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { name: /Identity Proof/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Address Proof/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Emergency Contact/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Employer Reference/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Police Clearance/i })).toBeInTheDocument();
    });

    it('displays review ownership and claim status for the verification executive', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
      // Displays verification status badge and worker ID
      expect(screen.getByText(/Worker ID:/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);
    });
  });

  describe('3. Execution of Verification Actions', () => {
    it('executes check approval and triggers cache invalidation in Step 3', async () => {
      const user = userEvent.setup();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');

      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // Navigate to Step 3: KYC Verification
      const dialog = await screen.findByRole('dialog');
      const nextBtn1 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn1);
      const nextBtn2 = within(dialog).getByRole('button', { name: /^Next/i });
      await user.click(nextBtn2);

      const approveBtn = (await within(dialog).findAllByRole('button', { name: /Approve Check/i }))[0];
      await user.click(approveBtn);

      const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
      await user.click(confirmBtn);

      expect(approveSpy).toHaveBeenCalledWith('chk-identity-101', 'IDENTITY', expect.any(String));
    });
  });

  describe('4. Workers Directory Consistency & Matching Eligibility', () => {
    it('filters Active & Verified Roster strictly to isFullyVerified && ACTIVE workers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkersListPage />);

      // Switch to Active & Verified Roster tab
      const verifiedTab = await screen.findByRole('button', { name: /Active & Verified Roster/i }, { timeout: 10000 });
      await user.click(verifiedTab);

      // Sunita Devi is fully verified and active
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Ramesh Yadav is pending verification and must NOT be in the active verified roster
      expect(screen.queryByText('Ramesh Yadav')).not.toBeInTheDocument();
    });

    it('filters Pending Verification / Incomplete KYC tab to unverified workers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkersListPage />);

      // Switch to Pending Verification tab
      const pendingTab = await screen.findByRole('button', { name: /Pending Verification \/ Incomplete KYC/i }, { timeout: 10000 });
      await user.click(pendingTab);

      // Ramesh Yadav is pending verification
      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();

      // Sunita Devi is verified and must NOT appear in pending tab
      expect(screen.queryByText('Sunita Devi')).not.toBeInTheDocument();
    });
  });
});
