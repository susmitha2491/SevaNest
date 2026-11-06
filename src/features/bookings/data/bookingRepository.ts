import {
  BookingDetail,
  CandidateMatch,
  TrialSchedule,
  TrialOutcome,
  BookingFilterCriteria,
  PaginatedBookings,
  IBookingRepository,
  MatchRequirement,
  BookingHistoryData,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import {
  getCustomerPhone,
  getWorkerPhone,
  preloadCustomerPhones,
  preloadWorkerPhones,
  formatPhoneNumber,
  setCustomerPhone,
  setCustomerEmail,
  setWorkerPhone,
} from '../../../core/utils/phoneDirectory';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

export class MockBookingRepository implements IBookingRepository {
  private bookings: BookingDetail[] = [
    {
      id: 'B-84920',
      customerId: 'C-1092',
      customerName: 'Anand Sharma',
      customerPhoneMasked: '+91 98765 *****',
      customerLocality: 'Kondapur',
      serviceCategory: 'House Maid',
      engagementType: 'PART_TIME',
      timingShift: 'Morning (07:00 AM - 10:00 AM)',
      salaryBudgetMax: 8000,
      specialRequirements: 'Deep kitchen cleaning, vegetarian household, pet-friendly (1 dog).',
      status: 'REQUESTED',
      createdAt: 'Recent Submission',
      platformFeePaid: true,
      platformFeeAmount: 499,
      internalNotes: ['Customer requested candidate with minimum 3 years experience in gated communities.'],
    },
    {
      id: 'B-84912',
      customerId: 'C-2091',
      customerName: 'Priya Reddy',
      customerPhoneMasked: '+91 94401 *****',
      customerLocality: 'Gachibowli',
      serviceCategory: 'Cook',
      engagementType: 'FULL_TIME_LIVE_OUT',
      timingShift: 'Split Shift (07:00 AM - 11:00 AM & 06:00 PM - 09:00 PM)',
      salaryBudgetMax: 18000,
      specialRequirements: 'South & North Indian cuisine, diabetic-friendly low oil preparations.',
      assignedWorkerId: 'W-10484',
      assignedWorkerName: 'Meena Bai',
      assignedWorkerPhoneMasked: '+91 91234 *****',
      status: 'REPLACEMENT_REQUESTED',
      createdAt: 'Recent Request',
      platformFeePaid: true,
      platformFeeAmount: 1499,
      serviceStartDate: 'Prior Engagement Active',
      replacement: {
        id: 'REP-84912',
        bookingId: 'B-84912',
        requestedAt: 'Recent Handoff',
        reasonCategory: 'Skill Mismatch / Food Preparation Quality',
        customerExplanation: 'Worker struggled with specific diabetic dietary menu requirements.',
        eligibleUnderPolicy: true,
        coveragePlanName: '30-Day Free Replacement Guarantee',
        priorWorkerId: 'W-10484',
        priorWorkerName: 'Meena Bai',
        status: 'REQUESTED',
        operationalRemarks: 'Customer reported issue on day 12 of placement; covered under active policy.',
      },
      internalNotes: ['Priority rematch required. Customer has active 30-day placement guarantee.'],
    },
    {
      id: 'B-84890',
      customerId: 'C-3081',
      customerName: 'Rajesh Kumar',
      customerPhoneMasked: '+91 99881 *****',
      customerLocality: 'Madhapur',
      serviceCategory: 'Driver',
      engagementType: 'FULL_TIME_LIVE_OUT',
      timingShift: 'Day Shift (08:30 AM - 07:30 PM)',
      salaryBudgetMax: 22000,
      specialRequirements: 'Automatic transmission luxury sedan experience, valid commercial badge.',
      assignedWorkerId: 'W-10483',
      assignedWorkerName: 'Ramesh Yadav',
      assignedWorkerPhoneMasked: '+91 98450 *****',
      status: 'INTERVIEW_SCHEDULED',
      createdAt: 'Recent Coordination',
      platformFeePaid: true,
      platformFeeAmount: 499,
      trial: {
        scheduledDate: 'Upcoming Slot',
        timeSlot: '10:00 AM - 12:00 PM',
        durationHours: 2,
        customerAddress: 'Villa 14, Silicon Springs, Madhapur',
        contactPerson: 'Rajesh Kumar',
        contactPhone: '+91 99881 *****',
        trialFeeAmount: 250,
        notes: 'Customer will test city driving route and parking skills.',
      },
      internalNotes: ['Candidate informed and confirmed trial slot. Reminder SMS dispatched.'],
    },
    {
      id: 'B-84870',
      customerId: 'C-4019',
      customerName: 'Sneha Patel',
      customerPhoneMasked: '+91 97001 *****',
      customerLocality: 'Hitec City',
      serviceCategory: 'Babysitter',
      engagementType: 'FULL_TIME_LIVE_IN',
      timingShift: 'Full Time Live-in',
      salaryBudgetMax: 24000,
      specialRequirements: 'Infant care (8-month baby), CPR training preferred, non-smoker.',
      assignedWorkerId: 'W-10485',
      assignedWorkerName: 'Lakshmi Devi',
      assignedWorkerPhoneMasked: '+91 99887 *****',
      status: 'SERVICE_ACTIVE',
      createdAt: 'Active Contract',
      platformFeePaid: true,
      platformFeeAmount: 2499,
      serviceStartDate: 'Contract Active',
      contractPeriod: '12 Months Placement',
      internalNotes: ['Trial concluded successfully with positive feedback. Platform fee settled.'],
    },
    {
      id: 'B-84850',
      customerId: 'C-5120',
      customerName: 'Deepak Rao',
      customerPhoneMasked: '+91 98499 *****',
      customerLocality: 'Jubilee Hills',
      serviceCategory: 'Elderly Care Helper',
      engagementType: 'FULL_TIME_LIVE_IN',
      timingShift: 'Full Time 24x7 Assistance',
      salaryBudgetMax: 26000,
      specialRequirements: 'Mobility support for 78-year-old gentleman, medicine reminders, Telugu speaking.',
      assignedWorkerId: 'W-10486',
      assignedWorkerName: 'Anil Rao',
      assignedWorkerPhoneMasked: '+91 97112 *****',
      status: 'CONFIRMED',
      createdAt: 'Recent Confirmation',
      platformFeePaid: true,
      platformFeeAmount: 1999,
      trialOutcome: {
        outcome: 'SUCCEEDED',
        feedbackRemarks: 'Patient felt very comfortable during trial. Ready to start service.',
        customerConfirmed: true,
      },
      internalNotes: ['Trial passed. Joining date agreed with family.'],
    },
    {
      id: 'B-84810',
      customerId: 'C-6002',
      customerName: 'Kavita Menon',
      customerPhoneMasked: '+91 91100 *****',
      customerLocality: 'Banjara Hills',
      serviceCategory: 'House Maid',
      engagementType: 'PART_TIME',
      timingShift: 'Evening (05:00 PM - 07:00 PM)',
      salaryBudgetMax: 6000,
      status: 'CANCELLED',
      createdAt: 'Cancelled',
      platformFeePaid: false,
      platformFeeAmount: 0,
      internalNotes: ['Customer relocated out of city before trial.'],
    },
  ];

  private candidatesPool: CandidateMatch[] = [
    {
      workerId: 'W-10482',
      workerName: 'Sunita Devi',
      category: 'House Maid',
      experienceYears: 6,
      ratingAverage: 4.8,
      totalReviews: 28,
      locality: 'Kondapur',
      isFullyVerified: true,
      languages: ['Hindi', 'Telugu'],
      matchScore: 96,
      dailyRateEstimate: 350,
    },
    {
      workerId: 'W-10487',
      workerName: 'Radha Rani',
      category: 'House Maid',
      experienceYears: 5,
      ratingAverage: 4.7,
      totalReviews: 19,
      locality: 'Kondapur',
      isFullyVerified: true,
      languages: ['Hindi', 'Telugu'],
      matchScore: 91,
      dailyRateEstimate: 320,
    },
    {
      workerId: 'W-10488',
      workerName: 'Shanti Kumari',
      category: 'House Maid',
      experienceYears: 8,
      ratingAverage: 4.9,
      totalReviews: 34,
      locality: 'Gachibowli',
      isFullyVerified: true,
      languages: ['Hindi', 'English (Basic)'],
      matchScore: 88,
      dailyRateEstimate: 380,
    },
    {
      workerId: 'W-10489',
      workerName: 'Basheer Khan',
      category: 'Cook',
      experienceYears: 7,
      ratingAverage: 4.9,
      totalReviews: 24,
      locality: 'Gachibowli',
      isFullyVerified: true,
      languages: ['Hindi', 'Telugu', 'Urdu'],
      matchScore: 95,
      dailyRateEstimate: 600,
    },
    {
      workerId: 'W-10490',
      workerName: 'Suresh Patil',
      category: 'Driver',
      experienceYears: 10,
      ratingAverage: 4.8,
      totalReviews: 42,
      locality: 'Madhapur',
      isFullyVerified: true,
      languages: ['Hindi', 'Telugu', 'English'],
      matchScore: 97,
      dailyRateEstimate: 700,
    },
  ];

  async getBookings(filter?: BookingFilterCriteria): Promise<PaginatedBookings> {
    let result = [...this.bookings];

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((b) => b.status === filter.status);
    }

    if (filter?.category && filter.category !== 'ALL') {
      result = result.filter((b) => b.serviceCategory === filter.category);
    }

    if (filter?.locality && filter.locality !== 'ALL') {
      result = result.filter((b) => b.customerLocality === filter.locality);
    }

    if (filter?.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      result = result.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          (b.assignedWorkerName && b.assignedWorkerName.toLowerCase().includes(q)) ||
          b.customerLocality.toLowerCase().includes(q)
      );
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  async getBookingById(id: string): Promise<BookingDetail | null> {
    const item = this.bookings.find((b) => b.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async getCandidateSuggestions(bookingId: string): Promise<CandidateMatch[]> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) return [];

    // Filter strictly verified candidates in matching category
    return this.candidatesPool.filter(
      (c) => c.isFullyVerified && (c.category === booking.serviceCategory || c.locality === booking.customerLocality)
    );
  }

  async matchCandidates(requirement: MatchRequirement): Promise<CandidateMatch[]> {
    return this.candidatesPool.filter(
      (c) => c.isFullyVerified && (c.category.toLowerCase().includes(requirement.category.toLowerCase()) || requirement.category.toLowerCase().includes(c.category.toLowerCase()))
    );
  }

  async scheduleTrial(bookingId: string, candidateWorkerId: string, trial: TrialSchedule): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    const candidate = this.candidatesPool.find((c) => c.workerId === candidateWorkerId);
    if (booking && candidate) {
      booking.assignedWorkerId = candidate.workerId;
      booking.assignedWorkerName = candidate.workerName;
      booking.assignedWorkerPhoneMasked = '+91 98*** *****';
      booking.status = 'INTERVIEW_SCHEDULED';
      booking.trial = trial;
      booking.internalNotes.push(`Trial coordinated with verified candidate ${candidate.workerName} (${candidate.workerId}).`);
    }
  }

  async recordTrialOutcome(bookingId: string, outcome: TrialOutcome): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.trialOutcome = outcome;
      if (outcome.outcome === 'SUCCEEDED') {
        booking.status = 'CONFIRMED';
        booking.internalNotes.push(`Trial succeeded: Customer confirmed candidate.`);
      } else {
        booking.status = 'REQUESTED';
        booking.assignedWorkerId = undefined;
        booking.assignedWorkerName = undefined;
        booking.internalNotes.push(`Trial outcome: ${outcome.outcome}. Re-opened for candidate matching.`);
      }
    }
  }

  async confirmBooking(bookingId: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'SERVICE_ACTIVE';
      booking.serviceStartDate = 'Service Active';
      booking.internalNotes.push('Booking confirmed and service marked active.');
    }
  }

  async processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    const replacementCandidate = this.candidatesPool.find((c) => c.workerId === replacementWorkerId);
    if (booking && replacementCandidate) {
      if (booking.replacement) {
        booking.replacement.replacementWorkerId = replacementCandidate.workerId;
        booking.replacement.replacementWorkerName = replacementCandidate.workerName;
        booking.replacement.status = 'FULFILLED';
        booking.replacement.operationalRemarks = remarks;
      }
      booking.assignedWorkerId = replacementCandidate.workerId;
      booking.assignedWorkerName = replacementCandidate.workerName;
      booking.status = 'SERVICE_ACTIVE';
      booking.internalNotes.push(`Replacement fulfilled with verified worker ${replacementCandidate.workerName}. Remarks: ${remarks}`);
    }
  }

  async cancelBooking(bookingId: string, remarks: string, reasonCategory: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'CANCELLED';
      booking.internalNotes.push(`Cancelled (${reasonCategory}): ${remarks}`);
    }
  }

  async approveReplacement(requestId: string, remarks?: string): Promise<void> {
    const booking = this.bookings.find(
      (b) => b.replacement?.id === requestId || b.id === requestId
    );
    if (booking?.replacement) {
      booking.replacement.status = 'APPROVED';
      booking.replacement.decisionRemarks = remarks || 'Approved by Operations Admin';
      booking.replacement.decidedAt = new Date().toISOString();
      booking.internalNotes.push(`Replacement request approved: ${remarks || 'Eligibility confirmed'}`);
    }
  }

  async rejectReplacement(requestId: string, remarks: string): Promise<void> {
    const booking = this.bookings.find(
      (b) => b.replacement?.id === requestId || b.id === requestId
    );
    if (booking?.replacement) {
      booking.replacement.status = 'REJECTED';
      booking.replacement.decisionRemarks = remarks;
      booking.replacement.decidedAt = new Date().toISOString();
      booking.status = 'SERVICE_ACTIVE';
      booking.internalNotes.push(`Replacement request rejected (${remarks}). Reverted to Active Service.`);
    }
  }

  async getReplacementCandidates(_requestId: string): Promise<CandidateMatch[]> {
    return this.candidatesPool.filter((c) => c.isFullyVerified);
  }

  async selectReplacementWorker(requestId: string, workerId: string): Promise<void> {
    const booking = this.bookings.find(
      (b) => b.replacement?.id === requestId || b.id === requestId
    );
    const candidate = this.candidatesPool.find((c) => c.workerId === workerId);
    if (booking && candidate) {
      if (booking.replacement) {
        booking.replacement.replacementWorkerId = candidate.workerId;
        booking.replacement.replacementWorkerName = candidate.workerName;
        booking.replacement.status = 'FULFILLED';
      }
      booking.assignedWorkerId = candidate.workerId;
      booking.assignedWorkerName = candidate.workerName;
      booking.status = 'SERVICE_ACTIVE';
      booking.internalNotes.push(`Replacement worker assigned: ${candidate.workerName} (${candidate.workerId})`);
    }
  }

  async getBookingHistory(bookingId: string): Promise<BookingHistoryData> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    return {
      timeline: [
        {
          from: null,
          to: 'NEW_REQUEST',
          by: 'CUSTOMER',
          note: 'Customer submitted service requirement',
          at: booking?.createdAt || '2026-10-09T04:43:26.642Z',
          actorUserId: booking?.customerId || null,
        },
        {
          from: 'NEW_REQUEST',
          to: booking?.status || 'SERVICE_ACTIVE',
          by: 'STAFF',
          note: 'Operations processing & dispatch',
          at: new Date().toISOString(),
          actorUserId: 'ops-admin-01',
        },
      ],
      interviews: booking?.trial
        ? [
            {
              id: `int-${booking.id}`,
              type: 'TRIAL',
              status: booking.trialOutcome?.outcome === 'SUCCEEDED' ? 'COMPLETED' : 'SCHEDULED',
              statusLabel: booking.trialOutcome?.outcome === 'SUCCEEDED' ? 'Completed' : 'Scheduled',
              scheduledAt: booking.trial.scheduledDate,
              outcomeNote: booking.trialOutcome?.feedbackRemarks,
              createdAt: booking.createdAt,
            },
          ]
        : [],
      replacementChain: booking?.replacement
        ? [
            {
              bookingId: booking.id,
              position: 1,
              status: booking.status,
              workerId: booking.replacement.priorWorkerId,
              createdAt: booking.replacement.requestedAt,
              current: true,
            },
          ]
        : [],
    };
  }
}

interface CachedCustomer {
  id: string;
  userId: string;
  name: string;
  mobile?: string;
  email?: string;
}

interface CachedWorker {
  id: string;
  userId?: string;
  name: string;
  mobile?: string;
  isFullyVerified?: boolean;
}

let customerRegistryCache: Map<string, CachedCustomer> | null = null;
let workerRegistryCache: Map<string, CachedWorker> | null = null;
let lastCustomerFetch = 0;
let lastWorkerFetch = 0;

export async function getCustomerRegistry(): Promise<Map<string, CachedCustomer>> {
  const now = Date.now();
  if (customerRegistryCache && now - lastCustomerFetch < 60000) {
    return customerRegistryCache;
  }
  try {
    const res = await httpClient.get<{
      data?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
      customers?: Array<Record<string, unknown>>;
    }>('/admin/customers', {
      params: { limit: 100 },
    });
    const raw = res.data;
    const list = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray(raw?.data)
      ? (raw.data as Record<string, unknown>[])
      : Array.isArray(raw?.customers)
      ? (raw.customers as Record<string, unknown>[])
      : Array.isArray(raw?.items)
      ? (raw.items as Record<string, unknown>[])
      : [];
    const map = new Map<string, CachedCustomer>();
    for (const c of list) {
      const id = String(c.id || c.customerId || '');
      const userId = String(c.userId || '');
      const name = String(c.name || c.fullName || '').trim();
      const mobile = String(c.mobile || c.phone || '').trim();
      const email = String(c.email || '').trim();
      const entry: CachedCustomer = { id, userId, name, mobile, email };
      if (id) map.set(id, entry);
      if (userId) map.set(userId, entry);
      if (mobile && !mobile.includes('*')) {
        setCustomerPhone(id, mobile);
        if (userId) setCustomerPhone(userId, mobile);
      }
      if (email && !email.includes('*')) {
        setCustomerEmail(id, email);
        if (userId) setCustomerEmail(userId, email);
      }
    }
    customerRegistryCache = map;
    lastCustomerFetch = now;
    return map;
  } catch {
    return customerRegistryCache || new Map();
  }
}

export async function getWorkerRegistry(): Promise<Map<string, CachedWorker>> {
  const now = Date.now();
  if (workerRegistryCache && now - lastWorkerFetch < 60000) {
    return workerRegistryCache;
  }
  try {
    const res = await httpClient.get<{
      data?: Array<Record<string, unknown>>;
      workers?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    }>('/admin/workers', {
      params: { limit: 100 },
    });
    const raw = res.data;
    const list = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray(raw?.data)
      ? (raw.data as Record<string, unknown>[])
      : Array.isArray(raw?.workers)
      ? (raw.workers as Record<string, unknown>[])
      : Array.isArray(raw?.items)
      ? (raw.items as Record<string, unknown>[])
      : [];
    const map = new Map<string, CachedWorker>();
    for (const w of list) {
      const id = String(w.id || w.workerId || '');
      const userId = String(w.userId || '');
      const name = String(w.name || w.fullName || '').trim();
      const mobile = String(w.mobile || w.phone || '').trim();
      const isFullyVerified = Boolean(w.isFullyVerified);
      const entry: CachedWorker = { id, userId, name, mobile, isFullyVerified };
      if (id) map.set(id, entry);
      if (userId) map.set(userId, entry);
      if (mobile && !mobile.includes('*')) {
        setWorkerPhone(id, mobile);
        if (userId) setWorkerPhone(userId, mobile);
      }
    }
    workerRegistryCache = map;
    lastWorkerFetch = now;
    return map;
  } catch {
    return workerRegistryCache || new Map();
  }
}

function mapBackendBookingToDomain(
  raw: Record<string, unknown>,
  customerMap?: Map<string, CachedCustomer>,
  workerMap?: Map<string, CachedWorker>
): BookingDetail {
  const customer = raw.customer as Record<string, unknown> | undefined;
  const worker = raw.worker as Record<string, unknown> | undefined;
  const category = raw.category as Record<string, unknown> | string | undefined;
  const area = raw.area as Record<string, unknown> | string | undefined;

  const categoryName =
    typeof category === 'object' && category !== null
      ? String(category.name || category.code || 'General')
      : String(category || raw.serviceCategory || 'General');

  const localityName =
    typeof area === 'object' && area !== null
      ? String(area.name || area.city || 'Hyderabad')
      : String(area || raw.customerLocality || raw.locality || 'Hyderabad');

  const salaryBudgetMax =
    raw.budgetMaxMinor !== undefined && raw.budgetMaxMinor !== null
      ? Number(raw.budgetMaxMinor) / 100
      : Number(raw.salaryBudgetMax || raw.budget || 0);

  const custId = String(raw.customerId || customer?.id || raw.customerUserId || '');
  const custUserKey = String(raw.customerUserId || '');
  const custObj = (custUserKey ? customerMap?.get(custUserKey) : undefined) || (custId ? customerMap?.get(custId) : undefined);

  const cachedCustPhone = getCustomerPhone(custId) || getCustomerPhone(custUserKey);
  const rawCustPhone = custObj?.mobile || raw.customerPhone || raw.phone || (raw.customerPhoneMasked && !String(raw.customerPhoneMasked).includes('*') ? raw.customerPhoneMasked : undefined);
  const cleanCustPhone = cachedCustPhone || (rawCustPhone ? formatPhoneNumber(String(rawCustPhone)) : undefined);

  const wrkId = String(raw.assignedWorkerId || worker?.id || raw.workerId || '');
  const wrkObj = wrkId ? workerMap?.get(wrkId) : undefined;
  const cachedWrkPhone = getWorkerPhone(wrkId) || getWorkerPhone(String(raw.workerUserId || ''));
  const rawWrkPhone = wrkObj?.mobile || raw.assignedWorkerPhone || raw.workerPhone || (raw.assignedWorkerPhoneMasked && !String(raw.assignedWorkerPhoneMasked).includes('*') ? raw.assignedWorkerPhoneMasked : undefined);
  const cleanWrkPhone = cachedWrkPhone || (rawWrkPhone ? formatPhoneNumber(String(rawWrkPhone)) : undefined);

  const isIdLike = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
    /^[0-9a-f]{20,}$/i.test(str) ||
    str.toLowerCase().startsWith('customer (');

  let customerName = String(
    raw.customerName ||
      customer?.fullName ||
      customer?.name ||
      custObj?.name ||
      ''
  ).trim();

  // Strictly eliminate generic `Customer (ID)` or substituted raw IDs
  if (!customerName || isIdLike(customerName)) {
    if (custObj?.name && !isIdLike(custObj.name)) {
      customerName = custObj.name;
    } else {
      customerName = 'Customer Details Unavailable';
    }
  }

  let assignedWorkerName = String(
    raw.assignedWorkerName ||
      worker?.fullName ||
      worker?.name ||
      raw.workerName ||
      wrkObj?.name ||
      ''
  ).trim();

  if (isIdLike(assignedWorkerName)) {
    assignedWorkerName = (wrkObj?.name && !isIdLike(wrkObj.name)) ? wrkObj.name : '';
  }

  const rawStatus = String(raw.status || 'REQUESTED');
  let domainStatus: BookingDetail['status'] = rawStatus as BookingDetail['status'];
  if (rawStatus === 'ACTIVE') domainStatus = 'SERVICE_ACTIVE';
  else if (rawStatus === 'NEW_REQUEST') domainStatus = 'REQUESTED';
  else if (rawStatus === 'INTERVIEW_TRIAL_SCHEDULED') domainStatus = 'INTERVIEW_SCHEDULED';

  return {
    id: String(raw.id || raw.bookingId || ''),
    customerId: custId,
    customerName,
    customerPhoneMasked: String(cleanCustPhone || raw.customerPhoneMasked || customer?.phoneMasked || custObj?.mobile || '+91 98765 43210'),
    customerLocality: localityName,
    serviceCategory: categoryName,
    engagementType: (raw.engagementType as BookingDetail['engagementType']) || 'FULL_TIME_LIVE_OUT',
    timingShift: String(raw.timingShift || raw.shift || 'General'),
    salaryBudgetMax,
    specialRequirements: String(raw.specialRequirements || raw.requirementNote || raw.notes || ''),
    assignedWorkerId: wrkId || undefined,
    assignedWorkerName: assignedWorkerName || undefined,
    assignedWorkerPhoneMasked: (cleanWrkPhone || raw.assignedWorkerPhoneMasked || worker?.phoneMasked) ? String(cleanWrkPhone || raw.assignedWorkerPhoneMasked || worker?.phoneMasked) : undefined,
    status: domainStatus,
    createdAt: String(raw.createdAt || 'Recent'),
    serviceStartDate: (raw.startDate || raw.requestedStartDate || raw.serviceStartDate) ? String(raw.startDate || raw.requestedStartDate || raw.serviceStartDate) : undefined,
    contractPeriod: raw.contractPeriod ? String(raw.contractPeriod) : undefined,
    platformFeePaid: Boolean(raw.platformFeePaid ?? true),
    platformFeeAmount: Number(raw.platformFeeAmount || 499),
    internalNotes: Array.isArray(raw.internalNotes) ? (raw.internalNotes as string[]) : [],
    trial: raw.trial as BookingDetail['trial'],
    trialOutcome: raw.trialOutcome as BookingDetail['trialOutcome'],
    replacement: raw.replacement as BookingDetail['replacement'],
  };
}

export class RealBookingRepository implements IBookingRepository {
  async getBookings(filter?: BookingFilterCriteria): Promise<PaginatedBookings> {
    try {
      const [customerMap, workerMap] = await Promise.all([
        getCustomerRegistry(),
        getWorkerRegistry(),
        preloadCustomerPhones().catch(() => {}),
        preloadWorkerPhones().catch(() => {}),
      ]);

      // Preload replacement requests
      const replRes = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
      }>('/admin/replacement-requests', {
        params: { limit: 100 },
      }).catch(() => null);

      const replList = Array.isArray(replRes?.data?.data)
        ? replRes.data.data
        : Array.isArray(replRes?.data)
        ? (replRes.data as Record<string, unknown>[])
        : [];
      const replMap = new Map<string, Record<string, unknown>>();
      for (const r of replList) {
        if (r.bookingId) replMap.set(String(r.bookingId), r);
      }

      let rawItems: Record<string, unknown>[] = [];
      const filterStatus = filter?.status;

      if (!filterStatus || filterStatus === 'ALL') {
        const res = await httpClient.get<{
          data?: { data?: Record<string, unknown>[]; meta?: Record<string, unknown> } | Record<string, unknown>[];
        }>('/admin/bookings', { params: { limit: 100 } });
        const payload = res.data;
        rawItems = Array.isArray((payload as { data?: { data?: Record<string, unknown>[] } })?.data?.data)
          ? (payload as { data: { data: Record<string, unknown>[] } }).data.data
          : Array.isArray((payload as { data?: Record<string, unknown>[] })?.data)
          ? (payload as { data: Record<string, unknown>[] }).data
          : Array.isArray(payload)
          ? (payload as Record<string, unknown>[])
          : [];
      } else if (filterStatus === 'REQUESTED' || filterStatus === 'NEW_REQUEST') {
        const [res1, res2] = await Promise.all([
          httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'NEW_REQUEST', limit: 100 } }).catch(() => null),
          httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'MATCHED', limit: 100 } }).catch(() => null),
        ]);
        const list1 = Array.isArray(res1?.data?.data) ? res1.data.data : Array.isArray(res1?.data) ? (res1.data as Record<string, unknown>[]) : [];
        const list2 = Array.isArray(res2?.data?.data) ? res2.data.data : Array.isArray(res2?.data) ? (res2.data as Record<string, unknown>[]) : [];
        rawItems = [...list1, ...list2];
      } else if (filterStatus === 'INTERVIEW_SCHEDULED' || filterStatus === 'INTERVIEW_TRIAL_SCHEDULED') {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'INTERVIEW_TRIAL_SCHEDULED', limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
      } else if (filterStatus === 'CONFIRMED') {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'CONFIRMED', limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
      } else if (filterStatus === 'SERVICE_ACTIVE' || filterStatus === 'ACTIVE') {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'ACTIVE', limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
      } else if (filterStatus === 'REPLACEMENT_REQUESTED') {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'REPLACEMENT_REQUESTED', limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
        for (const r of replList) {
          if (r.bookingId && !rawItems.some((b) => String(b.id) === String(r.bookingId))) {
            try {
              const bRes = await httpClient.get<{ data?: Record<string, unknown> } | Record<string, unknown>>(`/admin/bookings/${r.bookingId}`);
              const bData = (bRes.data as { data?: Record<string, unknown> })?.data || (bRes.data as Record<string, unknown>);
              if (bData && bData.id) rawItems.push(bData);
            } catch {
              // Ignore single booking fetch failure
            }
          }
        }
      } else if (filterStatus === 'CANCELLED') {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'CANCELLED', limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
      } else {
        const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: filterStatus, limit: 100 } }).catch(() => null);
        rawItems = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
      }

      // Enrich items with detail and replacement
      const enrichedItems = await Promise.all(
        rawItems.map(async (item) => {
          let merged = { ...item };
          if (!merged.customerUserId) {
            try {
              const detailRes = await httpClient.get<{ data?: Record<string, unknown> }>(`/admin/bookings/${merged.id}`);
              const detail = detailRes.data?.data || (detailRes.data as unknown as Record<string, unknown>);
              if (detail) merged = { ...merged, ...detail };
            } catch {
              // Ignore single item fetch failure
            }
          }

          const r = replMap.get(String(merged.id));
          if (r && !merged.replacement) {
            merged.replacement = {
              id: String(r.id || ''),
              bookingId: String(r.bookingId || merged.id),
              requestedAt: String(r.createdAt || 'Recent Request'),
              reasonCategory: String(r.reasonCode || r.reason || 'Service Expectation Mismatch'),
              customerExplanation: String(r.reason || r.notes || 'Customer requested worker change.'),
              eligibleUnderPolicy: true,
              coveragePlanName: 'Placement Guarantee Replacement',
              priorWorkerId: String(r.currentWorkerId || merged.workerId || ''),
              priorWorkerName: String(workerMap.get(String(r.currentWorkerId || merged.workerId))?.name || 'Prior Worker'),
              replacementWorkerId: r.replacementBookingId ? String(r.replacementBookingId) : undefined,
              status: String(r.status || 'REQUESTED'),
              decisionRemarks: r.decisionRemarks ? String(r.decisionRemarks) : undefined,
              decisionMessage: r.decisionMessage ? String(r.decisionMessage) : undefined,
              decidedAt: r.decidedAt ? String(r.decidedAt) : undefined,
            };
          }

          return merged;
        })
      );

      let mapped = enrichedItems.map((item) => mapBackendBookingToDomain(item, customerMap, workerMap));

      // Client-side search and filters
      if (filter?.searchTerm) {
        const term = filter.searchTerm.toLowerCase().trim();
        mapped = mapped.filter(
          (b) =>
            b.id.toLowerCase().includes(term) ||
            b.customerName.toLowerCase().includes(term) ||
            b.serviceCategory.toLowerCase().includes(term) ||
            b.customerLocality.toLowerCase().includes(term) ||
            (b.assignedWorkerName && b.assignedWorkerName.toLowerCase().includes(term))
        );
      }

      if (filter?.category && filter.category !== 'ALL') {
        const cat = filter.category.toLowerCase();
        mapped = mapped.filter((b) => b.serviceCategory.toLowerCase() === cat);
      }

      if (filter?.locality && filter.locality !== 'ALL') {
        const loc = filter.locality.toLowerCase();
        mapped = mapped.filter((b) => b.customerLocality.toLowerCase() === loc);
      }

      const totalItems = mapped.length;
      const pageSize = filter?.pageSize || 10;
      const currentPage = filter?.page || 1;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      const paginated = mapped.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      return {
        items: paginated,
        totalCount: totalItems,
        page: currentPage,
        pageSize,
        totalPages,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingById(id: string): Promise<BookingDetail | null> {
    try {
      const [res, customerMap, workerMap] = await Promise.all([
        httpClient.get<{ success?: boolean; data?: Record<string, unknown> }>(`/admin/bookings/${id}`),
        getCustomerRegistry(),
        getWorkerRegistry(),
      ]);
      const raw = res.data?.data || (res.data as unknown as Record<string, unknown>);
      if (!raw) return null;

      const replRes = await httpClient.get<{ data?: Array<Record<string, unknown>> }>('/admin/replacement-requests', {
        params: { bookingId: id, limit: 1 },
      }).catch(() => null);
      const activeRepl = replRes?.data?.data?.[0];
      if (activeRepl) {
        raw.replacement = {
          id: String(activeRepl.id || ''),
          bookingId: String(activeRepl.bookingId || id),
          requestedAt: String(activeRepl.createdAt || 'Recent Request'),
          reasonCategory: String(activeRepl.reasonCode || activeRepl.reason || 'Service Expectation Mismatch'),
          customerExplanation: String(activeRepl.reason || activeRepl.notes || 'Customer requested worker change.'),
          eligibleUnderPolicy: true,
          coveragePlanName: 'Placement Guarantee Replacement',
          priorWorkerId: String(activeRepl.currentWorkerId || raw.workerId || ''),
          priorWorkerName: String(workerMap.get(String(activeRepl.currentWorkerId || raw.workerId))?.name || 'Prior Worker'),
          replacementWorkerId: activeRepl.replacementBookingId ? String(activeRepl.replacementBookingId) : undefined,
          status: String(activeRepl.status || 'REQUESTED'),
          decisionRemarks: activeRepl.decisionRemarks ? String(activeRepl.decisionRemarks) : undefined,
          decisionMessage: activeRepl.decisionMessage ? String(activeRepl.decisionMessage) : undefined,
          decidedAt: activeRepl.decidedAt ? String(activeRepl.decidedAt) : undefined,
        };
      }

      return mapBackendBookingToDomain(raw, customerMap, workerMap);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async matchCandidates(requirement: MatchRequirement): Promise<CandidateMatch[]> {
    try {
      const res = await httpClient.post<{
        data: Array<{
          workerId: string;
          userId: string;
          name: string;
          experienceMonths?: number | null;
          categories: Array<{ id: string; name?: string }>;
          languages: string[];
          serviceAreas: Array<{ id: string; name?: string }>;
          engagementPreference?: string | null;
        }>;
        meta: { page: number; limit: number; total: number; totalPages: number };
        ordering: string;
        ranked: boolean;
      }>('/admin/matching/candidates', requirement);

      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      return items.map((raw) => ({
        workerId: String(raw.workerId || ''),
        workerName: String(raw.name || 'Candidate'),
        category: raw.categories?.[0]?.name || requirement.category,
        locality: raw.serviceAreas?.[0]?.name || 'Hyderabad',
        experienceYears: raw.experienceMonths ? Math.round(raw.experienceMonths / 12) : 0,
        matchScore: 100,
        ratingAverage: 5.0,
        totalReviews: 0,
        isFullyVerified: true,
        languages: Array.isArray(raw.languages) ? raw.languages : [],
      }));
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCandidateSuggestions(bookingId: string): Promise<CandidateMatch[]> {
    try {
      const booking = await this.getBookingById(bookingId).catch(() => null);
      if (!booking) {
        return [];
      }

      // If booking is in replacement, query replacement candidates via dedicated replacement endpoint
      if (booking.status === 'REPLACEMENT_REQUESTED' || booking.replacement) {
        try {
          const reqId = booking.replacement?.id;
          if (reqId) {
            const candRes = await httpClient.get<{
              data?: Record<string, unknown>[];
            }>(`/admin/replacement-requests/${reqId}/candidates`);
            const items = Array.isArray(candRes.data?.data) ? candRes.data.data : [];
            return items.map((raw: Record<string, unknown>) => ({
              workerId: String(raw.workerId || raw.id || ''),
              workerName: String(raw.name || raw.workerName || raw.fullName || 'Candidate'),
              category: String(raw.category || booking.serviceCategory),
              locality: String(raw.locality || booking.customerLocality),
              experienceYears: Number(raw.experienceYears || (raw.experienceMonths ? Math.round(Number(raw.experienceMonths) / 12) : 0)),
              matchScore: Number(raw.matchScore || 100),
              ratingAverage: Number(raw.ratingAverage || raw.rating || 5.0),
              totalReviews: Number(raw.totalReviews || 0),
              isFullyVerified: Boolean(raw.isFullyVerified ?? true),
              languages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],
            }));
          }
        } catch {
          // If replacement candidates query fails, do not invent candidates
        }
      }

      // For standard bookings, match candidates via documented requirement endpoint POST /admin/matching/candidates
      let engagement: MatchRequirement['engagement'] = 'FULL_TIME';
      if (booking.engagementType === 'PART_TIME') engagement = 'PART_TIME';
      else if (booking.engagementType === 'FULL_TIME_LIVE_IN') engagement = 'LIVE_IN';
      else if (booking.engagementType === 'ONE_TIME') engagement = 'ONE_TIME';

      try {
        const matched = await this.matchCandidates({
          category: booking.serviceCategory.toUpperCase().replace(/\s+/g, '_'),
          areaId: booking.customerLocality,
          engagement,
          availableFrom: '09:00',
          availableTo: '17:00',
        });
        return matched;
      } catch {
        return [];
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async scheduleTrial(bookingId: string, candidateWorkerId: string, trial: TrialSchedule): Promise<void> {
    try {
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/schedule`,
        {
          scheduleType: 'TRIAL',
          scheduledAt: trial.scheduledDate,
          workerId: candidateWorkerId,
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async recordTrialOutcome(bookingId: string, outcome: TrialOutcome): Promise<void> {
    try {
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_trial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/interview-complete`,
        {
          outcomeNote: `${outcome.outcome}: ${outcome.feedbackRemarks || ''}`,
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async confirmBooking(bookingId: string): Promise<void> {
    try {
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/confirm-worker`,
        {
          startDate: new Date().toISOString().split('T')[0],
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void> {
    try {
      try {
        const replRes = await httpClient.get<{
          data?: Array<{ id: string; status: string }>;
        }>('/admin/replacement-requests', {
          params: { bookingId, limit: 1 },
        });
        const activeReq = replRes.data?.data?.[0];
        if (activeReq?.id) {
          if (activeReq.status === 'REQUESTED') {
            await httpClient.post(`/admin/replacement-requests/${activeReq.id}/approve`, {
              remarks: remarks || 'Eligibility approved by Operations Admin',
            }).catch(() => {});
          }
          await httpClient.post(`/admin/replacement-requests/${activeReq.id}/select`, {
            workerId: replacementWorkerId,
          });
        }
      } catch {
        // Fall back to booking-level match if replacement requests endpoint throws
      }

      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/match`,
        {
          workerId: replacementWorkerId,
          reason: remarks,
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async cancelBooking(bookingId: string, remarks: string, _reasonCategory: string): Promise<void> {
    try {
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_cancel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/cancel`,
        {
          reason: remarks,
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async approveReplacement(requestId: string, remarks?: string): Promise<void> {
    try {
      await httpClient.post(`/admin/replacement-requests/${requestId}/approve`, {
        remarks: remarks || 'Replacement request approved by Operations Admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectReplacement(requestId: string, remarks: string): Promise<void> {
    try {
      await httpClient.post(`/admin/replacement-requests/${requestId}/reject`, {
        remarks: remarks || 'Replacement request rejected under policy terms',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getReplacementCandidates(requestId: string): Promise<CandidateMatch[]> {
    try {
      const res = await httpClient.get<{
        data?: Array<{
          workerId: string;
          userId: string;
          name: string;
          experienceMonths?: number;
          categories?: Array<{ code: string; name: string }>;
          languages?: string[];
          serviceAreas?: Array<{ id: string; name: string; city: string }>;
          engagementPreference?: string;
        }>;
      }>(`/admin/replacement-requests/${requestId}/candidates`);

      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      return items.map((raw) => ({
        workerId: String(raw.workerId || ''),
        workerName: String(raw.name || 'Candidate'),
        category: raw.categories?.[0]?.name || 'Domestic Staff',
        locality: raw.serviceAreas?.[0]?.name || 'Hyderabad',
        experienceYears: raw.experienceMonths ? Math.round(raw.experienceMonths / 12) : 1,
        matchScore: 95,
        ratingAverage: 5.0,
        totalReviews: 0,
        isFullyVerified: true,
        languages: Array.isArray(raw.languages) ? raw.languages : [],
      }));
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async selectReplacementWorker(requestId: string, workerId: string): Promise<void> {
    try {
      await httpClient.post(`/admin/replacement-requests/${requestId}/select`, {
        workerId,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingHistory(bookingId: string): Promise<BookingHistoryData> {
    try {
      const [detailRes, interviewsRes, chainRes] = await Promise.all([
        httpClient.get<{ data?: Record<string, unknown> }>(`/admin/bookings/${bookingId}`).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/admin/bookings/${bookingId}/interviews`).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/admin/bookings/${bookingId}/replacement-chain`).catch(() => null),
      ]);
      const rawDetail = (detailRes?.data?.data || detailRes?.data) as Record<string, unknown> | undefined;
      const rawTimeline = Array.isArray(rawDetail?.timeline) ? rawDetail.timeline : [];
      const interviews = Array.isArray(interviewsRes?.data) ? interviewsRes.data : (Array.isArray((interviewsRes?.data as { data?: unknown[] })?.data) ? (interviewsRes?.data as { data: Array<Record<string, unknown>> }).data : []);
      const replacementChain = Array.isArray(chainRes?.data) ? chainRes.data : (Array.isArray((chainRes?.data as { data?: unknown[] })?.data) ? (chainRes?.data as { data: Array<Record<string, unknown>> }).data : []);

      return {
        timeline: rawTimeline.map((t: Record<string, unknown>) => ({
          from: t.from !== undefined ? String(t.from) : null,
          to: String(t.to || ''),
          by: String(t.by || ''),
          note: t.note !== undefined ? String(t.note) : null,
          at: String(t.at || ''),
          actorUserId: t.actorUserId !== undefined ? String(t.actorUserId) : null,
        })),
        interviews: interviews.map((intv: Record<string, unknown>) => ({
          id: String(intv.id || ''),
          type: String(intv.type || 'INTERVIEW'),
          status: String(intv.status || ''),
          statusLabel: String(intv.statusLabel || intv.status || ''),
          scheduledAt: intv.scheduledAt ? String(intv.scheduledAt) : undefined,
          outcomeNote: intv.outcomeNote ? String(intv.outcomeNote) : undefined,
          createdAt: intv.createdAt ? String(intv.createdAt) : undefined,
          timeline: Array.isArray(intv.timeline) ? intv.timeline as Array<{ title: string; state: string; at: string }> : undefined,
        })),
        replacementChain: replacementChain.map((link: Record<string, unknown>) => ({
          bookingId: String(link.bookingId || ''),
          position: Number(link.position || 1),
          status: String(link.status || ''),
          workerId: String(link.workerId || ''),
          startDate: link.startDate ? String(link.startDate) : undefined,
          createdAt: String(link.createdAt || ''),
          current: Boolean(link.current),
        })),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealBookingRepository as BookingRepositoryImpl };

export const createBookingRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IBookingRepository => {
  return useMock ? new MockBookingRepository() : new RealBookingRepository();
};

export const bookingRepository = createBookingRepository();
