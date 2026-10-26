import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RotateCcw, Key } from 'lucide-react';
import { PaymentTransaction, RefundReasonCategory, REFUND_REASONS } from '../domain/types';
import { paymentRepository } from '../data/paymentRepository';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { env } from '../../../core/config/env';

interface RefundProcessingModalProps {
  transaction: PaymentTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onRefundCompleted?: () => void;
}

export const RefundProcessingModal: React.FC<RefundProcessingModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onRefundCompleted,
}) => {
  const queryClient = useQueryClient();

  const [refundScope, setRefundScope] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState<number>(transaction?.amountINR || 0);
  const [reasonCategory, setReasonCategory] = useState<RefundReasonCategory>('UNSATISFACTORY_TRIAL');
  const [remarks, setRemarks] = useState('');
  const [confirmedPolicy, setConfirmedPolicy] = useState(false);

  const idempotencyKey = React.useMemo(
    () => (transaction ? `idem_${transaction.id}_${Date.now()}` : ''),
    [transaction]
  );

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) return;
      const finalAmount = refundScope === 'FULL' ? transaction.amountINR : partialAmount;
      await paymentRepository.processRefund(
        transaction.id,
        finalAmount,
        reasonCategory,
        remarks || 'Refund processed under commercial policy guidelines.',
        idempotencyKey
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (onRefundCompleted) onRefundCompleted();
      onClose();
    },
  });

  if (!isOpen || !transaction) return null;

  const currentRefundAmount = refundScope === 'FULL' ? transaction.amountINR : partialAmount;
  const isSubmitDisabled = !confirmedPolicy || !remarks.trim() || currentRefundAmount <= 0 || refundMutation.isPending;

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
      aria-labelledby="refund-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '580px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <RotateCcw size={18} color="var(--color-warning-dark)" />
            <div>
              <h2
                id="refund-modal-title"
                style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)' }}
              >
                Audited Refund Authorization Workstation
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Transaction: <strong style={{ fontFamily: 'monospace' }}>{transaction.id}</strong> • Booking: {transaction.bookingRef}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-tertiary)',
            }}
            aria-label="Close refund modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Transaction Summary Card */}
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
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Customer: <strong>{transaction.customerName}</strong></div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Fee Type: {transaction.feeType.replace(/_/g, ' ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--color-text-secondary)' }}>Original Paid:</div>
              <strong style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-brand-700)' }}>
                {formatCurrencyINR(transaction.amountINR)}
              </strong>
            </div>
          </div>

          {/* Refund Scope */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
              Refund Scope:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: refundScope === 'FULL' ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                  backgroundColor: refundScope === 'FULL' ? 'var(--color-brand-50)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <input
                  type="radio"
                  name="refundScope"
                  checked={refundScope === 'FULL'}
                  onChange={() => setRefundScope('FULL')}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>Full Reimbursement</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>{formatCurrencyINR(transaction.amountINR)}</div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: refundScope === 'PARTIAL' ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                  backgroundColor: refundScope === 'PARTIAL' ? 'var(--color-brand-50)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <input
                  type="radio"
                  name="refundScope"
                  checked={refundScope === 'PARTIAL'}
                  onChange={() => setRefundScope('PARTIAL')}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>Partial Reimbursement</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Custom Amount (INR)</div>
                </div>
              </label>
            </div>
          </div>

          {refundScope === 'PARTIAL' && (
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                Enter Partial Refund Amount (INR):
              </label>
              <input
                type="number"
                min={1}
                max={transaction.amountINR}
                value={partialAmount}
                onChange={(e) => setPartialAmount(Math.min(Number(e.target.value), transaction.amountINR))}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>
          )}

          {/* Reason Category Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '2px', textTransform: 'uppercase' }}>
              Refund Reason Category (Mandatory):
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value as RefundReasonCategory)}
              style={{
                width: '100%',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              {REFUND_REASONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Operational Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '2px', textTransform: 'uppercase' }}>
              Operational Remarks & Settlement Rationale (Mandatory):
            </label>
            <textarea
              rows={3}
              placeholder="Enter comprehensive operational justification for platform audit logs and finance records..."
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

          {/* Idempotency Key Info */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
              <Key size={14} /> <span>{env.VITE_USE_MOCK_AUTH ? 'Simulated Idempotency Key:' : 'Idempotency Reference Key:'}</span>
            </div>
            <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)' }}>
              {idempotencyKey}
            </span>
          </div>

          {/* Policy Confirmation Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={confirmedPolicy}
              onChange={(e) => setConfirmedPolicy(e.target.checked)}
            />
            <span>
              I confirm that this refund complies with SevaNest Commercial Cancellation Policies and is recorded in platform ledgers.
            </span>
          </label>
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
            disabled={isSubmitDisabled}
            onClick={() => refundMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: isSubmitDisabled ? 'var(--color-text-tertiary)' : 'var(--color-warning-dark)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {refundMutation.isPending ? 'Processing Settlement...' : `Authorize Refund (${formatCurrencyINR(currentRefundAmount)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
