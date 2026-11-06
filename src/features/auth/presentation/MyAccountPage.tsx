import React, { useState, useEffect, useRef } from 'react';
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
  Eye,
  EyeOff,
  Camera,
  KeyRound,
  ShieldCheck,
  BadgeCheck,
  Info,
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

  // Edit mode state
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

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.avatarUrl || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchFreshProfile = async () => {
      try {
        if (authRepository.getAdminProfile) {
          const freshUser = await authRepository.getAdminProfile();
          if (isMounted && freshUser) {
            setUser(freshUser);
          }
        }
      } catch (err) {
        console.warn('Backend admin profile fetch note:', err);
      }
    };
    fetchFreshProfile();
    return () => {
      isMounted = false;
    };
  }, [setUser]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || user.mobile || '',
      });
      if (user.avatarUrl) {
        setPhotoPreview(user.avatarUrl);
      }
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
      navigate('/auth/login', { replace: true, state: null });
      clearSession();
    }
  };

  const handleBackToWorkstation = () => {
    const target = getDefaultLandingRoute(user);
    navigate(target);
  };

  // --- Photo Handling ---
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Allowed mime types: image/png, image/jpeg, image/webp
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setPhotoError('Invalid image format. Allowed formats: PNG, JPEG, WebP.');
      return;
    }

    // Max 2MB (2 * 1024 * 1024 bytes)
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPhotoError('Image file exceeds the 2MB size limit. Please choose a smaller photo.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (user) {
      setUser({ ...user, avatarUrl: null });
    }
  };

  const handleUploadPhotoNow = async () => {
    if (!photoFile) return;
    setIsUploadingPhoto(true);
    setPhotoError(null);
    try {
      if (authRepository.uploadProfilePhoto) {
        const result = await authRepository.uploadProfilePhoto(photoFile);
        if (user) {
          setUser({ ...user, avatarUrl: result.photoUrl });
        }
        setPhotoPreview(result.photoUrl);
        setPhotoFile(null);
        setSaveSuccess('Profile photo uploaded and updated successfully.');
      } else {
        setPhotoError(
          'Backend API contract gap: The SevaNest backend does not currently provide an admin profile photo upload endpoint.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo.';
      setPhotoError(msg);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // --- Profile Validation & Submit ---
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
      const updatePayload: Record<string, string> = {};
      if (formData.name.trim()) updatePayload.name = formData.name.trim();
      if (formData.email.trim()) updatePayload.email = formData.email.trim();
      if (formData.phone.trim()) updatePayload.phone = formData.phone.trim();

      const updatedUser = await authRepository.updateProfile(updatePayload);
      setUser(updatedUser);
      setSaveSuccess('Profile details successfully updated.');
      setIsEditing(false);
      setSearchParams({}, { replace: true });

      // Refresh displayed profile with backend record
      if (authRepository.getAdminProfile) {
        try {
          const freshProfile = await authRepository.getAdminProfile();
          if (freshProfile) setUser(freshProfile);
        } catch {
          // Ignore refresh network error
        }
      }
    } catch (err: unknown) {
      const is409 =
        (err as { statusCode?: number })?.statusCode === 409 ||
        (err as { code?: string })?.code === 'CONCURRENCY_CONFLICT' ||
        (err as { code?: string })?.code === 'CONFLICT' ||
        (err instanceof Error && /duplicate|already (registered|in use)|conflict/i.test(err.message));

      if (is409) {
        const conflictMsg =
          err instanceof Error && err.message && !err.message.includes('Concurrent modification conflict')
            ? err.message
            : 'Email address or phone number is already registered to another account. Please use a unique email and phone number.';
        setSaveError(conflictMsg);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to update profile. Please try again.';
        setSaveError(msg);
      }
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

  // --- Change Password Validation & Submit ---
  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters.';
    } else if (currentPassword && newPassword === currentPassword) {
      errors.newPassword = 'New password cannot be identical to current password.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Password confirmation is required.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPassword) return;
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!validatePasswordForm()) return;

    setIsSubmittingPassword(true);
    try {
      await authRepository.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(
        'Password successfully updated. All other active sessions have been revoked per security policy.'
      );
      // Clear password fields immediately
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update password. Please check your current password and try again.';
      setPasswordError(msg);
      // Clear passwords on error for security
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmittingPassword(false);
    }
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
        maxWidth: '1080px',
        margin: '0 auto',
        width: '100%',
        paddingBottom: 'var(--space-8)',
      }}
    >
      {/* 1. Page Header Bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-brand-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: 'var(--color-brand-50)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-brand-100)',
              }}
            >
              Enterprise Admin Portal
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Staff Persona & Security
            </span>
          </div>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 800,
              color: 'var(--color-navy)',
              margin: '4px 0 0',
              lineHeight: 1.2,
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
            Manage your administrative persona, credentials, and view server-assigned RBAC permissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Workstation</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              border: '1px solid #fca5a5',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
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
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={16} />
            <span>{saveSuccess}</span>
          </div>
          <button
            onClick={() => setSaveSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
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
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={16} />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Profile Overview Header Banner Card */}
      <div
        data-testid="account-profile-overview-card"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Accent top gradient stripe */}
        <div
          style={{
            height: '8px',
            background: 'linear-gradient(90deg, var(--color-brand-600) 0%, var(--color-brand-400) 50%, #38bdf8 100%)',
          }}
        />

        <div
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-6)',
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar and Identity Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
            {/* Avatar with Camera badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-brand-50)',
                  border: '3px solid #fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  color: 'var(--color-brand-700)',
                  fontWeight: 800,
                  fontSize: '32px',
                }}
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={user.name}
                    data-testid="profile-photo-preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : user.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  <User size={36} />
                )}
              </div>

              {/* Quick photo change upload badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload or change profile photo"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#fff',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <Camera size={14} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                data-testid="profile-photo-input"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoFileSelect}
              />
            </div>

            {/* User Meta */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                  }}
                >
                  {user.name}
                </h2>

                {/* Account status badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-status-success-bg)',
                    color: 'var(--color-status-success-text)',
                    border: '1px solid var(--color-status-success-border)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'currentColor',
                    }}
                  />
                  {effectiveStatus.toUpperCase()}
                </span>
              </div>

              {/* Role & Staff ID row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  marginTop: '6px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Role badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <ShieldCheck size={13} />
                  {getRoleLabel(user.role)}
                </span>

                {/* Staff ID */}
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'monospace',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  ID: {user.staffId || user.id}
                </span>
              </div>

              {photoError && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--color-status-danger-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>{photoError}</span>
                </div>
              )}

              {photoFile && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleUploadPhotoNow}
                    disabled={isUploadingPhoto}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isUploadingPhoto ? 'Uploading...' : 'Save New Photo'}
                  </button>
                  <button
                    type="button"
                    data-testid="remove-photo-button"
                    onClick={handleRemovePhoto}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                      fontSize: '11px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Edit Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isProfileEditSupported && (
              <button
                type="button"
                data-testid="edit-profile-button"
                onClick={() => setIsEditing(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#fff',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Responsive Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Profile Information Card */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <BadgeCheck size={18} style={{ color: 'var(--color-brand-600)' }} />
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
            </div>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}
            >
              Authoritative Records
            </span>
          </div>

          {/* Card Body: Either Edit Form OR Identity Display */}
          {isEditing ? (
            <form
              data-testid="edit-profile-form"
              noValidate
              onSubmit={handleSaveProfile}
              style={{
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              {/* Full Name Input */}
              <div>
                <label
                  htmlFor="edit-profile-name"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: 'var(--color-text-primary)',
                  }}
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
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${formErrors.name ? 'var(--color-error)' : 'var(--color-border)'}`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formErrors.name && (
                  <div
                    data-testid="edit-name-error"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: '4px' }}
                  >
                    {formErrors.name}
                  </div>
                )}
              </div>

              {/* Email Address Input */}
              <div>
                <label
                  htmlFor="edit-profile-email"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: 'var(--color-text-primary)',
                  }}
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
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${formErrors.email ? 'var(--color-error)' : 'var(--color-border)'}`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formErrors.email && (
                  <div
                    data-testid="edit-email-error"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: '4px' }}
                  >
                    {formErrors.email}
                  </div>
                )}
              </div>

              {/* Phone Number Input */}
              <div>
                <label
                  htmlFor="edit-profile-phone"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: 'var(--color-text-primary)',
                  }}
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
                  placeholder="Enter telephone number"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${formErrors.phone ? 'var(--color-error)' : 'var(--color-border)'}`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {formErrors.phone && (
                  <div
                    data-testid="edit-phone-error"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', marginTop: '4px' }}
                  >
                    {formErrors.phone}
                  </div>
                )}
              </div>

              {/* Role (Locked) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Role (Server-Issued)
                </label>
                <div
                  data-testid="edit-role-locked"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{getRoleLabel(user.role)}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <Lock size={12} /> Server-Issued
                  </span>
                </div>
              </div>

              {/* Status (Locked) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Account Status (Server-Issued)
                </label>
                <div
                  data-testid="edit-status-locked"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{effectiveStatus}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <Lock size={12} /> Server-Issued
                  </span>
                </div>
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <button
                  type="button"
                  data-testid="cancel-edit-profile-button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
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
                    border: 'none',
                    backgroundColor: 'var(--color-brand-600)',
                    color: '#fff',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  <Save size={15} />
                  <span>{isSubmitting ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div
              data-testid="account-identity-card"
              style={{
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              {/* Field: Full Name */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Full Name
                  </div>
                  <div
                    data-testid="account-user-name"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}
                  >
                    {user.name}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Primary Contact</span>
              </div>

              {/* Field: Email Address */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Email Address
                  </div>
                  <div
                    data-testid="account-user-email"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px', wordBreak: 'break-all' }}
                  >
                    {user.email}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Login Identifier</span>
              </div>

              {/* Field: Phone Number */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Phone Number
                  </div>
                  <div
                    data-testid="account-user-phone"
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      color: effectivePhone ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      fontStyle: effectivePhone ? 'normal' : 'italic',
                      marginTop: '2px',
                    }}
                  >
                    {effectivePhone || 'Not provided'}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Direct Telephony</span>
              </div>

              {/* Field: Role Designation */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Role Designation
                  </div>
                  <div
                    data-testid="account-user-role"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-brand-700)', marginTop: '2px' }}
                  >
                    {getRoleLabel(user.role)}
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-brand-700)',
                    backgroundColor: 'var(--color-brand-50)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Lock size={11} /> Server-Issued
                </span>
              </div>

              {/* Field: Staff ID */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Staff ID
                  </div>
                  <div
                    data-testid="account-user-id"
                    style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}
                  >
                    Staff ID: {user.staffId || user.id}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>System Identifier</span>
              </div>

              {/* Field: Account Status */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Account Status
                  </div>
                  <div
                    data-testid="account-user-status"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      color: 'var(--color-status-success-text)',
                      marginTop: '2px',
                    }}
                  >
                    {effectiveStatus}
                  </div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-status-success-bg)',
                    color: 'var(--color-status-success-text)',
                    border: '1px solid var(--color-status-success-border)',
                  }}
                >
                  ACTIVE SESSION
                </span>
              </div>

              {/* RBAC Notice */}
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  gap: 'var(--space-2)',
                  alignItems: 'flex-start',
                }}
              >
                <Info size={14} style={{ color: 'var(--color-brand-600)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  Administrative role assignments, permissions, and account statuses are managed centrally through Super Admin governance contracts.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dedicated Change Password Card */}
        <div
          data-testid="account-change-password-card"
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <KeyRound size={18} style={{ color: 'var(--color-brand-600)' }} />
              <h2
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                Change Password
              </h2>
            </div>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}
            >
              Enterprise Security
            </span>
          </div>

          {/* Form Body */}
          <form
            onSubmit={handleChangePassword}
            style={{
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {passwordSuccess && (
              <div
                data-testid="password-change-success"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-success-bg)',
                  border: '1px solid var(--color-status-success-border)',
                  color: 'var(--color-status-success-text)',
                  fontSize: 'var(--font-size-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div
                data-testid="password-change-error"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-danger-bg)',
                  border: '1px solid var(--color-status-danger-border)',
                  color: 'var(--color-status-danger-text)',
                  fontSize: 'var(--font-size-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <AlertTriangle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Current Password Field */}
            <div>
              <label
                htmlFor="current-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '4px',
                }}
              >
                Current Password <span style={{ color: 'var(--color-status-danger-text)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="current-password"
                  data-testid="current-password-input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordErrors.currentPassword) {
                      setPasswordErrors((p) => ({ ...p, currentPassword: '' }));
                    }
                  }}
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      passwordErrors.currentPassword ? 'var(--color-status-danger-border)' : 'var(--color-border)'
                    }`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  data-testid="toggle-current-password-visibility"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-status-danger-text)',
                    marginTop: '2px',
                  }}
                >
                  {passwordErrors.currentPassword}
                </div>
              )}
            </div>

            {/* New Password Field */}
            <div>
              <label
                htmlFor="new-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '4px',
                }}
              >
                New Password <span style={{ color: 'var(--color-status-danger-text)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  data-testid="new-password-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) {
                      setPasswordErrors((p) => ({ ...p, newPassword: '' }));
                    }
                  }}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      passwordErrors.newPassword ? 'var(--color-status-danger-border)' : 'var(--color-border)'
                    }`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  data-testid="toggle-new-password-visibility"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordErrors.newPassword ? (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-status-danger-text)',
                    marginTop: '2px',
                  }}
                >
                  {passwordErrors.newPassword}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Must be at least 8 characters and distinct from your current password.
                </div>
              )}
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label
                htmlFor="confirm-password"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '4px',
                }}
              >
                Confirm New Password <span style={{ color: 'var(--color-status-danger-text)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password"
                  data-testid="confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) {
                      setPasswordErrors((p) => ({ ...p, confirmPassword: '' }));
                    }
                  }}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      passwordErrors.confirmPassword ? 'var(--color-status-danger-border)' : 'var(--color-border)'
                    }`,
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  data-testid="toggle-confirm-password-visibility"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-status-danger-text)',
                    marginTop: '2px',
                  }}
                >
                  {passwordErrors.confirmPassword}
                </div>
              )}
            </div>

            {/* Submit Password Button */}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button
                type="submit"
                data-testid="change-password-button"
                disabled={isSubmittingPassword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  width: '100%',
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-navy)',
                  color: '#fff',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isSubmittingPassword ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingPassword ? 0.7 : 1,
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'opacity var(--transition-fast)',
                }}
              >
                <KeyRound size={15} />
                <span>{isSubmittingPassword ? 'Updating Password...' : 'Save Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 4. Granted Permissions & Role Security Scope Card */}
      <div
        data-testid="account-permissions-scope-card"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldCheck size={18} style={{ color: 'var(--color-brand-600)' }} />
            <h3
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              Assigned Permissions Scope ({user.permissions?.length || 0})
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Role-Based Access Control
          </span>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: 0,
              marginBottom: 'var(--space-4)',
            }}
          >
            Authoritative permissions granted by backend security tokens for the <strong>{getRoleLabel(user.role)}</strong> role:
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {user.permissions && user.permissions.length > 0 ? (
              user.permissions.map((perm) => (
                <span
                  key={perm}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-brand-800)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {perm}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                No explicit fine-grained permissions attached.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
