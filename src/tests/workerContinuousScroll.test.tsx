import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { WorkerPageResult, Worker } from '../features/workers/domain/types';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

describe('Worker Management — Continuous Scrollable Table & Infinite Loading', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.VERIFICATION_REVIEW,
        ],
      },
      'ops-token'
    );

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkersListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const sampleWorker1: Worker = {
    id: 'W-001',
    applicationId: 'APP-001',
    name: 'Sunita Devi',
    phoneMasked: '+91 98**** **11',
    category: 'House Maid',
    categories: ['House Maid'],
    experienceYears: 5,
    ratingAverage: 4.8,
    totalReviews: 24,
    status: 'ACTIVE',
    locality: 'Gachibowli',
    isFullyVerified: true,
    verificationStatus: 'VERIFIED',
    createdAt: '2026-01-10T10:00:00Z',
  };

  const sampleWorker2: Worker = {
    id: 'W-002',
    applicationId: 'APP-002',
    name: 'Ramesh Kumar',
    phoneMasked: '+91 97**** **22',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 8,
    ratingAverage: 4.6,
    totalReviews: 18,
    status: 'ACTIVE',
    locality: 'HITEC City',
    isFullyVerified: true,
    verificationStatus: 'VERIFIED',
    createdAt: '2026-01-15T11:30:00Z',
  };

  const sampleWorker3: Worker = {
    id: 'W-003',
    applicationId: 'APP-003',
    name: 'Lakshmi Bai',
    phoneMasked: '+91 96**** **33',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 3,
    ratingAverage: 4.2,
    totalReviews: 9,
    status: 'SUSPENDED',
    locality: 'Kondapur',
    isFullyVerified: false,
    verificationStatus: 'PENDING',
    createdAt: '2026-02-01T09:00:00Z',
  };

  const sampleWorker4: Worker = {
    id: 'W-004',
    applicationId: 'APP-004',
    name: 'Anil Rao',
    phoneMasked: '+91 95**** **44',
    category: 'Elderly Care',
    categories: ['Elderly Care'],
    experienceYears: 6,
    ratingAverage: 4.9,
    totalReviews: 31,
    status: 'ACTIVE',
    locality: 'Madhapur',
    isFullyVerified: true,
    verificationStatus: 'VERIFIED',
    createdAt: '2026-02-15T14:20:00Z',
  };

  const page1: WorkerPageResult = {
    items: [sampleWorker1, sampleWorker2],
    total: 4,
    page: 1,
    limit: 2,
    hasMore: true,
  };

  const page2: WorkerPageResult = {
    items: [
      sampleWorker2, // Duplicate deliberately sent across batches to test deduplication by worker.id
      sampleWorker3,
      sampleWorker4,
    ],
    total: 4,
    page: 2,
    limit: 2,
    hasMore: false,
  };

  it('renders vertically scrollable container and sticky column headers with zero pagination buttons or footer', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValueOnce(page1);

    renderComponent();

    expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();
    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    expect(await screen.findByText('Ramesh Kumar')).toBeInTheDocument();

    // Verify vertically scrollable container
    const scrollContainer = screen.getByTestId('worker-table-scroll-container');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveStyle({
      overflowY: 'auto',
      maxHeight: '620px',
    });

    // Verify sticky headers
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(10);
    for (const th of headers) {
      expect(th).toHaveStyle({ position: 'sticky', top: '0px' });
    }

    // Verify complete removal of pagination buttons and footer
    expect(screen.queryByRole('button', { name: /Previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next page/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing \d+ to \d+ of \d+ workers/)).not.toBeInTheDocument();
  });

  it('incrementally loads next batch on scroll and prevents duplicate records using genuine backend worker ID', async () => {
    const getPageSpy = vi
      .spyOn(workerRepository, 'getWorkersPage')
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    renderComponent();

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.queryByText('Lakshmi Bai')).not.toBeInTheDocument();

    // Trigger scroll event on table container near bottom (threshold: within 150px of bottom)
    const scrollContainer = screen.getByTestId('worker-table-scroll-container');
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 900, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 50, configurable: true });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledTimes(2);
    });

    // Check newly loaded records appear
    expect(await screen.findByText('Lakshmi Bai')).toBeInTheDocument();
    expect(await screen.findByText('Anil Rao')).toBeInTheDocument();

    // Verify deduplication: Ramesh Kumar (W-002) was in both page1 and page2, but must only appear once in DOM
    const rameshElements = screen.getAllByText('Ramesh Kumar');
    expect(rameshElements).toHaveLength(1);

    // Verify completion footer
    expect(await screen.findByTestId('continuous-scroll-footer')).toBeInTheDocument();
    expect(screen.getByText(/All 4 worker records loaded • Continuous scroll/i)).toBeInTheDocument();
  });

  it('renders empty state when no worker records match filters', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderComponent();

    expect(
      await screen.findByText('No domestic workers match your search and filter criteria.')
    ).toBeInTheDocument();
  });

  it('handles API error with functional Retry button', async () => {
    const getPageSpy = vi
      .spyOn(workerRepository, 'getWorkersPage')
      .mockRejectedValueOnce(new Error('Network connection failed'))
      .mockResolvedValueOnce(page1);

    renderComponent();

    expect(await screen.findByText('Failed to load domestic worker roster.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
  });

  it('preserves all 6 operational scope tabs and triggers backend filtering', async () => {
    const getPageSpy = vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(page1);

    renderComponent();

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

    // Verify all 6 tabs exist
    const tabAll = screen.getByRole('button', { name: /All Registered Workers/i });
    const tabActive = screen.getByRole('button', { name: /Active & Verified Roster/i });
    const tabPending = screen.getByRole('button', { name: /Pending Verification \/ Incomplete KYC/i });
    const tabInReview = screen.getByRole('button', { name: /In Review Pipeline/i });
    const tabRejected = screen.getByRole('button', { name: /Rejected \/ Corrections/i });
    const tabRecheck = screen.getByRole('button', { name: /Re-Check Due/i });

    expect(tabAll).toBeInTheDocument();
    expect(tabActive).toBeInTheDocument();
    expect(tabPending).toBeInTheDocument();
    expect(tabInReview).toBeInTheDocument();
    expect(tabRejected).toBeInTheDocument();
    expect(tabRecheck).toBeInTheDocument();

    // Click Pending Verification tab
    fireEvent.click(tabPending);

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ verified: false }),
        1,
        20
      );
    });
  });

  it('preserves search, category, status, and locality filtering', async () => {
    const getPageSpy = vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(page1);

    renderComponent();

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(/Search by worker name/i);
    fireEvent.change(searchInput, { target: { value: 'Sunita' } });

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'Sunita' }),
        1,
        20
      );
    });

    // Test category filter
    const categorySelect = await screen.findByLabelText(/Filter by skill category/i);
    fireEvent.change(categorySelect, { target: { value: 'House Maid' } });

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'House Maid' }),
        1,
        20
      );
    });
  });

  it('preserves row actions and allows opening detail modal and reject dialog', async () => {
    vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(page1);

    renderComponent();

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

    // Row action buttons exist
    const rowButtons = screen.getAllByRole('button', { name: /View profile for/i });
    expect(rowButtons.length).toBeGreaterThan(0);

    const approveButtons = screen.getAllByRole('button', { name: /Approve verification for/i });
    expect(approveButtons.length).toBeGreaterThan(0);

    const rejectButtons = screen.getAllByRole('button', { name: /Reject verification for/i });
    expect(rejectButtons.length).toBeGreaterThan(0);

    // Clicking Reject opens the Reject Worker Verification dialog
    fireEvent.click(rejectButtons[0]);
    expect(await screen.findByText(/Reject Verification: Sunita Devi/i)).toBeInTheDocument();
    expect(screen.getByText(/Select an operational rejection reason category/i)).toBeInTheDocument();
  });
});
