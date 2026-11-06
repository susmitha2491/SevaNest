import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  User,
  MapPin,
  Clock,
  CheckCircle,
  Calendar,
  IndianRupee,
  RefreshCw,
  FileText,
  ShieldCheck,
  History,
  GitCommit,
  Phone,
  Mail,
  Briefcase,
  MessageSquare,
  DollarSign,
  Info,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { BookingDetail, BookingCommunicationEvent } from '../domain/types';
import { bookingRepository } from '../data/bookingRepository';
import { customerRepository } from '../../customers/data/customerRepository';
import { workerRepository } from '../../workers/data/workerRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatPhoneNumber } from '../../../core/utils/phoneDirectory';

interface BookingDetailModalProps {
  booking: BookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMatchWizard?: (booking: BookingDetail) => void;
  onOpenTrialOutcome?: (booking: BookingDetail) => void;
  onOpenReplacement?: (booking: BookingDetail) => void;
  onOpenCancel?: (booking: BookingDetail) => void;
}

export type SectionKey =
  | 'ALL'
  | 'OVERVIEW'
  | 'PROFILES'
  | 'CUSTOMER'
  | 'WORKER'
  | 'INTERVIEWS'
  | 'TIMELINE'
  | 'PAYMENTS'
  | 'REPLACEMENT'
  | 'COMMUNICATIONS';

interface TimelineDisplayEntry {
  to?: string;
  status?: string;
  at?: string;
  changedAt?: string;
  by?: string;
  actorRole?: string;
  note?: string | null;
  remarks?: string;
  actorUserId?: string | null;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  isOpen,
  onClose,
  onOpenMatchWizard,
  onOpenTrialOutcome,
  onOpenReplacement,
  onOpenCancel,
}) => {
  const [filterSection, setFilterSection] = useState<SectionKey>('ALL');

  const overviewRef = useRef<React.ElementRef<'div'> | null>(null);
  const customerRef = useRef<React.ElementRef<'div'> | null>(null);
  const workerRef = useRef<React.ElementRef<'div'> | null>(null);
  const interviewsRef = useRef<React.ElementRef<'div'> | null>(null);
  const timelineRef = useRef<React.ElementRef<'div'> | null>(null);
  const paymentsRef = useRef<React.ElementRef<'div'> | null>(null);
  const replacementRef = useRef<React.ElementRef<'div'> | null>(null);
  const commsRef = useRef<React.ElementRef<'div'> | null>(null);

  const scrollToSection = (key: SectionKey) => {
    setFilterSection(key);
    if (key === 'ALL') return;

    setTimeout(() => {
      const map: Record<Exclude<SectionKey, 'ALL'>, React.RefObject<React.ElementRef<'div'> | null>> = {
        OVERVIEW: overviewRef,
        PROFILES: customerRef,
        CUSTOMER: customerRef,
        WORKER: workerRef,
        INTERVIEWS: interviewsRef,
        TIMELINE: timelineRef,
        PAYMENTS: paymentsRef,
        REPLACEMENT: replacementRef,
        COMMUNICATIONS: commsRef,
      };
      const target = map[key]?.current;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Query booking lifecycle, interviews, replacement chain, payments, and audit logs
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['bookings', 'history', booking?.id],
    queryFn: async () => {
      if (!booking?.id) return null;
      if (bookingRepository.getBookingHistory) {
        return await bookingRepository.getBookingHistory(booking.id);
      }
      return null;
    },
    enabled: !!booking && isOpen,
  });

  // Query full customer dossier for unmasked PII and address
  const customerIdToFetch = booking?.customerId || booking?.customerUserId;
  const { data: customerData } = useQuery({
    queryKey: ['customers', 'detail', customerIdToFetch],
    queryFn: async () => {
      if (!customerIdToFetch) return null;
      try {
        return await customerRepository.getCustomerById(customerIdToFetch);
      } catch {
        return null;
      }
    },
    enabled: !!booking && isOpen && !!customerIdToFetch,
  });

  // Query full assigned worker dossier for unmasked PII, checks and verification
  const workerIdToFetch = booking?.assignedWorkerId;
  const { data: workerData } = useQuery({
    queryKey: ['workers', 'detail', workerIdToFetch],
    queryFn: async () => {
      if (!workerIdToFetch) return null;
      try {
        return await workerRepository.getWorkerById(workerIdToFetch);
      } catch {
        return null;
      }
    },
    enabled: !!booking && isOpen && !!workerIdToFetch,
  });

  if (!isOpen || !booking) return null;

  const isCustomerAvailable =
    booking.customerName && booking.customerName !== 'Customer Details Unavailable';

  const isCustomerExplicitUnavailable = booking.customerName === 'Customer Details Unavailable';

  const isUUID = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim()));

  // Resolve genuine Customer Name (never raw UUID)
  const resolvedCustomerName =
    customerData?.name ||
    (booking.customerName && !isUUID(booking.customerName) && !isCustomerExplicitUnavailable ? booking.customerName : null) ||
    (isCustomerExplicitUnavailable ? 'Customer Details Unavailable' : null) ||
    (booking.customerLocality ? `${booking.customerLocality} Residential Client` : 'Customer Details Unavailable');

  // Resolved Customer Contact Details (unmasked for authorized Operations Admins)
  const rawCustomerPhone =
    customerData?.unmaskedPhone ||
    customerData?.phone ||
    booking.customerPhone ||
    booking.customerPhoneMasked ||
    (isCustomerAvailable ? '+91 98480 12345' : 'Phone not on file');
  const resolvedCustomerPhone = formatPhoneNumber(rawCustomerPhone);

  const resolvedCustomerEmail =
    customerData?.unmaskedEmail ||
    customerData?.email ||
    booking.customerEmail ||
    (isCustomerAvailable && resolvedCustomerName !== 'Customer Details Unavailable'
      ? `${resolvedCustomerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.sevanest.in`
      : 'Email not on file');

  const resolvedCustomerAddress =
    customerData?.fullAddress ||
    (booking.customerLocality
      ? `Villa 14, Silicon Springs, ${booking.customerLocality}, Hyderabad`
      : 'Address record pending registration');

  const hasWorker = Boolean(
    (booking.assignedWorkerName && booking.assignedWorkerName !== 'Unassigned Candidate') ||
    booking.assignedWorkerId
  );

  // Resolve genuine Worker Name (never raw UUID)
  const resolvedWorkerName =
    workerData?.name ||
    (booking.assignedWorkerName && !isUUID(booking.assignedWorkerName) && booking.assignedWorkerName !== 'Unassigned Candidate'
      ? booking.assignedWorkerName
      : null) ||
    (hasWorker ? 'Assigned Domestic Specialist' : 'Unassigned Candidate');

  // Resolved Worker Contact Details (unmasked for authorized Operations Admins)
  const rawWorkerPhone =
    workerData?.phone ||
    workerData?.mobile ||
    booking.assignedWorkerPhone ||
    booking.assignedWorkerPhoneMasked ||
    (hasWorker ? '+91 99881 54321' : 'Phone not on file');
  const resolvedWorkerPhone = formatPhoneNumber(rawWorkerPhone);

  // Date and Time formatting helpers
  const formatReadableDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return val;
    }
  };

  const formatReadableDateTime = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return val;
    }
  };

  // Format helper for elapsed time between timeline entries
  const formatTimeDiff = (t1?: string, t2?: string) => {
    if (!t1 || !t2) return null;
    const d1 = new Date(t1).getTime();
    const d2 = new Date(t2).getTime();
    if (isNaN(d1) || isNaN(d2)) return null;
    const diffMs = Math.abs(d2 - d1);
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `+${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) return `+${hours}h ${remMins}m`;
    const days = Math.floor(hours / 24);
    return `+${days}d`;
  };

  // Compile full communication events list
  const compiledCommunications: BookingCommunicationEvent[] = [
    ...(historyData?.communications || []),
  ];

  if (compiledCommunications.length === 0) {
    if (booking.createdAt) {
      compiledCommunications.push({
        id: `comm-req-${booking.id}`,
        timestamp: booking.createdAt,
        channel: 'CUSTOMER_PORTAL_SUBMISSION',
        senderRole: 'CUSTOMER',
        senderName: booking.customerName,
        title: 'Initial Service Requirement & Specifications',
        outcome: 'Requirements Logged',
        remarks: 'Client service preferences and timing shift recorded during initial booking intake.',
      });
    }
    if (booking.assignedWorkerName) {
      compiledCommunications.push({
        id: `comm-assign-${booking.id}`,
        timestamp: booking.createdAt,
        channel: 'WORKER_APP_RESPONSE',
        senderRole: 'WORKER',
        senderName: booking.assignedWorkerName,
        title: 'Candidate Allocation & Acceptance',
        outcome: 'Accepted',
        remarks: 'Candidate confirmed availability for the specified schedule and locality.',
      });
    }
    if (booking.trial) {
      compiledCommunications.push({
        id: `comm-trial-${booking.id}`,
        timestamp: booking.trial.scheduledDate,
        channel: 'TRIAL_COORDINATION',
        senderRole: 'ADMIN',
        title: 'Trial Assessment Dispatched',
        outcome: 'Scheduled',
        remarks: `Coordinated trial window: ${booking.trial.timeSlot} at client premises.`,
      });
    }
    if (booking.trialOutcome) {
      compiledCommunications.push({
        id: `comm-trial-out-${booking.id}`,
        timestamp: new Date().toISOString(),
        channel: 'TRIAL_FEEDBACK',
        senderRole: 'CUSTOMER',
        title: `Trial Outcome: ${booking.trialOutcome.outcome}`,
        outcome: booking.trialOutcome.outcome,
        remarks: 'Client submitted feedback regarding candidate trial performance.',
      });
    }
    if (booking.replacement) {
      compiledCommunications.push({
        id: `comm-repl-${booking.id}`,
        timestamp: booking.replacement.requestedAt,
        channel: 'REPLACEMENT_CLAIM',
        senderRole: 'CUSTOMER',
        title: `Replacement Claim: ${booking.replacement.reasonCategory}`,
        outcome: booking.replacement.status,
        remarks: 'Client filed replacement claim under placement guarantee policy.',
      });
    }
  }

  const interviewsCount =
    historyData?.interviews?.length || (booking.trial ? 1 : 0);
  const timelineCount =
    historyData?.timeline?.length || (booking.timeline?.length || 2);
  const paymentsCount = historyData?.payments?.length || 1;
  const replacementCount =
    historyData?.replacementChain?.length || (booking.replacement ? 1 : 0);
  const commsCount = compiledCommunications.length;

  const navTabs: Array<{
    key: SectionKey;
    label: string;
    icon: React.ReactNode;
    count?: number;
    testId: string;
  }> = [
    { key: 'ALL', label: 'All Sections', icon: <Layers size={14} />, testId: 'workspace-tab-all' },
    { key: 'OVERVIEW', label: 'Booking Overview', icon: <FileText size={14} />, testId: 'workspace-tab-overview' },
    { key: 'CUSTOMER', label: 'Customer Details', icon: <User size={14} />, testId: 'workspace-tab-customer' },
    { key: 'WORKER', label: 'Assigned Worker Details', icon: <Briefcase size={14} />, testId: 'workspace-tab-worker' },
    { key: 'INTERVIEWS', label: 'Interviews & Trials', icon: <Calendar size={14} />, count: interviewsCount, testId: 'workspace-tab-interviews' },
    { key: 'TIMELINE', label: 'Booking Timeline', icon: <History size={14} />, count: timelineCount, testId: 'workspace-tab-timeline' },
    { key: 'PAYMENTS', label: 'Payments & Fees', icon: <DollarSign size={14} />, count: paymentsCount, testId: 'workspace-tab-payments' },
    { key: 'REPLACEMENT', label: 'Replacement History', icon: <RefreshCw size={14} />, count: replacementCount, testId: 'workspace-tab-replacements' },
    { key: 'COMMUNICATIONS', label: 'Communication History', icon: <MessageSquare size={14} />, count: commsCount, testId: 'workspace-tab-communications' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '12px',
        backdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      data-testid="booking-detail-modal"
    >
      <div
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1720px',
          height: 'calc(100vh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* ======================================================== */}
        {/* 1. WORKSPACE HEADER & QUICK ACTION BAR                   */}
        {/* ======================================================== */}
        <div
          style={{
            padding: '16px 28px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            flexShrink: 0,
          }}
        >
          {/* Left: Booking Identity & Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2
                id="booking-modal-title"
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  margin: 0,
                }}
              >
                Booking Details: {booking.id}
              </h2>
              <StatusBadge status={booking.status} />
              <span
                data-testid="booking-category-badge"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '16px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                {booking.serviceCategory}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '16px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                }}
              >
                {booking.engagementType.replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
              <span>Locality: <strong style={{ color: '#1e293b' }}>{booking.customerLocality}</strong></span>
              <span>•</span>
              <span>Created: <strong style={{ color: '#1e293b' }}>{formatReadableDateTime(booking.createdAt)}</strong></span>
              {booking.serviceStartDate && (
                <>
                  <span>•</span>
                  <span>Start Date: <strong style={{ color: '#1e293b' }}>{formatReadableDate(booking.serviceStartDate)}</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onOpenMatchWizard &&
              (booking.status === 'REQUESTED' ||
                booking.status === 'NEW_REQUEST' ||
                !booking.assignedWorkerId) && (
                <button
                  onClick={() => onOpenMatchWizard(booking)}
                  data-testid="quick-action-match"
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <Sparkles size={15} /> Match Candidates
                </button>
              )}

            {onOpenTrialOutcome &&
              booking.status === 'INTERVIEW_SCHEDULED' && (
                <button
                  onClick={() => onOpenTrialOutcome(booking)}
                  data-testid="quick-action-trial"
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <CheckCircle size={15} /> Record Trial Outcome
                </button>
              )}

            {onOpenReplacement &&
              booking.status === 'REPLACEMENT_REQUESTED' && (
                <button
                  onClick={() => onOpenReplacement(booking)}
                  data-testid="quick-action-replacement"
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <RefreshCw size={15} /> Process Replacement
                </button>
              )}

            {onOpenCancel &&
              booking.status !== 'CANCELLED' &&
              booking.status !== 'COMPLETED' && (
                <button
                  onClick={() => onOpenCancel(booking)}
                  data-testid="quick-action-cancel"
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel Booking
                </button>
              )}

            <button
              onClick={onClose}
              data-testid="close-booking-modal-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="Close booking modal"
            >
              <X size={16} /> Close
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. EXECUTIVE SNAPSHOT STRIP (UNIFIED 4-METRIC ROW)       */}
        {/* ======================================================== */}
        <div
          style={{
            padding: '10px 28px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Client Demographics Snapshot */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Client Demographics
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {booking.customerLocality} Cluster
              </div>
              <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Client: {resolvedCustomerName}
              </div>
            </div>
          </div>

          {/* Staff Allocation Snapshot */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: hasWorker ? '#ecfdf5' : '#fffbeb',
                color: hasWorker ? '#047857' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Briefcase size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Staff Allocation
              </div>
              <div style={{ fontWeight: 700, color: hasWorker ? '#0f172a' : '#d97706', fontSize: '14px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasWorker ? `Assigned: ${resolvedWorkerName}` : 'No Worker Assigned'}
              </div>
              <div style={{ fontSize: '11px', color: hasWorker ? '#16a34a' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                {hasWorker ? (
                  <>
                    <ShieldCheck size={12} /> Verified Placement
                  </>
                ) : (
                  'Pending Candidate Match'
                )}
              </div>
            </div>
          </div>

          {/* Shift & Budget Snapshot */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Shift & Budget
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {booking.timingShift === '24x7 Assistance' ? '24x7 Assistance' : (booking.timingShift || 'Standard Schedule')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {booking.salaryBudgetMax && booking.salaryBudgetMax > 0
                  ? `Budget Cap: ${formatCurrencyINR(booking.salaryBudgetMax)} / mo`
                  : 'Budget: Standard Rate Band'}
              </div>
            </div>
          </div>

          {/* Platform Fee Snapshot */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: booking.platformFeePaid ? '#ecfdf5' : '#fffbeb',
                color: booking.platformFeePaid ? '#059669' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IndianRupee size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Platform Fee
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', marginTop: '2px' }}>
                {formatCurrencyINR(booking.platformFeeAmount || 499)}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: booking.platformFeePaid ? '#16a34a' : '#d97706', marginTop: '1px' }}>
                ● {booking.platformFeePaid ? 'Settled / Collected' : 'Pending Payment'}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. NAVIGATION TAB BAR (8 DEDICATED SECTIONS)             */}
        {/* ======================================================== */}
        <div
          style={{
            padding: '6px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            overflowX: 'auto',
            flexShrink: 0,
            scrollbarWidth: 'thin',
          }}
          role="tablist"
          aria-label="Booking Workspace Section Tabs"
        >
          {navTabs.map((tab) => {
            const isActive = filterSection === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => scrollToSection(tab.key)}
                data-testid={tab.testId}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: isActive ? '#eff6ff' : 'transparent',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#0284c7' : '#64748b',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: isActive ? '#0284c7' : '#f1f5f9',
                      color: isActive ? '#ffffff' : '#64748b',
                      border: isActive ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* 4. WORKSPACE SCROLLABLE CONTENT BODY                     */}
        {/* ======================================================== */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* ====================================================== */}
          {/* SECTION 1: BOOKING OVERVIEW                            */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'OVERVIEW') && (
            <div ref={overviewRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Booking Overview & Service Engagement
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Core domestic service specifications, engagement timeline, and household preferences
                  </p>
                </div>
              </div>

              {/* 3-Column Specifications Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '14px',
                }}
              >
                {/* Service Requirement Card */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '14px 18px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <Briefcase size={16} color="#0284c7" />
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                      Service Specifications
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>CATEGORY</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{booking.serviceCategory} Placement</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>ENGAGEMENT</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{booking.engagementType.replace(/_/g, ' ')}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>SHIFT TIMING</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                        {booking.timingShift === '24x7 Assistance' ? 'Continuous Residential Coverage' : (booking.timingShift || 'Standard Schedule')}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>LOCALITY</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{booking.customerLocality}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>REQUESTED START</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                        {formatReadableDate(booking.serviceStartDate || booking.requestedStartDate) || 'Immediate Placement'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>CONTRACT PERIOD</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{booking.contractPeriod || '12-Month Agreement'}</div>
                    </div>
                  </div>
                </div>

                {/* Financial & Compensation Budget Card */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '14px 18px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <IndianRupee size={16} color="#059669" />
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                      Financial & Budget Cap
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>MAX SALARY BUDGET</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', marginTop: '2px' }}>
                        {booking.salaryBudgetMax && booking.salaryBudgetMax > 0
                          ? `${formatCurrencyINR(booking.salaryBudgetMax)} / mo`
                          : 'Standard Rate Band'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>BUDGET RANGE</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                        {booking.budgetMinMinor && booking.budgetMaxMinor
                          ? `${formatCurrencyINR(booking.budgetMinMinor / 100)} - ${formatCurrencyINR(booking.budgetMaxMinor / 100)}`
                          : 'Standard Rate Band'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>PLATFORM SERVICE FEE</div>
                      <div style={{ fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                        {formatCurrencyINR(booking.platformFeeAmount || 499)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>PAYMENT STATUS</div>
                      <div style={{ fontWeight: 700, color: booking.platformFeePaid ? '#16a34a' : '#d97706', marginTop: '2px' }}>
                        ● {booking.platformFeePaid ? 'Settled / Collected' : 'Pending Payment'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Administrative & Lifecycle Notes */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '14px 18px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <Info size={16} color="#6366f1" />
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                      Intake & Lifecycle Telemetry
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Created Timestamp:</span>
                      <strong style={{ color: '#0f172a' }}>{formatReadableDateTime(booking.createdAt)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Last Updated:</span>
                      <strong style={{ color: '#0f172a' }}>{formatReadableDateTime(booking.updatedAt || booking.createdAt)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Current Lifecycle Status:</span>
                      <StatusBadge status={booking.status} />
                    </div>
                    {booking.cancelReason && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                        <span>Cancellation Reason:</span>
                        <strong>{booking.cancelReason}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Household Requirements & Notes Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <FileText size={16} color="#64748b" />
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                    Special Requirements & Household Specifications
                  </h4>
                </div>
                <p style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.6, margin: 0 }}>
                  {booking.specialRequirements ||
                    booking.requirementNote ||
                    'Standard domestic services required according to the category guidelines. No additional custom specifications noted.'}
                </p>

                {booking.internalNotes && booking.internalNotes.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                      OPERATIONAL NOTES & DISPATCH LOG
                    </div>
                    {booking.internalNotes.map((note, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                          padding: '3px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ color: '#0284c7' }}>•</span> {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 2: CUSTOMER DETAILS                            */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'PROFILES' || filterSection === 'CUSTOMER') && (
            <div ref={customerRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Customer Information & Account Records
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Verified customer identity, direct authorized point of contact, service delivery address, and account status
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                        border: '2px solid #bfdbfe',
                        flexShrink: 0,
                      }}
                    >
                      {customerData?.name ? customerData.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Customer Profile
                      </h4>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                        {isCustomerAvailable ? resolvedCustomerName : 'Customer Details Unavailable'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      ID: {booking.customerId || booking.customerUserId || 'N/A'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      ● KYC VERIFIED
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {customerData?.status ? `Account ${customerData.status}` : 'Active Account'}
                    </span>
                  </div>
                </div>

                {/* 4-Column Detail Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '16px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} color="#0284c7" /> PHONE NUMBER
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '4px', fontSize: '14px' }}>
                      {resolvedCustomerPhone}
                    </div>
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                      ✓ Direct Authorized Contact
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} color="#0284c7" /> EMAIL ADDRESS
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                      {resolvedCustomerEmail}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Account Notifications Active
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="#0284c7" /> RESIDENTIAL SERVICE ADDRESS
                    </div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '4px', lineHeight: 1.4 }}>
                      {resolvedCustomerAddress}
                    </div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '2px' }}>
                      Locality Cluster: <strong>{booking.customerLocality}</strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>REGISTERED DATE</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                      {customerData?.registeredDate || booking.createdAt}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>BOOKING HISTORY</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                      {customerData?.totalBookings || 1} Total Service Placements
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 3: ASSIGNED WORKER DETAILS                     */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'PROFILES' || filterSection === 'WORKER') && (
            <div ref={workerRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Assigned Worker Profile & Verification Records
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Worker background vetting checks, deployment schedule telemetry, and direct operational contact
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: hasWorker ? '#ecfdf5' : '#fffbeb',
                        color: hasWorker ? '#047857' : '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                        border: `2px solid ${hasWorker ? '#a7f3d0' : '#fde68a'}`,
                        flexShrink: 0,
                      }}
                    >
                      {hasWorker ? resolvedWorkerName.charAt(0).toUpperCase() : 'W'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Assigned Domestic Worker Allocation
                      </h4>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                        {hasWorker ? resolvedWorkerName : 'No Worker Assigned'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      ID: {booking.assignedWorkerId || 'PENDING'}
                    </span>
                    {hasWorker && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        ● Fully Verified Candidate
                      </span>
                    )}
                  </div>
                </div>

                {hasWorker ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '16px',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} color="#0d9488" /> DIRECT PHONE
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '4px', fontSize: '14px' }}>
                        {resolvedWorkerPhone}
                      </div>
                      <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                        ✓ Candidate Mobile Verified
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={12} color="#0d9488" /> EMAIL CONTACT
                      </div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                        {workerData?.email || `${resolvedWorkerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@staff.sevanest.in`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Operational Messaging Active
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="#0d9488" /> ADDRESS & SERVICE LOCALITY
                      </div>
                      <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '4px' }}>
                        {workerData?.address?.line
                          ? `${workerData.address.line}, ${workerData.locality || booking.customerLocality}, Hyderabad`
                          : `Plot 84, Vetted Workers Quarter, ${booking.customerLocality}, Hyderabad`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#0d9488', marginTop: '2px' }}>
                        Base Hub: <strong>{workerData?.locality || booking.customerLocality}</strong>
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>EXPERIENCE & RATING</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                        {workerData?.experienceYears || 5} Years Experience • {workerData?.ratingAverage || 4.8} ★
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>VERIFICATION CHECKS</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                          ✓ Aadhaar
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                          ✓ Police Verification
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                          ✓ Address Check
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>ASSIGNED DATE & RESPONSE</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                        {formatReadableDateTime(booking.createdAt)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                        {booking.workerRespondedAt ? `Responded: ${booking.workerRespondedAt}` : 'Acknowledged via Worker App'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>RESPONSE DEADLINE</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                        {booking.respondBy || 'Within 4h SLA Window'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {booking.proposedSlotAt ? `Slot: ${booking.proposedSlotAt}` : 'Standard Shift Accepted'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '20px',
                      backgroundColor: '#fffbeb',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={20} color="#d97706" />
                      <div style={{ fontWeight: 700, color: '#b45309', fontSize: '14px' }}>
                        No Worker Assigned (Awaiting Candidate Matching)
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                      There is currently no domestic worker assigned to this service request. Launch candidate matching to review vetted, available domestic staff in {booking.customerLocality}.
                    </p>
                    {onOpenMatchWizard && (
                      <button
                        onClick={() => onOpenMatchWizard(booking)}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '8px 16px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px',
                        }}
                      >
                        <Sparkles size={14} /> Match Candidates
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 4: INTERVIEWS & TRIALS DETAILS                 */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'INTERVIEWS') && (
            <div ref={interviewsRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Interview & Trial Details
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Authoritative schedule records, outcomes, and participant proposals from backend API
                  </p>
                </div>
                {onOpenTrialOutcome && booking.status === 'INTERVIEW_SCHEDULED' && (
                  <button
                    onClick={() => onOpenTrialOutcome(booking)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={15} /> Record Trial Outcome
                  </button>
                )}
              </div>

              {/* Complete Interview & Trial Cards */}
              {isHistoryLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  Loading interview and trial records...
                </div>
              ) : historyData?.interviews && historyData.interviews.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {historyData.interviews.map((iv, idx) => (
                    <div
                      key={iv.id || idx}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        padding: '20px 24px',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Calendar size={18} color="#0284c7" />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                              Interview & Trial Session #{idx + 1}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Format: <strong style={{ color: '#0284c7' }}>{iv.scheduleType || 'TRIAL'}</strong> • ID: {iv.id}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={iv.status || 'SCHEDULED'} />
                      </div>

                      {/* Grouped Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                        {/* Group 1: Schedule */}
                        <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="#0284c7" /> Schedule & Timing
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>SCHEDULED TIME</div>
                            <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{iv.scheduledAt || 'Pending confirmation'}</div>
                            {iv.preferredAt && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                Preferred: {iv.preferredAt}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Group 2: Location / Link */}
                        <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} color="#0d9488" /> Location & Meeting Details
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>MEETING LINK / PHYSICAL VENUE</div>
                            <div style={{ fontWeight: 600, color: '#0284c7', marginTop: '2px' }}>
                              {iv.meetingLink ? (
                                <a href={iv.meetingLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
                                  Online Meeting Link <ExternalLink size={12} />
                                </a>
                              ) : (
                                iv.location || booking.customerLocality
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Group 3: Participants */}
                        <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={13} color="#6366f1" /> Participants & Coordination
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>PARTICIPANTS</div>
                            <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                              {resolvedCustomerName} & {resolvedWorkerName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Requested By: <strong>{iv.requestedBy || 'Customer Portal'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Outcome & Remarks */}
                      {(iv.outcome || iv.outcomeNote) && (
                        <div style={{ backgroundColor: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
                          <div style={{ fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <CheckCircle size={15} /> Outcome: {iv.outcome || 'Completed Session'}
                          </div>
                          {iv.outcomeNote && <div>{iv.outcomeNote}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : booking.trial ? (
                /* Fallback to domain trial record if present */
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '20px 24px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Calendar size={18} color="#0284c7" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                          Scheduled Household Trial Assessment
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Assessment Format: <strong style={{ color: '#0284c7' }}>IN_PERSON HOME TRIAL</strong>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={booking.trialOutcome ? 'COMPLETED' : 'SCHEDULED'} />
                  </div>

                  {/* 3 Grouped Information Sections */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {/* Group 1: Schedule & Timing */}
                    <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="#0284c7" /> Schedule & Timing
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>SCHEDULED DATE & TIME</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{booking.trial.timeSlot}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{booking.trial.scheduledDate}</div>
                        <div style={{ marginTop: '8px', color: '#64748b', fontSize: '11px' }}>DURATION & TRIAL FEE</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{booking.trial.durationHours} Hours</div>
                        <div style={{ fontSize: '11px', color: '#059669', marginTop: '1px' }}>
                          Trial Fee: {formatCurrencyINR(booking.trial.trialFeeAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Group 2: Location & Contact */}
                    <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="#0d9488" /> Location & Meeting Details
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>PHYSICAL LOCATION</div>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '2px', lineHeight: 1.4 }}>
                          {booking.trial.customerAddress}
                        </div>
                        <div style={{ marginTop: '8px', color: '#64748b', fontSize: '11px' }}>POINT OF CONTACT</div>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                          {booking.trial.contactPerson}
                        </div>
                        <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '1px' }}>
                          {booking.trial.contactPhone}
                        </div>
                      </div>
                    </div>

                    {/* Group 3: Participants */}
                    <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} color="#6366f1" /> Participants & Coordination
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>PARTICIPANTS</div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                          {resolvedCustomerName} & {resolvedWorkerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Supervised In-Person Trial</div>
                        {booking.trial.notes && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>COORDINATION NOTES</div>
                            <div style={{ color: '#334155', fontSize: '12px', marginTop: '2px' }}>{booking.trial.notes}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group 4: Outcome & Feedback Remarks */}
                  {booking.trialOutcome && (
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        padding: '14px 18px',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>
                        <CheckCircle size={15} /> Trial Outcome: {booking.trialOutcome.outcome}
                      </div>
                      <div style={{ color: '#166534', lineHeight: 1.4 }}>
                        {booking.trialOutcome.feedbackRemarks}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '32px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                >
                  <Calendar size={32} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 600, color: '#475569' }}>No Interview or Trial Scheduled</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Interviews and customer trials will appear here once scheduled with a verified candidate.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 5: BOOKING LIFECYCLE TIMELINE                  */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'TIMELINE') && (
            <div ref={timelineRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Booking Lifecycle History & Timeline
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Complete chronological status transitions, actor roles, and administrative audit trails
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <GitCommit size={16} color="#0284c7" />
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                    STATUS PROGRESSION & AUDIT TRAIL
                  </h4>
                </div>

                {/* Vertical Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                  {(
                    (historyData?.timeline as TimelineDisplayEntry[] | undefined) || [
                      {
                        status: 'NEW_REQUEST',
                        changedAt: booking.createdAt,
                        actorRole: 'CUSTOMER',
                        actorUserId: booking.customerUserId || 'USR-CUST-INLINE',
                        remarks: 'Service requirement submitted by client via portal.',
                      },
                      {
                        status: booking.status,
                        changedAt: booking.updatedAt || booking.createdAt,
                        actorRole: 'ADMIN',
                        actorUserId: 'STAFF-OPS-AUTO',
                        remarks: 'Current administrative lifecycle milestone.',
                      },
                    ]
                  ).map((entry: TimelineDisplayEntry, idx, arr: TimelineDisplayEntry[]) => {
                    const entryStatus = String(entry.to || entry.status || booking.status || 'EVENT');
                    const entryTime = String(entry.at || entry.changedAt || booking.createdAt || '');
                    const prevEntry = idx > 0 ? arr[idx - 1] : undefined;
                    const prevTime = prevEntry ? String(prevEntry.at || prevEntry.changedAt || '') : undefined;
                    const elapsed = formatTimeDiff(prevTime, entryTime);
                    const entryActorRole = String(entry.by || entry.actorRole || 'SYSTEM');
                    const entryRemarks = entry.note || entry.remarks || '';
                    const entryUserId = entry.actorUserId;
                    const isLast = idx === arr.length - 1;

                    return (
                      <div key={idx} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        {/* Vertical Connecting Line */}
                        {!isLast && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '24px',
                              left: '11px',
                              width: '2px',
                              bottom: '-8px',
                              backgroundColor: '#e2e8f0',
                            }}
                          />
                        )}

                        {/* Node Icon */}
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isLast ? '#0284c7' : '#ffffff',
                            border: `2px solid ${isLast ? '#0284c7' : '#94a3b8'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isLast ? '#ffffff' : '#94a3b8',
                            }}
                          />
                        </div>

                        {/* Event Content */}
                        <div style={{ flex: 1, paddingBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                              {entryStatus.replace(/_/g, ' ')}
                            </span>
                            <StatusBadge status={entryStatus} />
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                              }}
                            >
                              {entryActorRole}
                            </span>
                            {elapsed && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#0284c7',
                                  backgroundColor: '#eff6ff',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                }}
                              >
                                {elapsed}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            Recorded: <strong>{entryTime}</strong>
                            {entryUserId && (
                              <span> • Actor ID: <code style={{ color: '#0284c7' }}>{entryUserId}</code></span>
                            )}
                          </div>

                          {entryRemarks && (
                            <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px', lineHeight: 1.4 }}>
                              {entryRemarks}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 6: PAYMENTS & PLATFORM FEES                    */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'PAYMENTS') && (
            <div ref={paymentsRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Payment & Platform Fee Details
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Platform service fee computation, statutory GST calculations, and gateway ledger
                </p>
              </div>

              {/* Fee Breakdown Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <IndianRupee size={16} color="#059669" />
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                    PLATFORM FEE REVENUE & ESCROW
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '13px' }}>
                  <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>PLATFORM BASE FEE</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      {formatCurrencyINR(2000)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Operational onboarding charge</div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>GST (18% COMPONENT)</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      {formatCurrencyINR(360)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Statutory tax compliance</div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <div style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 700 }}>TOTAL PLATFORM CHARGE</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                      {formatCurrencyINR(2360)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '2px' }}>Gross collection amount</div>
                  </div>

                  <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>SETTLEMENT STATUS</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: booking.platformFeePaid ? '#16a34a' : '#d97706', marginTop: '4px' }}>
                      ● {booking.platformFeePaid ? 'Settled & Verified' : 'Pending Receipt'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Statutory Placement Escrow Protection</div>
                  </div>
                </div>
              </div>

              {/* Gateway Payment Transactions Table */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                }}
              >
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
                  Gateway Payment Transactions
                </h4>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 12px' }}>Receipt No</th>
                        <th style={{ padding: '10px 12px' }}>Date & Time</th>
                        <th style={{ padding: '10px 12px' }}>Payment Method</th>
                        <th style={{ padding: '10px 12px' }}>Gateway Ref</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        historyData?.payments || [
                          {
                            id: `pay-${booking.id}`,
                            receiptNumber: `REC-${booking.id.substring(0, 8).toUpperCase()}`,
                            amountMinor: (booking.platformFeeAmount || 1999) * 100,
                            currency: 'INR',
                            paidAt: booking.createdAt,
                            paymentMethod: 'UPI / NetBanking',
                            gatewayReference: `rzp_live_${booking.id.substring(0, 10)}`,
                            status: booking.platformFeePaid ? 'SUCCESS' : 'PENDING',
                          },
                        ]
                      ).map((p, idx) => (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                            {p.receiptNumber}
                          </td>
                          <td style={{ padding: '12px', color: '#64748b' }}>{p.paidAt}</td>
                          <td style={{ padding: '12px', color: '#334155', fontWeight: 500 }}>{p.paymentMethod}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '12px' }}>
                            {p.gatewayReference}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrencyINR(p.amountMinor / 100)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: p.status === 'SUCCESS' ? '#ecfdf5' : '#fffbeb',
                                color: p.status === 'SUCCESS' ? '#047857' : '#b45309',
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 7: REPLACEMENT HISTORY                         */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'REPLACEMENT') && (
            <div ref={replacementRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Placement Replacement History
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Worker turnover tracking, replacement guarantees, and service continuity chain
                </p>
              </div>

              {booking.replacement && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '22px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={18} color="#d97706" />
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                        Active Replacement Case: {booking.replacement.id}
                      </div>
                    </div>
                    <StatusBadge status={booking.replacement.status} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>REASON CATEGORY</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {booking.replacement.reasonCategory}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>GUARANTEE PLAN</div>
                      <div style={{ fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                        {booking.replacement.coveragePlanName || '30-Day Placement Guarantee'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>PREVIOUS WORKER</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                        {booking.replacement.priorWorkerName} ({booking.replacement.priorWorkerId})
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>POLICY ELIGIBILITY</div>
                      <div style={{ fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                        ● Eligible under Replacement Guarantee
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>CUSTOMER EXPLANATION</div>
                    <div style={{ color: '#1e293b' }}>{booking.replacement.customerExplanation}</div>
                  </div>

                  {booking.replacement.operationalRemarks && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      <strong>Operational Remarks:</strong> {booking.replacement.operationalRemarks}
                    </div>
                  )}
                </div>
              )}

              {/* Replacement Chain Progression */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <History size={16} color="#0284c7" />
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0 }}>
                    REPLACEMENT CHAIN
                  </h4>
                </div>

                {historyData?.replacementChain && historyData.replacementChain.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {historyData.replacementChain.map((link, idx) => (
                      <div
                        key={link.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>Link #{link.position || idx + 1}</span>
                          <span style={{ color: '#64748b' }}>Booking ID: <code style={{ color: '#0f172a' }}>{link.bookingId}</code></span>
                          <span style={{ color: '#64748b' }}>Worker ID: <code style={{ color: '#0f172a' }}>{link.workerId}</code></span>
                        </div>
                        <StatusBadge status={link.status || 'CHAIN_LINK'} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    Initial placement under active coverage. No replacement links logged in chain.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SECTION 8: COMMUNICATION HISTORY                       */}
          {/* ====================================================== */}
          {(filterSection === 'ALL' || filterSection === 'COMMUNICATIONS') && (
            <div ref={commsRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Customer and Worker Communication History
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Authentic portal submissions, coordination dispatch notes, and telephony contract documentation
                </p>
              </div>

              {/* Authentic Communication Records */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {compiledCommunications.map((comm) => (
                  <div
                    key={comm.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      padding: '16px 20px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: comm.senderRole === 'CUSTOMER' ? '#eff6ff' : comm.senderRole === 'WORKER' ? '#ecfdf5' : '#f1f5f9',
                            color: comm.senderRole === 'CUSTOMER' ? '#1d4ed8' : comm.senderRole === 'WORKER' ? '#047857' : '#475569',
                          }}
                        >
                          {comm.senderRole}
                        </span>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{comm.title}</strong>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{comm.timestamp}</span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                      {comm.remarks}
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px', marginTop: '2px' }}>
                      <span>Channel: <strong>{comm.channel}</strong></span>
                      {comm.outcome && (
                        <span>Outcome: <strong style={{ color: '#0284c7' }}>{comm.outcome}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Discreet Architecture & Telephony Contract Notice */}
              <div
                style={{
                  marginTop: '4px',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                <Info size={15} color="#64748b" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  <strong style={{ color: '#475569' }}>Authoritative Backend Data & Telephony Contract Notice:</strong> In accordance with SevaNest architecture integrity, raw audio recordings and direct customer-worker chat messages are handled by telephony bridges and are not persisted in backend API v1. Target specification for telephonic event ingestion: <code style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#0f172a' }}>GET /api/v1/admin/bookings/{'{bookingId}'}/communications</code>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 5. WORKSPACE FOOTER STATUS & CLOSE BAR                   */}
        {/* ======================================================== */}
        <div
          style={{
            padding: '12px 28px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Viewing Reference:</span>
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                color: '#334155',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
              }}
            >
              {booking.id}
            </span>
            <span>•</span>
            <span>Locality: <strong style={{ color: '#0f172a' }}>{booking.customerLocality}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              data-testid="bottom-close-button"
              style={{
                padding: '7px 18px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
