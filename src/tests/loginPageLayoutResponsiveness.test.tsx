import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../app/layouts/PublicLayout';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { useAuthStore } from '../core/auth/authStore';

// Mock authRepository to avoid real network calls
vi.mock('../features/auth/data/authRepository', () => ({
  authRepository: {
    login: vi.fn(),
  },
  invalidateSessionOnServer: vi.fn().mockResolvedValue(undefined),
}));

describe('Login Page Layout & Responsiveness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession(false);
  });

  it('renders PublicLayout with container and constrained logo dimensions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/auth/login" element={<div>Login Content Mock</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify container and content wrapper classes
    const layoutContainer = container.querySelector('.public-layout-container');
    expect(layoutContainer).not.toBeNull();

    const layoutContent = container.querySelector('.public-layout-content');
    expect(layoutContent).not.toBeNull();

    // Verify logo exists and has constrained height
    const logoImg = screen.getByAltText('SevaNest logo');
    expect(logoImg).not.toBeNull();
    expect(logoImg.style.height).toBe('38px');
    expect(logoImg.style.maxHeight).toBe('42px');
    expect(logoImg.style.maxWidth).toBe('160px');
    expect(logoImg.style.objectFit).toBe('contain');

    // Verify portal subtitle and footer are rendered
    expect(screen.getByText('Operations & Administration Portal')).toBeDefined();
    expect(screen.getByText(/Verified Help\. Trusted Homes\. • SevaNest Admin/i)).toBeDefined();
  });

  it('renders SignInPage with email, password, and full Quick Login section with 4 roles', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/auth/login" element={<SignInPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify main card
    const card = container.querySelector('.login-card');
    expect(card).not.toBeNull();

    // Verify title and input controls
    expect(screen.getByRole('heading', { name: /Staff Sign In/i })).toBeDefined();
    expect(screen.getByLabelText(/Admin Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/Password \*/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In to Operations Console/i })).toBeDefined();

    // Verify Quick Login section is present
    expect(screen.getByText(/Quick Login — Select Your Role/i)).toBeDefined();
    expect(screen.getByText('4 Roles')).toBeDefined();

    // Verify all 4 administrative persona cards are rendered
    expect(screen.getByTestId('quick-login-card-super-admin')).toBeDefined();
    expect(screen.getByTestId('quick-login-card-ops-admin')).toBeDefined();
    expect(screen.getByTestId('quick-login-card-verification-exec')).toBeDefined();
    expect(screen.getByTestId('quick-login-card-support-exec')).toBeDefined();

    // Verify polished input styling classes
    const inputGroups = container.querySelectorAll('.login-input-group');
    expect(inputGroups.length).toBe(2);

    const inputWrappers = container.querySelectorAll('.login-input-wrapper');
    expect(inputWrappers.length).toBe(2);

    const passwordToggle = container.querySelector('.login-password-toggle');
    expect(passwordToggle).not.toBeNull();

    // Verify password visibility toggle
    const passwordInput = screen.getByLabelText(/Password \*/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    if (passwordToggle) {
      fireEvent.click(passwordToggle);
      expect(passwordInput.type).toBe('text');
      fireEvent.click(passwordToggle);
      expect(passwordInput.type).toBe('password');
    }

    // Verify clicking a role card populates the email and password fields
    const superAdminCard = screen.getByTestId('quick-login-card-super-admin');
    fireEvent.click(superAdminCard);

    const emailInput = screen.getByLabelText(/Admin Email Address/i) as HTMLInputElement;
    expect(emailInput.value).toBe('sevanest@admin.in');
    expect(passwordInput.value).toBe('Sevanest@2026');
  });
});
