import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RequiredIndicator } from '../components/common/RequiredIndicator';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { RefundProcessingModal } from '../features/payments/presentation/RefundProcessingModal';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { PaymentTransaction } from '../features/payments/domain/types';

describe('Consistent Red Asterisk Required Field Indicators', () => {
  it('renders RequiredIndicator with uniform red styling and spacing', () => {
    render(<RequiredIndicator />);
    const indicator = screen.getByTestId('required-indicator');
    expect(indicator).toHaveTextContent('*');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator.style.color).toContain('var(--color-error');
    expect(indicator.style.marginLeft).toBe('4px');
    expect(indicator.style.fontWeight).toBe('700');
  });

  it('ConfirmDialog shows red asterisk for mandatory remarks without "(Mandatory)" and omits it for optional remarks', () => {
    const { rerender } = render(
      <ConfirmDialog
        isOpen={true}
        title="Mandatory Action"
        description="Confirm action"
        requireRemarks={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Operational Remarks')).toBeInTheDocument();
    expect(screen.getByTestId('required-indicator')).toHaveTextContent('*');
    expect(screen.queryByText(/\(Mandatory\)/i)).not.toBeInTheDocument();

    rerender(
      <ConfirmDialog
        isOpen={true}
        title="Optional Action"
        description="Confirm action"
        showRemarks={true}
        requireRemarks={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/Operational Remarks \(Optional\)/i)).toBeInTheDocument();
    expect(screen.queryByTestId('required-indicator')).not.toBeInTheDocument();
  });

  it('SignInPage displays required indicators on Admin Email Address and Password', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SignInPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Admin Email Address')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getAllByTestId('required-indicator')).toHaveLength(2);
  });

  it('RefundProcessingModal displays red asterisk instead of "(Mandatory)"', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({
      user: {
        id: 'ADMIN-1',
        name: 'Ops Admin',
        email: 'ops@sevanest.local',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.REFUNDS_MANAGE],
      },
      isAuthenticated: true,
    });

    const mockTx: PaymentTransaction = {
      id: 'TX-1',
      bookingId: 'BK-1',
      bookingRef: 'BK-1',
      customerId: 'CUST-1',
      customerName: 'Aarav Sharma',
      customerPhoneMasked: '+91 98765 43210',
      serviceCategory: 'House Maid',
      feeType: 'PLACEMENT_FEE',
      feeDescription: 'Placement Fee',
      amountINR: 1500,
      paymentMethod: 'UPI',
      gatewayRef: 'GW-1',
      status: 'PAID',
      timestamp: '2026-11-01T10:00:00Z',
      createdAt: '2026-11-01T10:00:00Z',
      breakdown: { baseAmount: 1271, gstAmount: 229, platformCommission: 0 },
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RefundProcessingModal transaction={mockTx} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Refund Reason Category')).toBeInTheDocument();
    expect(screen.getByText('Operational Remarks & Settlement Rationale')).toBeInTheDocument();
    expect(screen.queryByText(/\(Mandatory\)/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('required-indicator')).toHaveLength(2);
  });

  it('ConfigurationMastersPage shows required indicators in Operational Area and Notification Template modals', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Admin',
        email: 'super@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
      isAuthenticated: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ConfigurationMastersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Operational Areas Modal: Cluster / Locality Name * and City Name * (Covered Pin Codes optional)
    const areasTab = await screen.findByTestId('config-section-areas');
    await user.click(areasTab);

    const addAreaBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addAreaBtn);

    expect(await screen.findByRole('heading', { name: /Add New Operational Area/i })).toBeInTheDocument();
    const areaDialog = screen.getByRole('dialog');
    expect(within(areaDialog).getByText('Cluster / Locality Name')).toBeInTheDocument();
    expect(within(areaDialog).getByText('City Name')).toBeInTheDocument();
    expect(within(areaDialog).getByText('Covered Pin Codes')).toBeInTheDocument();
    expect(within(areaDialog).getAllByTestId('required-indicator')).toHaveLength(2);

    await user.click(within(areaDialog).getByRole('button', { name: /^Cancel$/i }));

    // 2. Notification Templates Modal: Message Title Template * and Message Body Copy Template *
    const templatesTab = await screen.findByTestId('config-section-templates');
    await user.click(templatesTab);

    const editBtns = await screen.findAllByRole('button', { name: /Edit/i });
    await user.click(editBtns[0]);

    expect(await screen.findByRole('heading', { name: /Edit Notification Template/i })).toBeInTheDocument();
    const templateDialog = screen.getByRole('dialog');
    expect(within(templateDialog).getByText('Message Title Template')).toBeInTheDocument();
    expect(within(templateDialog).getByText('Message Body Copy Template')).toBeInTheDocument();
    expect(within(templateDialog).getAllByTestId('required-indicator')).toHaveLength(2);
  });
});

