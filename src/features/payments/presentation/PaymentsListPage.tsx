import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  RotateCcw,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  IndianRupee,
  Receipt,
  Download,
  CheckCircle2,
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
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

export const PaymentsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);

  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedFeeType, setSelectedFeeType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when debounced search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Sync debounced search to URL without reloading or thrashing
  useEffect(() => {
    const trimmed = debouncedSearchTerm.trim();
    if (trimmed !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = trimmed;
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        if (trimmed) {
          if (next.get('search') !== trimmed) next.set('search', trimmed);
        } else {
          if (next.has('search')) next.delete('search');
        }
        return next;
      }, { replace: true });
    }
  }, [debouncedSearchTerm, setSearchParams]);

  // Sync URL search param to state only when external change (e.g. back/forward navigation) occurs
  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    if (searchParam !== lastSyncedSearchRef.current) {
      lastSyncedSearchRef.current = searchParam;
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

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
  const [isReconciling, setIsReconciling] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const canView = hasPermission(user?.permissions, PERMISSIONS.PAYMENTS_VIEW);
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);

  const handleReconcile = async (txn: PaymentTransaction) => {
    try {
      setIsReconciling(true);
      await paymentRepository.reconcilePayment(txn.id);
      setActionFeedback(`Payment ${txn.id} successfully reconciled with gateway.`);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      const refreshed = await paymentRepository.getTransactionById(txn.id);
      if (refreshed) {
        setSelectedTxn(refreshed);
      }
    } catch (err: unknown) {
      setActionFeedback(`Failed to reconcile payment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsReconciling(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const now = new Date();
      const to = now.toISOString().slice(0, 10);
      const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const from = fromDate.toISOString().slice(0, 10);

      const csv = await paymentRepository.exportPaymentsCsv(from, to);
      if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
        const blob = new window.Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `SevaNest_Payments_Export_${from}_to_${to}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      setActionFeedback('Transactions CSV exported successfully.');
    } catch (err: unknown) {
      setActionFeedback(`Failed to export CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExportingCsv(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Query transactions with debounced search and keepPreviousData
  const { data: paymentsData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['payments', 'transactions', debouncedSearchTerm, selectedStatus, selectedFeeType, currentPage],
    queryFn: () =>
      paymentRepository.getTransactions({
        searchTerm: debouncedSearchTerm,
        status: selectedStatus,
        feeType: selectedFeeType,
        page: currentPage,
        pageSize: 10,
      }),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  // Query authoritative financial overview metrics from backend APIs
  const { data: financialOverview } = useQuery({
    queryKey: ['payments', 'financial-overview'],
    queryFn: () => paymentRepository.getFinancialOverview(),
    enabled: canView,
    staleTime: 60000,
  });

  const grossSettledCollectionsINR =
    financialOverview?.grossSettledCollectionsINR !== undefined
      ? financialOverview.grossSettledCollectionsINR
      : (paymentsData?.totalGrossCollectionsINR || 0);

  const pendingRefundsCount =
    financialOverview?.pendingRefundsCount !== undefined
      ? financialOverview.pendingRefundsCount
      : (paymentsData?.pendingRefundsCount || 0);

  const totalLedgerRecords =
    financialOverview?.totalLedgerRecords !== undefined
      ? financialOverview.totalLedgerRecords
      : (paymentsData?.totalCount || 0);

  if (!canView) {
    return <NoAccessView moduleName="Financial Transactions & Ledger" requiredPermission={PERMISSIONS.PAYMENTS_VIEW} />;
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
              {formatCurrencyINR(grossSettledCollectionsINR)}
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
              {pendingRefundsCount}
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
              {totalLedgerRecords}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          padding: '16px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Status Quick-Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)', scrollbarWidth: 'thin' }}>
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
                borderRadius: 'var(--radius-full, 9999px)',
                border: selectedStatus === tab.key ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: selectedStatus === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface, #ffffff)',
                color: selectedStatus === tab.key ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                fontSize: 'var(--font-size-xs, 12px)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Fee Type Dropdown */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%' }}>
          <SearchInput
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            placeholder="Search by customer, booking ref, transaction ID..."
            ariaLabel="Search transactions"
            isLoading={isFetching && debouncedSearchTerm.trim().length > 0}
            containerStyle={{ flex: '1 1 300px', minWidth: 'min(100%, 240px)' }}
          />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <CustomSelect
              value={selectedFeeType}
              onChange={(val) => {
                setSelectedFeeType(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Fee Classifications' },
                { value: 'BOOKING_FEE', label: 'Booking / Matching Fee' },
                { value: 'PLACEMENT_FEE', label: 'Placement Commission' },
                { value: 'REPLACEMENT_PLAN', label: 'Replacement Guarantee Plan' },
                { value: 'SUBSCRIPTION', label: 'Subscription / Membership' },
              ]}
              ariaLabel="Filter by fee classification"
              minWidth="180px"
            />

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: 'var(--color-surface, #ffffff)',
                color: 'var(--color-text-primary, #0f172a)',
                fontSize: 'var(--font-size-xs, 12px)',
                fontWeight: 600,
                cursor: exportingCsv ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxSizing: 'border-box',
                transition: 'all 150ms ease',
              }}
              title="Export audited transactions CSV"
            >
              <Download size={14} className={exportingCsv ? 'animate-spin' : ''} />
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: actionFeedback.includes('Failed') ? 'var(--color-status-danger-bg)' : 'var(--color-status-success-bg)',
            color: actionFeedback.includes('Failed') ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            border: `1px solid ${actionFeedback.includes('Failed') ? 'var(--color-status-danger-border)' : 'var(--color-status-success-border)'}`,
          }}
        >
          {actionFeedback.includes('Failed') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionFeedback}</span>
        </div>
      )}

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
          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Transaction ID
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Customer Name
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Booking Reference
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
                  Transaction Status
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !paymentsData ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <LoadingSpinner message="Loading marketplace transaction ledgers..." />
                  </td>
                </tr>
              ) : isError && !paymentsData ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-error-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={36} color="var(--color-error-dark)" />
                      <div style={{ fontWeight: 600 }}>Failed to load transactions</div>
                      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--font-size-xs)' }}>
                        An error occurred while fetching payment ledgers.
                      </p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        style={{
                          marginTop: 'var(--space-2)',
                          padding: '6px 16px',
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
                  </td>
                </tr>
              ) : paymentsData?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No payment transactions found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                paymentsData?.items.map((txn) => (
                  <tr
                    key={txn.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View transaction details for ${txn.id}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      setSelectedTxn(txn);
                      setIsDetailOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        setSelectedTxn(txn);
                        setIsDetailOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    {/* Transaction ID */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                        {txn.id}
                      </span>
                    </td>

                    {/* Customer Name */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: txn.customerName === 'Customer Details Unavailable' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                          fontStyle: txn.customerName === 'Customer Details Unavailable' ? 'italic' : 'normal',
                        }}
                      >
                        {txn.customerName}
                      </div>
                      {(txn.customerPhone || txn.customerPhoneMasked) && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {txn.customerPhone || txn.customerPhoneMasked}
                        </div>
                      )}
                    </td>

                    {/* Booking Reference */}
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
        onReconcile={handleReconcile}
        isReconciling={isReconciling}
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
