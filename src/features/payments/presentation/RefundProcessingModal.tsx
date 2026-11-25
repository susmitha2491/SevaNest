import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ShieldCheck, RefreshCw, RotateCcw } from 'lucide-react';
import { PaymentTransaction, RefundDto } from '../domain/types';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';

interface RefundProcessingModalProps {
  transaction: PaymentTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRefund: (paymentId: string, dto: RefundDto) => Promise<void>;
  isProcessing?: boolean;
}

export const RefundProcessingModal: React.FC<RefundProcessingModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onConfirmRefund,
  isProcessing = false,
}) => {
  const [reason, setReason] = useState('');
  const [hasConfirmedApproval, setHasConfirmedApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prepopulate reason if transaction already has an audited justification
  useEffect(() => {
    if (transaction) {
      setReason(transaction.refund?.refundReason || '');
      setHasConfirmedApproval(false);
      setError(null);
    }
  }, [transaction, isOpen]);

  // Global reference-counted modal scroll lock
  useBodyScrollLock(isOpen && Boolean(transaction));

  if (!isOpen || !transaction) return null;

  const isPendingRetry =
    transaction.status === 'REFUND_PENDING' || transaction.refundStatus === 'REFUND_PENDING';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('An operational justification reason is mandatory to approve this refund.');
      return;
    }
    if (trimmedReason.length < 5) {
      setError('Reason must be at least 5 characters long explaining the refund justification.');
      return;
    }
    if (!hasConfirmedApproval) {
      setError('You must explicitly confirm the approval checkbox before submitting.');
      return;
    }

    try {
      await onConfirmRefund(transaction.id, {
        approval: 'APPROVE',
        reason: trimmedReason,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process refund request.');
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 'var(--space-4)',
        backdropFilter: 'blur(3px)',
        overscrollBehavior: 'contain',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '540px',
          width: '100%',
          maxHeight: 'min(90vh, calc(100vh - 32px))',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Header */}
        <div
          className="modal-header-container"
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: isPendingRetry ? '#fffbeb' : '#fff1f2',
          }}
        >
          <div className="modal-header-content" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isPendingRetry ? (
              <RotateCcw size={20} color="#b45309" style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={20} color="#e11d48" style={{ flexShrink: 0 }} />
            )}
            <h2
              id="refund-modal-title"
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 800,
                color: isPendingRetry ? '#92400e' : '#9f1239',
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              Approve & Initiate Full Refund
            </h2>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            type="button"
            aria-label="Close refund modal"
            title="Close refund modal"
            disabled={isProcessing}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="modal-scrollable-body"
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            overscrollBehavior: 'contain',
          }}
        >
          {/* Target Summary Card */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Payment Reference:</span>
              <strong style={{ fontFamily: 'monospace' }}>{transaction.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Linked Booking:</span>
              <strong>{transaction.bookingRef}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Customer Payer:</span>
              <strong>{transaction.customerName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Refund Amount:</span>
              <strong style={{ color: '#e11d48', fontSize: 'var(--font-size-sm)' }}>
                {formatCurrencyINR(transaction.amountINR)}
              </strong>
            </div>
          </div>

          {/* Previously Recorded Justification if present (Requirement 2 Part 3) */}
          {transaction.refund?.refundReason && (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: '#fefce8',
                border: '1px solid #fef08a',
                borderRadius: 'var(--radius-md)',
                fontSize: '11px',
                color: '#854d0e',
                lineHeight: 1.4,
              }}
            >
              <strong>Previously Recorded Justification:</strong> {transaction.refund.refundReason}
              {transaction.refund.refundedByUserId && (
                <div style={{ marginTop: '2px', color: '#a16207' }}>
                  Recorded by: {transaction.refund.refundedByUserId}
                </div>
              )}
            </div>
          )}

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            In accordance with platform & backend governance, issuing a full refund is an audited administrative action.
            The settlement instruction will be submitted to the payment gateway and recorded in the immutable audit trail.
          </p>

          {error && (
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              {error}
            </div>
          )}

          {/* Reason Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="refund-reason" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Operational Justification Reason <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Booking cancelled prior to trial start; candidate replacement mismatch approved by supervisor."
              disabled={isProcessing}
              maxLength={1000}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
              {reason.length}/1000 characters
            </span>
          </div>

          {/* Approval Checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
            <input
              type="checkbox"
              checked={hasConfirmedApproval}
              onChange={(e) => setHasConfirmedApproval(e.target.checked)}
              disabled={isProcessing}
              style={{ marginTop: '2px', cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
              I confirm that I have reviewed this booking and payment record, and I approve initiating this full refund (<code>APPROVE</code>).
            </span>
          </label>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !hasConfirmedApproval || !reason.trim()}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isProcessing || !hasConfirmedApproval || !reason.trim() ? '#fca5a5' : '#e11d48',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: isProcessing || !hasConfirmedApproval || !reason.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing Refund...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Confirm & Authorize Refund</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
