/* global Event, CustomEvent */
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Edit3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { authRepository } from '../../features/auth/data/authRepository';
import { getRoleLabel } from '../../core/rbac/permissions';
import { getAccessibleNavigation } from '../../core/rbac/navigationRegistry';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const profileMenuRef = useRef<React.ComponentRef<'div'>>(null);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileEditSupported = Boolean(authRepository.supportsProfileUpdate);

  const accessibleModules = getAccessibleNavigation(user);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: 'success' | 'error' }>;
      if (customEvent.detail?.message) {
        setGlobalToast(customEvent.detail);
        setTimeout(() => setGlobalToast(null), 5000);
      }
    };
    window.addEventListener('sevanest:toast', handleToast);
    return () => window.removeEventListener('sevanest:toast', handleToast);
  }, []);

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
      navigate('/auth/login', { replace: true, state: null });
      clearSession();
    }
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
          flexShrink: 0,
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
            flexShrink: 0,
          }}
        >
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
              <img
                src="/SevaNest_logo-removebg-preview.png"
                alt="SevaNest logo"
                style={{
                  height: '44px',
                  maxWidth: '160px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <img
              src="/SevaNest_logo-removebg-preview.png"
              alt="SevaNest logo"
              style={{
                height: '34px',
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
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--space-3) 0' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 var(--space-2)' }}>
            {accessibleModules.map((mod) => {
              const Icon = mod.icon;

              return (
                <div key={mod.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <NavLink
                    to={mod.path}
                    end={mod.end ?? (mod.path === '/dashboard' || mod.path === '/verification' || mod.path === '/workers')}
                    style={({ isActive }) => {
                      const isItemActive =
                        isActive ||
                        (mod.path === '/verification' && location.pathname.startsWith('/verification')) ||
                        (mod.path === '/bookings' && (location.pathname.startsWith('/bookings') || location.pathname.startsWith('/replacements'))) ||
                        (mod.path === '/support' && (location.pathname.startsWith('/support') || location.pathname === '/support')) ||
                        (mod.path === '/workers' && location.pathname === '/workers') ||
                        (mod.path === '/workers/directory' && location.pathname.startsWith('/workers/directory')) ||
                        (mod.path === '/customers' && location.pathname.startsWith('/customers')) ||
                        (mod.path === '/payments' && location.pathname.startsWith('/payments')) ||
                        (mod.path === '/reports' && location.pathname.startsWith('/reports')) ||
                        (mod.path === '/configuration' && location.pathname.startsWith('/configuration')) ||
                        (mod.path === '/audit' && location.pathname.startsWith('/audit')) ||
                        (mod.path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/support/dashboard'));

                      return {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        height: '38px',
                        padding: '0 12px',
                        width: '100%',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: isItemActive ? 600 : 500,
                        backgroundColor: isItemActive ? 'var(--color-primary-subtle)' : 'transparent',
                        color: isItemActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        borderLeft: isItemActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        transition: 'all var(--transition-fast)',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        whiteSpace: 'nowrap',
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                      };
                    }}
                    title={!sidebarOpen ? mod.name : undefined}
                  >
                    {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
                    {sidebarOpen && (
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {mod.name}
                      </span>
                    )}
                    {!sidebarOpen && !Icon && (
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>
                        {mod.name.charAt(0)}
                      </span>
                    )}
                  </NavLink>
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Info / Sign-out */}
        <div
          style={{
            flexShrink: 0,
            padding: 'var(--space-3)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {sidebarOpen && user && (
            <div style={{ marginBottom: 'var(--space-2)', padding: '0 var(--space-2)' }}>
              <div
                data-testid="sidebar-user-name"
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </div>
              <div
                data-testid="sidebar-user-role"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
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
              height: '34px',
              padding: '0 var(--space-2)',
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
            <User size={16} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>My Account</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              height: '34px',
              padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-status-danger-text)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
            title={!sidebarOpen ? 'Sign Out' : undefined}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
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
            justifyContent: 'flex-end',
            padding: '0 var(--space-5)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Header Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
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
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
                      />
                    ) : user.name ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <User size={16} />
                    )}
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


        {/* Global Toast Notification */}
        {globalToast && (
          <div
            role="status"
            aria-live="polite"
            data-testid="global-success-toast"
            style={{
              position: 'fixed',
              top: '16px',
              right: '24px',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
              backgroundColor: globalToast.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${globalToast.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: globalToast.type === 'success' ? '#065f46' : '#991b1b',
              fontWeight: 600,
              fontSize: '13px',
              animation: 'slideIn 0.2s ease-out',
            }}
          >
            {globalToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{globalToast.message}</span>
          </div>
        )}

        {/* Main Viewport Content */}
        <main style={{ flex: 1, padding: 'var(--space-4) var(--space-5)', minWidth: 0, backgroundColor: 'var(--color-bg-app)', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
