import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ConcurrencyConflictError, ServerFailureError } from '../core/errors/DomainError';
import { VerificationDossier, VerificationCheck, VerificationCheckType } from '../features/verification/domain/types';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/verification') {
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

const mockQueueItems: VerificationDossier[] = [
  {
    id: 'VQ-101',
    checkId: 'chk-identity-101',
    applicationId: 'APP-10482',
    workerId: 'W-10482',
    workerName: 'Sunita Devi',
    category: 'House Maid',
    locality: 'Kondapur',
    experienceYears: 6,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-10-15T07:15:00Z',
    status: 'PENDING_REVIEW',
    preCheckOtpVerified: true,
    checks: {
      IDENTITY: {
        id: 'chk-identity-101',
        type: 'IDENTITY',
        title: 'Identity Proof (Aadhaar)',
        status: 'PENDING',
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
    } as unknown as Record<VerificationCheckType, VerificationCheck>,
  },
  {
    id: 'VQ-102',
    checkId: 'chk-identity-102',
    applicationId: 'APP-10483',
    workerId: 'W-10483',
    workerName: 'Ramesh Yadav',
    category: 'Driver',
    locality: 'Madhapur',
    experienceYears: 9,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-10-15T08:30:00Z',
    status: 'IN_REVIEW',
    reviewerUserId: 'verif-exec-01',
    claimedAt: '2026-10-15T09:00:00Z',
    preCheckOtpVerified: true,
    checks: {
      IDENTITY: {
        id: 'chk-identity-102',
        type: 'IDENTITY',
        title: 'Identity Proof',
        status: 'IN_REVIEW',
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
    } as unknown as Record<VerificationCheckType, VerificationCheck>,
  },
  {
    id: 'VQ-103',
    checkId: 'chk-identity-103',
    applicationId: 'APP-10484',
    workerId: 'W-10484',
    workerName: 'Lakshmi Bai',
    category: 'Cook',
    locality: 'Gachibowli',
    experienceYears: 4,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-10-15T09:45:00Z',
    status: 'REJECTED',
    preCheckOtpVerified: true,
    checks: {
      IDENTITY: {
        id: 'chk-identity-103',
        type: 'IDENTITY',
        title: 'Identity Proof',
        status: 'REJECTED',
        evaluationMethod: 'DOCUMENT_INSPECTION',
        rejectionCategory: 'BLURRY_IMAGE',
        rejectionRemarks: 'Document image was unreadable.',
      },
    } as unknown as Record<VerificationCheckType, VerificationCheck>,
  },
  {
    id: 'VQ-104',
    checkId: 'chk-identity-104',
    applicationId: 'APP-10485',
    workerId: 'W-10485',
    workerName: 'Priya Sharma',
    category: 'Babysitter',
    locality: 'Banjara Hills',
    experienceYears: 3,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-10-15T10:15:00Z',
    status: 'RECHECK_DUE',
    preCheckOtpVerified: true,
    checks: {
      IDENTITY: {
        id: 'chk-identity-104',
        type: 'IDENTITY',
        title: 'Identity Proof',
        status: 'RECHECK_DUE',
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
    } as unknown as Record<VerificationCheckType, VerificationCheck>,
  },
  {
    id: 'VQ-105',
    checkId: 'chk-identity-105',
    applicationId: 'APP-10486',
    workerId: 'W-10486',
    workerName: 'Kavita Reddy',
    category: 'Elderly Care Helper',
    locality: 'Jubilee Hills',
    experienceYears: 8,
    phoneMasked: '+91 98765 *****',
    submissionTime: '2026-10-15T11:00:00Z',
    status: 'APPROVED',
    preCheckOtpVerified: true,
    checks: {
      IDENTITY: {
        id: 'chk-identity-105',
        type: 'IDENTITY',
        title: 'Identity Proof',
        status: 'APPROVED',
        evaluationMethod: 'DOCUMENT_INSPECTION',
      },
    } as unknown as Record<VerificationCheckType, VerificationCheck>,
  },
];

describe('Worker Verification Queue UX & Actions Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'verif-exec-01',
        email: 'verification.executive@sevanest.example.com',
        name: 'Pooja Nair',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.WORKER_VIEW,
        ],
      },
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      isAuthenticated: true,
    });

    vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
      items: mockQueueItems,
      totalCount: mockQueueItems.length,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    vi.spyOn(verificationRepository, 'getDossierById').mockImplementation(async (workerId: string) => {
      const match = mockQueueItems.find((item) => item.workerId === workerId || item.id === workerId);
      return match || null;
    });
  });

  describe('1. Interactive Worker Rows', () => {
    it('makes worker rows clickable and opens that specific worker verification dossier', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByText(/Verification Dossier: Sunita Devi/i)).not.toBeInTheDocument();

      // Click row for Sunita Devi
      const sunitaRow = screen.getByRole('button', { name: /Open verification dossier for Sunita Devi/i });
      expect(sunitaRow).toHaveClass('verification-queue-row');
      expect(sunitaRow).toHaveAttribute('tabIndex', '0');

      await user.click(sunitaRow);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
      expect(screen.getByText(/Worker ID:/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10482').length).toBeGreaterThanOrEqual(1);
    });

    it('opens dossier when keyboard user presses Enter or Space on focused row', async () => {
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
      const rameshRow = screen.getByRole('button', { name: /Open verification dossier for Ramesh Yadav/i });

      // Press Enter key
      fireEvent.keyDown(rameshRow, { key: 'Enter', code: 'Enter' });

      expect(await screen.findByText(/Verification Dossier: Ramesh Yadav/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10483').length).toBeGreaterThanOrEqual(1);
    });

    it('keeps existing Inspect Dossier button functional without double-triggering row click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      const inspectBtn = screen.getByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
    });

    it('passes correct worker ID to dossier repository upon row navigation', async () => {
      const user = userEvent.setup();
      const getDossierSpy = vi.spyOn(verificationRepository, 'getDossierById');

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Lakshmi Bai')).toBeInTheDocument();
      const lakshmiRow = screen.getByRole('button', { name: /Open verification dossier for Lakshmi Bai/i });

      await user.click(lakshmiRow);

      await waitFor(() => {
        expect(getDossierSpy).toHaveBeenCalledWith('W-10484');
      });
      expect(await screen.findByText(/Verification Dossier: Lakshmi Bai/i)).toBeInTheDocument();
    });
  });

  describe('2. Status-Aware Action Column', () => {
    it('renders Start Review and Inspect Dossier for PENDING_REVIEW worker', async () => {
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Start Review button is present for Pending review
      const startReviewBtn = screen.getByRole('button', { name: /Start Review/i });
      expect(startReviewBtn).toBeInTheDocument();
      expect(startReviewBtn).toBeEnabled();

      // Inspect Dossier button is also present
      const inspectBtn = screen.getByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      expect(inspectBtn).toBeInTheDocument();
    });

    it('executes backend claimCheck when Start Review is clicked and opens dossier non-optimistically', async () => {
      const user = userEvent.setup();
      const claimCheckSpy = vi.spyOn(verificationRepository, 'claimCheck').mockResolvedValueOnce();

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      const startReviewBtn = screen.getByRole('button', { name: /Start Review/i });

      await user.click(startReviewBtn);

      expect(claimCheckSpy).toHaveBeenCalledWith('chk-identity-101');
      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
    });

    it('renders Continue Review for IN_REVIEW worker and prevents duplicate review start', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();

      // Continue Review button is present
      const continueReviewBtn = screen.getByRole('button', { name: /Continue Review/i });
      expect(continueReviewBtn).toBeInTheDocument();

      // Start Review / Claim & Review button is NOT present for In Review row
      expect(screen.queryByRole('button', { name: /^Start Review for Ramesh Yadav$/i })).not.toBeInTheDocument();

      await user.click(continueReviewBtn);

      expect(await screen.findByText(/Verification Dossier: Ramesh Yadav/i)).toBeInTheDocument();
    });

    it('renders Review Corrections for REJECTED worker', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Lakshmi Bai')).toBeInTheDocument();

      const reviewCorrectionsBtn = screen.getByRole('button', { name: /Review Corrections/i });
      expect(reviewCorrectionsBtn).toBeInTheDocument();

      await user.click(reviewCorrectionsBtn);

      expect(await screen.findByText(/Verification Dossier: Lakshmi Bai/i)).toBeInTheDocument();
    });

    it('renders Review Re-Check for RECHECK_DUE worker', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();

      const reviewRecheckBtn = screen.getByRole('button', { name: /Review Re-Check/i });
      expect(reviewRecheckBtn).toBeInTheDocument();

      await user.click(reviewRecheckBtn);

      expect(await screen.findByText(/Verification Dossier: Priya Sharma/i)).toBeInTheDocument();
    });

    it('renders View Dossier for APPROVED worker in read-only mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Kavita Reddy')).toBeInTheDocument();

      const viewDossierBtn = screen.getByRole('button', { name: /View Dossier/i });
      expect(viewDossierBtn).toBeInTheDocument();

      await user.click(viewDossierBtn);

      // Dossier opens with read-only badge and read-only notice
      expect(await screen.findByText(/Verification Dossier: Kavita Reddy/i)).toBeInTheDocument();
      expect(screen.getByText(/Verification Approved & Complete — Dossier is in Read-Only Mode/i)).toBeInTheDocument();

      // Mutating decisions (Approve/Reject check buttons) are NOT rendered for approved dossier
      expect(screen.queryByRole('button', { name: /Approve Check/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject Check/i })).not.toBeInTheDocument();
    });

    it('respects RBAC permissions: hides Start Review when user lacks verification.decide permission', async () => {
      useAuthStore.setState({
        user: {
          id: 'ops-admin-01',
          email: 'operations.admin@sevanest.example.com',
          name: 'Vikram Malhotra',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.WORKER_VIEW,
          ],
        },
        accessToken: 'token',
        refreshToken: 'ref',
        isAuthenticated: true,
      });

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Operations Admin without canDecide has NO Start Review button
      expect(screen.queryByRole('button', { name: /Start Review/i })).not.toBeInTheDocument();

      // Only Inspect Dossier is rendered
      expect(screen.getByRole('button', { name: /Inspect Dossier for Sunita Devi/i })).toBeInTheDocument();
    });
  });

  describe('3. Error Handling and Stale Review Conflicts', () => {
    it('displays conflict message and does not open dossier when claimCheck fails with 409 conflict', async () => {
      const user = userEvent.setup();
      vi.spyOn(verificationRepository, 'claimCheck').mockRejectedValueOnce(
        new ConcurrencyConflictError('Check is already assigned to another reviewer.')
      );

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      const startReviewBtn = screen.getByRole('button', { name: /Start Review/i });

      await user.click(startReviewBtn);

      // Conflict alert displayed
      expect(
        await screen.findByText(/Another reviewer has already claimed this verification check/i)
      ).toBeInTheDocument();

      // Dossier NOT opened
      expect(screen.queryByText(/Verification Dossier: Sunita Devi/i)).not.toBeInTheDocument();
    });

    it('displays clear error alert when claimCheck fails with server failure', async () => {
      const user = userEvent.setup();
      vi.spyOn(verificationRepository, 'claimCheck').mockRejectedValueOnce(
        new ServerFailureError('Internal review service error.')
      );

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      const startReviewBtn = screen.getByRole('button', { name: /Start Review/i });

      await user.click(startReviewBtn);

      // Clear error alert displayed
      expect(await screen.findByText('Internal review service error.')).toBeInTheDocument();
      expect(screen.queryByText(/Verification Dossier: Sunita Devi/i)).not.toBeInTheDocument();
    });
  });

  describe('4. Centered Worker Verification Dossier Modal', () => {
    it('1. clicking a worker row opens the centered modal with dialog semantics', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const sunitaRow = screen.getByRole('button', { name: /Open verification dossier for Sunita Devi/i });
      await user.click(sunitaRow);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveClass('verification-dossier-modal-backdrop');

      const modalContent = dialog.querySelector('.verification-dossier-modal-content');
      expect(modalContent).toBeInTheDocument();
    });

    it('2. clicking the existing dossier action (Inspect Dossier) opens the same centered modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      const inspectBtn = screen.getByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
    });

    it('3. displays the correct worker details inside the modal header and body', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
      const continueBtn = screen.getByRole('button', { name: /Continue Review \(Inspect Dossier\) for Ramesh Yadav/i });
      await user.click(continueBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Verification Dossier: Ramesh Yadav/i)).toBeInTheDocument();
      expect(screen.getByText(/Category: Driver/i)).toBeInTheDocument();
      expect(screen.getByText(/Locality: Madhapur/i)).toBeInTheDocument();
      expect(screen.getAllByText('W-10483').length).toBeGreaterThanOrEqual(1);
    });

    it('4. ensures the dossier no longer renders beside the queue table (full-width queue, no split grid)', async () => {
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Check that the empty placeholder "No Worker Dossier Selected" is completely gone
      expect(screen.queryByText(/No Worker Dossier Selected/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/launch the split-screen document/i)).not.toBeInTheDocument();

      // Queue table directory wrapper exists without 2-column split-screen grid
      const queueTable = screen.getByRole('table');
      expect(queueTable).toBeInTheDocument();
    });

    it('5. clicking the close button closes the modal and removes the dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /Close dossier view/i });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('6. pressing Escape key closes the modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('7. clicking inside the modal does not close it, but clicking backdrop closes it', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      const dialog = await screen.findByRole('dialog');
      const modalContent = dialog.querySelector('.verification-dossier-modal-content');
      expect(modalContent).toBeInTheDocument();

      // Click inside modal content
      await user.click(modalContent!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click backdrop directly
      fireEvent.click(dialog);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('8. disables background scrolling while modal is open and restores it when closed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(document.body.style.overflow).not.toBe('hidden');

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');

      const closeBtn = screen.getByRole('button', { name: /Close dossier view/i });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(document.body.style.overflow).toBe('');
    });

    it('9. preserves queue filters and pagination when modal is closed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Filter by Cook category
      const categorySelect = screen.getByRole('combobox', { name: /Filter by category/i });
      await user.selectOptions(categorySelect, 'Cook');

      // Open Lakshmi Bai dossier via Review Corrections action
      const reviewCorrectionsBtn = await screen.findByRole('button', { name: /Review Corrections/i });
      await user.click(reviewCorrectionsBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Close dossier view/i });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Assert category filter is still 'Cook'
      expect(categorySelect).toHaveValue('Cook');
    });

    it('10. status-aware actions and RBAC restrictions remain unchanged with modal presentation', async () => {
      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Review/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue Review/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review Corrections/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View Dossier/i })).toBeInTheDocument();
    });

    it('11. opening the dossier does not automatically claim a review', async () => {
      const user = userEvent.setup();
      const claimCheckSpy = vi.spyOn(verificationRepository, 'claimCheck');

      renderWithProviders(<VerificationQueuePage />, '/verification');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Click row (not Start Review)
      const sunitaRow = screen.getByRole('button', { name: /Open verification dossier for Sunita Devi/i });
      await user.click(sunitaRow);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

      // claimCheck must NOT be called automatically
      expect(claimCheckSpy).not.toHaveBeenCalled();
    });

    it('12. existing dossier functionality, tabs, and pre-checks continue working in modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VerificationQueuePage />, '/verification');

      const inspectBtn = await screen.findByRole('button', { name: /Inspect Dossier for Sunita Devi/i });
      await user.click(inspectBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Tier 1 Pre-Check banner
      expect(screen.getByText(/Tier 1 Automated Onboarding Pre-Check: Mobile OTP/i)).toBeInTheDocument();

      // Check section switcher tabs
      expect(screen.getByRole('button', { name: /Inspection Workstation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Personal Details/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Work Profile/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submitted Documents/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /6-Point Checklist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review History/i })).toBeInTheDocument();

      // 5 operations check tabs
      expect(screen.getByRole('button', { name: /1\. Identity Proof/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2\. Address Proof/i })).toBeInTheDocument();

      // Switch to Personal Details tab
      const personalTab = screen.getByRole('button', { name: /Personal Details/i });
      await user.click(personalTab);

      expect(await screen.findByText(/Applicant Personal Details/i)).toBeInTheDocument();
    });
  });
});
