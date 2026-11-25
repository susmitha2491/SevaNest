import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { Worker, WorkerDetail } from '../features/workers/domain/types';
import { VerificationDossier } from '../features/verification/domain/types';

const mockWorkerId = 'w-test-101';

const mockWorkerListItem: Worker = {
  id: mockWorkerId,
  name: 'Ramesh Kumar',
  phone: '+91 98765 43210',
  phoneMasked: '+91 98765 *****',
  category: 'Cooking',
  categories: ['Cooking'],
  locality: 'Banjara Hills',
  verificationStatus: 'VERIFIED',
  status: 'ACTIVE',
  experienceYears: 5,
  ratingAverage: 4.8,
  totalReviews: 32,
  isFullyVerified: true,
  createdAt: '2026-01-10T10:00:00Z',
};

const mockWorkerDetail: WorkerDetail = {
  ...mockWorkerListItem,
  address: {
    line: 'H.No 4-21, Road No 12',
    area: 'Banjara Hills',
    city: 'Hyderabad',
    pincode: '500034',
  },
  skills: ['North Indian', 'South Indian', 'Tandoor'],
  bio: 'Specialist cook with over 5 years of domestic chef experience.',
  serviceRadiusKm: 8,
  expectedCompensation: '₹22,000 / month',
  availability: 'Full Time (7 AM - 3 PM)',
  languages: ['Hindi', 'Telugu'],
  activeEngagementsCount: 1,
  completedBookingsCount: 110,
  replacementsIncurred: 0,
  verification: {
    phoneOtpVerified: true,
    identityProofStatus: 'VERIFIED',
    identityDocName: 'Aadhaar Card',
    addressProofStatus: 'VERIFIED',
    criminalRecordStatus: 'VERIFIED',
    skillProofStatus: 'VERIFIED',
    referenceCheckStatus: 'VERIFIED',
  },
  documents: [
    {
      id: 'doc-aadhaar-1',
      documentId: 'doc-aadhaar-1',
      checkId: 'chk-identity-1',
      checkType: 'IDENTITY',
      documentType: 'IDENTITY_PROOF',
      documentTypeName: 'Aadhaar Card',
      docNumberMasked: 'XXXX-XXXX-8921',
      status: 'VERIFIED',
      signedUrl: 'https://example.com/mock-aadhaar.jpg',
      contentType: 'image/jpeg',
      available: true,
      reviewable: true,
    },
  ],
  recentEngagements: [
    {
      bookingId: 'BK-9901',
      customerName: 'Pooja Reddy',
      serviceCategory: 'Cooking',
      status: 'COMPLETED',
      period: 'Jan 2026 - Present',
    },
  ],
  internalNotes: [],
};

const mockDossier: VerificationDossier = {
  id: 'dos-101',
  workerId: mockWorkerId,
  workerName: 'Ramesh Kumar',
  phone: '+91 98765 43210',
  phoneMasked: '+91 98765 *****',
  category: 'Cooking',
  locality: 'Banjara Hills',
  experienceYears: 5,
  status: 'APPROVED',
  submissionTime: '2026-01-10T10:00:00Z',
  preCheckOtpVerified: true,
  checks: {
    IDENTITY: {
      id: 'chk-identity-1',
      type: 'IDENTITY',
      title: 'Identity Verification (Aadhaar)',
      status: 'APPROVED',
      evaluationMethod: 'DOCUMENT_INSPECTION',
      documents: [
        {
          id: 'doc-aadhaar-1',
          documentId: 'doc-aadhaar-1',
          documentTypeName: 'Aadhaar Card',
          docNumberMasked: 'XXXX-XXXX-8921',
        },
      ],
    },
  },
  submittedDocuments: [
    {
      id: 'doc-aadhaar-1',
      documentId: 'doc-aadhaar-1',
      checkType: 'IDENTITY',
      documentTypeName: 'Aadhaar Card',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      status: 'APPROVED',
      createdAt: '2026-01-10T10:00:00Z',
    },
  ],
};

function renderAppWithRouter(initialEntries: string[], initialIndex = 0) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries,
    initialIndex,
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    queryClient,
  };
}

describe('Worker Profile Navigation & History Preservation', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    useAuthStore.setState({
      user: {
        id: 'super-admin-01',
        name: 'Super Admin',
        email: 'sevanest@admin.in',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKER_MANAGE,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
        ],
      },
      isAuthenticated: true,
    });

    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
      items: [mockWorkerListItem],
      total: 1,
      page: 1,
      limit: 25,
      hasMore: false,
    });

    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue(mockWorkerDetail);
    vi.spyOn(verificationRepository, 'getDossierById').mockResolvedValue(mockDossier);
    vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
      items: [
        {
          id: 'dos-101',
          workerId: mockWorkerId,
          workerName: 'Ramesh Kumar',
          category: 'Cooking',
          status: 'APPROVED',
          submissionTime: '2026-01-10T10:00:00Z',
          locality: 'Banjara Hills',
          experienceYears: 5,
          phoneMasked: '+91 98765 *****',
          preCheckOtpVerified: true,
          checks: {},
        },
      ],
      totalCount: 1,
      pageSize: 25,
      page: 1,
      totalPages: 1,
    });
    vi.spyOn(verificationRepository, 'getSignedDocumentUrl').mockResolvedValue({
      signedUrl: 'https://example.com/mock-aadhaar.jpg',
      mimeType: 'image/jpeg',
      expiresAt: '2026-12-31T23:59:59Z',
    });
  });

  it('1. Directory → Worker Profile → Profile Tab (Their Work) → Verification Dossier → Application Back button returns to the same profile tab', async () => {
    const user = userEvent.setup();
    const { router } = renderAppWithRouter(['/directory']);

    // Find worker row and click View Profile
    const viewProfileBtns = await screen.findAllByRole('button', { name: /View Profile/i });
    await user.click(viewProfileBtns[0]);

    // Confirm Worker Profile modal opened on details tab
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Specialist cook with over 5 years of domestic chef experience.')).toBeInTheDocument();

    // Switch to tab 2: Their Work & Skills
    const workTab = screen.getByRole('tab', { name: /Their Work & Skills/i });
    await user.click(workTab);
    expect(screen.getByText(/North Indian/i)).toBeInTheDocument();
    expect(router.state.location.search).toContain('workerTab=work');

    // Click "Verification Dossier"
    const dossierBtn = screen.getByTestId('open-verification-dossier-btn');
    await user.click(dossierBtn);

    // Verify dossier view is open
    expect(await screen.findByText(/Verification Dossier: Ramesh Kumar/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/verification');
    expect(router.state.location.search).toContain(`workerId=${mockWorkerId}`);

    // Click application's Back to Profile button in dossier header
    const backBtn = screen.getByTestId('dossier-back-to-profile-btn');
    await user.click(backBtn);

    // Verify returned to Directory with Worker Profile open and Their Work tab selected
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/directory');
    });
    expect(router.state.location.search).toContain(`workerId=${mockWorkerId}`);
    expect(router.state.location.search).toContain('workerTab=work');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/North Indian/i)).toBeInTheDocument();
  });

  it('2. Directory → Worker Profile → Profile Tab (Their Work) → Verification Dossier → Browser Back button returns to the same profile tab', async () => {
    const user = userEvent.setup();
    const { router } = renderAppWithRouter(['/directory']);

    // Open Worker Profile modal
    const viewProfileBtns = await screen.findAllByRole('button', { name: /View Profile/i });
    await user.click(viewProfileBtns[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Switch to Their Work & Skills tab
    const workTab = screen.getByRole('tab', { name: /Their Work & Skills/i });
    await user.click(workTab);
    expect(screen.getByText(/North Indian/i)).toBeInTheDocument();

    // Navigate to Verification Dossier
    const dossierBtn = screen.getByTestId('open-verification-dossier-btn');
    await user.click(dossierBtn);

    expect(await screen.findByText(/Verification Dossier: Ramesh Kumar/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/verification');

    // Simulate browser Back button
    await act(async () => {
      router.navigate(-1);
    });

    // Worker profile must remain open with same worker selected and Their Work tab restored
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/directory');
    });
    expect(router.state.location.search).toContain(`workerId=${mockWorkerId}`);
    expect(router.state.location.search).toContain('workerTab=work');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/North Indian/i)).toBeInTheDocument();

    // Simulate browser Forward button
    await act(async () => {
      router.navigate(1);
    });

    // Restores Verification Dossier view
    expect(await screen.findByText(/Verification Dossier: Ramesh Kumar/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/verification');
  });

  it('3. Directory → Worker Profile → Documents Tab → Document View → Back returns to the Documents tab', async () => {
    const user = userEvent.setup();
    const { router } = renderAppWithRouter(['/directory']);

    // Open Worker Profile
    const viewProfileBtns = await screen.findAllByRole('button', { name: /View Profile/i });
    await user.click(viewProfileBtns[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Switch to Verified Documents tab
    const docsTab = screen.getByRole('tab', { name: /Verified Documents/i });
    await user.click(docsTab);
    expect(screen.getByText('Aadhaar Card')).toBeInTheDocument();
    expect(router.state.location.search).toContain('workerTab=documents');

    // Click "View Document" to inspect document
    const viewDocBtn = screen.getByRole('button', { name: /View Document/i });
    await user.click(viewDocBtn);

    // Document inspection viewer is displayed
    expect(await screen.findByTestId('kyc-document-image')).toBeInTheDocument();
    expect(router.state.location.search).toContain('docId=doc-aadhaar-1');

    // Click "Back to List" application button
    const backToListBtn = screen.getByRole('button', { name: /Back to List/i });
    await user.click(backToListBtn);

    // Document preview closed, documents list visible, worker profile still open
    await waitFor(() => {
      expect(screen.queryByTestId('kyc-document-image')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Aadhaar Card')).toBeInTheDocument();
    expect(router.state.location.search).toContain(`workerId=${mockWorkerId}`);
    expect(router.state.location.search).toContain('workerTab=documents');
    expect(router.state.location.search).not.toContain('docId=');
  });

  it('4. Directly opening a verification dossier with returnTo does not cause a navigation loop', async () => {
    const user = userEvent.setup();
    const returnUrl = `/directory?workerId=${mockWorkerId}&workerTab=work`;
    const { router } = renderAppWithRouter([
      `/verification?workerId=${mockWorkerId}&returnTo=${encodeURIComponent(returnUrl)}`,
    ]);

    expect(await screen.findByText(/Verification Dossier: Ramesh Kumar/i)).toBeInTheDocument();

    // Click back to profile button
    const backBtn = screen.getByTestId('dossier-back-to-profile-btn');
    await user.click(backBtn);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/directory');
    });
    expect(router.state.location.search).toContain(`workerId=${mockWorkerId}`);
    expect(router.state.location.search).toContain('workerTab=work');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
