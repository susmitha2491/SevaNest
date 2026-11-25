/* global Event, CustomEvent */
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { authRepository } from '../../features/auth/data/authRepository';
import { getRoleLabel } from '../../core/rbac/permissions';
import { getAccessibleNavigation } from '../../core/rbac/navigationRegistry';
import { SessionInactivityGuard } from '../../core/auth/SessionInactivityGuard';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const profileMenuRef = useRef<React.ComponentRef<'div'>>(null);
  const mainViewportRef = useRef<React.ComponentRef<'main'>>(null);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const location = useLocation();

  const accessibleModules = getAccessibleNavigation(user);

  // Reset main content scroll position to top on route navigation
  useEffect(() => {
    if (mainViewportRef.current) {
      mainViewportRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Expandable sidebar modules state (automatically expanded when viewing module routes)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => ({
    verification: location.pathname.startsWith('/verification'),
  }));

  const lastVerificationPathRef = useRef<string>(location.pathname);
  useEffect(() => {
    if (location.pathname.startsWith('/verification') && location.pathname !== lastVerificationPathRef.current) {
      lastVerificationPathRef.current = location.pathname;
      setExpandedModules((prev) => ({ ...prev, verification: true }));
    }
  }, [location.pathname]);

  // Close mobile drawer on navigation or route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown as (e: unknown) => void);
    }
    return () => window.removeEventListener('keydown', handleKeyDown as (e: unknown) => void);
  }, [mobileMenuOpen]);

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
      clearSession();
      navigate('/auth/login', { replace: true, state: null });
    }
  };

  return (
    <div
      className="app-shell-root"
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-app)',
        width: '100%',
      }}
    >
      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-sidebar-backdrop ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar Navigation */}
      <aside
        className={`portal-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--transition-normal)',
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          overscrollBehavior: 'contain',
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
            justifyContent: sidebarOpen ? 'space-between' : 'space-between',
            padding: sidebarOpen ? '0 var(--space-3)' : '0 6px',
            borderBottom: '1px solid var(--color-border-subtle)',
            gap: sidebarOpen ? 'var(--space-2)' : '4px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
              <img
                src="/SevaNest_logo-removebg-preview.png"
                alt="SevaNest logo"
                style={{
                  height: '28px',
                  maxWidth: '125px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '28px',
                width: '28px',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <img
                src="/SevaNest_logo-removebg-preview.png"
                alt="SevaNest logo"
                style={{
                  height: '28px',
                  maxWidth: '28px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setMobileMenuOpen(false);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            style={{
              color: 'var(--color-text-muted)',
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav Sections */}
        <div
          className="sidebar-nav-scroll"
          data-testid="sidebar-nav-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            padding: 'var(--space-2) 0 var(--space-4) 0',
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: sidebarOpen ? '0 var(--space-2)' : '0 4px' }}>
            {accessibleModules.map((mod) => {
              const Icon = mod.icon;
              const hasSubItems = Boolean(mod.subItems && mod.subItems.length > 0);
              const isParentExpanded = Boolean(
                expandedModules[mod.id] ?? location.pathname.startsWith(mod.path)
              );
              const isSubmenuRouteActive = hasSubItems && location.pathname.startsWith(mod.path);

              const isItemActive =
                !hasSubItems && (
                  (mod.path === '/verification' && (mod.end ? (location.pathname === '/verification' || location.pathname === '/verification/') : location.pathname.startsWith('/verification'))) ||
                  (mod.path === '/bookings' && (location.pathname.startsWith('/bookings') || location.pathname.startsWith('/replacements'))) ||
                  (mod.path === '/support' && (location.pathname.startsWith('/support') || location.pathname === '/support')) ||
                  (mod.path === '/workers' && (location.pathname === '/workers' || (location.pathname.startsWith('/workers') && !location.pathname.startsWith('/workers/directory')))) ||
                  (mod.path === '/workers/directory' && location.pathname.startsWith('/workers/directory')) ||
                  (mod.path === '/directory' && location.pathname.startsWith('/directory')) ||
                  (mod.path === '/customers' && location.pathname.startsWith('/customers')) ||
                  (mod.path === '/payments' && location.pathname.startsWith('/payments')) ||
                  (mod.path === '/reports' && location.pathname.startsWith('/reports')) ||
                  (mod.path === '/configuration' && location.pathname.startsWith('/configuration')) ||
                  (mod.path === '/audit' && location.pathname.startsWith('/audit')) ||
                  (mod.path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/support/dashboard'))
                );

              return (
                <div key={mod.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <NavLink
                    to={mod.path}
                    end={hasSubItems ? true : (mod.end ?? (mod.path === '/dashboard' || (mod.path === '/verification' && !hasSubItems) || mod.path === '/workers'))}
                    className={({ isActive }) => (!hasSubItems && (isActive || isItemActive) ? 'active' : '')}
                    onClick={(e) => {
                      if (hasSubItems) {
                        // If user is already on a verification page, toggle expand/collapse without re-navigating
                        if (location.pathname.startsWith(mod.path)) {
                          e.preventDefault();
                        }
                        setExpandedModules((prev) => {
                          const currentlyExpanded = prev[mod.id] ?? location.pathname.startsWith(mod.path);
                          return {
                            ...prev,
                            [mod.id]: !currentlyExpanded,
                          };
                        });
                        if (!sidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024) {
                          setSidebarOpen(true);
                        }
                      } else {
                        setMobileMenuOpen(false);
                      }
                    }}
                    style={({ isActive }) => {
                      const active = !hasSubItems && (isActive || isItemActive);
                      const bg = active
                        ? 'var(--color-primary-subtle)'
                        : isSubmenuRouteActive
                          ? 'var(--color-bg-subtle, #f8fafc)'
                          : 'transparent';

                      const textColor = active
                        ? 'var(--color-primary)'
                        : 'var(--color-text-secondary)';

                      const border = active
                        ? '3px solid var(--color-primary)'
                        : '3px solid transparent';

                      return {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        height: '32px',
                        padding: sidebarOpen ? '0 10px' : '0',
                        width: '100%',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: active ? 600 : 500,
                        backgroundColor: bg,
                        color: textColor,
                        borderLeft: border,
                        transition: 'all var(--transition-fast)',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        whiteSpace: 'nowrap',
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                      };
                    }}
                    aria-expanded={hasSubItems ? isParentExpanded : undefined}
                    title={!sidebarOpen ? mod.name : undefined}
                  >
                    {Icon && <Icon size={16} style={{ flexShrink: 0 }} />}
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
                    {sidebarOpen && hasSubItems && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginLeft: 'auto',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {isParentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                    {!sidebarOpen && !Icon && (
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>
                        {mod.name.charAt(0)}
                      </span>
                    )}
                  </NavLink>

                  {/* Expandable Submenus (e.g. for Verification Executive) */}
                  {hasSubItems && isParentExpanded && sidebarOpen && mod.subItems && (
                    <div
                      role="group"
                      aria-label={`${mod.name} submenus`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        paddingLeft: '14px',
                        marginTop: '2px',
                        marginBottom: '4px',
                        borderLeft: '2px solid var(--color-border-subtle, #e2e8f0)',
                        marginLeft: '16px',
                      }}
                    >
                      {mod.subItems.map((sub) => {
                        const isSubActive =
                          sub.path === '/verification'
                            ? (location.pathname === '/verification' || location.pathname === '/verification/')
                            : location.pathname.startsWith(sub.path);

                        return (
                          <NavLink
                            key={sub.id}
                            to={sub.path}
                            end={sub.end ?? (sub.path === '/verification')}
                            className={({ isActive }) => (isSubActive || isActive ? 'active' : '')}
                            onClick={() => setMobileMenuOpen(false)}
                            style={({ isActive }) => {
                              const active = isSubActive || isActive;
                              return {
                                display: 'flex',
                                alignItems: 'center',
                                height: '28px',
                                padding: '0 8px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-xs, 12px)',
                                fontWeight: active ? 600 : 500,
                                backgroundColor: active ? 'var(--color-primary-subtle)' : 'transparent',
                                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box',
                                transition: 'all var(--transition-fast)',
                              };
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              {sub.name}
                            </span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Info / Sign-out */}
        <div
          style={{
            flexShrink: 0,
            padding: 'var(--space-2)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          {sidebarOpen && user && (
            <div style={{ marginBottom: 'var(--space-1)', padding: '0 var(--space-1)' }}>
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
            onClick={() => setMobileMenuOpen(false)}
            style={({ isActive }) => ({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              height: '30px',
              padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
              textDecoration: 'none',
              marginBottom: '3px',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            })}
            title={!sidebarOpen ? 'My Account' : undefined}
          >
            <User size={14} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>My Account</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              height: '30px',
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
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className="app-main-column"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Header Bar */}
        <header
          style={{
            minHeight: 'var(--header-height)',
            height: 'auto',
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            zIndex: 45,
            flexWrap: 'wrap',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Mobile Navigation Trigger & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div className="mobile-header-brand">
              <img
                src="/SevaNest_logo-removebg-preview.png"
                alt="SevaNest logo"
                style={{
                  height: '24px',
                  maxWidth: '115px',
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* Header Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
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
                      width: '28px',
                      height: '28px',
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
                      <User size={14} />
                    )}
                  </div>
                  <div className="header-user-info-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
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
                    size={12}
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
        <main
          ref={mainViewportRef}
          className="app-main-viewport"
          data-testid="app-main-viewport"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            overscrollBehavior: 'contain',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-app)',
          }}
        >
          <Outlet />
        </main>
        <SessionInactivityGuard />
      </div>
    </div>
  );
};
