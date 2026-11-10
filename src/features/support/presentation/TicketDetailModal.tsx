import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  User,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  MessageSquare,
  PhoneCall,
  FileText,
  AlertTriangle,
  Inbox,
  Calendar,
  UserCheck,
  Hash,
  Bookmark,
} from 'lucide-react';
import { SupportTicketDetail, TicketCaseNote } from '../domain/types';
import { supportRepository } from '../data/supportRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { ConcurrencyConflictError } from '../../../core/errors/DomainError';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

interface TicketDetailModalProps {
  ticket: SupportTicketDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResolve?: (ticket: SupportTicketDetail) => void;
  onOpenEscalate?: (ticket: SupportTicketDetail) => void;
  onOpenReplacement?: (ticket: SupportTicketDetail) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onOpenResolve,
  onOpenEscalate,
  onOpenReplacement,
}) => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user?.permissions, PERMISSIONS.SUPPORT_MANAGE);

  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<TicketCaseNote['noteType']>('TELEPHONIC_LOG');
  const [staleWarning, setStaleWarning] = useState<string | null>(null);

  // Add Case Note Mutation (internal note / telephonic log)
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!ticket || !newNoteText.trim()) return;
      await supportRepository.addCaseNote(
        ticket.id,
        newNoteText.trim(),
        newNoteType,
        'Support Executive'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewNoteText('');
      setStaleWarning(null);
    },
  });

  // Priority Change Mutation (sends If-Match with ticket.etag)
  const priorityMutation = useMutation({
    mutationFn: async (newPriority: 'LOW' | 'MEDIUM' | 'HIGH') => {
      if (!ticket) return;
      await supportRepository.setPriority(ticket.id, newPriority, ticket.etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
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
          'This ticket was modified by another transaction (stale version). Latest ticket data has been refetched. Please review and retry.'
        );
        queryClient.invalidateQueries({ queryKey: ['support'] });
      }
    },
  });

  // Claim Ticket Mutation (sends If-Match with ticket.etag)
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!ticket) return;
      await supportRepository.claimTicket(ticket.id, 'Support Executive', ticket.etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
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
          'This ticket was modified by another user (stale version). Data has been refreshed. Please retry claiming.'
        );
        queryClient.invalidateQueries({ queryKey: ['support'] });
      }
    },
  });

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticket) return null;

  // Visual configuration for SLA States
  const slaTheme =
    ticket.slaStatus === 'BREACHED'
      ? {
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#b91c1c',
          badgeBg: '#fee2e2',
          badgeText: '#991b1b',
          icon: <AlertTriangle size={16} color="#b91c1c" />,
        }
      : ticket.slaStatus === 'AT_RISK'
      ? {
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#b45309',
          badgeBg: '#fef3c7',
          badgeText: '#92400e',
          icon: <Clock size={16} color="#b45309" />,
        }
      : {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#15803d',
          badgeBg: '#dcfce7',
          badgeText: '#166534',
          icon: <CheckCircle2 size={16} color="#15803d" />,
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
        padding: 'var(--space-4)',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface, #ffffff)',
          borderRadius: 'var(--radius-xl, 16px)',
          maxWidth: '860px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* =========================================================================
            HEADER (Compact & Clean)
            ========================================================================= */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-app, #f8fafc)',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2
                id="ticket-modal-title"
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: 'var(--color-navy, #0f172a)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Grievance Case: {ticket.id}
              </h2>

              <StatusBadge status={ticket.status} />

              {/* Priority Selector / Badge */}
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'var(--color-bg-surface, #ffffff)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <label
                    htmlFor="ticket-priority-select"
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    Priority:
                  </label>
                  <select
                    id="ticket-priority-select"
                    value={ticket.priority === 'CRITICAL' ? 'HIGH' : ticket.priority}
                    disabled={!canManage || priorityMutation.isPending}
                    onChange={(e) => {
                      const val = e.target.value as 'LOW' | 'MEDIUM' | 'HIGH';
                      priorityMutation.mutate(val);
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '11px',
                      fontWeight: 700,
                      color:
                        ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                          ? 'var(--color-status-danger-text, #b91c1c)'
                          : 'var(--color-brand-primary, #0d9488)',
                      cursor: canManage ? 'pointer' : 'default',
                      padding: 0,
                      outline: 'none',
                    }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              ) : (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor:
                      ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                        ? 'var(--color-status-danger-bg, #fee2e2)'
                        : 'var(--color-brand-50, #f0fdfa)',
                    color:
                      ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                        ? 'var(--color-status-danger-text, #b91c1c)'
                        : 'var(--color-brand-primary, #0d9488)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Priority: {ticket.priority}
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary, #64748b)',
                marginTop: '3px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>
                Category: <strong>{ticket.serviceCategory}</strong>
              </span>
              <span>•</span>
              <span>
                Ticket Owner: <strong>{ticket.assignedToStaffName || 'Unassigned'}</strong>
              </span>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #64748b)',
              padding: '6px',
              borderRadius: 'var(--radius-md, 8px)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            aria-label="Close ticket modal"
            data-testid="close-ticket-modal-button"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-border-subtle, #e2e8f0)';
              e.currentTarget.style.color = 'var(--color-text-primary, #0f172a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary, #64748b)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* =========================================================================
            SCROLLABLE BODY
            ========================================================================= */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Stale Concurrency Conflict Alert */}
          {staleWarning && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-status-warning-border, #fde68a)',
                backgroundColor: 'var(--color-status-warning-bg, #fffbeb)',
                color: 'var(--color-status-warning-text, #b45309)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={15} />
                <span>{staleWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => setStaleWarning(null)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: '1px solid #d97706',
                  backgroundColor: 'transparent',
                  color: '#92400e',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =====================================================================
              SECTION 1: SLA INFORMATION (Distinct States & IST Timestamp)
              ===================================================================== */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-lg, 12px)',
              border: `1px solid ${slaTheme.border}`,
              backgroundColor: slaTheme.bg,
              color: slaTheme.text,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {slaTheme.icon}
              <span>
                SLA Status: <strong>{ticket.slaStatus}</strong>
              </span>
              <span
                style={{
                  padding: '1px 8px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: '11px',
                  backgroundColor: slaTheme.badgeBg,
                  color: slaTheme.badgeText,
                  fontWeight: 700,
                }}
              >
                {ticket.slaRemainingText || 'Server-Reported Tracking'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <Calendar size={13} style={{ opacity: 0.8 }} />
              <span>
                Intake: <strong>{formatDateTimeIST(ticket.createdAt)}</strong>
              </span>
            </div>
          </div>

          {/* =====================================================================
              SECTION 2: CUSTOMER & BOOKING INFORMATION (Two-Column Layout)
              ===================================================================== */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-secondary, #64748b)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <User size={13} /> Customer & Linked Booking Information
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Column 1: Customer Profile */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--color-bg-app, #f8fafc)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary, #64748b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Complainant Profile</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      backgroundColor: 'var(--color-border-subtle, #e2e8f0)',
                      color: 'var(--color-text-secondary, #475569)',
                      fontWeight: 700,
                    }}
                  >
                    {ticket.complainantType}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary, #0f172a)',
                  }}
                >
                  {ticket.complainantName}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-brand-primary, #0d9488)',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Hash size={12} />
                  <span>{ticket.complainantId}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>•</span>
                  <span>{ticket.complainantPhoneMasked}</span>
                </div>

                {/* Subject Domestic Worker if applicable */}
                {ticket.subjectWorkerName && (
                  <div
                    style={{
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--color-border)',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-secondary)' }}>Subject Worker: </span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{ticket.subjectWorkerName}</strong>
                    {ticket.subjectWorkerId && (
                      <span style={{ color: 'var(--color-brand-primary)', fontFamily: 'monospace', marginLeft: '4px' }}>
                        ({ticket.subjectWorkerId})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Column 2: Booking & Dispute Information */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--color-bg-app, #f8fafc)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
                  Linked Service Booking
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-brand-primary, #0d9488)',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Bookmark size={13} />
                  <span>{ticket.bookingRef || 'General Account Inquiry'}</span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #475569)', marginTop: '2px' }}>
                  Dispute:{' '}
                  <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                    {(ticket.disputeCategory || (ticket as { category?: string }).category || 'DISPUTE').replace(/_/g, ' ')}
                  </strong>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                  Service Category: <strong>{ticket.serviceCategory || 'Domestic Service'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              SECTION 3: CUSTOMER COMPLAINT
              ===================================================================== */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-secondary, #64748b)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FileText size={13} /> Complainant Grievance Statement:
            </div>

            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-primary, #0f172a)',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ticket.description}
              </p>
            </div>
          </div>

          {/* =====================================================================
              SECTION 4: CASE ACTIVITY & COMMUNICATION HISTORY (Chronological IST)
              ===================================================================== */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <MessageSquare size={13} /> Case Activity & Telephonic Logs ({ticket.caseNotes.length})
              </div>
            </div>

            {ticket.caseNotes.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-bg-app, #f8fafc)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary, #64748b)',
                  fontSize: '12px',
                }}
              >
                <Inbox size={22} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.5 }} />
                <span>No case activity or telephonic logs recorded yet for this grievance.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ticket.caseNotes.map((note) => {
                  const isTelephonic = note.noteType === 'TELEPHONIC_LOG';
                  const isEscalation = note.noteType === 'ESCALATION_SUMMARY';
                  const isResolution = note.noteType === 'RESOLUTION_SUMMARY';

                  const noteTheme = isTelephonic
                    ? {
                        bg: '#f0fdf4',
                        border: '#bbf7d0',
                        badgeBg: '#dcfce7',
                        badgeText: '#15803d',
                        label: 'Telephonic Call Log',
                        icon: <PhoneCall size={12} color="#15803d" />,
                      }
                    : isEscalation
                    ? {
                        bg: '#fff7ed',
                        border: '#fed7aa',
                        badgeBg: '#ffedd5',
                        badgeText: '#c2410c',
                        label: 'Escalation Handoff',
                        icon: <ArrowUpRight size={12} color="#c2410c" />,
                      }
                    : isResolution
                    ? {
                        bg: '#f0fdfa',
                        border: '#99f6e4',
                        badgeBg: '#ccfbf1',
                        badgeText: '#0f766e',
                        label: 'Resolution Note',
                        icon: <CheckCircle2 size={12} color="#0f766e" />,
                      }
                    : {
                        bg: '#f8fafc',
                        border: '#e2e8f0',
                        badgeBg: '#f1f5f9',
                        badgeText: '#475569',
                        label: 'Internal Staff Note',
                        icon: <FileText size={12} color="#475569" />,
                      };

                  return (
                    <div
                      key={note.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: noteTheme.bg,
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: `1px solid ${noteTheme.border}`,
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full, 9999px)',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: noteTheme.badgeBg,
                              color: noteTheme.badgeText,
                            }}
                          >
                            {noteTheme.icon}
                            <span>{noteTheme.label}</span>
                          </span>
                          <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                            {note.authorName}
                          </strong>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '11px' }}>
                            ({note.authorRole})
                          </span>
                        </div>

                        {/* Localized IST Timestamp */}
                        <div
                          style={{
                            color: 'var(--color-text-secondary, #64748b)',
                            fontSize: '11px',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={11} style={{ opacity: 0.7 }} />
                          <span>{formatDateTimeIST(note.timestamp)}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          color: 'var(--color-text-primary, #0f172a)',
                          lineHeight: 1.55,
                          fontSize: '12px',
                        }}
                      >
                        {note.noteText}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =====================================================================
              SECTION 5: ADD CASE NOTE
              ===================================================================== */}
          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && canManage && (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-bg-app, #f8fafc)',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary, #0f172a)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <PlusCircle size={14} color="var(--color-brand-primary, #0d9488)" />
                <span>Log Telephonic Finding / Internal Case Note</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as TicketCaseNote['noteType'])}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    backgroundColor: 'var(--color-bg-surface, #ffffff)',
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                  }}
                  aria-label="Select case note type"
                >
                  <option value="TELEPHONIC_LOG">Telephonic Call Log</option>
                  <option value="INTERNAL_NOTE">Internal Staff Note</option>
                </select>
              </div>

              <textarea
                rows={3}
                placeholder="Enter details of conversation with customer or domestic worker, mediation updates, or call findings..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--color-bg-surface, #ffffff)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                aria-label="Case note text"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={!newNoteText.trim() || addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate()}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: 'none',
                    backgroundColor: !newNoteText.trim()
                      ? 'var(--color-border-subtle, #cbd5e1)'
                      : 'var(--color-brand-primary, #0d9488)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: !newNoteText.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {addNoteMutation.isPending ? 'Logging...' : 'Save Case Note'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            FOOTER – CASE ACTIONS (Consistent Hierarchy & Alignment)
            ========================================================================= */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-app, #f8fafc)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {canManage && (!ticket.assignedToStaffName || ticket.status === 'CREATED') && (
              <button
                type="button"
                onClick={() => claimMutation.mutate()}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-brand-primary, #0d9488)',
                  backgroundColor: 'var(--color-brand-primary, #0d9488)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
                }}
              >
                <UserCheck size={14} />
                <span>Claim Ticket</span>
              </button>
            )}

            {canManage && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
              <>
                {onOpenResolve && (
                  <button
                    type="button"
                    onClick={() => onOpenResolve(ticket)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid #16a34a',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Mark Resolved</span>
                  </button>
                )}

                {onOpenReplacement && ticket.bookingRef && (
                  <button
                    type="button"
                    onClick={() => onOpenReplacement(ticket)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid #d97706',
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Request Replacement</span>
                  </button>
                )}

                {onOpenEscalate && (
                  <button
                    type="button"
                    onClick={() => onOpenEscalate(ticket)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid #e11d48',
                      backgroundColor: '#fff1f2',
                      color: '#be123c',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ArrowUpRight size={14} />
                    <span>Escalate Ops</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Close Action */}
          <button
            type="button"
            onClick={onClose}
            data-testid="bottom-close-ticket-modal-button"
            style={{
              padding: '7px 18px',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface, #ffffff)',
              color: 'var(--color-text-primary, #0f172a)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, #f1f5f9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-surface, #ffffff)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
