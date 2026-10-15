import React, { useState } from 'react';
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
} from 'lucide-react';
import { SupportTicketDetail, TicketCaseNote } from '../domain/types';
import { supportRepository } from '../data/supportRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';

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

  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<TicketCaseNote['noteType']>('TELEPHONIC_LOG');

  // Add Case Note Mutation
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
      setNewNoteText('');
    },
  });

  // Claim Ticket Mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!ticket) return;
      await supportRepository.claimTicket(ticket.id, 'Support Executive');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });

  if (!isOpen || !ticket) return null;

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
      aria-labelledby="ticket-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '92vh',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <h2
                id="ticket-modal-title"
                style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}
              >
                Grievance Case: {ticket.id}
              </h2>
              <StatusBadge status={ticket.status} />
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor:
                    ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                      ? 'var(--color-error-bg)'
                      : 'var(--color-brand-50)',
                  color:
                    ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                      ? 'var(--color-error-dark)'
                      : 'var(--color-brand-700)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Priority: {ticket.priority}
              </span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Category: <strong>{ticket.serviceCategory}</strong> • Assigned To: {ticket.assignedToStaffName || 'Unassigned'}
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
            aria-label="Close ticket modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: 'var(--space-6)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* SLA Tracking Status Banner */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor:
                ticket.slaStatus === 'BREACHED'
                  ? 'var(--color-error-bg)'
                  : ticket.slaStatus === 'AT_RISK'
                  ? 'var(--color-warning-bg)'
                  : 'var(--color-success-bg)',
              color:
                ticket.slaStatus === 'BREACHED'
                  ? 'var(--color-error-dark)'
                  : ticket.slaStatus === 'AT_RISK'
                  ? 'var(--color-warning-dark)'
                  : 'var(--color-success-dark)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Clock size={16} />
              <span>SLA Status: <strong>{ticket.slaStatus}</strong> ({ticket.slaRemainingText || 'Server-Reported Tracking'})</span>
            </div>
            <span>Intake: {ticket.createdAt}</span>
          </div>

          {/* Complainant & Subject Context Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                <User size={14} /> Complainant Profile ({ticket.complainantType})
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px', fontSize: 'var(--font-size-sm)' }}>
                {ticket.complainantName}
              </div>
              <div style={{ color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                {ticket.complainantId} • {ticket.complainantPhoneMasked}
              </div>
            </div>

            {ticket.subjectWorkerName && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                  <User size={14} /> Subject Domestic Worker
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px', fontSize: 'var(--font-size-sm)' }}>
                  {ticket.subjectWorkerName}
                </div>
                <div style={{ color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                  {ticket.subjectWorkerId}
                </div>
              </div>
            )}

            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Linked Service Booking:</div>
              <div style={{ fontWeight: 700, color: 'var(--color-brand-700)', fontFamily: 'monospace', marginTop: '2px' }}>
                {ticket.bookingRef || 'General Account Inquiry'}
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Dispute: {ticket.disputeCategory.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Grievance Statement */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Complainant Grievance Statement:
            </span>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {ticket.description}
            </p>
          </div>

          {/* Chronological Case Notes Timeline */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MessageSquare size={14} /> Case Activity & Telephonic Logs ({ticket.caseNotes.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {ticket.caseNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: note.noteType === 'TELEPHONIC_LOG' ? '#f0fdf4' : note.noteType === 'ESCALATION_SUMMARY' ? '#fff7ed' : '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <strong>{note.authorName}</strong>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>({note.authorRole})</span>
                    </div>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>{note.timestamp}</span>
                  </div>
                  <div style={{ color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                    {note.noteText}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Case Note Form */}
          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
            <div
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <PlusCircle size={14} /> Log Telephonic Finding / Internal Case Note
              </h4>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as TicketCaseNote['noteType'])}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <option value="TELEPHONIC_LOG">Telephonic Call Log</option>
                  <option value="INTERNAL_NOTE">Internal Staff Note</option>
                </select>
              </div>

              <textarea
                rows={2}
                placeholder="Enter details of conversation with customer or domestic worker..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'inherit',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  disabled={!newNoteText.trim() || addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate()}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: !newNoteText.trim() ? 'var(--color-text-tertiary)' : 'var(--color-brand-600)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: !newNoteText.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addNoteMutation.isPending ? 'Logging...' : 'Save Case Note'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle)',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(!ticket.assignedToStaffName || ticket.status === 'CREATED') && (
              <button
                onClick={() => claimMutation.mutate()}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-brand-600)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Claim Ticket
              </button>
            )}

            {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
              <>
                {onOpenResolve && (
                  <button
                    onClick={() => onOpenResolve(ticket)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-success-border)',
                      backgroundColor: 'var(--color-success-bg)',
                      color: 'var(--color-success-dark)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={13} /> Mark Resolved
                  </button>
                )}

                {onOpenReplacement && ticket.bookingRef && (
                  <button
                    onClick={() => onOpenReplacement(ticket)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
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
                    <RefreshCw size={13} /> Request Replacement
                  </button>
                )}

                {onOpenEscalate && (
                  <button
                    onClick={() => onOpenEscalate(ticket)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-error-dark)',
                      backgroundColor: 'var(--color-error-bg)',
                      color: 'var(--color-error-dark)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ArrowUpRight size={13} /> Escalate Ops
                  </button>
                )}
              </>
            )}
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
