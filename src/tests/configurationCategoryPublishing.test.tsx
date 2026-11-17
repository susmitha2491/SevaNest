import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AxiosResponse } from 'axios';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { RealConfigurationRepository } from '../features/configuration/data/configurationRepository';
import { httpClient } from '../core/api/httpClient';
import { ConcurrencyConflictError } from '../core/errors/DomainError';

function renderWithProviders(ui: React.ReactElement, initialPath = '/configuration?tab=categories') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Category Publishing & HTTP 428 Concurrency Governance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('allows editing category details, adding skills, removing skills, and publishing with operational remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    // Wait for categories tab content
    expect(await screen.findByText(/Service Categories & Workforce Skills Taxonomy/i)).toBeInTheDocument();

    // Find and click the edit button for a category
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    expect(editBtns.length).toBeGreaterThan(0);
    await user.click(editBtns[0]);

    // Verify modal opened
    expect(await screen.findByRole('heading', { name: /Edit Category:/i })).toBeInTheDocument();

    // Add a new skill
    const skillInput = screen.getByPlaceholderText(/Add new skill tag\.\.\./i);
    await user.type(skillInput, 'Deep Cleaning Protocol');
    const addSkillBtn = screen.getByRole('button', { name: /Add Skill/i });
    await user.click(addSkillBtn);

    // Verify skill badge is displayed
    expect(screen.getByText('Deep Cleaning Protocol')).toBeInTheDocument();

    // Remove the added skill
    const removeBtn = screen.getByRole('button', { name: /Remove Deep Cleaning Protocol skill/i });
    await user.click(removeBtn);
    expect(screen.queryByText('Deep Cleaning Protocol')).not.toBeInTheDocument();

    // Click "Save Category Draft" to trigger publish confirmation
    const saveDraftBtn = screen.getByRole('button', { name: /Save Category Draft/i });
    await user.click(saveDraftBtn);

    // Verify ConfirmDialog is shown
    expect(await screen.findByRole('heading', { name: /Publish Updates to/i })).toBeInTheDocument();
    expect(screen.getByText(/This mutation will update mobile customer and worker search taxonomies/i)).toBeInTheDocument();

    // Provide mandatory operational remarks and confirm
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational rationale for category taxonomy update/i);
    await user.type(remarksInput, 'Updated kitchen skills taxonomy for Q4 operations.');

    const confirmPublishBtn = screen.getByRole('button', { name: /Confirm & Publish Category/i });
    await user.click(confirmPublishBtn);

    // Success toast should appear
    expect(await screen.findByText(/Service category details and engagements successfully published and verified/i)).toBeInTheDocument();
  });

  it('enforces RBAC: Operations Admin with category.manage can edit and publish categories', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Manager',
        email: 'ops@sevanest.local',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.CATEGORY_MANAGE, PERMISSIONS.AREA_MANAGE, PERMISSIONS.NOTIFICATION_MANAGE],
      },
      isAuthenticated: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByText(/Service Categories & Workforce Skills Taxonomy/i)).toBeInTheDocument();

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editBtns[0]);

    expect(await screen.findByRole('heading', { name: /Edit Category:/i })).toBeInTheDocument();
    const saveDraftBtn = screen.getByRole('button', { name: /Save Category Draft/i });
    await user.click(saveDraftBtn);

    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational rationale for category taxonomy update/i);
    await user.type(remarksInput, 'Ops review and confirmation.');

    const confirmPublishBtn = screen.getByRole('button', { name: /Confirm & Publish Category/i });
    await user.click(confirmPublishBtn);

    expect(await screen.findByText(/Service category details and engagements successfully published and verified/i)).toBeInTheDocument();
  });

  describe('RealConfigurationRepository If-Match & HTTP 428 Contract Handling', () => {
    it('sends If-Match: * or ETag on PATCH /admin/service-categories/{categoryId}', async () => {
      const repo = new RealConfigurationRepository();

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({
        data: {
          id: 'CAT-COOK',
          code: 'COOK',
          name: 'Professional Cook',
          description: 'Updated cook description',
          isEnabled: true,
        },
        headers: {
          etag: 'W/"1794905364801"',
        },
      } as unknown as AxiosResponse);

      const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValueOnce({
        data: {
          id: 'CAT-COOK',
          engagements: ['FULL_TIME', 'PART_TIME'],
        },
      } as unknown as AxiosResponse);

      const result = await repo.saveCategoryDraft(
        {
          id: 'CAT-COOK',
          name: 'Professional Cook',
          tagline: 'Updated cook description',
          iconName: 'Sparkles',
          allowedEngagementTypes: ['FULL_TIME', 'PART_TIME'],
          skillsTaxonomy: ['Culinary Arts'],
          minExperienceMonths: 12,
          status: 'ACTIVE',
          etag: 'W/"1794905364801"',
        },
        'Operational rationale for Q4 update'
      );

      // Verify httpClient.patch was called with If-Match header
      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/service-categories/CAT-COOK',
        {
          name: 'Professional Cook',
          description: 'Updated cook description',
          isEnabled: true,
        },
        {
          headers: {
            'If-Match': 'W/"1794905364801"',
            'X-Audit-Reason': 'Operational rationale for Q4 update',
          },
        }
      );

      // Verify put for engagements was called
      expect(putSpy).toHaveBeenCalledWith(
        '/admin/service-categories/CAT-COOK/engagements',
        { engagements: ['FULL_TIME', 'PART_TIME'] },
        {
          headers: {
            'X-Audit-Reason': 'Operational rationale for Q4 update',
          },
        }
      );

      expect(result.id).toBe('CAT-COOK');
      expect(result.etag).toBe('W/"1794905364801"');
    });

    it('falls back to If-Match: * when category etag is not present', async () => {
      const repo = new RealConfigurationRepository();

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({
        data: {
          id: 'CAT-NEW',
          name: 'New Service',
          description: 'Description',
          isEnabled: true,
        },
        headers: {
          etag: 'W/"new-etag-123"',
        },
      } as unknown as AxiosResponse);

      await repo.saveCategoryDraft(
        {
          id: 'CAT-NEW',
          name: 'New Service',
          tagline: 'Description',
          iconName: 'Sparkles',
          allowedEngagementTypes: [],
          skillsTaxonomy: [],
          minExperienceMonths: 6,
          status: 'ACTIVE',
        },
        'New category addition'
      );

      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/service-categories/CAT-NEW',
        expect.any(Object),
        {
          headers: {
            'If-Match': '*',
            'X-Audit-Reason': 'New category addition',
          },
        }
      );
    });

    it('handles HTTP 428 Precondition Required error correctly via errorMapper', async () => {
      const repo = new RealConfigurationRepository();

      vi.spyOn(httpClient, 'patch').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 428,
          data: {
            code: 'PRECONDITION_REQUIRED',
            message: 'Send the If-Match header with the ETag you loaded (or * to overwrite)',
            requestId: 'test-req-428',
          },
          headers: {},
        },
      });

      await expect(
        repo.saveCategoryDraft(
          {
            id: 'CAT-FAIL',
            name: 'Failed Category',
            tagline: 'Tagline',
            iconName: 'Sparkles',
            allowedEngagementTypes: [],
            skillsTaxonomy: [],
            minExperienceMonths: 6,
            status: 'ACTIVE',
          },
          'Test rationale'
        )
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it('sends If-Match on service-areas, notification-templates, and fee updates', async () => {
      const repo = new RealConfigurationRepository();

      const patchAreaSpy = vi.spyOn(httpClient, 'patch').mockResolvedValue({
        data: { id: 'AREA-01', name: 'Jubilee Hills', city: 'Hyderabad', isEnabled: true },
        headers: { etag: 'W/"area-etag"' },
      } as unknown as AxiosResponse);

      await repo.saveOperationalArea(
        {
          id: 'AREA-01',
          cityName: 'Hyderabad',
          clusterName: 'Jubilee Hills',
          pincodes: ['500033'],
          status: 'ACTIVE',
          activeWorkersCount: 15,
          etag: 'W/"area-etag"',
        },
        'Cluster expansion'
      );

      expect(patchAreaSpy).toHaveBeenCalledWith(
        '/admin/service-areas/AREA-01',
        expect.any(Object),
        {
          headers: {
            'If-Match': 'W/"area-etag"',
            'X-Audit-Reason': 'Cluster expansion',
          },
        }
      );

      const putFeeSpy = vi.spyOn(httpClient, 'put').mockResolvedValue({
        data: { code: 'BOOKING_FEE', amountMinor: 59900, isActive: true },
        headers: {},
      } as unknown as AxiosResponse);

      await repo.publishFeeSchedule(
        [
          {
            id: 'FEE-01',
            parameterName: 'BOOKING_FEE',
            liveValueINR: 500,
            draftValueINR: 599,
            classification: 'ONE_TIME_FEE',
            notes: 'Platform fee',
            decisionStatus: 'APPROVED',
            etag: 'W/"fee-etag"',
          },
        ],
        'Pricing adjustment'
      );

      expect(putFeeSpy).toHaveBeenCalledWith(
        '/admin/fees/booking-fee',
        { amountMinor: 59900, isActive: true },
        {
          headers: {
            'If-Match': 'W/"fee-etag"',
            'X-Audit-Reason': 'Pricing adjustment',
          },
        }
      );
    });

    it('persists allowed engagements and skills taxonomy in RealConfigurationRepository', async () => {
      const repo = new RealConfigurationRepository();
      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValue({
        data: {
          id: 'CAT-BABYSITTER',
          code: 'BABYSITTER',
          name: 'Babysitter Pro',
          description: 'Specialized infant and toddler care',
          isEnabled: true,
        },
        headers: { etag: 'W/"new-cat-etag"' },
      } as unknown as AxiosResponse);

      const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValue({
        data: {
          id: 'CAT-BABYSITTER',
          allowedEngagements: ['FULL_TIME', 'HOURLY'],
        },
        headers: {},
      } as unknown as AxiosResponse);

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          id: 'CAT-BABYSITTER',
          code: 'BABYSITTER',
          name: 'Babysitter Pro',
          description: 'Specialized infant and toddler care',
          isEnabled: true,
          allowedEngagements: ['FULL_TIME', 'HOURLY'],
        },
        headers: { etag: 'W/"verified-cat-etag"' },
      } as unknown as AxiosResponse);

      const result = await repo.saveCategoryDraft(
        {
          id: 'CAT-BABYSITTER',
          code: 'BABYSITTER',
          name: 'Babysitter Pro',
          tagline: 'Specialized infant and toddler care',
          iconName: 'Baby',
          allowedEngagementTypes: ['FULL_TIME', 'HOURLY'],
          skillsTaxonomy: ['Infant Feeding', 'Diapering & Hygiene', 'Montessori Play', 'Bedtime Routine'],
          minExperienceMonths: 12,
          status: 'ACTIVE',
          etag: 'W/"init-etag"',
        },
        'Upgraded Babysitter skills and engagement types'
      );

      // Verify PATCH called with If-Match and metadata
      expect(patchSpy).toHaveBeenCalledWith(
        '/admin/service-categories/CAT-BABYSITTER',
        {
          name: 'Babysitter Pro',
          description: 'Specialized infant and toddler care',
          isEnabled: true,
        },
        {
          headers: {
            'If-Match': 'W/"init-etag"',
            'X-Audit-Reason': 'Upgraded Babysitter skills and engagement types',
          },
        }
      );

      // Verify PUT called with normalized engagement enums
      expect(putSpy).toHaveBeenCalledWith(
        '/admin/service-categories/CAT-BABYSITTER/engagements',
        {
          engagements: ['FULL_TIME', 'HOURLY'],
        },
        {
          headers: {
            'X-Audit-Reason': 'Upgraded Babysitter skills and engagement types',
          },
        }
      );

      // Verify GET called to verify persistence
      expect(getSpy).toHaveBeenCalledWith('/admin/service-categories/CAT-BABYSITTER');

      // Verify result maintains edited skills taxonomy and updated etag
      expect(result.skillsTaxonomy).toEqual([
        'Infant Feeding',
        'Diapering & Hygiene',
        'Montessori Play',
        'Bedtime Routine',
      ]);
      expect(result.etag).toBe('W/"verified-cat-etag"');

      // Verify subsequent getServiceCategories maintains the published skills
      vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: [
          {
            id: 'CAT-BABYSITTER',
            code: 'BABYSITTER',
            name: 'Babysitter Pro',
            description: 'Specialized infant and toddler care',
            isEnabled: true,
            allowedEngagements: ['FULL_TIME', 'HOURLY'],
          },
        ],
        headers: {},
      } as unknown as AxiosResponse);

      const fetchedCategories = await repo.getServiceCategories();
      expect(fetchedCategories[0].skillsTaxonomy).toEqual([
        'Infant Feeding',
        'Diapering & Hygiene',
        'Montessori Play',
        'Bedtime Routine',
      ]);
    });
  });
});
