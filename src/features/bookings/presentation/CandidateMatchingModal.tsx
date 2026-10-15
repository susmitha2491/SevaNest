import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ShieldCheck,
  Star,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { BookingDetail, CandidateMatch, TrialSchedule } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

interface CandidateMatchingModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onTrialScheduled?: () => void;
}

export const CandidateMatchingModal: React.FC<CandidateMatchingModalProps> = ({
  booking,
  isOpen,
  onClose,
  onTrialScheduled,
}) => {
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateMatch | null>(null);

  // Trial form state
  const [timeSlot, setTimeSlot] = useState('Morning (09:00 AM - 11:00 AM)');
  const [durationHours, setDurationHours] = useState(2);
  const [trialAddress, setTrialAddress] = useState('');
  const [trialNotes, setTrialNotes] = useState('');
  const [trialFee, setTrialFee] = useState(250);

  // Query candidate suggestions
  const { data: candidates, isLoading } = useQuery({
    queryKey: ['bookings', 'candidates', booking?.id],
    queryFn: () => (booking ? bookingRepository.getCandidateSuggestions(booking.id) : []),
    enabled: !!booking && isOpen,
  });

  // Schedule trial mutation
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate) return;
      const trial: TrialSchedule = {
        scheduledDate: 'Upcoming Slot',
        timeSlot,
        durationHours,
        customerAddress: trialAddress || `${booking.customerLocality} Residential Address`,
        contactPerson: booking.customerName,
        contactPhone: booking.customerPhoneMasked,
        trialFeeAmount: trialFee,
        notes: trialNotes,
      };
      await bookingRepository.scheduleTrial(booking.id, selectedCandidate.workerId, trial);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (onTrialScheduled) onTrialScheduled();
      onClose();
    },
  });

  if (!isOpen || !booking) return null;

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
              <strong>{booking.timingShift}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Max Budget: </span>
              <strong>{formatCurrencyINR(booking.salaryBudgetMax)}/mo</strong>
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
              <strong>Verified Workforce Guarantee:</strong> Only domestic workers with all 6 verification checks completed (1 OTP pre-check + 5 operations checks) are surfaced for customer trials.
            </span>
          </div>

          {/* Candidate Suggestions Grid */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
              Available Verified Candidate Matches ({candidates?.length || 0})
            </h3>

            {isLoading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Loading verified candidates...</div>
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
                  There are no unassigned fully-verified workers in {booking.customerLocality} matching this category.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                {candidates?.map((cand) => {
                  const isSelected = selectedCandidate?.workerId === cand.workerId;
                  return (
                    <div
                      key={cand.workerId}
                      onClick={() => setSelectedCandidate(cand)}
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
                        </div>

                        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={12} fill="#eab308" color="#eab308" />
                            <strong>{cand.ratingAverage}</strong> ({cand.totalReviews} reviews) • {cand.experienceYears} Yrs Exp
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {cand.locality}
                          </div>
                          <div>Languages: {cand.languages.join(', ')}</div>
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

          {/* Trial Configuration Form (Appears when candidate selected) */}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Time Slot:
                  </label>
                  <input
                    type="text"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
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
                    Trial Duration (Hours):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
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
                    Trial Fee (INR):
                  </label>
                  <input
                    type="number"
                    value={trialFee}
                    onChange={(e) => setTrialFee(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  Customer Residential Address for Trial:
                </label>
                <input
                  type="text"
                  placeholder="Enter full household address..."
                  defaultValue={trialAddress || `${booking.customerLocality} Residential Address`}
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
                  Operational Notes for Worker & Customer App Notifications:
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

          <button
            disabled={!selectedCandidate || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: !selectedCandidate ? 'var(--color-text-tertiary)' : 'var(--color-brand-600)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: !selectedCandidate ? 'not-allowed' : 'pointer',
            }}
          >
            {scheduleMutation.isPending ? 'Scheduling Trial...' : 'Confirm Trial Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
