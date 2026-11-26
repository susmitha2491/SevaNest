import { Customer, CustomerDetail, CustomerFilterCriteria, CustomerPageResult, ICustomerRepository, CustomerAddress, CustomerNote, CustomerBookingSummary, CustomerComplaintSummary } from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { formatPhoneNumber, getCustomerPhone, setCustomerPhone, getCustomerEmail, setCustomerEmail, extractSearchMobileDigits, extractCanonicalMobileDigits, matchesPhoneDigits, fetchCustomerUnmaskedPhone } from '../../../core/utils/phoneDirectory';

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

function extractPhoneString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.masked) return String(obj.masked);
    if (obj.number) {
      const code = obj.countryCode ? `${obj.countryCode} ` : '';
      return `${code}${obj.number}`;
    }
    if (obj.nationalNumber) {
      const code = obj.countryCode ? `${obj.countryCode} ` : '+91 ';
      return `${code}${obj.nationalNumber}`;
    }
    if (obj.formatted) return String(obj.formatted);
  }
  return '';
}

function extractEmailString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.email) return String(obj.email);
    if (obj.address) return String(obj.address);
  }
  return '';
}

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

  const userId = String(item.userId || userObj.id || '') || undefined;
  const rawPhone = extractPhoneString(item.unmaskedPhone || item.phone || item.mobile || profileObj.phone || userObj.phone || '');
  const cachedPhone = getCustomerPhone(id) || (userId ? getCustomerPhone(userId) : undefined);
  const rawCleanPhone = cachedPhone || (rawPhone && !rawPhone.includes('*') ? formatPhoneNumber(rawPhone) : undefined);
  if (rawCleanPhone) {
    setCustomerPhone(id, rawCleanPhone);
    if (userId) setCustomerPhone(userId, rawCleanPhone);
  }

  const maskedPhone = String(
    rawCleanPhone ||
    item.maskedPhone ||
    item.mobileMasked ||
    profileObj.maskedPhone ||
    (rawPhone ? maskCustomerPhone(rawPhone) : '+91 ***** *****')
  );

  const rawEmail = extractEmailString(item.unmaskedEmail || item.email || profileObj.email || userObj.email || '');
  const cachedEmail = getCustomerEmail(id) || (userId ? getCustomerEmail(userId) : undefined);
  const rawCleanEmail = cachedEmail || (rawEmail && !rawEmail.includes('*') ? rawEmail : undefined);
  if (rawCleanEmail) {
    setCustomerEmail(id, rawCleanEmail);
    if (userId) setCustomerEmail(userId, rawCleanEmail);
  }

  const maskedEmail = String(
    item.maskedEmail ||
    item.emailMasked ||
    profileObj.maskedEmail ||
    (rawCleanEmail || (rawEmail ? maskCustomerEmail(rawEmail) : 'c****@sevanest.internal'))
  );

  const rawStatus = String(item.accountStatus || item.status || userObj.status || '').toUpperCase();
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
    phone: rawCleanPhone,
    unmaskedPhone: rawCleanPhone,
    email: rawCleanEmail,
    unmaskedEmail: rawCleanEmail,
  };
}

export function mapBackendCustomerDetailToCustomerDetail(
  data: Record<string, unknown>,
  etag?: string,
  fetchedNotes?: Array<string | CustomerNote>,
  fetchedBookings?: CustomerBookingSummary[],
  fetchedComplaints?: CustomerComplaintSummary[]
): CustomerDetail {
  const summary = mapBackendCustomerToCustomer(data);
  const profileObj = (data.profile && typeof data.profile === 'object' ? data.profile : {}) as Record<string, unknown>;
  const userObj = (data.user && typeof data.user === 'object' ? data.user : {}) as Record<string, unknown>;

  const rawAddresses = Array.isArray(data.addresses) ? data.addresses : [];
  const addresses: CustomerAddress[] = rawAddresses.map((a: Record<string, unknown>) => ({
    id: String(a.id || ''),
    line: String(a.line || ''),
    line2: a.line2 ? String(a.line2) : null,
    area: String(a.area || ''),
    city: String(a.city || ''),
    state: a.state ? String(a.state) : null,
    pincode: String(a.pincode || ''),
    label: a.label ? String(a.label) : null,
    latitude: typeof a.latitude === 'number' ? a.latitude : null,
    longitude: typeof a.longitude === 'number' ? a.longitude : null,
    isDefault: Boolean(a.isDefault),
    isActive: a.isActive !== false,
  }));

  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
  const formattedAddr = defaultAddr
    ? [defaultAddr.line, defaultAddr.line2, defaultAddr.area, defaultAddr.city, defaultAddr.pincode]
        .filter(Boolean)
        .join(', ')
    : '';

  const fullAddress = String(
    data.fullAddress ||
    formattedAddr ||
    data.address ||
    profileObj.address ||
    profileObj.fullAddress ||
    `${summary.locality}, Hyderabad`
  );

  const rawBookings = fetchedBookings !== undefined
    ? fetchedBookings
    : Array.isArray(data.bookings)
    ? (data.bookings as CustomerBookingSummary[])
    : Array.isArray(data.recentBookings)
    ? (data.recentBookings as CustomerBookingSummary[])
    : [];

  const rawComplaints = fetchedComplaints !== undefined
    ? fetchedComplaints
    : Array.isArray(data.complaints)
    ? (data.complaints as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
        ticketId: String(c.id || c.ticketId || ''),
        disputeCategory: String(c.disputeCategory || c.category || 'General Support'),
        serviceCategory: c.serviceCategory ? String(c.serviceCategory) : undefined,
        status: String(c.status || 'OPEN'),
        createdAt: String(c.createdAt || 'Recent'),
        description: c.description ? String(c.description) : undefined,
      }))
    : Array.isArray(data.tickets)
    ? (data.tickets as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
        ticketId: String(c.id || c.ticketId || ''),
        disputeCategory: String(c.disputeCategory || c.category || 'General Support'),
        serviceCategory: c.serviceCategory ? String(c.serviceCategory) : undefined,
        status: String(c.status || 'OPEN'),
        createdAt: String(c.createdAt || 'Recent'),
        description: c.description ? String(c.description) : undefined,
      }))
    : [];

  const rawNotes: Array<string | CustomerNote> = fetchedNotes !== undefined
    ? fetchedNotes
    : Array.isArray(data.notes)
    ? (data.notes as Array<string | CustomerNote>)
    : [];

  const activeBookings = rawBookings.filter((b) =>
    ['CONFIRMED', 'ACTIVE', 'INTERVIEW_TRIAL_SCHEDULED', 'MATCHED'].includes(String(b.status).toUpperCase())
  ).length || Number(data.activeBookings ?? 0);

  const totalBookings = rawBookings.length || Number(data.totalBookings ?? summary.totalBookings ?? 0);

  const openGrievances = rawComplaints.filter((c) =>
    ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'INVESTIGATION_PENDING'].includes(String(c.status).toUpperCase())
  ).length || Number(data.openGrievances ?? 0);

  const rawDetailPhone = extractPhoneString(data.unmaskedPhone || data.mobile || data.phone || profileObj.phone || profileObj.mobile || '');
  const unmaskedPhone = (rawDetailPhone && !rawDetailPhone.includes('*'))
    ? formatPhoneNumber(rawDetailPhone)
    : summary.unmaskedPhone || summary.phone;
  if (unmaskedPhone) {
    setCustomerPhone(summary.id, unmaskedPhone);
    if (summary.userId) setCustomerPhone(summary.userId, unmaskedPhone);
  }

  const rawDetailEmail = extractEmailString(
    data.unmaskedEmail ||
    data.email ||
    profileObj.email ||
    profileObj.unmaskedEmail ||
    userObj.email ||
    ''
  );
  const cachedEmail = getCustomerEmail(summary.id) || (summary.userId ? getCustomerEmail(summary.userId) : undefined);
  const unmaskedEmail = (rawDetailEmail && !rawDetailEmail.includes('*'))
    ? rawDetailEmail
    : (data.unmaskedEmail ? String(data.unmaskedEmail) : (cachedEmail || summary.unmaskedEmail || summary.email));
  if (unmaskedEmail) {
    setCustomerEmail(summary.id, unmaskedEmail);
    if (summary.userId) setCustomerEmail(summary.userId, unmaskedEmail);
  }

  return {
    ...summary,
    totalBookings,
    etag: etag || (data.etag as string | undefined),
    fullAddress,
    addresses,
    unmaskedPhone,
    unmaskedEmail,
    email: unmaskedEmail,
    totalSpendINR: Number(data.totalSpendINR ?? data.totalSpend ?? 0),
    activeBookings,
    openGrievances,
    notes: rawNotes,
    bookings: rawBookings,
    complaints: rawComplaints,
  };
}

function isUuidOrCustomerId(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }
  if (/^C-\d+$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export class RealCustomerRepository implements ICustomerRepository {
  private async searchCustomersByPartialMobile(
    searchDigits: string,
    filter?: CustomerFilterCriteria
  ): Promise<Customer[]> {
    const params: Record<string, unknown> = {
      limit: 100,
      page: 1,
    };
    if (filter?.status && filter.status !== 'ALL') {
      params.accountStatus = filter.status;
    }
    if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
      params.verificationStatus = filter.verificationStatus;
    }

    const response = await httpClient.get<{
      items?: Array<Record<string, unknown>>;
      customers?: Array<Record<string, unknown>>;
      data?: unknown;
      meta?: Record<string, unknown>;
    } | Array<Record<string, unknown>>>('/admin/customers', { params });

    const rawData = response.data as Record<string, unknown>;
    let list: Record<string, unknown>[] = [];
    if (Array.isArray(response.data)) {
      list = response.data;
    } else if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.items)) list = rawData.items as Record<string, unknown>[];
      else if (Array.isArray(rawData.customers)) list = rawData.customers as Record<string, unknown>[];
      else if (Array.isArray(rawData.data)) list = rawData.data as Record<string, unknown>[];
      else if (rawData.data && typeof rawData.data === 'object') {
        const inner = rawData.data as Record<string, unknown>;
        if (Array.isArray(inner.items)) list = inner.items as Record<string, unknown>[];
        else if (Array.isArray(inner.customers)) list = inner.customers as Record<string, unknown>[];
      }
    }

    const matchedList = (
      await Promise.all(
        list.map(async (item) => {
          const id = String(item.id || item.customerId || '');
          let phone = getCustomerPhone(id);
          if (!phone || phone.includes('*')) {
            phone = await fetchCustomerUnmaskedPhone(id);
          }
          const rawMobile = String(item.mobile || item.phone || '');
          if (matchesPhoneDigits(phone, searchDigits) || matchesPhoneDigits(rawMobile, searchDigits)) {
            return item;
          }
          return null;
        })
      )
    ).filter(Boolean) as Record<string, unknown>[];

    let result = matchedList.map(mapBackendCustomerToCustomer);
    if (filter?.locality && filter.locality !== 'ALL') {
      result = result.filter((c) => c.locality.toLowerCase().includes(filter.locality!.toLowerCase()));
    }
    return result;
  }

  async getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]> {
    try {
      const term = filter?.searchTerm?.trim();
      if (term && isUuidOrCustomerId(term)) {
        try {
          const detail = await this.getCustomerById(term);
          if (detail) return [detail];
        } catch {
          return [];
        }
      }

      const params: Record<string, unknown> = {};

      if (filter?.status && filter.status !== 'ALL') {
        params.accountStatus = filter.status;
      }
      if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
        params.verificationStatus = filter.verificationStatus;
      }

      if (term) {
        const canonicalMobile = extractCanonicalMobileDigits(term);
        const partialMobile = !canonicalMobile ? extractSearchMobileDigits(term) : null;
        if (canonicalMobile) {
          params.mobile = canonicalMobile;
        } else if (partialMobile) {
          return this.searchCustomersByPartialMobile(partialMobile, filter);
        } else if (term.length >= 2) {
          params.name = term;
        }
      }

      const response = await httpClient.get<
        { items?: Array<Record<string, unknown>>; customers?: Array<Record<string, unknown>>; data?: unknown } | Array<Record<string, unknown>>
      >(
        '/admin/customers',
        {
          params,
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

      const uncachedIds = list
        .map((item) => String(item.id || item.customerId || ''))
        .filter((id) => id && !getCustomerPhone(id));
      if (uncachedIds.length > 0) {
        await Promise.all(
          uncachedIds.map(async (id) => {
            try {
              const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${id}`);
              const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
              const mobile = String(detail?.mobile || detail?.phone || '');
              if (mobile && !mobile.includes('*')) {
                const formatted = formatPhoneNumber(mobile);
                setCustomerPhone(id, formatted);
                if (detail.userId) setCustomerPhone(String(detail.userId), formatted);
              }
              const email = String(detail?.email || detail?.unmaskedEmail || '');
              if (email && !email.includes('*')) {
                setCustomerEmail(id, email.trim());
                if (detail.userId) setCustomerEmail(String(detail.userId), email.trim());
              }
            } catch {
              // Ignore individual failure
            }
          })
        );
      }

      return list.map(mapBackendCustomerToCustomer);
    } catch (err: unknown) {
      const isValidationError =
        (err as { name?: string })?.name === 'ValidationError' ||
        (err as { status?: number })?.status === 400 ||
        (err as { response?: { status?: number } })?.response?.status === 400 ||
        (err instanceof Error && err.message?.toLowerCase().includes('validation failed'));

      if (filter?.searchTerm && isValidationError) {
        return [];
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCustomersPage(
    filter?: CustomerFilterCriteria,
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerPageResult> {
    try {
      const term = filter?.searchTerm?.trim();

      if (term && isUuidOrCustomerId(term)) {
        try {
          const detail = await this.getCustomerById(term);
          if (detail) {
            return {
              items: [detail],
              total: 1,
              page: 1,
              limit,
              hasMore: false,
            };
          }
        } catch {
          return {
            items: [],
            total: 0,
            page: 1,
            limit,
            hasMore: false,
          };
        }
      }

      const params: Record<string, unknown> = {
        page,
        limit,
      };

      if (filter?.status && filter.status !== 'ALL') {
        params.accountStatus = filter.status;
      }
      if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
        params.verificationStatus = filter.verificationStatus;
      }

      if (term) {
        const canonicalMobile = extractCanonicalMobileDigits(term);
        const partialMobile = !canonicalMobile ? extractSearchMobileDigits(term) : null;
        if (canonicalMobile) {
          params.mobile = canonicalMobile;
        } else if (partialMobile) {
          const allMatched = await this.searchCustomersByPartialMobile(partialMobile, filter);
          const total = allMatched.length;
          const startIndex = (page - 1) * limit;
          const items = allMatched.slice(startIndex, startIndex + limit);
          return {
            items,
            total,
            page,
            limit,
            hasMore: startIndex + limit < total,
          };
        } else if (term.length >= 2) {
          params.name = term;
        }
      }

      const response = await httpClient.get<
        { items?: Array<Record<string, unknown>>; customers?: Array<Record<string, unknown>>; data?: unknown; meta?: Record<string, unknown> } | Array<Record<string, unknown>>
      >(
        '/admin/customers',
        {
          params,
        }
      );

      const rawData = response.data as Record<string, unknown>;
      let list: Record<string, unknown>[] = [];
      let meta: Record<string, unknown> | undefined;

      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (rawData && typeof rawData === 'object') {
        if (rawData.meta && typeof rawData.meta === 'object') {
          meta = rawData.meta as Record<string, unknown>;
        }
        if (Array.isArray(rawData.items)) {
          list = rawData.items as Record<string, unknown>[];
        } else if (Array.isArray(rawData.customers)) {
          list = rawData.customers as Record<string, unknown>[];
        } else if (Array.isArray(rawData.data)) {
          list = rawData.data as Record<string, unknown>[];
        } else if (rawData.data && typeof rawData.data === 'object') {
          const nested = rawData.data as Record<string, unknown>;
          if (nested.meta && typeof nested.meta === 'object') {
            meta = nested.meta as Record<string, unknown>;
          }
          if (Array.isArray(nested.items)) {
            list = nested.items as Record<string, unknown>[];
          } else if (Array.isArray(nested.customers)) {
            list = nested.customers as Record<string, unknown>[];
          } else if (Array.isArray(nested.data)) {
            list = nested.data as Record<string, unknown>[];
          }
        }
      }

      const total = Number(
        meta?.total ??
        meta?.totalItems ??
        meta?.count ??
        list.length
      );
      const currentPage = Number(meta?.page ?? meta?.currentPage ?? page);
      const currentLimit = Number(meta?.limit ?? meta?.itemsPerPage ?? limit);
      const totalPages = meta?.totalPages ? Number(meta.totalPages) : (total > 0 ? Math.ceil(total / currentLimit) : 1);
      const hasMore = currentPage < totalPages && list.length > 0;

      return {
        items: list.map(mapBackendCustomerToCustomer),
        total,
        page: currentPage,
        limit: currentLimit,
        hasMore,
      };
    } catch (err: unknown) {
      const isValidationError =
        (err as { name?: string })?.name === 'ValidationError' ||
        (err as { status?: number })?.status === 400 ||
        (err as { response?: { status?: number } })?.response?.status === 400 ||
        (err instanceof Error && err.message?.toLowerCase().includes('validation failed'));

      if (filter?.searchTerm && isValidationError) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        };
      }
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

      const userObj = (target.user && typeof target.user === 'object' ? target.user : {}) as Record<string, unknown>;
      const targetUserId = String(target.userId || userObj.id || '');

      const [notesRes, bookingsRes, ticketsRes] = await Promise.allSettled([
        httpClient.get<{ data?: unknown; items?: unknown } | unknown[]>(
          `/admin/customers/${encodeURIComponent(id)}/notes`,
          { params: { limit: 100 } }
        ),
        targetUserId
          ? httpClient.get<{ data?: unknown; items?: unknown } | unknown[]>(
              '/admin/bookings',
              { params: { customerUserId: targetUserId, limit: 100 } }
            )
          : Promise.resolve(null),
        targetUserId
          ? httpClient.get<{ data?: unknown; items?: unknown } | unknown[]>(
              '/admin/support/tickets',
              { params: { creatorUserId: targetUserId, limit: 100 } }
            )
          : Promise.resolve(null),
      ]);

      let fetchedNotes: Array<string | CustomerNote> | undefined;
      if (notesRes.status === 'fulfilled' && notesRes.value?.data) {
        const nData = notesRes.value.data as Record<string, unknown>;
        const rawList = Array.isArray(nData) ? nData : Array.isArray(nData.data) ? nData.data : Array.isArray(nData.items) ? nData.items : [];
        if (rawList.length > 0) {
          fetchedNotes = (rawList as Record<string, unknown>[]).map((item) => ({
            id: String(item.id || ''),
            authorId: String(item.authorId || item.author || 'Administrative Staff'),
            note: String(item.note || item.content || item.text || ''),
            createdAt: String(item.createdAt || item.timestamp || ''),
          }));
        }
      }

      let fetchedBookings: CustomerBookingSummary[] | undefined;
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.data) {
        const bData = bookingsRes.value.data as Record<string, unknown>;
        const rawList = Array.isArray(bData) ? bData : Array.isArray(bData.data) ? bData.data : Array.isArray(bData.items) ? bData.items : [];
        if (rawList.length > 0) {
          fetchedBookings = (rawList as Record<string, unknown>[]).map((b) => {
            const cat = (b.category && typeof b.category === 'object' ? b.category : {}) as Record<string, unknown>;
            return {
              bookingId: String(b.id || b.bookingId || ''),
              category: String(cat.name || cat.id || b.serviceCategory || b.category || 'Household Service'),
              workerName: b.workerName ? String(b.workerName) : undefined,
              status: String(b.status || 'CONFIRMED'),
              date: String(b.scheduledAt || b.requestedStartDate || b.startDate || b.createdAt || 'Recent'),
            };
          });
        }
      }

      let fetchedComplaints: CustomerComplaintSummary[] | undefined;
      if (ticketsRes.status === 'fulfilled' && ticketsRes.value?.data) {
        const tData = ticketsRes.value.data as Record<string, unknown>;
        const rawList = Array.isArray(tData) ? tData : Array.isArray(tData.data) ? tData.data : Array.isArray(tData.items) ? tData.items : [];
        if (rawList.length > 0) {
          fetchedComplaints = (rawList as Record<string, unknown>[]).map((t) => {
            const cat = (t.category && typeof t.category === 'object' ? t.category : {}) as Record<string, unknown>;
            return {
              ticketId: String(t.id || t.ticketId || ''),
              disputeCategory: String(cat.name || cat.id || t.disputeCategory || 'General Support'),
              serviceCategory: t.serviceCategory ? String(t.serviceCategory) : undefined,
              status: String(t.status || 'OPEN'),
              createdAt: String(t.createdAt || 'Recent'),
              description: t.description ? String(t.description) : undefined,
            };
          });
        }
      }

      return mapBackendCustomerDetailToCustomerDetail(
        target,
        etag,
        fetchedNotes,
        fetchedBookings,
        fetchedComplaints
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    try {
      const res = await httpClient.get<{ data?: unknown; items?: unknown } | unknown[]>(
        `/admin/customers/${encodeURIComponent(customerId)}/notes`,
        { params: { limit: 100 } }
      );
      const data = res.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.data)
        ? (data as Record<string, unknown>).data
        : Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown>).items
        : [];
      return (rawList as Record<string, unknown>[]).map((item) => ({
        id: String(item.id || ''),
        authorId: String(item.authorId || item.author || 'Administrative Staff'),
        note: String(item.note || item.content || item.text || ''),
        createdAt: String(item.createdAt || item.timestamp || ''),
      }));
    } catch {
      return [];
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
      // 1. Fetch customer to obtain userId
      const customer = await this.getCustomerById(customerId).catch(() => null);
      const targetUserId = customer?.userId || customerId;

      // 2. Change account status via /admin/users/{userId}/status sending If-Match wildcard
      await httpClient.patch(
        `/admin/users/${encodeURIComponent(targetUserId)}/status`,
        {
          status: 'SUSPENDED',
          reason: remarks,
        },
        { headers: { 'If-Match': '*' } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    try {
      // 1. Fetch customer to obtain userId
      const customer = await this.getCustomerById(customerId).catch(() => null);
      const targetUserId = customer?.userId || customerId;

      // 2. Reactivate account status via /admin/users/{userId}/status sending If-Match wildcard
      await httpClient.patch(
        `/admin/users/${encodeURIComponent(targetUserId)}/status`,
        {
          status: 'ACTIVE',
          reason: 'Account restored by operations staff',
        },
        { headers: { 'If-Match': '*' } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateCustomerVerificationStatus(
    customerId: string,
    status: 'PENDING' | 'VERIFIED',
    note?: string
  ): Promise<void> {
    try {
      const customer = await this.getCustomerById(customerId).catch(() => null);
      const ifMatchHeader = customer?.etag || '*';
      await httpClient.patch(
        `/admin/customers/${encodeURIComponent(customerId)}/verification-status`,
        {
          status,
          ...(note?.trim() ? { note: note.trim() } : {}),
        },
        { headers: { 'If-Match': ifMatchHeader } }
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
      const term = filter.searchTerm.toLowerCase().trim();
      const mobileDigits = extractSearchMobileDigits(term);
      const cleanDigits = term.replace(/\D/g, '');

      result = result.filter((c) => {
        if (
          c.name.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          c.locality.toLowerCase().includes(term)
        ) {
          return true;
        }
        const target = mobileDigits || cleanDigits;
        if (target.length >= 2) {
          const phoneCandidates = [
            c.unmaskedPhone,
            c.phone,
            c.maskedPhone,
            getCustomerPhone(c.id),
          ].filter(Boolean) as string[];

          for (const p of phoneCandidates) {
            if (matchesPhoneDigits(p, target)) {
              return true;
            }
          }
        }
        return false;
      });
    }

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((c) => c.status === filter.status);
    }

    if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
      result = result.filter((c) => c.verificationStatus === filter.verificationStatus);
    }

    if (filter?.locality && filter.locality !== 'ALL') {
      result = result.filter((c) => c.locality === filter.locality);
    }

    return result.map(({ bookings: _b, notes: _n, fullAddress: _fa, unmaskedPhone: _up, unmaskedEmail: _ue, totalSpendINR: _ts, activeBookings: _ab, openGrievances: _og, complaints: _c, ...summary }) => summary);
  }

  async getCustomersPage(
    filter?: CustomerFilterCriteria,
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerPageResult> {
    const all = await this.getCustomers(filter);
    const total = all.length;
    const startIndex = (page - 1) * limit;
    const items = all.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;
    return {
      items,
      total,
      page,
      limit,
      hasMore,
    };
  }

  async getCustomerById(id: string): Promise<CustomerDetail | null> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === id);
    return customer ? { ...customer } : null;
  }

  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (!customer) return [];
    return customer.notes.map((n, idx) => {
      if (typeof n === 'object' && n !== null) return n as CustomerNote;
      return {
        id: `mock-note-${idx}`,
        authorId: 'STAFF-OPS-01',
        note: String(n),
        createdAt: new Date().toISOString(),
      };
    });
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
      customer.notes.push(`[ACCOUNT SUSPENDED] ${remarks}`);
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.status = 'ACTIVE';
      customer.notes.push('[ACCOUNT REACTIVATED] Account restored by operations staff');
    }
  }

  async updateCustomerVerificationStatus(
    customerId: string,
    status: 'PENDING' | 'VERIFIED',
    note?: string
  ): Promise<void> {
    const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId);
    if (customer) {
      customer.verificationStatus = status;
      customer.notes.push(
        `[VERIFICATION: ${status}]${note?.trim() ? ` ${note.trim()}` : ''}`
      );
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
