import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Receipt,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Tag,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { PaymentTransaction, RefundDto } from '../domain/types';
import { paymentRepository } from '../data/paymentRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { TransactionDetailModal } from './TransactionDetailModal';
import { RefundProcessingModal } from './RefundProcessingModal';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';
import { MaskedPhoneText } from '../../../shared/components/MaskedPhoneText';


export const PaymentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isFromDashboard = Boolean(location.state?.fromDashboard || searchParams.get('from') === 'dashboard');

  // Primary Module Tab state: 'transactions' | 'refunds' | 'fee-records'
  const [activeTab, setActiveTab] = useState<'transactions' | 'refunds' | 'fee-records'>(() => {
    const t = searchParams.get('tab');
    if (t === 'refunds' || t === 'fees' || t === 'fee-records') {
      return t === 'fees' ? 'fee-records' : (t as 'refunds' | 'fee-records');
    }
    return 'transactions';
  });

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const lastSyncedSearchRef = useRef<string>(searchTerm);

  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedFeeType, setSelectedFeeType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Sync tab change to URL
  const handleTabChange = (tab: 'transactions' | 'refunds' | 'fee-records') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new window.URLSearchParams(prev);
      if (tab === 'transactions') {
        next.delete('tab');
      } else {
        next.set('tab', tab === 'fee-records' ? 'fees' : tab);
      }
      return next;
    }, { replace: true });
  };

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

  // Sync URL search param to state only when external change occurs
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
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundTargetTxn, setRefundTargetTxn] = useState<PaymentTransaction | null>(null);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const queryClient = useQueryClient();
  const canView = hasPermission(user?.permissions, PERMISSIONS.PAYMENTS_VIEW);
  const canRefund = hasPermission(user?.permissions, PERMISSIONS.REFUNDS_MANAGE);
  const canManagePayment = hasPermission(user?.permissions, PERMISSIONS.PAYMENT_MANAGE);
  const canManageConfig = hasPermission(user?.permissions, PERMISSIONS.CONFIGURATION_MANAGE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const handleVerifyPaymentStatus = async (txn: PaymentTransaction) => {
    if (isVerifying) return; // Prevent duplicate concurrent verification calls
    try {
      setIsVerifying(true);
      setModalFeedback(null);
      const previousStatus = txn.status;
      const verifiedTxn = await paymentRepository.reconcilePayment(txn.id);

      // Compare gateway status with stored status and report exact outcome
      let msg = '';
      if (verifiedTxn.status !== previousStatus) {
        msg = `Payment status verified: Status updated from ${previousStatus} to ${verifiedTxn.status} per gateway confirmation.`;
      } else {
        msg = `Payment status verified with gateway: Confirmed as ${verifiedTxn.status} (no status change).`;
      }

      setActionFeedback(msg);
      setModalFeedback({ type: 'success', message: msg });
      setSelectedTxn(verifiedTxn);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch (err: unknown) {
      let isVerifiedPending = false;
      let errorMsg = `Failed to verify payment status: ${err instanceof Error ? err.message : 'Unknown error'}`;
      let feedbackType: 'error' | 'info' = 'error';

      try {
        const current = await paymentRepository.getTransactionById(txn.id);
        if (current) {
          if (current.status === 'REFUND_PENDING' || current.refundStatus === 'REFUND_PENDING') {
            isVerifiedPending = true;
            errorMsg = `Payment gateway is temporarily unavailable. Authoritative backend status verified: Refund Pending (awaiting settlement).`;
            feedbackType = 'info';
            setSelectedTxn(current);
            queryClient.invalidateQueries({ queryKey: ['payments'] });
          } else if (current.status === 'REFUNDED' || current.refundStatus === 'REFUNDED') {
            isVerifiedPending = true;
            errorMsg = `Payment status confirmed: Successfully settled as REFUNDED.`;
            feedbackType = 'info';
            setSelectedTxn(current);
            queryClient.invalidateQueries({ queryKey: ['payments'] });
          }
        }
      } catch {
        // Fallback to error message
      }

      if (!isVerifiedPending && err instanceof Error) {
        errorMsg = `Failed to verify payment status: ${err.message}`;
      }

      setActionFeedback(errorMsg);
      setModalFeedback({ type: feedbackType, message: errorMsg });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleInitiateRefundClick = (txn: PaymentTransaction) => {
    setRefundTargetTxn(txn);
    setIsRefundModalOpen(true);
  };

  const handleConfirmRefund = async (paymentId: string, dto: RefundDto) => {
    if (isProcessingRefund) return; // Prevent duplicate refund submissions
    try {
      setIsProcessingRefund(true);
      setModalFeedback(null);
      const refundedTxn = await paymentRepository.processRefund(paymentId, dto);

      // Determine feedback based on actual backend response status
      let msg = '';
      if (refundedTxn.refundStatus === 'REFUND_PENDING' || refundedTxn.status === 'REFUND_PENDING') {
        msg = `Refund initiated and currently pending gateway settlement for transaction ${paymentId}.`;
      } else if (refundedTxn.refundStatus === 'REFUND_FAILED' || refundedTxn.status === 'REFUND_FAILED') {
        msg = `Refund request failed at payment gateway for transaction ${paymentId}.`;
      } else {
        msg = `Refund successfully processed and audited for transaction ${paymentId}.`;
      }

      setActionFeedback(msg);
      setModalFeedback({
        type: (refundedTxn.refundStatus === 'REFUND_FAILED' || refundedTxn.status === 'REFUND_FAILED') ? 'error' : 'success',
        message: msg,
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setIsRefundModalOpen(false);
      setRefundTargetTxn(null);
      setSelectedTxn(refundedTxn);
    } catch (err: unknown) {
      const errorMsg = `Failed to process refund: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setActionFeedback(errorMsg);
      setModalFeedback({ type: 'error', message: errorMsg });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      throw err;
    } finally {
      setIsProcessingRefund(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  // Export handlers
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setExportFormat('csv');
      const currentYear = new Date().getFullYear();
      const from = `${currentYear}-01-01`;
      const to = new Date().toISOString().slice(0, 10);
      const csvData = await paymentRepository.exportPaymentsCsv(from, to, {
        status: activeTab === 'refunds' ? 'REFUNDED' : selectedStatus,
        feeType: selectedFeeType,
        searchTerm: debouncedSearchTerm,
        refunded: activeTab === 'refunds',
      });

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SevaNest_Payments_Export_${to}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setActionFeedback('Official backend CSV reference export generated successfully.');
    } catch (err: unknown) {
      setActionFeedback(`Failed to export CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      setExportFormat('xlsx');
      const now = new Date().toISOString().slice(0, 10);
      const filterCriteria = {
        status: activeTab === 'refunds' ? 'REFUNDED' : selectedStatus,
        feeType: selectedFeeType,
        searchTerm: debouncedSearchTerm,
        refunded: activeTab === 'refunds',
      };

      const blob = await paymentRepository.exportPaymentsExcel(filterCriteria);
      if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `SevaNest_Payments_Ledger_${now}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      setActionFeedback('Formatted Excel transactions ledger exported successfully.');
    } catch (err: unknown) {
      setActionFeedback(`Failed to export transactions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Query transactions with debounced search and keepPreviousData
  const { data: paymentsData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['payments', 'transactions', activeTab, debouncedSearchTerm, selectedStatus, selectedFeeType, currentPage],
    queryFn: () =>
      paymentRepository.getTransactions({
        searchTerm: debouncedSearchTerm,
        status: activeTab === 'refunds' ? (selectedStatus === 'ALL' ? undefined : selectedStatus) : selectedStatus,
        refunded: activeTab === 'refunds' ? true : undefined,
        feeType: selectedFeeType,
        page: currentPage,
        pageSize: 10,
      }),
    enabled: canView && activeTab !== 'fee-records',
    placeholderData: keepPreviousData,
  });

  // Query fee records from backend
  const { data: feeRecords, isLoading: isFeesLoading } = useQuery({
    queryKey: ['payments', 'fee-records'],
    queryFn: () => paymentRepository.getFeeRecords(),
    enabled: canView && activeTab === 'fee-records',
    staleTime: 60000,
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

  const totalLedgerRecords =
    financialOverview?.totalLedgerRecords !== undefined
      ? financialOverview.totalLedgerRecords
      : (paymentsData?.totalCount || 0);

  const totalRefundedINR = financialOverview?.totalRefundedINR ?? 0;

  if (!canView) {
    return <NoAccessView moduleName="Financial Transactions & Ledger" requiredPermission={PERMISSIONS.PAYMENTS_VIEW} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {isFromDashboard && (
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            width: 'fit-content',
            marginBottom: 'var(--space-1)',
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-label="Back to Dashboard"
        >
          <ChevronLeft size={14} />
          <span>Back to Dashboard</span>
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Financial Transactions
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Commercial operations: transaction status tracking, fee records, refunds, and audited reference exports.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* Official Backend CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-brand-600)',
              backgroundColor: 'var(--color-brand-50)',
              color: 'var(--color-brand-700)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Export authoritative backend CSV reference report"
          >
            <FileText size={14} className={isExporting && exportFormat === 'csv' ? 'animate-spin' : ''} />
            <span>{isExporting && exportFormat === 'csv' ? 'Exporting...' : 'Export CSV (Backend)'}</span>
          </button>

          {/* Formatted Excel Export */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Download formatted Excel workbook"
          >
            <FileSpreadsheet size={14} className={isExporting && exportFormat === 'xlsx' ? 'animate-spin' : ''} />
            <span>{isExporting && exportFormat === 'xlsx' ? 'Generating...' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await Promise.all([
                refetch(),
                queryClient.invalidateQueries({ queryKey: ['payments'] }),
              ]);
            }}
            disabled={isFetching}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            aria-label="Refresh"
            title="Refresh payment transactions and ledger"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          data-testid="action-feedback-banner"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: actionFeedback.includes('Failed') ? 'var(--color-status-danger-bg)' : 'var(--color-status-success-bg)',
            border: `1px solid ${actionFeedback.includes('Failed') ? 'var(--color-status-danger-border)' : 'var(--color-status-success-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: actionFeedback.includes('Failed') ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {actionFeedback.includes('Failed') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionFeedback}</span>
        </div>
      )}

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
          <div style={{ padding: 'var(--space-3)', backgroundColor: '#fff1f2', borderRadius: 'var(--radius-md)', color: '#e11d48' }}>
            <RotateCcw size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Total Settled Refunds
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {formatCurrencyINR(totalRefundedINR)}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Module Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--color-border)', paddingBottom: '0px' }}>
        <button
          type="button"
          onClick={() => handleTabChange('transactions')}
          style={{
            padding: '10px 18px',
            borderBottom: activeTab === 'transactions' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            color: activeTab === 'transactions' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'transactions' ? 700 : 500,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Receipt size={16} />
          <span>Transactions Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('refunds')}
          style={{
            padding: '10px 18px',
            borderBottom: activeTab === 'refunds' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            color: activeTab === 'refunds' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'refunds' ? 700 : 500,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RotateCcw size={16} />
          <span>Refund Records</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('fee-records')}
          style={{
            padding: '10px 18px',
            borderBottom: activeTab === 'fee-records' ? '2px solid var(--color-brand-600)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            color: activeTab === 'fee-records' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'fee-records' ? 700 : 500,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Tag size={16} />
          <span>Fee Records & Revenue Streams</span>
        </button>
      </div>

      {/* Tab Content 1 & 2: Transactions or Refunds */}
      {activeTab !== 'fee-records' && (
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
            {activeTab === 'transactions' ? (
              [
                { key: 'ALL', label: 'All Transactions' },
                { key: 'PAID', label: 'Paid' },
                { key: 'PAYMENT_FAILED', label: 'Failed' },
                { key: 'REFUNDED', label: 'Refunded' },
                { key: 'REFUND_PENDING', label: 'Refund Pending' },
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
              ))
            ) : (
              [
                { key: 'ALL', label: 'All Audited Refunds' },
                { key: 'REFUNDED', label: 'Settled Refunds' },
                { key: 'REFUND_PENDING', label: 'Pending Settlement' },
                { key: 'REFUND_FAILED', label: 'Refund Failed' },
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
                    border: selectedStatus === tab.key ? '1px solid #e11d48' : '1px solid var(--color-border, #cbd5e1)',
                    backgroundColor: selectedStatus === tab.key ? '#e11d48' : 'var(--color-surface, #ffffff)',
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
              ))
            )}
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
            </div>
          </div>

          {/* Transactions / Refunds Table */}
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <LoadingSpinner size={32} />
            </div>
          ) : isError ? (
            <div
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                backgroundColor: 'var(--color-status-danger-bg)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-status-danger-border)',
              }}
            >
              <AlertTriangle size={32} color="var(--color-status-danger-text)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-status-danger-text)' }}>
                Failed to load transactions
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-status-danger-text)', marginTop: 'var(--space-1)' }}>
                The payment repository could not be reached. Please check backend connection.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                Retry
              </button>
            </div>
          ) : !paymentsData || paymentsData.items.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-12)',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border)',
              }}
            >
              <Receipt size={36} color="var(--color-text-tertiary)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {activeTab === 'refunds' ? 'No refund records found' : 'No payment records found'}
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                {debouncedSearchTerm || selectedStatus !== 'ALL' || selectedFeeType !== 'ALL'
                  ? 'No payment transactions matched your active filters.'
                  : 'No payment transactions are currently logged in the ledger.'}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Transaction Ref</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Booking</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Customer Payer</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Fee Type</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Amount</th>
                      {activeTab === 'refunds' && (
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Refunded</th>
                      )}
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Payment Method</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Recorded Date</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsData.items.map((txn) => {
                      const isRefunded =
                        txn.status === 'REFUNDED' ||
                        txn.status === 'REFUND_PENDING' ||
                        txn.refundStatus === 'REFUNDED' ||
                        txn.refundStatus === 'REFUND_PENDING';
                      return (
                        <tr
                          key={txn.id}
                          className="clickable-table-row"
                          role="button"
                          tabIndex={0}
                          aria-label={`View transaction details for ${txn.id}`}
                          onClick={() => {
                            setSelectedTxn(txn);
                            setIsDetailOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedTxn(txn);
                              setIsDetailOpen(true);
                            }
                          }}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            backgroundColor: 'var(--color-surface)',
                            transition: 'background-color 150ms ease',
                          }}
                        >
                          <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 600 }}>
                            {txn.id}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            {canViewBookings && txn.bookingId ? (
                              <Link
                                to={`/bookings?search=${encodeURIComponent(txn.bookingRef)}`}
                                style={{ color: 'var(--color-brand-600)', fontWeight: 600, textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {txn.bookingRef}
                              </Link>
                            ) : (
                              <strong>{txn.bookingRef}</strong>
                            )}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{txn.customerName}</div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                              <MaskedPhoneText
                                phone={txn.customerPhoneMasked}
                                entityId={txn.customerId}
                                entityType="customer"
                              />
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <span style={{ fontWeight: 500 }}>{txn.feeType.replace(/_/g, ' ')}</span>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatCurrencyINR(txn.amountINR)}
                          </td>
                          {activeTab === 'refunds' && (
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: '#e11d48' }}>
                              {formatCurrencyINR(txn.refund?.refundAmountINR || txn.amountINR)}
                            </td>
                          )}
                          <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                            {txn.paymentMethod}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <StatusBadge status={txn.status} />
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTimeIST(txn.paidAt || txn.createdAt || txn.timestamp)}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTxn(txn);
                                  setIsDetailOpen(true);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: 'var(--color-surface)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>

                              {/* Reconcile Action for pending refunds */}
                              {canRefund && (txn.status === 'REFUND_PENDING' || txn.refundStatus === 'REFUND_PENDING') && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPaymentStatus(txn)}
                                  disabled={isVerifying}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid #fde68a',
                                    backgroundColor: '#fffbeb',
                                    color: '#92400e',
                                    cursor: isVerifying ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                  title="Reconcile refund status with payment gateway"
                                >
                                  <RefreshCw size={12} className={isVerifying ? 'animate-spin' : ''} />
                                  <span>Reconcile</span>
                                </button>
                              )}

                              {/* Direct Refund Action for Super Admin with permission */}
                              {canRefund && (txn.status === 'PAID' || txn.status === 'SUCCEEDED') && !isRefunded && (
                                <button
                                  type="button"
                                  onClick={() => handleInitiateRefundClick(txn)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid #fecdd3',
                                    backgroundColor: '#fff1f2',
                                    color: '#e11d48',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <RotateCcw size={12} />
                                  <span>Refund</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {paymentsData.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Showing Page {paymentsData.page} of {paymentsData.totalPages} ({paymentsData.totalCount} total records)
                  </span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      disabled={paymentsData.page <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        cursor: paymentsData.page <= 1 ? 'not-allowed' : 'pointer',
                        opacity: paymentsData.page <= 1 ? 0.5 : 1,
                        fontSize: 'var(--font-size-xs)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      type="button"
                      disabled={paymentsData.page >= paymentsData.totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(paymentsData.totalPages, p + 1))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        cursor: paymentsData.page >= paymentsData.totalPages ? 'not-allowed' : 'pointer',
                        opacity: paymentsData.page >= paymentsData.totalPages ? 0.5 : 1,
                        fontSize: 'var(--font-size-xs)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab Content 3: Fee Records & Revenue Streams (Commercial Model) */}
      {activeTab === 'fee-records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Commercial Framework Notice */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                Commercial Revenue Streams & Configured Rates
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', margin: 0 }}>
                Commercial rates are flexible and configurable from the Admin Portal without rebuilding payment logic.
              </p>
            </div>

            {(canManagePayment || canManageConfig) && (
              <Link
                to="/configuration?tab=fees"
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Configure in Pricing Plans</span>
                <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          {/* Fee Records Table */}
          {isFeesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <LoadingSpinner size={32} />
            </div>
          ) : !feeRecords || feeRecords.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-12)',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--color-border)',
              }}
            >
              <Tag size={36} color="var(--color-text-tertiary)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                No fee records configured
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                No active commercial fee entries were returned by the backend fee catalog.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Fee Code</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Revenue Stream Kind</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Configured Rate</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Commercial Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Last Updated</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Revenue Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRecords.map((fee) => {
                    const policyMap: Record<string, string> = {
                      BOOKING: 'One-time platform fee for confirmed worker booking',
                      PLACEMENT: 'Fee for successful monthly domestic staff placement',
                      VERIFICATION: 'Optional background & police verification service',
                      REPLACEMENT_PLAN: 'Extended replacement coverage plan',
                      SUBSCRIPTION: 'Monthly/quarterly customer membership support plan',
                      CANCELLATION: 'Cancellation policy terms & processing rate',
                    };
                    return (
                      <tr key={fee.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 700 }}>
                          {fee.code}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                          {fee.kind.replace(/_/g, ' ')}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 800, color: 'var(--color-brand-700)', fontSize: 'var(--font-size-sm)' }}>
                          {formatCurrencyINR(fee.amountINR)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: fee.isActive ? 'var(--color-status-success-bg)' : 'var(--color-bg-subtle)',
                              color: fee.isActive ? 'var(--color-status-success-text)' : 'var(--color-text-tertiary)',
                              border: `1px solid ${fee.isActive ? 'var(--color-status-success-border)' : 'var(--color-border)'}`,
                            }}
                          >
                            {fee.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                          {formatDateTimeIST(fee.updatedAt)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                          {policyMap[fee.kind] || 'Commercial fee schedule'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTxn}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setModalFeedback(null);
        }}
        onVerifyPaymentStatus={handleVerifyPaymentStatus}
        onReconcile={handleVerifyPaymentStatus}
        isVerifying={isVerifying}
        isReconciling={isVerifying}
        onProcessRefund={handleInitiateRefundClick}
        onInitiateRefund={handleInitiateRefundClick}
        feedback={modalFeedback}
      />

      {/* Audited Refund Processing Modal */}
      <RefundProcessingModal
        transaction={refundTargetTxn}
        isOpen={isRefundModalOpen}
        onClose={() => {
          setIsRefundModalOpen(false);
          setRefundTargetTxn(null);
        }}
        onConfirmRefund={handleConfirmRefund}
        isProcessing={isProcessingRefund}
      />
    </div>
  );
};

export default PaymentsListPage;
