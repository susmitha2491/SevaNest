import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../shared/components/StatusBadge/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders canonical status label for PENDING_REVIEW', () => {
    render(<StatusBadge status="PENDING_REVIEW" />);
    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });

  it('renders canonical status label for SERVICE_ACTIVE', () => {
    render(<StatusBadge status="SERVICE_ACTIVE" />);
    expect(screen.getByText('Service active')).toBeInTheDocument();
  });

  it('renders canonical status label for REPLACEMENT_REQUESTED', () => {
    render(<StatusBadge status="REPLACEMENT_REQUESTED" />);
    expect(screen.getByText('Replacement review')).toBeInTheDocument();
  });

  it('renders canonical status label for SLA_BREACHED', () => {
    render(<StatusBadge status="SLA_BREACHED" />);
    expect(screen.getByText('SLA breached')).toBeInTheDocument();
  });

  it('falls back to formatted text for unknown status strings', () => {
    render(<StatusBadge status="CUSTOM_STATUS" />);
    expect(screen.getByText('CUSTOM STATUS')).toBeInTheDocument();
  });
});
