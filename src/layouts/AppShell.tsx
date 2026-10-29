import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  LogOut,
  Menu,
  X,
  Search,
  User,
  ShieldCheck,
  LucideIcon,
  ChevronDown,
  Edit3,
} from 'lucide-react';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { hasPermission, PERMISSIONS, getDefaultLandingRoute, getRoleLabel } from '../core/rbac/permissions';
import { env } from '../core/config/env';

interface NavItem {
  name: string;
  path: string;
  icon?: LucideIcon;
  permission?: string;
  end?: boolean;
}

interface NavSection {
  title: string;
  icon?: LucideIcon;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { name: 'Customer Management', path: '/customers', icon: Users, permission: PERMISSIONS.CUSTOMER_VIEW },
      { name: 'Worker Management', path: '/workers', icon: Briefcase, permission: PERMISSIONS.WORKER_VIEW },
      { name: 'Verification', path: '/verification', icon: UserCheck, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Booking Management', path: '/bookings', icon: CalendarCheck, permission: PERMISSIONS.BOOKINGS_VIEW },
      { name: 'Payments', path: '/payments', icon: CreditCard, permission: PERMISSIONS.PAYMENTS_VIEW },
      { name: 'Support', path: '/support', icon: LifeBuoy, permission: PERMISSIONS.SUPPORT_VIEW },
      { name: 'Reports', path: '/reports', icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
      { name: 'Configuration', path: '/configuration', icon: Sliders, permission: PERMISSIONS.CONFIGURATION_MANAGE },
    ],
  },
];


const VERIFICATION_EXECUTIVE_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    title: 'Verification Queue',
    icon: ShieldCheck,
    items: [
      { name: 'All Applications', path: '/verification', end: true, permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'My Reviews', path: '/verification/my-reviews', permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Rechecks & Expiry', path: '/verification/rechecks', permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Corrections Required', path: '/verification/corrections', permission: PERMISSIONS.VERIFICATION_REVIEW },
      { name: 'Review History', path: '/verification/history', permission: PERMISSIONS.VERIFICATION_REVIEW },
    ],
  },
];

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<React.ComponentRef<'div'>>(null);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const isProfileEditSupported = Boolean(authRepository.supportsProfileUpdate);

  useEffect(() => {
    const handleClickOutside = (event: { target: unknown }) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as React.ComponentRef<'div'>)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: { key: string }) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside as (e: unknown) => void);
      document.addEventListener('keydown', handleKeyDown as (e: unknown) => void);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as (e: unknown) => void);
      document.removeEventListener('keydown', handleKeyDown as (e: unknown) => void);
    };
  }, [profileMenuOpen]);

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
          {((user?.role === 'VERIFICATION_EXECUTIVE' || user?.role === 'VERIFICATION_SUPERVISOR') ? VERIFICATION_EXECUTIVE_SECTIONS : NAV_SECTIONS).map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.permission || hasPermission(user?.permissions, item.permission)
            );

            if (!visibleItems.length) return null;

            const SectionIcon = section.icon;

            return (
              <div key={section.title || 'main-nav'} style={{ marginBottom: section.title ? 'var(--space-3)' : '0' }}>
                {sidebarOpen && Boolean(section.title) && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-muted)',
                      padding: '0 var(--space-4)',
                      marginTop: 'var(--space-3)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {SectionIcon && <SectionIcon size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                    <span>{section.title}</span>
                  </div>
                )}
                {!sidebarOpen && Boolean(section.title) && SectionIcon && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: 'var(--space-2) 0',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px solid var(--color-border-subtle)',
                      margin: 'var(--space-2) var(--space-2)',
                    }}
                    title={section.title}
                  >
                    <SectionIcon size={16} />
                  </div>
                )}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 var(--space-2)' }}>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end ?? (item.path === '/dashboard' || item.path === '/verification')}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: '7px var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: isActive ? 600 : 500,
                          backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                          transition: 'all var(--transition-fast)',
                          justifyContent: sidebarOpen ? 'flex-start' : 'center',
                          whiteSpace: 'nowrap',
                          textDecoration: 'none',
                        })}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        {Icon && <Icon size={18} />}
                        {sidebarOpen && <span>{item.name}</span>}
                        {!sidebarOpen && !Icon && (
                          <span style={{ fontSize: '11px', fontWeight: 700 }}>
                            {item.name.charAt(0)}
                          </span>
                        )}
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
          <NavLink
            to="/account"
            style={({ isActive }) => ({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '7px var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
              textDecoration: 'none',
              marginBottom: '4px',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            })}
            title={!sidebarOpen ? 'My Account' : undefined}
          >
            <User size={16} />
            {sidebarOpen && <span>My Account</span>}
          </NavLink>
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
            padding: '0 var(--space-5)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Global Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ width: '100%', maxWidth: '380px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-3)',
                height: '34px',
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
              <div ref={profileMenuRef} className="header-profile-menu-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  data-testid="header-profile-button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  aria-label="Admin Profile Menu"
                  className="header-profile-trigger"
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-primary-subtle)',
                      border: '1px solid var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    {user.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
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
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'var(--color-text-muted)',
                      transform: profileMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform var(--transition-fast)',
                    }}
                  />
                </button>

                {profileMenuOpen && (
                  <div
                    data-testid="header-profile-menu"
                    role="menu"
                    className="header-profile-dropdown"
                  >
                    {/* Header Info */}
                    <div style={{ padding: 'var(--space-2) var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div data-testid="profile-menu-name" style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {user.name}
                      </div>
                      <div data-testid="profile-menu-email" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                        {user.email}
                      </div>
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <span
                          data-testid="profile-menu-role"
                          style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-primary-subtle)',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--color-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: 'var(--space-1) 0' }}>
                      <button
                        type="button"
                        role="menuitem"
                        data-testid="profile-menu-view"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          navigate('/account');
                        }}
                        className="header-profile-dropdown-item"
                      >
                        <User size={16} />
                        <span>View Profile</span>
                      </button>

                      {isProfileEditSupported && (
                        <button
                          type="button"
                          role="menuitem"
                          data-testid="profile-menu-edit"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            navigate('/account?mode=edit');
                          }}
                          className="header-profile-dropdown-item"
                        >
                          <Edit3 size={16} />
                          <span>Edit Profile</span>
                        </button>
                      )}

                      <div style={{ height: '1px', backgroundColor: 'var(--color-border-subtle)', margin: 'var(--space-1) 0' }} />

                      <button
                        type="button"
                        role="menuitem"
                        data-testid="profile-menu-logout"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleLogout();
                        }}
                        className="header-profile-dropdown-item danger"
                      >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>


        {/* Main Viewport Content */}
        <main style={{ flex: 1, padding: 'var(--space-4) var(--space-5)', minWidth: 0, backgroundColor: 'var(--color-bg-app)', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
