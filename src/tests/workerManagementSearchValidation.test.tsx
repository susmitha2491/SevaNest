import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  RealWorkerRepository,
  workerRepository,
  isPotentialMobileNumber,
  isWorkerIdFormat,
} from '../features/workers/data/workerRepository';
import { httpClient } from '../core/api/httpClient';
import { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';

function renderApp(initialEntry: string = '/workers') {
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
        <WorkersListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Management Search — HTTP 400 Validation Fix & Contract Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Admin',
        email: 'operations.admin@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.WORKERS_MANAGE_STATUS,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'ops-token'
    );
  });

  describe('1. Parameter Inspection & Helper Classification', () => {
    it('correctly identifies valid mobile numbers and rejects non-mobile strings', () => {
      // Short names and text must NOT be identified as mobile numbers
      expect(isPotentialMobileNumber('va')).toBe(false);
      expect(isPotentialMobileNumber('Sunita')).toBe(false);
      expect(isPotentialMobileNumber('Sunita Devi')).toBe(false);
      expect(isPotentialMobileNumber('W-10482')).toBe(false);
      expect(isPotentialMobileNumber('')).toBe(false);

      // Short numbers (< 10 digits) must NOT be passed as mobile (prevents backend 400)
      expect(isPotentialMobileNumber('12345')).toBe(false);
      expect(isPotentialMobileNumber('9876')).toBe(false);

      // Valid Indian mobile numbers (>= 10 digits) are identified
      expect(isPotentialMobileNumber('9876543210')).toBe(true);
      expect(isPotentialMobileNumber('+91 98765 43210')).toBe(true);
      expect(isPotentialMobileNumber('+919876543210')).toBe(true);
      expect(isPotentialMobileNumber('09876543210')).toBe(true);
      expect(isPotentialMobileNumber('98765-43210')).toBe(true);
    });

    it('correctly identifies worker ID formats', () => {
      expect(isWorkerIdFormat('W-10482')).toBe(true);
      expect(isWorkerIdFormat('w-10483')).toBe(true);
      expect(isWorkerIdFormat('APP-10482')).toBe(true);
      expect(isWorkerIdFormat('va')).toBe(false);
      expect(isWorkerIdFormat('Sunita Devi')).toBe(false);
      expect(isWorkerIdFormat('9876543210')).toBe(false);
      expect(isWorkerIdFormat('W-')).toBe(false);
    });
  });

  describe('2. Contract Level Request URLs & Status Verification', () => {
    it('Test: Search using short name "va" sends name=va and NEVER sends mobile parameter', async () => {
      const realRepo = new RealWorkerRepository();
      let capturedUrl = '';
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        capturedUrl = url;
        capturedParams = (config?.params as Record<string, unknown>) || {};
        return {
          data: {
            items: [
              {
                id: 'W-10483',
                name: 'Ramesh Yadav',
                category: 'Driver',
                locality: 'Gachibowli',
                experienceYears: 7,
                ratingAverage: 4.5,
                status: 'ACTIVE',
                isFullyVerified: false,
                verificationStatus: 'IN_REVIEW',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      });

      const result = await realRepo.getWorkersPage({ searchTerm: 'va' }, 1, 20);

      // Verify exact request URL and params
      expect(capturedUrl).toBe('/admin/workers');
      expect(capturedParams.name).toBe('va');
      expect(capturedParams.mobile).toBeUndefined();
      expect(capturedParams.page).toBe(1);
      expect(capturedParams.limit).toBe(20);

      // Verify response handling
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Ramesh Yadav');
      expect(result.total).toBe(1);

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=1&limit=20&name=va
      // Response Status: 200 OK
    });

    it('Test: Search using full worker name "Sunita Devi" sends name=Sunita Devi and no mobile', async () => {
      const realRepo = new RealWorkerRepository();
      let capturedUrl = '';
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        capturedUrl = url;
        capturedParams = (config?.params as Record<string, unknown>) || {};
        return {
          data: {
            items: [
              {
                id: 'W-10482',
                name: 'Sunita Devi',
                category: 'House Maid',
                locality: 'Kondapur',
                experienceYears: 5,
                ratingAverage: 4.8,
                status: 'ACTIVE',
                isFullyVerified: true,
                verificationStatus: 'VERIFIED',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      });

      const result = await realRepo.getWorkersPage({ searchTerm: 'Sunita Devi' }, 1, 20);

      expect(capturedUrl).toBe('/admin/workers');
      expect(capturedParams.name).toBe('Sunita Devi');
      expect(capturedParams.mobile).toBeUndefined();
      expect(result.items[0].name).toBe('Sunita Devi');

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=1&limit=20&name=Sunita+Devi
      // Response Status: 200 OK
    });

    it('Test: Search using valid mobile number sends mobile parameter and no name parameter', async () => {
      const realRepo = new RealWorkerRepository();
      let capturedUrl = '';
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        capturedUrl = url;
        capturedParams = (config?.params as Record<string, unknown>) || {};
        return {
          data: {
            items: [
              {
                id: 'W-10482',
                name: 'Sunita Devi',
                category: 'House Maid',
                locality: 'Kondapur',
                experienceYears: 5,
                ratingAverage: 4.8,
                status: 'ACTIVE',
                isFullyVerified: true,
                verificationStatus: 'VERIFIED',
                phone: '+91 98765 43210',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        };
      });

      const result = await realRepo.getWorkersPage({ searchTerm: '9876543210' }, 1, 20);

      expect(capturedUrl).toBe('/admin/workers');
      expect(capturedParams.mobile).toBe('9876543210');
      expect(capturedParams.name).toBeUndefined();
      expect(result.items.length).toBe(1);

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=1&limit=20&mobile=9876543210
      // Response Status: 200 OK
    });

    it('Test: Search using worker ID "W-10482" queries documented endpoint GET /admin/workers/{workerId}', async () => {
      const realRepo = new RealWorkerRepository();
      const capturedCalls: string[] = [];

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        capturedCalls.push(url);
        if (url.includes('/admin/workers/W-10482')) {
          return {
            data: {
              id: 'W-10482',
              workerId: 'W-10482',
              name: 'Sunita Devi',
              category: 'House Maid',
              locality: 'Kondapur',
              experienceYears: 5,
              ratingAverage: 4.8,
              status: 'ACTIVE',
              isFullyVerified: true,
              verificationStatus: 'VERIFIED',
            },
          };
        }
        return { data: {} };
      });

      const result = await realRepo.getWorkersPage({ searchTerm: 'W-10482' }, 1, 20);

      // Verify that it called GET /admin/workers/W-10482 and did NOT invent a workerId query parameter on /admin/workers
      expect(capturedCalls.some((c) => c.includes('/admin/workers/W-10482'))).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('W-10482');
      expect(result.total).toBe(1);

      // Exact request representation:
      // URL: GET /api/v1/admin/workers/W-10482
      // Response Status: 200 OK
    });

    it('Test: Clear search sends no search parameters and returns general roster', async () => {
      const realRepo = new RealWorkerRepository();
      let capturedUrl = '';
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        capturedUrl = url;
        capturedParams = (config?.params as Record<string, unknown>) || {};
        return {
          data: {
            items: [
              { id: 'W-10482', name: 'Sunita Devi' },
              { id: 'W-10483', name: 'Ramesh Yadav' },
            ],
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          },
        };
      });

      const result = await realRepo.getWorkersPage({ searchTerm: '' }, 1, 20);

      expect(capturedUrl).toBe('/admin/workers');
      expect(capturedParams.name).toBeUndefined();
      expect(capturedParams.mobile).toBeUndefined();
      expect(result.items.length).toBe(2);

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=1&limit=20
      // Response Status: 200 OK
    });

    it('Test: Infinite scrolling after search requests page 2 with preserved name parameter', async () => {
      const realRepo = new RealWorkerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (_url: string, config?: AxiosRequestConfig) => {
        capturedParams = (config?.params as Record<string, unknown>) || {};
        return {
          data: {
            items: [{ id: 'W-10484', name: 'Kavita Singh' }],
            meta: { total: 25, page: 2, limit: 20, totalPages: 2 },
          },
        };
      });

      const page2 = await realRepo.getWorkersPage({ searchTerm: 'va' }, 2, 20);

      expect(capturedParams.page).toBe(2);
      expect(capturedParams.limit).toBe(20);
      expect(capturedParams.name).toBe('va');
      expect(capturedParams.mobile).toBeUndefined();
      expect(page2.page).toBe(2);

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=2&limit=20&name=va
      // Response Status: 200 OK
    });

    it('Test: Backend validation failure (HTTP 400) throws cleanly and is handled', async () => {
      const realRepo = new RealWorkerRepository();

      const axiosError = new AxiosError('VALIDATION_FAILED', '400', undefined, undefined, {
        status: 400,
        data: {
          message: 'VALIDATION_FAILED: mobile must be longer than or equal to 10 characters.',
        },
        statusText: 'Bad Request',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      });

      vi.spyOn(httpClient, 'get').mockRejectedValue(axiosError);

      await expect(realRepo.getWorkersPage({ searchTerm: '9876543210' }, 1, 20)).rejects.toThrow(
        /VALIDATION_FAILED/i
      );

      // Exact request representation:
      // URL: GET /api/v1/admin/workers?page=1&limit=20&mobile=9876543210
      // Response Status: 400 Bad Request
    });
  });

  describe('3. UI-Level Search Interaction & Error Handling in WorkersListPage', () => {
    it('searching for "va" safely returns empty state without HTTP 400 and allows clearing via the X button', async () => {
      const user = userEvent.setup();
      renderApp('/workers');

      // Verify list initially loaded
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Yadav')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search by worker name, ID, category, or locality/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'va');

      // None of the mock workers contain "va" in their name, so empty state renders cleanly without error
      expect(await screen.findByText(/No domestic workers match your search and filter criteria/i)).toBeInTheDocument();
      expect(screen.queryByText(/Backend Validation Error/i)).not.toBeInTheDocument();

      // Clear search button is visible
      const clearBtn = screen.getByRole('button', { name: /Clear search/i });
      expect(clearBtn).toBeInTheDocument();

      // Click clear search
      await user.click(clearBtn);
      expect(searchInput).toHaveValue('');

      // Both workers visible again
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Yadav')).toBeInTheDocument();
    });

    it('searching for name substring "Devi" displays matching worker', async () => {
      const user = userEvent.setup();
      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search by worker name, ID, category, or locality/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'Devi');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByText('Ramesh Yadav')).not.toBeInTheDocument();
    });

    it('searching by valid mobile number finds worker', async () => {
      const user = userEvent.setup();
      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search by worker name, ID, category, or locality/i);
      await user.clear(searchInput);
      await user.type(searchInput, '9876543210');

      // Sunita Devi matches phone 9876543210
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    });

    it('searching by worker ID "W-10482" displays only worker W-10482', async () => {
      const user = userEvent.setup();
      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search by worker name, ID, category, or locality/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'W-10482');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByText('Ramesh Yadav')).not.toBeInTheDocument();
    });

    it('displays backend validation failure clearly in UI and allows resetting search', async () => {
      const user = userEvent.setup();
      const spy = vi.spyOn(workerRepository, 'getWorkersPage').mockRejectedValue(
        new Error('VALIDATION_FAILED: mobile must be longer than or equal to 10 characters.')
      );

      renderApp('/workers?search=invalid-search');

      await waitFor(() => {
        expect(spy).toHaveBeenCalled();
      });

      expect(await screen.findByText(/Backend Validation Error/i)).toBeInTheDocument();
      expect(screen.getByText(/mobile must be longer than or equal to 10 characters/i)).toBeInTheDocument();

      // Restore spy so clicking reset can load workers
      spy.mockRestore();

      // Click Clear Search & Reset
      const resetBtn = screen.getByRole('button', { name: /Clear Search & Reset/i });
      await user.click(resetBtn);

      // Successfully recovers and loads workers
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    });
  });
});
