import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, ClipboardCheck, Edit3, Plus, X } from 'lucide-react';
import { bookingRepository } from '../data/bookingRepository';
import { BackendAttendanceStatus, BookingAttendanceEntry } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateIST, formatDateTimeIST } from '../../../shared/formatters/dateTime';
import {
  ATTENDANCE_STATUS_OPTIONS,
  generateIdempotencyKey,
  getCurrentISTMonth,
  getTodayISTDate,
} from '../../attendance/utils/attendanceHelpers';

interface BookingAttendanceSectionProps {
  bookingId: string;
  canViewAttendance: boolean;
  canManageAttendance: boolean;
}

export const BookingAttendanceSection: React.FC<BookingAttendanceSectionProps> = ({
  bookingId,
  canViewAttendance,
  canManageAttendance,
}) => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentISTMonth());
  const [isRecording, setIsRecording] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BookingAttendanceEntry | null>(null);

  const [date, setDate] = useState(() => getTodayISTDate());
  const [status, setStatus] = useState<BackendAttendanceStatus>('PRESENT');
  const [note, setNote] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const {
    data: entries = [],
    isLoading: isEntriesLoading,
    isError: isEntriesError,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ['bookings', 'attendance', bookingId],
    queryFn: () => bookingRepository.getBookingAttendance?.(bookingId) ?? Promise.resolve([]),
    enabled: Boolean(bookingId) && canViewAttendance,
  });

  const { data: summary } = useQuery({
    queryKey: ['bookings', 'attendance', bookingId, 'summary', selectedMonth],
    queryFn: () =>
      bookingRepository.getBookingAttendanceSummary?.(bookingId, selectedMonth) ?? Promise.resolve(null),
    enabled: Boolean(bookingId) && Boolean(selectedMonth) && canViewAttendance,
  });

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!bookingRepository.recordBookingAttendance) return;
      setFormError(null);
      const todayIST = getTodayISTDate();
      if (!date) throw new Error('Service date is required.');
      if (date > todayIST) throw new Error(`Future attendance cannot be recorded (latest: ${todayIST}).`);
      if (status === 'EXCEPTION' && note.trim().length < 2) {
        throw new Error('A note is required when recording an EXCEPTION attendance status.');
      }
      if (note.trim().length > 500) {
        throw new Error('Operational note must be 500 characters or fewer.');
      }
      const sig = `${bookingId}|${date}|${status}|${note.trim()}`;
      if (!idempotencyRef.current || idempotencyRef.current.signature !== sig) {
        idempotencyRef.current = { signature: sig, key: generateIdempotencyKey() };
      }
      await bookingRepository.recordBookingAttendance(bookingId, {
        date,
        status,
        note: note.trim() || undefined,
        idempotencyKey: idempotencyRef.current.key,
      });
      idempotencyRef.current = null;
    },
    onSuccess: async () => {
      setIsRecording(false);
      setNote('');
      await Promise.all([
        refetchEntries(),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'attendance', bookingId] }),
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      ]);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Failed to record attendance.');
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const correctMutation = useMutation({
    mutationFn: async () => {
      if (!editingEntry || !bookingRepository.correctBookingAttendance) return;
      setFormError(null);
      if (correctionReason.trim().length < 3) {
        throw new Error('Please provide a correction reason (minimum 3 characters).');
      }
      if (status === 'EXCEPTION' && note.trim().length < 2) {
        throw new Error('A note is required when updating attendance status to EXCEPTION.');
      }
      await bookingRepository.correctBookingAttendance(editingEntry.id, {
        status,
        note: note.trim() || undefined,
        reason: correctionReason.trim(),
        etag: editingEntry.etag,
      });
    },
    onSuccess: async () => {
      setEditingEntry(null);
      setCorrectionReason('');
      setNote('');
      await Promise.all([
        refetchEntries(),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'attendance', bookingId] }),
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      ]);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Failed to correct attendance.');
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  if (!canViewAttendance) return null;

  const openRecordForm = () => {
    setEditingEntry(null);
    setFormError(null);
    setDate(getTodayISTDate());
    setStatus('PRESENT');
    setNote('');
    idempotencyRef.current = null;
    setIsRecording(true);
  };

  const openCorrectForm = (entry: BookingAttendanceEntry) => {
    setIsRecording(false);
    setFormError(null);
    setEditingEntry(entry);
    setStatus((entry.status as BackendAttendanceStatus) || 'PRESENT');
    setNote(entry.note || '');
    setCorrectionReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck size={17} color="#0284c7" />
            <span>Service Attendance &amp; Daily Logs</span>
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
            Monthly attendance summary, check-in/out timestamps, and audited corrections
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
            Month:
            <input
              type="month"
              aria-label="Attendance Month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                marginLeft: '6px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
              }}
            />
          </label>

          {canManageAttendance && !isRecording && !editingEntry && (
            <button
              type="button"
              onClick={openRecordForm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Record Attendance</span>
            </button>
          )}
        </div>
      </div>

      {/* Monthly Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
          {[
            { label: 'Recorded', value: summary.recorded ?? entries.length, color: '#0f172a', bg: '#f8fafc' },
            { label: 'Present', value: summary.presentDays, color: '#15803d', bg: '#f0fdf4' },
            { label: 'Absent', value: summary.absentDays, color: '#b91c1c', bg: '#fef2f2' },
            { label: 'Late', value: summary.lateDays, color: '#b45309', bg: '#fffbeb' },
            { label: 'Leave', value: summary.leaveDays, color: '#475569', bg: '#f8fafc' },
            { label: 'Exceptions', value: summary.exceptionDays, color: '#0369a1', bg: '#f0f9ff' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: stat.bg,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{stat.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: stat.color, marginTop: '2px' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Record or Correct Form */}
      {(isRecording || editingEntry) && canManageAttendance && (
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
              {editingEntry ? `Correct Attendance Entry (${formatDateIST(editingEntry.date)})` : 'Record Daily Attendance'}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingEntry && (
                <span style={{ fontSize: '11px', color: '#475569' }}>
                  Current: <strong>{editingEntry.status}</strong> → Proposed: <strong>{status}</strong>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsRecording(false);
                  setEditingEntry(null);
                  setFormError(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                aria-label="Close attendance form"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {formError && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
            {!editingEntry && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                  Service Date
                </label>
                <input
                  type="date"
                  aria-label="Attendance Date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                Status
              </label>
              <select
                aria-label="Attendance Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BackendAttendanceStatus)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              >
                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: editingEntry ? '1fr 1fr' : '1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                Note {status === 'EXCEPTION' ? '(Required for Exception)' : '(Optional)'}
              </label>
              <input
                type="text"
                aria-label="Attendance Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Shift or arrival note..."
                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            {editingEntry && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                  Correction Reason *
                </label>
                <input
                  type="text"
                  aria-label="Correction Reason"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Why is this attendance log being corrected?"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                if (submitLockRef.current || recordMutation.isPending || correctMutation.isPending) return;
                submitLockRef.current = true;
                if (editingEntry) {
                  correctMutation.mutate();
                } else {
                  recordMutation.mutate();
                }
              }}
              disabled={recordMutation.isPending || correctMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: recordMutation.isPending || correctMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckCircle2 size={14} />
              <span>
                {editingEntry
                  ? correctMutation.isPending
                    ? 'Updating...'
                    : 'Save Correction'
                  : recordMutation.isPending
                  ? 'Saving...'
                  : 'Save Attendance'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px' }}>
        {isEntriesLoading ? (
          <LoadingSpinner message="Loading attendance logs..." />
        ) : isEntriesError ? (
          <div style={{ fontSize: '12px', color: '#b91c1c' }}>Unable to load attendance logs.</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px' }}>
            <Calendar size={24} color="#cbd5e1" style={{ margin: '0 auto 6px', display: 'block' }} />
            No attendance logs recorded for this booking yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formatDateIST(entry.date)}</strong>
                    <StatusBadge status={entry.status} />
                    {(entry.checkInTime || entry.checkOutTime) && (
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {entry.checkInTime ? formatDateTimeIST(entry.checkInTime) : '--'} –{' '}
                        {entry.checkOutTime ? formatDateTimeIST(entry.checkOutTime) : '--'}
                      </span>
                    )}
                    {entry.markedByRole && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>By: {entry.markedByRole}</span>
                    )}
                  </div>
                  {entry.note && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{entry.note}</div>
                  )}
                  {entry.history && entry.history.length > 0 && (
                    <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1', fontSize: '11px', color: '#64748b' }}>
                      {entry.history.map((h) => (
                        <div key={h.id}>
                          {h.previousStatus ? `${h.previousStatus} → ` : ''}
                          <strong>{h.newStatus}</strong>
                          {h.reason ? ` (${h.reason})` : ''}
                          {h.actorKind ? ` · ${h.actorKind}` : ''}
                          {h.changedAt ? ` · ${formatDateTimeIST(h.changedAt)}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canManageAttendance && (
                  <button
                    type="button"
                    onClick={() => openCorrectForm(entry)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={12} />
                    <span>Correct</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
