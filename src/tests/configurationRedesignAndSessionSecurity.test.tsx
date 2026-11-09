import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { SessionInactivityGuard } from '../core/auth/SessionInactivityGuard';
import { useAuthStore } from '../core/auth/authStore';
import { useSessionSecurityStore } from '../core/auth/sessionSecurityStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { authRepository } from '../features/auth/data/authRepository';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/control/configuration') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/control/configuration" element={ui} />
          <Route path="/auth/login" element={<div>Sign In Screen</div>} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SevaNest Configuration UI Redesign & Session Security Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
      isAuthenticated: true,
      accessToken: 'test-access-token',
    });

    useSessionSecurityStore.getState().resetPolicy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Configuration UI Section Selector Redesign', () => {
    it('renders the responsive button-based section selector with all 7 configuration sections', async () => {
      renderWithProviders(<ConfigurationMastersPage />);

      const selectorContainer = await screen.findByTestId('configuration-section-selector');
      expect(selectorContainer).toBeInTheDocument();

      // All 7 sections present as individual card buttons
      const sectionButtons = [
        { id: 'fees', label: 'Pricing Plans', desc: 'Commercial booking fees' },
        { id: 'categories', label: 'Service Categories & Skills', desc: 'Workforce service roles' },
        { id: 'areas', label: 'Operational Areas & Clusters', desc: 'Launch city geographical boundaries' },
        { id: 'templates', label: 'Notification Templates', desc: 'Multi-channel customer & worker message copy' },
        { id: 'roles', label: 'Roles & Permissions', desc: 'Administrative access control matrix' },
        { id: 'adminUsers', label: 'Admin Users', desc: 'Administrative staff provisioning' },
        { id: 'security', label: 'Session & Security', desc: 'Authentication lifecycle, inactivity timeout' },
      ];

      for (const section of sectionButtons) {
        const btn = screen.getByTestId(`config-section-${section.id}`);
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveTextContent(section.label);
        expect(btn).toHaveTextContent(new RegExp(section.desc, 'i'));
      }
    });

    it('highlights active section card and shows only selected content', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      // Wait for section selector to load
      const feesBtn = await screen.findByTestId('config-section-fees');
      expect(feesBtn).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Commercial Pricing Schedule \(Draft Workspace\)/i)).toBeInTheDocument();

      // Click Roles & Permissions
      const rolesBtn = screen.getByTestId('config-section-roles');
      await user.click(rolesBtn);

      expect(rolesBtn).toHaveAttribute('aria-selected', 'true');
      expect(feesBtn).toHaveAttribute('aria-selected', 'false');

      // Previous content hidden, new content visible
      expect(screen.queryByText(/Commercial Pricing Schedule \(Draft Workspace\)/i)).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: /Role-Based Access Control Governance Matrix/i })).toBeInTheDocument();
    });

    it('supports URL tab parameter navigation directly to Admin Users', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/control/configuration?tab=adminUsers');

      const adminUsersBtn = await screen.findByTestId('config-section-adminUsers');
      expect(adminUsersBtn).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByRole('heading', { name: /Platform Administrator Personnel & Access Governance/i })).toBeInTheDocument();
    });

    it('supports URL tab parameter navigation to Session & Security', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/control/configuration?tab=security');

      const securityBtn = await screen.findByTestId('config-section-security');
      expect(securityBtn).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByRole('heading', { name: /Session Governance & Security Settings/i })).toBeInTheDocument();
    });
  });

  describe('2. Session & Security Configuration & Architecture Compliance', () => {
    it('displays auto-logout settings with 15-minute standard policy and GAP-SEC-01 notice', async () => {
      vi.spyOn(authRepository, 'listSessions').mockResolvedValue([
        {
          id: 'SESS-001',
          deviceName: 'Admin Operations Chrome 120',
          createdAt: '2026-11-09T10:00:00Z',
          lastActiveAt: '2026-11-09T10:14:00Z',
          isCurrent: true,
        },
      ]);

      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      // Switch to Session & Security
      const securityBtn = await screen.findByTestId('config-section-security');
      await user.click(securityBtn);

      // Verify headings and policy badges
      expect(await screen.findByRole('heading', { name: /Session Governance & Security Settings/i })).toBeInTheDocument();
      expect(screen.getByText(/15-Minute Standard Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Automated Session Inactivity Logout/i)).toBeInTheDocument();

      // Verify toggle and radio options
      const toggle = screen.getByTestId('auto-logout-toggle');
      expect(toggle).toBeChecked();

      const option15 = screen.getByTestId('timeout-option-15');
      const option10 = screen.getByTestId('timeout-option-10');
      expect(option15).toBeChecked();
      expect(option10).not.toBeChecked();

      // Verify 60s warning text
      expect(screen.getByText(/60 seconds \(1 minute\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Stay Logged In/i)).toBeInTheDocument();

      // Verify authoritative GAP-SEC-01 architecture notice
      const gapNotice = screen.getByTestId('session-gap-notice');
      expect(gapNotice).toBeInTheDocument();
      expect(gapNotice).toHaveTextContent(/Server Session Architecture & Contract Reference \(GAP-SEC-01\)/i);
      expect(gapNotice).toHaveTextContent(/fixed 15-minute \(900s\) lifetime/i);

      // Verify active token sessions table
      expect(await screen.findByText('Admin Operations Chrome 120')).toBeInTheDocument();
      expect(screen.getByText('SESS-001')).toBeInTheDocument();
      expect(screen.getByText(/Current Session/i)).toBeInTheDocument();
    });

    it('allows changing timeout setting to 10 minutes in memory policy store', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />, '/control/configuration?tab=security');

      const option10 = await screen.findByTestId('timeout-option-10');
      await user.click(option10);

      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(10);
      expect(option10).toBeChecked();
    });
  });

  describe('3. Inactivity Guard, 60-Second Warning Modal & Auto Logout', () => {
    it('displays warning modal when inactivity countdown reaches warning threshold', async () => {
      // Simulate inactivity: set lastActivityTime to 14 minutes and 10 seconds ago (50s remaining)
      const fiftySecondsRemaining = Date.now() - (15 * 60 - 50) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fiftySecondsRemaining,
      });

      renderWithProviders(
        <div>
          <SessionInactivityGuard />
          <div>Protected Content Workspace</div>
        </div>
      );

      // Modal appears because remaining <= 60s
      await waitFor(() => {
        expect(screen.getByTestId('session-inactivity-warning-modal')).toBeInTheDocument();
      });

      expect(screen.getByText(/Session Inactivity Warning/i)).toBeInTheDocument();
      expect(screen.getByTestId('stay-logged-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('logout-now-button')).toBeInTheDocument();
    });

    it('"Stay Logged In" resets activity timestamp and dismisses warning modal', async () => {
      const user = userEvent.setup();
      const fortySecondsRemaining = Date.now() - (15 * 60 - 40) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fortySecondsRemaining,
      });

      renderWithProviders(
        <div>
          <SessionInactivityGuard />
          <div>Protected Content Workspace</div>
        </div>
      );

      const modal = await screen.findByTestId('session-inactivity-warning-modal');
      expect(modal).toBeInTheDocument();

      const stayBtn = screen.getByTestId('stay-logged-in-button');
      await user.click(stayBtn);

      // Modal is dismissed
      await waitFor(() => {
        expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
      });

      // Activity time refreshed to current
      const lastActive = useSessionSecurityStore.getState().lastActivityTime;
      expect(Date.now() - lastActive).toBeLessThan(1000);
    });

    it('"Log Out Now" terminates session and redirects to /auth/login', async () => {
      const user = userEvent.setup();
      const thirtySecondsRemaining = Date.now() - (15 * 60 - 30) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: thirtySecondsRemaining,
      });

      renderWithProviders(
        <div>
          <SessionInactivityGuard />
          <div>Protected Content Workspace</div>
        </div>
      );

      const logoutBtn = await screen.findByTestId('logout-now-button');
      await user.click(logoutBtn);

      // Session cleared
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();

      // Redirected to login
      await waitFor(() => {
        expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
      });
    });

    it('terminates session automatically when inactivity countdown expires (0s remaining)', async () => {
      vi.useFakeTimers();

      // Set lastActivityTime to exactly 14 minutes and 59 seconds ago (1s remaining)
      const oneSecondRemaining = Date.now() - (15 * 60 - 1) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: oneSecondRemaining,
      });

      renderWithProviders(
        <div>
          <SessionInactivityGuard />
          <div>Protected Content Workspace</div>
        </div>
      );

      // Advance timer by 2 seconds to trigger expiration
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Session cleared and unauthenticated
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();

      vi.useRealTimers();
    });
  });
});
