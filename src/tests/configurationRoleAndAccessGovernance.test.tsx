import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/configuration') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/configuration" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Configuration Role-Based Access Governance & Workflows', () => {
  describe('Operations Admin View & RBAC Filtering', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-OPS-01',
          name: 'Operations Admin User',
          email: 'opsadmin@sevanest.local',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CATEGORY_MANAGE,
            PERMISSIONS.AREA_MANAGE,
            PERMISSIONS.NOTIFICATION_MANAGE,
            PERMISSIONS.DASHBOARD_VIEW,
          ],
        },
        isAuthenticated: true,
      });
    });

    it('renders only the 3 authorized configuration sections for Operations Admin and defaults to categories tab', async () => {
      renderWithProviders(<ConfigurationMastersPage />);

      expect(await screen.findByRole('heading', { name: /Platform Configuration Masters/i })).toBeInTheDocument();

      // Only categories, areas, templates should exist
      expect(screen.getByTestId('config-section-categories')).toBeInTheDocument();
      expect(screen.getByTestId('config-section-areas')).toBeInTheDocument();
      expect(screen.getByTestId('config-section-templates')).toBeInTheDocument();

      // Forbidden sections must not be present in selector
      expect(screen.queryByTestId('config-section-fees')).not.toBeInTheDocument();
      expect(screen.queryByTestId('config-section-roles')).not.toBeInTheDocument();
      expect(screen.queryByTestId('config-section-adminUsers')).not.toBeInTheDocument();
      expect(screen.queryByTestId('config-section-security')).not.toBeInTheDocument();

      // Default active tab must be categories
      const categoriesTab = screen.getByTestId('config-section-categories');
      expect(categoriesTab).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByRole('heading', { name: /Service Categories & Workforce Skills Taxonomy/i })).toBeInTheDocument();
    });

    it('displays NoAccessView when Operations Admin navigates directly to ?tab=fees', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=fees');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Commercial Pricing & Fee Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });

    it('displays NoAccessView when Operations Admin navigates directly to ?tab=roles', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=roles');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Role-Based Access Control Governance Matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/roles\.manage/i)).toBeInTheDocument();
    });

    it('displays NoAccessView when Operations Admin navigates directly to ?tab=adminUsers', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=adminUsers');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Administrative Staff & Role Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });

    it('displays NoAccessView when Operations Admin navigates directly to ?tab=security', async () => {
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=security');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Session & Security Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });

    it('allows Operations Admin to open Add Service Category modal and submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const addBtn = await screen.findByRole('button', { name: /Add Service Category/i });
      await user.click(addBtn);

      expect(await screen.findByRole('heading', { name: /Add New Service Category/i })).toBeInTheDocument();

      const codeInput = screen.getByPlaceholderText('COOK');
      const nameInput = screen.getByPlaceholderText('Cook & Chef');
      const descInput = screen.getByPlaceholderText(/Professional meal prep/i);

      await user.type(codeInput, 'CHEF');
      await user.type(nameInput, 'Private Chef');
      await user.type(descInput, 'Gourmet home cooking services');

      const submitBtn = screen.getByRole('button', { name: /Provision Category/i });
      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      expect(await screen.findByText(/Service category provisioned successfully/i)).toBeInTheDocument();
    });
  });

  describe('Super Admin Full Master Governance & Workflows', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'STAFF-SUPER-01',
          name: 'Super Administrator',
          email: 'superadmin@sevanest.local',
          role: 'SUPER_ADMIN',
          permissions: Object.values(PERMISSIONS),
        },
        isAuthenticated: true,
      });
    });

    it('verifies Session & Security contains only administrative security controls and excludes mobile runtime settings', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=security');

      // Genuine administrative security controls
      expect(await screen.findByRole('heading', { name: /Session Governance & Security Settings/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Automated Session Inactivity Logout/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Active Administrator Token Sessions/i })).toBeInTheDocument();

      // Mobile runtime settings table and controls are strictly excluded from the Admin Website
      expect(screen.queryByRole('heading', { name: /Platform Application Runtime Settings/i })).not.toBeInTheDocument();
      expect(screen.queryByText('maintenance')).not.toBeInTheDocument();
      expect(screen.queryByText('supportPhone')).not.toBeInTheDocument();
      expect(screen.queryByText('customerMinVersion')).not.toBeInTheDocument();
      expect(screen.queryByText('workerMinVersion')).not.toBeInTheDocument();

      // Administrative security setting interaction: change inactivity timeout to 10 minutes
      const option10 = screen.getByTestId('timeout-option-10');
      await user.click(option10);
      expect(option10).toBeChecked();
    });

    it('allows Super Admin to open Add Operational Area modal and submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=areas');

      const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
      await user.click(addBtn);

      expect(await screen.findByRole('heading', { name: /Add New Operational Area/i })).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(/e\.g\. Kondapur Hub/i);
      await user.type(nameInput, 'Hitec City Core');

      const submitBtn = screen.getByRole('button', { name: /Save Area|Provision Area/i });
      await user.click(submitBtn);

      expect(await screen.findByText(/Operational area cluster provisioned successfully/i)).toBeInTheDocument();
    });

    it('allows Super Admin to open Add Notification Template modal and submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />, '/configuration?tab=templates');

      const addBtn = await screen.findByRole('button', { name: /Add Notification Template/i });
      await user.click(addBtn);

      expect(await screen.findByRole('heading', { name: /Add Notification Template/i })).toBeInTheDocument();

      const eventInput = screen.getByPlaceholderText('BOOKING_CONFIRMED');
      const titleInput = screen.getByPlaceholderText(/Booking Confirmed!/i);
      const bodyInput = screen.getByPlaceholderText(/Your booking #/i);

      await user.type(eventInput, 'PAYMENT_RECEIVED');
      await user.type(titleInput, 'Payment Received');
      await user.type(bodyInput, 'We have received your payment of {{amount}}.');

      const submitBtn = screen.getByRole('button', { name: /Provision Template/i });
      await user.click(submitBtn);

      expect(await screen.findByText(/Notification template provisioned successfully/i)).toBeInTheDocument();
    });
  });
});
