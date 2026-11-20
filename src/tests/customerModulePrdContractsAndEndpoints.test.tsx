import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealCustomerRepository } from '../features/customers/data/customerRepository';
import { httpClient } from '../core/api/httpClient';

describe('Customer Management Module — PRD Contract & Backend Endpoints Validation', () => {
  let repo: RealCustomerRepository;

  beforeEach(() => {
    repo = new RealCustomerRepository();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Endpoint & Query Parameter Alignment', () => {
    it('sends accountStatus and verificationStatus as distinct parameters to /admin/customers', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'cust-1',
              userId: 'user-1',
              name: 'John Doe',
              mobile: { countryCode: '+91', number: '9876543210' },
              email: 'john@example.com',
              accountStatus: 'ACTIVE',
              verificationStatus: 'PENDING',
              createdAt: '2026-11-01T00:00:00Z',
            },
          ],
          meta: { total: 1, page: 1, limit: 20 },
        },
      });

      const res = await repo.getCustomersPage(
        {
          status: 'ACTIVE',
          verificationStatus: 'PENDING',
          searchTerm: 'John',
        },
        1,
        20
      );

      expect(getSpy).toHaveBeenCalledWith(
        '/admin/customers',
        expect.objectContaining({
          params: expect.objectContaining({
            accountStatus: 'ACTIVE',
            verificationStatus: 'PENDING',
            name: 'John',
            page: 1,
            limit: 20,
          }),
        })
      );

      expect(res.items).toHaveLength(1);
      expect(res.items[0].status).toBe('ACTIVE');
      expect(res.items[0].verificationStatus).toBe('PENDING');
    });

    it('filters by Indian mobile number when search term is a phone number', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: [],
          meta: { total: 0, page: 1, limit: 20 },
        },
      });

      await repo.getCustomersPage({ searchTerm: '9876543210' }, 1, 20);

      expect(getSpy).toHaveBeenCalledWith(
        '/admin/customers',
        expect.objectContaining({
          params: expect.objectContaining({
            mobile: '9876543210',
          }),
        })
      );
    });
  });

  describe('2. Multi-Resource Customer Dossier Assembly', () => {
    it('aggregates profile, notes, bookings, and support tickets via backend sub-resources', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, _config?: unknown) => {
        if (url === '/admin/customers/cust-101') {
          return {
            data: {
              id: 'cust-101',
              userId: 'user-101',
              name: 'Aisha Khan',
              mobile: { nationalNumber: '9876543210' },
              email: 'aisha@example.com',
              accountStatus: 'ACTIVE',
              verificationStatus: 'VERIFIED',
              preferredLanguage: 'Hindi, English',
              createdAt: '2026-10-15T00:00:00Z',
              addresses: [
                {
                  id: 'addr-1',
                  line: 'Flat 301, Palm Grove',
                  area: 'Banjara Hills',
                  city: 'Hyderabad',
                  pincode: '500034',
                  isDefault: true,
                  isActive: true,
                },
              ],
            },
            headers: { etag: '"v1-etag"' },
          };
        }
        if (url === '/admin/customers/cust-101/notes') {
          return {
            data: {
              data: [
                {
                  id: 'note-1',
                  authorId: 'staff-ops-1',
                  note: 'Customer confirmed address via phone OTP.',
                  createdAt: '2026-10-16T10:00:00Z',
                },
              ],
            },
          };
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [
                {
                  id: 'B-1001',
                  status: 'CONFIRMED',
                  category: { id: 'cat-1', name: 'House Maid' },
                  workerName: 'Sunita Devi',
                  scheduledAt: '2026-10-20T09:00:00Z',
                },
              ],
            },
          };
        }
        if (url === '/admin/support/tickets') {
          return {
            data: {
              data: [
                {
                  id: 'TKT-2001',
                  status: 'OPEN',
                  category: { id: 'sup-1', name: 'Service Delay' },
                  description: 'Domestic worker delayed by 15 mins.',
                  createdAt: '2026-10-21T08:00:00Z',
                },
              ],
            },
          };
        }
        return { data: {} };
      });

      const detail = await repo.getCustomerById('cust-101');

      expect(detail).not.toBeNull();
      expect(detail?.id).toBe('cust-101');
      expect(detail?.userId).toBe('user-101');
      expect(detail?.name).toBe('Aisha Khan');
      expect(detail?.status).toBe('ACTIVE');
      expect(detail?.verificationStatus).toBe('VERIFIED');
      expect(detail?.fullAddress).toContain('Palm Grove');
      expect(detail?.addresses).toHaveLength(1);
      expect(detail?.notes).toHaveLength(1);
      expect(typeof detail?.notes[0]).toBe('object');
      expect(detail?.bookings).toHaveLength(1);
      expect(detail?.bookings[0].bookingId).toBe('B-1001');
      expect(detail?.complaints).toHaveLength(1);
      expect(detail?.complaints?.[0].ticketId).toBe('TKT-2001');
      expect(detail?.activeBookings).toBe(1);
      expect(detail?.openGrievances).toBe(1);

      expect(getSpy).toHaveBeenCalledWith('/admin/customers/cust-101');
      expect(getSpy).toHaveBeenCalledWith('/admin/customers/cust-101/notes', expect.anything());
      expect(getSpy).toHaveBeenCalledWith('/admin/bookings', expect.objectContaining({ params: expect.objectContaining({ customerUserId: 'user-101' }) }));
      expect(getSpy).toHaveBeenCalledWith('/admin/support/tickets', expect.objectContaining({ params: expect.objectContaining({ creatorUserId: 'user-101' }) }));
    });
  });

  describe('3. Account Status Mutations Decoupled from Verification Status', () => {
    it('suspends user account strictly via /admin/users/{userId}/status without touching verification status', async () => {
      vi.spyOn(repo, 'getCustomerById').mockResolvedValueOnce({
        id: 'cust-1',
        userId: 'user-1',
        name: 'Test Customer',
        maskedPhone: '+91 98**** **12',
        maskedEmail: 't****@example.com',
        locality: 'Kondapur',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        totalBookings: 1,
        activeBookings: 0,
        totalSpendINR: 1000,
        openGrievances: 0,
        fullAddress: 'Address',
        registeredDate: '2026-11-01',
        bookings: [],
        notes: [],
        complaints: [],
      });

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({ data: { status: 'SUSPENDED' } });

      await repo.suspendCustomer('cust-1', 'Chargeback dispute under investigation');

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/users/user-1/status',
        {
          status: 'SUSPENDED',
          reason: 'Chargeback dispute under investigation',
        },
        { headers: { 'If-Match': '*' } }
      );

      // Verify NO call was made to /admin/customers/cust-1/verification-status
      expect(patchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('verification-status'),
        expect.anything(),
        expect.anything()
      );
    });

    it('reactivates user account strictly via /admin/users/{userId}/status without altering verification status', async () => {
      vi.spyOn(repo, 'getCustomerById').mockResolvedValueOnce({
        id: 'cust-1',
        userId: 'user-1',
        name: 'Test Customer',
        maskedPhone: '+91 98**** **12',
        maskedEmail: 't****@example.com',
        locality: 'Kondapur',
        status: 'SUSPENDED',
        verificationStatus: 'PENDING',
        totalBookings: 1,
        activeBookings: 0,
        totalSpendINR: 1000,
        openGrievances: 0,
        fullAddress: 'Address',
        registeredDate: '2026-11-01',
        bookings: [],
        notes: [],
        complaints: [],
      });

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({ data: { status: 'ACTIVE' } });

      await repo.reactivateCustomer('cust-1');

      expect(patchSpy).toHaveBeenCalledTimes(1);
      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/users/user-1/status',
        {
          status: 'ACTIVE',
          reason: 'Account restored by operations staff',
        },
        { headers: { 'If-Match': '*' } }
      );

      expect(patchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('verification-status'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('4. Dedicated Customer Verification Status Mutation', () => {
    it('updates customer verification status via /admin/customers/{customerId}/verification-status with note and If-Match', async () => {
      vi.spyOn(repo, 'getCustomerById').mockResolvedValueOnce({
        id: 'cust-1',
        userId: 'user-1',
        name: 'Test Customer',
        etag: '"v2-etag"',
        maskedPhone: '+91 98**** **12',
        maskedEmail: 't****@example.com',
        locality: 'Kondapur',
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        totalBookings: 0,
        activeBookings: 0,
        totalSpendINR: 0,
        openGrievances: 0,
        fullAddress: 'Address',
        registeredDate: '2026-11-01',
        bookings: [],
        notes: [],
        complaints: [],
      });

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({ data: { verificationStatus: 'VERIFIED' } });

      await repo.updateCustomerVerificationStatus('cust-1', 'VERIFIED', 'Residential address verified with utility bill');

      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/customers/cust-1/verification-status',
        {
          status: 'VERIFIED',
          note: 'Residential address verified with utility bill',
        },
        { headers: { 'If-Match': '"v2-etag"' } }
      );
    });
  });

  describe('5. Operational Notes Sub-Resource', () => {
    it('persists internal notes via POST /admin/customers/{customerId}/notes', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          id: 'note-99',
          authorId: 'ops-1',
          note: 'Customer requested morning cleaning staff only.',
          createdAt: '2026-11-18T10:00:00Z',
        },
      });

      await repo.addCustomerNote('cust-1', 'Customer requested morning cleaning staff only.');

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/customers/cust-1/notes',
        {
          note: 'Customer requested morning cleaning staff only.',
        }
      );
    });

    it('rejects empty note submission', async () => {
      await expect(repo.addCustomerNote('cust-1', '   ')).rejects.toThrow('Note content cannot be empty.');
    });
  });
});
