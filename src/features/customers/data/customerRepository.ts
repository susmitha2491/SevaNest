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
    totalBookings: 3,
    activeBookings: 1,
    registeredDate: 'Recent',
    fullAddress: 'Flat 402, Aditya Sunshine, Raghavendra Colony, Kondapur, Hyderabad',
    totalSpendINR: 1497,
    openGrievances: 1,
    notes: ['Preferred morning trial slots', 'Requested Hindi/Telugu speaking housekeeper'],
    bookings: [
      { bookingId: 'B-84920', category: 'House Maid', workerName: 'Sunita Devi', status: 'CONFIRMED', date: 'Recent' },
      { bookingId: 'B-81204', category: 'Cook', workerName: 'Meena Bai', status: 'COMPLETED', date: 'Prior' },
      { bookingId: 'B-79012', category: 'Cleaning Helper', workerName: 'Ramesh Yadav', status: 'COMPLETED', date: 'Prior' },
    ],
  },
  {
    id: 'C-2091',
    name: 'Priya Reddy',
    maskedPhone: '+91 97**** **44',
    maskedEmail: 'p****@yahoo.com',
    locality: 'Gachibowli',
    status: 'ACTIVE',
    totalBookings: 1,
    activeBookings: 1,
    registeredDate: 'Recent',
    fullAddress: 'Villa 18, Golf View Enclave, Financial District, Gachibowli, Hyderabad',
    totalSpendINR: 1999,
    openGrievances: 0,
    notes: ['Demands certified South Indian Cook'],
    bookings: [
      { bookingId: 'B-84912', category: 'Cook', workerName: undefined, status: 'MATCHING_IN_PROGRESS', date: 'Recent' },
    ],
  },
  {
    id: 'C-3810',
    name: 'Rajesh Kumar',
    maskedPhone: '+91 99**** **89',
    maskedEmail: 'r****@outlook.com',
    locality: 'Madhapur',
    status: 'SUSPENDED',
    totalBookings: 5,
    activeBookings: 0,
    registeredDate: 'Prior',
    fullAddress: 'Plot 89, Silicon Valley Layout, Image Hospital Lane, Madhapur, Hyderabad',
    totalSpendINR: 2495,
    openGrievances: 0,
    notes: ['Suspended due to repeated payment chargeback dispute on trial fee'],
    bookings: [
      { bookingId: 'B-84890', category: 'Driver', workerName: 'Ramesh Yadav', status: 'TRIAL_SCHEDULED', date: 'Recent' },
      { bookingId: 'B-82110', category: 'Driver', workerName: 'Devendra Singh', status: 'CANCELLED', date: 'Prior' },
    ],
  },
  {
    id: 'C-4102',
    name: 'Sneha Patel',
    maskedPhone: '+91 96**** **31',
    maskedEmail: 's****@gmail.com',
    locality: 'HITEC City',
    status: 'ACTIVE',
    totalBookings: 2,
    activeBookings: 1,
    registeredDate: 'Recent',
    fullAddress: 'Tower B - 1201, My Home Bhooja, HITEC City, Hyderabad',
    totalSpendINR: 1298,
    openGrievances: 0,
    notes: ['Requested background-checked infant babysitter'],
    bookings: [
      { bookingId: 'B-84888', category: 'Babysitter', workerName: 'Kavita Kumari', status: 'REPLACEMENT_REQUESTED', date: 'Recent' },
      { bookingId: 'B-80911', category: 'Babysitter', workerName: 'Meena Bai', status: 'COMPLETED', date: 'Prior' },
    ],
  },
  {
    id: 'C-5520',
    name: 'Venkatesh Iyer',
    maskedPhone: '+91 94**** **77',
    maskedEmail: 'v****@gmail.com',
    locality: 'Kukatpally',
    status: 'ACTIVE',
    totalBookings: 1,
    activeBookings: 1,
    registeredDate: 'Recent',
    fullAddress: 'Phase 2, HIG-45, KPHB Colony, Kukatpally, Hyderabad',
    totalSpendINR: 499,
    openGrievances: 0,
    notes: ['Driver required for daily school pick & drop'],
    bookings: [
      { bookingId: 'B-84922', category: 'Driver', workerName: undefined, status: 'MATCHING_IN_PROGRESS', date: 'Recent' },
    ],
  },
  {
    id: 'C-6780',
    name: 'Neha Gupta',
    maskedPhone: '+91 93**** **55',
    maskedEmail: 'n****@gmail.com',
    locality: 'Jubilee Hills',
    status: 'ACTIVE',
    totalBookings: 4,
    activeBookings: 0,
    registeredDate: 'Prior',
    fullAddress: 'Road No 36, Jubilee Hills, Hyderabad',
    totalSpendINR: 3996,
    openGrievances: 0,
    notes: ['Elderly companion trial scheduled'],
    bookings: [
      { bookingId: 'B-83119', category: 'Elderly Care', workerName: 'Anil Rao', status: 'COMPLETED', date: 'Prior' },
    ],
  },
];

export function mapBackendCustomerToCustomer(item: Record<string, unknown>): Customer {
  return {
    id: String(item.id || item.customerId || ''),
    name: String(item.name || item.fullName || 'Customer User'),
    maskedPhone: String(item.maskedPhone || item.mobileMasked || item.mobile || '+91 ***** *****'),
    maskedEmail: String(item.maskedEmail || item.emailMasked || item.email || 'c****@sevanest.internal'),
    locality: String(item.locality || item.city || 'Hyderabad'),
    status: (item.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE') as Customer['status'],
    totalBookings: Number(item.totalBookings || item.bookingsCount || 0),
    registeredDate: String(item.registeredDate || item.createdAt || 'Recent'),
  };
}

export function mapBackendCustomerDetailToCustomerDetail(data: Record<string, unknown>): CustomerDetail {
  const summary = mapBackendCustomerToCustomer(data);
  return {
    ...summary,
    fullAddress: String(data.fullAddress || data.address || `${summary.locality}, Hyderabad`),
    unmaskedPhone: data.unmaskedPhone ? String(data.unmaskedPhone) : undefined,
    unmaskedEmail: data.unmaskedEmail ? String(data.unmaskedEmail) : undefined,
    totalSpendINR: Number(data.totalSpendINR || data.totalSpend || 0),
    activeBookings: Number(data.activeBookings || 0),
    openGrievances: Number(data.openGrievances || 0),
    notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
    bookings: Array.isArray(data.bookings) ? (data.bookings as CustomerDetail['bookings']) : [],
  };
}

export class RealCustomerRepository implements ICustomerRepository {
  async getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]> {
    try {
      const response = await httpClient.get<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        '/admin/customers',
        {
          params: {
            verificationStatus: filter?.status === 'ACTIVE' ? 'VERIFIED' : filter?.status === 'SUSPENDED' ? 'PENDING' : undefined,
            mobile: filter?.searchTerm,
          },
        }
      );

      const rawData = response.data as Record<string, unknown>;
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(rawData?.items)
        ? (rawData.items as Record<string, unknown>[])
        : Array.isArray(rawData?.data)
        ? (rawData.data as Record<string, unknown>[])
        : [];

      return list.map(mapBackendCustomerToCustomer);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCustomerById(id: string): Promise<CustomerDetail | null> {
    try {
      const response = await httpClient.get<Record<string, unknown>>(`/admin/customers/${encodeURIComponent(id)}`);
      if (!response.data) return null;
      return mapBackendCustomerDetailToCustomerDetail(response.data);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async revealPII(customerId: string, reason: string): Promise<{ phone: string; email: string }> {
    try {
      // Record audit reason on backend
      await httpClient.post(`/admin/customers/${encodeURIComponent(customerId)}/notes`, {
        note: `[AUDIT PII REVEAL] Reason: ${reason}`,
      });

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
      await httpClient.patch(`/admin/customers/${encodeURIComponent(customerId)}/verification-status`, {
        status: 'PENDING',
        note: remarks,
      });
      await httpClient.post(`/admin/customers/${encodeURIComponent(customerId)}/notes`, {
        note: `[SUSPENDED] ${remarks}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    try {
      await httpClient.patch(`/admin/customers/${encodeURIComponent(customerId)}/verification-status`, {
        status: 'VERIFIED',
        note: 'Account restored by operations staff',
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

    return result.map(({ bookings: _b, notes: _n, fullAddress: _fa, unmaskedPhone: _up, unmaskedEmail: _ue, totalSpendINR: _ts, activeBookings: _ab, openGrievances: _og, ...summary }) => summary);
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
      customer.notes.push(`[SUSPENDED] ${remarks}`);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.status = 'ACTIVE';
      customer.notes.push('[REACTIVATED] Account restored by operations staff');
    }
  }
}

export const CustomerRepositoryImpl = RealCustomerRepository;

export function createCustomerRepository(useMock: boolean = env.VITE_USE_MOCK_AUTH): ICustomerRepository {
  return useMock ? new MockCustomerRepository() : new RealCustomerRepository();
}

export const customerRepository = createCustomerRepository();
