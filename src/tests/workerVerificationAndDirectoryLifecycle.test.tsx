/* global CustomEvent */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkerVerificationReviewModal } from '../features/verification/presentation/WorkerVerificationReviewModal';
import { WorkersDirectoryPage } from '../features/workers/presentation/WorkersDirectoryPage';
import { AppShell } from '../layouts/AppShell';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { VerificationDossier, VerificationCheck } from '../features/verification/domain/types';
import { Worker, WorkerPageResult } from '../features/workers/domain/types';

const mockFullyApprovedDossier: VerificationDossier = {
  id: '01a166eb-8f68-7543-b394-a86124c4e66a',
  workerId: '01a166eb-8f68-7543-b394-a86124c4e66a',
  workerName: 'vaishhhh',
  applicationId: 'APP-99881',
  locality: 'Banjara Hills',
  category: 'Cooking',
  experienceYears: 5,
  phoneMasked: '+91 98765 *****',
  submissionTime: '2026-10-15T10:00:00Z',
  status: 'PENDING_REVIEW',
  level: 'LEVEL_3',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: { id: 'chk-1', type: 'IDENTITY', title: 'Identity Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' } as VerificationCheck,
    ADDRESS: { id: 'chk-2', type: 'ADDRESS', title: 'Address Proof', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' } as VerificationCheck,
    EMERGENCY_CONTACT: { id: 'chk-3', type: 'EMERGENCY_CONTACT', title: 'Emergency Contact', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' } as VerificationCheck,
    REFERENCE: { id: 'chk-4', type: 'REFERENCE', title: 'Reference Check', status: 'APPROVED', evaluationMethod: 'TELEPHONIC_VETTING' } as VerificationCheck,
    POLICE_CLEARANCE: { id: 'chk-5', type: 'POLICE_CLEARANCE', title: 'Police Clearance', status: 'APPROVED', evaluationMethod: 'DOCUMENT_INSPECTION' } as VerificationCheck,
  },
  submittedDocuments: [],
};

const mockVerifiedWorker: Worker = {
  id: '01a166eb-8f68-7543-b394-a86124c4e66a',
  name: 'vaishhhh',
  category: 'Cooking',
  categories: ['Cooking'],
  experienceYears: 5,
  ratingAverage: 4.8,
  totalReviews: 12,
  locality: 'Banjara Hills',
  isFullyVerified: true,
  status: 'ACTIVE',
  phoneMasked: '+91 98765 *****',
  onboardingStatus: 'VERIFIED',
  verificationStatus: 'VERIFIED',
  verificationLevel: 'VERIFIED',
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Verification, Final Approval & Workers Directory Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Final Verification Approval Workflow', () => {
    it('executes successful approval for Super Admin, closes confirmation dialog, and emits success toast with worker name', async () => {
      useAuthStore.setState({
        user: {
          id: 'admin-01',
          name: 'Super Admin User',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_SIGNOFF,
            PERMISSIONS.WORKER_ACTIVATE,
          ],
        },
        isAuthenticated: true,
      });

      const user = userEvent.setup();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockFullyApprovedDossier);
      const approveSpy = vi.spyOn(verificationRepository, 'approveApplicationAndOnboardWorker').mockResolvedValue({
        success: true,
        workerId: mockFullyApprovedDossier.workerId,
        status: 'ACTIVE',
        message: 'Worker verification signed off and worker activated on platform roster.',
      });

      const toastListener = vi.fn();
      window.addEventListener('sevanest:toast', toastListener);

      renderWithClient(
        <WorkerVerificationReviewModal
          dossierId={mockFullyApprovedDossier.workerId}
          initialDossier={mockFullyApprovedDossier}
          onClose={() => {}}
        />
      );

      // Advance directly to Step 5 (Final Approval)
      const step5Bubble = await screen.findByTestId('step-bubble-5');
      await user.click(step5Bubble);

      expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

      // Approve Verification Worker button must be enabled for Super Admin
      const approveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
      expect(approveBtn).toBeEnabled();

      // Click to open confirmation dialog
      await user.click(approveBtn);

      const confirmHeading = await screen.findByText(/Confirm Worker Approval & Platform Onboarding/i);
      expect(confirmHeading).toBeInTheDocument();

      // Click Confirm Final Approval
      const confirmFinalBtn = screen.getByRole('button', { name: /Confirm Final Approval/i });
      await user.click(confirmFinalBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith(
          mockFullyApprovedDossier.workerId,
          expect.stringContaining('All 6 KYC verification checks approved')
        );
      });

      // Confirmation dialog closes after success
      await waitFor(() => {
        expect(screen.queryByText(/Confirm Worker Approval & Platform Onboarding/i)).not.toBeInTheDocument();
      });

      // Success toast event fired with correct worker name
      expect(toastListener).toHaveBeenCalled();
      const eventDetail = toastListener.mock.calls[0][0].detail;
      expect(eventDetail.message).toMatch(/vaishhhh has been successfully approved and (activated|onboarded)/i);

      // Success screen displayed
      expect(screen.getByText(/Worker Successfully Onboarded/i)).toBeInTheDocument();
      window.removeEventListener('sevanest:toast', toastListener);
    });

    it('handles HTTP 403 Forbidden failure: keeps confirmation dialog open, renders backend error, and emits NO success toast', async () => {
      useAuthStore.setState({
        user: {
          id: 'admin-01',
          name: 'Super Admin User',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_SIGNOFF,
            PERMISSIONS.WORKER_ACTIVATE,
          ],
        },
        isAuthenticated: true,
      });

      const user = userEvent.setup();
      const approveSpy = vi.spyOn(verificationRepository, 'approveApplicationAndOnboardWorker').mockRejectedValue(
        new Error('HTTP 403 Forbidden: You do not have permission to perform this action')
      );

      const toastListener = vi.fn();
      window.addEventListener('sevanest:toast', toastListener);

      renderWithClient(
        <WorkerVerificationReviewModal
          dossierId={mockFullyApprovedDossier.workerId}
          initialDossier={mockFullyApprovedDossier}
          onClose={() => {}}
        />
      );

      const step5Bubble = await screen.findByTestId('step-bubble-5');
      await user.click(step5Bubble);

      expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

      const approveBtn = await screen.findByRole('button', { name: /Approve Verification Worker/i });
      await user.click(approveBtn);

      const confirmHeading = await screen.findByText(/Confirm Worker Approval & Platform Onboarding/i);
      expect(confirmHeading).toBeInTheDocument();

      const confirmFinalBtn = screen.getByRole('button', { name: /Confirm Final Approval/i });
      await user.click(confirmFinalBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalled();
      });

      // Dialog MUST remain open on failure
      expect(await screen.findByText(/Confirm Worker Approval & Platform Onboarding/i)).toBeInTheDocument();

      const alertEl = await screen.findByRole('alert', {}, { timeout: 3000 });
      expect(alertEl).toHaveTextContent(/HTTP 403 Forbidden/i);

      // Success toast must NOT be fired
      expect(toastListener).not.toHaveBeenCalled();

      // Success screen must NOT be shown
      expect(screen.queryByText(/Worker Successfully Onboarded/i)).not.toBeInTheDocument();
      window.removeEventListener('sevanest:toast', toastListener);
    });
  });

  describe('2. Role-Based Permissions for Verification Executive', () => {
    it('restricts final approval when Verification Executive lacks verification.signoff on backend', async () => {
      // Backend grants only: worker.view, verification.review, verification.document.view, verification.decide
      useAuthStore.setState({
        user: {
          id: 'exec-01',
          name: 'Verification Executive',
          email: 'verification.executive@sevanest.example.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
          ],
        },
        isAuthenticated: true,
      });

      const user = userEvent.setup();
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockFullyApprovedDossier);

      renderWithClient(
        <WorkerVerificationReviewModal
          dossierId={mockFullyApprovedDossier.workerId}
          initialDossier={mockFullyApprovedDossier}
          onClose={() => {}}
        />
      );

      const step5Bubble = await screen.findByTestId('step-bubble-5');
      await user.click(step5Bubble);

      expect(await screen.findByText(/Step 5 — Final Approval/i)).toBeInTheDocument();

      // Approve button must be disabled due to lack of verification.signoff
      const approveBtn = screen.getByRole('button', { name: /Approve Verification Worker/i });
      expect(approveBtn).toBeDisabled();

      // Explanatory permission notice displayed
      expect(screen.getByText(/Permission Restricted: You do not have the required permission/i)).toBeInTheDocument();
    });
  });

  describe('3. Workers Directory in App Navigation', () => {
    it('renders Workers Directory navigation item for both Super Admin and Verification Executive', async () => {
      // Test Verification Executive sidebar
      useAuthStore.setState({
        user: {
          id: 'exec-01',
          name: 'Verification Executive',
          email: 'verification.executive@sevanest.example.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
          ],
        },
        isAuthenticated: true,
      });

      const queryClient = new QueryClient();
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole('link', { name: /^Workers Directory$/i })).toBeInTheDocument();
      unmount();

      // Test Super Admin sidebar
      useAuthStore.setState({
        user: {
          id: 'admin-01',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_SIGNOFF,
          ],
        },
        isAuthenticated: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole('link', { name: /^Workers Directory$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toBeInTheDocument();
    });

    it('WorkersDirectoryPage queries verified active workers and renders vaishhhh with Verified badge', async () => {
      const pageResult: WorkerPageResult = {
        items: [mockVerifiedWorker],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      };

      const getWorkersPageSpy = vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(pageResult);

      renderWithClient(<WorkersDirectoryPage />);

      expect(await screen.findByText('Workers Directory')).toBeInTheDocument();
      expect(getWorkersPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ verified: true, status: 'ACTIVE' }),
        1,
        25
      );

      // Verify worker vaishhhh is rendered
      expect(await screen.findByText('vaishhhh')).toBeInTheDocument();
      expect(screen.getAllByText('Cooking').length).toBeGreaterThan(0);
      expect(screen.getByText('Banjara Hills')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View Profile/i })).toBeInTheDocument();
    });

    it('WorkerDirectoryModal displays simple, professional worker details, their work, and their documents without heavy administrative controls', async () => {
      const user = userEvent.setup();
      const pageResult: WorkerPageResult = {
        items: [mockVerifiedWorker],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      };

      const mockWorkerDetail = {
        ...mockVerifiedWorker,
        serviceRadiusKm: 10,
        languages: ['Hindi', 'Telugu', 'English'],
        bio: 'Experienced home cook specializing in North and South Indian vegetarian cuisines.',
        skills: ['North Indian', 'South Indian', 'Baking', 'Meal Prep'],
        activeEngagementsCount: 1,
        completedBookingsCount: 45,
        replacementsIncurred: 0,
        recentEngagements: [
          {
            bookingId: 'BK-1001',
            customerName: 'Ananya S.',
            serviceCategory: 'Cooking',
            status: 'COMPLETED',
            period: 'Jan 2026 - Mar 2026',
          },
        ],
        internalNotes: [],
        expectedCompensation: '₹18,000 / month',
        availability: 'Full Time (8 AM - 4 PM)',
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'VERIFIED' as const,
          identityDocName: 'Aadhaar Card',
          addressProofStatus: 'VERIFIED' as const,
          criminalRecordStatus: 'VERIFIED' as const,
          skillProofStatus: 'VERIFIED' as const,
          skillDocName: 'Culinary Certificate',
          referenceCheckStatus: 'VERIFIED' as const,
        },
        documents: [
          {
            id: 'doc-1',
            documentId: 'doc-1',
            checkId: 'chk-1',
            checkType: 'IDENTITY',
            documentType: 'IDENTITY_PROOF',
            documentTypeName: 'Aadhaar Card',
            docNumberMasked: 'XXXX-XXXX-4921',
            status: 'VERIFIED' as const,
            signedUrl: 'https://example.com/aadhaar.jpg',
            contentType: 'image/jpeg',
            available: true,
            reviewable: true,
          },
        ],
      };

      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(pageResult);
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerDetail);
      vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue({
        ...mockFullyApprovedDossier,
        submittedDocuments: [
          {
            id: 'doc-1',
            checkType: 'IDENTITY',
            documentTypeName: 'Aadhaar Card',
            mimeType: 'image/jpeg',
            sizeBytes: 1024,
            status: 'APPROVED',
            createdAt: '2026-10-15T10:00:00Z',
          },
        ],
      });

      renderWithClient(<WorkersDirectoryPage />);

      // Open Worker Profile modal
      const viewProfileBtn = await screen.findByRole('button', { name: /View Profile/i });
      await user.click(viewProfileBtn);

      // 1. Verify Header & Tab 1 (Worker Details)
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Worker Details/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Their Work & Skills/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Verified Documents/i })).toBeInTheDocument();

      // Check worker details are rendered
      expect(screen.getByText(/Experienced home cook specializing in North and South Indian/i)).toBeInTheDocument();
      expect(screen.getByText('Hindi, Telugu, English')).toBeInTheDocument();

      // Ensure NO heavy admin mutation controls exist
      expect(screen.queryByText(/Suspend Worker/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Blacklist Worker/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sign Off & Activate Worker/i)).not.toBeInTheDocument();

      // 2. Switch to Tab 2: Their Work & Skills
      const workTab = screen.getByRole('tab', { name: /Their Work & Skills/i });
      await user.click(workTab);

      expect(screen.getByText(/North Indian/i)).toBeInTheDocument();
      expect(screen.getByText(/South Indian/i)).toBeInTheDocument();
      expect(screen.getByText(/Baking/i)).toBeInTheDocument();
      expect(screen.getByText('Full Time (8 AM - 4 PM)')).toBeInTheDocument();
      expect(screen.getByText('₹18,000 / month')).toBeInTheDocument();
      expect(screen.getByText('Ananya S.')).toBeInTheDocument();

      // 3. Switch to Tab 3: Verified Documents
      const docsTab = screen.getByRole('tab', { name: /Verified Documents/i });
      await user.click(docsTab);

      expect(screen.getByText('Aadhaar Card')).toBeInTheDocument();
      expect(screen.getByText(/XXXX-XXXX-4921/i)).toBeInTheDocument();

      // Click "View Document" to inspect
      const viewDocBtn = screen.getByRole('button', { name: /View Document/i });
      await user.click(viewDocBtn);

      // Verify document inspection viewer opened with zoom/rotate controls
      expect(screen.getByTitle(/Zoom In/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Zoom Out/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Rotate/i)).toBeInTheDocument();
      expect(screen.getByTestId('kyc-document-image')).toBeInTheDocument();

      // Close modal
      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      await user.click(closeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('Global toast is displayed in top-right corner when sevanest:toast event is received', async () => {
      useAuthStore.setState({
        user: {
          id: 'admin-01',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        isAuthenticated: true,
      });

      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Dispatch toast
      act(() => {
        window.dispatchEvent(
          new CustomEvent('sevanest:toast', {
            detail: {
              type: 'success',
              message: 'vaishhhh has been successfully approved and onboarded as a worker on SevaNest!',
            },
          })
        );
      });

      const toast = await screen.findByTestId('global-success-toast');
      expect(toast).toBeInTheDocument();
      expect(within(toast).getByText(/vaishhhh has been successfully approved and onboarded as a worker on SevaNest!/i)).toBeInTheDocument();
    });
  });
});
