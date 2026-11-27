import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { Worker } from '../features/workers/domain/types';
import { Customer } from '../features/customers/domain/types';

function renderWithProviders(ui: React.ReactElement, initialEntry: string = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
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

const mockWorkersForTest: Worker[] = [
  {
    id: 'W-TEST-001',
    name: 'Suresh Kumar',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 4,
    locality: 'Madhapur',
    phone: '+91 98765 43210',
    phoneMasked: '+91 98765 43210',
    mobile: '+91 98765 43210',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    applicationStatus: 'ACTIVE',
    isFullyVerified: true,
    matchingEligible: true,
    ratingAverage: 4.8,
    totalReviews: 10,
  },
  {
    id: 'W-TEST-002',
    name: 'Pooja Verma',
    category: 'House Maid',
    categories: ['House Maid'],
    experienceYears: 2,
    locality: 'Kondapur',
    phone: '+91 91234 56789',
    phoneMasked: '+91 91234 56789',
    mobile: '+91 91234 56789',
    status: 'UNDER_REVIEW',
    verificationStatus: 'IN_REVIEW',
    applicationStatus: 'UNDER_REVIEW',
    isFullyVerified: false,
    matchingEligible: false,
    ratingAverage: 0,
    totalReviews: 0,
  },
];

const mockCustomersForTest: Customer[] = [
  {
    id: 'C-TEST-001',
    name: 'Rahul Sharma',
    phone: '+91 98111 22233',
    maskedPhone: '+91 98111 22233',
    unmaskedPhone: '+91 98111 22233',
    maskedEmail: 'r*****@example.com',
    locality: 'Banjara Hills',
    registeredDate: '2026-02-15T10:00:00Z',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 5,
  },
  {
    id: 'C-TEST-002',
    name: 'Ananya Roy',
    phone: '+91 98444 55566',
    maskedPhone: '+91 98444 55566',
    unmaskedPhone: '+91 98444 55566',
    maskedEmail: 'a*****@example.com',
    locality: 'Jubilee Hills',
    registeredDate: '2026-03-01T10:00:00Z',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 2,
  },
];

describe('Unmasked Mobile Display Verification in Workers and Customers Tables', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession(
      {
        id: 'ops-admin-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.CUSTOMER_VIEW,
        ],
      },
      'fake-ops-token',
      'fake-ops-refresh'
    );
  });

  describe('1. Workers Table Mobile Display', () => {
    it('displays the full unmasked mobile number directly without asterisks or eye icon', async () => {
      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: mockWorkersForTest,
        total: mockWorkersForTest.length,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<WorkersListPage />, '/workers');

      expect(await screen.findByText('Suresh Kumar')).toBeInTheDocument();

      // Full number should be visible for both workers
      const mobileElements = screen.getAllByTestId('worker-mobile-text');
      expect(mobileElements.length).toBe(2);
      const texts = mobileElements.map((el) => el.textContent?.trim());
      expect(texts).toContain('+91 98765 43210');
      expect(texts).toContain('+91 91234 56789');
      mobileElements.forEach((el) => {
        expect(el.textContent).not.toContain('*');
        expect(within(el).queryByRole('button')).not.toBeInTheDocument();
      });

      expect(screen.queryByTitle(/reveal/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/mask/i)).not.toBeInTheDocument();
    });

    it('displays In Review worker on /workers?verificationStatus=IN_REVIEW without firing individual prefetch bursts', async () => {
      const getWorkersPageSpy = vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: [mockWorkersForTest[1]],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<WorkersListPage />, '/workers?verificationStatus=IN_REVIEW');

      expect(await screen.findByText('Pooja Verma')).toBeInTheDocument();
      expect(screen.getByText('+91 91234 56789')).toBeInTheDocument();

      // Only getWorkersPage should be called once, no individual getWorkerById bursts
      expect(getWorkersPageSpy).toHaveBeenCalled();
    });
  });

  describe('2. Customers Table Mobile Display', () => {
    it('displays the full unmasked mobile number directly without asterisks or eye icon and uses clean Contact header', async () => {
      vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue({
        items: mockCustomersForTest,
        total: mockCustomersForTest.length,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<CustomersListPage />, '/customers');

      expect(await screen.findByText('Rahul Sharma')).toBeInTheDocument();

      // Verify column header is Contact without PII MASKED
      expect(screen.getByRole('columnheader', { name: /^contact$/i })).toBeInTheDocument();
      expect(screen.queryByText(/contact \(pii masked\)/i)).not.toBeInTheDocument();

      const customerMobiles = screen.getAllByTestId('customer-mobile-text');
      expect(customerMobiles.length).toBe(2);
      const customerTexts = customerMobiles.map((el) => el.textContent?.trim());
      expect(customerTexts).toContain('+91 98111 22233');
      expect(customerTexts).toContain('+91 98444 55566');
      customerMobiles.forEach((el) => {
        expect(el.textContent).not.toContain('*');
        expect(within(el).queryByRole('button')).not.toBeInTheDocument();
      });
    });

    it('resolves unmasked mobile number when backend list returns masked phone', async () => {
      const maskedCustomer: Customer = {
        id: 'C-MASKED-01',
        name: 'Dharma Raj',
        phone: undefined,
        maskedPhone: '+91 ***** *****',
        unmaskedPhone: '+91 70321 33135',
        maskedEmail: 'd*****@example.com',
        locality: 'Hyderabad',
        registeredDate: '2026-11-27T10:16:00Z',
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        totalBookings: 0,
      };

      vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue({
        items: [maskedCustomer],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<CustomersListPage />, '/customers');

      expect(await screen.findByText('Dharma Raj')).toBeInTheDocument();
      expect(screen.getByText('+91 70321 33135')).toBeInTheDocument();
      expect(screen.queryByText(/\+91 \*{5} \*{5}/)).not.toBeInTheDocument();
    });
  });

  describe('3. Mobile Search Responsiveness', () => {
    it('searches workers by mobile and renders matching results with full unmasked number', async () => {
      const user = userEvent.setup();
      vi.spyOn(workerRepository, 'getWorkersPage').mockImplementation(async (filter) => {
        if (filter?.searchTerm === '98765') {
          return {
            items: [mockWorkersForTest[0]],
            total: 1,
            page: 1,
            limit: 20,
            hasMore: false,
          };
        }
        return {
          items: mockWorkersForTest,
          total: mockWorkersForTest.length,
          page: 1,
          limit: 20,
          hasMore: false,
        };
      });

      renderWithProviders(<WorkersListPage />, '/workers');

      expect(await screen.findByText('Suresh Kumar')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/search by worker name, mobile, or id/i);
      await user.type(searchInput, '98765');

      await waitFor(() => {
        expect(screen.getByText('Suresh Kumar')).toBeInTheDocument();
        expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      });
    });
  });
});
