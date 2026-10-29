export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusDescriptor {
  label: string;
  variant: StatusVariant;
  description?: string;
}

/**
 * Canonical Status Label Mapping Table (Source Architecture Page 9).
 * Converts backend enum values into standardized administrative display labels and semantic variants.
 */
export const STATUS_MAPPINGS: Record<string, StatusDescriptor> = {
  // Verification Domain
  PENDING_REVIEW: { label: 'Pending review', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', variant: 'warning' },
  IN_REVIEW: { label: 'In review', variant: 'info' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  RECHECK_DUE: { label: 'Re-check due', variant: 'warning' },

  // Worker Domain
  ACTIVE: { label: 'Active', variant: 'success' },
  SUSPENDED: { label: 'Suspended', variant: 'danger' },
  BLACKLISTED: { label: 'Blacklisted', variant: 'danger' },

  // Booking Domain
  REQUESTED: { label: 'New request', variant: 'info' },
  NEW_REQUEST: { label: 'New request', variant: 'info' },
  MATCHING_IN_PROGRESS: { label: 'Matching in progress', variant: 'info' },
  INTERVIEW_SCHEDULED: { label: 'Interview set', variant: 'info' },
  INTERVIEW_TRIAL_SCHEDULED: { label: 'Interview set', variant: 'info' },
  TRIAL_SCHEDULED: { label: 'Interview set', variant: 'info' },
  CONFIRMED: { label: 'Worker confirmed', variant: 'success' },
  WORKER_CONFIRMED: { label: 'Worker confirmed', variant: 'success' },
  SERVICE_ACTIVE: { label: 'Service active', variant: 'success' },
  REPLACEMENT_REQUESTED: { label: 'Replacement review', variant: 'warning' },
  REPLACEMENT_REVIEW: { label: 'Replacement review', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },

  // Payment Domain
  PAID: { label: 'Paid', variant: 'success' },
  PAYMENT_FAILED: { label: 'Payment failed', variant: 'danger' },
  REFUND_PENDING: { label: 'Refund pending', variant: 'warning' },
  REFUNDED: { label: 'Refunded', variant: 'neutral' },

  // Support Ticket Domain
  CREATED: { label: 'Created', variant: 'neutral' },
  ASSIGNED: { label: 'Assigned', variant: 'info' },
  IN_PROGRESS: { label: 'In progress', variant: 'info' },
  ESCALATED: { label: 'Escalated', variant: 'danger' },
  SLA_BREACHED: { label: 'SLA breached', variant: 'danger' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'neutral' },
};

export function getStatusDescriptor(statusKey: string): StatusDescriptor {
  const normalized = statusKey.toUpperCase().replace(/[\s/-]+/g, '_');
  return (
    STATUS_MAPPINGS[normalized] || {
      label: statusKey.replace(/_/g, ' '),
      variant: 'neutral',
    }
  );
}
