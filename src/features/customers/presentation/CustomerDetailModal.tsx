import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MapPin, CheckCircle, ShieldAlert } from 'lucide-react';
import { customerRepository } from '../data/customerRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
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
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);

  const { data: customer, isLoading, refetch } = useQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn: () => customerRepository.getCustomerById(customerId),
  });

  const handleSuspendConfirm = async (remarks?: string) => {
    await customerRepository.suspendCustomer(customerId, remarks || 'Operational account suspension');
    setIsSuspendOpen(false);
    refetch();
    onStatusChanged?.();
  };

  const handleReactivate = async () => {
    await customerRepository.reactivateCustomer(customerId);
    refetch();
    onStatusChanged?.();
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
          maxWidth: '780px',
          maxHeight: '90vh',
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

        {/* Content Body */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Top Quick Metrics */}
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Phone Number:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {customer.unmaskedPhone || customer.maskedPhone}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Email Address:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {customer.unmaskedEmail || customer.maskedEmail}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 'var(--font-size-sm)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <MapPin size={13} /> Registered Locality & Address:
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {customer.fullAddress} ({customer.locality} Cluster)
              </span>
            </div>
          </div>

          {/* Booking History Table */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
              Historical Service Engagements & Requests
            </h3>
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
                  {customer.bookings.map((b) => (
                    <tr key={b.bookingId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{b.bookingId}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{b.category}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                        {b.workerName || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pending Match</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={b.status} />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{b.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Notes */}
          {customer.notes.length > 0 && (
            <div>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                Operational & Case Notes
              </h3>
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
