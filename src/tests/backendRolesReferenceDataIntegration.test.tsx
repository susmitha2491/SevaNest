import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  RealConfigurationRepository,
  mapBackendRoleToDefinition,
} from '../features/configuration/data/configurationRepository';
import {
  RealReferenceDataRepository,
} from '../features/configuration/data/referenceDataRepository';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConcurrencyConflictError,
  NetworkError,
  ServerFailureError,
} from '../core/errors/DomainError';

describe('Roles, Permissions & Reference Data Backend Integration', () => {
  let configRepo: RealConfigurationRepository;
  let refDataRepo: RealReferenceDataRepository;

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    configRepo = new RealConfigurationRepository();
    refDataRepo = new RealReferenceDataRepository();
  });

  describe('GET /api/v1/admin/roles Contract & Mapping', () => {
    it('requests /admin/roles and correctly maps documented admin roles with permissions and counts', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'admin-1',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'valid-jwt-token'
      );

      const mockResponse = {
        data: [
          {
            role: 'SUPER_ADMIN',
            name: 'Super Admin',
            description: 'Core platform oversight and governance',
            permissions: ['*'],
            isImmutable: true,
            accountsCount: 1,
          },
          {
            role: 'OPERATIONS_ADMIN',
            name: 'Operations Admin',
            description: 'Booking and candidate operations',
            permissions: ['dashboard.view', 'bookings.manage'],
            isImmutable: false,
            accountsCount: 3,
          },
          {
            role: 'VERIFICATION_EXECUTIVE',
            name: 'Verification Executive',
            description: 'Worker document review',
            permissions: ['dashboard.view', 'verification.review'],
            isImmutable: false,
            accountsCount: 2,
          },
          {
            role: 'SUPPORT_EXECUTIVE',
            name: 'Support Executive',
            description: 'Customer dispute mediation',
            permissions: ['dashboard.view', 'support.manage'],
            isImmutable: false,
            accountsCount: 5,
          },
        ],
        status: 200,
        headers: { 'x-correlation-id': 'req-roles-123' },
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse as never);

      const roles = await configRepo.getRolePermissions();

      expect(getSpy).toHaveBeenCalledWith('/admin/roles');
      expect(roles).toHaveLength(4);

      const superAdmin = roles.find((r) => r.role === 'SUPER_ADMIN');
      expect(superAdmin).toBeDefined();
      expect(superAdmin?.isImmutable).toBe(true);
      expect(superAdmin?.permissions).toEqual(['*']);
      expect(superAdmin?.accountsCount).toBe(1);

      const opsAdmin = roles.find((r) => r.role === 'OPERATIONS_ADMIN');
      expect(opsAdmin).toBeDefined();
      expect(opsAdmin?.isImmutable).toBe(false);
      expect(opsAdmin?.permissions).toContain('bookings.manage');
      expect(opsAdmin?.accountsCount).toBe(3);
    });

    it('correctly maps roles from alternative backend wrapper objects ({ roles: [...] })', async () => {
      const mockResponse = {
        data: {
          roles: [
            {
              roleCode: 'OPERATIONS_ADMIN',
              roleName: 'Operations Admin',
              permissionCodes: ['bookings.view'],
              accountCount: 4,
            },
          ],
        },
        status: 200,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse as never);

      const roles = await configRepo.getRolePermissions();
      expect(roles).toHaveLength(1);
      expect(roles[0].role).toBe('OPERATIONS_ADMIN');
      expect(roles[0].permissions).toEqual(['bookings.view']);
      expect(roles[0].accountsCount).toBe(4);
    });

    it('rejects unknown or malformed roles and never grants permissions', () => {
      expect(() => {
        mapBackendRoleToDefinition({
          role: 'ANONYMOUS_HACKER',
          permissions: ['*'],
        });
      }).toThrow(ForbiddenError);

      expect(() => {
        mapBackendRoleToDefinition({
          role: '',
        });
      }).toThrow(ForbiddenError);
    });

    it('handles empty roles array from server by throwing ServerFailureError without falling back to mock data', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: [],
        status: 200,
      } as never);

      await expect(configRepo.getRolePermissions()).rejects.toThrow(ServerFailureError);
    });

    it('handles 401 unauthenticated and 403 forbidden responses appropriately', async () => {
      const axios401 = new axios.AxiosError('Request failed with status code 401');
      axios401.response = {
        status: 401,
        data: { code: 'UNAUTHENTICATED', message: 'Authentication is required' },
        headers: { 'x-correlation-id': 'req-unauth-1' },
      } as never;

      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios401);

      await expect(configRepo.getRolePermissions()).rejects.toThrow(UnauthorizedError);

      const axios403 = new axios.AxiosError('Request failed with status code 403');
      axios403.response = {
        status: 403,
        data: { code: 'FORBIDDEN', message: 'Only Super Admin may list roles' },
        headers: { 'x-correlation-id': 'req-forbid-1' },
      } as never;

      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios403);

      await expect(configRepo.getRolePermissions()).rejects.toThrow(ForbiddenError);
    });
  });

  describe('GET /api/v1/admin/roles/{roleCode} Contract', () => {
    it('fetches a single role with its permissions', async () => {
      const mockResponse = {
        data: {
          role: 'VERIFICATION_EXECUTIVE',
          name: 'Verification Executive',
          description: 'Worker document review and verification',
          permissions: ['dashboard.view', 'verification.review'],
          isImmutable: false,
          accountsCount: 3,
        },
        status: 200,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse as never);

      const role = await configRepo.getRolePermission('VERIFICATION_EXECUTIVE');

      expect(getSpy).toHaveBeenCalledWith('/admin/roles/VERIFICATION_EXECUTIVE');
      expect(role.role).toBe('VERIFICATION_EXECUTIVE');
      expect(role.permissions).toContain('verification.review');
    });

    it('rejects unrecognized role code before making request', async () => {
      await expect(configRepo.getRolePermission('UNKNOWN_ROLE')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('PUT /api/v1/admin/roles/{roleCode}/permissions Contract', () => {
    it('requires operational rationale before sending update request', async () => {
      await expect(
        configRepo.updateRolePermissions('OPERATIONS_ADMIN', ['dashboard.view'], '')
      ).rejects.toThrow(ValidationError);
    });

    it('blocks updating SUPER_ADMIN role client-side with ConcurrencyConflictError (ROLE_IMMUTABLE)', async () => {
      await expect(
        configRepo.updateRolePermissions('SUPER_ADMIN', ['dashboard.view'], 'Attempting to limit Super Admin')
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it('sends PUT /admin/roles/{roleCode}/permissions with SetRolePermissionsDto and X-Audit-Reason header', async () => {
      const mockResponse = {
        data: {
          role: 'OPERATIONS_ADMIN',
          roleName: 'Operations Admin',
          description: 'Updated operational policies',
          permissions: ['dashboard.view', 'bookings.manage', 'refunds.manage'],
          isImmutable: false,
        },
        status: 200,
      };

      const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValueOnce(mockResponse as never);

      const updated = await configRepo.updateRolePermissions(
        'OPERATIONS_ADMIN',
        ['dashboard.view', 'bookings.manage', 'refunds.manage'],
        'Expanding operational capabilities per Q-11'
      );

      expect(putSpy).toHaveBeenCalledWith(
        '/admin/roles/OPERATIONS_ADMIN/permissions',
        {
          permissionCodes: ['dashboard.view', 'bookings.manage', 'refunds.manage'],
        },
        {
          headers: {
            'X-Audit-Reason': 'Expanding operational capabilities per Q-11',
          },
        }
      );
      expect(updated.permissions).toContain('refunds.manage');
    });

    it('maps server 409 ROLE_IMMUTABLE to ConcurrencyConflictError', async () => {
      const axios409 = new axios.AxiosError('Request failed with status code 409');
      axios409.response = {
        status: 409,
        data: {
          code: 'ROLE_IMMUTABLE',
          message: 'The SUPER_ADMIN role permission set is immutable and cannot be altered',
        },
      } as never;

      vi.spyOn(httpClient, 'put').mockRejectedValueOnce(axios409);

      await expect(
        configRepo.updateRolePermissions('SUPPORT_EXECUTIVE', ['*'], 'Elevating to super admin')
      ).rejects.toThrow(ConcurrencyConflictError);
    });

    it('maps server 422 PERMISSION_UNKNOWN or PERMISSION_RESTRICTED to ValidationError', async () => {
      const axios422 = new axios.AxiosError('Request failed with status code 422');
      axios422.response = {
        status: 422,
        data: {
          code: 'PERMISSION_UNKNOWN',
          message: 'The permission code "invalid.fake.permission" is not in the system catalog',
        },
      } as never;

      vi.spyOn(httpClient, 'put').mockRejectedValueOnce(axios422);

      await expect(
        configRepo.updateRolePermissions('OPERATIONS_ADMIN', ['invalid.fake.permission'], 'Test rationale')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('GET /api/v1/admin/permissions Contract', () => {
    it('requests /admin/permissions and extracts permission codes from catalog', async () => {
      const mockResponse = {
        data: [
          'dashboard.view',
          'customers.view',
          'worker.view',
          'verification.review',
          'bookings.manage',
        ],
        status: 200,
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse as never);

      const catalog = await configRepo.getPermissionCatalog();

      expect(getSpy).toHaveBeenCalledWith('/admin/permissions');
      expect(catalog).toEqual([
        'dashboard.view',
        'customers.view',
        'worker.view',
        'verification.review',
        'bookings.manage',
      ]);
    });

    it('extracts codes from structured permission catalog items [{ code, name, description }]', async () => {
      const mockResponse = {
        data: [
          { code: 'dashboard.view', name: 'Dashboard View' },
          { code: 'audit.view', name: 'Audit Trail View' },
        ],
        status: 200,
      };

      vi.spyOn(httpClient, 'get').mockResolvedValueOnce(mockResponse as never);

      const catalog = await configRepo.getPermissionCatalog();
      expect(catalog).toEqual(['dashboard.view', 'audit.view']);
    });
  });

  describe('GET /api/v1/reference-data Contract', () => {
    it('fetches unauthenticated reference data and validates mandatory collections', async () => {
      const mockLivePayload = {
        engagements: ['FULL_TIME', 'PART_TIME', 'LIVE_IN', 'DAILY', 'HOURLY', 'SHIFT', 'ONE_TIME'],
        budgetPeriods: ['HOUR', 'DAY', 'MONTH', 'ONE_TIME'],
        reportReasons: ['HARASSMENT', 'THEFT', 'SAFETY_CONCERN', 'MISCONDUCT', 'FRAUD', 'NO_SHOW', 'OTHER'],
        ticketPriorities: ['LOW', 'MEDIUM', 'HIGH'],
        languages: ['en'],
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: mockLivePayload,
        status: 200,
      } as never);

      const refData = await refDataRepo.getReferenceData();

      expect(getSpy).toHaveBeenCalledWith('/reference-data');
      expect(refData.engagements).toContain('FULL_TIME');
      expect(refData.budgetPeriods).toContain('MONTH');
      expect(refData.reportReasons).toContain('SAFETY_CONCERN');
      expect(refData.ticketPriorities).toEqual(['LOW', 'MEDIUM', 'HIGH']);
      expect(refData.languages).toEqual(['en']);
    });

    it('rejects malformed reference data missing required collections', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: { engagements: ['FULL_TIME'] }, // missing other required collections
        status: 200,
      } as never);

      await expect(refDataRepo.getReferenceData()).rejects.toThrow(ServerFailureError);
    });
  });

  describe('GET /api/v1/app-config Contract', () => {
    it('fetches public system application configuration', async () => {
      const mockLiveAppConfig = {
        customer: { minVersion: null },
        worker: { minVersion: null },
        maintenance: false,
        support: { phone: '+919999999999', email: 'support@sevanest.com' },
        legal: { acceptanceRequired: false, terms: null, privacy: null },
        languages: ['en'],
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: mockLiveAppConfig,
        status: 200,
      } as never);

      const appConfig = await refDataRepo.getAppConfig();

      expect(getSpy).toHaveBeenCalledWith('/app-config');
      expect(appConfig.maintenance).toBe(false);
      expect(appConfig.support.email).toBe('support@sevanest.com');
      expect(appConfig.languages).toEqual(['en']);
    });
  });

  describe('GET /api/v1/admin/verification/requirements Contract', () => {
    it('fetches required checks list for worker verification', async () => {
      const mockRequirements = {
        checkTypes: [
          'IDENTITY',
          'ADDRESS',
          'EMERGENCY_CONTACT',
          'PREVIOUS_EMPLOYMENT',
          'POLICE_VERIFICATION',
        ],
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: mockRequirements,
        status: 200,
      } as never);

      const requirements = await refDataRepo.getVerificationRequirements();

      expect(getSpy).toHaveBeenCalledWith('/admin/verification/requirements');
      expect(requirements.checkTypes).toHaveLength(5);
      expect(requirements.checkTypes).toContain('POLICE_VERIFICATION');
    });
  });

  describe('Diagnostics & Network Handling', () => {
    it('diagnoses network connectivity failure or CORS issues without crashing', async () => {
      const networkError = new axios.AxiosError('Network Error', 'ERR_NETWORK');

      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(networkError);

      await expect(configRepo.getRolePermissions()).rejects.toThrow(NetworkError);
    });
  });
});
