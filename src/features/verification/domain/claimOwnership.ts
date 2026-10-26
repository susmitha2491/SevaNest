import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

export interface ClaimOwnership {
  status: 'UNCLAIMED' | 'CLAIMED_BY_YOU' | 'CLAIMED_BY_OTHER' | 'UNAVAILABLE';
  label: string;
  badgeStyle: {
    backgroundColor: string;
    color: string;
    border?: string;
  };
  claimedAtFormatted?: string;
}

export function resolveClaimOwnership(
  reviewerUserId: string | undefined,
  claimedAt: string | undefined,
  currentUserId: string | undefined
): ClaimOwnership {
  const claimedAtFormatted = claimedAt ? formatDateTimeIST(claimedAt) : undefined;

  // Unclaimed: only when the backend data confirms there is no claim (neither reviewerUserId nor claimedAt)
  if (!reviewerUserId && !claimedAt) {
    return {
      status: 'UNCLAIMED',
      label: 'Unclaimed',
      badgeStyle: {
        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
        color: 'var(--color-text-secondary, #64748b)',
        border: '1px solid var(--color-border, #e2e8f0)',
      },
    };
  }

  // If claim fields exist but current user's ID is not available to reliably compare:
  if (!currentUserId) {
    return {
      status: 'UNAVAILABLE',
      label: reviewerUserId ? `Claimed (Reviewer ID: ${reviewerUserId})` : 'Claim status unavailable',
      badgeStyle: {
        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
        color: 'var(--color-text-secondary, #64748b)',
        border: '1px solid var(--color-border, #e2e8f0)',
      },
      claimedAtFormatted,
    };
  }

  // If reviewerUserId is present:
  if (reviewerUserId) {
    if (reviewerUserId === currentUserId) {
      return {
        status: 'CLAIMED_BY_YOU',
        label: 'Claimed by you',
        badgeStyle: {
          backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
          color: 'var(--color-status-success-text, #065f46)',
          border: '1px solid var(--color-status-success-border, #a7f3d0)',
        },
        claimedAtFormatted,
      };
    } else {
      return {
        status: 'CLAIMED_BY_OTHER',
        label: `Claimed by Reviewer (${reviewerUserId})`,
        badgeStyle: {
          backgroundColor: 'var(--color-status-warning-bg, #fffbeb)',
          color: 'var(--color-status-warning-text, #92400e)',
          border: '1px solid var(--color-status-warning-border, #fde68a)',
        },
        claimedAtFormatted,
      };
    }
  }

  // claimedAt is present but reviewerUserId is not available:
  return {
    status: 'UNAVAILABLE',
    label: 'Claimed (Reviewer ID unavailable)',
    badgeStyle: {
      backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
      color: 'var(--color-text-secondary, #64748b)',
      border: '1px solid var(--color-border, #e2e8f0)',
    },
    claimedAtFormatted,
  };
}
