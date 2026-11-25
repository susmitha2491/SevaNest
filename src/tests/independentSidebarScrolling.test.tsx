/* global HTMLElement */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '../app/layouts/AppShell';
import { useAuthStore } from '../core/auth/authStore';
import { AdminRole, AdminUser } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';

const SUPER_ADMIN: AdminUser = {
  id: 'sa-01',
  name: 'Super Administrator',
  email: 'superadmin@sevanest.internal',
  role: 'SUPER_ADMIN' as AdminRole,
  permissions: Object.values(PERMISSIONS),
};

const OPERATIONS_ADMIN: AdminUser = {
  id: 'ops-01',
  name: 'Operations Admin',
  email: 'ops@sevanest.internal',
  role: 'OPERATIONS_ADMIN' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.WORKER_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
};

const VERIFICATION_EXEC: AdminUser = {
  id: 've-01',
  name: 'Verification Executive',
  email: 've@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_SIGNOFF,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
  ],
};

const SUPPORT_EXEC: AdminUser = {
  id: 'se-01',
  name: 'Support Executive',
  email: 'se@sevanest.internal',
  role: 'SUPPORT_EXECUTIVE' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
  ],
};

function renderAppWithRoute(initialPath: string = '/dashboard', user: AdminUser = SUPER_ADMIN) {
  useAuthStore.setState({ user, isAuthenticated: true });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="dashboard" element={<div data-testid="page-dashboard">Dashboard Content <Link to="/audit">Go to Audit</Link></div>} />
            <Route path="audit" element={<div data-testid="page-audit">Audit Trail Page Content</div>} />
            <Route path="configuration" element={<div data-testid="page-config">Config Page</div>} />
            <Route path="verification" element={<div data-testid="page-verif">Verification Queue</div>} />
            <Route path="support" element={<div data-testid="page-support">Support Desk</div>} />
            <Route path="customers" element={<div data-testid="page-customers">Customers Page</div>} />
            <Route path="workers" element={<div data-testid="page-workers">Workers Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Independent Sidebar & Main Content Scrolling Layout Architecture', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: SUPER_ADMIN, isAuthenticated: true });
  });

  describe('1. Two-Pane Scroll Container Separation', () => {
    it('renders the root layout with 100vh height and overflow:hidden to lock window scrolling', () => {
      const { container } = renderAppWithRoute('/dashboard');
      const rootLayout = container.querySelector('.app-shell-root') as HTMLElement;
      expect(rootLayout).toBeInTheDocument();
      expect(rootLayout.style.overflow).toBe('hidden');
      expect(rootLayout.style.height).toBe('100vh');
      expect(rootLayout.style.maxHeight).toBe('100vh');
    });

    it('gives the left sidebar a dedicated vertical scroll container with overscroll containment', () => {
      renderAppWithRoute('/dashboard');
      const navScroll = screen.getByTestId('sidebar-nav-scroll');
      expect(navScroll).toBeInTheDocument();
      expect(navScroll.style.overflowY).toBe('auto');
      expect(navScroll.style.overscrollBehavior).toBe('contain');
      expect(navScroll.style.flex).toContain('1');
      expect(navScroll.style.minHeight).toBe('0');
    });

    it('gives the main content viewport an independent vertical scroll container with overscroll containment', () => {
      renderAppWithRoute('/dashboard');
      const mainViewport = screen.getByTestId('app-main-viewport');
      expect(mainViewport).toBeInTheDocument();
      expect(mainViewport.style.overflowY).toBe('auto');
      expect(mainViewport.style.overscrollBehavior).toBe('contain');
      expect(mainViewport.style.flex).toContain('1');
      expect(mainViewport.style.minHeight).toBe('0');
    });

    it('enforces height:100% and overflow:hidden on both column containers', () => {
      const { container } = renderAppWithRoute('/dashboard');
      const sidebar = container.querySelector('aside.portal-sidebar') as HTMLElement;
      const mainColumn = container.querySelector('.app-main-column') as HTMLElement;

      expect(sidebar).toBeInTheDocument();
      expect(sidebar.style.height).toBe('100%');
      expect(sidebar.style.overflow).toBe('hidden');
      expect(sidebar.style.overscrollBehavior).toBe('contain');

      expect(mainColumn).toBeInTheDocument();
      expect(mainColumn.style.height).toBe('100%');
      expect(mainColumn.style.overflow).toBe('hidden');
    });
  });

  describe('2. Fixed Header & Account Section Anchoring', () => {
    it('anchors the brand logo header at the top of the sidebar without scrolling', () => {
      const { container } = renderAppWithRoute('/dashboard');
      const sidebar = container.querySelector('aside.portal-sidebar') as HTMLElement;
      const brandHeader = sidebar.firstElementChild as HTMLElement;

      expect(brandHeader).toBeInTheDocument();
      expect(brandHeader.style.flexShrink).toBe('0');
      expect(brandHeader.style.height).toBe('var(--header-height)');
    });

    it('anchors the user profile & sign-out section at the bottom of the sidebar with flexShrink:0', () => {
      const { container } = renderAppWithRoute('/dashboard');
      const sidebar = container.querySelector('aside.portal-sidebar') as HTMLElement;
      const bottomAccountSection = sidebar.lastElementChild as HTMLElement;

      expect(bottomAccountSection).toBeInTheDocument();
      expect(bottomAccountSection.style.flexShrink).toBe('0');
      expect(screen.getByText('My Account')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('anchors the main top header with flexShrink:0 so it stays stationary when main content scrolls', () => {
      const { container } = renderAppWithRoute('/dashboard');
      const mainColumn = container.querySelector('.app-main-column') as HTMLElement;
      const header = mainColumn.querySelector('header') as HTMLElement;

      expect(header).toBeInTheDocument();
      expect(header.style.flexShrink).toBe('0');
      expect(header.style.zIndex).toBe('45');
    });
  });

  describe('3. Accessibility of All Navigation Items & Bottom Padding', () => {
    it('renders all Super Admin navigation items inside the scrollable container, including bottom items', () => {
      renderAppWithRoute('/dashboard', SUPER_ADMIN);
      const navScroll = screen.getByTestId('sidebar-nav-scroll');

      // Top items
      expect(navScroll).toHaveTextContent('Dashboard');
      expect(navScroll).toHaveTextContent('Customer Management');
      expect(navScroll).toHaveTextContent('Worker Management');

      // Middle items
      expect(navScroll).toHaveTextContent('Directory');
      expect(navScroll).toHaveTextContent('Verification');
      expect(navScroll).toHaveTextContent('Attendance & Daily Logs');
      expect(navScroll).toHaveTextContent('Payments');

      // Bottom items
      expect(navScroll).toHaveTextContent('Support');
      expect(navScroll).toHaveTextContent('Reports');
      expect(navScroll).toHaveTextContent('Configuration');
      expect(navScroll).toHaveTextContent('Audit Trail');

      // Extra bottom padding ensures last item is easily reached without clipping
      expect(navScroll.style.padding).toContain('var(--space-4)');
    });

    it('works across different administrative roles', () => {
      // Operations Admin
      const { unmount } = renderAppWithRoute('/dashboard', OPERATIONS_ADMIN);
      expect(screen.getByTestId('sidebar-nav-scroll')).toHaveTextContent('Worker Management');
      expect(screen.getByTestId('sidebar-nav-scroll')).toHaveTextContent('Attendance & Daily Logs');
      expect(screen.queryByText('Verification')).not.toBeInTheDocument();
      unmount();

      // Verification Executive
      const { unmount: unmountVE } = renderAppWithRoute('/dashboard', VERIFICATION_EXEC);
      expect(screen.getByTestId('sidebar-nav-scroll')).toHaveTextContent('Verification');
      expect(screen.queryByText('Payments')).not.toBeInTheDocument();
      unmountVE();

      // Support Executive
      renderAppWithRoute('/dashboard', SUPPORT_EXEC);
      expect(screen.getByTestId('sidebar-nav-scroll')).toHaveTextContent('Support');
      expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
    });
  });

  describe('4. Route Navigation & Scroll Reset', () => {
    it('resets main viewport scrollTop to 0 on route navigation', () => {
      renderAppWithRoute('/dashboard');
      const mainViewport = screen.getByTestId('app-main-viewport');

      // Simulate scrolled main viewport
      mainViewport.scrollTop = 500;
      expect(mainViewport.scrollTop).toBe(500);

      // Navigate to /audit
      const auditLink = screen.getByText('Go to Audit');
      act(() => {
        auditLink.click();
      });

      // Viewport scroll must be reset to top
      expect(screen.getByTestId('page-audit')).toBeInTheDocument();
      expect(mainViewport.scrollTop).toBe(0);
    });
  });
});
