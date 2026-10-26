import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  CalendarCheck,
  LifeBuoy,
  Users,
  Briefcase,
  CreditCard,
  BarChart3,
  Sliders,
  History,
  LogOut,
  Menu,
  X,
  Search,
  User,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { hasPermission, PERMISSIONS, getDefaultLandingRoute, getRoleLabel } from '../core/rbac/permissions';
import { env } from '../core/config/env';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { name: 'Verification Review', path: '/verification', icon: UserCheck, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Booking Pipeline', path: '/bookings', icon: CalendarCheck, permission: PERMISSIONS.BOOKINGS_VIEW },
      { name: 'Support Tickets', path: '/support', icon: LifeBuoy, permission: PERMISSIONS.SUPPORT_VIEW },
    ],
  },
  {
    title: 'People',
    items: [
      { name: 'Customers', path: '/customers', icon: Users, permission: PERMISSIONS.CUSTOMER_VIEW },
      { name: 'Workers', path: '/workers', icon: Briefcase, permission: PERMISSIONS.WORKER_VIEW },
    ],
  },
  {
    title: 'Money & Insight',
    items: [
      { name: 'Transactions & Fees', path: '/payments', icon: CreditCard, permission: PERMISSIONS.PAYMENTS_VIEW },
      { name: 'Reports & Analytics', path: '/reports', icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    title: 'Control',
    items: [
      { name: 'Configuration Masters', path: '/configuration', icon: Sliders, permission: PERMISSIONS.CONFIGURATION_MANAGE },
      { name: 'Audit Trail', path: '/audit', icon: History, permission: PERMISSIONS.AUDIT_VIEW },
    ],
  },
];

const VERIFICATION_EXECUTIVE_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    title: 'Verification Operations',
    items: [
      { name: 'Verification Queue', path: '/verification', icon: ShieldCheck, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'My Reviews', path: '/verification/my-reviews', icon: UserCheck, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Rechecks & Expiry', path: '/verification/rechecks', icon: RefreshCw, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Corrections Required', path: '/verification/corrections', icon: AlertTriangle, permission: PERMISSIONS.VERIFICATION_REVIEW },
    ],
  },
  {
    title: 'Worker Records',
    items: [
      { name: 'Workers Directory', path: '/workers', icon: Briefcase, permission: PERMISSIONS.WORKER_VIEW },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Review History', path: '/verification/history', icon: History, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Verification Insights', path: '/verification/insights', icon: BarChart3, permission: PERMISSIONS.VERIFICATION_REVIEW },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'My Account', path: '/account', icon: User },
    ],
  },
];

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authRepository.logout();
    } catch (err: unknown) {
      // Even if remote/backend logout rejects, client session must be cleared deterministically.
      console.warn('Logout notification error encountered, clearing client session regardless:', err);
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true, state: null });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const targetRoute = getDefaultLandingRoute(user);
    navigate(`${targetRoute}?search=${encodeURIComponent(globalSearch.trim())}`);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-app)' }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : '72px',
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--transition-normal)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            padding: sidebarOpen ? '0 var(--space-4)' : '0 var(--space-2)',
            borderBottom: '1px solid var(--color-border-subtle)',
            gap: sidebarOpen ? 'var(--space-2)' : 'var(--space-1)',
          }}
        >
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
              <img
                src="/sevanest-logo.png"
                alt="SevaNest logo"
                style={{
                  height: '42px',
                  maxWidth: '160px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <img
              src="/sevanest-logo.png"
              alt="SevaNest logo"
              style={{
                height: '32px',
                maxWidth: '36px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              color: 'var(--color-text-muted)',
              padding: 'var(--space-1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav Sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) 0' }}>
          {(user?.role === 'VERIFICATION_EXECUTIVE' ? VERIFICATION_EXECUTIVE_SECTIONS : NAV_SECTIONS).map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.permission || hasPermission(user?.permissions, item.permission)
            );

            if (!visibleItems.length) return null;

            return (
              <div key={section.title} style={{ marginBottom: 'var(--space-4)' }}>
                {sidebarOpen && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-muted)',
                      padding: '0 var(--space-4)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    {section.title}
                  </div>
                )}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 var(--space-2)' }}>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/verification' || item.path === '/dashboard'}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          padding: '10px var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: isActive ? 600 : 500,
                          backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                          transition: 'all var(--transition-fast)',
                          justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        })}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <Icon size={18} />
                        {sidebarOpen && <span>{item.name}</span>}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* User Info / Sign-out */}
        <div
          style={{
            padding: 'var(--space-3)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {sidebarOpen && user && (
            <div style={{ marginBottom: 'var(--space-2)', padding: '0 var(--space-2)' }}>
              <div
                data-testid="sidebar-user-name"
                style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                {user.name}
              </div>
              <div
                data-testid="sidebar-user-role"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
              >
                {getRoleLabel(user.role)}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-status-danger-text)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: 'var(--header-height)',
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-6)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Global Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ width: '100%', maxWidth: '440px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-3)',
                height: '38px',
              }}
            >
              <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search by ID, Name, Phone, or Booking Ref..."
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  width: '100%',
                }}
              />
            </div>
          </form>

          {/* Header Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: env.VITE_APP_ENV === 'production' ? 'var(--color-status-danger-bg)' : 'var(--color-status-info-bg)',
                border: `1px solid ${env.VITE_APP_ENV === 'production' ? 'var(--color-status-danger-border)' : 'var(--color-status-info-border)'}`,
                color: env.VITE_APP_ENV === 'production' ? 'var(--color-status-danger-text)' : 'var(--color-status-info-text)',
                textTransform: 'uppercase',
              }}
            >
              {env.VITE_APP_ENV}
            </span>

            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    borderRadius: 'var(--radius-full)',
                    padding: '6px',
                    display: 'flex',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <User size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                  <span
                    data-testid="header-user-name"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.2 }}
                  >
                    {user.name}
                  </span>
                  <span
                    data-testid="header-user-role"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.2 }}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Breadcrumb / Page Header context */}
        <div style={{ padding: 'var(--space-3) var(--space-6)', backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>SevaNest Admin</span> &gt; <span style={{ color: 'var(--color-navy)', fontWeight: 700 }}>{location.pathname.replace('/', '').toUpperCase() || 'DASHBOARD'}</span>
        </div>

        {/* Main Viewport Content */}
        <main style={{ flex: 1, padding: 'var(--space-6)', minWidth: 0, backgroundColor: 'var(--color-bg-app)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
