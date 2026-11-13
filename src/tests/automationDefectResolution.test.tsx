import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { PublicLayout } from '../app/layouts/PublicLayout';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { CustomSelect } from '../components/common/CustomSelect';
import { queryClient } from '../core/api/queryClient';

describe('Automation Defect Resolution Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('1. Login Page Accessibility & Landmark Structure (BUG-010, BUG-012, BUG-013, BUG-014, BUG-024, BUG-053)', () => {
    it('renders exactly one level-one heading (h1) for Staff Sign In', () => {
      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/auth/login" element={<SignInPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      const h1Headings = screen.getAllByRole('heading', { level: 1 });
      expect(h1Headings).toHaveLength(1);
      expect(h1Headings[0]).toHaveTextContent(/Staff Sign In/i);
    });

    it('contains main landmark (role="main") and banner header (role="banner")', () => {
      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/auth/login" element={<SignInPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });
  });

  describe('2. Login Touch Targets & Accessible Alerts (BUG-017, BUG-043, BUG-060)', () => {
    it('ensures submit button has accessible name and height >= 44px for touch viewports', () => {
      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/auth/login" element={<SignInPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      const submitButton = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(submitButton.style.minHeight).toBe('44px');
    });

    it('exposes field validation error messages with role="alert" and aria-live="polite"', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/auth/login" element={<SignInPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      const submitButton = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThanOrEqual(1);
        for (const alert of alerts) {
          expect(alert).toHaveAttribute('aria-live', 'polite');
        }
      });
    });
  });

  describe('3. Dropdown Filter Functionality (BUG-028, BUG-029, BUG-049, BUG-050)', () => {
    it('renders dropdown select with options and accessible label', () => {
      const handleChange = vi.fn();
      render(
        <CustomSelect
          value="ALL"
          onChange={handleChange}
          options={[
            { value: 'ALL', label: 'All Categories' },
            { value: 'COOKING', label: 'Cooking' },
          ]}
          ariaLabel="Filter by service category"
          testId="category-filter"
        />
      );

      const selectElement = screen.getByTestId('category-filter');
      expect(selectElement).toBeInTheDocument();
      expect(selectElement).toHaveAttribute('aria-label', 'Filter by service category');
      expect(screen.getAllByText('All Categories').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Robots.txt, Security Headers & Gzip Compression (BUG-002, BUG-006, BUG-035, BUG-036 - BUG-041)', () => {
    it('provides public/robots.txt with search disallow rules', () => {
      const robotsPath = path.resolve(process.cwd(), 'public/robots.txt');
      expect(fs.existsSync(robotsPath)).toBe(true);

      const content = fs.readFileSync(robotsPath, 'utf8');
      expect(content).toContain('User-agent: *');
      expect(content).toContain('Disallow: /');
    });

    it('contains comprehensive security response headers in nginx.conf', () => {
      const nginxPath = path.resolve(process.cwd(), 'nginx.conf');
      expect(fs.existsSync(nginxPath)).toBe(true);

      const nginxConfig = fs.readFileSync(nginxPath, 'utf8');
      expect(nginxConfig).toContain('X-Frame-Options "SAMEORIGIN"');
      expect(nginxConfig).toContain('X-Content-Type-Options "nosniff"');
      expect(nginxConfig).toContain('Content-Security-Policy');
      expect(nginxConfig).toContain('Permissions-Policy');
      expect(nginxConfig).toContain('Referrer-Policy');
      expect(nginxConfig).toContain('gzip_min_length 100;');
    });

    it('contains security headers in vercel.json', () => {
      const vercelPath = path.resolve(process.cwd(), 'vercel.json');
      expect(fs.existsSync(vercelPath)).toBe(true);

      const vercelConfig = fs.readFileSync(vercelPath, 'utf8');
      expect(vercelConfig).toContain('Content-Security-Policy');
      expect(vercelConfig).toContain('X-Content-Type-Options');
      expect(vercelConfig).toContain('X-Frame-Options');
      expect(vercelConfig).toContain('Permissions-Policy');
    });
  });

  describe('5. Offline Recovery Configuration (BUG-005)', () => {
    it('configures queryClient default options with refetchOnReconnect and offlineFirst', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnReconnect).toBe(true);
      expect(defaultOptions.queries?.networkMode).toBe('offlineFirst');
    });
  });
});

