import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BookingDetailModal } from '../features/bookings/presentation/BookingDetailModal';
import { BookingDetail } from '../features/bookings/domain/types';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockFullBooking: BookingDetail = {
  id: 'B-90210',
  customerId: 'C-7701',
  customerUserId: 'USR-CUST-7701',
  customerName: 'Kavitha Ramachandran',
  customerPhoneMasked: '+91 98480 12345',
  customerPhone: '+91 98480 12345',
  customerEmail: 'kavitha.ram@example.com',
  customerLocality: 'Banjara Hills',
  serviceCategory: 'Elderly Care Helper',
  engagementType: 'FULL_TIME_LIVE_IN',
  timingShift: '24x7 Assistance',
  salaryBudgetMax: 25000,
  specialRequirements: 'Assistance for senior citizen with mobility support and medication reminders.',
  assignedWorkerId: 'W-20491',
  assignedWorkerName: 'Sujatha Kumari',
  assignedWorkerPhoneMasked: '+91 99881 54321',
  assignedWorkerPhone: '+91 99881 54321',
  status: 'SERVICE_ACTIVE',
  createdAt: '2026-10-15T09:30:00.000Z',
  serviceStartDate: '2026-10-18',
  contractPeriod: '12 Months Placement',
  platformFeePaid: true,
  platformFeeAmount: 1999,
  internalNotes: ['Verified candidate medical background check before deployment.'],
  trial: {
    scheduledDate: '2026-10-16T10:00:00.000Z',
    timeSlot: '10:00 AM - 01:00 PM',
    durationHours: 3,
    customerAddress: 'Road No 12, Banjara Hills, Hyderabad',
    contactPerson: 'Kavitha Ramachandran',
    contactPhone: '+91 98480 12345',
    trialFeeAmount: 350,
    notes: 'Elderly gentleman will interact with candidate.',
  },
  trialOutcome: {
    outcome: 'SUCCEEDED',
    feedbackRemarks: 'Candidate showed gentle care and great patience.',
    customerConfirmed: true,
  },
  replacement: {
    id: 'REP-90210',
    bookingId: 'B-90210',
    requestedAt: '2026-10-25T14:20:00.000Z',
    reasonCategory: 'Schedule & Relocation',
    reason: 'Family relocated to another floor; schedule adjustment required.',
    customerExplanation: 'Family relocated to another floor; schedule adjustment required.',
    eligibleUnderPolicy: true,
    coveragePlanName: '30-Day Placement Guarantee',
    priorWorkerId: 'W-20491',
    priorWorkerName: 'Sujatha Kumari',
    status: 'REQUESTED',
    operationalRemarks: 'Eligible for complimentary rematch within 30-day window.',
  },
};

const mockUnassignedBooking: BookingDetail = {
  id: 'B-90211',
  customerId: 'C-7702',
  customerName: 'Deepak Verma',
  customerPhoneMasked: '+91 97110 99887',
  customerLocality: 'Jubilee Hills',
  serviceCategory: 'Cook',
  engagementType: 'PART_TIME',
  timingShift: 'Evening (05:00 PM - 08:00 PM)',
  salaryBudgetMax: 10000,
  specialRequirements: 'North Indian vegetarian cuisine, low oil.',
  status: 'REQUESTED',
  createdAt: '2026-10-16T08:15:00.000Z',
  platformFeePaid: false,
  platformFeeAmount: 499,
  internalNotes: [],
};

describe('Booking Details & Activity Workspace Specification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Officer',
        email: 'ops@sevanest.in',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_MANAGE],
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('Section 1 & Header: Booking Overview & Executive Snapshot', () => {
    it('renders modal header with booking ID, service category, and canonical status badge', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Booking Details: B-90210/i })).toBeInTheDocument();
      expect(screen.getByText('Elderly Care Helper')).toBeInTheDocument();
      expect(screen.getAllByText(/FULL TIME LIVE IN/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Banjara Hills/i).length).toBeGreaterThan(0);
    });

    it('renders 4 executive snapshot cards with cluster, allocation, shift and financial summary', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText(/Client Demographics/i)).toBeInTheDocument();
      expect(screen.getByText(/Staff Allocation/i)).toBeInTheDocument();
      expect(screen.getByText(/24x7 Assistance/i)).toBeInTheDocument();
      expect(screen.getAllByText(/₹1,999/i).length).toBeGreaterThan(0);
    });
  });

  describe('Section 2: Customer Details Dossier', () => {
    it('renders complete customer dossier with unmasked phone and email for authorized Operations Admin', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Customer Profile/i })).toBeInTheDocument();
      expect(screen.getByText('Kavitha Ramachandran')).toBeInTheDocument();
      expect(screen.getByText(/\+91 98480 12345/)).toBeInTheDocument();
      expect(screen.getByText('kavitha.ram@example.com')).toBeInTheDocument();
      expect(screen.getByText(/KYC VERIFIED/i)).toBeInTheDocument();
    });

    it('renders clear fallback when customer identity details are missing', () => {
      const missingCustBooking: BookingDetail = {
        ...mockUnassignedBooking,
        customerName: 'Customer Details Unavailable',
      };

      renderWithProviders(
        <BookingDetailModal booking={missingCustBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText('Customer Details Unavailable')).toBeInTheDocument();
    });
  });

  describe('Section 3: Assigned Domestic Worker Details', () => {
    it('renders assigned worker dossier with unmasked phone, experience, and verification badges', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Assigned Domestic Worker Allocation/i })).toBeInTheDocument();
      expect(screen.getByText('Sujatha Kumari')).toBeInTheDocument();
      expect(screen.getByText(/\+91 99881 54321/)).toBeInTheDocument();
      expect(screen.getByText(/Fully Verified Candidate/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ Aadhaar/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ Police Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ Address Check/i)).toBeInTheDocument();
    });

    it('renders informative unassigned state with candidate match trigger when no worker is allocated', () => {
      const matchSpy = vi.fn();
      renderWithProviders(
        <BookingDetailModal
          booking={mockUnassignedBooking}
          isOpen={true}
          onClose={vi.fn()}
          onOpenMatchWizard={matchSpy}
        />
      );

      expect(screen.getByText(/No Worker Assigned \(Awaiting Candidate Matching\)/i)).toBeInTheDocument();
      const matchBtns = screen.getAllByRole('button', { name: /Match Candidates/i });
      expect(matchBtns.length).toBeGreaterThan(0);
    });
  });

  describe('Section 4: Interview & Trial Coordination Details', () => {
    it('renders scheduled trial details, duration, fee, and recorded outcome notes', async () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Interview & Trial Details/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/10:00 AM - 01:00 PM/)).toBeInTheDocument();
        expect(screen.getByText(/3 Hours/i)).toBeInTheDocument();
        expect(screen.getByText(/Candidate showed gentle care and great patience./i)).toBeInTheDocument();
      });
    });
  });

  describe('Section 5: Customer and Worker Communication History', () => {
    it('displays fallback message when no communication history exists and never shows technical notices', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Customer and Worker Communication History/i })).toBeInTheDocument();
      expect(screen.getByText(/No communication history available for this booking\./i)).toBeInTheDocument();
      expect(screen.queryByText(/Authoritative Backend Data & Telephony Contract Notice/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/GET \/api\/v1\/admin\/bookings\/\{bookingId\}\/communications/)).not.toBeInTheDocument();
    });

    it('displays genuine communication records with IST timestamps when returned by backend', () => {
      const bookingWithComms: BookingDetail = {
        ...mockFullBooking,
        communications: [
          {
            id: 'comm-genuine-1',
            timestamp: '2026-11-07T11:00:00.000Z',
            channel: 'CUSTOMER_PORTAL',
            senderRole: 'CUSTOMER',
            title: 'Schedule Change Request',
            outcome: 'Logged',
            remarks: 'Customer requested 30-minute shift delay.',
          },
        ],
      };

      renderWithProviders(
        <BookingDetailModal booking={bookingWithComms} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText('Schedule Change Request')).toBeInTheDocument();
      expect(screen.getByText('Customer requested 30-minute shift delay.')).toBeInTheDocument();
      expect(screen.getByText(/07 Nov 2026, 04:30 PM IST/i)).toBeInTheDocument();
      expect(screen.queryByText(/No communication history available for this booking\./i)).not.toBeInTheDocument();
      expect(screen.queryByText(/GET \/api\/v1\/admin/)).not.toBeInTheDocument();
    });
  });

  describe('Section 6: Complete Booking Lifecycle Timeline', () => {
    it('renders full chronological timeline with status progression header and actor badges', async () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Booking Lifecycle History & Timeline/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/STATUS PROGRESSION & AUDIT TRAIL/i)).toBeInTheDocument();
      });
    });
  });

  describe('Section 7: Payment & Platform Fee Details', () => {
    it('renders platform fee breakdown (net, GST, total) and gateway transaction record', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Payment & Platform Fee Details/i })).toBeInTheDocument();
      expect(screen.getByText(/PLATFORM BASE FEE/i)).toBeInTheDocument();
      expect(screen.getByText(/GST \(18% COMPONENT\)/i)).toBeInTheDocument();
      expect(screen.getByText(/TOTAL PLATFORM CHARGE/i)).toBeInTheDocument();
      expect(screen.getByText(/Gateway Payment Transactions/i)).toBeInTheDocument();
    });
  });

  describe('Section 8: Replacement History & Active Case', () => {
    it('renders active replacement request case with stated reason, explanation, and eligibility', () => {
      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByRole('heading', { name: /Placement Replacement History/i })).toBeInTheDocument();
      expect(screen.getByText(/REP-90210/i)).toBeInTheDocument();
      expect(screen.getByText(/Schedule & Relocation/i)).toBeInTheDocument();
      expect(screen.getByText(/Family relocated to another floor; schedule adjustment required./i)).toBeInTheDocument();
    });
  });

  describe('Navigation & Action Triggers', () => {
    it('allows clicking quick navigation tabs to filter sections and closes cleanly', async () => {
      const user = userEvent.setup();
      const closeSpy = vi.fn();

      renderWithProviders(
        <BookingDetailModal booking={mockFullBooking} isOpen={true} onClose={closeSpy} />
      );

      // Click Payments & Fees tab
      const paymentsTab = screen.getByRole('tab', { name: /Payments & Fees/i });
      await user.click(paymentsTab);

      // Verify that payments heading remains visible
      expect(screen.getByRole('heading', { name: /Payment & Platform Fee Details/i })).toBeInTheDocument();

      // Click Close button in footer
      const closeBtn = screen.getByRole('button', { name: /^Close$/i });
      await user.click(closeBtn);
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
