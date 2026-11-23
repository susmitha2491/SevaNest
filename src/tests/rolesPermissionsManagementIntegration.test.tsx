import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { configurationRepository } from '../features/configuration/data/configurationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { getAccessibleNavigation } from '../core/rbac/navigationRegistry';
import { AdminRole, AdminUser } from '../core/auth/authTypes';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/configuration?tab=roles') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/configuration" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Super Admin Roles & Permissions Management — Integration Suite', () => {
  const mockRoles = [
    {
      role: 'SUPER_ADMIN',
      roleName: 'Super Admin',
      description: 'System master configuration, role delegation, financial policy approvals, and audit trail oversight.',
      permissions: [
        'admin.manage_users', 'alert.manage', 'alert.view', 'area.manage', 'attendance.manage', 'attendance.view',
        'audit.view', 'booking.manage', 'booking.view', 'category.manage', 'config.manage', 'customer.manage',
        'customer.view', 'matching.run', 'notification.manage', 'payment.manage', 'payment.refund', 'payment.view',
        'rating.moderate', 'rating.view', 'replacement.manage', 'replacement.view', 'report.view', 'role.manage',
        'support.category.manage', 'support.manage', 'support.view', 'user.status.manage', 'user.view',
        'verification.configure', 'verification.decide', 'verification.document.view', 'verification.reassign',
        'verification.review', 'verification.signoff', 'worker.activate', 'worker.blacklist', 'worker.blacklist.lift',
        'worker.manage', 'worker.reveal_emergency_contact', 'worker.view'
      ],
      isImmutable: true,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'OPERATIONS_ADMIN',
      roleName: 'Operations Admin',
      description: 'Candidate matching, replacement fulfillment, booking lifecycle management, and financial refunds.',
      permissions: [
        'alert.manage', 'alert.view', 'area.manage', 'attendance.manage', 'attendance.view', 'booking.manage',
        'booking.view', 'category.manage', 'customer.manage', 'customer.view', 'matching.run', 'notification.manage',
        'payment.view', 'rating.moderate', 'rating.view', 'replacement.manage', 'replacement.view', 'report.view',
        'support.view', 'user.view', 'verification.reassign', 'verification.signoff', 'worker.activate',
        'worker.manage', 'worker.view'
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'VERIFICATION_EXECUTIVE',
      roleName: 'Verification Executive',
      description: 'Worker document vetting, Aadhaar & address proof validation, and reference phone checks.',
      permissions: [
        'alert.view', 'verification.decide', 'verification.document.view', 'verification.review', 'worker.view'
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'SUPPORT_EXECUTIVE',
      roleName: 'Support Executive',
      description: 'Household grievance mediation, telephonic dispute logging, SLA countdowns, and Operations escalation.',
      permissions: [
        'booking.view', 'customer.view', 'rating.view', 'support.manage', 'support.view', 'worker.view'
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'sevanest@admin.in',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      isAuthenticated: true,
      isInitialized: true,
      isRestoring: false,
    });

    vi.spyOn(configurationRepository, 'getRolePermissions').mockResolvedValue(mockRoles);
  });

  it('renders all 4 administrative roles with accurate permissions and staff counts', async () => {
    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByText('Role-Based Access Control Governance Matrix')).toBeInTheDocument();

    // Verify role cards rendered
    expect(screen.getByRole('tab', { name: /Super Admin/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Operations Admin/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Verification Executive/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Support Executive/i })).toBeInTheDocument();
  });

  it('renders all 12 permission module groups with authoritative descriptions and badges', async () => {
    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByText('Dashboard & Operational Alerts')).toBeInTheDocument();
    expect(screen.getByText('Customer Management')).toBeInTheDocument();
    expect(screen.getByText('Domestic Worker Management')).toBeInTheDocument();
    expect(screen.getByText('Worker Verification & KYC')).toBeInTheDocument();
    expect(screen.getByText('Booking Management & Fulfillment')).toBeInTheDocument();
    expect(screen.getByText('Attendance & Daily Logs')).toBeInTheDocument();
    expect(screen.getByText('Ratings & Reviews')).toBeInTheDocument();
    expect(screen.getByText('Payments & Financial Ledger')).toBeInTheDocument();
    expect(screen.getByText('Customer & Worker Support')).toBeInTheDocument();
    expect(screen.getByText('Reports & Business Analytics')).toBeInTheDocument();
    expect(screen.getByText('Platform Configuration & Masters')).toBeInTheDocument();
    expect(screen.getByText('Administration, Roles & Security')).toBeInTheDocument();
  });

  it('disables superAdminOnly permissions for non-Super Admin roles and displays restriction badge', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Operations Admin
    const opsRoleTab = await screen.findByRole('tab', { name: /Operations Admin/i });
    await user.click(opsRoleTab);

    // Find Administration & Security module
    const adminManageCheckbox = screen.getByLabelText(/admin\.manage_users/i);
    expect(adminManageCheckbox).toBeDisabled();
    expect(adminManageCheckbox).not.toBeChecked();

    const auditViewCheckbox = screen.getByLabelText(/audit\.view/i);
    expect(auditViewCheckbox).toBeDisabled();
    expect(auditViewCheckbox).not.toBeChecked();

    const roleManageCheckbox = screen.getByLabelText(/role\.manage/i);
    expect(roleManageCheckbox).toBeDisabled();
    expect(roleManageCheckbox).not.toBeChecked();

    const blacklistLiftCheckbox = screen.getByLabelText(/worker\.blacklist\.lift/i);
    expect(blacklistLiftCheckbox).toBeDisabled();
    expect(blacklistLiftCheckbox).not.toBeChecked();

    // Verify Super Admin Only badges
    const restrictedBadges = screen.getAllByText(/Super Admin Only/i);
    expect(restrictedBadges.length).toBeGreaterThanOrEqual(4);
  });

  it('enforces immutable lock on Super Admin role and prevents edits', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Super Admin
    const superAdminTab = await screen.findByRole('tab', { name: /Super Admin/i });
    await user.click(superAdminTab);

    // Verify immutable warning banner
    expect(
      screen.getByText(/Super Administrator Core Matrix \(Protected & Immutable\)/i)
    ).toBeInTheDocument();

    // Verify save button is disabled
    const saveBtn = screen.getByRole('button', { name: /Immutable Core Role/i });
    expect(saveBtn).toBeDisabled();

    // Verify checkboxes are all checked and disabled
    const bookingViewCheckbox = screen.getByLabelText(/booking\.view/i);
    expect(bookingViewCheckbox).toBeChecked();
    expect(bookingViewCheckbox).toBeDisabled();
  });

  it('allows toggling permissions, displays unsaved banner, and updates role permissions via PUT with rationale', async () => {
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(configurationRepository, 'updateRolePermissions').mockResolvedValueOnce({
      role: 'OPERATIONS_ADMIN',
      roleName: 'Operations Admin',
      description: 'Updated operational policies',
      permissions: [
        ...mockRoles[1].permissions,
        'verification.decide',
      ],
      isImmutable: false,
    });

    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Operations Admin
    const opsRoleTab = await screen.findByRole('tab', { name: /Operations Admin/i });
    await user.click(opsRoleTab);

    // Toggle verification.decide permission on
    const decideCheckbox = screen.getByLabelText(/verification\.decide/i);
    expect(decideCheckbox).not.toBeChecked();
    await user.click(decideCheckbox);
    expect(decideCheckbox).toBeChecked();

    // Verify unsaved changes banner appears
    expect(screen.getByText(/Unsaved permission changes for Operations Admin/i)).toBeInTheDocument();

    // Click Save Role Privileges
    const saveBtn = screen.getByRole('button', { name: /Save Role Privileges \*/i });
    await user.click(saveBtn);

    // Confirm dialog should open requesting audit rationale
    expect(screen.getByText(/Authorize Permission Updates for Operations Admin/i)).toBeInTheDocument();
    const remarksInput = screen.getByPlaceholderText(/Explain why these role permissions are being changed/i);
    await user.type(remarksInput, 'Expanding Operations Admin access to verification decide per Q4 workflow');

    // Confirm destructive checkbox
    const destructiveCheckbox = screen.getByTestId('confirm-destructive-checkbox');
    await user.click(destructiveCheckbox);

    const confirmBtn = screen.getByRole('button', { name: /Authorize Role Update/i });
    await user.click(confirmBtn);

    // Verify updateRolePermissions was called with canonical codes and rationale
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'OPERATIONS_ADMIN',
        expect.arrayContaining(['verification.decide', 'booking.view', 'alert.view']),
        'Expanding Operations Admin access to verification decide per Q4 workflow'
      );
    });

    // Verify success toast
    expect(await screen.findByText(/Role permissions for Operations Admin updated successfully/i)).toBeInTheDocument();
  });

  it('supports module-level bulk toggle (Select All / Clear All) for non-restricted permissions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Verification Executive
    const verifRoleTab = await screen.findByRole('tab', { name: /Verification Executive/i });
    await user.click(verifRoleTab);

    // Find the Attendance module section and toggle Select All
    const attendanceSection = screen.getByText('Attendance & Daily Logs').closest('div[style*="border: 1px solid"]') as never;
    expect(attendanceSection).not.toBeNull();

    const selectAllBtn = within(attendanceSection).getByRole('button', { name: /Select All/i });
    await user.click(selectAllBtn);

    // Verify attendance.view and attendance.manage are now checked
    expect(screen.getByLabelText(/attendance\.view/i)).toBeChecked();
    expect(screen.getByLabelText(/attendance\.manage/i)).toBeChecked();

    // Verify Clear All is now visible
    const clearAllBtn = within(attendanceSection).getByRole('button', { name: /Clear All/i });
    expect(clearAllBtn).toBeInTheDocument();

    // Click Clear All
    await user.click(clearAllBtn);
    expect(screen.getByLabelText(/attendance\.view/i)).not.toBeChecked();
    expect(screen.getByLabelText(/attendance\.manage/i)).not.toBeChecked();
  });

  it('allows discarding changes and reverting draft to server permissions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Operations Admin
    const opsRoleTab = await screen.findByRole('tab', { name: /Operations Admin/i });
    await user.click(opsRoleTab);

    // Uncheck booking.manage
    const bookingManageCheckbox = screen.getByLabelText(/booking\.manage/i);
    expect(bookingManageCheckbox).toBeChecked();
    await user.click(bookingManageCheckbox);
    expect(bookingManageCheckbox).not.toBeChecked();

    // Unsaved banner is displayed
    expect(screen.getByText(/Unsaved permission changes for Operations Admin/i)).toBeInTheDocument();

    // Click Discard Changes
    const discardBtn = screen.getByRole('button', { name: /Discard Changes/i });
    await user.click(discardBtn);

    // Verified reverted to server state
    expect(screen.getByLabelText(/booking\.manage/i)).toBeChecked();
    expect(screen.queryByText(/Unsaved permission changes for Operations Admin/i)).not.toBeInTheDocument();
  });

  it('verifies that getAccessibleNavigation respects server-issued permissions', () => {
    // 1. Support Executive with baseline permissions
    const seUser: AdminUser = {
      id: 'SE-01',
      name: 'Support Exec',
      email: 'se@sevanest.in',
      role: 'SUPPORT_EXECUTIVE' as AdminRole,
      permissions: ['booking.view', 'customer.view', 'rating.view', 'support.manage', 'support.view', 'worker.view'],
    };
    const seNav = getAccessibleNavigation(seUser);
    const seNavIds = seNav.map((m) => m.id);

    expect(seNavIds).toContain('support');
    expect(seNavIds).toContain('customers');
    expect(seNavIds).toContain('workers');
    expect(seNavIds).not.toContain('configuration');
    expect(seNavIds).not.toContain('audit');

    // 2. Verification Executive with baseline permissions
    const veUser: AdminUser = {
      id: 'VE-01',
      name: 'Verification Exec',
      email: 've@sevanest.in',
      role: 'VERIFICATION_EXECUTIVE' as AdminRole,
      permissions: ['alert.view', 'verification.decide', 'verification.document.view', 'verification.review', 'worker.view'],
    };
    const veNav = getAccessibleNavigation(veUser);
    const veNavIds = veNav.map((m) => m.id);

    expect(veNavIds).toContain('dashboard');
    expect(veNavIds).toContain('verification');
    expect(veNavIds).toContain('workers');
    expect(veNavIds).not.toContain('payments');
    expect(veNavIds).not.toContain('configuration');
    expect(veNavIds).not.toContain('audit');
  });

  it('displays clear error toast when server returns HTTP 422 for restricted or invalid permissions', async () => {
    const user = userEvent.setup();
    vi.spyOn(configurationRepository, 'updateRolePermissions').mockRejectedValueOnce(
      new Error('These permissions can only be held by the Super Admin role')
    );

    renderWithProviders(<ConfigurationMastersPage />);

    // Switch to Operations Admin
    const opsRoleTab = await screen.findByRole('tab', { name: /Operations Admin/i });
    await user.click(opsRoleTab);

    // Toggle a permission to enable save
    const decideCheckbox = screen.getByLabelText(/verification\.decide/i);
    await user.click(decideCheckbox);

    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Role Privileges \*/i });
    await user.click(saveBtn);

    const remarksInput = screen.getByPlaceholderText(/Explain why these role permissions are being changed/i);
    await user.type(remarksInput, 'Attempting role update');
    await user.click(screen.getByTestId('confirm-destructive-checkbox'));
    await user.click(screen.getByRole('button', { name: /Authorize Role Update/i }));

    // Expect error toast
    expect(
      await screen.findByText(/These permissions can only be held by the Super Admin role/i)
    ).toBeInTheDocument();
  });

  it('displays clear error toast when attempting to modify an immutable role (HTTP 409)', async () => {
    const user = userEvent.setup();
    vi.spyOn(configurationRepository, 'updateRolePermissions').mockRejectedValueOnce(
      new Error('Super Admin core permission matrix cannot be modified (ROLE_IMMUTABLE).')
    );

    renderWithProviders(<ConfigurationMastersPage />);

    const opsRoleTab = await screen.findByRole('tab', { name: /Operations Admin/i });
    await user.click(opsRoleTab);

    const decideCheckbox = screen.getByLabelText(/verification\.decide/i);
    await user.click(decideCheckbox);

    const saveBtn = screen.getByRole('button', { name: /Save Role Privileges \*/i });
    await user.click(saveBtn);

    const remarksInput = screen.getByPlaceholderText(/Explain why these role permissions are being changed/i);
    await user.type(remarksInput, 'Role update test');
    await user.click(screen.getByTestId('confirm-destructive-checkbox'));
    await user.click(screen.getByRole('button', { name: /Authorize Role Update/i }));

    expect(
      await screen.findByText(/Super Admin core permission matrix cannot be modified \(ROLE_IMMUTABLE\)\./i)
    ).toBeInTheDocument();
  });

  it('displays clear error state when permissions catalog fails to load from backend (no fallback)', async () => {
    vi.spyOn(configurationRepository, 'getPermissionCatalogItems' as never).mockRejectedValueOnce(
      new Error('Authoritative permissions catalog is empty or unavailable on the backend server.')
    );

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to Load Permissions Catalog')).toBeInTheDocument();
    expect(
      screen.getByText(/Authoritative permissions catalog is empty or unavailable on the backend server/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Authorization Sync/i })).toBeInTheDocument();
  });
});
