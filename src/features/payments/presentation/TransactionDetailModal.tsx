import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Receipt,
  User,
  RotateCcw,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { PaymentTransaction } from '../domain/types';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { getCustomerPhone, fetchCustomerUnmaskedPhone } from '../../../core/utils/phoneDirectory';
import { paymentRepository } from '../data/paymentRepository';
import { env } from '../../../core/config/env';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';

interface TransactionDetailModalProps {
  transaction: PaymentTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onInitiateRefund?: (transaction: PaymentTransaction) => void;
  onReconcile?: (transaction: PaymentTransaction) => Promise<void>;
  isReconciling?: boolean;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onInitiateRefund,
  onReconcile,
  isReconciling = false,
}) => {
  const { user } = useAuthStore();
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);
  const canManagePayment = hasPermission(user?.permissions, PERMISSIONS.PAYMENT_MANAGE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const [resolvedContact, setResolvedContact] = useState<string | undefined>(() => {
    if (!transaction) return undefined;
    const phone = transaction.customerPhone;
    if (phone && !phone.includes('*')) return phone;
    const masked = transaction.customerPhoneMasked;
    if (masked && !masked.includes('*')) return masked;
    const fromDirectory = getCustomerPhone(transaction.customerId);
    if (fromDirectory && !fromDirectory.includes('*')) return fromDirectory;
    return undefined;
  });

  useEffect(() => {
    if (!isOpen || !transaction) {
      setResolvedContact(undefined);
      return;
    }

    const currentPhone = transaction.customerPhone;
    if (currentPhone && !currentPhone.includes('*')) {
      setResolvedContact(currentPhone);
      return;
    }
    const masked = transaction.customerPhoneMasked;
    if (masked && !masked.includes('*')) {
      setResolvedContact(masked);
      return;
    }

    let isSubscribed = true;
    (async () => {
      // 1. Check directory cache for this customer
      const fromDir = getCustomerPhone(transaction.customerId);
      if (fromDir && !fromDir.includes('*')) {
        if (isSubscribed) setResolvedContact(fromDir);
        return;
      }

      // 2. Query unmasked phone directly using customer ID in live mode
      if (!env.VITE_USE_MOCK_AUTH && transaction.customerId && !transaction.customerId.startsWith('Customer')) {
        const full = await fetchCustomerUnmaskedPhone(transaction.customerId);
        if (isSubscribed && full && !full.includes('*')) {
          setResolvedContact(full);
          return;
        }
      }

      // 3. Refresh via getTransactionById in live mode
      if (!env.VITE_USE_MOCK_AUTH) {
        try {
          const refreshed = await paymentRepository.getTransactionById(transaction.id);
          const refPhone = refreshed?.customerPhone || (refreshed?.customerPhoneMasked && !refreshed.customerPhoneMasked.includes('*') ? refreshed.customerPhoneMasked : undefined);
          if (isSubscribed && refPhone && !refPhone.includes('*')) {
            setResolvedContact(refPhone);
          }
        } catch {
          // Fallback
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const displayContact =
    (resolvedContact && !resolvedContact.includes('*') ? resolvedContact : undefined) ||
    (transaction.customerPhone && !transaction.customerPhone.includes('*') ? transaction.customerPhone : undefined) ||
    (transaction.customerPhoneMasked && !transaction.customerPhoneMasked.includes('*') ? transaction.customerPhoneMasked : undefined) ||
    resolvedContact ||
    transaction.customerPhoneMasked ||
    'Contact Details Unavailable';

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
              Linked Booking:{' '}
              {canViewBookings && transaction.bookingId ? (
                <Link
                  to={`/bookings?search=${encodeURIComponent(transaction.bookingRef)}`}
                  style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-brand-600)', textDecoration: 'none' }}
                  onClick={onClose}
                >
                  {transaction.bookingRef}
                </Link>
              ) : (
                <strong style={{ fontFamily: 'monospace' }}>{transaction.bookingRef}</strong>
              )}{' '}
              • Category: {transaction.serviceCategory}
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
              <div><strong>Gateway Ref:</strong> <span style={{ fontFamily: 'monospace' }}>{transaction.gatewayRef || 'N/A'}</span></div>
              {transaction.providerPaymentId && (
                <div><strong>Provider Payment ID:</strong> <span style={{ fontFamily: 'monospace' }}>{transaction.providerPaymentId}</span></div>
              )}
              {transaction.providerOrderId && (
                <div><strong>Provider Order ID:</strong> <span style={{ fontFamily: 'monospace' }}>{transaction.providerOrderId}</span></div>
              )}
              <div><strong>Method:</strong> {transaction.paymentMethod}</div>
              <div><strong>Recorded:</strong> {formatDateTimeIST(transaction.paidAt || transaction.createdAt || transaction.timestamp)}</div>
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
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 'var(--font-size-sm)',
                  color: transaction.customerName === 'Customer Details Unavailable' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                  fontStyle: transaction.customerName === 'Customer Details Unavailable' ? 'italic' : 'normal',
                  marginTop: '2px',
                }}
              >
                {transaction.customerName}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Contact:{' '}
                <strong style={{ color: 'var(--color-brand-600)' }}>
                  {transaction.customerName === 'Customer Details Unavailable' ? '—' : displayContact}
                </strong>
              </div>
              {transaction.customerName !== 'Customer Details Unavailable' && transaction.customerId && !transaction.customerId.startsWith('C-NA') && (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  Customer Ref: {transaction.customerId}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <CreditCard size={14} /> Payment Channel & Gateway
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {transaction.paymentMethod}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Classification: <strong>{transaction.feeType.replace(/_/g, ' ')}</strong>
              </div>
              {transaction.providerOrderId && (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  Gateway Order: {transaction.providerOrderId}
                </div>
              )}
              {transaction.receiptNumber && (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  Receipt: {transaction.receiptNumber}
                </div>
              )}
            </div>
          </div>

          {/* Failure Diagnostic Alert (if payment or refund failed) */}
          {(transaction.status === 'PAYMENT_FAILED' ||
            transaction.status === 'REFUND_FAILED' ||
            transaction.failureReason ||
            transaction.failureCode) && (
            <div
              data-testid="gateway-failure-diagnostics"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-status-danger-bg)',
                border: '1px solid var(--color-status-danger-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-status-danger-text)' }}>
                {transaction.status === 'REFUND_FAILED' ? 'Gateway Refund Failure Diagnostics' : 'Gateway Failure Diagnostics'}
              </div>
              <div style={{ color: 'var(--color-status-danger-text)' }}>
                Failure Reason: <strong>{transaction.failureReason || (transaction.status === 'REFUND_FAILED' ? 'Gateway rejected the refund transaction.' : 'Transaction declined or cancelled before settlement.')}</strong>
                {transaction.failureCode && ` (Code: ${transaction.failureCode})`}
              </div>
            </div>
          )}

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
                <tr className="clickable-table-row" style={{ borderBottom: '1px solid var(--color-border)', cursor: 'default' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Platform Base Charge</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600 }}>{formatCurrencyINR(transaction.breakdown.baseAmount)}</td>
                </tr>
                <tr className="clickable-table-row" style={{ borderBottom: '1px solid var(--color-border)', cursor: 'default' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>Applicable GST (18% Goods & Services Tax)</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600 }}>{formatCurrencyINR(transaction.breakdown.gstAmount)}</td>
                </tr>
                <tr className="clickable-table-row" style={{ backgroundColor: '#f8fafc', fontWeight: 700, cursor: 'default' }}>
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
                <span style={{ fontFamily: 'monospace' }}>Idempotency Key: {transaction.refund.idempotencyKey || transaction.refund.mockIdempotencyKey}</span>
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
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {onReconcile && canManagePayment && (
              <button
                type="button"
                onClick={() => onReconcile(transaction)}
                disabled={isReconciling}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: isReconciling ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isReconciling ? 0.7 : 1,
                }}
              >
                <RefreshCw size={14} className={isReconciling ? 'animate-spin' : ''} />
                {isReconciling ? 'Reconciling...' : 'Reconcile with Gateway'}
              </button>
            )}

            {onInitiateRefund && (transaction.status === 'PAID' || transaction.status === 'SUCCEEDED') && canRefund ? (
              <button
                type="button"
                data-testid="initiate-refund-button"
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
            ) : null}
          </div>

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
