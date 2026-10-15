import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  RefreshCw,
  ShieldCheck,
  Star,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import { BookingDetail, CandidateMatch } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';

interface ReplacementFulfillmentModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onReplacementProcessed?: () => void;
}

export const ReplacementFulfillmentModal: React.FC<ReplacementFulfillmentModalProps> = ({
  booking,
  isOpen,
  onClose,
  onReplacementProcessed,
}) => {
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateMatch | null>(null);
  const [remarks, setRemarks] = useState('');
  const [confirmedPolicy, setConfirmedPolicy] = useState(false);

  // Query candidate matches
  const { data: candidates, isLoading } = useQuery({
    queryKey: ['bookings', 'replacement-candidates', booking?.id],
    queryFn: () => (booking ? bookingRepository.getCandidateSuggestions(booking.id) : []),
    enabled: !!booking && isOpen,
  });

  const replacementMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate) return;
      await bookingRepository.processReplacement(
        booking.id,
        selectedCandidate.workerId,
        remarks || 'Replacement fulfilled under active coverage guarantee plan.'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (onReplacementProcessed) onReplacementProcessed();
      onClose();
    },
  });

  if (!isOpen || !booking || !booking.replacement) return null;

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
      aria-labelledby="replacement-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '800px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h2
                id="replacement-modal-title"
                style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
              >
                Replacement Request Workstation
              </h2>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-warning-bg)',
                  border: '1px solid var(--color-status-warning-border)',
                  color: 'var(--color-status-warning-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                }}
              >
                Replacement Review
              </span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Booking: <strong>{booking.id}</strong> • Customer: {booking.customerName} ({booking.customerLocality})
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
            aria-label="Close replacement modal"
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
            gap: 'var(--space-4)',
          }}
        >
          {/* Replacement Case Info Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: '#fffbeb',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-warning-dark)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--color-warning-dark)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={14} /> Replacement Dispute & Coverage Breakdown
              </strong>
              <span style={{ color: 'var(--color-status-success-text)', fontWeight: 700 }}>
                ✓ {booking.replacement.coveragePlanName}
              </span>
            </div>
            <div>
              <strong>Prior Domestic Worker:</strong> {booking.replacement.priorWorkerName} ({booking.replacement.priorWorkerId})
            </div>
            <div>
              <strong>Reason Category:</strong> {booking.replacement.reasonCategory}
            </div>
            <div>
              <strong>Customer Explanation:</strong> {booking.replacement.customerExplanation}
            </div>
          </div>

          {/* Alternative Candidates Pool */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
              Select Alternative Verified Candidate for Rematch:
            </h3>

            {isLoading ? (
              <div>Searching available verified replacement candidates...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                {candidates?.map((cand) => {
                  const isSelected = selectedCandidate?.workerId === cand.workerId;
                  return (
                    <div
                      key={cand.workerId}
                      onClick={() => setSelectedCandidate(cand)}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                        border: isSelected ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                        backgroundColor: isSelected ? 'var(--color-brand-50)' : 'var(--color-surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            {cand.workerName}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                            {cand.workerId}
                          </div>
                        </div>
                        <ShieldCheck size={16} color="var(--color-status-success-text)" />
                      </div>

                      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Star size={12} fill="#eab308" color="#eab308" />
                          <strong>{cand.ratingAverage}</strong> ({cand.experienceYears} Yrs Exp)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> {cand.locality}
                        </div>
                      </div>

                      <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: isSelected ? 'var(--color-brand-700)' : 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {isSelected && <CheckCircle size={14} color="var(--color-brand-600)" />}
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Operational Remarks & Policy Confirmation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                Operational Remarks & Settlement Notes:
              </label>
              <textarea
                rows={2}
                placeholder="Enter mandatory remarks for audit log and customer notification..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
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

            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmedPolicy}
                onChange={(e) => setConfirmedPolicy(e.target.checked)}
              />
              <span>
                I confirm that this replacement complies with SevaNest Replacement Policy, archives the prior worker engagement history, and transfers active service allocations.
              </span>
            </label>
          </div>
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
            disabled={!selectedCandidate || !confirmedPolicy || replacementMutation.isPending}
            onClick={() => replacementMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: !selectedCandidate || !confirmedPolicy ? 'var(--color-text-tertiary)' : 'var(--color-warning-dark)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: !selectedCandidate || !confirmedPolicy ? 'not-allowed' : 'pointer',
            }}
          >
            {replacementMutation.isPending ? 'Fulfilling...' : 'Confirm Replacement Match'}
          </button>
        </div>
      </div>
    </div>
  );
};
