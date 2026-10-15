import React from 'react';
import {
  X,
  User,
  MapPin,
  Clock,
  CheckCircle,
  Calendar,
  IndianRupee,
  RefreshCw,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { BookingDetail } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

interface BookingDetailModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMatchWizard?: (booking: BookingDetail) => void;
  onOpenTrialOutcome?: (booking: BookingDetail) => void;
  onOpenReplacement?: (booking: BookingDetail) => void;
  onOpenCancel?: (booking: BookingDetail) => void;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  isOpen,
  onClose,
  onOpenMatchWizard,
  onOpenTrialOutcome,
  onOpenReplacement,
  onOpenCancel,
}) => {
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
      aria-labelledby="booking-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '750px',
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
                id="booking-modal-title"
                style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
              >
                Booking Details: {booking.id}
              </h2>
              <StatusBadge status={booking.status} />
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Service Category: <strong>{booking.serviceCategory}</strong> • Created: {booking.createdAt}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-tertiary)',
              padding: '4px',
            }}
            aria-label="Close booking modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Customer & Service Requirement Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <User size={14} /> Customer Profile
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking.customerName}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                {booking.customerId} • {booking.customerPhoneMasked}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <MapPin size={14} /> Locality & Area
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking.customerLocality}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Engagement: {booking.engagementType.replace(/_/g, ' ')}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                <Clock size={14} /> Shift & Budget
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking.timingShift}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Budget Cap: {formatCurrencyINR(booking.salaryBudgetMax)} / mo
              </div>
            </div>
          </div>

          {/* Special Requirements */}
          {booking.specialRequirements && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Special Requirements / Household Notes:
              </span>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {booking.specialRequirements}
              </p>
            </div>
          )}

          {/* Assigned Domestic Worker Profile Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              backgroundColor: booking.assignedWorkerName ? 'var(--color-surface)' : 'var(--color-warning-bg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Assigned Domestic Worker Allocation
              </span>
              {booking.assignedWorkerName && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-success-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <ShieldCheck size={14} /> Fully Verified Candidate
                </span>
              )}
            </div>

            {booking.assignedWorkerName ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-md)' }}>
                    {booking.assignedWorkerName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                    Worker ID: {booking.assignedWorkerId} • Phone: {booking.assignedWorkerPhoneMasked || '+91 98*** *****'}
                  </div>
                </div>
                {booking.serviceStartDate && (
                  <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    <div><strong>Contract:</strong> {booking.contractPeriod || 'Standard Placement'}</div>
                    <div style={{ color: 'var(--color-status-success-text)', fontWeight: 600 }}>● Active Service</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-warning-dark)' }}>
                    No Worker Assigned (Awaiting Candidate Matching)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Launch the matching wizard to filter available verified staff in {booking.customerLocality}.
                  </div>
                </div>
                {onOpenMatchWizard && (
                  <button
                    onClick={() => onOpenMatchWizard(booking)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#fff',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Match Candidates
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Trial Information Section */}
          {booking.trial && (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-status-info-bg)',
                border: '1px solid var(--color-status-info-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-status-info-text)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> Scheduled Trial Details
                </span>
                {onOpenTrialOutcome && booking.status === 'INTERVIEW_SCHEDULED' && (
                  <button
                    onClick={() => onOpenTrialOutcome(booking)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#fff',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Record Trial Outcome
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                <div><strong>Slot:</strong> {booking.trial.timeSlot}</div>
                <div><strong>Duration:</strong> {booking.trial.durationHours} Hours</div>
                <div><strong>Address:</strong> {booking.trial.customerAddress}</div>
                <div><strong>Trial Fee:</strong> {formatCurrencyINR(booking.trial.trialFeeAmount)}</div>
              </div>
              {booking.trial.notes && (
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  <strong>Notes:</strong> {booking.trial.notes}
                </div>
              )}
            </div>
          )}

          {/* Replacement Case Section */}
          {booking.replacement && (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-status-warning-text)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={14} /> Replacement Request Case
                </span>
                {onOpenReplacement && booking.status === 'REPLACEMENT_REQUESTED' && (
                  <button
                    onClick={() => onOpenReplacement(booking)}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'var(--color-warning-dark)',
                      color: '#fff',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Process Replacement
                  </button>
                )}
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Coverage Policy:</strong> {booking.replacement.coveragePlanName} ({booking.replacement.eligibleUnderPolicy ? 'Eligible' : 'Ineligible'})</div>
                <div><strong>Prior Worker:</strong> {booking.replacement.priorWorkerName} ({booking.replacement.priorWorkerId})</div>
                <div><strong>Stated Reason:</strong> {booking.replacement.reasonCategory}</div>
                <div><strong>Explanation:</strong> {booking.replacement.customerExplanation}</div>
              </div>
            </div>
          )}

          {/* Platform Fee & Financial Summary */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <IndianRupee size={14} color="var(--color-brand-600)" />
              <span>Platform Fee: <strong>{formatCurrencyINR(booking.platformFeeAmount)}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <CheckCircle size={14} color={booking.platformFeePaid ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)'} />
              <span>Status: <strong>{booking.platformFeePaid ? 'Settled' : 'Pending'}</strong></span>
            </div>
          </div>

          {/* Operational Notes Log */}
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Operational Activity & Notes Log ({booking.internalNotes.length})
            </span>
            <div
              style={{
                marginTop: 'var(--space-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {booking.internalNotes.map((note, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-primary)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-2)',
                  }}
                >
                  <FileText size={14} color="var(--color-text-tertiary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
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
          {onOpenCancel && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' ? (
            <button
              onClick={() => onOpenCancel(booking)}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-error-dark)',
                backgroundColor: 'var(--color-error-bg)',
                color: 'var(--color-error-dark)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel Booking
            </button>
          ) : <div />}

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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
