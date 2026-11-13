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
  BookingCommunicationEvent,
  BookingAttendanceEntry,
  BookingAttendancePage,
  BookingAttendanceSummary,
  GlobalAttendanceOverview,
  RecordAttendanceInput,
  CorrectAttendanceInput,
  InterviewActionPayload,
  ReplacementReasonCode,
  REPLACEMENT_REASONS,
  ReplacementStatus,
  ReplacementDetail,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import {
  getCustomerPhone,
  getWorkerPhone,
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
        status: 'REQUESTED',
        reasonCode: 'MISMATCH',
        reason: 'Worker struggled with specific diabetic dietary menu requirements.',
        notes: 'Worker struggled with specific diabetic dietary menu requirements.',
        neededFrom: '2026-11-10',
        requestedAt: 'Recent Handoff',
        reasonCategory: 'Skill or expectation mismatch',
        customerExplanation: 'Worker struggled with specific diabetic dietary menu requirements.',
        eligibleUnderPolicy: true,
        coveragePlanName: '30-Day Free Replacement Guarantee',
        priorWorkerId: 'W-10484',
        priorWorkerName: 'Meena Bai',
        currentWorkerId: 'W-10484',
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

  private mockAttendance: BookingAttendanceEntry[] = [];

  async assignMatchedWorker(bookingId: string, workerId: string, reason?: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    const candidate = this.candidatesPool.find((c) => c.workerId === workerId);
    if (booking) {
      booking.assignedWorkerId = workerId;
      if (candidate) booking.assignedWorkerName = candidate.workerName;
      booking.status = 'MATCHED';
      booking.internalNotes.push(`Worker ${candidate?.workerName || workerId} matched${reason ? `: ${reason}` : '.'}`);
    }
  }

  async reopenMatching(bookingId: string, reason: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.assignedWorkerId = undefined;
      booking.assignedWorkerName = undefined;
      booking.status = 'REQUESTED';
      booking.internalNotes.push(`Matching reopened: ${reason}`);
    }
  }

  async scheduleTrial(
    bookingId: string,
    candidateWorkerId: string,
    trial: TrialSchedule & { scheduleType?: 'TRIAL' | 'INTERVIEW' }
  ): Promise<void> {
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
        booking.status = 'INTERVIEW_TRIAL_COMPLETED';
        booking.internalNotes.push(`Trial succeeded: Ready for worker confirmation.`);
      } else {
        booking.status = 'REQUESTED';
        booking.assignedWorkerId = undefined;
        booking.assignedWorkerName = undefined;
        booking.internalNotes.push(`Trial outcome: ${outcome.outcome}. Re-opened for candidate matching.`);
      }
    }
  }

  async confirmBooking(bookingId: string, startDate?: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'CONFIRMED';
      booking.serviceStartDate = startDate || new Date().toISOString().split('T')[0];
      booking.internalNotes.push('Worker confirmed on booking.');
    }
  }

  async startService(bookingId: string, note?: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'SERVICE_ACTIVE';
      booking.serviceStartDate = new Date().toISOString().split('T')[0];
      booking.internalNotes.push(`Service started${note ? `: ${note}` : '.'}`);
    }
  }

  async completeBooking(bookingId: string, note?: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'COMPLETED';
      booking.internalNotes.push(`Service completed${note ? `: ${note}` : '.'}`);
    }
  }

  async respondSlotProposal(bookingId: string, answer: 'accept' | 'reject', note?: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.proposedSlotAt = undefined;
      booking.proposedSlotNote = undefined;
      booking.internalNotes.push(`Slot proposal ${answer}ed${note ? `: ${note}` : '.'}`);
    }
  }

  async performInterviewAction(
    _interviewId: string,
    _action: 'confirm' | 'reschedule' | 'complete' | 'cancel',
    _payload?: InterviewActionPayload
  ): Promise<void> { }

  async getBookingAttendance(
    bookingId: string,
    params?: { from?: string; to?: string; page?: number; limit?: number }
  ): Promise<BookingAttendanceEntry[]> {
    const result = await this.getBookingAttendancePage(bookingId, params);
    return result.items;
  }

  async getBookingAttendancePage(
    bookingId: string,
    params?: { from?: string; to?: string; page?: number; limit?: number }
  ): Promise<BookingAttendancePage> {
    let filtered = this.mockAttendance.filter((a) => a.bookingId === bookingId);
    if (params?.from) {
      filtered = filtered.filter((a) => a.date >= params.from!);
    }
    if (params?.to) {
      filtered = filtered.filter((a) => a.date <= params.to!);
    }
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = filtered.slice((page - 1) * limit, page * limit);
    return {
      items,
      meta: { page, limit, total, totalPages },
    };
  }

  async getAllAttendanceOverview(params?: { from?: string; to?: string }): Promise<GlobalAttendanceOverview> {
    const bookingRes = await this.getBookings({ page: 1, pageSize: 1000 });
    const bookings = bookingRes.items;
    const candidates = bookings.filter(
      (b) =>
        Boolean(b.assignedWorkerId) &&
        (Boolean(b.serviceStartDate) ||
          ['SERVICE_ACTIVE', 'ACTIVE', 'COMPLETED', 'REPLACED', 'REPLACEMENT_REQUESTED'].includes(b.status))
    );
    const entries: BookingAttendanceEntry[] = [];
    for (const b of candidates) {
      const pageRes = await this.getBookingAttendancePage(b.id, {
        from: params?.from,
        to: params?.to,
        page: 1,
        limit: 100,
      });
      entries.push(...pageRes.items);
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return {
      entries,
      bookings,
      isComplete: true,
      failedBookingsCount: 0,
    };
  }

  async getBookingAttendanceSummary(bookingId: string, month: string): Promise<BookingAttendanceSummary | null> {
    const entries = this.mockAttendance.filter((a) => a.bookingId === bookingId && a.date.startsWith(month));
    return {
      bookingId,
      month,
      daysInMonth: 30,
      recorded: entries.length,
      presentDays: entries.filter((e) => e.status === 'PRESENT').length,
      absentDays: entries.filter((e) => e.status === 'ABSENT').length,
      lateDays: entries.filter((e) => e.status === 'LATE').length,
      exceptionDays: entries.filter((e) => e.status === 'EXCEPTION').length,
      leaveDays: entries.filter((e) => e.status === 'LEAVE').length,
      scheduledWindow: { from: '09:00', to: '17:00' },
    };
  }

  async recordBookingAttendance(bookingId: string, payload: RecordAttendanceInput): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    this.mockAttendance.unshift({
      id: `att-${Date.now()}`,
      bookingId,
      workerId: booking?.assignedWorkerId || 'W-10482',
      date: payload.date,
      status: payload.status,
      checkInTime: null,
      checkOutTime: null,
      note: payload.note || null,
      markedByRole: 'ADMIN',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  async correctBookingAttendance(attendanceId: string, payload: CorrectAttendanceInput): Promise<void> {
    const target = this.mockAttendance.find((a) => a.id === attendanceId);
    if (target) {
      const prev = target.status;
      target.status = payload.status;
      target.note = payload.note ?? target.note;
      target.updatedAt = new Date().toISOString();
      target.history = [
        ...(target.history || []),
        {
          id: `ah-${Date.now()}`,
          previousStatus: prev,
          newStatus: payload.status,
          note: payload.note ?? null,
          reason: payload.reason,
          actorKind: 'ADMIN',
          changedAt: new Date().toISOString(),
        },
      ];
    }
  }

  async processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    const replacementCandidate = this.candidatesPool.find((c) => c.workerId === replacementWorkerId);
    if (booking && replacementCandidate) {
      const successorId = `B-${Math.floor(10000 + Math.random() * 90000)}`;
      if (booking.replacement) {
        booking.replacement.replacementWorkerId = replacementCandidate.workerId;
        booking.replacement.replacementWorkerName = replacementCandidate.workerName;
        booking.replacement.replacementBookingId = successorId;
        booking.replacement.status = 'COMPLETED';
        booking.replacement.operationalRemarks = remarks;
      }
      booking.status = 'REPLACED';
      booking.internalNotes.push(`Replacement fulfilled. Successor booking ${successorId} created with worker ${replacementCandidate.workerName}. Remarks: ${remarks}`);
    }
  }

  async cancelBooking(bookingId: string, remarks: string, reasonCategory: string): Promise<void> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'CANCELLED';
      booking.internalNotes.push(`Cancelled (${reasonCategory}): ${remarks}`);
    }
  }

  async approveReplacement(requestId: string, remarks?: string, message?: string): Promise<void> {
    const booking = this.bookings.find(
      (b) => b.replacement?.id === requestId || b.id === requestId
    );
    if (booking?.replacement) {
      booking.replacement.status = 'APPROVED';
      booking.replacement.decisionRemarks = remarks || 'Approved by Operations Admin';
      booking.replacement.decisionMessage = message;
      booking.replacement.decidedAt = new Date().toISOString();
      booking.internalNotes.push(`Replacement request approved: ${remarks || 'Eligibility confirmed'}`);
    }
  }

  async rejectReplacement(requestId: string, remarks: string, message?: string): Promise<void> {
    const booking = this.bookings.find(
      (b) => b.replacement?.id === requestId || b.id === requestId
    );
    if (booking?.replacement) {
      booking.replacement.status = 'REJECTED';
      booking.replacement.decisionRemarks = remarks;
      booking.replacement.decisionMessage = message;
      booking.replacement.decidedAt = new Date().toISOString();
      booking.status = 'ACTIVE';
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
      const successorId = `B-${Math.floor(10000 + Math.random() * 90000)}`;
      if (booking.replacement) {
        booking.replacement.replacementWorkerId = candidate.workerId;
        booking.replacement.replacementWorkerName = candidate.workerName;
        booking.replacement.replacementBookingId = successorId;
        booking.replacement.status = 'COMPLETED';
        booking.replacement.completedAt = new Date().toISOString();
      }
      booking.status = 'REPLACED';
      booking.internalNotes.push(`Replacement worker assigned: ${candidate.workerName} (${candidate.workerId}). Successor booking: ${successorId}`);
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
            requestedBy: 'CUSTOMER',
            preferredAt: booking.trial.scheduledDate,
            scheduledAt: booking.trial.scheduledDate,
            outcomeNote: booking.trialOutcome?.feedbackRemarks,
            note: booking.trial.notes,
            createdAt: booking.createdAt,
            timeline: [
              { title: 'Requested', state: 'done', at: booking.createdAt },
              { title: 'Confirmed', state: 'done', at: booking.createdAt },
              { title: 'Scheduled', state: booking.trialOutcome ? 'done' : 'current', at: booking.trial.scheduledDate },
            ],
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
      payments: [
        {
          id: `TXN-${booking?.id || '84920'}`,
          bookingId: booking?.id || 'B-84920',
          status: booking?.platformFeePaid ? 'SUCCEEDED' : 'PENDING',
          amountMinor: (booking?.platformFeeAmount || 499) * 100,
          amountINR: booking?.platformFeeAmount || 499,
          currency: 'INR',
          receiptNumber: 'REC-2026-9041',
          paidAt: booking?.createdAt || '2026-10-09T04:43:26.583Z',
          refundStatus: null,
          refundedAt: null,
          refundReason: null,
          refundedByUserId: null,
          paymentMethod: 'UPI (GPay)',
          paymentMethodDetail: 'anand****@okhdfc',
          gatewayReference: 'pay_H93b1948x',
          providerOrderId: 'order_G8329481a',
          providerPaymentId: 'pay_H93b1948x',
          feeCode: 'BOOKING_FEE',
          createdAt: booking?.createdAt || '2026-10-09T04:43:26.583Z',
        },
      ],
      auditLogs: [
        {
          id: `AUD-${booking?.id || '84920'}`,
          actorStaffId: 'STAFF-OPS-01',
          actorName: 'Operations Officer',
          actorRole: 'Operations Admin',
          actionType: 'BOOKING_STATUS_UPDATE',
          targetRecordId: booking?.id || 'B-84920',
          targetEntityType: 'BOOKING',
          summary: 'Operations intake verified and domestic worker assigned',
          timestamp: booking?.createdAt || '2026-10-09T04:43:26.583Z',
          operationalRemarks: 'Verified household requirements and candidate alignment.',
        },
      ],
      communications: [
        {
          id: `comm-req-${booking?.id || '84920'}`,
          timestamp: booking?.createdAt || '2026-10-09T04:43:26.583Z',
          channel: 'CUSTOMER_PORTAL_SUBMISSION',
          senderRole: 'CUSTOMER',
          senderName: booking?.customerName || 'Customer',
          title: 'Initial Requirement Submission',
          outcome: 'Requirements Logged',
          remarks: 'Client service preferences and timing shift recorded during initial booking intake.',
        },
        {
          id: `comm-resp-${booking?.id || '84920'}`,
          timestamp: booking?.createdAt || '2026-10-09T05:12:00.000Z',
          channel: 'WORKER_APP_RESPONSE',
          senderRole: 'WORKER',
          senderName: booking?.assignedWorkerName || 'Worker Candidate',
          title: 'Worker Assignment Confirmation',
          outcome: 'Accepted',
          remarks: 'Candidate confirmed availability for the specified schedule.',
        },
      ],
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

export const bookingDetailCache = new Map<string, Record<string, unknown>>();

export function clearBookingDetailCache(): void {
  bookingDetailCache.clear();
}

export function clearBookingRegistryCaches(): void {
  customerRegistryCache = null;
  lastCustomerFetch = 0;
  workerRegistryCache = null;
  lastWorkerFetch = 0;
}

const isUnusablePersonName = (str: string): boolean => {
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase();
  return (
    !trimmed ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
    /^[0-9a-f]{20,}$/i.test(trimmed) ||
    /^c-\d+$/i.test(trimmed) ||
    /^cust[-_]\d*$/i.test(trimmed) ||
    lower.startsWith('customer (') ||
    lower === 'customer user' ||
    lower === 'customer details unavailable' ||
    lower === 'unknown customer' ||
    lower === 'not provided'
  );
};

async function fetchAllRegistryPages(
  endpoint: '/admin/customers' | '/admin/workers',
  altArrayKey: 'customers' | 'workers'
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  const limit = 100;
  const MAX_PAGES = 25;
  let page = 1;

  while (page <= MAX_PAGES) {
    const res = await httpClient.get<{
      data?: Array<Record<string, unknown>>;
      customers?: Array<Record<string, unknown>>;
      workers?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
      meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
    }>(endpoint, {
      params: { page, limit },
    });
    const raw = res.data;
    const list = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray(raw?.data)
        ? (raw.data as Record<string, unknown>[])
        : Array.isArray(raw?.[altArrayKey])
          ? (raw[altArrayKey] as Record<string, unknown>[])
          : Array.isArray(raw?.items)
            ? (raw.items as Record<string, unknown>[])
            : [];

    items.push(...list);

    const metaTotal = typeof raw?.meta?.total === 'number' ? raw.meta.total : undefined;
    const metaTotalPages = typeof raw?.meta?.totalPages === 'number' ? raw.meta.totalPages : undefined;
    const responseLimit = typeof raw?.meta?.limit === 'number' && raw.meta.limit > 0 ? raw.meta.limit : limit;

    if (
      list.length === 0 ||
      (metaTotalPages !== undefined
        ? page >= metaTotalPages
        : metaTotal !== undefined
          ? page * responseLimit >= metaTotal
          : list.length < responseLimit)
    ) {
      break;
    }
    page++;
  }

  return items;
}

let isPrefetching = false;
function scheduleBackgroundEnrichment(ids: string[]): void {
  if (isPrefetching || ids.length === 0) return;
  isPrefetching = true;
  setTimeout(async () => {
    try {
      // Process in small batches of 2 with 200ms delay to keep connection pool clear
      for (let i = 0; i < Math.min(ids.length, 16); i += 2) {
        const batch = ids.slice(i, i + 2);
        await Promise.all(
          batch.map(async (id) => {
            if (bookingDetailCache.has(id)) return;
            try {
              const res = await httpClient.get<{ data?: Record<string, unknown> }>(`/admin/bookings/${id}`);
              const data = res.data?.data || (res.data as unknown as Record<string, unknown>);
              if (data) bookingDetailCache.set(id, data);
            } catch {
              // Ignore background fetch failure
            }
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      isPrefetching = false;
    }
  }, 300);
}

export async function getCustomerRegistry(): Promise<Map<string, CachedCustomer>> {
  const now = Date.now();
  if (customerRegistryCache && now - lastCustomerFetch < 60000) {
    return customerRegistryCache;
  }
  try {
    const list = await fetchAllRegistryPages('/admin/customers', 'customers');
    const map = new Map<string, CachedCustomer>();
    for (const c of list) {
      const id = String(c.id || c.customerId || '').trim();
      const userId = String(c.userId || '').trim();
      const rawName = String(c.name || c.fullName || c.customerName || '').trim();
      const name = isUnusablePersonName(rawName) ? '' : rawName;
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
    const list = await fetchAllRegistryPages('/admin/workers', 'workers');
    const map = new Map<string, CachedWorker>();
    for (const w of list) {
      const id = String(w.id || w.workerId || '').trim();
      const userId = String(w.userId || '').trim();
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

  const isIdLike = (str: string) => isUnusablePersonName(str);

  let customerName = String(
    raw.customerName ||
    customer?.fullName ||
    customer?.name ||
    custObj?.name ||
    ''
  ).trim();

  // Strictly eliminate generic `Customer (ID)`, placeholder labels, or substituted raw IDs
  if (isIdLike(customerName)) {
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
    customerUserId: raw.customerUserId ? String(raw.customerUserId) : (custId || undefined),
    customerPhone: cleanCustPhone || (rawCustPhone ? String(rawCustPhone) : undefined),
    customerEmail: (custObj?.email && !custObj.email.includes('*')) ? custObj.email : (raw.customerEmail ? String(raw.customerEmail) : undefined),
    assignedWorkerPhone: cleanWrkPhone || (rawWrkPhone ? String(rawWrkPhone) : undefined),
    categoryCode:
      typeof category === 'object' && category !== null && category.code
        ? String(category.code)
        : raw.categoryCode
          ? String(raw.categoryCode)
          : undefined,
    areaId:
      typeof area === 'object' && area !== null && area.id
        ? String(area.id)
        : raw.areaId
          ? String(raw.areaId)
          : undefined,
    availableFrom: raw.availableFrom ? String(raw.availableFrom) : undefined,
    availableTo: raw.availableTo ? String(raw.availableTo) : undefined,
    engagement: raw.engagement ? String(raw.engagement) : undefined,
    allowedActions: Array.isArray(raw.allowedActions) ? raw.allowedActions.map(String) : undefined,
    budgetMinMinor: raw.budgetMinMinor !== undefined && raw.budgetMinMinor !== null ? Number(raw.budgetMinMinor) : undefined,
    budgetMaxMinor: raw.budgetMaxMinor !== undefined && raw.budgetMaxMinor !== null ? Number(raw.budgetMaxMinor) : undefined,
    budgetPeriod: raw.budgetPeriod ? String(raw.budgetPeriod) : undefined,
    requirementNote: raw.requirementNote ? String(raw.requirementNote) : undefined,
    requestedStartDate: raw.requestedStartDate ? String(raw.requestedStartDate) : undefined,
    addressId: raw.addressId ? String(raw.addressId) : undefined,
    workerRespondedAt: raw.workerRespondedAt ? String(raw.workerRespondedAt) : undefined,
    respondBy: raw.respondBy ? String(raw.respondBy) : undefined,
    proposedSlotAt: raw.proposedSlotAt ? String(raw.proposedSlotAt) : undefined,
    proposedSlotNote: raw.proposedSlotNote ? String(raw.proposedSlotNote) : undefined,
    replacesBookingId: raw.replacesBookingId ? String(raw.replacesBookingId) : undefined,
    cancelReason: raw.cancelReason ? String(raw.cancelReason) : undefined,
    cancelledByUserId: raw.cancelledByUserId ? String(raw.cancelledByUserId) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    timeline: Array.isArray(raw.timeline)
      ? (raw.timeline as Array<Record<string, unknown>>).map((t) => ({
        from: t.from !== undefined && t.from !== null ? String(t.from) : null,
        to: String(t.to || ''),
        by: String(t.by || ''),
        note: t.note !== undefined && t.note !== null ? String(t.note) : null,
        at: String(t.at || ''),
        actorUserId: t.actorUserId !== undefined && t.actorUserId !== null ? String(t.actorUserId) : null,
      }))
      : undefined,
  };
}

async function fetchRawBookings(filterStatus?: string): Promise<Record<string, unknown>[]> {
  if (!filterStatus || filterStatus === 'ALL') {
    const res = await httpClient.get<{
      data?: { data?: Record<string, unknown>[]; meta?: Record<string, unknown> } | Record<string, unknown>[];
    }>('/admin/bookings', { params: { limit: 100 } });
    const payload = res.data;
    return Array.isArray((payload as { data?: { data?: Record<string, unknown>[] } })?.data?.data)
      ? (payload as { data: { data: Record<string, unknown>[] } }).data.data
      : Array.isArray((payload as { data?: Record<string, unknown>[] })?.data)
        ? (payload as { data: Record<string, unknown>[] }).data
        : Array.isArray(payload)
          ? (payload as Record<string, unknown>[])
          : [];
  }
  if (filterStatus === 'REQUESTED' || filterStatus === 'NEW_REQUEST') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'NEW_REQUEST', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  if (filterStatus === 'INTERVIEW_SCHEDULED' || filterStatus === 'INTERVIEW_TRIAL_SCHEDULED') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'INTERVIEW_TRIAL_SCHEDULED', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  if (filterStatus === 'CONFIRMED') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'CONFIRMED', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  if (filterStatus === 'SERVICE_ACTIVE' || filterStatus === 'ACTIVE') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'ACTIVE', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  if (filterStatus === 'REPLACEMENT_REQUESTED') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'REPLACEMENT_REQUESTED', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  if (filterStatus === 'CANCELLED') {
    const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: 'CANCELLED', limit: 100 } }).catch(() => null);
    return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
  }
  const res = await httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', { params: { status: filterStatus, limit: 100 } }).catch(() => null);
  return Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : [];
}

export class RealBookingRepository implements IBookingRepository {
  async getBookings(filter?: BookingFilterCriteria): Promise<PaginatedBookings> {
    try {
      const filterStatus = filter?.status;

      // Concurrently fetch customer registry, worker registry, replacement requests, and status bookings list
      const [customerMap, workerMap, replRes, rawBookingsList] = await Promise.all([
        getCustomerRegistry(),
        getWorkerRegistry(),
        httpClient.get<{
          data?: Array<Record<string, unknown>>;
        }>('/admin/replacement-requests', {
          params: { limit: 100 },
        }).catch(() => null),
        fetchRawBookings(filterStatus),
      ]);

      const replList = Array.isArray(replRes?.data?.data)
        ? replRes.data.data
        : Array.isArray(replRes?.data)
          ? (replRes.data as Record<string, unknown>[])
          : [];
      const replMap = new Map<string, Record<string, unknown>>();
      for (const r of replList) {
        if (r.bookingId) replMap.set(String(r.bookingId), r);
      }

      const rawItems = [...rawBookingsList];

      if (filterStatus === 'REPLACEMENT_REQUESTED') {
        for (const r of replList) {
          if (r.bookingId && !rawItems.some((b) => String(b.id) === String(r.bookingId))) {
            const cached = bookingDetailCache.get(String(r.bookingId));
            if (cached) {
              rawItems.push(cached);
            } else {
              try {
                const bRes = await httpClient.get<{ data?: Record<string, unknown> } | Record<string, unknown>>(`/admin/bookings/${r.bookingId}`);
                const bData = (bRes.data as { data?: Record<string, unknown> })?.data || (bRes.data as Record<string, unknown>);
                if (bData && bData.id) {
                  bookingDetailCache.set(String(bData.id), bData);
                  rawItems.push(bData);
                }
              } catch {
                // Ignore single booking fetch failure
              }
            }
          }
        }
      }

      const buildReplacement = (r: Record<string, unknown>, merged: Record<string, unknown>): ReplacementDetail => {
        const reasonCodeVal = (r.reasonCode || 'OTHER') as ReplacementReasonCode;
        const reasonLabel = REPLACEMENT_REASONS[reasonCodeVal] || String(r.reasonCode || 'Other reason');
        const reasonText = String(r.reason || reasonLabel);
        const notesText = r.notes !== undefined && r.notes !== null ? String(r.notes) : undefined;
        return {
          id: String(r.id || ''),
          bookingId: String(r.bookingId || merged.id),
          status: (String(r.status || 'REQUESTED') as ReplacementStatus),
          reasonCode: reasonCodeVal,
          reason: reasonText,
          notes: notesText,
          neededFrom: r.neededFrom ? String(r.neededFrom) : undefined,
          decisionMessage: r.decisionMessage ? String(r.decisionMessage) : undefined,
          decisionRemarks: r.decisionRemarks ? String(r.decisionRemarks) : undefined,
          replacementBookingId: r.replacementBookingId ? String(r.replacementBookingId) : undefined,
          currentWorkerId: String(r.currentWorkerId || merged.workerId || ''),
          requestedByUserId: r.requestedByUserId ? String(r.requestedByUserId) : undefined,
          decidedByUserId: r.decidedByUserId ? String(r.decidedByUserId) : undefined,
          createdAt: String(r.createdAt || ''),
          decidedAt: r.decidedAt ? String(r.decidedAt) : undefined,
          completedAt: r.completedAt ? String(r.completedAt) : undefined,

          // Legacy and convenience fields:
          requestedAt: String(r.createdAt || 'Recent Request'),
          reasonCategory: reasonLabel,
          customerExplanation: notesText ? `${reasonText} — ${notesText}` : reasonText,
          eligibleUnderPolicy: true,
          coveragePlanName: '30-Day Free Replacement Guarantee',
          priorWorkerId: String(r.currentWorkerId || merged.workerId || ''),
          priorWorkerName: String(workerMap.get(String(r.currentWorkerId || merged.workerId))?.name || 'Prior Worker'),
          replacementWorkerId: r.replacementBookingId ? String(r.replacementBookingId) : undefined,
        };
      };

      // Quick merge for cached items & replacements
      const mergedItems = rawItems.map((item) => {
        const id = String(item.id || item.bookingId || '');
        const cached = bookingDetailCache.get(id);
        let merged = cached ? { ...item, ...cached } : { ...item };
        const r = replMap.get(id);
        if (r && !merged.replacement) {
          merged.replacement = buildReplacement(r, merged);
        }
        return merged;
      });

      let mapped = mergedItems.map((item) => mapBackendBookingToDomain(item, customerMap, workerMap));

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

      // Only enrich the sliced paginated items (maximum 6-10 calls instead of all 44 concurrent requests)
      const enrichedPaginated = await Promise.all(
        paginated.map(async (b) => {
          if (b.customerUserId && b.customerName !== 'Customer Details Unavailable') {
            return b;
          }

          const cached = bookingDetailCache.get(b.id);
          if (cached) {
            const rawItem = rawItems.find((r) => String(r.id) === b.id) || {};
            const merged = { ...rawItem, ...cached };
            const r = replMap.get(b.id);
            if (r && !merged.replacement) {
              merged.replacement = buildReplacement(r, merged);
            }
            return mapBackendBookingToDomain(merged, customerMap, workerMap);
          }

          try {
            const detailRes = await httpClient.get<{ data?: Record<string, unknown> }>(`/admin/bookings/${b.id}`);
            const detail = detailRes.data?.data || (detailRes.data as unknown as Record<string, unknown>);
            if (detail) {
              bookingDetailCache.set(b.id, detail);
              const rawItem = rawItems.find((r) => String(r.id) === b.id) || {};
              const merged = { ...rawItem, ...detail };
              const r = replMap.get(b.id);
              if (r && !merged.replacement) {
                merged.replacement = buildReplacement(r, merged);
              }
              return mapBackendBookingToDomain(merged, customerMap, workerMap);
            }
          } catch {
            // Ignore single item fetch failure
          }
          return b;
        })
      );

      // Background prefetch for remaining items so subsequent page clicks are instantaneous
      const unPrefetched = rawItems.filter((item) => {
        const id = String(item.id || '');
        return id && !bookingDetailCache.has(id) && !enrichedPaginated.some((p) => p.id === id);
      });
      if (unPrefetched.length > 0) {
        scheduleBackgroundEnrichment(unPrefetched.map((i) => String(i.id)));
      }

      return {
        items: enrichedPaginated,
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

      bookingDetailCache.set(id, raw);

      const replRes = await httpClient.get<{ data?: Array<Record<string, unknown>> }>('/admin/replacement-requests', {
        params: { bookingId: id, limit: 1 },
      }).catch(() => null);
      const activeRepl = replRes?.data?.data?.[0];
      if (activeRepl) {
        const reasonCodeVal = (activeRepl.reasonCode || 'OTHER') as ReplacementReasonCode;
        const reasonLabel = REPLACEMENT_REASONS[reasonCodeVal] || String(activeRepl.reasonCode || 'Other reason');
        const reasonText = String(activeRepl.reason || reasonLabel);
        const notesText = activeRepl.notes !== undefined && activeRepl.notes !== null ? String(activeRepl.notes) : undefined;
        raw.replacement = {
          id: String(activeRepl.id || ''),
          bookingId: String(activeRepl.bookingId || id),
          status: (String(activeRepl.status || 'REQUESTED') as ReplacementStatus),
          reasonCode: reasonCodeVal,
          reason: reasonText,
          notes: notesText,
          neededFrom: activeRepl.neededFrom ? String(activeRepl.neededFrom) : undefined,
          decisionMessage: activeRepl.decisionMessage ? String(activeRepl.decisionMessage) : undefined,
          decisionRemarks: activeRepl.decisionRemarks ? String(activeRepl.decisionRemarks) : undefined,
          replacementBookingId: activeRepl.replacementBookingId ? String(activeRepl.replacementBookingId) : undefined,
          currentWorkerId: String(activeRepl.currentWorkerId || raw.workerId || ''),
          requestedByUserId: activeRepl.requestedByUserId ? String(activeRepl.requestedByUserId) : undefined,
          decidedByUserId: activeRepl.decidedByUserId ? String(activeRepl.decidedByUserId) : undefined,
          createdAt: String(activeRepl.createdAt || ''),
          decidedAt: activeRepl.decidedAt ? String(activeRepl.decidedAt) : undefined,
          completedAt: activeRepl.completedAt ? String(activeRepl.completedAt) : undefined,

          // Legacy and convenience fields:
          requestedAt: String(activeRepl.createdAt || 'Recent Request'),
          reasonCategory: reasonLabel,
          customerExplanation: notesText ? `${reasonText} — ${notesText}` : reasonText,
          eligibleUnderPolicy: true,
          coveragePlanName: '30-Day Free Replacement Guarantee',
          priorWorkerId: String(activeRepl.currentWorkerId || raw.workerId || ''),
          priorWorkerName: String(workerMap.get(String(activeRepl.currentWorkerId || raw.workerId))?.name || 'Prior Worker'),
          replacementWorkerId: activeRepl.replacementBookingId ? String(activeRepl.replacementBookingId) : undefined,
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
        locality: raw.serviceAreas?.[0]?.name || '',
        experienceYears: raw.experienceMonths ? Math.floor(raw.experienceMonths / 12) : 0,
        experienceMonths: raw.experienceMonths !== undefined && raw.experienceMonths !== null ? Number(raw.experienceMonths) : undefined,
        ratingAverage: undefined,
        totalReviews: undefined,
        matchScore: undefined,
        isFullyVerified: true,
        languages: Array.isArray(raw.languages) ? raw.languages : [],
        categories: raw.categories,
        serviceAreas: raw.serviceAreas,
        engagementPreference: raw.engagementPreference,
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
              experienceYears: Number(raw.experienceYears || (raw.experienceMonths ? Math.floor(Number(raw.experienceMonths) / 12) : 0)),
              experienceMonths: raw.experienceMonths !== undefined && raw.experienceMonths !== null ? Number(raw.experienceMonths) : undefined,
              matchScore: raw.matchScore !== undefined && raw.matchScore !== null ? Number(raw.matchScore) : undefined,
              ratingAverage: raw.ratingAverage !== undefined && raw.ratingAverage !== null ? Number(raw.ratingAverage) : (raw.rating !== undefined && raw.rating !== null ? Number(raw.rating) : undefined),
              totalReviews: raw.totalReviews !== undefined && raw.totalReviews !== null ? Number(raw.totalReviews) : undefined,
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
      const rawEng = booking.engagement?.toUpperCase();
      if (
        rawEng === 'FULL_TIME' ||
        rawEng === 'PART_TIME' ||
        rawEng === 'LIVE_IN' ||
        rawEng === 'DAILY' ||
        rawEng === 'HOURLY' ||
        rawEng === 'SHIFT' ||
        rawEng === 'ONE_TIME'
      ) {
        engagement = rawEng;
      } else if (booking.engagementType === 'PART_TIME') engagement = 'PART_TIME';
      else if (booking.engagementType === 'FULL_TIME_LIVE_IN') engagement = 'LIVE_IN';
      else if (booking.engagementType === 'ONE_TIME') engagement = 'ONE_TIME';

      let resolvedAreaId = booking.areaId;
      if (!resolvedAreaId && booking.customerLocality) {
        try {
          const areasRes = await httpClient.get<{ data?: Array<Record<string, unknown>> }>('/admin/service-areas', {
            params: { limit: 100 },
          });
          const areas = Array.isArray(areasRes.data?.data) ? areasRes.data.data : [];
          const found = areas.find(
            (a) => String(a.name || '').trim().toLowerCase() === booking.customerLocality.trim().toLowerCase()
          );
          if (found?.id) resolvedAreaId = String(found.id);
        } catch {
          // Leave unresolved if lookup fails
        }
      }

      if (!resolvedAreaId) {
        return [];
      }

      try {
        const matched = await this.matchCandidates({
          category: booking.categoryCode || booking.serviceCategory.toUpperCase().replace(/\s+/g, '_'),
          areaId: resolvedAreaId,
          engagement,
          availableFrom: booking.availableFrom || '09:00',
          availableTo: booking.availableTo || '17:00',
        });
        return matched;
      } catch {
        return [];
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async assignMatchedWorker(bookingId: string, workerId: string, reason?: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/match`,
        {
          workerId,
          ...(reason ? { reason } : {}),
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reopenMatching(bookingId: string, reason: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_reopen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/reopen-matching`,
        { reason },
        { headers: { 'Idempotency-Key': key } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async scheduleTrial(
    bookingId: string,
    candidateWorkerId: string,
    trial: TrialSchedule & { scheduleType?: 'TRIAL' | 'INTERVIEW' }
  ): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/schedule`,
        {
          scheduleType: trial.scheduleType || 'TRIAL',
          scheduledAt: trial.scheduledDate,
          workerId: candidateWorkerId,
          ...(trial.notes ? { note: trial.notes } : {}),
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
      bookingDetailCache.delete(bookingId);
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

  async confirmBooking(bookingId: string, startDate?: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/confirm-worker`,
        {
          startDate: startDate || new Date().toISOString().split('T')[0],
        },
        {
          headers: { 'Idempotency-Key': key },
        }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async startService(bookingId: string, note?: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_start_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/start`,
        note ? { note } : {},
        { headers: { 'Idempotency-Key': key } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async completeBooking(bookingId: string, note?: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/bookings/${bookingId}/complete`,
        note ? { note } : {},
        { headers: { 'Idempotency-Key': key } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async respondSlotProposal(bookingId: string, answer: 'accept' | 'reject', note?: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
      await httpClient.post(`/admin/bookings/${bookingId}/slot-proposal/${answer}`, note ? { note } : {});
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async performInterviewAction(
    interviewId: string,
    action: 'confirm' | 'reschedule' | 'complete' | 'cancel',
    payload?: InterviewActionPayload
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/interviews/${encodeURIComponent(interviewId)}/${action}`, payload || {});
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingAttendance(
    bookingId: string,
    params?: { from?: string; to?: string; page?: number; limit?: number }
  ): Promise<BookingAttendanceEntry[]> {
    const result = await this.getBookingAttendancePage(bookingId, params);
    return result.items;
  }

  async getBookingAttendancePage(
    bookingId: string,
    params?: { from?: string; to?: string; page?: number; limit?: number }
  ): Promise<BookingAttendancePage> {
    try {
      const requestedPage = params?.page ?? 1;
      const requestedLimit = params?.limit ?? 100;
      const res = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
        meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
      }>(`/admin/attendance/bookings/${encodeURIComponent(bookingId)}`, {
        params: {
          page: requestedPage,
          limit: requestedLimit,
          ...(params?.from ? { from: params.from } : {}),
          ...(params?.to ? { to: params.to } : {}),
        },
      });
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? (res.data as Array<Record<string, unknown>>)
        : [];
      const responseEtag =
        typeof (res as { headers?: Record<string, string> }).headers?.etag === 'string'
          ? (res as { headers?: Record<string, string> }).headers?.etag
          : undefined;
      const items = list.map((item) => ({
        id: String(item.id || ''),
        bookingId: String(item.bookingId || bookingId),
        workerId: String(item.workerId || ''),
        date: String(item.date || ''),
        status: String(item.status || 'PRESENT'),
        checkInTime: item.checkInAt ? String(item.checkInAt) : item.checkInTime ? String(item.checkInTime) : null,
        checkOutTime: item.checkOutAt ? String(item.checkOutAt) : item.checkOutTime ? String(item.checkOutTime) : null,
        note: item.note ? String(item.note) : null,
        markedByRole: item.recordedBy ? String(item.recordedBy) : item.markedByRole ? String(item.markedByRole) : undefined,
        recordedByUserId: item.recordedByUserId ? String(item.recordedByUserId) : null,
        createdAt: item.createdAt ? String(item.createdAt) : undefined,
        updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
        etag: item.etag ? String(item.etag) : responseEtag,
        history: Array.isArray(item.history)
          ? (item.history as Array<Record<string, unknown>>).map((h, idx) => ({
              id: String(h.id || `${item.id || 'att'}-hist-${idx}`),
              previousStatus:
                h.from !== undefined && h.from !== null
                  ? String(h.from)
                  : h.previousStatus
                  ? String(h.previousStatus)
                  : null,
              newStatus: String(h.to || h.newStatus || ''),
              note: h.note !== undefined && h.note !== null ? String(h.note) : null,
              reason: h.reason !== undefined && h.reason !== null ? String(h.reason) : null,
              changedByUserId: h.actorUserId ? String(h.actorUserId) : h.changedByUserId ? String(h.changedByUserId) : null,
              actorKind: h.actorKind ? String(h.actorKind) : null,
              changedAt: String(h.at || h.changedAt || ''),
            }))
          : [],
      }));
      const rawMeta = res.data?.meta;
      const total = typeof rawMeta?.total === 'number' ? rawMeta.total : items.length;
      const limit = typeof rawMeta?.limit === 'number' ? rawMeta.limit : requestedLimit;
      const page = typeof rawMeta?.page === 'number' ? rawMeta.page : requestedPage;
      const totalPages =
        typeof rawMeta?.totalPages === 'number'
          ? Math.max(1, rawMeta.totalPages)
          : Math.max(1, Math.ceil(total / limit));
      return { items, meta: { page, limit, total, totalPages } };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  /**
   * Aggregates attendance across all started bookings using booking-scoped endpoints.
   * Paginates all booking pages and all attendance pages; never silently omits failed bookings
   * or exceeds safe fan-out limits without setting `isComplete: false`.
   */
  async getAllAttendanceOverview(params?: { from?: string; to?: string }): Promise<GlobalAttendanceOverview> {
    try {
      const [customerMap, workerMap, firstPageRes] = await Promise.all([
        getCustomerRegistry(),
        getWorkerRegistry(),
        httpClient.get<{
          data?: Record<string, unknown>[];
          meta?: { page?: number; limit?: number; total?: number };
        }>('/admin/bookings', { params: { page: 1, limit: 100 } }),
      ]);

      const extractList = (payload: unknown): Record<string, unknown>[] => {
        const obj = payload as { data?: unknown };
        if (Array.isArray(obj?.data)) return obj.data as Record<string, unknown>[];
        if (Array.isArray(payload)) return payload as Record<string, unknown>[];
        return [];
      };

      const rawBookings = [...extractList(firstPageRes.data)];
      const totalBookings = Number(firstPageRes.data?.meta?.total ?? rawBookings.length);
      const totalBookingPages = Math.max(1, Math.ceil(totalBookings / 100));

      if (totalBookingPages > 1) {
        const pageNumbers = Array.from({ length: totalBookingPages - 1 }, (_, i) => i + 2);
        const restResponses = await Promise.all(
          pageNumbers.map((pageNum) =>
            httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/bookings', {
              params: { page: pageNum, limit: 100 },
            })
          )
        );
        for (const res of restResponses) {
          rawBookings.push(...extractList(res.data));
        }
      }

      const mergeCachedBookingDetail = (raw: Record<string, unknown>): Record<string, unknown> => {
        const id = String(raw.id || raw.bookingId || '');
        const cached = id ? bookingDetailCache.get(id) : undefined;
        return cached ? { ...raw, ...cached } : raw;
      };

      const rawBookingsWithCache = rawBookings.map(mergeCachedBookingDetail);
      let bookings = rawBookingsWithCache.map((b) => mapBackendBookingToDomain(b, customerMap, workerMap));
      const candidates = bookings.filter(
        (b) =>
          Boolean(b.assignedWorkerId) &&
          (Boolean(b.serviceStartDate) ||
            ['SERVICE_ACTIVE', 'ACTIVE', 'COMPLETED', 'REPLACED', 'REPLACEMENT_REQUESTED'].includes(b.status))
      );

      const MAX_SAFE_FANOUT_BOOKINGS = 80;
      if (candidates.length > MAX_SAFE_FANOUT_BOOKINGS) {
        return {
          entries: [],
          bookings,
          isComplete: false,
          failedBookingsCount: 0,
          incompleteReason: `Unable to load all ${candidates.length} bookings cleanly via booking-scoped attendance endpoints. A global GET /admin/attendance endpoint is required.`,
        };
      }

      const allEntries: BookingAttendanceEntry[] = [];
      let failedBookingsCount = 0;

      const fetchAllPagesForBooking = async (bookingId: string): Promise<BookingAttendanceEntry[]> => {
        const firstAtt = await this.getBookingAttendancePage(bookingId, {
          from: params?.from,
          to: params?.to,
          page: 1,
          limit: 100,
        });
        const rows = [...firstAtt.items];
        if (firstAtt.meta.totalPages > 1) {
          const restAttPages = await Promise.all(
            Array.from({ length: firstAtt.meta.totalPages - 1 }, (_, idx) =>
              this.getBookingAttendancePage(bookingId, {
                from: params?.from,
                to: params?.to,
                page: idx + 2,
                limit: 100,
              })
            )
          );
          for (const p of restAttPages) {
            rows.push(...p.items);
          }
        }
        return rows;
      };

      const BATCH_SIZE = 5;
      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(
          batch.map((b) => fetchAllPagesForBooking(b.id))
        );
        for (const outcome of settled) {
          if (outcome.status === 'fulfilled') {
            allEntries.push(...outcome.value);
          } else {
            failedBookingsCount++;
          }
        }
      }

      // Enrich bookings that appear in attendance logs or active/started candidate rows when list payload omitted customerUserId
      const entryBookingIds = new Set(allEntries.map((e) => e.bookingId));
      const detailIdsToFetch = bookings
        .filter((b) => {
          const isRenderedOrActive =
            entryBookingIds.has(b.id) ||
            (['SERVICE_ACTIVE', 'ACTIVE', 'COMPLETED', 'REPLACED', 'REPLACEMENT_REQUESTED', 'CONFIRMED'].includes(b.status) &&
              Boolean(b.assignedWorkerId));
          if (!isRenderedOrActive) return false;
          const missingCustomer = !b.customerUserId && !b.customerId && b.customerName === 'Customer Details Unavailable';
          return missingCustomer && !bookingDetailCache.has(b.id);
        })
        .map((b) => b.id);

      if (detailIdsToFetch.length > 0) {
        for (let i = 0; i < detailIdsToFetch.length; i += BATCH_SIZE) {
          const batch = detailIdsToFetch.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (id) => {
              const detailRes = await httpClient.get<{ data?: Record<string, unknown> } | Record<string, unknown>>(
                `/admin/bookings/${encodeURIComponent(id)}`
              );
              const payload = detailRes.data as { data?: unknown } | Record<string, unknown>;
              const detailCandidate =
                payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
                  ? payload.data
                  : payload;
              if (
                detailCandidate &&
                typeof detailCandidate === 'object' &&
                !Array.isArray(detailCandidate) &&
                ('customerUserId' in detailCandidate || 'customerId' in detailCandidate || 'id' in detailCandidate)
              ) {
                bookingDetailCache.set(id, detailCandidate as Record<string, unknown>);
              }
            })
          );
        }
        bookings = rawBookingsWithCache
          .map(mergeCachedBookingDetail)
          .map((b) => mapBackendBookingToDomain(b, customerMap, workerMap));
      }

      allEntries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });

      const isComplete = failedBookingsCount === 0;
      return {
        entries: allEntries,
        bookings,
        isComplete,
        failedBookingsCount,
        incompleteReason: isComplete
          ? undefined
          : `Failed to fetch attendance for ${failedBookingsCount} booking${failedBookingsCount === 1 ? '' : 's'}. Cross-booking completeness requires a dedicated GET /admin/attendance endpoint.`,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingAttendanceSummary(bookingId: string, month: string): Promise<BookingAttendanceSummary | null> {
    try {
      const res = await httpClient.get<{ data?: Record<string, unknown> }>(
        `/admin/attendance/bookings/${encodeURIComponent(bookingId)}/summary`,
        { params: { month } }
      );
      const raw = (
        res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data
      ) as Record<string, unknown> | undefined;
      if (!raw || typeof raw !== 'object') return null;
      const win =
        raw.scheduledWindow && typeof raw.scheduledWindow === 'object'
          ? (raw.scheduledWindow as Record<string, unknown>)
          : null;
      return {
        bookingId: String(raw.bookingId || bookingId),
        month: String(raw.month || month),
        from: raw.from ? String(raw.from) : undefined,
        to: raw.to ? String(raw.to) : undefined,
        daysInMonth: raw.daysInMonth !== undefined ? Number(raw.daysInMonth) : undefined,
        recorded: raw.recorded !== undefined ? Number(raw.recorded) : undefined,
        presentDays: Number(raw.present ?? raw.presentDays ?? 0),
        absentDays: Number(raw.absent ?? raw.absentDays ?? 0),
        lateDays: Number(raw.late ?? raw.lateDays ?? 0),
        exceptionDays: Number(raw.exception ?? raw.halfDays ?? 0),
        leaveDays: Number(raw.leave ?? raw.leaveDays ?? 0),
        scheduledWindow: win
          ? {
              from: win.from ? String(win.from) : undefined,
              to: win.to ? String(win.to) : undefined,
            }
          : null,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async recordBookingAttendance(bookingId: string, payload: RecordAttendanceInput): Promise<void> {
    try {
      const idempotencyKey =
        payload.idempotencyKey && payload.idempotencyKey.length >= 8
          ? payload.idempotencyKey
          : typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem_att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await httpClient.post(
        `/admin/attendance/bookings/${encodeURIComponent(bookingId)}`,
        {
          date: payload.date,
          status: payload.status,
          ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
        },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async correctBookingAttendance(attendanceId: string, payload: CorrectAttendanceInput): Promise<void> {
    try {
      await httpClient.patch(
        `/admin/attendance/${encodeURIComponent(attendanceId)}`,
        {
          status: payload.status,
          ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
          reason: payload.reason.trim(),
        },
        payload.etag ? { headers: { 'If-Match': payload.etag } } : undefined
      );
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void> {
    try {
      bookingDetailCache.delete(bookingId);
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
            }).catch(() => { });
          }
          await httpClient.post(`/admin/replacement-requests/${activeReq.id}/select`, {
            workerId: replacementWorkerId,
          });
          // Replacement selection complete: backend transitions original booking to REPLACED and creates successor booking.
          return;
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
      bookingDetailCache.delete(bookingId);
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

  async approveReplacement(requestId: string, remarks?: string, message?: string): Promise<void> {
    try {
      bookingDetailCache.clear();
      await httpClient.post(`/admin/replacement-requests/${requestId}/approve`, {
        remarks: remarks || undefined,
        message: message || undefined,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectReplacement(requestId: string, remarks: string, message?: string): Promise<void> {
    try {
      bookingDetailCache.clear();
      await httpClient.post(`/admin/replacement-requests/${requestId}/reject`, {
        remarks,
        message: message || undefined,
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
        locality: raw.serviceAreas?.[0]?.name || '',
        experienceYears: raw.experienceMonths ? Math.floor(raw.experienceMonths / 12) : 0,
        experienceMonths: raw.experienceMonths !== undefined && raw.experienceMonths !== null ? Number(raw.experienceMonths) : undefined,
        ratingAverage: undefined,
        totalReviews: undefined,
        matchScore: undefined,
        isFullyVerified: true,
        languages: Array.isArray(raw.languages) ? raw.languages : [],
        categories: raw.categories,
        serviceAreas: raw.serviceAreas,
        engagementPreference: raw.engagementPreference,
      }));
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async selectReplacementWorker(requestId: string, workerId: string): Promise<void> {
    try {
      bookingDetailCache.clear();
      await httpClient.post(`/admin/replacement-requests/${requestId}/select`, {
        workerId,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getBookingHistory(bookingId: string): Promise<BookingHistoryData> {
    try {
      const [detailRes, interviewsRes, chainRes, paymentsRes, auditRes, workerMap] = await Promise.all([
        httpClient.get<{ data?: Record<string, unknown> } | Record<string, unknown>>(`/admin/bookings/${bookingId}`).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/admin/bookings/${bookingId}/interviews`).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/admin/bookings/${bookingId}/replacement-chain`).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('/admin/payments', { params: { bookingId, limit: 20 } }).catch(() => null),
        httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('/admin/audit-logs', { params: { entityType: 'booking', entityId: bookingId, limit: 20 } }).catch(() => null),
        getWorkerRegistry(),
      ]);
      const rawDetail = (detailRes?.data && typeof detailRes.data === 'object' && 'data' in detailRes.data ? (detailRes.data as { data?: Record<string, unknown> }).data : detailRes?.data) as Record<string, unknown> | undefined;
      const rawTimeline = Array.isArray(rawDetail?.timeline) ? rawDetail.timeline : [];
      let interviews = Array.isArray(interviewsRes?.data) ? interviewsRes.data : (Array.isArray((interviewsRes?.data as { data?: unknown[] })?.data) ? (interviewsRes?.data as { data: Array<Record<string, unknown>> }).data : []);

      // Preserve interview & trial history from predecessor booking if current booking has no interviews logged
      if (rawDetail?.replacesBookingId && interviews.length === 0) {
        try {
          const priorIntvRes = await httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(`/admin/bookings/${rawDetail.replacesBookingId}/interviews`).catch(() => null);
          const priorInterviews = Array.isArray(priorIntvRes?.data) ? priorIntvRes.data : (Array.isArray((priorIntvRes?.data as { data?: unknown[] })?.data) ? (priorIntvRes?.data as { data: Array<Record<string, unknown>> }).data : []);
          if (priorInterviews.length > 0) {
            interviews = priorInterviews;
          }
        } catch {
          // Keep current interviews list
        }
      }

      const replacementChain = Array.isArray(chainRes?.data) ? chainRes.data : (Array.isArray((chainRes?.data as { data?: unknown[] })?.data) ? (chainRes?.data as { data: Array<Record<string, unknown>> }).data : []);

      const rawPayments = Array.isArray(paymentsRes?.data)
        ? paymentsRes.data
        : (Array.isArray((paymentsRes?.data as { data?: unknown[] })?.data)
          ? (paymentsRes?.data as { data: Array<Record<string, unknown>> }).data
          : []);

      const payments = rawPayments.map((p: Record<string, unknown>) => ({
        id: String(p.id || ''),
        bookingId: String(p.bookingId || bookingId),
        status: String(p.status || 'PAID'),
        amountMinor: Number(p.amountMinor || (Number(p.amountINR || 0) * 100)),
        amountINR: p.amountMinor !== undefined && p.amountMinor !== null ? Number(p.amountMinor) / 100 : Number(p.amountINR || 0),
        currency: String(p.currency || 'INR'),
        receiptNumber: p.receiptNumber ? String(p.receiptNumber) : null,
        paidAt: p.paidAt ? String(p.paidAt) : (p.createdAt ? String(p.createdAt) : null),
        refundStatus: p.refundStatus ? String(p.refundStatus) : null,
        refundedAt: p.refundedAt ? String(p.refundedAt) : null,
        refundReason: p.refundReason ? String(p.refundReason) : null,
        refundedByUserId: p.refundedByUserId ? String(p.refundedByUserId) : null,
        paymentMethod: p.paymentMethod ? String(p.paymentMethod) : null,
        paymentMethodDetail: p.paymentMethodDetail ? String(p.paymentMethodDetail) : null,
        gatewayReference: p.gatewayReference ? String(p.gatewayReference) : (p.gatewayRef ? String(p.gatewayRef) : null),
        providerOrderId: p.providerOrderId ? String(p.providerOrderId) : null,
        providerPaymentId: p.providerPaymentId ? String(p.providerPaymentId) : null,
        failureCode: p.failureCode ? String(p.failureCode) : null,
        failureReason: p.failureReason ? String(p.failureReason) : null,
        feeCode: p.feeCode ? String(p.feeCode) : 'PLATFORM_FEE',
        createdAt: String(p.createdAt || new Date().toISOString()),
      }));

      const rawAudits = Array.isArray(auditRes?.data)
        ? auditRes.data
        : (Array.isArray((auditRes?.data as { data?: unknown[] })?.data)
          ? (auditRes?.data as { data: Array<Record<string, unknown>> }).data
          : []);

      const auditLogs = rawAudits.map((a: Record<string, unknown>) => ({
        id: String(a.id || ''),
        actorStaffId: String(a.actorStaffId || a.actorId || 'STAFF'),
        actorName: String(a.actorName || a.actorEmail || 'Operations Admin'),
        actorRole: String(a.actorRole || 'Operations Admin'),
        actionType: String(a.action || a.actionType || 'BOOKING_UPDATE'),
        targetRecordId: String(a.entityId || a.targetRecordId || bookingId),
        targetEntityType: String(a.entityType || 'BOOKING'),
        summary: String(a.summary || a.description || a.message || 'Administrative booking action'),
        timestamp: String(a.createdAt || a.timestamp || new Date().toISOString()),
        operationalRemarks: a.operationalRemarks ? String(a.operationalRemarks) : undefined,
      }));

      const communications: BookingHistoryData['communications'] = Array.isArray(rawDetail?.communications)
        ? (rawDetail.communications as BookingCommunicationEvent[])
        : [];

      return {
        rawBookingDetail: rawDetail,
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
          requestedBy: intv.requestedBy ? String(intv.requestedBy) : undefined,
          preferredAt: intv.preferredAt ? String(intv.preferredAt) : undefined,
          scheduledAt: intv.scheduledAt ? String(intv.scheduledAt) : undefined,
          proposedAt: intv.proposedAt ? String(intv.proposedAt) : undefined,
          proposedBy: intv.proposedBy ? String(intv.proposedBy) : undefined,
          note: intv.note ? String(intv.note) : undefined,
          declineReason: intv.declineReason ? String(intv.declineReason) : undefined,
          cancelReason: intv.cancelReason ? String(intv.cancelReason) : undefined,
          outcomeNote: intv.outcomeNote ? String(intv.outcomeNote) : undefined,
          completedAt: intv.completedAt ? String(intv.completedAt) : undefined,
          cancelledAt: intv.cancelledAt ? String(intv.cancelledAt) : undefined,
          createdAt: intv.createdAt ? String(intv.createdAt) : undefined,
          timeline: Array.isArray(intv.timeline) ? intv.timeline as Array<{ title: string; state: string; at: string }> : undefined,
        })),
        replacementChain: replacementChain.map((link: Record<string, unknown>) => {
          const wId = link.workerId ? String(link.workerId) : '';
          const wObj = wId ? workerMap.get(wId) : undefined;
          return {
            bookingId: String(link.bookingId || ''),
            position: Number(link.position || 1),
            status: String(link.status || ''),
            replacesBookingId: link.replacesBookingId ? String(link.replacesBookingId) : null,
            workerId: wId,
            workerName: wObj?.name,
            startDate: link.startDate ? String(link.startDate) : undefined,
            createdAt: String(link.createdAt || ''),
            current: Boolean(link.current),
          };
        }),
        payments,
        auditLogs,
        communications,
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
