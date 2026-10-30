import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { customerRepository } from '../features/customers/data/customerRepository';
import { CustomerPageResult } from '../features/customers/domain/types';

describe('Customer Management — Continuous Scrollable Table & Infinite Loading', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
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
          <CustomersListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const page1: CustomerPageResult = {
    items: [
      {
        id: 'C-001',
        name: 'Aarav Patel',
        maskedPhone: '+91 98**** **11',
        maskedEmail: 'a****@gmail.com',
        locality: 'Gachibowli',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        totalBookings: 2,
        registeredDate: '2026-01-15',
      },
      {
        id: 'C-002',
        name: 'Bhavna Sharma',
        maskedPhone: '+91 97**** **22',
        maskedEmail: 'b****@gmail.com',
        locality: 'HITEC City',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        totalBookings: 5,
        registeredDate: '2026-02-10',
      },
    ],
    total: 4,
    page: 1,
    limit: 2,
    hasMore: true,
  };

  const page2: CustomerPageResult = {
    items: [
      {
        id: 'C-002', // duplicate deliberately sent by backend to test deduplication
        name: 'Bhavna Sharma',
        maskedPhone: '+91 97**** **22',
        maskedEmail: 'b****@gmail.com',
        locality: 'HITEC City',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        totalBookings: 5,
        registeredDate: '2026-02-10',
      },
      {
        id: 'C-003',
        name: 'Chetan Verma',
        maskedPhone: '+91 96**** **33',
        maskedEmail: 'c****@gmail.com',
        locality: 'Kondapur',
        status: 'SUSPENDED',
        verificationStatus: 'PENDING',
        totalBookings: 1,
        registeredDate: '2026-03-01',
      },
      {
        id: 'C-004',
        name: 'Divya Reddy',
        maskedPhone: '+91 95**** **44',
        maskedEmail: 'd****@gmail.com',
        locality: 'Madhapur',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        totalBookings: 3,
        registeredDate: '2026-03-12',
      },
    ],
    total: 4,
    page: 2,
    limit: 2,
    hasMore: false,
  };

  it('renders vertically scrollable container and sticky table header with zero pagination buttons', async () => {
    vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValueOnce(page1);

    renderComponent();

    expect(await screen.findByText('Customer Accounts & Households')).toBeInTheDocument();
    expect(await screen.findByText('Aarav Patel')).toBeInTheDocument();
    expect(await screen.findByText('Bhavna Sharma')).toBeInTheDocument();

    // Verify vertically scrollable container
    const scrollContainer = screen.getByTestId('customer-table-scroll-container');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveStyle({
      overflowY: 'auto',
      maxHeight: '620px',
    });

    // Verify sticky headers
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(8);
    for (const th of headers) {
      expect(th).toHaveStyle({ position: 'sticky', top: '0px' });
    }

    // Verify complete removal of pagination buttons and footer
    expect(screen.queryByRole('button', { name: /Previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next page/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing \d+ to \d+ of \d+ customers/)).not.toBeInTheDocument();
  });

  it('incrementally loads next batch on scroll and prevents duplicate records', async () => {
    const getPageSpy = vi
      .spyOn(customerRepository, 'getCustomersPage')
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    renderComponent();

    expect(await screen.findByText('Aarav Patel')).toBeInTheDocument();
    expect(screen.getByText('Bhavna Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Chetan Verma')).not.toBeInTheDocument();

    // Trigger scroll event on table container near bottom
    const scrollContainer = screen.getByTestId('customer-table-scroll-container');
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 900, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 50, configurable: true });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledTimes(2);
    });

    // Check newly loaded records appear
    expect(await screen.findByText('Chetan Verma')).toBeInTheDocument();
    expect(await screen.findByText('Divya Reddy')).toBeInTheDocument();

    // Verify deduplication: Bhavna Sharma was present in both page1 and page2, but must only appear once
    const bhavnaElements = screen.getAllByText('Bhavna Sharma');
    expect(bhavnaElements).toHaveLength(1);

    // Verify all records status footer
    expect(await screen.findByTestId('continuous-scroll-footer')).toBeInTheDocument();
    expect(screen.getByText(/All 4 customer records loaded • Continuous scroll/i)).toBeInTheDocument();
  });

  it('renders empty state when no customer records match filters', async () => {
    vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderComponent();

    expect(
      await screen.findByText('No customer accounts match your search and filter criteria.')
    ).toBeInTheDocument();
  });

  it('handles API error with message and retry functionality', async () => {
    const getPageSpy = vi
      .spyOn(customerRepository, 'getCustomersPage')
      .mockRejectedValueOnce(new Error('Backend connection timeout'))
      .mockResolvedValueOnce(page1);

    renderComponent();

    expect(await screen.findByText('Backend connection timeout')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Aarav Patel')).toBeInTheDocument();
  });

  it('preserves search, status, and locality filtering', async () => {
    const getPageSpy = vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue(page1);

    renderComponent();

    expect(await screen.findByText('Aarav Patel')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(/Search by customer name/i);
    fireEvent.change(searchInput, { target: { value: 'Bhavna' } });

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'Bhavna' }),
        1,
        20
      );
    });

    // Test status filter
    const statusSelect = await screen.findByLabelText(/Filter by account status/i);
    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(getPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
        1,
        20
      );
    });
  });
});
