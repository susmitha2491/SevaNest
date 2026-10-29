import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  RotateCcw,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  IndianRupee,
  Receipt,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { PaymentTransaction } from '../domain/types';
import { paymentRepository } from '../data/paymentRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { TransactionDetailModal } from './TransactionDetailModal';
import { RefundProcessingModal } from './RefundProcessingModal';

export const PaymentsListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedFeeType, setSelectedFeeType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    }
  }, [searchParams]);

  // Modal states
  const [selectedTxn, setSelectedTxn] = useState<PaymentTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);

  const canView = hasPermission(user?.permissions, PERMISSIONS.PAYMENTS_VIEW);
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);

  // Query transactions
  const { data: paymentsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['payments', 'transactions', searchTerm, selectedStatus, selectedFeeType, currentPage],
    queryFn: () =>
      paymentRepository.getTransactions({
        searchTerm,
        status: selectedStatus,
        feeType: selectedFeeType,
        page: currentPage,
        pageSize: 6,
      }),
    enabled: canView,
  });

  if (!canView) {
    return <NoAccessView moduleName="Financial Transactions & Ledger" requiredPermission={PERMISSIONS.PAYMENTS_VIEW} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading marketplace transaction ledgers..." />;
  }

  if (isError) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error-dark)' }}>
          Failed to load transactions
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          An error occurred while fetching payment ledgers. Please retry.
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-brand-600)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Financial Transactions & Refunds
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Operational monitoring for booking fee collections, placement charges, replacement plans, and refund arbitration.
          </p>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-status-info-bg)',
            border: '1px solid var(--color-status-info-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-info-text)',
          }}
        >
          <Info size={16} />
          <span>Platform Financial Ledger — Gateway Reconciled</span>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-brand-50)', borderRadius: 'var(--radius-md)', color: 'var(--color-brand-600)' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Gross Settled Collections
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {formatCurrencyINR(paymentsData?.totalGrossCollectionsINR || 0)}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-status-warning-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-status-warning-text)' }}>
            <RotateCcw size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Pending Refund Requests
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-warning-dark)' }}>
              {paymentsData?.pendingRefundsCount || 0}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-status-success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-status-success-text)' }}>
            <Receipt size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Total Ledger Records
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {paymentsData?.totalCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Status Quick-Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
          {[
            { key: 'ALL', label: 'All Transactions' },
            { key: 'PAID', label: 'Paid' },
            { key: 'REFUND_PENDING', label: 'Refund Pending' },
            { key: 'REFUNDED', label: 'Refunded' },
            { key: 'PAYMENT_FAILED', label: 'Failed' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedStatus === tab.key ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                backgroundColor: selectedStatus === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: selectedStatus === tab.key ? '#ffffff' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Fee Type Dropdown */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '450px' }}>
            <Search
              size={16}
              color="var(--color-text-tertiary)"
              style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by customer, booking ref, transaction ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-label="Search transactions"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select
              value={selectedFeeType}
              onChange={(e) => {
                setSelectedFeeType(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
              aria-label="Filter by fee classification"
            >
              <option value="ALL">All Fee Classifications</option>
              <option value="BOOKING_FEE">Booking / Matching Fee</option>
              <option value="PLACEMENT_FEE">Placement Commission</option>
              <option value="REPLACEMENT_PLAN">Replacement Guarantee Plan</option>
              <option value="SUBSCRIPTION">Subscription / Membership</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Transaction ID
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Customer
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Booking Ref
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Fee Classification
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Amount
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Payment Method
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Status
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No payment transactions found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                paymentsData?.items.map((txn) => (
                  <tr key={txn.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {/* Transaction ID */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                        {txn.id}
                      </span>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{txn.customerName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                        {txn.customerId}
                      </div>
                    </td>

                    {/* Booking Ref */}
                    <td style={{ padding: 'var(--space-4)', fontFamily: 'monospace', color: 'var(--color-brand-700)', fontWeight: 600 }}>
                      {txn.bookingRef}
                    </td>

                    {/* Fee Classification */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {txn.feeType.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {txn.serviceCategory}
                      </div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {formatCurrencyINR(txn.amountINR)}
                    </td>

                    {/* Method */}
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {txn.paymentMethod}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <StatusBadge status={txn.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedTxn(txn);
                            setIsDetailOpen(true);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} /> View
                        </button>

                        {canRefund && (txn.status === 'PAID' || txn.status === 'REFUND_PENDING') && (
                          <button
                            onClick={() => {
                              setSelectedTxn(txn);
                              setIsRefundOpen(true);
                            }}
                            style={{
                              padding: '4px 10px',
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
                            <RotateCcw size={12} /> Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {paymentsData && paymentsData.totalPages > 1 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Page {paymentsData.page} of {paymentsData.totalPages} ({paymentsData.totalCount} transactions)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={paymentsData.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: paymentsData.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={paymentsData.page >= paymentsData.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, paymentsData.totalPages))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: paymentsData.page >= paymentsData.totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTxn}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTxn(null);
        }}
        onInitiateRefund={(t) => {
          setIsDetailOpen(false);
          setSelectedTxn(t);
          setIsRefundOpen(true);
        }}
      />

      {/* Refund Processing Modal */}
      <RefundProcessingModal
        transaction={selectedTxn}
        isOpen={isRefundOpen}
        onClose={() => {
          setIsRefundOpen(false);
          setSelectedTxn(null);
        }}
        onRefundCompleted={() => {
          setIsRefundOpen(false);
          setSelectedTxn(null);
        }}
      />
    </div>
  );
};
