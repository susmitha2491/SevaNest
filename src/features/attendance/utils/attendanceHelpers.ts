import { BackendAttendanceStatus, BookingDetail } from '../../bookings/domain/types';

export const ATTENDANCE_STATUS_OPTIONS: Array<{ value: BackendAttendanceStatus; label: string }> = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'EXCEPTION', label: 'Exception' },
];

export interface BookingAttendanceEligibility {
  recordEligible: boolean;
  isHistoricalStatus: boolean;
  reason?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Formats long booking UUIDs into a readable unique reference without discarding short IDs. */
export function formatBookingReference(bookingId: string): string {
  if (!bookingId) return '—';
  if (UUID_REGEX.test(bookingId)) {
    return `BK-${bookingId.slice(-8).toUpperCase()}`;
  }
  return bookingId;
}

/** Returns current calendar date (YYYY-MM-DD) in Asia/Kolkata matching backend validation. */
export function getTodayISTDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/** Returns current calendar month (YYYY-MM) in Asia/Kolkata. */
export function getCurrentISTMonth(): string {
  return getTodayISTDate().slice(0, 7);
}

/**
 * Evaluates whether a booking supports recording new daily attendance (POST) vs view/correction only.
 * Backend OpenAPI rejects non-active bookings with 409 BOOKING_NOT_ACTIVE on POST.
 */
export function evaluateBookingAttendanceEligibility(
  booking?: Pick<BookingDetail, 'status' | 'assignedWorkerId' | 'serviceStartDate'> | null
): BookingAttendanceEligibility {
  if (!booking) {
    return {
      recordEligible: false,
      isHistoricalStatus: false,
      reason: 'Select a booking first to record or inspect attendance.',
    };
  }

  const status = String(booking.status || '').toUpperCase();
  if (status === 'SERVICE_ACTIVE' || status === 'ACTIVE') {
    if (!booking.assignedWorkerId) {
      return {
        recordEligible: false,
        isHistoricalStatus: true,
        reason: 'No worker is assigned to this booking yet.',
      };
    }
    return { recordEligible: true, isHistoricalStatus: false };
  }

  if (status === 'COMPLETED' || status === 'REPLACED') {
    return {
      recordEligible: false,
      isHistoricalStatus: true,
      reason: `Booking is ${status.toLowerCase()}. New attendance entries cannot be added, though historical logs can be inspected or corrected.`,
    };
  }

  if (status === 'CANCELLED') {
    return {
      recordEligible: false,
      isHistoricalStatus: false,
      reason: 'Cancelled bookings are not eligible for attendance tracking.',
    };
  }

  return {
    recordEligible: false,
    isHistoricalStatus: false,
    reason: 'Attendance recording is unavailable because the service has not started.',
  };
}

export function validateRecordAttendanceInput(params: {
  booking?: Pick<BookingDetail, 'status' | 'assignedWorkerId' | 'serviceStartDate'> | null;
  date: string;
  status: BackendAttendanceStatus;
  note: string;
}): string | null {
  const eligibility = evaluateBookingAttendanceEligibility(params.booking);
  if (!eligibility.recordEligible) {
    return eligibility.reason || 'Selected booking is not eligible for attendance recording.';
  }

  if (!params.date) {
    return 'Service date is required.';
  }

  const todayIST = getTodayISTDate();
  if (params.date > todayIST) {
    return `Future attendance cannot be recorded (latest allowed date: ${todayIST}).`;
  }

  const minDate = params.booking?.serviceStartDate?.slice(0, 10);
  if (minDate && /^\d{4}-\d{2}-\d{2}$/.test(minDate) && params.date < minDate) {
    return `Attendance date cannot be earlier than the service start date (${minDate}).`;
  }

  const trimmedNote = params.note.trim();
  if (params.status === 'EXCEPTION' && trimmedNote.length < 2) {
    return 'An operational note is required when recording an EXCEPTION attendance status.';
  }
  if (trimmedNote.length > 500) {
    return 'Operational note must be 500 characters or fewer.';
  }

  return null;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

