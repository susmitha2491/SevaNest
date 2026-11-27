import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';
import {
  RealWorkerRepository,
  workerRepository,
} from '../features/workers/data/workerRepository';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { Worker } from '../features/workers/domain/types';

function renderWithProviders(ui: React.ReactElement, initialEntry: string = '/workers') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockMixedWorkers: Worker[] = [
  {
    id: 'W-PENDING-01',
    name: 'Anita Pending',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 3,
    locality: 'Madhapur',
    status: 'SUBMITTED',
    verificationStatus: 'PENDING',
    applicationStatus: 'SUBMITTED',
    isFullyVerified: false,
    ratingAverage: 0,
    totalReviews: 0,
    matchingEligible: false,
  },
  {
    id: 'W-INREVIEW-01',
    name: 'Bharat Review',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 5,
    locality: 'Gachibowli',
    status: 'UNDER_REVIEW',
    verificationStatus: 'IN_REVIEW',
    applicationStatus: 'UNDER_REVIEW',
    isFullyVerified: false,
    ratingAverage: 0,
    totalReviews: 0,
    matchingEligible: false,
  },
  {
    id: 'W-VERIFIED-01',
    name: 'Chitra Verified',
    category: 'House Maid',
    categories: ['House Maid'],
    experienceYears: 4,
    locality: 'Kondapur',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    applicationStatus: 'ACTIVE',
    isFullyVerified: true,
    ratingAverage: 4.8,
    totalReviews: 12,
    matchingEligible: true,
    signedOffAt: '2026-11-20T10:00:00Z',
    activatedAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'W-REJECTED-01',
    name: 'Devi Rejected',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 2,
    locality: 'Jubilee Hills',
    status: 'REJECTED',
    verificationStatus: 'REJECTED',
    applicationStatus: 'REJECTED',
    isFullyVerified: false,
    ratingAverage: 0,
    totalReviews: 0,
    matchingEligible: false,
  },
  {
    id: 'W-PENDING-02',
    name: 'Eshwar Pending',
    category: 'Babysitter',
    categories: ['Babysitter'],
    experienceYears: 6,
    locality: 'Banjara Hills',
    status: 'SUBMITTED',
    verificationStatus: 'PENDING',
    applicationStatus: 'SUBMITTED',
    isFullyVerified: false,
    ratingAverage: 0,
    totalReviews: 0,
    matchingEligible: false,
  },
  {
    id: 'W-INREVIEW-02',
    name: 'Farooq Review',
    category: 'Elderly Care Helper',
    categories: ['Elderly Care Helper'],
    experienceYears: 7,
    locality: 'HITEC City',
    status: 'UNDER_REVIEW',
    verificationStatus: 'IN_REVIEW',
    applicationStatus: 'UNDER_REVIEW',
    isFullyVerified: false,
    ratingAverage: 0,
    totalReviews: 0,
    matchingEligible: false,
  },
];

describe('Worker Management Verification Status Filtering: Pending vs In Review', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession(
      {
        id: 'super-admin-01',
        name: 'Super Admin',
        email: 'superadmin@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: [
          '*',
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
        ],
      },
      'super-admin-token'
    );
  });

  describe('1. WorkersListPage Tab-Based Verification Status Filtering', () => {
    it('Pending Verification tab displays only workers with exact PENDING status and never IN_REVIEW workers', async () => {
      const user = userEvent.setup();

      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (criteria) => {
        let items = mockMixedWorkers;
        if (criteria?.verificationStatus && criteria.verificationStatus !== 'ALL') {
          if (criteria.verificationStatus === 'PENDING') {
            items = items.filter((w) => w.verificationStatus === 'PENDING');
          } else if (criteria.verificationStatus === 'IN_REVIEW') {
            items = items.filter((w) => w.verificationStatus === 'IN_REVIEW');
          }
        }
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />);

      // Switch to Pending Verification tab
      const pendingTab = await screen.findByRole('button', { name: /^Pending Verification$/i });
      await user.click(pendingTab);

      // Verify exact PENDING workers are displayed
      expect(await screen.findByText('Anita Pending')).toBeInTheDocument();
      expect(screen.getByText('Eshwar Pending')).toBeInTheDocument();

      // Ensure IN_REVIEW workers NEVER appear in Pending Verification tab
      expect(screen.queryByText('Bharat Review')).not.toBeInTheDocument();
      expect(screen.queryByText('Farooq Review')).not.toBeInTheDocument();

      // Ensure VERIFIED and REJECTED workers do not appear
      expect(screen.queryByText('Chitra Verified')).not.toBeInTheDocument();
      expect(screen.queryByText('Devi Rejected')).not.toBeInTheDocument();
    });

    it('In Review tab displays only workers with exact IN_REVIEW status and never PENDING workers', async () => {
      const user = userEvent.setup();

      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (criteria) => {
        let items = mockMixedWorkers;
        if (criteria?.verificationStatus && criteria.verificationStatus !== 'ALL') {
          if (criteria.verificationStatus === 'PENDING') {
            items = items.filter((w) => w.verificationStatus === 'PENDING');
          } else if (criteria.verificationStatus === 'IN_REVIEW') {
            items = items.filter((w) => w.verificationStatus === 'IN_REVIEW');
          }
        }
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />);

      // Switch to In Review tab
      const inReviewTab = await screen.findByRole('button', { name: /^In Review$/i });
      await user.click(inReviewTab);

      // Verify exact IN_REVIEW workers are displayed
      expect(await screen.findByText('Bharat Review')).toBeInTheDocument();
      expect(screen.getByText('Farooq Review')).toBeInTheDocument();

      // Ensure PENDING workers NEVER appear in In Review tab
      expect(screen.queryByText('Anita Pending')).not.toBeInTheDocument();
      expect(screen.queryByText('Eshwar Pending')).not.toBeInTheDocument();

      // Ensure VERIFIED and REJECTED workers do not appear
      expect(screen.queryByText('Chitra Verified')).not.toBeInTheDocument();
      expect(screen.queryByText('Devi Rejected')).not.toBeInTheDocument();
    });

    it('Direct URL navigation to /workers?verificationStatus=PENDING renders only PENDING workers', async () => {
      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (criteria) => {
        let items = mockMixedWorkers;
        if (criteria?.verificationStatus && criteria.verificationStatus !== 'ALL') {
          if (criteria.verificationStatus === 'PENDING') {
            items = items.filter((w) => w.verificationStatus === 'PENDING');
          } else if (criteria.verificationStatus === 'IN_REVIEW') {
            items = items.filter((w) => w.verificationStatus === 'IN_REVIEW');
          }
        }
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING');

      expect(await screen.findByText('Anita Pending')).toBeInTheDocument();
      expect(screen.getByText('Eshwar Pending')).toBeInTheDocument();
      expect(screen.queryByText('Bharat Review')).not.toBeInTheDocument();
      expect(screen.queryByText('Farooq Review')).not.toBeInTheDocument();
      expect(screen.queryByText('Chitra Verified')).not.toBeInTheDocument();
    });

    it('Direct URL navigation to /workers?verificationStatus=IN_REVIEW renders only IN_REVIEW workers', async () => {
      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (criteria) => {
        let items = mockMixedWorkers;
        if (criteria?.verificationStatus && criteria.verificationStatus !== 'ALL') {
          if (criteria.verificationStatus === 'PENDING') {
            items = items.filter((w) => w.verificationStatus === 'PENDING');
          } else if (criteria.verificationStatus === 'IN_REVIEW') {
            items = items.filter((w) => w.verificationStatus === 'IN_REVIEW');
          }
        }
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=IN_REVIEW');

      expect(await screen.findByText('Bharat Review')).toBeInTheDocument();
      expect(screen.getByText('Farooq Review')).toBeInTheDocument();
      expect(screen.queryByText('Anita Pending')).not.toBeInTheDocument();
      expect(screen.queryByText('Eshwar Pending')).not.toBeInTheDocument();
      expect(screen.queryByText('Chitra Verified')).not.toBeInTheDocument();
    });

    it('Correctly filters when backend endpoint returns mixed statuses in raw payload', async () => {
      // Backend returns all workers without filtering
      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: mockMixedWorkers,
        total: mockMixedWorkers.length,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING');

      // The frontend UI filter MUST filter out Bharat Review (IN_REVIEW) even if backend sent it
      expect(await screen.findByText('Anita Pending')).toBeInTheDocument();
      expect(screen.getByText('Eshwar Pending')).toBeInTheDocument();
      expect(screen.queryByText('Bharat Review')).not.toBeInTheDocument();
      expect(screen.queryByText('Farooq Review')).not.toBeInTheDocument();
    });
  });

  describe('2. RealWorkerRepository Contract Alignment', () => {
    const rawBackendItems = [
      {
        id: 'W-RAW-01',
        name: 'Gita Pending',
        category: 'Cook',
        locality: 'Madhapur',
        status: 'SUBMITTED',
        verificationStatus: 'PENDING',
        applicationStatus: 'SUBMITTED',
        isFullyVerified: false,
      },
      {
        id: 'W-RAW-02',
        name: 'Hari InReview',
        category: 'Driver',
        locality: 'Gachibowli',
        status: 'UNDER_REVIEW',
        verificationStatus: 'IN_REVIEW',
        applicationStatus: 'UNDER_REVIEW',
        isFullyVerified: false,
      },
    ];

    it('RealWorkerRepository.getWorkersPage correctly separates PENDING and IN_REVIEW from mixed backend responses', async () => {
      const realRepo = new RealWorkerRepository();
      const capturedCalls: AxiosRequestConfig[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          if (config) capturedCalls.push(config);
          return {
            data: {
              items: rawBackendItems,
              meta: { total: rawBackendItems.length, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      // Query for PENDING
      const pendingResult = await realRepo.getWorkersPage({ verificationStatus: 'PENDING' }, 1, 20);
      expect(pendingResult.items.every((w) => w.verificationStatus === 'PENDING')).toBe(true);
      expect(pendingResult.items.some((w) => w.name === 'Gita Pending')).toBe(true);
      expect(pendingResult.items.some((w) => w.name === 'Hari InReview')).toBe(false);

      // Query for IN_REVIEW
      const inReviewResult = await realRepo.getWorkersPage({ verificationStatus: 'IN_REVIEW' }, 1, 20);
      expect(inReviewResult.items.every((w) => w.verificationStatus === 'IN_REVIEW')).toBe(true);
      expect(inReviewResult.items.some((w) => w.name === 'Hari InReview')).toBe(true);
      expect(inReviewResult.items.some((w) => w.name === 'Gita Pending')).toBe(false);
    });

    it('RealWorkerRepository.getWorkers accurately filters PENDING and IN_REVIEW without treating them as equivalent', async () => {
      const realRepo = new RealWorkerRepository();

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/workers') {
          return {
            data: {
              items: rawBackendItems,
              meta: { total: rawBackendItems.length, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const pendingWorkers = await realRepo.getWorkers({ verificationStatus: 'PENDING' });
      expect(pendingWorkers.length).toBe(1);
      expect(pendingWorkers[0].name).toBe('Gita Pending');

      const inReviewWorkers = await realRepo.getWorkers({ verificationStatus: 'IN_REVIEW' });
      expect(inReviewWorkers.length).toBe(1);
      expect(inReviewWorkers[0].name).toBe('Hari InReview');
    });

    it('RealWorkerRepository accurately derives IN_REVIEW status when backend omits verificationStatus but sets verificationLevel=IN_PROGRESS and applicationStatus=ACTION_REQUIRED', async () => {
      const realRepo = new RealWorkerRepository();
      const liveStyleBackendItems = [
        {
          id: 'W-LIVE-01',
          name: 'Nanda ActionRequired',
          category: 'Babysitter',
          locality: 'Madhapur',
          onboardingStatus: 'SUBMITTED',
          applicationStatus: 'ACTION_REQUIRED',
          verificationLevel: 'IN_PROGRESS',
          isFullyVerified: false,
        },
        {
          id: 'W-LIVE-02',
          name: 'Charan UnderReview',
          category: 'House Maid',
          locality: 'Gachibowli',
          onboardingStatus: 'SUBMITTED',
          applicationStatus: 'UNDER_REVIEW',
          verificationLevel: 'IN_PROGRESS',
          isFullyVerified: false,
        },
        {
          id: 'W-LIVE-03',
          name: 'Nissy Pending',
          category: 'Driver',
          locality: 'Kondapur',
          onboardingStatus: 'SUBMITTED',
          applicationStatus: 'SUBMITTED',
          verificationLevel: 'NOT_STARTED',
          isFullyVerified: false,
        },
      ];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/workers') {
          return {
            data: {
              data: liveStyleBackendItems,
              meta: { total: liveStyleBackendItems.length, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      // Query for IN_REVIEW - both Nanda and Charan must appear
      const inReviewPage = await realRepo.getWorkersPage({ verificationStatus: 'IN_REVIEW' }, 1, 20);
      expect(inReviewPage.items.length).toBe(2);
      expect(inReviewPage.items.map((w) => w.name)).toEqual(
        expect.arrayContaining(['Nanda ActionRequired', 'Charan UnderReview'])
      );
      expect(inReviewPage.items.some((w) => w.name === 'Nissy Pending')).toBe(false);

      // Query for PENDING - only Nissy must appear
      const pendingPage = await realRepo.getWorkersPage({ verificationStatus: 'PENDING' }, 1, 20);
      expect(pendingPage.items.length).toBe(1);
      expect(pendingPage.items[0].name).toBe('Nissy Pending');
      expect(pendingPage.items.some((w) => w.name === 'Nanda ActionRequired')).toBe(false);
      expect(pendingPage.items.some((w) => w.name === 'Charan UnderReview')).toBe(false);
    });

    it('RealWorkerRepository.getWorkersPage does NOT fire individual /admin/workers/{id} prefetch calls, preventing rate limit bursts', async () => {
      const realRepo = new RealWorkerRepository();
      const calls: string[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        calls.push(url);
        if (url === '/admin/workers') {
          return {
            data: {
              data: [
                { id: 'W-01', name: 'Worker 1', onboardingStatus: 'SUBMITTED', verificationLevel: 'NOT_STARTED', isFullyVerified: false },
                { id: 'W-02', name: 'Worker 2', onboardingStatus: 'SUBMITTED', verificationLevel: 'IN_PROGRESS', isFullyVerified: false },
              ],
              meta: { total: 2, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      await realRepo.getWorkersPage({ verificationStatus: 'IN_REVIEW' }, 1, 20);

      // Must only call /admin/workers list endpoint, NOT eager /admin/workers/W-01 or /admin/workers/W-02
      expect(calls.filter((u) => u.startsWith('/admin/workers/'))).toHaveLength(0);
      expect(calls.filter((u) => u === '/admin/workers')).toHaveLength(1);
    });

    it('handles HTTP 429 response without infinite retry bursts', async () => {
      const realRepo = new RealWorkerRepository();
      let callCount = 0;

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        callCount++;
        if (url === '/admin/workers') {
          const err = new Error('Request failed with status code 429');
          (err as unknown as { response: { status: number; data: { message: string } } }).response = {
            status: 429,
            data: { message: 'Too Many Requests' },
          };
          throw err;
        }
        return { data: {} };
      });

      await expect(realRepo.getWorkersPage({ verificationStatus: 'IN_REVIEW' }, 1, 20)).rejects.toThrow();
      // Should fail cleanly on the first attempt without executing repeated burst calls
      expect(callCount).toBe(1);
    });
  });

  describe('3. Search, Pagination, and Sorting Compatibility with Status Tabs', () => {
    it('preserves search within the selected verification status tab', async () => {
      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (criteria) => {
        let items = mockMixedWorkers.filter((w) => w.verificationStatus === 'PENDING');
        if (criteria?.searchTerm) {
          items = items.filter((w) => w.name.toLowerCase().includes(criteria.searchTerm!.toLowerCase()));
        }
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING&search=Anita');

      expect(await screen.findByText('Anita Pending')).toBeInTheDocument();
      expect(screen.queryByText('Eshwar Pending')).not.toBeInTheDocument();
      expect(screen.queryByText('Bharat Review')).not.toBeInTheDocument();
    });

    it('sorts records A-Z within the selected verification status tab', async () => {
      const user = userEvent.setup();

      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (_criteria) => {
        const items = mockMixedWorkers.filter((w) => w.verificationStatus === 'PENDING');
        return {
          items,
          total: items.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=PENDING');

      expect(await screen.findByText('Anita Pending')).toBeInTheDocument();
      expect(screen.getByText('Eshwar Pending')).toBeInTheDocument();

      // Open sort menu and select Name: A-Z
      const sortButton = screen.getByRole('button', { name: /Sort worker roster/i });
      await user.click(sortButton);

      const nameSortOption = screen.getByRole('menuitemradio', { name: /Name A/i });
      await user.click(nameSortOption);

      const anitaEl = screen.getAllByText('Anita Pending')[0];
      const eshwarEl = screen.getAllByText('Eshwar Pending')[0];
      const DOCUMENT_POSITION_FOLLOWING = 4;
      expect(anitaEl.compareDocumentPosition(eshwarEl) & DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
