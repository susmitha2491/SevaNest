import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Super Admin Configuration & System Masters Workflows', () => {
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

  it('renders configuration console with fee plans and side-by-side draft inputs', async () => {
    renderWithProviders(<ConfigurationMastersPage />);

    expect(
      await screen.findByRole('heading', { name: /Platform Configuration Masters/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Commercial Pricing Schedule \(Draft Workspace\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Maid One-Time Booking & Matching Fee/i)).toBeInTheDocument();
    expect(screen.getByText(/Driver Monthly Placement Commission/i)).toBeInTheDocument();
  });

  it('modifies draft fee, opens diff preview, and publishes with mandatory operational rationale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Modify draft value for maid fee
    const feeInput = (await screen.findAllByRole('spinbutton'))[0];
    await user.clear(feeInput);
    await user.type(feeInput, '599');

    // Click Diff Preview
    const diffBtn = screen.getByRole('button', { name: /View Diff Preview/i });
    await user.click(diffBtn);
    expect(await screen.findByRole('heading', { name: /Commercial Fee Schedule — Diff Preview/i })).toBeInTheDocument();

    // Close preview
    const closeDiffBtn = screen.getByRole('button', { name: /Close Preview/i });
    await user.click(closeDiffBtn);

    // Click Publish Fee Schedule
    const publishBtn = screen.getByRole('button', { name: /Publish Fee Schedule/i });
    expect(publishBtn).toBeEnabled();
    await user.click(publishBtn);

    // Verify confirmation dialog
    expect(await screen.findByRole('heading', { name: /Publish Commercial Pricing Schedule/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Publish Fees/i });
    expect(confirmBtn).toBeDisabled();

    // Enter mandatory remarks and check confirmation box
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory commercial and operational justification/i);
    await user.type(remarksInput, 'Q3 annual commercial price adjustment.');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);

    expect(await screen.findByText(/Commercial fee schedule published successfully/i)).toBeInTheDocument();
  });

  it('switches to service categories tab, edits category skills taxonomy, and publishes updates', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const categoriesTab = await screen.findByRole('button', { name: /Service Categories & Skills/i });
    await user.click(categoriesTab);

    expect(await screen.findByRole('heading', { name: /Service Categories & Workforce Skills Taxonomy/i })).toBeInTheDocument();
    expect(screen.getByText(/House Maid/i)).toBeInTheDocument();

    // Click edit on House Maid category
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editButtons[0]);

    expect(await screen.findByRole('heading', { name: /Edit Category: House Maid/i })).toBeInTheDocument();

    // Add new skill tag
    const skillInput = screen.getByPlaceholderText(/Add new skill tag/i);
    await user.type(skillInput, 'Custom Balcony Scrubbing');
    const addSkillBtn = screen.getByRole('button', { name: /Add Skill/i });
    await user.click(addSkillBtn);

    expect(screen.getByText('Custom Balcony Scrubbing')).toBeInTheDocument();

    // Click save category draft
    const saveCategoryBtn = screen.getByRole('button', { name: /Save Category Draft/i });
    await user.click(saveCategoryBtn);

    // Confirm dialog
    expect(await screen.findByRole('heading', { name: /Publish Updates to House Maid/i })).toBeInTheDocument();
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational rationale for category/i);
    await user.type(remarksInput, 'Expanded cleaning skill checklist.');

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Publish Category/i });
    await user.click(confirmBtn);

    expect(await screen.findByText(/Service category taxonomy updated successfully/i)).toBeInTheDocument();
  });

  it('displays NoAccessView when user lacks configuration.manage permission', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Officer',
        email: 'ops@sevanest.local',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.BOOKINGS_VIEW],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
  });
});
