import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { OperationsAdminDashboard } from '../features/dashboard/presentation/OperationsAdminDashboard';
import { customerRepository } from '../features/customers/data/customerRepository';
import { CustomerDetailModal } from '../features/customers/presentation/CustomerDetailModal';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { WorkerDetailModal } from '../features/workers/presentation/WorkerDetailModal';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { CandidateMatchingModal } from '../features/bookings/presentation/CandidateMatchingModal';
import { BookingDetailModal } from '../features/bookings/presentation/BookingDetailModal';
import { TransactionDetailModal } from '../features/payments/presentation/TransactionDetailModal';
import { TicketDetailModal } from '../features/support/presentation/TicketDetailModal';

const LIVE_OPS_ADMIN_PERMISSIONS = [
  PERMISSIONS.ALERT_VIEW,
  PERMISSIONS.ALERT_MANAGE,
  PERMISSIONS.AREA_MANAGE,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.BOOKINGS_VIEW,
  PERMISSIONS.BOOKINGS_MANAGE,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.MATCHING_RUN,
  PERMISSIONS.NOTIFICATION_MANAGE,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.RATING_VIEW,
  PERMISSIONS.RATING_MODERATE,
  PERMISSIONS.REPLACEMENT_VIEW,
  PERMISSIONS.REPLACEMENT_MANAGE,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.SUPPORT_VIEW,
  'user.view',
  PERMISSIONS.VERIFICATION_REASSIGN,
  PERMISSIONS.VERIFICATION_SIGNOFF,
  PERMISSIONS.WORKER_ACTIVATE,
  PERMISSIONS.WORKER_MANAGE,
  PERMISSIONS.WORKER_VIEW,
];

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Operations Admin Extended Workflows (Alerts, Governance, Matching, Attendance, Boundaries)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'ops-mgr-01',
        name: 'Operations Manager',
        email: 'operations.manager@sevanest.example.com',
        role: 'OPERATIONS_ADMIN',
        permissions: LIVE_OPS_ADMIN_PERMISSIONS,
      },
      'ops-jwt-token'
    );
  });

  describe('1. Operational Alerts Triage Drawer', () => {
    it('opens alerts drawer from dashboard and supports Acknowledge and Resolve with note', async () => {
      const user = userEvent.setup();
      vi.spyOn(dashboardRepository, 'getOperationsAdminDashboard').mockResolvedValue({
        kpis: {
          pendingVerifications: 4,
          requestedBookings: 3,
          activeEngagements: 10,
          replacementRequests: 2,
          openGrievances: 1,
          openAlerts: 2,
          alertSeverityCounts: { high: 1, medium: 1, low: 0, critical: 0 },
        },
        openAlertsSummary: [],
        bookingPipeline: [],
        workerUtilizationByCategory: [],
        replacementBreakdown: [],
      } as never);

      vi.spyOn(dashboardRepository as Required<typeof dashboardRepository>, 'getOperationalAlerts').mockResolvedValue({
        items: [
          {
            id: 'ALT-101',
            type: 'BOOKING_RESPOND_BY_BREACH',
            severity: 'WARNING',
            status: 'OPEN',
            title: 'Booking response SLA breached',
            detail: { note: 'Booking B-9001 awaiting worker response beyond SLA.' },
            occurrences: 1,
            entityType: 'booking',
            entityId: 'B-9001',
            createdAt: '2026-11-12T08:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      });
      const ackSpy = vi.spyOn(dashboardRepository as Required<typeof dashboardRepository>, 'acknowledgeAlert').mockResolvedValue();
      const resolveSpy = vi.spyOn(dashboardRepository as Required<typeof dashboardRepository>, 'resolveAlert').mockResolvedValue();

      renderWithProviders(<OperationsAdminDashboard />);

      const triageBtn = await screen.findByRole('button', { name: /Triage All Alerts/i });
      await user.click(triageBtn);

      expect(await screen.findByText(/Operational Alerts Triage Queue/i)).toBeInTheDocument();
      expect(await screen.findByText('Booking response SLA breached')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^Acknowledge$/i }));
      await waitFor(() => expect(ackSpy).toHaveBeenCalledWith('ALT-101'));

      await user.click(screen.getByRole('button', { name: /^Resolve$/i }));
      const remarks = await screen.findByPlaceholderText(/Enter resolution note/i);
      await user.type(remarks, 'Coordinated backup worker directly.');
      await user.click(screen.getByRole('button', { name: /Resolve Alert/i }));

      await waitFor(() => {
        expect(resolveSpy).toHaveBeenCalledWith('ALT-101', 'Coordinated backup worker directly.');
      });
    });
  });

  describe('2. Customer Verification Governance', () => {
    it('renders verification status toggle when customer.manage is held and calls repository', async () => {
      const user = userEvent.setup();
      vi.spyOn(customerRepository, 'getCustomerById').mockResolvedValue({
        id: 'CUST-1',
        name: 'Ananya Verma',
        phoneMasked: '+91 98*** **100',
        locality: 'Kondapur',
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        activeBookingsCount: 1,
        totalBookingsCount: 2,
        totalSpendINR: 1500,
        registeredAt: '2026-11-01T10:00:00.000Z',
        activeBookings: [],
        complaints: [],
        notes: [],
        bookings: [],
      } as never);
      const verifySpy = vi.spyOn(customerRepository, 'updateCustomerVerificationStatus').mockResolvedValue();

      renderWithProviders(<CustomerDetailModal customerId="CUST-1" onClose={() => { }} />);

      const verifyBtn = await screen.findByRole('button', { name: /Mark Customer Verified/i });
      await user.click(verifyBtn);

      const noteInput = await screen.findByPlaceholderText(/Enter operational verification note/i);
      await user.type(noteInput, 'Verified address via callback');
      const confirmBtn = await screen.findByRole('button', { name: /Confirm Verified/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith('CUST-1', 'VERIFIED', 'Verified address via callback');
      });
    });
  });

  describe('3. Worker Operations Governance (Availability, Ratings, No 403 Dossier Fetch)', () => {
    it('skips 403 dossier fetch without verification.review and updates availability & moderates rating', async () => {
      const user = userEvent.setup();
      const dossierSpy = vi.spyOn(verificationRepository, 'getDossierById');
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValue({
        id: 'WRK-1',
        name: 'Lakshmi Devi',
        category: 'Cook',
        categories: ['Cook'],
        experienceYears: 5,
        ratingAverage: 4.5,
        totalReviews: 2,
        locality: 'Madhapur',
        serviceRadiusKm: 8,
        languages: ['Hindi', 'Telugu'],
        bio: 'Experienced cook',
        isFullyVerified: false,
        verificationStatus: 'PENDING',
        applicationStatus: 'UNDER_REVIEW',
        status: 'ACTIVE',
        onboardingStatus: 'SUBMITTED',
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'VERIFIED',
          addressProofStatus: 'VERIFIED',
          criminalRecordStatus: 'VERIFIED',
          skillProofStatus: 'VERIFIED',
          referenceCheckStatus: 'VERIFIED',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 1,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
        documents: [],
      } as never);
      vi.spyOn(workerRepository as Required<typeof workerRepository>, 'getServiceCategoriesCatalog').mockResolvedValue([
        { id: 'cat-1', code: 'COOK', name: 'Cook' },
      ]);
      vi.spyOn(workerRepository as Required<typeof workerRepository>, 'getServiceAreasCatalog').mockResolvedValue([
        { id: 'area-1', code: 'MADHAPUR', name: 'Madhapur', city: 'Hyderabad' },
      ]);
      const availSpy = vi.spyOn(workerRepository as Required<typeof workerRepository>, 'updateWorkerAvailability').mockResolvedValue(null);
      const catsSpy = vi.spyOn(workerRepository, 'updateWorkerCategories').mockResolvedValue();
      vi.spyOn(workerRepository as Required<typeof workerRepository>, 'getWorkerRatings').mockResolvedValue([
        {
          id: 'RAT-1',
          bookingId: 'B-1',
          workerId: 'WRK-1',
          score: 5,
          review: 'Very punctual and hygienic.',
          tags: ['Punctual'],
          status: 'VISIBLE',
          createdAt: '2026-11-10T10:00:00.000Z',
        },
      ]);
      const modSpy = vi.spyOn(workerRepository as Required<typeof workerRepository>, 'moderateRating').mockResolvedValue();

      renderWithProviders(<WorkerDetailModal workerId="WRK-1" onClose={() => { }} readOnly={true} />);

      expect(await screen.findByText('Very punctual and hygienic.')).toBeInTheDocument();
      // Verification dossier query must NOT fire when Ops Admin lacks verification.review
      expect(dossierSpy).not.toHaveBeenCalled();

      // Update Availability & Categories
      await user.click(screen.getByRole('button', { name: /Edit Availability & Categories/i }));
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(availSpy).toHaveBeenCalledWith(
          'WRK-1',
          expect.objectContaining({ engagementPreference: 'FULL_TIME' })
        );
      });
      expect(catsSpy).toHaveBeenCalledWith('WRK-1', ['cat-1']);

      // Hide rating with mandatory reason + destructive confirmation checkbox
      await user.click(screen.getByRole('button', { name: /Hide Review/i }));
      const reasonInput = await screen.findByPlaceholderText(/Enter moderation reason/i);
      await user.type(reasonInput, 'Contains personal phone number');
      const dialogs = await screen.findAllByRole('dialog');
      const modDialog = dialogs[dialogs.length - 1];
      const destructiveCheckbox = within(modDialog).getByTestId('confirm-destructive-checkbox');
      await user.click(destructiveCheckbox);
      await user.click(within(modDialog).getByRole('button', { name: /Hide Review/i }));

      await waitFor(() => {
        expect(modSpy).toHaveBeenCalledWith('RAT-1', 'hide', 'Contains personal phone number');
      });
    });
  });

  describe('4. Booking State Machine, ISO Matching & Attendance Tracking', () => {
    it('submits valid ISO 8601 datetime on trial schedule and supports direct match assignment', async () => {
      const user = userEvent.setup();
      vi.spyOn(bookingRepository, 'getCandidateSuggestions').mockResolvedValue([
        {
          workerId: 'WRK-CAND-1',
          workerName: 'Radha Bai',
          category: 'Babysitter',
          experienceYears: 4,
          locality: 'Kondapur',
          isFullyVerified: true,
          languages: ['Hindi', 'Telugu'],
        },
      ]);
      const scheduleSpy = vi.spyOn(bookingRepository, 'scheduleTrial').mockResolvedValue();
      const assignSpy = vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'assignMatchedWorker').mockResolvedValue();

      const booking = {
        id: 'B-ISO-1',
        customerId: 'C-1',
        customerName: 'Priya Menon',
        customerPhoneMasked: '+91 98*** **321',
        customerLocality: 'Kondapur',
        serviceCategory: 'Babysitter',
        engagementType: 'PART_TIME' as const,
        timingShift: '08:00 - 14:00',
        salaryBudgetMax: 10000,
        specialRequirements: '',
        status: 'REQUESTED' as const,
        createdAt: '2026-11-11T09:00:00.000Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
        areaId: '01a12ead-add8-75cf-b344-9a1e4e2c44cb',
        categoryCode: 'BABYSITTER',
        availableFrom: '08:00',
        availableTo: '14:00',
      };

      renderWithProviders(
        <CandidateMatchingModal booking={booking} isOpen={true} onClose={() => { }} />
      );

      await user.click(await screen.findByText('Radha Bai'));

      // Direct Match assignment
      await user.click(screen.getByRole('button', { name: /Assign Matched Worker/i }));
      expect(assignSpy).toHaveBeenCalledWith('B-ISO-1', 'WRK-CAND-1', undefined);

      // Schedule trial with valid ISO datetime
      await user.click(screen.getByRole('button', { name: /Confirm Trial Schedule/i }));
      await waitFor(() => {
        expect(scheduleSpy).toHaveBeenCalledWith(
          'B-ISO-1',
          'WRK-CAND-1',
          expect.objectContaining({
            scheduledDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            scheduleType: 'TRIAL',
          })
        );
      });
    });

    it('renders state-accurate booking row buttons and records/corrects attendance in BookingDetailModal', async () => {
      const user = userEvent.setup();
      vi.spyOn(bookingRepository, 'getBookings').mockResolvedValue({
        items: [
          {
            id: 'B-M1',
            customerId: 'C1',
            customerName: 'Ramesh Nair',
            customerPhoneMasked: '+91 98*** **001',
            customerLocality: 'Kondapur',
            serviceCategory: 'Cook',
            engagementType: 'FULL_TIME_LIVE_OUT',
            timingShift: '08:00 - 12:00',
            salaryBudgetMax: 9000,
            specialRequirements: '',
            status: 'CONFIRMED',
            createdAt: '2026-11-10T10:00:00.000Z',
            platformFeePaid: true,
            platformFeeAmount: 499,
            internalNotes: [],
          },
          {
            id: 'B-M2',
            customerId: 'C2',
            customerName: 'Kavya Iyer',
            customerPhoneMasked: '+91 98*** **002',
            customerLocality: 'Madhapur',
            serviceCategory: 'Driver',
            engagementType: 'FULL_TIME_LIVE_OUT',
            timingShift: '09:00 - 18:00',
            salaryBudgetMax: 16000,
            specialRequirements: '',
            status: 'SERVICE_ACTIVE',
            createdAt: '2026-11-09T10:00:00.000Z',
            platformFeePaid: true,
            platformFeeAmount: 499,
            internalNotes: [],
          },
        ],
        totalCount: 2,
        page: 1,
        pageSize: 6,
        totalPages: 1,
      });
      const startSpy = vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'startService').mockResolvedValue();
      const completeSpy = vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'completeBooking').mockResolvedValue();

      renderWithProviders(<BookingsListPage />);

      const startBtn = await screen.findByRole('button', { name: /Start Service/i });
      const completeBtn = await screen.findByRole('button', { name: /^Complete$/i });

      await user.click(startBtn);
      expect(startSpy).toHaveBeenCalledWith('B-M1');

      await user.click(completeBtn);
      expect(completeSpy).toHaveBeenCalledWith('B-M2');

      // Now verify Attendance tab inside BookingDetailModal
      vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendance').mockResolvedValue([
        {
          id: 'ATT-1',
          bookingId: 'B-M2',
          workerId: 'W-1',
          date: '2026-11-11',
          status: 'ABSENT',
          note: 'Marked absent automatically',
        },
      ]);
      vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'getBookingAttendanceSummary').mockResolvedValue({
        bookingId: 'B-M2',
        month: '2026-11',
        presentDays: 10,
        absentDays: 1,
        lateDays: 0,
        exceptionDays: 0,
        leaveDays: 0,
      });
      const recordSpy = vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'recordBookingAttendance').mockResolvedValue();
      const correctSpy = vi.spyOn(bookingRepository as Required<typeof bookingRepository>, 'correctBookingAttendance').mockResolvedValue();

      renderWithProviders(
        <BookingDetailModal
          booking={{
            id: 'B-M2',
            customerId: 'C2',
            customerName: 'Kavya Iyer',
            customerPhoneMasked: '+91 98*** **002',
            customerLocality: 'Madhapur',
            serviceCategory: 'Driver',
            engagementType: 'FULL_TIME_LIVE_OUT',
            timingShift: '09:00 - 18:00',
            salaryBudgetMax: 16000,
            specialRequirements: '',
            status: 'SERVICE_ACTIVE',
            createdAt: '2026-11-09T10:00:00.000Z',
            platformFeePaid: true,
            platformFeeAmount: 499,
            internalNotes: [],
          }}
          isOpen={true}
          onClose={() => { }}
        />
      );

      const attTab = await screen.findByTestId('workspace-tab-attendance');
      await user.click(attTab);

      expect(await screen.findByText('Service Attendance & Daily Logs')).toBeInTheDocument();
      expect(await screen.findByText('Marked absent automatically')).toBeInTheDocument();

      // Record attendance
      await user.click(screen.getByRole('button', { name: /Record Attendance/i }));
      await user.click(screen.getByRole('button', { name: /Save Attendance/i }));
      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          'B-M2',
          expect.objectContaining({ status: 'PRESENT' })
        );
      });

      // Correct attendance
      await user.click(screen.getByRole('button', { name: /^Correct$/i }));
      const reasonInput = await screen.findByLabelText('Correction Reason');
      await user.type(reasonInput, 'Worker verified on site');
      await user.click(screen.getByRole('button', { name: /Save Correction/i }));
      await waitFor(() => {
        expect(correctSpy).toHaveBeenCalledWith(
          'ATT-1',
          expect.objectContaining({ reason: 'Worker verified on site' })
        );
      });
    });
  });

  describe('5. Payments & Support Boundaries', () => {
    it('hides Reconcile with Gateway without payment.manage and navigates on Support ticket booking link', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <TransactionDetailModal
          transaction={{
            id: 'TXN-1',
            bookingId: 'B-1',
            bookingRef: 'B-1',
            customerId: 'C-1',
            customerName: 'Ananya',
            customerPhoneMasked: '+91 98*** **001',
            serviceCategory: 'Cook',
            amountINR: 499,
            feeType: 'BOOKING_FEE',
            feeDescription: 'Booking Consultation Fee',
            paymentMethod: 'UPI',
            gatewayRef: 'pay_123',
            status: 'FAILED',
            timestamp: '2026-11-12T10:00:00.000Z',
            breakdown: {
              baseAmount: 423,
              gstAmount: 76,
              platformCommission: 0,
            },
          }}
          isOpen={true}
          onClose={() => { }}
          onInitiateRefund={() => { }}
          onReconcile={async () => { }}
        />
      );

      expect(screen.queryByRole('button', { name: /Reconcile with Gateway/i })).not.toBeInTheDocument();

      // Support Ticket Booking Cross-Link Navigation
      renderWithProviders(
        <Routes>
          <Route
            path="/"
            element={
              <TicketDetailModal
                ticket={{
                  id: 'TKT-1',
                  complainantId: 'CUST-1',
                  complainantName: 'Priya',
                  complainantType: 'CUSTOMER',
                  complainantPhoneMasked: '+91 98*** **001',
                  serviceCategory: 'House Maid',
                  disputeCategory: 'ATTENDANCE_BREACH',
                  description: 'Worker arrived late',
                  bookingRef: 'B-9991',
                  priority: 'HIGH',
                  slaStatus: 'NORMAL',
                  status: 'CREATED',
                  createdAt: '2026-11-12T08:00:00.000Z',
                  caseNotes: [],
                  messages: [],
                }}
                isOpen={true}
                onClose={() => { }}
              />
            }
          />
          <Route path="/bookings" element={<div>Bookings Route Reached</div>} />
        </Routes>,
        '/'
      );

      const bookingLink = await screen.findByRole('button', { name: 'B-9991' });
      await user.click(bookingLink);
      expect(await screen.findByText('Bookings Route Reached')).toBeInTheDocument();
    });
  });
});