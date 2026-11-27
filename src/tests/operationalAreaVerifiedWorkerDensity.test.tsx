import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { AxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { configurationRepository, RealConfigurationRepository } from '../features/configuration/data/configurationRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { Worker } from '../features/workers/domain/types';
import { OperationalAreaItem } from '../features/configuration/domain/types';
import { httpClient } from '../core/api/httpClient';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/configuration?tab=areas') {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockAreas: OperationalAreaItem[] = [
  {
    id: '01a11ef1-2e11-71b9-9ed5-da7353bf7dcf',
    clusterName: 'Kondapur & Madhapur',
    cityName: 'Hyderabad',
    pincodes: ['500084', '500081'],
    activeWorkersCount: 0,
    status: 'ACTIVE',
  },
  {
    id: '01a11ef1-2e88-75c1-8419-f00223bc4102',
    clusterName: 'Gachibowli Tech Cluster',
    cityName: 'Hyderabad',
    pincodes: ['500032'],
    activeWorkersCount: 0,
    status: 'ACTIVE',
  },
  {
    id: '01a11ef1-3001-7299-b108-98421034fe11',
    clusterName: 'Secunderabad North',
    cityName: 'Hyderabad',
    pincodes: ['500003'],
    activeWorkersCount: 0,
    status: 'ACTIVE',
  },
];

describe('Bug 15: Operational Areas Verified Worker Density Count', () => {
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

  it('1. Cluster with verified, active workers displays the accurate count', async () => {
    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue(mockAreas);

    const mockWorkers: Partial<Worker>[] = [
      {
        id: 'W-01',
        name: 'Sunita Devi',
        locality: 'Kondapur',
        isFullyVerified: true,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
      {
        id: 'W-02',
        name: 'Anita Sharma',
        locality: 'Madhapur',
        isFullyVerified: true,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    ];

    vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue(mockWorkers as Worker[]);

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('heading', { name: /Hyderabad Operational Areas & Dispatch Clusters/i })).toBeInTheDocument();

    // Kondapur & Madhapur should display 2 Verified Workers
    const kondapurRow = screen.getByLabelText(/Edit cluster Kondapur & Madhapur/i);
    expect(kondapurRow).toHaveTextContent('2 Verified Workers');
  });

  it('2. Unverified or inactive workers are not counted in active worker density', async () => {
    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue(mockAreas);

    const mockWorkers: Partial<Worker>[] = [
      {
        id: 'W-01',
        name: 'Active Verified Worker',
        locality: 'Kondapur',
        isFullyVerified: true,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
      {
        id: 'W-02',
        name: 'Unverified Worker',
        locality: 'Kondapur',
        isFullyVerified: false,
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
      },
      {
        id: 'W-03',
        name: 'Suspended Worker',
        locality: 'Kondapur',
        isFullyVerified: true,
        status: 'SUSPENDED',
        accountStatus: 'SUSPENDED',
        verificationStatus: 'VERIFIED',
      },
      {
        id: 'W-04',
        name: 'Rejected Worker',
        locality: 'Kondapur',
        isFullyVerified: false,
        status: 'REJECTED',
        verificationStatus: 'REJECTED',
      },
    ];

    vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue(mockWorkers as Worker[]);

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('heading', { name: /Hyderabad Operational Areas & Dispatch Clusters/i })).toBeInTheDocument();

    // Only 1 verified and active worker should be counted
    const kondapurRow = screen.getByLabelText(/Edit cluster Kondapur & Madhapur/i);
    expect(kondapurRow).toHaveTextContent('1 Verified Workers');
  });

  it('3. Workers assigned to another cluster are not included in this cluster', async () => {
    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue(mockAreas);

    const mockWorkers: Partial<Worker>[] = [
      {
        id: 'W-01',
        name: 'Gachibowli Driver',
        locality: 'Gachibowli',
        isFullyVerified: true,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    ];

    vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue(mockWorkers as Worker[]);

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('heading', { name: /Hyderabad Operational Areas & Dispatch Clusters/i })).toBeInTheDocument();

    // Gachibowli has 1 worker, Kondapur has 0
    const gachibowliRow = screen.getByLabelText(/Edit cluster Gachibowli Tech Cluster/i);
    expect(gachibowliRow).toHaveTextContent('1 Verified Workers');

    const kondapurRow = screen.getByLabelText(/Edit cluster Kondapur & Madhapur/i);
    expect(kondapurRow).toHaveTextContent('0 Verified Workers');
  });

  it('4. Cluster with no eligible workers displays 0 Verified Workers', async () => {
    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue(mockAreas);

    vi.spyOn(workerRepository, 'getWorkers').mockResolvedValue([]);

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('heading', { name: /Hyderabad Operational Areas & Dispatch Clusters/i })).toBeInTheDocument();

    const secunderabadRow = screen.getByLabelText(/Edit cluster Secunderabad North/i);
    expect(secunderabadRow).toHaveTextContent('0 Verified Workers');
  });

  it('5. Missing or invalid backend data is handled safely without inventing counts', async () => {
    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue(mockAreas);

    // Backend worker repository throws or returns empty
    vi.spyOn(workerRepository, 'getWorkers').mockRejectedValue(new Error('Network error'));

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByRole('heading', { name: /Hyderabad Operational Areas & Dispatch Clusters/i })).toBeInTheDocument();

    // Safely displays 0 Verified Workers without throwing or fabricating numbers
    const rows = screen.getAllByText(/0 Verified Workers/i);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  describe('RealConfigurationRepository Authoritative Worker Density via Backend areaId Contract', () => {
    it('fetches service areas and queries backend meta.total per areaId for verified worker density', async () => {
      const realRepo = new RealConfigurationRepository();

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/service-areas') {
          return {
            data: {
              data: [
                {
                  id: '01a11ef1-4256-7358-a4ec-d040ae023c55',
                  name: 'Banjara Hills',
                  city: 'Hyderabad',
                  isEnabled: true,
                },
                {
                  id: '01a11ef1-332a-772b-abde-71e625e89c0f',
                  name: 'Gachibowli',
                  city: 'Hyderabad',
                  isEnabled: true,
                },
              ],
            },
          };
        }
        if (url === '/admin/workers') {
          const params = config?.params as Record<string, unknown> | undefined;
          const areaId = params?.areaId;
          const verified = params?.verified;
          if (areaId === '01a11ef1-4256-7358-a4ec-d040ae023c55' && verified === true) {
            return {
              data: {
                data: [{ id: 'w-1', name: 'Worker 1' }],
                meta: { page: 1, limit: 1, total: 13 },
              },
            };
          }
          if (areaId === '01a11ef1-332a-772b-abde-71e625e89c0f' && verified === true) {
            return {
              data: {
                data: [{ id: 'w-2', name: 'Worker 2' }],
                meta: { page: 1, limit: 1, total: 15 },
              },
            };
          }
        }
        return { data: {} };
      });

      const areas = await realRepo.getOperationalAreas();
      expect(areas).toHaveLength(2);

      const banjara = areas.find((a) => a.clusterName === 'Banjara Hills');
      expect(banjara?.activeWorkersCount).toBe(13);

      const gachibowli = areas.find((a) => a.clusterName === 'Gachibowli');
      expect(gachibowli?.activeWorkersCount).toBe(15);
    });

    it('pagination on worker list does not omit verified workers because meta.total is authoritative', async () => {
      const realRepo = new RealConfigurationRepository();

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/service-areas') {
          return {
            data: {
              data: [
                {
                  id: '01a11ef1-2a77-71e7-91a3-0522f8b9cfca',
                  name: 'Madhapur',
                  city: 'Hyderabad',
                  isEnabled: true,
                },
              ],
            },
          };
        }
        if (url === '/admin/workers') {
          // Even if limit is 1 and only 1 worker item is returned, meta.total contains the entire count across pages (21)
          return {
            data: {
              data: [{ id: 'w-1', name: 'Worker 1' }],
              meta: { page: 1, limit: 1, total: 21 },
            },
          };
        }
        return { data: {} };
      });

      const areas = await realRepo.getOperationalAreas();
      expect(areas[0].activeWorkersCount).toBe(21);
    });

    it('safely falls back to 0 active workers when area has no workers or backend worker query fails', async () => {
      const realRepo = new RealConfigurationRepository();

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/service-areas') {
          return {
            data: {
              data: [
                {
                  id: '01a11ef1-38a8-7028-96ba-67f0330c1ca6',
                  name: 'Hitech City',
                  city: 'Hyderabad',
                  isEnabled: true,
                },
              ],
            },
          };
        }
        if (url === '/admin/workers') {
          throw new Error('500 Internal Server Error');
        }
        return { data: {} };
      });

      const areas = await realRepo.getOperationalAreas();
      expect(areas).toHaveLength(1);
      expect(areas[0].activeWorkersCount).toBe(0);
    });
  });
});
