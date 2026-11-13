import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ShieldCheck,
  Star,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { BookingDetail, CandidateMatch, MatchRequirement, TrialSchedule } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

interface CandidateMatchingModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onTrialScheduled?: () => void;
}

function getDefaultFutureDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export const CandidateMatchingModal: React.FC<CandidateMatchingModalProps> = ({
  booking,
  isOpen,
  onClose,
  onTrialScheduled,
}) => {
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateMatch | null>(null);

  // Schedule form state (uses genuine future date/time -> ISO 8601)
  const [scheduleType, setScheduleType] = useState<'TRIAL' | 'INTERVIEW'>('TRIAL');
  const [scheduledDateInput, setScheduledDateInput] = useState<string>(getDefaultFutureDate);
  const [scheduledTimeInput, setScheduledTimeInput] = useState<string>('10:00');
  const [durationHours, setDurationHours] = useState(2);
  const [trialAddress, setTrialAddress] = useState('');
  const [trialNotes, setTrialNotes] = useState('');
  const [trialFee, setTrialFee] = useState(250);

  // Optional candidate matching filters
  const [languageFilter, setLanguageFilter] = useState('');
  const [minExperienceMonths, setMinExperienceMonths] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const canDirectAssignOnly =
    booking?.status === 'REQUESTED' || booking?.status === 'NEW_REQUEST';

  const hasCustomFilter = Boolean(languageFilter.trim() || minExperienceMonths.trim());

  // Query candidate suggestions (or filtered matching when areaId & filters present)
  const { data: candidates, isLoading, isError: isCandidatesError } = useQuery({
    queryKey: ['bookings', 'candidates', booking?.id, languageFilter.trim(), minExperienceMonths.trim()],
    queryFn: async () => {
      if (!booking) return [];
      if (hasCustomFilter && booking.areaId && bookingRepository.matchCandidates) {
        const rawEng = booking.engagement?.toUpperCase();
        const engagement: MatchRequirement['engagement'] =
          rawEng === 'FULL_TIME' ||
          rawEng === 'PART_TIME' ||
          rawEng === 'LIVE_IN' ||
          rawEng === 'DAILY' ||
          rawEng === 'HOURLY' ||
          rawEng === 'SHIFT' ||
          rawEng === 'ONE_TIME'
            ? rawEng
            : booking.engagementType === 'PART_TIME'
            ? 'PART_TIME'
            : booking.engagementType === 'FULL_TIME_LIVE_IN'
            ? 'LIVE_IN'
            : booking.engagementType === 'ONE_TIME'
            ? 'ONE_TIME'
            : 'FULL_TIME';
        return bookingRepository.matchCandidates({
          category: booking.categoryCode || booking.serviceCategory.toUpperCase().replace(/\s+/g, '_'),
          areaId: booking.areaId,
          engagement,
          availableFrom: booking.availableFrom || '09:00',
          availableTo: booking.availableTo || '17:00',
          ...(languageFilter.trim() ? { language: languageFilter.trim() } : {}),
          ...(minExperienceMonths.trim() && Number(minExperienceMonths) > 0
            ? { minExperienceMonths: Number(minExperienceMonths) }
            : {}),
        });
      }
      return bookingRepository.getCandidateSuggestions(booking.id);
    },
    enabled: !!booking && isOpen,
  });

  const computedIsoSchedule = useMemo(() => {
    if (!scheduledDateInput || !scheduledTimeInput) return null;
    const parsed = new Date(`${scheduledDateInput}T${scheduledTimeInput}:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }, [scheduledDateInput, scheduledTimeInput]);

  // Assign matched worker only (NEW_REQUEST -> MATCHED)
  const assignMatchMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate || !bookingRepository.assignMatchedWorker) return;
      setActionError(null);
      await bookingRepository.assignMatchedWorker(
        booking.id,
        selectedCandidate.workerId,
        trialNotes.trim() || undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onTrialScheduled?.();
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to assign matched worker.');
    },
  });

  // Schedule interview/trial mutation (NEW_REQUEST / MATCHED -> INTERVIEW_TRIAL_SCHEDULED)
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate) return;
      setActionError(null);
      if (!computedIsoSchedule) {
        throw new Error('Please choose a valid future date and time.');
      }
      if (new Date(computedIsoSchedule).getTime() <= Date.now()) {
        throw new Error('Scheduled date and time must be in the future.');
      }
      const trial: TrialSchedule & { scheduleType?: 'TRIAL' | 'INTERVIEW' } = {
        scheduledDate: computedIsoSchedule,
        timeSlot: `${scheduledDateInput} ${scheduledTimeInput}`,
        durationHours,
        customerAddress: trialAddress || `${booking.customerLocality} Residential Address`,
        contactPerson: booking.customerName,
        contactPhone: booking.customerPhoneMasked,
        trialFeeAmount: trialFee,
        notes: trialNotes,
        scheduleType,
      };
      await bookingRepository.scheduleTrial(booking.id, selectedCandidate.workerId, trial);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onTrialScheduled?.();
      onClose();
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to schedule trial/interview.');
    },
  });

  if (!isOpen || !booking) return null;

  const isBusy = scheduleMutation.isPending || assignMatchMutation.isPending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
        backdropFilter: 'blur(3px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="matching-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <div>
            <h2
              id="matching-modal-title"
              style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
            >
              Candidate Worker Matching Wizard
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Booking <strong>{booking.id}</strong> • {booking.serviceCategory} in <strong>{booking.customerLocality}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-tertiary)',
            }}
            aria-label="Close matching modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Customer Requirement Criteria Pill Bar */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Customer: </span>
              <strong>{booking.customerName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Category: </span>
              <strong>{booking.serviceCategory}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Shift: </span>
              <strong>
                {booking.availableFrom && booking.availableTo
                  ? `${booking.availableFrom} - ${booking.availableTo}`
                  : booking.timingShift}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Max Budget: </span>
              <strong>{formatCurrencyINR(booking.salaryBudgetMax)}/mo</strong>
            </div>
          </div>

          {/* Optional Matching Filters */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Filter by Language (Optional)
              </label>
              <input
                type="text"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                placeholder="e.g. Hindi, Telugu"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Min Experience (Months)
              </label>
              <input
                type="number"
                min={0}
                value={minExperienceMonths}
                onChange={(e) => setMinExperienceMonths(e.target.value)}
                placeholder="e.g. 12"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>
          </div>

          {/* Strict Verification Guarantee Alert */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-status-success-bg)',
              border: '1px solid var(--color-status-success-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-status-success-text)',
            }}
          >
            <ShieldCheck size={16} />
            <span>
              <strong>Verified Workforce Guarantee:</strong> Only active, verified workers matching the requirement&apos;s category, service area, and availability are surfaced.
            </span>
          </div>

          {actionError && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {actionError}
            </div>
          )}

          {/* Candidate Suggestions Grid */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
              Available Verified Candidate Matches ({candidates?.length || 0})
            </h3>

            {isLoading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Loading verified candidates...</div>
            ) : isCandidatesError ? (
              <div style={{ padding: 'var(--space-4)', color: 'var(--color-status-danger-text)', fontSize: 'var(--font-size-xs)' }}>
                Unable to load matching candidates right now.
              </div>
            ) : candidates?.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <AlertCircle size={32} color="var(--color-warning-dark)" style={{ marginBottom: 'var(--space-2)' }} />
                <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  No Available Verified Candidates Found
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  There are no unassigned verified workers in {booking.customerLocality} matching this category and time window.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                {candidates?.map((cand) => {
                  const isSelected = selectedCandidate?.workerId === cand.workerId;
                  return (
                    <div
                      key={cand.workerId}
                      onClick={() => {
                        setSelectedCandidate(cand);
                        setActionError(null);
                      }}
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: isSelected ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                        backgroundColor: isSelected ? 'var(--color-brand-50)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                              {cand.workerName}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                              {cand.workerId}
                            </div>
                          </div>
                          {cand.matchScore !== undefined && cand.matchScore !== null && (
                            <span
                              style={{
                                padding: '2px 6px',
                                backgroundColor: 'var(--color-status-success-bg)',
                                color: 'var(--color-status-success-text)',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              {cand.matchScore}% Match
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {cand.ratingAverage !== undefined && cand.ratingAverage !== null && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Star size={12} fill="#eab308" color="#eab308" />
                                <strong>{cand.ratingAverage}</strong>
                                {cand.totalReviews !== undefined && ` (${cand.totalReviews} reviews)`} •
                              </span>
                            )}
                            <span>{cand.experienceYears} Yrs Exp</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {cand.locality || booking.customerLocality}
                          </div>
                          <div>Languages: {cand.languages.length > 0 ? cand.languages.join(', ') : 'Not listed'}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          Daily Est: {formatCurrencyINR(cand.dailyRateEstimate || 350)}
                        </span>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: isSelected ? 'var(--color-brand-700)' : 'var(--color-text-tertiary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {isSelected && <CheckCircle size={14} color="var(--color-brand-600)" />}
                          {isSelected ? 'Selected' : 'Select'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule Configuration Form (Appears when candidate selected) */}
          {selectedCandidate && (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={16} color="var(--color-brand-600)" />
                Coordinate Interview / Trial with {selectedCandidate.workerName}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Schedule Format:
                  </label>
                  <select
                    aria-label="Schedule Format"
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value as 'TRIAL' | 'INTERVIEW')}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <option value="TRIAL">In-Person Household Trial</option>
                    <option value="INTERVIEW">Customer Interview</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Scheduled Date:
                  </label>
                  <input
                    type="date"
                    aria-label="Scheduled Date"
                    min={getTodayDate()}
                    value={scheduledDateInput}
                    onChange={(e) => setScheduledDateInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Start Time:
                  </label>
                  <input
                    type="time"
                    aria-label="Start Time"
                    value={scheduledTimeInput}
                    onChange={(e) => setScheduledTimeInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Duration (Hours) &amp; Fee (INR):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      aria-label="Trial Duration Hours"
                      min={1}
                      max={8}
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      style={{
                        width: '50%',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    />
                    <input
                      type="number"
                      aria-label="Trial Fee INR"
                      min={0}
                      value={trialFee}
                      onChange={(e) => setTrialFee(Number(e.target.value))}
                      style={{
                        width: '50%',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  Customer Residential Address for Trial:
                </label>
                <input
                  type="text"
                  placeholder="Enter full household address..."
                  value={trialAddress || `${booking.customerLocality} Residential Address`}
                  onChange={(e) => setTrialAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  Operational Notes for Worker &amp; Customer App Notifications:
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter coordination instructions..."
                  value={trialNotes}
                  onChange={(e) => setTrialNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {canDirectAssignOnly && (
              <button
                type="button"
                disabled={!selectedCandidate || isBusy}
                onClick={() => assignMatchMutation.mutate()}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-brand-600)',
                  backgroundColor: 'var(--color-surface)',
                  color: !selectedCandidate ? 'var(--color-text-tertiary)' : 'var(--color-brand-700)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  cursor: !selectedCandidate || isBusy ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={15} />
                <span>{assignMatchMutation.isPending ? 'Assigning...' : 'Assign Matched Worker'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={!selectedCandidate || isBusy}
              onClick={() => scheduleMutation.mutate()}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: !selectedCandidate ? 'var(--color-text-tertiary)' : 'var(--color-brand-600)',
                color: '#ffffff',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                cursor: !selectedCandidate || isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              {scheduleMutation.isPending
                ? 'Scheduling...'
                : scheduleType === 'INTERVIEW'
                ? 'Confirm Interview Schedule'
                : 'Confirm Trial Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
