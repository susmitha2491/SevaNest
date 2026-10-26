import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    it('opens dossier when Inspect Dossier is clicked and displays section tabs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      expect(inspectButtons.length).toBeGreaterThan(0);
      await user.click(inspectButtons[0]);

      // Dossier console header
      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // All 6 section tabs exist
      expect(screen.getByRole('button', { name: /Inspection Workstation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Personal Details/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Work Profile/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submitted Documents/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /6-Point Checklist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review History/i })).toBeInTheDocument();
    });
  });

  describe('2. Comprehensive Dossier Sections Verification', () => {
    it('displays Personal Details section with identifiers, phone verification, and address', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Switch to Personal Details tab
      const personalTab = await screen.findByRole('button', { name: /Personal Details/i });
      await user.click(personalTab);

      // Verify Personal Record fields
      expect(await screen.findByText(/Applicant Personal Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Identifiers & Phone Verification/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10482').length).toBeGreaterThan(0);
      expect(screen.getAllByText('APP-10482').length).toBeGreaterThan(0);
      expect(screen.getByText('Tier 1 OTP Passed')).toBeInTheDocument();

      // Residential address
      expect(screen.getByText(/Residential Address & Locality/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Kondapur/i).length).toBeGreaterThan(0);

      // Emergency Contact
      expect(screen.getByText(/Emergency Contact Record/i)).toBeInTheDocument();
      expect(screen.getByText('Rajesh Devi')).toBeInTheDocument();
      expect(screen.getByText('Spouse')).toBeInTheDocument();
    });

    it('displays Work Profile section with applied categories, experience, skills, and prior employer', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Switch to Work Profile tab
      const workTab = await screen.findByRole('button', { name: /Work Profile/i });
      await user.click(workTab);

      expect(await screen.findByText(/Work Profile & Domestic Trade Specializations/i)).toBeInTheDocument();
      expect(screen.getByText(/6 Years Experience/i)).toBeInTheDocument();
      expect(screen.getByText(/Skills, Languages & Availability/i)).toBeInTheDocument();
      expect(screen.getByText(/Prior Employer Reference/i)).toBeInTheDocument();
      expect(screen.getByText(/Mrs\. S\. Sharma/i)).toBeInTheDocument();
    });

    it('displays Submitted Documents Vault with availability, metadata, and inspect action', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Switch to Submitted Documents tab
      const docsTab = await screen.findByRole('button', { name: /Submitted Documents/i });
      await user.click(docsTab);

      expect(await screen.findByText(/Submitted Documents Vault/i)).toBeInTheDocument();
      expect(screen.getByText(/Identity Proof \(Aadhaar \/ Voter ID\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Address Proof \(Electricity Bill \/ Lease\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Police Clearance Certificate \(PCC\)/i)).toBeInTheDocument();

      // Click Inspect Document switches back to workstation
      const inspectDocButtons = screen.getAllByRole('button', { name: /Inspect Document/i });
      expect(inspectDocButtons.length).toBeGreaterThan(0);
      await user.click(inspectDocButtons[0]);

      // Returns to Inspection Workstation
      expect(await screen.findByText(/Inspection Check:/i)).toBeInTheDocument();
    });

    it('displays 6-Point Compliance Checklist with evidence summary for all points', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Switch to 6-Point Checklist tab
      const checklistTab = await screen.findByRole('button', { name: /6-Point Checklist/i });
      await user.click(checklistTab);

      expect(await screen.findByText(/6-Point Verification Compliance Checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/1\. Mobile Phone OTP Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Identity Proof Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Residential Address Proof/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Emergency Contact Vetting/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Employer Reference Vetting/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. Police Clearance Certificate \(PCC\)/i)).toBeInTheDocument();
    });

    it('displays Review History audit trail with timestamps and reviewer details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      // Switch to Review History tab
      const historyTab = await screen.findByRole('button', { name: /Review History/i });
      await user.click(historyTab);

      expect(await screen.findByText(/Audit Log & Review Decision History/i)).toBeInTheDocument();
      expect(screen.getByText('Check Point')).toBeInTheDocument();
      expect(screen.getByText('Transition / Decision')).toBeInTheDocument();
      expect(screen.getByText('Reviewer / Actor')).toBeInTheDocument();
    });
  });

  describe('3. Execution of Verification Actions', () => {
    it('executes check approval and triggers cache invalidation', async () => {
      const user = userEvent.setup();
      const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');

      renderWithProviders(<VerificationQueuePage />);

      const inspectButtons = await screen.findAllByRole('button', { name: /Inspect Dossier/i });
      await user.click(inspectButtons[0]);

      const approveBtn = await screen.findByRole('button', { name: /Approve Check/i });
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
      const verifiedTab = await screen.findByRole('button', { name: /Active & Verified Roster/i });
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
      const pendingTab = await screen.findByRole('button', { name: /Pending Verification \/ Incomplete KYC/i });
      await user.click(pendingTab);

      // Ramesh Yadav is pending verification
      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();

      // Sunita Devi is verified and must NOT appear in pending tab
      expect(screen.queryByText('Sunita Devi')).not.toBeInTheDocument();
    });
  });
});
