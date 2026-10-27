import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  MapPin,
  CheckCircle,
  ShieldAlert,
  Eye,
  AlertCircle,
  Send,
  ExternalLink,
  ShieldCheck,
  Languages,
} from 'lucide-react';
import { customerRepository } from '../data/customerRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { PermissionGate } from '../../../core/rbac/PermissionGate';
import { PERMISSIONS } from '../../../core/rbac/permissions';

interface CustomerDetailModalProps {
  customerId: string;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customerId,
  onClose,
  onStatusChanged,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'complaints' | 'notes'>('profile');
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);

  // PII Reveal State
  const [isRevealDialogOpen, setIsRevealDialogOpen] = useState(false);
  const [revealReason, setRevealReason] = useState('');
  const [revealedPII, setRevealedPII] = useState<{ phone: string; email: string } | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  // New Note State
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const { data: customer, isLoading, refetch } = useQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn: () => customerRepository.getCustomerById(customerId),
  });

  const handleSuspendConfirm = async (remarks?: string) => {
    await customerRepository.suspendCustomer(customerId, remarks || 'Operational account suspension');
    setIsSuspendOpen(false);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    onStatusChanged?.();
  };

  const handleReactivate = async () => {
    await customerRepository.reactivateCustomer(customerId);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    onStatusChanged?.();
  };

  const handleRevealPIIConfirm = async () => {
    if (!revealReason.trim() || revealReason.trim().length < 5) {
      setRevealError('A detailed operational rationale is mandatory (minimum 5 characters).');
      return;
    }
    try {
      setIsRevealing(true);
      setRevealError(null);
      const res = await customerRepository.revealPII(customerId, revealReason.trim());
      setRevealedPII(res);
      setIsRevealDialogOpen(false);
      setRevealReason('');
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve unmasked contact from backend.';
      setRevealError(msg);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || newNoteText.trim().length < 3) {
      setNoteError('Note must be at least 3 characters.');
      return;
    }

    try {
      setIsSavingNote(true);
      setNoteError(null);
      await customerRepository.addCustomerNote(customerId, newNoteText.trim());
      setNewNoteText('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to persist operational note.';
      setNoteError(msg);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)' }}>
          <LoadingSpinner message="Loading customer dossier..." />
        </div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const effectivePhone = revealedPII?.phone || customer.unmaskedPhone || customer.maskedPhone;
  const effectiveEmail = revealedPII?.email || customer.unmaskedEmail || customer.maskedEmail;
  const isPIIRevealed = Boolean(revealedPII || customer.unmaskedPhone || customer.unmaskedEmail);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--color-border-subtle)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {customer.name}
                </h2>
                <StatusBadge status={customer.status} />
                <VerificationBadge
                  isFullyVerified={customer.verificationStatus === 'VERIFIED'}
                  status={customer.verificationStatus || 'PENDING'}
                />
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontFamily: 'monospace', fontWeight: 600 }}>
                {customer.id} • Registered {customer.registeredDate}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dossier"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: 'var(--space-1)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-subtle)',
            padding: '0 var(--space-6)',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'profile', label: '1. Profile & Household' },
            { key: 'bookings', label: `2. Bookings & History (${customer.bookings.length})` },
            { key: 'complaints', label: `3. Support & Complaints (${customer.complaints?.length || customer.openGrievances || 0})` },
            { key: 'notes', label: `4. Operational Notes (${customer.notes.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* TAB 1: PROFILE & OVERVIEW */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Quick Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Total Bookings</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{customer.totalBookings}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Active Service</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-accent)' }}>{customer.activeBookings}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Total Platform Spend</div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCurrencyINR(customer.totalSpendINR)}</div>
                </div>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Open Grievances</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: customer.openGrievances > 0 ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)' }}>
                    {customer.openGrievances}
                  </div>
                </div>
              </div>

              {/* Contact & Address Section */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Household Contact & Locality Details
                  </h3>
                  <PermissionGate permission={PERMISSIONS.CUSTOMERS_MANAGE}>
                    {!isPIIRevealed ? (
                      <button
                        onClick={() => setIsRevealDialogOpen(true)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border-subtle)',
                          color: 'var(--color-accent)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={12} />
                        <span>Reveal Contact Details</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--color-status-success-text)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ShieldCheck size={12} />
                        <span>Verified Unmasked Contact</span>
                      </span>
                    )}
                  </PermissionGate>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Phone Number:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                      {effectivePhone}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Email Address:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                      {effectiveEmail}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <MapPin size={13} /> Registered Locality & Address:
                    </span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>
                      {customer.fullAddress} ({customer.locality} Cluster)
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <Languages size={13} /> Preferred Communication:
                    </span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                      {customer.preferredLanguage || 'English (Standard)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Historical Service Engagements & Requests preview in Profile tab */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Historical Service Engagements & Requests
                  </h3>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    View All ({customer.bookings.length}) <ExternalLink size={12} />
                  </button>
                </div>
                <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Booking Ref</th>
                        <th style={{ padding: '8px 12px' }}>Service Category</th>
                        <th style={{ padding: '8px 12px' }}>Assigned Domestic Worker</th>
                        <th style={{ padding: '8px 12px' }}>Operational Status</th>
                        <th style={{ padding: '8px 12px' }}>Timeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.bookings.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                            No booking engagements on record for this customer.
                          </td>
                        </tr>
                      ) : (
                        customer.bookings.slice(0, 5).map((b) => (
                          <tr key={b.bookingId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                              {b.bookingId}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                              {b.category}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                              {b.workerName || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pending Match</span>}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusBadge status={b.status} />
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                              {b.date}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOOKINGS & SERVICE HISTORY */}
          {activeTab === 'bookings' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Historical Service Engagements & Requests
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Total: {customer.bookings.length} Records
                  </span>
                  <Link
                    to={`/bookings?search=${customer.id}`}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Open in Booking Management</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Booking Ref</th>
                      <th style={{ padding: '8px 12px' }}>Service Category</th>
                      <th style={{ padding: '8px 12px' }}>Assigned Domestic Worker</th>
                      <th style={{ padding: '8px 12px' }}>Operational Status</th>
                      <th style={{ padding: '8px 12px' }}>Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.bookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                          No booking engagements on record for this customer.
                        </td>
                      </tr>
                    ) : (
                      customer.bookings.map((b) => (
                        <tr key={b.bookingId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                            {b.bookingId}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                            {b.category}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                            {b.workerName || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pending Match</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusBadge status={b.status} />
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {b.date}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SUPPORT & COMPLAINTS */}
          {activeTab === 'complaints' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Customer Complaints & Grievance Tickets
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Household grievances, dispute escalations, and warranty replacement requests.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: customer.openGrievances > 0 ? 'var(--color-status-danger-bg)' : 'var(--color-status-success-bg)',
                      color: customer.openGrievances > 0 ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)',
                    }}
                  >
                    {customer.openGrievances} Open Grievances
                  </span>
                  <Link
                    to={`/support?searchTerm=${customer.id}`}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Open in Support Console</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Ticket ID</th>
                      <th style={{ padding: '8px 12px' }}>Dispute Category</th>
                      <th style={{ padding: '8px 12px' }}>Associated Service</th>
                      <th style={{ padding: '8px 12px' }}>Grievance Status</th>
                      <th style={{ padding: '8px 12px' }}>Date Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!customer.complaints || customer.complaints.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                          No support complaints or dispute tickets recorded for this customer.
                        </td>
                      </tr>
                    ) : (
                      customer.complaints.map((c) => (
                        <tr key={c.ticketId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                            {c.ticketId}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            <div>{c.disputeCategory}</div>
                            {c.description && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', fontWeight: 400 }}>
                                {c.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {c.serviceCategory || 'Platform Engagement'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusBadge status={c.status} />
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {c.createdAt}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: OPERATIONAL NOTES */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                  Operational & Case Notes
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                  Immutable notes ledger for customer preferences, account warnings, and staff audit history.
                </p>
                {customer.notes.length === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    No operational notes recorded for this customer yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {customer.notes.map((note, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                          borderLeft: '3px solid var(--color-accent)',
                        }}
                      >
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Note Form */}
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                  Record New Operational Note
                </h4>
                <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <textarea
                    rows={3}
                    placeholder="Enter operational note, customer feedback, or case update..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    aria-label="New operational note text"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-primary)',
                      resize: 'vertical',
                    }}
                  />
                  {noteError && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-danger-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />
                      <span>{noteError}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={isSavingNote || !newNoteText.trim()}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600, var(--color-primary))',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: isSavingNote || !newNoteText.trim() ? 'not-allowed' : 'pointer',
                        opacity: isSavingNote || !newNoteText.trim() ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Send size={12} />
                      <span>{isSavingNote ? 'Saving...' : 'Save Note'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <PermissionGate permission={PERMISSIONS.CUSTOMERS_MANAGE_STATUS}>
            {customer.status === 'ACTIVE' ? (
              <button
                onClick={() => setIsSuspendOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-danger-bg)',
                  color: 'var(--color-status-danger-text)',
                  border: '1px solid var(--color-status-danger-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldAlert size={14} />
                <span>Suspend Customer Account</span>
              </button>
            ) : (
              <button
                onClick={handleReactivate}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-success-bg)',
                  color: 'var(--color-status-success-text)',
                  border: '1px solid var(--color-status-success-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle size={14} />
                <span>Restore / Reactivate Account</span>
              </button>
            )}
          </PermissionGate>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* PII Reveal Dialog */}
      {isRevealDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 'var(--space-4)',
          }}
          onClick={() => setIsRevealDialogOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '480px',
              width: '100%',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              border: '1px solid var(--color-border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldAlert size={22} color="var(--color-accent)" />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Audited Contact PII Disclosure
              </h3>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Access to full unmasked phone numbers and emails is recorded in the administrative compliance ledger. Please supply your operational justification.
            </p>
            <div>
              <label htmlFor="reveal-reason-input" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                Operational Rationale (Mandatory)
              </label>
              <textarea
                id="reveal-reason-input"
                rows={3}
                placeholder="e.g., Direct dispute resolution call requested by customer..."
                value={revealReason}
                onChange={(e) => setRevealReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {revealError && (
                <span style={{ fontSize: '11px', color: 'var(--color-status-danger-text)', marginTop: '4px', display: 'block' }}>
                  {revealError}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setIsRevealDialogOpen(false)}
                disabled={isRevealing}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevealPIIConfirm}
                disabled={isRevealing || !revealReason.trim()}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: isRevealing || !revealReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: isRevealing || !revealReason.trim() ? 0.6 : 1,
                }}
              >
                {isRevealing ? 'Authorizing...' : 'Confirm & Reveal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendOpen}
        title={`Suspend Customer Account: ${customer.name}`}
        description="Suspended customers are blocked from submitting new booking requests across the platform."
        confirmLabel="Confirm Suspension"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory suspension reason (e.g., Repeated payment chargeback dispute)..."
        onConfirm={handleSuspendConfirm}
        onCancel={() => setIsSuspendOpen(false)}
      />
    </div>
  );
};
