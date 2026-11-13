import React, { useState } from 'react';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
import {
  BackendAttendanceStatus,
  BookingAttendanceEntry,
  BookingDetail,
} from '../../bookings/domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatDateIST, formatDateTimeIST } from '../../../shared/formatters/dateTime';
import {
  ATTENDANCE_STATUS_OPTIONS,
  formatBookingReference,
  getTodayISTDate,
  validateRecordAttendanceInput,
} from '../utils/attendanceHelpers';

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
};

const fieldControlStyle: React.CSSProperties = {
  width: '100%',
  height: '38px',
  padding: '0 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  backgroundColor: '#ffffff',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
};

interface AttendanceDetailModalProps {
  entry: BookingAttendanceEntry | null;
  booking?: BookingDetail;
  canViewBookings: boolean;
  canManage: boolean;
  scheduledWindowLabel?: string | null;
  onNavigateToBooking: (bookingId: string) => void;
  onOpenCorrect: (entry: BookingAttendanceEntry) => void;
  onClose: () => void;
}

export const AttendanceDetailModal: React.FC<AttendanceDetailModalProps> = ({
  entry,
  booking,
  canViewBookings,
  canManage,
  scheduledWindowLabel,
  onNavigateToBooking,
  onOpenCorrect,
  onClose,
}) => {
  if (!entry) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-detail-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <h2 id="attendance-detail-title" style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
              Attendance Log Details — {formatDateIST(entry.date)}
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Ref {formatBookingReference(entry.bookingId)}
              {scheduledWindowLabel ? ` · Shift ${scheduledWindowLabel}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attendance detail"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Booking summary header */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Booking: </span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--color-navy)' }}>
                {formatBookingReference(entry.bookingId)}
              </strong>
              {booking?.serviceCategory && (
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                  {booking.serviceCategory} ({booking.customerLocality})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusBadge status={entry.status} />
              {canViewBookings && (
                <button
                  type="button"
                  onClick={() => onNavigateToBooking(entry.bookingId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <span>Open Booking</span>
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Customer</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking?.customerName || 'Not provided by endpoint'}
              </div>
              {booking?.customerPhoneMasked && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {booking.customerPhoneMasked}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Worker</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking?.assignedWorkerName || formatBookingReference(entry.workerId)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '1px' }}>
                ID: {formatBookingReference(entry.workerId)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Check-In Timestamp</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {entry.checkInTime ? formatDateTimeIST(entry.checkInTime) : 'Not recorded'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Check-Out Timestamp</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {entry.checkOutTime ? formatDateTimeIST(entry.checkOutTime) : 'Not recorded'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Recorded By</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {entry.markedByRole || 'Not specified'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Last Updated</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {entry.updatedAt ? formatDateTimeIST(entry.updatedAt) : formatDateIST(entry.date)}
              </div>
            </div>
          </div>

          <div>
            <div style={fieldLabelStyle}>Operational Note</div>
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                color: entry.note ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {entry.note || 'No operational note attached.'}
            </div>
          </div>

          <div>
            <div style={fieldLabelStyle}>Audit Change History ({entry.history?.length || 0})</div>
            {!entry.history?.length ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                No change history recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '190px', overflowY: 'auto' }}>
                {entry.history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--color-border)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        {h.previousStatus ? (
                          <>
                            <span>{h.previousStatus}</span>
                            <span style={{ margin: '0 4px', color: 'var(--color-text-muted)' }}>→</span>
                          </>
                        ) : null}
                        <strong>{h.newStatus}</strong>
                        {h.actorKind ? <span style={{ color: 'var(--color-text-muted)' }}> · By {h.actorKind}</span> : null}
                      </div>
                      {h.changedAt && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {formatDateTimeIST(h.changedAt)}
                        </span>
                      )}
                    </div>
                    {h.reason && (
                      <div style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Reason: {h.reason}
                      </div>
                    )}
                    {h.note && (
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Note: {h.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: '#ffffff',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCorrect(entry);
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Correct Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface RecordAttendanceModalProps {
  isOpen: boolean;
  booking?: BookingDetail;
  initialDate?: string;
  recordedDates?: Set<string>;
  scheduledWindowLabel?: string | null;
  isSubmitting: boolean;
  serverError: string | null;
  onSubmit: (payload: { date: string; status: BackendAttendanceStatus; note?: string }) => void;
  onClose: () => void;
}

export const RecordAttendanceModal: React.FC<RecordAttendanceModalProps> = ({
  isOpen,
  booking,
  initialDate,
  recordedDates,
  scheduledWindowLabel,
  isSubmitting,
  serverError,
  onSubmit,
  onClose,
}) => {
  const [date, setDate] = useState(() => initialDate || getTodayISTDate());
  const [status, setStatus] = useState<BackendAttendanceStatus>('PRESENT');
  const [note, setNote] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const todayIST = getTodayISTDate();
  const minDate = booking.serviceStartDate?.slice(0, 10);
  const displayError = validationError || serverError;

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (recordedDates?.has(date)) {
      setValidationError(
        `Attendance for ${formatDateIST(date)} is already recorded. Use Correct on the existing record to update it.`
      );
      return;
    }
    const err = validateRecordAttendanceInput({ booking, date, status, note });
    if (err) {
      setValidationError(err);
      return;
    }
    if (!confirmChecked) {
      setValidationError('Please confirm that this attendance record reflects verified service delivery.');
      return;
    }
    setValidationError(null);
    onSubmit({ date, status, note: note.trim() || undefined });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-attendance-title"
      onClick={() => !isSubmitting && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 1050,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '500px',
          width: '100%',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
          }}
        >
          <h2 id="record-attendance-title" style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Record Booking Attendance
          </h2>
          <button
            type="button"
            aria-label="Close attendance action modal"
            disabled={isSubmitting}
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Read-only booking context summary */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontFamily: 'monospace', color: 'var(--color-navy)' }}>
                {formatBookingReference(booking.id)}
              </strong>
              <StatusBadge status={booking.status} />
            </div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
              {booking.customerName} → {booking.assignedWorkerName || 'Assigned Worker'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {booking.serviceStartDate ? `Service Start: ${formatDateIST(booking.serviceStartDate)}` : 'Active Service'}
              {scheduledWindowLabel ? ` · Shift: ${scheduledWindowLabel}` : ''}
            </div>
          </div>

          {displayError && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-status-danger-bg)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {displayError}
            </div>
          )}

          <div>
            <label htmlFor="att-record-date" style={fieldLabelStyle}>
              Service Date *
            </label>
            <input
              id="att-record-date"
              type="date"
              value={date}
              min={minDate && /^\d{4}-\d{2}-\d{2}$/.test(minDate) ? minDate : undefined}
              max={todayIST}
              disabled={isSubmitting}
              onChange={(e) => setDate(e.target.value)}
              style={fieldControlStyle}
            />
          </div>

          <div>
            <label htmlFor="att-record-status" style={fieldLabelStyle}>
              Attendance Status *
            </label>
            <select
              id="att-record-status"
              value={status}
              disabled={isSubmitting}
              onChange={(e) => setStatus(e.target.value as BackendAttendanceStatus)}
              style={fieldControlStyle}
            >
              {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="att-record-note" style={fieldLabelStyle}>
                Operational Note {status === 'EXCEPTION' ? '*' : '(Optional)'}
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {note.length}/500
              </span>
            </div>
            <input
              id="att-record-note"
              type="text"
              maxLength={500}
              value={note}
              disabled={isSubmitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder={status === 'EXCEPTION' ? 'Required note explaining exception...' : 'Shift or arrival details...'}
              style={fieldControlStyle}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={confirmChecked}
              disabled={isSubmitting}
              onChange={(e) => setConfirmChecked(e.target.checked)}
            />
            <span>I confirm this attendance entry reflects verified service delivery.</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CorrectAttendanceModalProps {
  entry: BookingAttendanceEntry | null;
  booking?: BookingDetail;
  isSubmitting: boolean;
  serverError: string | null;
  onSubmit: (payload: { status: BackendAttendanceStatus; note?: string; reason: string }) => void;
  onClose: () => void;
}

export const CorrectAttendanceModal: React.FC<CorrectAttendanceModalProps> = ({
  entry,
  booking,
  isSubmitting,
  serverError,
  onSubmit,
  onClose,
}) => {
  const [proposedStatus, setProposedStatus] = useState<BackendAttendanceStatus>(
    () => (entry?.status as BackendAttendanceStatus) || 'PRESENT'
  );
  const [note, setNote] = useState(() => entry?.note || '');
  const [reason, setReason] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!entry) return null;

  const displayError = validationError || serverError;

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (reason.trim().length < 3) {
      setValidationError('A correction reason is required (minimum 3 characters).');
      return;
    }
    if (reason.trim().length > 500) {
      setValidationError('Correction reason must be 500 characters or fewer.');
      return;
    }
    if (proposedStatus === 'EXCEPTION' && note.trim().length < 2) {
      setValidationError('An operational note is required when changing attendance status to EXCEPTION.');
      return;
    }
    if (note.trim().length > 500) {
      setValidationError('Operational note must be 500 characters or fewer.');
      return;
    }
    if (proposedStatus === entry.status && note.trim() === (entry.note || '').trim()) {
      setValidationError('Update the attendance status or note before saving a correction.');
      return;
    }
    if (!confirmChecked) {
      setValidationError('Please confirm this audited attendance correction before submitting.');
      return;
    }
    setValidationError(null);
    onSubmit({
      status: proposedStatus,
      note: note.trim() || undefined,
      reason: reason.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-attendance-title"
      onClick={() => !isSubmitting && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 1050,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '520px',
          width: '100%',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
          }}
        >
          <h2 id="correct-attendance-title" style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Correct Attendance ({formatDateIST(entry.date)})
          </h2>
          <button
            type="button"
            aria-label="Close attendance action modal"
            disabled={isSubmitting}
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Current vs Proposed status summary */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <strong style={{ fontFamily: 'monospace', color: 'var(--color-navy)' }}>
                {formatBookingReference(entry.bookingId)}
              </strong>{' '}
              · {booking?.customerName || 'Customer'} → {booking?.assignedWorkerName || formatBookingReference(entry.workerId)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Current:</span>
                <StatusBadge status={entry.status} />
              </div>
              <ArrowRight size={14} color="var(--color-text-muted)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Proposed:</span>
                <StatusBadge status={proposedStatus} />
              </div>
            </div>
          </div>

          {displayError && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-status-danger-bg)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {displayError}
            </div>
          )}

          <div>
            <label htmlFor="att-correct-status" style={fieldLabelStyle}>
              Proposed Attendance Status *
            </label>
            <select
              id="att-correct-status"
              value={proposedStatus}
              disabled={isSubmitting}
              onChange={(e) => setProposedStatus(e.target.value as BackendAttendanceStatus)}
              style={fieldControlStyle}
            >
              {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="att-correct-note" style={fieldLabelStyle}>
                Operational Note {proposedStatus === 'EXCEPTION' ? '*' : '(Optional)'}
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {note.length}/500
              </span>
            </div>
            <input
              id="att-correct-note"
              type="text"
              maxLength={500}
              value={note}
              disabled={isSubmitting}
              onChange={(e) => setNote(e.target.value)}
              placeholder={proposedStatus === 'EXCEPTION' ? 'Required note explaining exception...' : 'Updated note...'}
              style={fieldControlStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="att-correction-reason" style={fieldLabelStyle}>
                Correction Reason *
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {reason.length}/500
              </span>
            </div>
            <textarea
              id="att-correction-reason"
              rows={2}
              maxLength={500}
              value={reason}
              disabled={isSubmitting}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter mandatory audit reason for changing this record (min 3 characters)..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={confirmChecked}
              disabled={isSubmitting}
              onChange={(e) => setConfirmChecked(e.target.checked)}
            />
            <span>
              I confirm updating status from <strong>{entry.status}</strong> to <strong>{proposedStatus}</strong>.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

