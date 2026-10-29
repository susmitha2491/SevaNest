import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  ArrowLeft,
  LogOut,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { authRepository } from '../data/authRepository';
import { getRoleLabel, getDefaultLandingRoute } from '../../../core/rbac/permissions';

export const MyAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setUser = useAuthStore((s) => s.setUser);

  const isProfileEditSupported = Boolean(authRepository.supportsProfileUpdate);
  const modeParam = searchParams.get('mode');

  const [isEditing, setIsEditing] = useState(modeParam === 'edit' && isProfileEditSupported);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || user?.mobile || '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || user.mobile || '',
      });
    }
  }, [user]);

  useEffect(() => {
    setIsEditing(modeParam === 'edit' && isProfileEditSupported);
  }, [modeParam, isProfileEditSupported]);

  const handleLogout = async () => {
    try {
      await authRepository.logout();
    } catch (err: unknown) {
      console.warn('Logout notification error encountered:', err);
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true, state: null });
    }
  };

  const handleBackToWorkstation = () => {
    const target = getDefaultLandingRoute(user);
    navigate(target);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Full name is required.';
    }
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please provide a valid email address.';
      }
    }
    if (formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/[\s\-()]/g, '');
      if (!/^\+?[0-9]{7,15}$/.test(phoneDigits)) {
        errors.phone = 'Please provide a valid telephone number (7-15 digits).';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    if (!authRepository.updateProfile) {
      setSaveError('Profile update endpoint is not supported by the current backend API contract.');
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updatedUser = await authRepository.updateProfile({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
      });
      setUser(updatedUser);
      setSaveSuccess('Profile details successfully updated.');
      setIsEditing(false);
      setSearchParams({}, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile. Please try again.';
      setSaveError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || user?.mobile || '',
    });
    setFormErrors({});
    setSaveError(null);
    setIsEditing(false);
    setSearchParams({}, { replace: true });
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>No active authenticated user session found.</p>
        <button
          onClick={() => navigate('/auth/login')}
          style={{
            marginTop: 'var(--space-4)',
            padding: '8px 16px',
            backgroundColor: 'var(--color-brand-600)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      </div>
    );
  }

  const effectivePhone = user.phone || user.mobile;
  const effectiveStatus = user.status || 'Active';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        maxWidth: '740px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              color: 'var(--color-navy)',
              margin: 0,
            }}
          >
            My Account & Staff Profile
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginTop: '4px',
              margin: 0,
            }}
          >
            Authenticated administrator profile and account details.
          </p>
        </div>

        <button
          type="button"
          data-testid="return-workstation-button"
          onClick={handleBackToWorkstation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'background-color var(--transition-fast)',
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Workstation</span>
        </button>
      </div>

      {/* Global Feedback Notifications */}
      {saveSuccess && (
        <div
          data-testid="profile-edit-success"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-success-bg)',
            border: '1px solid var(--color-status-success-border)',
            color: 'var(--color-status-success-text)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div
          data-testid="profile-edit-error"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-status-danger-bg)',
            border: '1px solid var(--color-status-danger-border)',
            color: 'var(--color-status-danger-text)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <AlertTriangle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Single Profile Information Card */}
      <div
        data-testid="account-profile-card"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            Profile Information
          </h2>

          {isProfileEditSupported && !isEditing && (
            <button
              type="button"
              data-testid="edit-profile-button"
              onClick={() => {
                setSaveError(null);
                setSaveSuccess(null);
                setIsEditing(true);
                setSearchParams({ mode: 'edit' }, { replace: true });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: '1px solid var(--color-primary)',
                cursor: 'pointer',
              }}
            >
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {/* Card Content: Edit Form vs Read-Only Details */}
        {isEditing ? (
          <div data-testid="edit-profile-form" style={{ padding: 'var(--space-6)' }}>
            <form noValidate onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="edit-profile-name"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}
                  >
                    Full Name <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    id="edit-profile-name"
                    name="name"
                    type="text"
                    data-testid="edit-name-input"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, name: val }));
                      setFormErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder="Enter full name"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${formErrors.name ? 'var(--color-error)' : 'var(--color-border)'}`,
                      fontSize: 'var(--font-size-sm)',
                      outline: 'none',
                    }}
                  />
                  {formErrors.name && (
                    <p data-testid="edit-name-error" style={{ color: 'var(--color-error)', fontSize: '11px', margin: '4px 0 0' }}>{formErrors.name}</p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="edit-profile-email"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}
                  >
                    Email Address
                  </label>
                  <input
                    id="edit-profile-email"
                    name="email"
                    type="email"
                    data-testid="edit-email-input"
                    value={formData.email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, email: val }));
                      setFormErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    placeholder="Enter email address"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${formErrors.email ? 'var(--color-error)' : 'var(--color-border)'}`,
                      fontSize: 'var(--font-size-sm)',
                      outline: 'none',
                    }}
                  />
                  {formErrors.email && (
                    <p data-testid="edit-email-error" style={{ color: 'var(--color-error)', fontSize: '11px', margin: '4px 0 0' }}>{formErrors.email}</p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="edit-profile-phone"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}
                  >
                    Phone Number
                  </label>
                  <input
                    id="edit-profile-phone"
                    name="phone"
                    type="tel"
                    data-testid="edit-phone-input"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, phone: val }));
                      setFormErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${formErrors.phone ? 'var(--color-error)' : 'var(--color-border)'}`,
                      fontSize: 'var(--font-size-sm)',
                      outline: 'none',
                    }}
                  />
                  {formErrors.phone && (
                    <p data-testid="edit-phone-error" style={{ color: 'var(--color-error)', fontSize: '11px', margin: '4px 0 0' }}>{formErrors.phone}</p>
                  )}
                </div>

                {/* Role (Locked) */}
                <div>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}
                  >
                    <span>Role</span>
                    <Lock size={12} color="var(--color-text-muted)" />
                  </label>
                  <div
                    data-testid="edit-role-locked"
                    style={{
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-disabled)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{getRoleLabel(user.role)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Server-Issued</span>
                  </div>
                </div>

                {/* Account Status (Locked) */}
                <div>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}
                  >
                    <span>Account Status</span>
                    <Lock size={12} color="var(--color-text-muted)" />
                  </label>
                  <div
                    data-testid="edit-status-locked"
                    style={{
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-disabled)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{effectiveStatus}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Server-Issued</span>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  data-testid="cancel-edit-profile-button"
                  disabled={isSubmitting}
                  onClick={handleCancelEdit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    border: '1px solid var(--color-border)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <X size={15} />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  data-testid="save-profile-button"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Save size={15} />
                  <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div data-testid="account-identity-card" style={{ padding: 'var(--space-6)' }}>
            {/* Top Avatar + Identity Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-5)',
                paddingBottom: 'var(--space-6)',
                borderBottom: '1px solid var(--color-border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              {/* Profile avatar with the user's initial */}
              <div
                data-testid="account-profile-avatar"
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '24px',
                  border: '2px solid var(--color-primary)',
                  flexShrink: 0,
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : <User size={28} />}
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h3
                    data-testid="account-user-name"
                    style={{
                      fontSize: 'var(--font-size-xl)',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      margin: 0,
                    }}
                  >
                    {user.name}
                  </h3>
                  <span
                    data-testid="account-user-status"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor:
                        effectiveStatus.toUpperCase() === 'ACTIVE'
                          ? 'var(--color-status-success-bg)'
                          : 'var(--color-bg-subtle)',
                      color:
                        effectiveStatus.toUpperCase() === 'ACTIVE'
                          ? 'var(--color-status-success-text)'
                          : 'var(--color-text-secondary)',
                      border: `1px solid ${
                        effectiveStatus.toUpperCase() === 'ACTIVE'
                          ? 'var(--color-status-success-border)'
                          : 'var(--color-border)'
                      }`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {effectiveStatus}
                  </span>
                </div>
                {user.id && (
                  <div style={{ marginTop: '4px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    <span data-testid="account-user-id" style={{ fontFamily: 'monospace' }}>
                      Staff ID: {user.id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Details Grid */}
            <div
              style={{
                paddingTop: 'var(--space-6)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 'var(--space-5)',
              }}
            >
              {/* Full Name */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Full Name
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                  {user.name || 'Not provided'}
                </div>
              </div>

              {/* Email Address */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Email Address
                </div>
                <div data-testid="account-user-email" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px', wordBreak: 'break-all' }}>
                  {user.email || 'Not provided'}
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Phone Number
                </div>
                <div data-testid="account-user-phone" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: effectivePhone ? 'var(--color-text-primary)' : 'var(--color-text-muted)', marginTop: '4px' }}>
                  {effectivePhone || 'Not provided'}
                </div>
              </div>

              {/* Role */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Role
                </div>
                <div data-testid="account-user-role" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                  {getRoleLabel(user.role)}
                </div>
              </div>

              {/* Account Status */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Account Status
                </div>
                <div data-testid="account-status-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                  {effectiveStatus}
                </div>
              </div>
            </div>

            {/* Card Footer: Sign Out Action */}
            <div
              style={{
                marginTop: 'var(--space-6)',
                paddingTop: 'var(--space-5)',
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                data-testid="account-logout-button"
                onClick={handleLogout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-danger-bg)',
                  color: 'var(--color-status-danger-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: '1px solid var(--color-status-danger-border)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
