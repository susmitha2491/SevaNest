/* global HTMLDivElement, HTMLTextAreaElement, KeyboardEvent */
import React, { useState, useEffect, useRef, useContext } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  User,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Briefcase,
  Lock,
  Send,
  Loader2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { SupportTicketDetail, SupportMessage } from '../domain/types';
import { supportRepository } from '../data/supportRepository';
import { workerRepository } from '../../workers/data/workerRepository';
import { customerRepository } from '../../customers/data/customerRepository';
import { bookingRepository } from '../../bookings/data/bookingRepository';
import {
  getWorkerName,
  setWorkerName,
  getCustomerName,
  setCustomerName,
  resolveWorkerName,
  resolveCustomerName,
} from '../../../core/utils/phoneDirectory';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { ConcurrencyConflictError } from '../../../core/errors/DomainError';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import { CustomSelect } from '../../../components/common/CustomSelect';

interface TicketDetailModalProps {
  ticket: SupportTicketDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResolve?: (ticket: SupportTicketDetail) => void;
  onOpenEscalate?: (ticket: SupportTicketDetail) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onOpenResolve,
  onOpenEscalate,
}) => {
  const queryClient = useQueryClient();
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user?.permissions, PERMISSIONS.SUPPORT_MANAGE);
  const canViewBookings = hasPermission(user?.permissions, PERMISSIONS.BOOKINGS_VIEW);

  const [messageText, setMessageText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Complainant Name Resolution (Worker or Customer)
  const isWorker = ticket?.complainantType === 'WORKER';
  const isCustomer = ticket?.complainantType === 'CUSTOMER';

  const rawTicketName = ticket?.complainantName?.trim();
  const hasSpecificTicketName = Boolean(
    rawTicketName &&
    rawTicketName !== 'Worker' &&
    rawTicketName !== 'Customer' &&
    rawTicketName !== 'User'
  );

  const compId = ticket?.complainantId;
  const directoryName = isWorker
    ? (getWorkerName(compId) || (ticket?.subjectWorkerId ? getWorkerName(ticket.subjectWorkerId) : undefined))
    : getCustomerName(compId);

  const subjectName = isWorker ? ticket?.subjectWorkerName : undefined;
  const candidateName = hasSpecificTicketName ? rawTicketName : (directoryName || subjectName);

  const targetWorkerId = (compId && compId !== 'U-00') ? compId : ticket?.subjectWorkerId;
  const shouldQueryWorker = Boolean(
    isOpen &&
    isWorker &&
    !candidateName &&
    targetWorkerId &&
    targetWorkerId !== 'U-00'
  );

  const { data: workerResolvedName } = useQuery({
    queryKey: ['workers', 'resolved-name', targetWorkerId],
    queryFn: async () => {
      const fromDir = await resolveWorkerName(targetWorkerId!);
      if (fromDir) return fromDir;
      const profile = await workerRepository.getWorkerById(targetWorkerId!).catch(() => null);
      return profile?.name;
    },
    enabled: shouldQueryWorker,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const shouldQueryCustomer = Boolean(
    isOpen &&
    isCustomer &&
    !candidateName &&
    compId &&
    compId !== 'U-00'
  );

  const { data: customerResolvedName } = useQuery({
    queryKey: ['customers', 'resolved-name', compId],
    queryFn: async () => {
      const fromDir = await resolveCustomerName(compId!);
      if (fromDir) return fromDir;
      const profile = await customerRepository.getCustomerById(compId!).catch(() => null);
      return profile?.name;
    },
    enabled: shouldQueryCustomer,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const shouldQueryBooking = Boolean(
    isOpen &&
    ticket?.bookingRef &&
    !candidateName &&
    !workerResolvedName &&
    !customerResolvedName
  );

  const { data: bookingDetail } = useQuery({
    queryKey: ['bookings', 'detail', ticket?.bookingRef],
    queryFn: () => bookingRepository.getBookingById(ticket!.bookingRef!).catch(() => null),
    enabled: shouldQueryBooking,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const resolvedWorkerName =
    candidateName ||
    workerResolvedName ||
    (bookingDetail as unknown as { workerName?: string })?.workerName ||
    (bookingDetail as unknown as { worker?: { name?: string } })?.worker?.name ||
    ticket?.subjectWorkerName;

  const resolvedCustomerName =
    candidateName ||
    customerResolvedName ||
    (bookingDetail as unknown as { customerName?: string })?.customerName ||
    (bookingDetail as unknown as { customer?: { name?: string } })?.customer?.name;

  const displayName = isWorker
    ? (resolvedWorkerName && resolvedWorkerName !== 'Worker' ? resolvedWorkerName : (ticket?.complainantName || 'Worker'))
    : (resolvedCustomerName && resolvedCustomerName !== 'Customer' ? resolvedCustomerName : (ticket?.complainantName || 'Customer'));

  useEffect(() => {
    if (workerResolvedName && targetWorkerId) {
      setWorkerName(targetWorkerId, workerResolvedName);
    }
  }, [workerResolvedName, targetWorkerId]);

  useEffect(() => {
    if (customerResolvedName && compId) {
      setCustomerName(compId, customerResolvedName);
    }
  }, [customerResolvedName, compId]);

  // Fetch Conversation Messages
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    isError: isMessagesError,
  } = useQuery({
    queryKey: ['support', 'messages', ticket?.id],
    queryFn: async () => {
      if (!ticket) return [];
      const fetched = await supportRepository.getTicketMessages(ticket.id);
      const list: SupportMessage[] =
        fetched && fetched.length > 0
          ? [...fetched]
          : ticket.messages && ticket.messages.length > 0
          ? [...ticket.messages]
          : [];

      if (ticket.caseNotes && ticket.caseNotes.length > 0) {
        const existingBodies = new Set(list.map((m) => m.body));
        ticket.caseNotes.forEach((cn, idx) => {
          if (!existingBodies.has(cn.noteText)) {
            list.push({
              id: cn.id || `case-note-${idx}`,
              ticketId: ticket.id,
              from: (cn.noteType === 'TELEPHONIC_LOG' ? 'CUSTOMER' : 'ADMIN') as 'CUSTOMER' | 'ADMIN',
              body: cn.noteText,
              createdAt: cn.timestamp,
              authorUserId: cn.authorName,
              internal: cn.noteType !== 'TELEPHONIC_LOG',
            });
            existingBodies.add(cn.noteText);
          }
        });
      }
      return list;
    },
    enabled: isOpen && Boolean(ticket?.id),
    refetchInterval: isOpen ? 6000 : false,
  });

  // Auto-scroll to bottom of conversation
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
    }
  }, [isOpen, messages.length]);

  // Send Message / Add Internal Note Mutation
  const sendMutation = useMutation({
    mutationFn: async ({ text, internal }: { text: string; internal: boolean }) => {
      if (!ticket || !text.trim()) return;
      return await supportRepository.sendTicketMessage(ticket.id, text.trim(), internal);
    },
    onSuccess: () => {
      setMessageText('');
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['support', 'messages', ticket?.id] });
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticket?.id] });
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => scrollToBottom(true), 100);
    },
    onError: (err: unknown) => {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 409) {
        setErrorMessage('Cannot send message: This support ticket has been closed or resolved.');
      } else {
        setErrorMessage((err as Error)?.message || 'Failed to send message. Please retry.');
      }
    },
  });

  // Priority Change Mutation
  const priorityMutation = useMutation({
    mutationFn: async (newPriority: 'LOW' | 'MEDIUM' | 'HIGH') => {
      if (!ticket) return;
      await supportRepository.setPriority(ticket.id, newPriority, ticket.etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticket?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setStaleWarning(null);
    },
    onError: (err: unknown) => {
      if (
        err instanceof ConcurrencyConflictError ||
        (err as { statusCode?: number })?.statusCode === 412 ||
        (err as { statusCode?: number })?.statusCode === 428
      ) {
        setStaleWarning(
          'This ticket was modified by another transaction (stale version). Data has been refreshed.'
        );
        queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
        queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticket?.id] });
      }
    },
  });

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticket) return null;

  const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  // SLA visual tokens
  const slaTheme =
    ticket.slaStatus === 'BREACHED'
      ? {
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#b91c1c',
          badgeBg: '#fee2e2',
          badgeText: '#991b1b',
          icon: <AlertTriangle size={14} color="#b91c1c" />,
        }
      : ticket.slaStatus === 'AT_RISK'
      ? {
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#b45309',
          badgeBg: '#fef3c7',
          badgeText: '#92400e',
          icon: <Clock size={14} color="#b45309" />,
        }
      : {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#15803d',
          badgeBg: '#dcfce7',
          badgeText: '#166534',
          icon: <CheckCircle2 size={14} color="#15803d" />,
        };

  const handleSendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed || sendMutation.isPending || isClosed) return;
    sendMutation.mutate({ text: trimmed, internal: isInternalNote });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-chat-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface, #ffffff)',
          borderRadius: '16px',
          maxWidth: '920px',
          width: '100%',
          height: '90vh',
          maxHeight: '850px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        {/* =========================================================================
            HEADER: Conversation Identity, Status, SLA & Primary Actions
            ========================================================================= */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-app, #f8fafc)',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: User Identity & Ticket Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: ticket.complainantType === 'CUSTOMER' ? '#e0f2fe' : '#f3e8ff',
                color: ticket.complainantType === 'CUSTOMER' ? '#0369a1' : '#7e22ce',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              {displayName ? displayName.charAt(0).toUpperCase() : (isWorker ? 'W' : 'C')}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2
                  id="ticket-chat-title"
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary, #0f172a)',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {displayName}
                </h2>
                <h3
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary, #64748b)',
                    margin: 0,
                  }}
                >
                  Grievance Case: {ticket.id}
                </h3>

                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 8px',
                    borderRadius: '9999px',
                    backgroundColor: ticket.complainantType === 'CUSTOMER' ? '#e0f2fe' : '#f3e8ff',
                    color: ticket.complainantType === 'CUSTOMER' ? '#0369a1' : '#7e22ce',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {ticket.complainantType}
                </span>

                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary, #64748b)',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  #{ticket.id}
                </span>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary, #64748b)',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span>{ticket.serviceCategory || 'Support'}</span>
                <span style={{ margin: '0 5px' }}>•</span>
                <span>{(ticket.disputeCategory || 'Grievance').replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Right: Status, Priority, SLA & Modal Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <StatusBadge status={ticket.status} />

            {/* Editable Priority if Open/In-Progress */}
            {!isClosed && canManage ? (
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <CustomSelect
                  value={ticket.priority || 'MEDIUM'}
                  onChange={(val) => priorityMutation.mutate(val as 'LOW' | 'MEDIUM' | 'HIGH')}
                  options={[
                    { value: 'LOW', label: 'Low Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'HIGH', label: 'High Priority' },
                  ]}
                  ariaLabel="Select ticket priority"
                  minWidth="120px"
                />
              </div>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                {ticket.priority} Priority
              </span>
            )}

            {/* Resolve Conversation Button */}
            {!isClosed && canManage && onOpenResolve && (
              <button
                type="button"
                aria-label="Mark Resolved"
                onClick={() => onOpenResolve(ticket)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #16a34a',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#15803d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#16a34a';
                }}
              >
                <CheckCircle2 size={13} />
                <span>Resolve Ticket</span>
              </button>
            )}

            {/* Escalate to Operations */}
            {!isClosed && canManage && onOpenEscalate && (
              <button
                type="button"
                aria-label="Escalate Ops"
                onClick={() => onOpenEscalate(ticket)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  backgroundColor: '#fff1f2',
                  color: '#be123c',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Escalate ticket to Operations Admin"
              >
                <ArrowUpRight size={13} />
                <span>Escalate Ops</span>
              </button>
            )}

            {/* Close Modal (X) */}
            <button
              type="button"
              data-testid="close-ticket-modal-button"
              onClick={onClose}
              aria-label="Close ticket modal"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-secondary, #64748b)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            CONTEXT RIBBON: Complainant details, Booking Ref & SLA Tracking
            ========================================================================= */}
        <div
          style={{
            padding: '8px 20px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--color-text-secondary, #475569)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Phone size={12} color="var(--color-primary, #0f766e)" />
              <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                {ticket.complainantPhoneMasked}
              </strong>
            </div>

            {/* Linked Booking */}
            {ticket.bookingRef && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Briefcase size={12} color="#64748b" />
                <span>
                  Booking:{' '}
                  {canViewBookings ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = `/bookings?search=${encodeURIComponent(ticket.bookingRef!)}`;
                        onClose();
                        if (navigationContext?.navigator) {
                          navigationContext.navigator.push(target);
                        } else if (typeof window !== 'undefined') {
                          window.location.assign(target);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--color-primary, #0f766e)',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '12px',
                      }}
                      title="Open linked booking in Booking Management"
                    >
                      {ticket.bookingRef}
                    </button>
                  ) : (
                    <strong style={{ color: 'var(--color-text-primary, #0f172a)', fontFamily: 'monospace' }}>
                      {ticket.bookingRef}
                    </strong>
                  )}
                </span>
              </div>
            )}

            {/* Subject Worker if available */}
            {ticket.subjectWorkerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={12} color="#64748b" />
                <span>
                  Worker:{' '}
                  <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                    {ticket.subjectWorkerName}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* SLA Tracking Pill & Intake Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: slaTheme.badgeBg,
                color: slaTheme.badgeText,
                fontSize: '11px',
                fontWeight: 600,
                border: `1px solid ${slaTheme.border}`,
              }}
            >
              {slaTheme.icon}
              <span>{ticket.slaRemainingText || `SLA: ${ticket.slaStatus}`}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              <Calendar size={11} style={{ opacity: 0.7 }} />
              <span>Intake: {formatDateTimeIST(ticket.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Stale Warning Banner */}
        {staleWarning && (
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{staleWarning}</span>
            <button
              type="button"
              onClick={() => setStaleWarning(null)}
              style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontWeight: 700 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================================
            CHAT CONVERSATION AREA: Chronological Timeline
            ========================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* 1. Original Grievance Statement from Complainant */}
          {ticket.description && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                maxWidth: '82%',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary, #64748b)',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{displayName}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>•</span>
                <span style={{ color: '#0369a1', fontWeight: 600 }}>Initial Grievance</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>•</span>
                <span>{formatDateTimeIST(ticket.createdAt)}</span>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '16px 16px 16px 4px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  fontSize: '13px',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ticket.description}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoadingMessages && messages.length === 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Loader2 size={24} className="animate-spin" color="var(--color-primary, #0f766e)" />
            </div>
          )}

          {/* Error Notice */}
          {isMessagesError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              Failed to load recent conversation messages. Real-time chat history may be delayed.
            </div>
          )}

          {/* 2. Chronological Conversation Messages */}
          {messages.map((msg: SupportMessage) => {
            // Case A: Internal Staff Note (Staff Only)
            if (msg.internal) {
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'center',
                    maxWidth: '85%',
                    width: '100%',
                    margin: '6px 0',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                      fontSize: '11px',
                      color: '#92400e',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
                      <Lock size={12} color="#b45309" />
                      <span>{msg.body.startsWith('Case Resolved:') ? 'Resolution Record (Internal)' : 'Internal Staff Note'}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#fef3c7',
                          color: '#78350f',
                          fontWeight: 600,
                        }}
                      >
                        Private • Staff-Only
                      </span>
                    </div>
                    <span>{formatDateTimeIST(msg.createdAt)}</span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {msg.body}
                  </div>
                </div>
              );
            }

            // Case B: Public Outgoing Reply from Support Executive
            if (msg.from === 'ADMIN') {
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    maxWidth: '80%',
                    alignSelf: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-secondary, #64748b)',
                      marginBottom: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#0f766e' }}>Support Team</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>•</span>
                    <span>{formatDateTimeIST(msg.createdAt)}</span>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-primary, #0f766e)',
                      color: '#ffffff',
                      borderRadius: '16px 16px 4px 16px',
                      boxShadow: '0 1px 3px rgba(15, 118, 110, 0.2)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.body}
                  </div>
                </div>
              );
            }

            // Case C: Public Incoming Message from Customer or Worker
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  maxWidth: '80%',
                  alignSelf: 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary, #64748b)',
                    marginBottom: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {ticket.complainantName} ({msg.from === 'WORKER' ? 'Worker' : 'Customer'})
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>•</span>
                  <span>{formatDateTimeIST(msg.createdAt)}</span>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    borderRadius: '16px 16px 16px 4px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.body}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* =========================================================================
            MESSAGE COMPOSER & CASE CONTROLS
            ========================================================================= */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          {/* Error Message Alert */}
          {errorMessage && (
            <div
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
              >
                ×
              </button>
            </div>
          )}

          {isClosed ? (
            /* Closed / Resolved Read-Only Banner */
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px dashed var(--color-border, #cbd5e1)',
                textAlign: 'center',
                color: 'var(--color-text-secondary, #64748b)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} color="#16a34a" />
              <span>
                This grievance case has been <strong>{ticket.status}</strong>. The conversation is archived and read-only.
              </span>
              <button
                type="button"
                data-testid="bottom-close-ticket-modal-button"
                onClick={onClose}
                style={{
                  marginLeft: '8px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          ) : !canManage ? (
            /* Read-Only Access Notice */
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: '#f8fafc',
                border: '1px dashed var(--color-border, #cbd5e1)',
                textAlign: 'center',
                color: 'var(--color-text-secondary, #64748b)',
                fontSize: '13px',
              }}
            >
              You do not have permission to send messages or add notes to this ticket.
            </div>
          ) : (
            /* Active Message Composer */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Mode Selector Tabs: Public Reply vs Internal Note */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsInternalNote(false)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: !isInternalNote ? 'var(--color-primary, #0f766e)' : 'transparent',
                    backgroundColor: !isInternalNote ? '#f0fdfa' : 'transparent',
                    color: !isInternalNote ? '#0f766e' : '#64748b',
                    fontSize: '11px',
                    fontWeight: !isInternalNote ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <MessageSquare size={12} />
                  <span>Reply to {ticket.complainantType === 'CUSTOMER' ? 'Customer' : 'Worker'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInternalNote(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isInternalNote ? '#d97706' : 'transparent',
                    backgroundColor: isInternalNote ? '#fffbeb' : 'transparent',
                    color: isInternalNote ? '#b45309' : '#64748b',
                    fontSize: '11px',
                    fontWeight: isInternalNote ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={12} />
                  <span>Internal Note (Staff-Only)</span>
                </button>
              </div>

              {/* Multiline Input & Send Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isInternalNote
                        ? 'Write an internal staff note...'
                        : `Type a response to ${displayName}...`
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isInternalNote
                        ? '1px solid #fde68a'
                        : '1px solid var(--color-border, #cbd5e1)',
                      backgroundColor: isInternalNote ? '#fffdf7' : '#ffffff',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      color: 'var(--color-text-primary, #0f172a)',
                      outline: 'none',
                      lineHeight: 1.45,
                      boxSizing: 'border-box',
                      resize: 'none',
                      minHeight: '56px',
                    }}
                    aria-label={isInternalNote ? 'Internal note text' : 'Support reply text'}
                  />
                </div>

                <button
                  type="button"
                  disabled={!messageText.trim() || sendMutation.isPending}
                  onClick={handleSendMessage}
                  aria-label={isInternalNote ? 'Log Note' : 'Send Message'}
                  style={{
                    height: '56px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: !messageText.trim()
                      ? '#e2e8f0'
                      : isInternalNote
                      ? '#d97706'
                      : 'var(--color-primary, #0f766e)',
                    color: !messageText.trim() ? '#94a3b8' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !messageText.trim() || sendMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sendMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>{isInternalNote ? 'Log Note' : 'Send'}</span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: 'var(--color-text-tertiary, #94a3b8)',
                  paddingLeft: '2px',
                }}
              >
                <span>
                  {isInternalNote
                    ? '🔒 Internal notes are audited and strictly hidden from customers and domestic workers.'
                    : '💬 Replies are dispatched directly to the complainant mobile application.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
