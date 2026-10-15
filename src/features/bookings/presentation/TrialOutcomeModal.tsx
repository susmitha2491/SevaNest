import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { BookingDetail, TrialOutcome } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';

interface TrialOutcomeModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onOutcomeRecorded?: () => void;
}

export const TrialOutcomeModal: React.FC<TrialOutcomeModalProps> = ({
  booking,
  isOpen,
  onClose,
  onOutcomeRecorded,
}) => {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<'SUCCEEDED' | 'REJECTED' | 'NO_SHOW'>('SUCCEEDED');
  const [feedbackRemarks, setFeedbackRemarks] = useState('');
  const [customerConfirmed, setCustomerConfirmed] = useState(true);

  const outcomeMutation = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      const trialOutcome: TrialOutcome = {
        outcome,
        feedbackRemarks: feedbackRemarks || (outcome === 'SUCCEEDED' ? 'Trial completed successfully. Customer confirmed.' : 'Customer declined candidate post-trial.'),
        customerConfirmed: outcome === 'SUCCEEDED' ? customerConfirmed : false,
      };
      await bookingRepository.recordTrialOutcome(booking.id, trialOutcome);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (onOutcomeRecorded) onOutcomeRecorded();
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
      aria-labelledby="trial-outcome-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '550px',
          width: '100%',
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
              id="trial-outcome-modal-title"
              style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
            >
              Record Trial Outcome
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Booking <strong>{booking.id}</strong> • Candidate: <strong>{booking.assignedWorkerName}</strong>
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
            aria-label="Close trial outcome modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
              Trial Result:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: outcome === 'SUCCEEDED' ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                  backgroundColor: outcome === 'SUCCEEDED' ? 'var(--color-brand-50)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="trialOutcome"
                  checked={outcome === 'SUCCEEDED'}
                  onChange={() => {
                    setOutcome('SUCCEEDED');
                    setCustomerConfirmed(true);
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={16} color="var(--color-status-success-text)" /> Trial Succeeded (Candidate Confirmed)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Customer agreed to engage worker. Status transitions to 'Worker confirmed'.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: outcome === 'REJECTED' ? '2px solid var(--color-error-dark)' : '1px solid var(--color-border)',
                  backgroundColor: outcome === 'REJECTED' ? 'var(--color-error-bg)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="trialOutcome"
                  checked={outcome === 'REJECTED'}
                  onChange={() => {
                    setOutcome('REJECTED');
                    setCustomerConfirmed(false);
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-error-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <XCircle size={16} /> Trial Rejected (Candidate Unsuitable)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Customer declined candidate. Re-opens booking for rematching.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: outcome === 'NO_SHOW' ? '2px solid var(--color-warning-dark)' : '1px solid var(--color-border)',
                  backgroundColor: outcome === 'NO_SHOW' ? 'var(--color-warning-bg)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="trialOutcome"
                  checked={outcome === 'NO_SHOW'}
                  onChange={() => {
                    setOutcome('NO_SHOW');
                    setCustomerConfirmed(false);
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={16} /> Worker or Customer No-Show
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    One of the parties did not attend trial session.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
              Feedback Remarks & Operational Summary:
            </label>
            <textarea
              rows={3}
              placeholder="Enter customer and worker feedback notes regarding trial performance..."
              value={feedbackRemarks}
              onChange={(e) => setFeedbackRemarks(e.target.value)}
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
            disabled={outcomeMutation.isPending}
            onClick={() => outcomeMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'var(--color-brand-600)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {outcomeMutation.isPending ? 'Saving Outcome...' : 'Save Trial Outcome'}
          </button>
        </div>
      </div>
    </div>
  );
};
