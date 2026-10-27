/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpClient } from '../core/api/httpClient';
import {
  RealCustomerRepository,
  createCustomerRepository,
} from '../features/customers/data/customerRepository';
import {
  RealWorkerRepository,
  createWorkerRepository,
} from '../features/workers/data/workerRepository';
import {
  RealVerificationRepository,
  createVerificationRepository,
} from '../features/verification/data/verificationRepository';
import {
  RealBookingRepository,
  createBookingRepository,
} from '../features/bookings/data/bookingRepository';
import {
  RealPaymentRepository,
  createPaymentRepository,
} from '../features/payments/data/paymentRepository';
import {
  RealSupportRepository,
  createSupportRepository,
} from '../features/support/data/supportRepository';
import {
  RealReportRepository,
  createReportRepository,
} from '../features/reports/data/reportRepository';
import {
  RealDashboardRepository,
  createDashboardRepository,
} from '../features/dashboard/data/dashboardRepository';
import { DomainError } from '../core/errors/DomainError';

describe('Admin Portal — Full Backend Modules Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Customer Module Integration (RealCustomerRepository)', () => {
    it('fetches and maps customers with correct parameters and pagination', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'C-1092',
              fullName: 'Anand Sharma',
              phone: '9876543210',
              phoneMasked: '+91 98765 *****',
              email: 'anand@example.com',
              status: 'ACTIVE',
              locality: 'Kondapur',
              verificationStatus: 'VERIFIED',
              bookingCount: 3,
              createdAt: '2026-01-10T10:00:00Z',
            },
          ],
          meta: {
            totalItems: 1,
            currentPage: 1,
            itemsPerPage: 10,
            totalPages: 1,
          },
        },
      } as any);

      const repo = new RealCustomerRepository();
      const result = await repo.getCustomers({ searchTerm: '9876543210', status: 'ACTIVE' });

      expect(getSpy).toHaveBeenCalledWith('/admin/customers', {
        params: { mobile: '9876543210', verificationStatus: 'VERIFIED' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('C-1092');
      expect(result[0].name).toBe('Anand Sharma');
    });

    it('propagates domain errors without silent fallback on customer API failure', async () => {
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce({
        response: { status: 500, data: { message: 'Internal Server Error' } },
      });

      const repo = new RealCustomerRepository();
      await expect(repo.getCustomers()).rejects.toThrow();
    });

    it('suspends customer with mandatory operational remarks', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'C-1092',
          userId: 'usr-cust-1092',
          fullName: 'Anand Sharma',
        },
        headers: { etag: 'W/"etag-cust-1092"' },
      } as any);
      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValue({
        data: { success: true },
      } as any);

      const repo = new RealCustomerRepository();
      await repo.suspendCustomer('C-1092', 'Documents unclear');

      expect(patchSpy).toHaveBeenCalledWith('/admin/users/usr-cust-1092/status', {
        status: 'SUSPENDED',
        reason: 'Documents unclear',
      });
      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/customers/C-1092/verification-status',
        {
          status: 'PENDING',
          note: 'Documents unclear',
        },
        {
          headers: { 'If-Match': 'W/"etag-cust-1092"' },
        }
      );
    });
  });

  describe('Worker Module Integration (RealWorkerRepository)', () => {
    it('fetches worker directory with backend contract mapping', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'W-10482',
              fullName: 'Sunita Devi',
              phoneMasked: '+91 98765 *****',
              categories: ['House Maid'],
              locality: 'Kondapur',
              experienceYears: 6,
              verificationStatus: 'APPROVED',
              status: 'ACTIVE',
              createdAt: '2026-01-05T10:00:00Z',
            },
          ],
          meta: {
            totalItems: 1,
            currentPage: 1,
            itemsPerPage: 10,
            totalPages: 1,
          },
        },
      } as any);

      const repo = new RealWorkerRepository();
      const result = await repo.getWorkers({ searchTerm: 'Sunita', status: 'ACTIVE' });

      expect(getSpy).toHaveBeenCalledWith('/admin/workers', {
        params: { mobile: 'Sunita', verified: undefined, status: 'ACTIVE' },
      });
      expect(result[0].name).toBe('Sunita Devi');
      expect(result[0].isFullyVerified).toBe(false);
    });

    it('updates worker status via PATCH /admin/users/:userId/status', async () => {
      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealWorkerRepository();
      await repo.updateWorkerStatus('W-10482', 'SUSPENDED', 'Disciplinary reason');

      expect(patchSpy).toHaveBeenCalledWith('/admin/users/W-10482/status', {
        status: 'SUSPENDED',
        reason: 'Disciplinary reason',
      });
    });

    it('updates worker categories via PUT /admin/workers/:id/categories', async () => {
      const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealWorkerRepository();
      await repo.updateWorkerCategories('W-10482', ['COOK', 'HOUSE_MAID']);

      expect(putSpy).toHaveBeenCalledWith('/admin/workers/W-10482/categories', {
        categoryIds: ['COOK', 'HOUSE_MAID'],
      });
    });
  });

  describe('Verification Module Integration (RealVerificationRepository)', () => {
    it('fetches queue and claims dossier via start-review endpoint', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'VQ-101',
              workerId: 'W-10482',
              workerName: 'Sunita Devi',
              category: 'House Maid',
              status: 'PENDING_REVIEW',
            },
          ],
          meta: { totalItems: 1, currentPage: 1, itemsPerPage: 10, totalPages: 1 },
        },
      } as any);

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      const queue = await repo.getVerificationQueue();
      expect(queue.items[0].id).toBe('VQ-101');

      await repo.claimDossier('VQ-101', 'chk-identity-101');
      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-101/start-review');
    });

    it('approves, rejects, and rechecks verification items with required remarks', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: { success: true },
      } as any);

      const repo = new RealVerificationRepository();
      await repo.approveCheck('chk-identity-101', 'IDENTITY', 'Aadhaar verified');
      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-identity-101/approve', {
        remarks: 'Aadhaar verified',
      });

      await repo.rejectCheck('chk-address-101', 'ADDRESS', 'BLURRY_IMAGE', 'Utility bill blurry');
      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-address-101/reject', {
        reasonCode: 'BLURRY_IMAGE',
        remarks: 'Utility bill blurry',
      });

      await repo.requestReVerification('chk-police-101', ['POLICE_CLEARANCE'], 'Upload clear PCC');
      expect(postSpy).toHaveBeenCalledWith('/admin/verification/checks/chk-police-101/recheck', {
        remarks: 'Upload clear PCC',
      });
    });
  });

  describe('Booking Module Integration (RealBookingRepository)', () => {
    it('fetches bookings and performs booking actions according to state machine', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'B-84920',
              customerId: 'C-1092',
              customerName: 'Anand Sharma',
              status: 'REQUESTED',
              serviceCategory: 'House Maid',
              platformFeePaid: true,
              platformFeeAmount: 499,
            },
          ],
          meta: { totalItems: 1, currentPage: 1, itemsPerPage: 10, totalPages: 1 },
        },
      } as any);

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: { success: true },
      } as any);

      const repo = new RealBookingRepository();
      const res = await repo.getBookings();
      expect(res.items[0].id).toBe('B-84920');

      await repo.scheduleTrial('B-84920', 'W-10482', {
        scheduledDate: '2026-10-15',
        timeSlot: '10:00 AM',
        durationHours: 2,
        customerAddress: 'Kondapur, Hyderabad',
        contactPerson: 'Anand Sharma',
        contactPhone: '+91 98765 43210',
        trialFeeAmount: 499,
        notes: 'Morning trial',
      });
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/bookings/B-84920/schedule',
        {
          scheduleType: 'TRIAL',
          scheduledAt: '2026-10-15',
          workerId: 'W-10482',
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      );

      await repo.confirmBooking('B-84920');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/bookings/B-84920/confirm-worker',
        expect.objectContaining({ startDate: expect.any(String) }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      );

      await repo.cancelBooking('B-84920', 'Customer requested cancellation', 'CUSTOMER_INITIATED');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/bookings/B-84920/cancel',
        {
          reason: 'Customer requested cancellation',
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      );
    });
  });

  describe('Payment Module Integration (RealPaymentRepository)', () => {
    it('fetches payment transactions and processes refund through backend endpoint', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'TXN-892104',
              amount: 499,
              status: 'PAID',
              bookingId: 'B-84920',
              customerName: 'Anand Sharma',
              paymentMethod: 'UPI',
            },
          ],
          meta: { totalItems: 1, currentPage: 1, itemsPerPage: 10, totalPages: 1 },
        },
      } as any);

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const repo = new RealPaymentRepository();
      const list = await repo.getTransactions();
      expect(list.items[0].id).toBe('TXN-892104');
      expect(list.totalGrossCollectionsINR).toBe(499);

      await repo.processRefund('TXN-892104', 499, 'OTHER', 'Cancellation before trial');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/payments/TXN-892104/refund',
        {
          reason: 'OTHER: Cancellation before trial',
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      );
    });
  });

  describe('Support Module Integration (RealSupportRepository)', () => {
    it('manages support lifecycle: list, assign, message, close, escalate', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            {
              id: 'TKT-4921',
              subject: 'Worker did not arrive',
              status: 'OPEN',
              priority: 'HIGH',
              slaStatus: 'AT_RISK',
            },
          ],
          meta: { totalItems: 1, currentPage: 1, itemsPerPage: 10, totalPages: 1 },
        },
      } as any);

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: { success: true },
      } as any);

      const repo = new RealSupportRepository();
      const tickets = await repo.getTickets();
      expect(tickets.items[0].id).toBe('TKT-4921');

      await repo.claimTicket('TKT-4921', 'Pooja');
      expect(postSpy).toHaveBeenCalledWith('/admin/support/tickets/TKT-4921/assign', {
        note: 'Assigned to Pooja',
      });

      await repo.addCaseNote('TKT-4921', 'Spoke to customer', 'TELEPHONIC_LOG', 'Pooja');
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/support/tickets/TKT-4921/messages',
        {
          body: 'Spoke to customer',
          internal: true,
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      );

      await repo.resolveTicket('TKT-4921', 'Replacement arranged and confirmed');
      expect(postSpy).toHaveBeenCalledWith('/admin/support/tickets/TKT-4921/close', {
        resolution: 'Replacement arranged and confirmed',
      });

      await repo.escalateToOperations('TKT-4921', 'Urgent replacement needed');
      expect(postSpy).toHaveBeenCalledWith('/admin/support/tickets/TKT-4921/escalate', {
        reason: 'Urgent replacement needed',
      });
    });
  });

  describe('Reports Module Integration (RealReportRepository)', () => {
    it('fetches report catalog and exports CSV data', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/reports') {
          return {
            data: {
              success: true,
              data: [
                {
                  code: 'REP-01',
                  title: 'New Customer Acquisition',
                  category: 'Growth',
                  description: 'Customer signups',
                },
              ],
            },
          } as any;
        }
        return {
          data: {
            success: true,
            data: [
              { date: '2026-10-01', count: 12 },
              { date: '2026-10-02', count: 18 },
            ],
          },
        } as any;
      });

      const repo = new RealReportRepository();
      const reports = await repo.getReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe('REP-01');

      const exp = await repo.generateExport('REP-01', 'CSV');
      expect(exp.format).toBe('CSV');
      expect(exp.rowCount).toBe(2);
      expect(exp.csvContent).toContain('Date Bucket,Count');
    });
  });

  describe('Dashboard Module Integration (RealDashboardRepository)', () => {
    it('fetches real dashboard metrics for each role', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            kpis: {
              grossBookings: 1500,
              activeWorkforce: 400,
              verificationQueue: 25,
              activeGrievances: 5,
              replacementVolume: 12,
              platformRevenueINR: 520000,
              scheduledTrials: 14,
              policeVerifDue: 8,
              totalCustomers: 250,
              totalWorkers: 400,
              newBookingRequests: 30,
              bookingsAwaitingMatching: 15,
              scheduledTrialsToday: 14,
              bookingsAwaitingConfirmation: 8,
              activeLiveEngagements: 350,
              replacementRequests: 12,
              pendingVerificationCases: 25,
              openDisputes: 5,
              pendingRefunds: 2,
              expiringVerifications: 8,
              pendingReview: 25,
              inProgressReview: 6,
              reCheckDue: 8,
              decisionsToday: 10,
              openUnassignedGrievances: 5,
              myActiveCases: 3,
              slaAtRiskCount: 2,
              slaBreachedCount: 0,
              resolvedTodayCount: 12,
            },
            queues: [],
          },
        },
      } as any);

      const repo = new RealDashboardRepository();
      const superAdmin = await repo.getSuperAdminDashboard();
      expect(getSpy).toHaveBeenCalledWith('/admin/dashboard');
      expect(superAdmin.kpis.grossBookings).toBe(1500);

      const ops = await repo.getOperationsAdminDashboard();
      expect(ops.kpis.newBookingRequests).toBeDefined();

      const verif = await repo.getVerificationExecutiveDashboard();
      expect(verif.kpis.pendingReview).toBeDefined();

      const support = await repo.getSupportExecutiveDashboard();
      expect(support.kpis.openUnassignedGrievances).toBeDefined();
    });
  });

  describe('Repository Factory Selectors & Mock Safety', () => {
    it('returns Mock repositories when useMock is true', () => {
      expect(createCustomerRepository(true).constructor.name).toBe('MockCustomerRepository');
      expect(createWorkerRepository(true).constructor.name).toBe('MockWorkerRepository');
      expect(createVerificationRepository(true).constructor.name).toBe('MockVerificationRepository');
      expect(createBookingRepository(true).constructor.name).toBe('MockBookingRepository');
      expect(createPaymentRepository(true).constructor.name).toBe('MockPaymentRepository');
      expect(createSupportRepository(true).constructor.name).toBe('MockSupportRepository');
      expect(createReportRepository(true).constructor.name).toBe('MockReportRepository');
      expect(createDashboardRepository(true).constructor.name).toBe('MockDashboardRepository');
    });

    it('returns Real repositories when useMock is false', () => {
      expect(createCustomerRepository(false).constructor.name).toBe('RealCustomerRepository');
      expect(createWorkerRepository(false).constructor.name).toBe('RealWorkerRepository');
      expect(createVerificationRepository(false).constructor.name).toBe('RealVerificationRepository');
      expect(createBookingRepository(false).constructor.name).toBe('RealBookingRepository');
      expect(createPaymentRepository(false).constructor.name).toBe('RealPaymentRepository');
      expect(createSupportRepository(false).constructor.name).toBe('RealSupportRepository');
      expect(createReportRepository(false).constructor.name).toBe('RealReportRepository');
      expect(createDashboardRepository(false).constructor.name).toBe('RealDashboardRepository');
    });

    it('never silently falls back to mock data when Real repository request rejects', async () => {
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce({
        response: { status: 403, data: { message: 'Forbidden' } },
      });

      const realRepo = createCustomerRepository(false);
      let caughtError: unknown;
      try {
        await realRepo.getCustomers();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(DomainError);
    });
  });
});
