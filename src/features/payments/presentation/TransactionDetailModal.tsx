import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Receipt,
  User,
  RotateCcw,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Copy,
  Check,
  Clock,
  ExternalLink,
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
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';

interface TransactionDetailModalProps {
  transaction: PaymentTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onProcessRefund?: (transaction: PaymentTransaction) => void;
  onInitiateRefund?: (transaction: PaymentTransaction) => void;
  onVerifyPaymentStatus?: (transaction: PaymentTransaction) => Promise<void>;
  onReconcile?: (transaction: PaymentTransaction) => Promise<void>;
  isVerifying?: boolean;
  isReconciling?: boolean;
  feedback?: { type: 'success' | 'error' | 'info'; message: string } | null;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onProcessRefund,
  onInitiateRefund,
  onVerifyPaymentStatus,
  onReconcile,
  isVerifying = false,
  isReconciling = false,
  feedback = null,
}) => {
  const { user } = useAuthStore();
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);
  const canManagePayment = hasPermission(user?.permissions, PERMISSIONS.PAYMENT_MANAGE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const verifyAction = onVerifyPaymentStatus || onReconcile;
  const isVerifyingStatus = isVerifying || isReconciling;
  const refundAction = onProcessRefund || onInitiateRefund;

  // Global reference-counted modal scroll lock
  useBodyScrollLock(isOpen && Boolean(transaction));

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

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  useEffect(() => {
    setIsAlertDismissed(false);
  }, [feedback]);

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
      const fromDir = getCustomerPhone(transaction.customerId);
      if (fromDir && !fromDir.includes('*')) {
        if (isSubscribed) setResolvedContact(fromDir);
        return;
      }

      if (!env.VITE_USE_MOCK_AUTH && transaction.customerId && !transaction.customerId.startsWith('Customer')) {
        const full = await fetchCustomerUnmaskedPhone(transaction.customerId);
        if (isSubscribed && full && !full.includes('*')) {
          setResolvedContact(full);
          return;
        }
      }

      if (!env.VITE_USE_MOCK_AUTH) {
        try {
          const refreshed = await paymentRepository.getTransactionById(transaction.id);
          const refPhone =
            refreshed?.customerPhone ||
            (refreshed?.customerPhoneMasked && !refreshed.customerPhoneMasked.includes('*')
              ? refreshed.customerPhoneMasked
              : undefined);
          if (isSubscribed && refPhone && !refPhone.includes('*')) {
            setResolvedContact(refPhone);
          }
        } catch {
          // Fallback gracefully
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

  const isRefundPending = transaction.status === 'REFUND_PENDING' || transaction.refundStatus === 'REFUND_PENDING';
  const isRefunded = transaction.status === 'REFUNDED' || transaction.refundStatus === 'REFUNDED';
  const isRefundFailed = transaction.status === 'REFUND_FAILED' || transaction.refundStatus === 'REFUND_FAILED';
  const isRefundRelated = isRefundPending || isRefunded || isRefundFailed || Boolean(transaction.refund);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div
      className="modal-backdrop"
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
        overscrollBehavior: 'contain',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="txn-modal-title"
    >
      <div className="txn-detail-modal-content">
        {/* Header */}
        <div className="modal-header-container">
          <div className="modal-header-content" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Receipt size={18} color="var(--color-brand-600)" style={{ flexShrink: 0 }} />
                <h2
                  id="txn-modal-title"
                  style={{
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 800,
                    color: 'var(--color-navy)',
                    margin: 0,
                    wordBreak: 'break-all',
                  }}
                >
                  Transaction: {transaction.id}
                </h2>
                <button
                  type="button"
                  onClick={() => handleCopy(transaction.id, 'txn-id')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    padding: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Click to copy Transaction ID"
                  aria-label="Copy Transaction ID"
                >
                  {copiedField === 'txn-id' ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <StatusBadge status={transaction.status} />
              </div>
            </div>

            {/* Sub-header Context Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>Booking:</span>
                {canViewBookings && transaction.bookingId ? (
                  <Link
                    to={`/bookings?search=${encodeURIComponent(transaction.bookingRef)}`}
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: 'var(--color-brand-600)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                    onClick={onClose}
                    title="View linked booking"
                  >
                    <span>{transaction.bookingRef}</span>
                    <ExternalLink size={10} />
                  </Link>
                ) : (
                  <strong style={{ fontFamily: 'monospace' }}>{transaction.bookingRef}</strong>
                )}
              </div>

              <span>•</span>
              <span>Category: <strong>{transaction.serviceCategory}</strong></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close-btn"
            type="button"
            aria-label="Close transaction details modal"
            title="Close transaction details modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Concise Inline Alert / Feedback Banner (Requirement 9) */}
        {feedback && !isAlertDismissed && (
          <div
            role="status"
            data-testid="modal-feedback-banner"
            style={{
              margin: '8px 20px 0',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor:
                feedback.type === 'error'
                  ? '#fff1f2'
                  : feedback.type === 'info'
                  ? '#fefce8'
                  : '#f0fdf4',
              border: `1px solid ${
                feedback.type === 'error'
                  ? '#fecdd3'
                  : feedback.type === 'info'
                  ? '#fef08a'
                  : '#bbf7d0'
              }`,
              color:
                feedback.type === 'error'
                  ? '#9f1239'
                  : feedback.type === 'info'
                  ? '#854d0e'
                  : '#166534',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {feedback.type === 'error' ? (
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              ) : feedback.type === 'info' ? (
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              ) : (
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAlertDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.7,
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Dismiss alert"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Scrollable Content Body (Requirement 3, 5, 6, 7, 8) */}
        <div
          className="modal-scrollable-body"
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Section 1: Transaction Summary */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Gross Platform Collection
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-brand-700)', lineHeight: 1.2 }}>
                {formatCurrencyINR(transaction.amountINR)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {transaction.feeDescription}
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <span>Fee Type: </span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{transaction.feeType.replace(/_/g, ' ')}</strong>
              </div>
              <div>
                <span>Receipt: </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{transaction.receiptNumber || 'N/A'}</span>
              </div>
              <div>
                <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                <span>{formatDateTimeIST(transaction.paidAt || transaction.createdAt || transaction.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Customer and Booking */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={13} /> Customer & Booking Context
            </div>

            <div className="txn-detail-grid-2col" style={{ fontSize: 'var(--font-size-xs)' }}>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Payer Profile</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 'var(--font-size-sm)',
                    color: transaction.customerName === 'Customer Details Unavailable' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
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
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Linked Service Booking</div>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>
                  {transaction.bookingRef}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Service Category: <strong>{transaction.serviceCategory}</strong>
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Classification Code: <span style={{ fontFamily: 'monospace' }}>{transaction.feeCode || transaction.feeType}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Payment Gateway Details */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CreditCard size={13} /> Payment Gateway Details
            </div>

            <div className="txn-detail-grid-2col" style={{ fontSize: 'var(--font-size-xs)' }}>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Payment Channel</div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {transaction.paymentMethod}
                </div>
                {transaction.paymentMethodDetail && (
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                    Channel Detail: <code>{transaction.paymentMethodDetail}</code>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Gateway Ref: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>{transaction.gatewayRef || 'N/A'}</span>
                </div>
                {transaction.providerPaymentId && (
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Provider Payment ID: </span>
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{transaction.providerPaymentId}</span>
                  </div>
                )}
                {transaction.providerOrderId && (
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Provider Order ID: </span>
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{transaction.providerOrderId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Failure Diagnostic Alert */}
            {(transaction.status === 'PAYMENT_FAILED' ||
              transaction.status === 'REFUND_FAILED' ||
              transaction.failureReason ||
              transaction.failureCode) && (
              <div
                data-testid="gateway-failure-diagnostics"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-status-danger-bg)',
                  border: '1px solid var(--color-status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginTop: '4px',
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
          </div>

          {/* Section 4: Fee and Tax Ledger (Requirement 5 — NO CLIPPING) */}
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <div
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--color-bg-subtle)',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.025em',
              }}
            >
              <Receipt size={14} color="var(--color-brand-600)" />
              <span>Platform Fee & Tax Calculation Ledger (INR)</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <td style={{ padding: '8px 14px', color: 'var(--color-text-secondary)' }}>Platform Base Charge</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {formatCurrencyINR(transaction.breakdown.baseAmount)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <td style={{ padding: '8px 14px', color: 'var(--color-text-secondary)' }}>Applicable GST (18% Goods & Services Tax)</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {formatCurrencyINR(transaction.breakdown.gstAmount)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                  <td style={{ padding: '9px 14px', color: 'var(--color-text-primary)' }}>Total Invoice / Collected Amount</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--color-brand-700)', fontSize: '13px' }}>
                    {formatCurrencyINR(transaction.amountINR)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 5: Refund Settlement Details */}
          {isRefundRelated && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: isRefundPending ? '#fffbeb' : isRefunded ? '#f0fdf4' : '#fff1f2',
                border: `1px solid ${isRefundPending ? '#fef08a' : isRefunded ? '#bbf7d0' : '#fecdd3'}`,
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <strong
                  style={{
                    color: isRefundPending ? '#854d0e' : isRefunded ? '#166534' : '#9f1239',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                  }}
                >
                  <RotateCcw size={14} />
                  <span>
                    Refund Settlement Details: {isRefundPending ? 'Pending Gateway Settlement' : isRefunded ? 'Settled & Completed' : 'Settlement Failed'}
                  </span>
                </strong>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '12px',
                    color: isRefundPending ? '#854d0e' : isRefunded ? '#166534' : '#9f1239',
                  }}
                >
                  {formatCurrencyINR(transaction.refund?.refundAmountINR || transaction.amountINR)}{' '}
                  {isRefundPending ? 'Refund Pending' : isRefunded ? 'Refunded' : 'Failed'}
                </span>
              </div>

              {isRefundPending && (
                <div style={{ color: '#854d0e', lineHeight: 1.4, fontSize: '11px' }}>
                  Refund authorization is recorded in the platform database. Third-party payment gateway disbursement is pending gateway availability in this environment.
                </div>
              )}

              {isRefunded && (
                <div style={{ color: '#166534', lineHeight: 1.4, fontSize: '11px' }}>
                  Disbursement completed and confirmed by payment gateway on {formatDateTimeIST(transaction.refundedAt || transaction.refund?.refundedAt || transaction.timestamp)}.
                </div>
              )}

              {isRefundFailed && (
                <div style={{ color: '#9f1239', lineHeight: 1.4, fontSize: '11px' }}>
                  Payment gateway returned a failure during refund settlement instruction. Retry or manual settlement review is required.
                </div>
              )}
            </div>
          )}

          {/* Section 6: Refund Audit History */}
          {isRefundRelated && transaction.refund && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} color="var(--color-brand-600)" /> Refund Audit History & Governance
              </div>

              <div>
                <strong>Operational Justification:</strong>{' '}
                <span>
                  {transaction.refund.refundReason ||
                    transaction.refund.remarks ||
                    (transaction.refund.reasonCategory ? transaction.refund.reasonCategory.replace(/_/g, ' ') : 'Administrative Cancellation Refund')}
                </span>
              </div>

              <div
                style={{
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px dashed var(--color-border)',
                  flexWrap: 'wrap',
                  gap: '6px',
                  fontSize: '11px',
                }}
              >
                <span>
                  Authorized by: <strong>{transaction.refund.processedBy || transaction.refund.refundedByUserId || 'Admin Operator'}</strong>
                </span>
                <span>
                  Date: <strong>{formatDateTimeIST(transaction.refund.processedAt || transaction.refund.refundedAt || transaction.timestamp)}</strong>
                </span>
                {(transaction.refund.idempotencyKey || transaction.refund.mockIdempotencyKey) && (
                  <span style={{ fontFamily: 'monospace' }}>
                    Idempotency: {transaction.refund.idempotencyKey || transaction.refund.mockIdempotencyKey}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer (Requirement 4, 12, Part 3) */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle)',
            flexShrink: 0,
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {verifyAction && canManagePayment && !isRefunded && (
              <button
                type="button"
                data-testid="verify-payment-status-button"
                onClick={() => verifyAction(transaction)}
                disabled={isVerifyingStatus}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: isVerifyingStatus ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isVerifyingStatus ? 0.7 : 1,
                  boxShadow: 'var(--shadow-sm)',
                }}
                title="Verify real-time payment status against payment gateway"
              >
                <RefreshCw size={14} className={isVerifyingStatus ? 'animate-spin' : ''} />
                <span>{isVerifyingStatus ? 'Verifying...' : 'Verify Payment Status'}</span>
              </button>
            )}

            {/* Refund Action for Super Admin (Initial Refund or Settlement Retry) */}
            {refundAction && canRefund && (
              <>
                {(transaction.status === 'PAID' || transaction.status === 'SUCCEEDED') && !isRefundRelated && (
                  <button
                    type="button"
                    data-testid="process-refund-button"
                    onClick={() => refundAction(transaction)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #fecdd3',
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    title="Review booking and process audited refund"
                  >
                    <RotateCcw size={13} />
                    <span>Process Refund</span>
                  </button>
                )}

                {isRefundPending && (
                  <button
                    type="button"
                    data-testid="retry-settlement-button"
                    onClick={() => refundAction(transaction)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #fde68a',
                      backgroundColor: '#fffbeb',
                      color: '#92400e',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    title="Retry settlement instruction with payment gateway"
                  >
                    <RotateCcw size={13} />
                    <span>Retry Settlement</span>
                  </button>
                )}

                {isRefundFailed && (
                  <button
                    type="button"
                    data-testid="process-refund-button"
                    onClick={() => refundAction(transaction)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #fecdd3',
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    title="Retry failed refund request"
                  >
                    <RotateCcw size={13} />
                    <span>Retry Refund</span>
                  </button>
                )}
              </>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
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
