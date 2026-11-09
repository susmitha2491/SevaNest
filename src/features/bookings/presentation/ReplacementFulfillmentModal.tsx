import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  RefreshCw,
  ShieldCheck,
  Star,
  MapPin,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  XCircle,
  Calendar,
} from 'lucide-react';
import {
  BookingDetail,
  CandidateMatch,
  REPLACEMENT_REASONS,
  ReplacementReasonCode,
} from '../domain/types';
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
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSchedulingTrial, setIsSchedulingTrial] = useState(false);
  const [trialSlot, setTrialSlot] = useState('Morning (09:00 AM - 11:00 AM)');
  const [trialDate, setTrialDate] = useState('Upcoming Slot');
  const [trialDuration, setTrialDuration] = useState(2);
  const [trialNotes, setTrialNotes] = useState('');

  const [decisionMessage, setDecisionMessage] = useState('');

  const effectiveReplacement = booking?.replacement || (booking?.status === 'REPLACEMENT_REQUESTED' ? {
    id: booking?.id || '',
    bookingId: booking?.id || '',
    status: 'REQUESTED' as const,
    reasonCode: 'OTHER' as ReplacementReasonCode,
    reason: 'Customer requested replacement',
    notes: null,
    requestedAt: booking?.createdAt || '',
    priorWorkerId: booking?.assignedWorkerId || '',
    priorWorkerName: booking?.assignedWorkerName || 'Prior Worker',
    currentWorkerId: booking?.assignedWorkerId || '',
  } : undefined);

  const [currentStatus, setCurrentStatus] = useState<string>(() => effectiveReplacement?.status || 'REQUESTED');

  React.useEffect(() => {
    if (effectiveReplacement?.status) {
      setCurrentStatus(effectiveReplacement.status);
    }
  }, [effectiveReplacement?.status]);

  const replacementId = effectiveReplacement?.id || booking?.id || '';

  // Query candidate matches when request is approved or review active
  const { data: candidates, isLoading: isCandidatesLoading } = useQuery({
    queryKey: ['bookings', 'replacement-candidates', replacementId],
    queryFn: async () => {
      if (!replacementId) return [];
      if (bookingRepository.getReplacementCandidates) {
        return bookingRepository.getReplacementCandidates(replacementId);
      }
      return bookingRepository.getCandidateSuggestions(booking?.id || '');
    },
    enabled: !!booking && isOpen && (currentStatus === 'APPROVED' || currentStatus === 'REQUESTED'),
  });

  // Approve eligibility mutation (REQUESTED -> APPROVED)
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!booking) return;
      if (bookingRepository.approveReplacement) {
        const approvalRemarks = remarks.trim() || 'Replacement eligibility verified and approved by Operations Admin';
        if (decisionMessage.trim()) {
          await bookingRepository.approveReplacement(
            replacementId,
            approvalRemarks,
            decisionMessage.trim()
          );
        } else {
          await bookingRepository.approveReplacement(
            replacementId,
            approvalRemarks
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCurrentStatus('APPROVED');
      if (booking && booking.replacement) {
        booking.replacement.status = 'APPROVED';
      }
    },
  });

  // Reject replacement mutation (REQUESTED -> REJECTED, reverts booking to ACTIVE)
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !rejectRemarks.trim()) return;
      if (bookingRepository.rejectReplacement) {
        if (decisionMessage.trim()) {
          await bookingRepository.rejectReplacement(
            replacementId,
            rejectRemarks.trim(),
            decisionMessage.trim()
          );
        } else {
          await bookingRepository.rejectReplacement(
            replacementId,
            rejectRemarks.trim()
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCurrentStatus('REJECTED');
      if (booking && booking.replacement) {
        booking.replacement.status = 'REJECTED';
      }
      if (onReplacementProcessed) onReplacementProcessed();
      onClose();
    },
  });

  // Schedule Replacement Trial mutation
  const scheduleTrialMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate) return;
      await bookingRepository.scheduleTrial(booking.id, selectedCandidate.workerId, {
        scheduledDate: trialDate,
        timeSlot: trialSlot,
        durationHours: trialDuration,
        customerAddress: `${booking.customerLocality} Residential Address`,
        contactPerson: booking.customerName,
        contactPhone: booking.customerPhoneMasked,
        trialFeeAmount: 0,
        notes: trialNotes || 'Replacement candidate trial coordinated with customer',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (onReplacementProcessed) onReplacementProcessed();
      onClose();
    },
  });

  // Assign candidate worker mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!booking || !selectedCandidate) return;
      if (bookingRepository.selectReplacementWorker) {
        await bookingRepository.selectReplacementWorker(
          replacementId,
          selectedCandidate.workerId
        );
      } else {
        await bookingRepository.processReplacement(
          booking.id,
          selectedCandidate.workerId,
          remarks || 'Replacement fulfilled under active coverage guarantee plan.'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCurrentStatus('COMPLETED');
      if (booking && booking.replacement) {
        booking.replacement.status = 'COMPLETED';
        booking.replacement.replacementWorkerId = selectedCandidate?.workerId;
        booking.replacement.replacementWorkerName = selectedCandidate?.workerName;
      }
      if (onReplacementProcessed) onReplacementProcessed();
      onClose();
    },
  });

  if (!isOpen || !booking || !effectiveReplacement) return null;

  const isApprovedStage = currentStatus === 'APPROVED';
  const isFulfilled = currentStatus === 'COMPLETED';
  const isRejected = currentStatus === 'REJECTED';

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
                  backgroundColor:
                    isApprovedStage
                      ? 'var(--color-status-info-bg)'
                      : isFulfilled
                      ? 'var(--color-status-success-bg)'
                      : isRejected
                      ? 'var(--color-status-danger-bg)'
                      : 'var(--color-status-warning-bg)',
                  border: `1px solid ${
                    isApprovedStage
                      ? 'var(--color-status-info-border)'
                      : isFulfilled
                      ? 'var(--color-status-success-border)'
                      : isRejected
                      ? 'var(--color-status-danger-border)'
                      : 'var(--color-status-warning-border)'
                  }`,
                  color:
                    isApprovedStage
                      ? 'var(--color-status-info-text)'
                      : isFulfilled
                      ? 'var(--color-status-success-text)'
                      : isRejected
                      ? 'var(--color-status-danger-text)'
                      : 'var(--color-status-warning-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                }}
              >
                {isApprovedStage
                  ? 'Eligibility Approved • Rematch Pending'
                  : isFulfilled
                  ? 'Replacement Fulfilled'
                  : isRejected
                  ? 'Request Rejected'
                  : 'Replacement Review'}
              </span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Booking: <strong>{booking.id}</strong> • Customer: <strong>{booking.customerName}</strong> ({booking.customerLocality} • {booking.customerPhoneMasked})
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
              {effectiveReplacement.coveragePlanName ? (
                <span style={{ color: 'var(--color-status-success-text)', fontWeight: 700 }}>
                  ✓ {effectiveReplacement.coveragePlanName}
                </span>
              ) : effectiveReplacement.id ? (
                <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontWeight: 600 }}>
                  Case Ref: {effectiveReplacement.id}
                </span>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)', marginTop: '4px' }}>
              <div>
                <strong>Prior Domestic Worker:</strong> {effectiveReplacement.priorWorkerName || effectiveReplacement.priorWorkerId || 'Unassigned'} {effectiveReplacement.priorWorkerId ? `(${effectiveReplacement.priorWorkerId})` : ''}
              </div>
              <div>
                <strong>Request Date:</strong> {effectiveReplacement.requestedAt || 'Recent'}
              </div>
              <div>
                <strong>Reason Category:</strong> {(effectiveReplacement.reasonCode && REPLACEMENT_REASONS[effectiveReplacement.reasonCode]) || effectiveReplacement.reasonCode || effectiveReplacement.reasonCategory || 'Dispute'}
              </div>
              <div>
                <strong>Customer Contact:</strong> {booking.customerPhoneMasked}
              </div>
              {effectiveReplacement.neededFrom && (
                <div>
                  <strong>Needed From:</strong> {effectiveReplacement.neededFrom}
                </div>
              )}
            </div>
            {(effectiveReplacement.reason || effectiveReplacement.customerExplanation) && (
              <div style={{ marginTop: '2px' }}>
                <strong>Customer Stated Reason:</strong> {effectiveReplacement.reason || effectiveReplacement.customerExplanation}
              </div>
            )}
            {effectiveReplacement.notes && (
              <div style={{ marginTop: '2px', padding: '6px 10px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a' }}>
                <strong>Customer Notes:</strong> {effectiveReplacement.notes}
              </div>
            )}
          </div>

          {/* STAGE 1: Pending Review (Accept / Reject) */}
          {!isApprovedStage && !isFulfilled && !isRejected && (
            <div
              style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={18} color="#d97706" />
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  Step 1: Review & Decide Replacement Eligibility
                </h3>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Operations Admin must review eligibility according to placement terms. Approving the request enables verified worker selection. Rejecting closes the replacement request.
              </p>

              {!isRejecting ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Internal Staff Remarks (Optional, max 1000 chars):
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      placeholder="e.g. Verified policy eligibility and customer engagement timeline"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Customer-Facing Decision Message (Optional, max 1000 chars):
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      placeholder="Message visible to the customer explaining the approval outcome"
                      value={decisionMessage}
                      onChange={(e) => setDecisionMessage(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
                    <button
                      onClick={() => setIsRejecting(true)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-error-dark)',
                        backgroundColor: 'var(--color-error-bg)',
                        color: 'var(--color-error-dark)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <XCircle size={14} /> Reject Request
                    </button>

                    <button
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate()}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        cursor: approveMutation.isPending ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <UserCheck size={14} />
                      {approveMutation.isPending ? 'Approving...' : 'Accept & Proceed to Rematch'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-error-dark)',
                    backgroundColor: '#fef2f2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <strong style={{ color: 'var(--color-error-dark)', fontSize: 'var(--font-size-xs)' }}>
                    Reject Replacement Request (Mandatory Remarks Required by Backend, max 1000 chars):
                  </strong>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    placeholder="Provide specific justification for rejection under replacement policy..."
                    value={rejectRemarks}
                    onChange={(e) => setRejectRemarks(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Customer-Facing Rejection Explanation (Optional, max 1000 chars):
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      placeholder="Explanation visible to the customer regarding the rejection"
                      value={decisionMessage}
                      onChange={(e) => setDecisionMessage(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setIsRejecting(false)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: '#fff',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!rejectRemarks.trim() || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate()}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: !rejectRemarks.trim() ? '#94a3b8' : 'var(--color-error-dark)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: !rejectRemarks.trim() || rejectMutation.isPending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: Candidate Matching & Worker Selection (When Approved) */}
          {isApprovedStage && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Step 2: Select & Assign Verified Replacement Worker:
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--color-status-success-text)', fontWeight: 600 }}>
                  ● Only fully verified & eligible workers displayed
                </span>
              </div>

              {isCandidatesLoading ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                  Loading eligible replacement workers from backend...
                </div>
              ) : !candidates || candidates.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                  No eligible replacement candidates currently available for this category and locality.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                  {candidates.map((cand) => {
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
                          transition: 'all 0.15s ease',
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
                          <span title="Fully Verified Candidate">
                            <ShieldCheck size={16} color="var(--color-status-success-text)" />
                          </span>
                        </div>

                        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {cand.ratingAverage !== undefined && cand.ratingAverage !== null && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#b45309' }}>
                                <Star size={12} fill="#eab308" color="#eab308" />
                                <strong>{cand.ratingAverage.toFixed(1)}</strong> •
                              </span>
                            )}
                            <span>
                              {cand.experienceMonths !== undefined && cand.experienceMonths !== null
                                ? `${Math.floor(cand.experienceMonths / 12)} Yrs${cand.experienceMonths % 12 ? ' ' + (cand.experienceMonths % 12) + ' Mos' : ''} Exp`
                                : `${cand.experienceYears} Yrs Exp`}
                            </span>
                          </div>
                          {cand.locality && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} /> {cand.locality}
                            </div>
                          )}
                          {cand.engagementPreference && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              Preference: {cand.engagementPreference.replace(/_/g, ' ')}
                            </div>
                          )}
                          {cand.languages && cand.languages.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                              Languages: {cand.languages.join(', ')}
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: isSelected ? 'var(--color-brand-700)' : 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {isSelected && <CheckCircle size={14} color="var(--color-brand-600)" />}
                            {isSelected ? 'Selected for Assignment' : 'Select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Optional Replacement Trial Coordination */}
              {isSchedulingTrial && selectedCandidate && (
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: '#eff6ff', borderRadius: 'var(--radius-lg)', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Calendar size={16} color="var(--color-brand-600)" />
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-700)' }}>
                      Schedule Replacement Trial for {selectedCandidate.workerName}
                    </strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                        Trial Date / Timing:
                      </label>
                      <input
                        type="text"
                        value={trialDate}
                        onChange={(e) => setTrialDate(e.target.value)}
                        placeholder="e.g. 2026-10-15 or Tomorrow Morning"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                        Time Slot:
                      </label>
                      <select
                        value={trialSlot}
                        onChange={(e) => setTrialSlot(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', backgroundColor: '#fff' }}
                      >
                        <option value="Morning (09:00 AM - 11:00 AM)">Morning (09:00 AM - 11:00 AM)</option>
                        <option value="Afternoon (01:00 PM - 03:00 PM)">Afternoon (01:00 PM - 03:00 PM)</option>
                        <option value="Evening (05:00 PM - 07:00 PM)">Evening (05:00 PM - 07:00 PM)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                        Duration (Hours):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={trialDuration}
                        onChange={(e) => setTrialDuration(Number(e.target.value))}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                      Operational Trial Notes:
                    </label>
                    <input
                      type="text"
                      value={trialNotes}
                      onChange={(e) => setTrialNotes(e.target.value)}
                      placeholder="Special instructions or trial agenda for replacement candidate..."
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}
                    />
                  </div>
                </div>
              )}

              {/* Assignment Confirmation Checkbox */}
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmedPolicy}
                    onChange={(e) => setConfirmedPolicy(e.target.checked)}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    I confirm that this replacement complies with SevaNest Replacement Policy, archives the prior worker engagement history, and transfers active service allocations.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Completed / Fulfilled View */}
          {isFulfilled && (
            <div style={{ padding: 'var(--space-4)', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#15803d', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                <CheckCircle size={18} /> Replacement Fulfilled & Synchronized
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: '#166534', marginTop: '4px', marginBottom: 0 }}>
                A replacement worker has been assigned to this booking. Service has resumed and the prior worker record has been archived in the replacement chain.
              </p>
            </div>
          )}

          {/* Rejected View */}
          {isRejected && (
            <div style={{ padding: 'var(--space-4)', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#b91c1c', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                <XCircle size={18} /> Replacement Request Rejected
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: '#991b1b', marginTop: '4px', marginBottom: 0 }}>
                This request was rejected under replacement policy terms. The customer engagement has returned to Active service with the existing assigned domestic worker.
              </p>
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
            Close
          </button>

          {isApprovedStage && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {selectedCandidate && (
                <button
                  type="button"
                  onClick={() => setIsSchedulingTrial(!isSchedulingTrial)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-brand-600)',
                    backgroundColor: isSchedulingTrial ? 'var(--color-brand-50)' : 'var(--color-surface)',
                    color: 'var(--color-brand-700)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Calendar size={13} />
                  {isSchedulingTrial ? 'Switch to Direct Assign' : 'Schedule Trial First'}
                </button>
              )}

              {isSchedulingTrial ? (
                <button
                  disabled={!selectedCandidate || !confirmedPolicy || scheduleTrialMutation.isPending}
                  onClick={() => scheduleTrialMutation.mutate()}
                  style={{
                    padding: 'var(--space-2) var(--space-5)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: !selectedCandidate || !confirmedPolicy ? 'var(--color-text-tertiary)' : 'var(--color-brand-600)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    cursor: !selectedCandidate || !confirmedPolicy || scheduleTrialMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {scheduleTrialMutation.isPending ? 'Scheduling...' : 'Confirm & Schedule Trial'}
                </button>
              ) : (
                <button
                  disabled={!selectedCandidate || !confirmedPolicy || assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                  style={{
                    padding: 'var(--space-2) var(--space-5)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: !selectedCandidate || !confirmedPolicy ? 'var(--color-text-tertiary)' : 'var(--color-warning-dark)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    cursor: !selectedCandidate || !confirmedPolicy || assignMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Confirm Replacement Match'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
