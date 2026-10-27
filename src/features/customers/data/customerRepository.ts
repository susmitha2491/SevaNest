import { Customer, CustomerDetail, CustomerFilterCriteria, ICustomerRepository } from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { ServerFailureError } from '../../../core/errors/DomainError';

const MOCK_CUSTOMERS: CustomerDetail[] = [
  {
    id: 'C-1092',
    name: 'Anand Sharma',
    maskedPhone: '+91 98**** **12',
    maskedEmail: 'a****@gmail.com',
    locality: 'Kondapur',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 3,
    activeBookings: 1,
    registeredDate: 'Recent',
    preferredLanguage: 'English, Hindi',
    fullAddress: 'Flat 402, Aditya Sunshine, Raghavendra Colony, Kondapur, Hyderabad',
    totalSpendINR: 1497,
    openGrievances: 1,
    notes: ['Preferred morning trial slots', 'Requested Hindi/Telugu speaking housekeeper'],
    bookings: [
      { bookingId: 'B-84920', category: 'House Maid', workerName: 'Sunita Devi', status: 'CONFIRMED', date: 'Recent' },
      { bookingId: 'B-81204', category: 'Cook', workerName: 'Meena Bai', status: 'COMPLETED', date: 'Prior' },
      { bookingId: 'B-79012', category: 'Cleaning Helper', workerName: 'Ramesh Yadav', status: 'COMPLETED', date: 'Prior' },
    ],
    complaints: [
      {
        ticketId: 'TKT-1082',
        disputeCategory: 'SERVICE_QUALITY',
        serviceCategory: 'House Maid',
        status: 'IN_PROGRESS',
        createdAt: 'Recent',
        description: 'Trial maid arrived 45 minutes late and skipped kitchen cleaning duties.',
      },
    ],
  },
  {
    id: 'C-2091',
    name: 'Priya Reddy',
    maskedPhone: '+91 97**** **44',
    maskedEmail: 'p****@yahoo.com',
    locality: 'Gachibowli',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 1,
    activeBookings: 1,
    registeredDate: 'Recent',
    preferredLanguage: 'Telugu, English',
    fullAddress: 'Villa 18, Golf View Enclave, Financial District, Gachibowli, Hyderabad',
    totalSpendINR: 1999,
    openGrievances: 0,
    notes: ['Demands certified South Indian Cook'],
    bookings: [
      { bookingId: 'B-84912', category: 'Cook', workerName: undefined, status: 'MATCHING_IN_PROGRESS', date: 'Recent' },
    ],
    complaints: [],
  },
  {
    id: 'C-3810',
    name: 'Rajesh Kumar',
    maskedPhone: '+91 99**** **89',
    maskedEmail: 'r****@outlook.com',
    locality: 'Madhapur',
    status: 'SUSPENDED',
    verificationStatus: 'PENDING',
    totalBookings: 5,
    activeBookings: 0,
    registeredDate: 'Prior',
    preferredLanguage: 'Hindi',
    fullAddress: 'Plot 89, Silicon Valley Layout, Image Hospital Lane, Madhapur, Hyderabad',
    totalSpendINR: 2495,
    openGrievances: 0,
    notes: ['Suspended due to repeated payment chargeback dispute on trial fee'],
    bookings: [
      { bookingId: 'B-84890', category: 'Driver', workerName: 'Ramesh Yadav', status: 'TRIAL_SCHEDULED', date: 'Recent' },
      { bookingId: 'B-82110', category: 'Driver', workerName: 'Devendra Singh', status: 'CANCELLED', date: 'Prior' },
    ],
    complaints: [],
  },
  {
    id: 'C-4102',
    name: 'Sneha Patel',
    maskedPhone: '+91 96**** **31',
    maskedEmail: 's****@gmail.com',
    locality: 'HITEC City',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 2,
    activeBookings: 1,
    registeredDate: 'Recent',
    preferredLanguage: 'Gujarati, English',
    fullAddress: 'Tower B - 1201, My Home Bhooja, HITEC City, Hyderabad',
    totalSpendINR: 1298,
    openGrievances: 0,
    notes: ['Requested background-checked infant babysitter'],
    bookings: [
      { bookingId: 'B-84888', category: 'Babysitter', workerName: 'Kavita Kumari', status: 'REPLACEMENT_REQUESTED', date: 'Recent' },
      { bookingId: 'B-80911', category: 'Babysitter', workerName: 'Meena Bai', status: 'COMPLETED', date: 'Prior' },
    ],
    complaints: [],
  },
  {
    id: 'C-5520',
    name: 'Venkatesh Iyer',
    maskedPhone: '+91 94**** **77',
    maskedEmail: 'v****@gmail.com',
    locality: 'Kukatpally',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 1,
    activeBookings: 1,
    registeredDate: 'Recent',
    preferredLanguage: 'Tamil, Telugu',
    fullAddress: 'Phase 2, HIG-45, KPHB Colony, Kukatpally, Hyderabad',
    totalSpendINR: 499,
    openGrievances: 0,
    notes: ['Driver required for daily school pick & drop'],
    bookings: [
      { bookingId: 'B-84922', category: 'Driver', workerName: undefined, status: 'MATCHING_IN_PROGRESS', date: 'Recent' },
    ],
    complaints: [],
  },
  {
    id: 'C-6780',
    name: 'Neha Gupta',
    maskedPhone: '+91 93**** **55',
    maskedEmail: 'n****@gmail.com',
    locality: 'Jubilee Hills',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    totalBookings: 4,
    activeBookings: 0,
    registeredDate: 'Prior',
    preferredLanguage: 'Hindi, English',
    fullAddress: 'Road No 36, Jubilee Hills, Hyderabad',
    totalSpendINR: 3996,
    openGrievances: 0,
    notes: ['Elderly companion trial scheduled'],
    bookings: [
      { bookingId: 'B-83119', category: 'Elderly Care', workerName: 'Anil Rao', status: 'COMPLETED', date: 'Prior' },
    ],
    complaints: [],
  },
];

function maskCustomerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const start = digits.slice(0, 2);
    const end = digits.slice(-2);
    return `+91 ${start}**** **${end}`;
  }
  return '+91 ***** *****';
}

function maskCustomerEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length === 2 && parts[0] && parts[1]) {
    const firstChar = parts[0][0];
    return `${firstChar}****@${parts[1]}`;
  }
  return 'c****@sevanest.internal';
}

export function mapBackendCustomerToCustomer(item: Record<string, unknown>): Customer {
  const userObj = (item.user && typeof item.user === 'object' ? item.user : {}) as Record<string, unknown>;
  const profileObj = (item.profile && typeof item.profile === 'object' ? item.profile : {}) as Record<string, unknown>;

  const id = String(item.id || item.customerId || item._id || userObj.id || '');
  const firstName = String(item.firstName || profileObj.firstName || userObj.firstName || '');
  const lastName = String(item.lastName || profileObj.lastName || userObj.lastName || '');
  const combinedName = [firstName, lastName].filter(Boolean).join(' ');
  const name = String(item.name || item.fullName || profileObj.fullName || userObj.fullName || combinedName || 'Customer User');

  const rawPhone = String(item.unmaskedPhone || item.phone || item.mobile || profileObj.phone || userObj.phone || '');
  const maskedPhone = String(
    item.maskedPhone ||
    item.mobileMasked ||
    profileObj.maskedPhone ||
    (rawPhone ? maskCustomerPhone(rawPhone) : '+91 ***** *****')
  );

  const rawEmail = String(item.unmaskedEmail || item.email || profileObj.email || userObj.email || '');
  const maskedEmail = String(
    item.maskedEmail ||
    item.emailMasked ||
    profileObj.maskedEmail ||
    (rawEmail ? maskCustomerEmail(rawEmail) : 'c****@sevanest.internal')
  );

  const rawStatus = String(item.status || userObj.status || '').toUpperCase();
  const isSuspended = rawStatus === 'SUSPENDED' || rawStatus === 'INACTIVE' || rawStatus === 'BLOCKED';
  const status: Customer['status'] = isSuspended ? 'SUSPENDED' : 'ACTIVE';

  const locality = String(
    item.locality ||
    item.city ||
    profileObj.locality ||
    profileObj.city ||
    item.area ||
    'Hyderabad'
  );

  const totalBookings = Number(
    item.totalBookings ??
    item.bookingsCount ??
    item.bookingCount ??
    (Array.isArray(item.bookings) ? item.bookings.length : 0)
  );

  const registeredDate = String(
    item.registeredDate ||
    item.createdAt ||
    item.registrationDate ||
    userObj.createdAt ||
    'Recent'
  );

  const rawVerifStatus = String(
    item.verificationStatus ||
    item.kycStatus ||
    profileObj.verificationStatus ||
    profileObj.kycStatus ||
    ''
  ).toUpperCase();
  const verificationStatus: Customer['verificationStatus'] =
    rawVerifStatus === 'VERIFIED'
      ? 'VERIFIED'
      : rawVerifStatus === 'REJECTED'
      ? 'REJECTED'
      : 'PENDING';

  const preferredLanguage = String(item.preferredLanguage || profileObj.preferredLanguage || profileObj.language || '') || undefined;
  const userId = String(item.userId || userObj.id || '') || undefined;

  return {
    id,
    userId,
    name,
    maskedPhone,
    maskedEmail,
    locality,
    status,
    verificationStatus,
    totalBookings,
    registeredDate,
    preferredLanguage,
  };
}

export function mapBackendCustomerDetailToCustomerDetail(data: Record<string, unknown>, etag?: string): CustomerDetail {
  const summary = mapBackendCustomerToCustomer(data);
  const profileObj = (data.profile && typeof data.profile === 'object' ? data.profile : {}) as Record<string, unknown>;

  const fullAddress = String(
    data.fullAddress ||
    data.address ||
    profileObj.address ||
    profileObj.fullAddress ||
    `${summary.locality}, Hyderabad`
  );

  const rawBookings = Array.isArray(data.bookings)
    ? data.bookings
    : Array.isArray(data.recentBookings)
    ? data.recentBookings
    : [];

  const rawComplaints = Array.isArray(data.complaints)
    ? data.complaints
    : Array.isArray(data.tickets)
    ? data.tickets
    : Array.isArray(data.supportTickets)
    ? data.supportTickets
    : [];

  const complaints: CustomerDetail['complaints'] = rawComplaints.map((c: Record<string, unknown>) => ({
    ticketId: String(c.id || c.ticketId || ''),
    disputeCategory: String(c.disputeCategory || c.category || 'General Support'),
    serviceCategory: c.serviceCategory ? String(c.serviceCategory) : undefined,
    status: String(c.status || 'OPEN'),
    createdAt: String(c.createdAt || 'Recent'),
    description: c.description ? String(c.description) : undefined,
  }));

  return {
    ...summary,
    etag: etag || (data.etag as string | undefined),
    fullAddress,
    unmaskedPhone: data.unmaskedPhone ? String(data.unmaskedPhone) : undefined,
    unmaskedEmail: data.unmaskedEmail ? String(data.unmaskedEmail) : undefined,
    totalSpendINR: Number(data.totalSpendINR ?? data.totalSpend ?? 0),
    activeBookings: Number(data.activeBookings ?? 0),
    openGrievances: Number(data.openGrievances ?? 0),
    notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
    bookings: rawBookings as CustomerDetail['bookings'],
    complaints,
  };
}

export class RealCustomerRepository implements ICustomerRepository {
  async getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]> {
    try {
      const response = await httpClient.get<
        { items?: Array<Record<string, unknown>>; customers?: Array<Record<string, unknown>>; data?: unknown } | Array<Record<string, unknown>>
      >(
        '/admin/customers',
        {
          params: {
            verificationStatus: filter?.status === 'ACTIVE' ? 'VERIFIED' : filter?.status === 'SUSPENDED' ? 'PENDING' : undefined,
            mobile: filter?.searchTerm,
          },
        }
      );

      const rawData = response.data as Record<string, unknown>;
      let list: Record<string, unknown>[] = [];
      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (rawData && typeof rawData === 'object') {
        if (Array.isArray(rawData.items)) {
          list = rawData.items as Record<string, unknown>[];
        } else if (Array.isArray(rawData.customers)) {
          list = rawData.customers as Record<string, unknown>[];
        } else if (Array.isArray(rawData.data)) {
          list = rawData.data as Record<string, unknown>[];
        } else if (rawData.data && typeof rawData.data === 'object') {
          const nested = rawData.data as Record<string, unknown>;
          if (Array.isArray(nested.items)) {
            list = nested.items as Record<string, unknown>[];
          } else if (Array.isArray(nested.customers)) {
            list = nested.customers as Record<string, unknown>[];
          }
        }
      }

      return list.map(mapBackendCustomerToCustomer);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCustomerById(id: string): Promise<CustomerDetail | null> {
    try {
      if (!id || typeof id !== 'string') return null;
      const response = await httpClient.get<Record<string, unknown>>(`/admin/customers/${encodeURIComponent(id)}`);
      if (!response.data) return null;
      const raw = response.data;
      const target = (raw.customer || (raw.data && typeof raw.data === 'object' && (raw.data as Record<string, unknown>).customer) || raw.data || raw) as Record<string, unknown>;
      const etag = (response.headers?.['etag'] || response.headers?.etag) as string | undefined;
      return mapBackendCustomerDetailToCustomerDetail(target, etag);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async revealPII(customerId: string, _reason: string): Promise<{ phone: string; email: string }> {
    try {
      // Query customer dossier directly without creating fake audit notes
      const response = await httpClient.get<Record<string, unknown>>(`/admin/customers/${encodeURIComponent(customerId)}`);
      const data = response.data;
      const phone = data?.unmaskedPhone || data?.mobile;
      const email = data?.unmaskedEmail || data?.email;
      if (!phone && !email) {
        throw new ServerFailureError('Authorized PII data not returned by backend.');
      }
      return {
        phone: String(phone || 'Unavailable'),
        email: String(email || 'Unavailable'),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async suspendCustomer(customerId: string, remarks: string): Promise<void> {
    try {
      // 1. Fetch customer to obtain userId and GET ETag
      const customer = await this.getCustomerById(customerId).catch(() => null);
      const targetUserId = customer?.userId || customerId;
      const etag = customer?.etag;

      // 2. Change account status via /admin/users/{userId}/status
      await httpClient.patch(`/admin/users/${encodeURIComponent(targetUserId)}/status`, {
        status: 'SUSPENDED',
        reason: remarks,
      });

      // 3. Update customer verification-status sending If-Match ETag when available
      const headers: Record<string, string> = {};
      if (etag) {
        headers['If-Match'] = etag;
      }
      await httpClient.patch(
        `/admin/customers/${encodeURIComponent(customerId)}/verification-status`,
        {
          status: 'PENDING',
          note: remarks,
        },
        Object.keys(headers).length > 0 ? { headers } : undefined
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    try {
      // 1. Fetch customer to obtain userId and GET ETag
      const customer = await this.getCustomerById(customerId).catch(() => null);
      const targetUserId = customer?.userId || customerId;
      const etag = customer?.etag;

      // 2. Reactivate account status via /admin/users/{userId}/status
      await httpClient.patch(`/admin/users/${encodeURIComponent(targetUserId)}/status`, {
        status: 'ACTIVE',
        reason: 'Account restored by operations staff',
      });

      // 3. Restore customer verification-status sending If-Match ETag when available
      const headers: Record<string, string> = {};
      if (etag) {
        headers['If-Match'] = etag;
      }
      await httpClient.patch(
        `/admin/customers/${encodeURIComponent(customerId)}/verification-status`,
        {
          status: 'VERIFIED',
          note: 'Account restored by operations staff',
        },
        Object.keys(headers).length > 0 ? { headers } : undefined
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async addCustomerNote(customerId: string, note: string): Promise<void> {
    try {
      if (!note || !note.trim()) {
        throw new Error('Note content cannot be empty.');
      }
      await httpClient.post(`/admin/customers/${encodeURIComponent(customerId)}/notes`, {
        note: note.trim(),
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockCustomerRepository implements ICustomerRepository {
  async getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]> {
    let result = [...MOCK_CUSTOMERS];

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          c.locality.toLowerCase().includes(term)
      );
    }

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((c) => c.status === filter.status);
    }

    if (filter?.locality && filter.locality !== 'ALL') {
      result = result.filter((c) => c.locality === filter.locality);
    }

    return result.map(({ bookings: _b, notes: _n, fullAddress: _fa, unmaskedPhone: _up, unmaskedEmail: _ue, totalSpendINR: _ts, activeBookings: _ab, openGrievances: _og, complaints: _c, ...summary }) => summary);
  }

  async getCustomerById(id: string): Promise<CustomerDetail | null> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === id);
    return customer ? { ...customer } : null;
  }

  async revealPII(customerId: string, _reason: string): Promise<{ phone: string; email: string }> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      return {
        phone: '+91 98765 43210',
        email: `${customer.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      };
    }
    return {
      phone: '+91 98765 43210',
      email: `revealed.${customerId}@example.com`,
    };
  }

  async suspendCustomer(customerId: string, remarks: string): Promise<void> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.status = 'SUSPENDED';
      customer.verificationStatus = 'PENDING';
      customer.notes.push(`[SUSPENDED] ${remarks}`);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.status = 'ACTIVE';
      customer.verificationStatus = 'VERIFIED';
      customer.notes.push('[REACTIVATED] Account restored by operations staff');
    }
  }

  async addCustomerNote(customerId: string, note: string): Promise<void> {
    if (!note || !note.trim()) {
      throw new Error('Note content cannot be empty.');
    }
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.notes.push(note.trim());
    }
  }
}

export const CustomerRepositoryImpl = RealCustomerRepository;

export function createCustomerRepository(useMock: boolean = env.VITE_USE_MOCK_AUTH): ICustomerRepository {
  return useMock ? new MockCustomerRepository() : new RealCustomerRepository();
}

export const customerRepository = createCustomerRepository();
