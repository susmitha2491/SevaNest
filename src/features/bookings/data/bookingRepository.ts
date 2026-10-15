import {
  BookingDetail,
  CandidateMatch,
  TrialSchedule,
  TrialOutcome,
  BookingFilterCriteria,
  PaginatedBookings,
  IBookingRepository,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
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
        requestedAt: 'Recent Handoff',
        reasonCategory: 'Skill Mismatch / Food Preparation Quality',
        customerExplanation: 'Worker struggled with specific diabetic dietary menu requirements.',
        eligibleUnderPolicy: true,
        coveragePlanName: '30-Day Free Replacement Guarantee',
        priorWorkerId: 'W-10484',
        priorWorkerName: 'Meena Bai',
        status: 'PENDING_REMATCH',
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
}

function mapBackendBookingToDomain(raw: Record<string, unknown>): BookingDetail {
  const customer = raw.customer as Record<string, unknown> | undefined;
  const worker = raw.worker as Record<string, unknown> | undefined;

  return {
    id: String(raw.id || raw.bookingId || ''),
    customerId: String(raw.customerId || customer?.id || raw.customerUserId || ''),
    customerName: String(raw.customerName || customer?.fullName || 'Customer'),
    customerPhoneMasked: String(raw.customerPhoneMasked || customer?.phoneMasked || '+91 *****'),
    customerLocality: String(raw.customerLocality || raw.locality || 'Hyderabad'),
    serviceCategory: String(raw.serviceCategory || raw.category || 'General'),
    engagementType: (raw.engagementType as BookingDetail['engagementType']) || 'FULL_TIME_LIVE_OUT',
    timingShift: String(raw.timingShift || raw.shift || 'General'),
    salaryBudgetMax: Number(raw.salaryBudgetMax || raw.budget || 0),
    specialRequirements: String(raw.specialRequirements || raw.notes || ''),
    assignedWorkerId: (raw.assignedWorkerId || worker?.id || raw.workerId) ? String(raw.assignedWorkerId || worker?.id || raw.workerId) : undefined,
    assignedWorkerName: (raw.assignedWorkerName || worker?.fullName || raw.workerName) ? String(raw.assignedWorkerName || worker?.fullName || raw.workerName) : undefined,
    assignedWorkerPhoneMasked: (raw.assignedWorkerPhoneMasked || worker?.phoneMasked) ? String(raw.assignedWorkerPhoneMasked || worker?.phoneMasked) : undefined,
    status: (raw.status as BookingDetail['status']) || 'REQUESTED',
    createdAt: String(raw.createdAt || 'Recent'),
    serviceStartDate: (raw.startDate || raw.serviceStartDate) ? String(raw.startDate || raw.serviceStartDate) : undefined,
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
      const params: Record<string, unknown> = {
        page: filter?.page || 1,
        limit: filter?.pageSize || 10,
      };
      if (filter?.status && filter.status !== 'ALL') {
        params.status = filter.status;
      }

      const res = await httpClient.get<{
        success: boolean;
        data: { data?: Record<string, unknown>[]; meta?: { totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number } };
      }>('/admin/bookings', { params });

      const payload = res.data;
      const items = Array.isArray(payload.data?.data)
        ? payload.data.data
        : Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>[])
        : [];
      const mapped = items.map(mapBackendBookingToDomain);

      const totalItems = payload.data?.meta?.totalItems ?? items.length;
      const pageSize = filter?.pageSize || 10;

      return {
        items: mapped,
        totalCount: totalItems,
        page: payload.data?.meta?.currentPage ?? filter?.page ?? 1,
        pageSize: payload.data?.meta?.itemsPerPage ?? pageSize,
        totalPages: payload.data?.meta?.totalPages ?? (Math.ceil(totalItems / pageSize) || 1),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingById(id: string): Promise<BookingDetail | null> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/bookings/${id}`);
      const raw = res.data.data;
      return raw ? mapBackendBookingToDomain(raw) : null;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getCandidateSuggestions(bookingId: string): Promise<CandidateMatch[]> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown>[] }>(
        `/admin/replacement-requests/${bookingId}/candidates`
      );
      const items = Array.isArray(res.data.data) ? res.data.data : [];
      return items.map((raw: Record<string, unknown>) => ({
        workerId: String(raw.workerId || raw.id || ''),
        workerName: String(raw.workerName || raw.fullName || 'Candidate'),
        category: String(raw.category || 'General'),
        locality: String(raw.locality || 'Hyderabad'),
        experienceYears: Number(raw.experienceYears || 0),
        matchScore: Number(raw.matchScore || 0),
        ratingAverage: Number(raw.ratingAverage || raw.rating || 0),
        totalReviews: Number(raw.totalReviews || 0),
        isFullyVerified: Boolean(raw.isFullyVerified ?? false),
        languages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],
      }));
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async scheduleTrial(bookingId: string, candidateWorkerId: string, trial: TrialSchedule): Promise<void> {
    try {
      await httpClient.post(`/admin/bookings/${bookingId}/schedule`, {
        scheduleType: 'TRIAL',
        scheduledAt: trial.scheduledDate,
        workerId: candidateWorkerId,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async recordTrialOutcome(bookingId: string, outcome: TrialOutcome): Promise<void> {
    try {
      await httpClient.post(`/admin/bookings/${bookingId}/interview-complete`, {
        outcomeNote: `${outcome.outcome}: ${outcome.feedbackRemarks || ''}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async confirmBooking(bookingId: string): Promise<void> {
    try {
      await httpClient.post(`/admin/bookings/${bookingId}/confirm-worker`, {
        startDate: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void> {
    try {
      await httpClient.post(`/admin/bookings/${bookingId}/match`, {
        workerId: replacementWorkerId,
        reason: remarks,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async cancelBooking(bookingId: string, remarks: string, _reasonCategory: string): Promise<void> {
    try {
      await httpClient.post(`/admin/bookings/${bookingId}/cancel`, {
        reason: remarks,
      });
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
