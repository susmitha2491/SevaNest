import type React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';
import {
  RealWorkerRepository,
  workerRepository,
  resolveCategoryId,
  resolveAreaId,
} from '../features/workers/data/workerRepository';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { WorkersDirectoryPage } from '../features/workers/presentation/WorkersDirectoryPage';

function renderWithProviders(ui: React.ReactElement, initialEntry: string = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Management and Directory Filtering — Contract & Backend Alignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession(
      {
        id: 'super-admin-01',
        name: 'Super Admin',
        email: 'superadmin@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: [
          '*',
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.CUSTOMER_VIEW,
        ],
      },
      'super-admin-token'
    );
  });

  describe('1. Category & Area Identifier Resolution (UUID Contract)', () => {
    it('correctly maps all official SevaNest categories (by name and code) to their backend UUIDs', () => {
      // Driver
      expect(resolveCategoryId('Driver')).toBe('01a11eec-fae9-72c1-8f1b-380639cc4c86');
      expect(resolveCategoryId('DRIVER')).toBe('01a11eec-fae9-72c1-8f1b-380639cc4c86');

      // Cook / Cooking
      expect(resolveCategoryId('Cook')).toBe('01a11eec-fb65-75ad-8b35-2d45d8c985e2');
      expect(resolveCategoryId('COOK')).toBe('01a11eec-fb65-75ad-8b35-2d45d8c985e2');
      expect(resolveCategoryId('COOKING')).toBe('01a11eec-fb65-75ad-8b35-2d45d8c985e2');

      // Cleaning Helper
      expect(resolveCategoryId('Cleaning Helper')).toBe('01a11eec-fcdb-72b3-9c37-891513fcab2c');
      expect(resolveCategoryId('CLEANING_HELPER')).toBe('01a11eec-fcdb-72b3-9c37-891513fcab2c');
      expect(resolveCategoryId('CLEANING')).toBe('01a11eec-fcdb-72b3-9c37-891513fcab2c');

      // Babysitter / Childcare
      expect(resolveCategoryId('Babysitter')).toBe('01a11eec-fbe1-754e-a00b-2767903cb9a3');
      expect(resolveCategoryId('BABYSITTER')).toBe('01a11eec-fbe1-754e-a00b-2767903cb9a3');
      expect(resolveCategoryId('CHILDCARE')).toBe('01a11eec-fbe1-754e-a00b-2767903cb9a3');

      // Elderly Care Helper
      expect(resolveCategoryId('Elderly Care Helper')).toBe('01a11eec-fc5c-7768-b326-062e424ee297');
      expect(resolveCategoryId('ELDERLY_CARE_HELPER')).toBe('01a11eec-fc5c-7768-b326-062e424ee297');
      expect(resolveCategoryId('ELDERLY_CARE')).toBe('01a11eec-fc5c-7768-b326-062e424ee297');

      // House Maid
      expect(resolveCategoryId('House Maid')).toBe('01a11eec-fa69-7628-89b0-331f8591c795');
      expect(resolveCategoryId('HOUSE_MAID')).toBe('01a11eec-fa69-7628-89b0-331f8591c795');
      expect(resolveCategoryId('maid')).toBe('01a11eec-fa69-7628-89b0-331f8591c795');
    });

    it('preserves already-formatted UUIDs intact', () => {
      const uuid = '01a11eec-fae9-72c1-8f1b-380639cc4c86';
      expect(resolveCategoryId(uuid)).toBe(uuid);
    });

    it('returns undefined for ALL or empty input and null for unrecognized category', () => {
      expect(resolveCategoryId('ALL')).toBeUndefined();
      expect(resolveCategoryId('')).toBeUndefined();
      expect(resolveCategoryId(undefined)).toBeUndefined();
      expect(resolveCategoryId('Gardening')).toBeNull();
      expect(resolveCategoryId('Pet Care')).toBeNull();
    });

    it('correctly maps known operating localities to service area UUIDs', () => {
      expect(resolveAreaId('Kondapur')).toBe('01a11ef1-2e11-71b9-9ed5-da7353bf7dcf');
      expect(resolveAreaId('Gachibowli')).toBe('01a11ef1-332a-772b-abde-71e625e89c0f');
      expect(resolveAreaId('HITEC City')).toBe('01a12ead-add8-75cf-b344-9a1e4e2c44cb');
      expect(resolveAreaId('Madhapur')).toBe('01a11ef1-2a77-71e7-91a3-0522f8b9cfca');
      expect(resolveAreaId('Banjara Hills')).toBe('01a11ef1-4256-7358-a4ec-d040ae023c55');
      expect(resolveAreaId('Jubilee Hills')).toBe('01a11ef1-3ee0-720b-98e7-549c37d7023b');
      expect(resolveAreaId('Kukatpally')).toBe('01a11ef1-45df-7278-bc66-c31a43f9b6c5');
      expect(resolveAreaId('Miyapur')).toBe('01a11ef1-495d-72cd-adf8-49248040d6fb');
    });
  });

  describe('2. RealWorkerRepository Query Construction Contract', () => {
    it('sends resolved UUID in categoryId query parameter when category="Driver" is requested', async () => {
      const realRepo = new RealWorkerRepository();
      const recordedCalls: AxiosRequestConfig[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          if (config) recordedCalls.push(config);
          return {
            data: {
              items: [
                {
                  id: 'W-10483',
                  name: 'Ramesh Yadav',
                  categories: [{ id: '01a11eec-fae9-72c1-8f1b-380639cc4c86', name: 'Driver' }],
                  category: 'Driver',
                  locality: 'Gachibowli',
                  status: 'ACTIVE',
                  isFullyVerified: true,
                },
              ],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const pageResult = await realRepo.getWorkersPage({ category: 'Driver' }, 1, 20);

      // Verify that categoryId is sent as a UUID in the primary query, matching backend OpenAPI contract
      const primaryCall = recordedCalls.find((c) => c.params?.page === 1);
      expect(primaryCall?.params?.categoryId).toBe('01a11eec-fae9-72c1-8f1b-380639cc4c86');
      expect(pageResult.items.length).toBe(1);
      expect(pageResult.items[0].category).toBe('Driver');
    });

    it('sends resolved UUID in categoryId query parameter when category="Cook" or "COOKING" is requested', async () => {
      const realRepo = new RealWorkerRepository();
      const recordedCalls: AxiosRequestConfig[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          if (config) recordedCalls.push(config);
          return {
            data: {
              items: [
                {
                  id: 'W-10484',
                  name: 'Meena Bai',
                  categories: [{ id: '01a11eec-fb65-75ad-8b35-2d45d8c985e2', name: 'Cook' }],
                  category: 'Cook',
                  status: 'ACTIVE',
                  isFullyVerified: true,
                },
              ],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const res = await realRepo.getWorkersPage({ category: 'COOKING' }, 1, 20);

      const primaryCall = recordedCalls.find((c) => c.params?.page === 1);
      expect(primaryCall?.params?.categoryId).toBe('01a11eec-fb65-75ad-8b35-2d45d8c985e2');
      expect(res.items.length).toBe(1);
    });

    it('sends resolved UUID in areaId query parameter when locality="Kondapur" is requested', async () => {
      const realRepo = new RealWorkerRepository();
      const recordedCalls: AxiosRequestConfig[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          if (config) recordedCalls.push(config);
          return {
            data: {
              items: [],
              meta: { total: 0, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      await realRepo.getWorkersPage({ locality: 'Kondapur' }, 1, 20);

      const primaryCall = recordedCalls.find((c) => c.params?.page === 1);
      expect(primaryCall?.params?.areaId).toBe('01a11ef1-2e11-71b9-9ed5-da7353bf7dcf');
    });

    it('never sends accountStatus="BLACKLISTED" to the backend (prevents HTTP 400 validation error)', async () => {
      const realRepo = new RealWorkerRepository();
      const recordedCalls: AxiosRequestConfig[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          if (config) recordedCalls.push(config);
          return {
            data: {
              items: [
                {
                  id: 'W-10999',
                  name: 'Blocked Worker',
                  status: 'BLACKLISTED',
                  isFullyVerified: false,
                },
              ],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const res = await realRepo.getWorkersPage({ status: 'BLACKLISTED' }, 1, 20);

      // Backend only accepts ACTIVE or SUSPENDED for accountStatus query param
      const primaryCall = recordedCalls.find((c) => c.params?.page === 1);
      expect(primaryCall?.params?.accountStatus).toBeUndefined();
      expect(res.items.length).toBe(1);
      expect(res.items[0].status).toBe('BLACKLISTED');
    });

    it('returns empty list safely without making failing backend request for unrecognized category', async () => {
      const realRepo = new RealWorkerRepository();
      const getSpy = vi.spyOn(httpClient, 'get');

      const res = await realRepo.getWorkersPage({ category: 'Gardening' }, 1, 20);

      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      // No backend call made with invalid non-UUID category
      expect(getSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. WorkersListPage UI Filtering Integration', () => {
    it('loads and displays workers when category filter is selected via URL query parameter without throwing HTTP 400', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          const params = (config?.params as Record<string, unknown>) || {};
          // If categoryId is the Driver UUID, return driver records
          if (params.categoryId === '01a11eec-fae9-72c1-8f1b-380639cc4c86') {
            return {
              data: {
                items: [
                  {
                    id: 'W-10483',
                    name: 'Ramesh Yadav',
                    category: 'Driver',
                    categories: ['Driver'],
                    locality: 'Gachibowli',
                    status: 'ACTIVE',
                    isFullyVerified: true,
                    experienceYears: 8,
                    ratingAverage: 4.5,
                  },
                ],
                meta: { total: 1, page: 1, limit: 20 },
              },
            };
          }
          return {
            data: {
              items: [],
              meta: { total: 0, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      renderWithProviders(<WorkersListPage />, '/workers?category=Driver');

      // The list must display the filtered driver without error
      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
      expect(screen.queryByText(/Failed to load domestic worker roster/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backend Validation Error/i)).not.toBeInTheDocument();
    });

    it('allows changing category filter via dropdown to "Cook" and updates filter criteria', async () => {
      const getSpy = vi.spyOn(workerRepository, 'getWorkersPage');

      renderWithProviders(<WorkersListPage />, '/workers');

      // Initially loads workers list
      expect(await screen.findByText(/Domestic Worker Roster/i)).toBeInTheDocument();

      // Find the Category filter select and change to Cook
      const categorySelect = screen.getByLabelText(/Filter by skill category/i);
      fireEvent.change(categorySelect, { target: { value: 'Cook' } });

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Cook' }),
          expect.any(Number),
          expect.any(Number)
        );
      });

      // Verify that the category passed into the repository resolves to Cook's backend UUID
      const lastCallFilter = getSpy.mock.calls[getSpy.mock.calls.length - 1][0];
      expect(resolveCategoryId(lastCallFilter?.category)).toBe('01a11eec-fb65-75ad-8b35-2d45d8c985e2');
      expect(screen.queryByText(/Failed to load domestic worker roster/i)).not.toBeInTheDocument();
    });
  });

  describe('4. DirectoryPage UI Filtering Integration', () => {
    it('queries with Driver category when Driver category is selected on Directory workers tab', async () => {
      const getSpy = vi.spyOn(workerRepository, 'getWorkersPage');

      renderWithProviders(<DirectoryPage />, '/directory?tab=workers');

      expect(await screen.findByText(/Workers Directory/i)).toBeInTheDocument();

      // Filter by Driver category (value in DirectoryPage is DRIVER)
      const categorySelect = screen.getByLabelText(/Filter by skill category/i);
      fireEvent.change(categorySelect, { target: { value: 'DRIVER' } });

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'DRIVER' }),
          expect.any(Number),
          expect.any(Number)
        );
      });

      const lastCallFilter = getSpy.mock.calls[getSpy.mock.calls.length - 1][0];
      expect(resolveCategoryId(lastCallFilter?.category)).toBe('01a11eec-fae9-72c1-8f1b-380639cc4c86');
      expect(screen.queryByText(/Unable to Load Workers Directory/i)).not.toBeInTheDocument();
    });
  });

  describe('5. WorkersDirectoryPage UI Filtering Integration', () => {
    it('queries with Cleaning Helper category when Cleaning Helper category is selected', async () => {
      const getSpy = vi.spyOn(workerRepository, 'getWorkersPage');

      renderWithProviders(<WorkersDirectoryPage />, '/workers/directory');

      expect(await screen.findByText(/Workers Directory/i)).toBeInTheDocument();

      const categorySelect = screen.getByLabelText(/Filter by skill category/i);
      fireEvent.change(categorySelect, { target: { value: 'CLEANING' } });

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'CLEANING' }),
          expect.any(Number),
          expect.any(Number)
        );
      });

      const lastCallFilter = getSpy.mock.calls[getSpy.mock.calls.length - 1][0];
      expect(resolveCategoryId(lastCallFilter?.category)).toBe('01a11eec-fcdb-72b3-9c37-891513fcab2c');
      expect(screen.queryByText(/Unable to Load Directory/i)).not.toBeInTheDocument();
    });
  });
});

