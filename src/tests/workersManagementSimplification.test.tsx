import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ReactElement } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { Worker, WorkerDetail } from '../features/workers/domain/types';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: ReactElement, initialEntry = '/workers') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const sampleWorkers: Worker[] = [
  {
    id: 'W-101',
    name: 'Zoya Khan',
    phoneMasked: '+91 98111 00001',
    category: 'House Maid',
    categories: ['House Maid', 'Cook', 'Babysitter'],
    experienceYears: 0,
    ratingAverage: 4.9,
    totalReviews: 12,
    locality: 'Banjara Hills',
    isFullyVerified: true,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    matchingEligible: true,
    createdAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'W-102',
    name: 'Asha Devi',
    phoneMasked: '+91 98111 00002',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 2,
    ratingAverage: 4.5,
    totalReviews: 8,
    locality: 'Madhapur',
    isFullyVerified: false,
    status: 'UNDER_REVIEW',
    accountStatus: 'ACTIVE',
    verificationStatus: 'IN_REVIEW',
    matchingEligible: false,
    createdAt: '2026-11-25T10:00:00Z',
  },
  {
    id: 'W-103',
    name: 'Meena Kumari',
    phoneMasked: '+91 98111 00003',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 4,
    ratingAverage: 4.2,
    totalReviews: 4,
    locality: 'Gachibowli',
    isFullyVerified: false,
    status: 'SUBMITTED',
    verificationStatus: 'PENDING',
    createdAt: '2026-11-22T10:00:00Z',
  },
  {
    id: 'W-104',
    name: 'Kiran Rao',
    phoneMasked: '+91 98111 00004',
    category: 'Babysitter',
    categories: ['Babysitter', 'Elderly Care Helper'],
    experienceYears: 3,
    ratingAverage: 3.9,
    totalReviews: 3,
    locality: 'Kondapur',
    isFullyVerified: false,
    status: 'REJECTED',
    applicationStatus: 'REJECTED',
    verificationStatus: 'REJECTED',
    createdAt: '2026-11-21T10:00:00Z',
  },
  {
    id: 'W-105',
    name: 'Rekha Sharma',
    phoneMasked: '+91 98111 00005',
    category: 'Cleaning Helper',
    categories: ['Cleaning Helper'],
    experienceYears: 6,
    ratingAverage: 4.7,
    totalReviews: 15,
    locality: 'HITEC City',
    isFullyVerified: true,
    status: 'SUSPENDED',
    accountStatus: 'SUSPENDED',
    verificationStatus: 'RECHECK_DUE',
    createdAt: '2026-11-19T10:00:00Z',
  },
];

describe('Worker Management (/workers) — Simplified Table, Filters, Sorting & Tabs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.WORKERS_MANAGE_STATUS,
          PERMISSIONS.VERIFICATION_REVIEW,
        ],
      },
      'ops-token'
    );
  });

  it('renders only the 6 required table columns and removes secondary table clutter', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValueOnce({
      items: sampleWorkers,
      total: sampleWorkers.length,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderWithProviders(<WorkersListPage />);

    expect(await screen.findByText('Zoya Khan')).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Worker',
      'Primary Skill',
      'Verification Status',
      'Experience',
      'Account Status',
      'Actions',
    ]);

    // Worker ID, Matching Eligibility, Rating, and Cluster are omitted from table
    expect(screen.queryByText('W-101')).not.toBeInTheDocument();
    expect(screen.queryByText('Banjara Hills')).not.toBeInTheDocument();
    expect(screen.queryByText('Matching Eligibility')).not.toBeInTheDocument();

    // Zoya Khan row: name + mobile, primary skill + +2 skills, Verified, 0 yrs, Active, View Profile
    const zoyaRow = screen.getByText('Zoya Khan').closest('tr')!;
    expect(within(zoyaRow).getByText('+91 98111 00001')).toBeInTheDocument();
    expect(within(zoyaRow).getByText('House Maid')).toBeInTheDocument();
    expect(within(zoyaRow).getByText('+2 skills')).toBeInTheDocument();
    expect(within(zoyaRow).getByText('Verified')).toBeInTheDocument();
    expect(within(zoyaRow).getByText('0 yrs')).toBeInTheDocument();
    expect(within(zoyaRow).getByText('Active')).toBeInTheDocument();
    expect(within(zoyaRow).getByRole('button', { name: 'View profile for Zoya Khan' })).toBeInTheDocument();

    // Remaining compact verification & account badges across all states
    expect(within(screen.getByText('Asha Devi').closest('tr')!).getByText('In Review')).toBeInTheDocument();
    expect(within(screen.getByText('Asha Devi').closest('tr')!).getByText('2 yrs')).toBeInTheDocument();
    expect(within(screen.getByText('Asha Devi').closest('tr')!).getByText('Inactive')).toBeInTheDocument();
    expect(within(screen.getByText('Meena Kumari').closest('tr')!).getByText('Pending')).toBeInTheDocument();
    expect(within(screen.getByText('Kiran Rao').closest('tr')!).getByText('Rejected')).toBeInTheDocument();
    expect(within(screen.getByText('Rekha Sharma').closest('tr')!).getByText('Re-check Due')).toBeInTheDocument();
    expect(within(screen.getByText('Rekha Sharma').closest('tr')!).getByText('Inactive')).toBeInTheDocument();
  });

  it('keeps only Search, Category filter, Verification filter, and compact Sort control with Recently Added & Name: A-Z', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValueOnce({
      items: sampleWorkers,
      total: sampleWorkers.length,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderWithProviders(<WorkersListPage />);
    expect(await screen.findByText('Asha Devi')).toBeInTheDocument();

    // Core filters present
    expect(screen.getByLabelText('Search workers')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by skill category')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by verification state')).toBeInTheDocument();

    // Removed dropdowns are gone
    expect(screen.queryByLabelText('Filter by account status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by operating locality')).not.toBeInTheDocument();

    // Compact sort button beside Worker Directory heading opens a small menu with Recently Added and Name A–Z
    const sortButton = screen.getByRole('button', { name: 'Sort worker roster' });
    expect(sortButton).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu', { name: 'Sort options' })).not.toBeInTheDocument();

    // Default sort is Recently Added (Asha Devi 2026-11-25 is first, Rekha Sharma 2026-11-19 is last)
    const rowsBeforeSort = screen.getAllByRole('button', { name: /View profile for .* \(W-\d+\)/i });
    expect(within(rowsBeforeSort[0]).getByText('Asha Devi')).toBeInTheDocument();
    expect(within(rowsBeforeSort[rowsBeforeSort.length - 1]).getByText('Rekha Sharma')).toBeInTheDocument();

    fireEvent.click(sortButton);
    const sortMenu = screen.getByRole('menu', { name: 'Sort options' });
    const sortMenuItems = within(sortMenu).getAllByRole('menuitemradio').map((el) => el.textContent?.trim());
    expect(sortMenuItems).toEqual(['Recently Added', 'Name A–Z']);

    // Switch to Name A–Z
    fireEvent.click(within(sortMenu).getByRole('menuitemradio', { name: 'Name A–Z' }));
    expect(screen.queryByRole('menu', { name: 'Sort options' })).not.toBeInTheDocument();
    const rowsAlpha = screen.getAllByRole('button', { name: /View profile for .* \(W-\d+\)/i });
    expect(within(rowsAlpha[0]).getByText('Asha Devi')).toBeInTheDocument();
    expect(within(rowsAlpha[rowsAlpha.length - 1]).getByText('Zoya Khan')).toBeInTheDocument();
  });

  it('displays only the first primary skill without comma-joined lists or double-counting when backend returns multiple categories, and omits badge for single-skill workers', async () => {
    const multiCategoryWorker: Worker = {
      ...sampleWorkers[0],
      id: 'W-201',
      name: 'Hyy',
      category: 'House Maid, Driver, Cook, Babysitter, Elderly Care Helper, Cleaning Helper',
      categories: ['House Maid', 'Driver', 'Cook', 'Babysitter', 'Elderly Care Helper', 'Cleaning Helper'],
    };
    const singleSkillWorker: Worker = {
      ...sampleWorkers[1],
      id: 'W-202',
      name: 'Sita',
      category: 'Cook',
      categories: ['Cook'],
    };

    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValueOnce({
      items: [multiCategoryWorker, singleSkillWorker],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderWithProviders(<WorkersListPage />);
    expect(await screen.findByText('Hyy')).toBeInTheDocument();

    const hyyRow = screen.getByText('Hyy').closest('tr')!;
    expect(within(hyyRow).getByText('House Maid')).toBeInTheDocument();
    expect(within(hyyRow).getByText('+5 skills')).toBeInTheDocument();
    expect(within(hyyRow).queryByText(/House Maid, Driver/i)).not.toBeInTheDocument();
    expect(within(hyyRow).queryByText('+6 skills')).not.toBeInTheDocument();

    const sitaRow = screen.getByText('Sita').closest('tr')!;
    expect(within(sitaRow).getByText('Cook')).toBeInTheDocument();
    expect(within(sitaRow).queryByText(/\+\d+ skill/i)).not.toBeInTheDocument();
  });

  it('renders the 6 refined worker tabs and preserves full secondary profile data in View Profile modal', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
      items: sampleWorkers,
      total: sampleWorkers.length,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    const detailMock: WorkerDetail = {
      ...sampleWorkers[0],
      serviceRadiusKm: 8,
      languages: ['Hindi'],
      bio: 'Reliable household helper.',
      skills: ['House Maid', 'Cook', 'Babysitter'],
      verification: {
        phoneOtpVerified: true,
        identityProofStatus: 'VERIFIED',
        addressProofStatus: 'VERIFIED',
        criminalRecordStatus: 'VERIFIED',
        skillProofStatus: 'VERIFIED',
        referenceCheckStatus: 'VERIFIED',
      },
      activeEngagementsCount: 1,
      completedBookingsCount: 14,
      replacementsIncurred: 0,
      recentEngagements: [],
      internalNotes: [],
    };
    vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce(detailMock);

    renderWithProviders(<WorkersListPage />);
    expect(await screen.findByText('Zoya Khan')).toBeInTheDocument();

    for (const label of [
      'All Workers',
      'Active',
      'Pending Verification',
      'In Review',
      'Rejected / Corrections',
      'Re-check Due',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    // Clicking View Profile exposes complete Worker ID, locality, matching eligibility, rating, and skills inside modal
    fireEvent.click(screen.getByRole('button', { name: 'View profile for Zoya Khan' }));
    expect(await screen.findByText('ID: W-101')).toBeInTheDocument();
    expect(screen.getByText(/Matching: ELIGIBLE/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Banjara Hills/i).length).toBeGreaterThan(0);
  });
});
