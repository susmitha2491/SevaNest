import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RotateCcw, Key } from 'lucide-react';
import { PaymentTransaction, RefundReasonCategory, REFUND_REASONS } from '../domain/types';
import { paymentRepository } from '../data/paymentRepository';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { env } from '../../../core/config/env';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { RequiredIndicator } from '../../../components/common/RequiredIndicator';

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
  const { user } = useAuthStore();
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);

  const [reasonCategory, setReasonCategory] = useState<RefundReasonCategory>('UNSATISFACTORY_TRIAL');
  const [remarks, setRemarks] = useState('');
  const [confirmedPolicy, setConfirmedPolicy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const idempotencyKey = React.useMemo(
    () => (transaction ? `idem_${transaction.id}_${Date.now()}` : ''),
    [transaction]
  );

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!transaction || !canRefund) return;
      setErrorMessage(null);
      // Strictly full-refund per backend contract specification: POST /api/v1/admin/payments/{id}/refund
      await paymentRepository.processRefund(
        transaction.id,
        transaction.amountINR,
        reasonCategory,
        remarks.trim() || 'Full refund authorized by administrator.',
        idempotencyKey
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (onRefundCompleted) onRefundCompleted();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Gateway refund processing failed.';
      setErrorMessage(msg);
    },
  });

  if (!isOpen || !transaction) return null;

  const currentRefundAmount = transaction.amountINR;
  const isSubmitDisabled = !canRefund || !confirmedPolicy || !remarks.trim() || currentRefundAmount <= 0 || refundMutation.isPending;

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
          maxHeight: 'min(90vh, calc(100vh - 32px))',
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
            flexShrink: 0,
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
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
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

          {errorMessage && (
            <div
              data-testid="refund-error-alert"
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <strong>Gateway Refund Failed:</strong> {errorMessage}
            </div>
          )}

          {/* Full Refund Specification Card */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: '#eff6ff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#1e40af' }}>Full Payment Reimbursement (100%)</div>
              <div style={{ color: '#3b82f6' }}>Backend executes complete payment reversal via connected gateway</div>
            </div>
            <strong style={{ fontSize: 'var(--font-size-md)', color: '#1d4ed8' }}>
              {formatCurrencyINR(transaction.amountINR)}
            </strong>
          </div>

          {/* Reason Category Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '2px', textTransform: 'uppercase' }}>
              Refund Reason Category <RequiredIndicator />
            </label>
            <CustomSelect
              value={reasonCategory}
              onChange={(val) => setReasonCategory(val as RefundReasonCategory)}
              options={REFUND_REASONS.map((r) => ({ value: r.key, label: r.label }))}
              ariaLabel="Refund Reason Category"
              width="100%"
            />
          </div>

          {/* Operational Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '2px', textTransform: 'uppercase' }}>
              Operational Remarks & Settlement Rationale <RequiredIndicator />
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Enter comprehensive operational justification (max 1000 characters per backend contract)..."
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

        {!canRefund && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-danger-subtle)',
              borderTop: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            Permission Restricted: Your account does not have the required permission (<code>refunds.manage</code>) to authorize refunds.
          </div>
        )}

        {refundMutation.isError && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-status-danger-bg)',
              borderTop: '1px solid var(--color-status-danger-border)',
              color: 'var(--color-status-danger-text)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            Failed to authorize refund: {refundMutation.error instanceof Error ? refundMutation.error.message : 'Unknown backend processing error'}
          </div>
        )}

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
