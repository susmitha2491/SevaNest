import React from 'react';
import {
  X,
  Receipt,
  User,
  RotateCcw,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { PaymentTransaction } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

interface TransactionDetailModalProps {
  transaction: PaymentTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onInitiateRefund?: (transaction: PaymentTransaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onInitiateRefund,
}) => {
  if (!isOpen || !transaction) return null;

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
      aria-labelledby="txn-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '680px',
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
                id="txn-modal-title"
                style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
              >
                Transaction: {transaction.id}
              </h2>
              <StatusBadge status={transaction.status} />
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Linked Booking: <strong style={{ fontFamily: 'monospace' }}>{transaction.bookingRef}</strong> • Category: {transaction.serviceCategory}
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
            aria-label="Close transaction details modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Main Amount & Fee Highlight Card */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                Gross Platform Collection
              </span>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-brand-700)' }}>
                {formatCurrencyINR(transaction.amountINR)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {transaction.feeDescription}
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <div><strong>Gateway Ref:</strong> <span style={{ fontFamily: 'monospace' }}>{transaction.gatewayRef}</span></div>
              <div><strong>Method:</strong> {transaction.paymentMethod}</div>
              <div><strong>Recorded:</strong> {transaction.timestamp}</div>
            </div>
          </div>

          {/* Customer & Payer Information */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <User size={14} /> Payer Profile
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {transaction.customerName}
              </div>
              <div style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)' }}>
                {transaction.customerId} • {transaction.customerPhoneMasked}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <CreditCard size={14} /> Payment Channel
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {transaction.paymentMethod}
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Classification: {transaction.feeType.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {/* Tax and Fee Calculation Breakdown Table */}
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Receipt size={14} /> Platform Fee & Tax Calculation Ledger (INR)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Platform Base Charge</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600 }}>{formatCurrencyINR(transaction.breakdown.baseAmount)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Applicable GST (18% Goods & Services Tax)</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600 }}>{formatCurrencyINR(transaction.breakdown.gstAmount)}</td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)' }}>Total Invoice / Collected Amount</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--color-brand-700)' }}>{formatCurrencyINR(transaction.amountINR)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Refund Settlement Record (if refunded) */}
          {transaction.refund && (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-status-warning-bg)',
                border: '1px solid var(--color-status-warning-border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--color-status-warning-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RotateCcw size={14} /> Refund Settlement Audit Log: {transaction.refund.refundId}
                </strong>
                <span style={{ fontWeight: 700, color: 'var(--color-status-warning-text)' }}>
                  {formatCurrencyINR(transaction.refund.refundAmountINR)} Refunded
                </span>
              </div>
              <div><strong>Reason Category:</strong> {transaction.refund.reasonCategory.replace(/_/g, ' ')}</div>
              <div><strong>Operational Remarks:</strong> {transaction.refund.remarks}</div>
              <div style={{ color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-1)', borderTop: '1px dashed var(--color-border)' }}>
                <span>Authorized by: <strong>{transaction.refund.processedBy}</strong> ({transaction.refund.processedAt})</span>
                <span style={{ fontFamily: 'monospace' }}>Mock Key: {transaction.refund.mockIdempotencyKey}</span>
              </div>
            </div>
          )}

          {/* Mock Mode Safety Notice */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border)',
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={14} color="var(--color-brand-600)" />
            <span>Mock Ledger Mode: Real payment gateway credentials and financial webhooks are simulated.</span>
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
          {onInitiateRefund && transaction.status === 'PAID' ? (
            <button
              onClick={() => onInitiateRefund(transaction)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-warning-dark)',
                backgroundColor: 'var(--color-warning-bg)',
                color: 'var(--color-warning-dark)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={14} /> Initiate Audited Refund
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
