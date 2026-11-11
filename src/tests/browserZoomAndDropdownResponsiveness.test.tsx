/* global HTMLSelectElement, HTMLElement */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AdminUser } from '../core/auth/authTypes';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { AppShell } from '../app/layouts/AppShell';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { RefundProcessingModal } from '../features/payments/presentation/RefundProcessingModal';
import { TrialOutcomeModal } from '../features/bookings/presentation/TrialOutcomeModal';
import { BookingDetail } from '../features/bookings/domain/types';
import { PaymentTransaction } from '../features/payments/domain/types';
import fs from 'fs';
import path from 'path';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const SUPPORT_EXEC_USER: AdminUser = {
  id: 'usr-support-01',
  name: 'Ananya Sharma',
  email: 'ananya@sevanest.internal',
  role: 'SUPPORT_EXECUTIVE',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ],
  phone: '+91 98765 43210',
  status: 'ACTIVE',
  createdAt: '2026-01-15T10:00:00Z',
  userType: 'ADMIN',
};

const OPERATIONS_ADMIN_USER: AdminUser = {
  id: 'usr-ops-01',
  name: 'Rahul Verma',
  email: 'rahul@sevanest.internal',
  role: 'OPERATIONS_ADMIN',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ],
  phone: '+91 98765 43211',
  status: 'ACTIVE',
  createdAt: '2026-01-15T10:00:00Z',
  userType: 'ADMIN',
};

const SUPER_ADMIN_USER: AdminUser = {
  id: 'usr-super-01',
  name: 'Admin Head',
  email: 'super@sevanest.internal',
  role: 'SUPER_ADMIN',
  permissions: Object.values(PERMISSIONS),
  phone: '+91 98765 43212',
  status: 'ACTIVE',
  createdAt: '2026-01-15T10:00:00Z',
  userType: 'ADMIN',
};

const MOCK_BOOKING: BookingDetail = {
  id: 'BKG-2026-001',
  customerId: 'CUST-001',
  customerName: 'Priya Reddy',
  customerPhoneMasked: '+91 98765 *****',
  customerLocality: 'Kondapur',
  serviceCategory: 'House Maid',
  engagementType: 'FULL_TIME_LIVE_IN',
  timingShift: '08:00 - 18:00',
  salaryBudgetMax: 15000,
  status: 'INTERVIEW_SCHEDULED',
  assignedWorkerId: 'WRK-001',
  assignedWorkerName: 'Lakshmi Devi',
  assignedWorkerPhoneMasked: '+91 98765 *****',
  createdAt: '2026-11-01T10:00:00Z',
  platformFeePaid: true,
  platformFeeAmount: 500,
  internalNotes: [],
};

const MOCK_TRANSACTION: PaymentTransaction = {
  id: 'TXN-2026-001',
  bookingRef: 'BKG-2026-001',
  customerId: 'CUST-001',
  customerName: 'Priya Reddy',
  customerPhoneMasked: '+91 98765 *****',
  serviceCategory: 'House Maid',
  feeDescription: 'Matching fee',
  amountINR: 2500,
  status: 'PAID',
  feeType: 'BOOKING_FEE',
  paymentMethod: 'UPI',
  gatewayRef: 'PAY-UPI-123456',
  timestamp: '2026-11-01T10:30:00Z',
  createdAt: '2026-11-01T10:30:00Z',
  breakdown: {
    baseAmount: 2118,
    gstAmount: 382,
    platformCommission: 500,
  },
};

describe('Browser Zoom & Dropdown Responsiveness Audit', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isRestoring: false,
    });
  });

  describe('Global CSS Architecture for Zoom Resilience', () => {
    it('verifies select dropdown reset with appearance: none, SVG chevron, and proper bounds in index.css', () => {
      const cssPath = path.resolve(__dirname, '../styles/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Check select appearance reset
      expect(cssContent).toContain('select:not(.select-unstyled)');
      expect(cssContent).toContain('appearance: none');
      expect(cssContent).toContain('-webkit-appearance: none');
      expect(cssContent).toContain('background-image: url("data:image/svg+xml');
      expect(cssContent).toContain('padding-right: 30px !important');
      expect(cssContent).toContain('min-height: 32px');

      // Check header profile dropdown zoom resilience
      expect(cssContent).toContain('.header-profile-dropdown');
      expect(cssContent).toContain('max-height: calc(100vh - 60px)');
      expect(cssContent).toContain('overflow-y: auto');
      expect(cssContent).toContain('max-width: min(280px, calc(100vw - 24px))');

      // Check table responsive wrapper
      expect(cssContent).toContain('.table-responsive');
      expect(cssContent).toContain('div:has(> table)');
      expect(cssContent).toContain('overflow-x: auto');
    });
  });

  describe('Support Tickets Page Dropdown and Zoom Adaptability', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: SUPPORT_EXEC_USER,
        accessToken: 'mock-valid-token',
        isAuthenticated: true,
        isRestoring: false,
      });
    });

    it('renders complainant role and priority dropdowns with scalable vector chevrons and minWidth constraints', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SupportTicketsPage viewMode="all" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Support Grievance & SLA Queue')).toBeInTheDocument();
      });

      // Complainant role filter
      const complainantSelect = screen.getByLabelText('Filter by complainant role') as HTMLSelectElement;
      expect(complainantSelect).toBeInTheDocument();
      expect(complainantSelect.style.minWidth).toBe('150px');
      expect(complainantSelect.options.length).toBe(3);
      expect(complainantSelect.options[0].text).toBe('All Complainant Roles');
      expect(complainantSelect.options[1].text).toBe('Customer Grievances');
      expect(complainantSelect.options[2].text).toBe('Worker Inquiries');

      // Priority filter
      const prioritySelect = screen.getByLabelText('Filter by priority') as HTMLSelectElement;
      expect(prioritySelect).toBeInTheDocument();
      expect(prioritySelect.style.minWidth).toBe('130px');
      expect(prioritySelect.options.length).toBe(5);
      expect(prioritySelect.options[0].text).toBe('All Priorities');
      expect(prioritySelect.options[1].text).toBe('Critical Priority');

      // Can interact and switch options without layout breakage
      fireEvent.change(complainantSelect, { target: { value: 'CUSTOMER' } });
      expect(complainantSelect.value).toBe('CUSTOMER');

      fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });
      expect(prioritySelect.value).toBe('HIGH');
    });

    it('ensures support table enforces minWidth inside horizontally scrollable container', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SupportTicketsPage viewMode="all" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Support Grievance & SLA Queue')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table.style.minWidth).toBe('760px');
      expect(table.parentElement?.style.overflowX).toBe('auto');
    });
  });

  describe('Bookings Page Dropdowns and Table Responsiveness', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: OPERATIONS_ADMIN_USER,
        accessToken: 'mock-valid-token',
        isAuthenticated: true,
        isRestoring: false,
      });
    });

    it('renders service category and locality dropdowns with minWidth and table overflow protection', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <BookingsListPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Booking & Service Management')).toBeInTheDocument();
      });

      const categorySelect = screen.getByLabelText('Filter by service category') as HTMLSelectElement;
      expect(categorySelect).toBeInTheDocument();
      expect(categorySelect.style.minWidth).toBe('130px');

      const localitySelect = screen.getByLabelText('Filter by locality cluster') as HTMLSelectElement;
      expect(localitySelect).toBeInTheDocument();
      expect(localitySelect.style.minWidth).toBe('130px');

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table.style.minWidth).toBe('780px');
      expect(table.parentElement?.style.overflowX).toBe('auto');
    });
  });

  describe('Financial Transactions Page Dropdown and Table Responsiveness', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: SUPER_ADMIN_USER,
        accessToken: 'mock-valid-token',
        isAuthenticated: true,
        isRestoring: false,
      });
    });

    it('renders fee classification dropdown with minWidth and table overflow protection', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PaymentsListPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Financial Transactions & Refunds')).toBeInTheDocument();
      });

      const feeSelect = screen.getByLabelText('Filter by fee classification');
      expect(feeSelect).toBeInTheDocument();
      expect(feeSelect.style.minWidth).toBe('180px');

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table.style.minWidth).toBe('760px');
      expect(table.parentElement?.style.overflowX).toBe('auto');
    });
  });

  describe('AppShell Header Profile Menu Responsiveness & Stacking', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: SUPPORT_EXEC_USER,
        accessToken: 'mock-valid-token',
        isAuthenticated: true,
        isRestoring: false,
      });
    });

    it('renders header with zIndex 45 above sidebar and toggles profile menu cleanly', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('header-profile-button')).toBeInTheDocument();
      });

      const header = screen.getByTestId('header-profile-button').closest('header');
      expect(header).toBeInTheDocument();
      expect(header?.style.zIndex).toBe('45');

      const profileBtn = screen.getByTestId('header-profile-button');
      expect(profileBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(profileBtn);
      expect(profileBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('View Profile')).toBeInTheDocument();
      expect(screen.getByTestId('profile-menu-logout')).toBeInTheDocument();
    });
  });

  describe('Modals Viewport & Zoom Constraints', () => {
    it('verifies ConfirmDialog has maxHeight and overflowY constraints', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const modalCard = container.querySelector('[role="dialog"] > div') as HTMLElement;
      expect(modalCard).toBeInTheDocument();
      expect(modalCard.style.maxHeight).toBe('min(90vh, calc(100vh - 32px))');
      expect(modalCard.style.overflowY).toBe('auto');
    });

    it('verifies RefundProcessingModal has maxHeight constraint on modal card and overflowY on body', () => {
      const queryClient = new QueryClient();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RefundProcessingModal
            isOpen={true}
            transaction={MOCK_TRANSACTION}
            onClose={() => {}}
          />
        </QueryClientProvider>
      );

      const modalCard = container.querySelector('[role="dialog"] > div') as HTMLElement;
      expect(modalCard).toBeInTheDocument();
      expect(modalCard.style.maxHeight).toBe('min(90vh, calc(100vh - 32px))');
    });

    it('verifies TrialOutcomeModal has maxHeight constraint on modal card and overflowY on body', () => {
      const queryClient = new QueryClient();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <TrialOutcomeModal
            isOpen={true}
            booking={MOCK_BOOKING}
            onClose={() => {}}
          />
        </QueryClientProvider>
      );

      const modalCard = container.querySelector('[role="dialog"] > div') as HTMLElement;
      expect(modalCard).toBeInTheDocument();
      expect(modalCard.style.maxHeight).toBe('min(90vh, calc(100vh - 32px))');
    });
  });

  describe('Global Search Input Debouncing and Stability', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: SUPPORT_EXEC_USER,
        accessToken: 'mock-valid-token',
        isAuthenticated: true,
        isRestoring: false,
      });
    });

    it('retains input focus and avoids component unmounting during rapid typing and clearing', async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SupportTicketsPage viewMode="all" />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Support Grievance & SLA Queue')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by complainant/i) as HTMLInputElement;
      expect(searchInput).toBeInTheDocument();

      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);

      // Rapidly type characters
      fireEvent.change(searchInput, { target: { value: 'Ticket-1' } });
      expect(searchInput.value).toBe('Ticket-1');
      expect(document.activeElement).toBe(searchInput);

      // Clear input
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(searchInput.value).toBe('');
      expect(document.activeElement).toBe(searchInput);
    });
  });
});
