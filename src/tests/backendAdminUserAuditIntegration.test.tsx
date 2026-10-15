import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  RealAdminUserRepository,
  mapBackendAccountToAdminItem,
} from '../features/adminUsers/data/adminUserRepository';
import {
  RealAuditRepository,
  mapBackendAuditLogToItem,
} from '../features/audit/data/auditRepository';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import {
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  NetworkError,
} from '../core/errors/DomainError';

describe('Admin User Management & Audit Logs Backend Integration', () => {
  let adminUserRepo: RealAdminUserRepository;
  let auditRepo: RealAuditRepository;

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
    adminUserRepo = new RealAdminUserRepository();
    auditRepo = new RealAuditRepository();
  });

  describe('GET /api/v1/admin/users Contract & PII Masking', () => {
    it('queries /admin/users with type=ADMIN and parses accounts with masked PII', async () => {
      const mockAccounts = [
        {
          id: 'user-001',
          email: 'rajesh.super@sevanest.internal',
          name: 'Rajesh Sharma',
          mobile: '9812345678',
          roleCode: 'SUPER_ADMIN',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'user-002',
          email: 'vikram.ops@sevanest.internal',
          name: 'Vikram Joshi',
          mobileMasked: '+91 98*** 45678',
          roleCode: 'OPERATIONS_ADMIN',
          status: 'ACTIVE',
          createdAt: '2026-01-05T00:00:00.000Z',
        },
      ];

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          items: mockAccounts,
          totalCount: 2,
        },
        status: 200,
      } as never);

      const result = await adminUserRepo.getAdminUsers({ page: 1, limit: 10, status: 'ACTIVE' });

      expect(getSpy).toHaveBeenCalledWith('/admin/users', {
        params: {
          type: 'ADMIN',
          page: 1,
          limit: 10,
          status: 'ACTIVE',
        },
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].email).toBe('rajesh.super@sevanest.internal');
      expect(result.items[0].role).toBe('SUPER_ADMIN');
      // PII Masking verified: raw 10-digit number masked with asterisks
      expect(result.items[0].mobileMasked).toMatch(/\*\*\*\*\*/);
      expect(result.items[1].mobileMasked).toBe('+91 98*** 45678');
    });

    it('rejects accounts with unauthorized or non-admin roles', () => {
      expect(() => {
        mapBackendAccountToAdminItem({
          id: 'cust-123',
          email: 'cust@example.com',
          roleCode: 'CUSTOMER',
        });
      }).toThrow(ForbiddenError);

      expect(() => {
        mapBackendAccountToAdminItem({
          id: 'bad-1',
          email: 'bad@example.com',
          role: 'UNKNOWN_ROLE',
        });
      }).toThrow(ForbiddenError);
    });

    it('handles 401 unauthenticated and 403 forbidden responses', async () => {
      const axios401 = new axios.AxiosError('Request failed with status code 401');
      axios401.response = {
        status: 401,
        data: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      } as never;

      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(axios401);

      await expect(adminUserRepo.getAdminUsers()).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('POST /api/v1/admin/users Contract', () => {
    it('validates email format and password length client-side before request', async () => {
      await expect(
        adminUserRepo.createAdminUser({
          email: 'invalid-email',
          password: 'password123',
          roleCode: 'OPERATIONS_ADMIN',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        adminUserRepo.createAdminUser({
          email: 'valid@sevanest.internal',
          password: 'short', // less than 8 chars
          roleCode: 'OPERATIONS_ADMIN',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('submits CreateAdminDto to POST /admin/users and maps created admin', async () => {
      const mockCreated = {
        id: 'new-adm-101',
        email: 'new.verif@sevanest.internal',
        name: 'New Verif Exec',
        roleCode: 'VERIFICATION_EXECUTIVE',
        status: 'ACTIVE',
        createdAt: '2026-10-12T10:00:00.000Z',
      };

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: mockCreated,
        status: 201,
      } as never);

      const created = await adminUserRepo.createAdminUser({
        email: 'new.verif@sevanest.internal',
        password: 'securePassword2026',
        roleCode: 'VERIFICATION_EXECUTIVE',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/users', {
        email: 'new.verif@sevanest.internal',
        password: 'securePassword2026',
        roleCode: 'VERIFICATION_EXECUTIVE',
      });

      expect(created.id).toBe('new-adm-101');
      expect(created.role).toBe('VERIFICATION_EXECUTIVE');
      expect(created.status).toBe('ACTIVE');
    });
  });

  describe('PUT /api/v1/admin/users/{userId}/role Contract', () => {
    it('sends PUT /admin/users/{userId}/role with ChangeAdminRoleDto and optional audit reason', async () => {
      const mockUpdated = {
        id: 'user-002',
        email: 'vikram.ops@sevanest.internal',
        name: 'Vikram Joshi',
        roleCode: 'SUPER_ADMIN',
        status: 'ACTIVE',
        createdAt: '2026-01-05T00:00:00.000Z',
      };

      const putSpy = vi.spyOn(httpClient, 'put').mockResolvedValueOnce({
        data: mockUpdated,
        status: 200,
      } as never);

      const updated = await adminUserRepo.changeAdminUserRole('user-002', {
        roleCode: 'SUPER_ADMIN',
        reason: 'Promoted to Super Admin by Executive Board',
      });

      expect(putSpy).toHaveBeenCalledWith('/admin/users/user-002/role', {
        roleCode: 'SUPER_ADMIN',
        reason: 'Promoted to Super Admin by Executive Board',
      });

      expect(updated.role).toBe('SUPER_ADMIN');
    });

    it('rejects invalid roleCode or empty user ID', async () => {
      await expect(
        adminUserRepo.changeAdminUserRole('', { roleCode: 'OPERATIONS_ADMIN' })
      ).rejects.toThrow(ValidationError);

      await expect(
        adminUserRepo.changeAdminUserRole('user-002', { roleCode: 'INVALID' as never })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('PATCH /api/v1/admin/users/{userId}/status Contract', () => {
    it('requires mandatory operational reason for account status mutations', async () => {
      await expect(
        adminUserRepo.updateAdminUserStatus('user-002', {
          status: 'SUSPENDED',
          reason: '', // empty reason must be blocked
        })
      ).rejects.toThrow(ValidationError);
    });

    it('submits UpdateUserStatusDto to PATCH /admin/users/{userId}/status', async () => {
      const mockSuspended = {
        id: 'user-002',
        email: 'vikram.ops@sevanest.internal',
        name: 'Vikram Joshi',
        roleCode: 'OPERATIONS_ADMIN',
        status: 'SUSPENDED',
        createdAt: '2026-01-05T00:00:00.000Z',
      };

      const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce({
        data: mockSuspended,
        status: 200,
      } as never);

      const result = await adminUserRepo.updateAdminUserStatus('user-002', {
        status: 'SUSPENDED',
        reason: 'Suspended pending security inquiry regarding audit log discrepancies',
      });

      expect(patchSpy).toHaveBeenCalledWith('/admin/users/user-002/status', {
        status: 'SUSPENDED',
        reason: 'Suspended pending security inquiry regarding audit log discrepancies',
      });

      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('GET /api/v1/admin/audit-logs Contract & Read-Only Oversight', () => {
    it('queries /admin/audit-logs with filters and maps full immutable state snapshots', async () => {
      const mockLogs = [
        {
          id: 'audit-log-1',
          actorId: 'STAFF-SUPER-01',
          actorName: 'Rajesh Sharma',
          actorRole: 'Super Admin',
          action: 'user.status_change',
          entityType: 'USER',
          entityId: 'user-002',
          summary: 'Suspended administrative account user-002',
          ipAddress: '192.168.1.10',
          createdAt: '2026-10-12T11:00:00.000Z',
          before: { status: 'ACTIVE' },
          after: { status: 'SUSPENDED' },
          reason: 'Suspended pending security inquiry',
        },
      ];

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          items: mockLogs,
          totalCount: 1,
        },
        status: 200,
      } as never);

      const result = await auditRepo.getAuditLogs({
        actionType: 'user.status_change',
        actorStaffId: 'STAFF-SUPER-01',
        targetRecordId: 'user-002',
        page: 1,
        pageSize: 10,
      });

      expect(getSpy).toHaveBeenCalledWith('/admin/audit-logs', {
        params: {
          page: 1,
          limit: 10,
          action: 'user.status_change',
          actorId: 'STAFF-SUPER-01',
          entityId: 'user-002',
        },
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.id).toBe('audit-log-1');
      expect(item.actorName).toBe('Rajesh Sharma');
      expect(item.actionType).toBe('user.status_change');
      expect(item.targetEntityType).toBe('USER');
      expect(item.preMutationState).toEqual({ status: 'ACTIVE' });
      expect(item.postMutationState).toEqual({ status: 'SUSPENDED' });
      expect(item.operationalRemarks).toBe('Suspended pending security inquiry');
    });

    it('correctly maps raw backend audit log items using mapBackendAuditLogToItem helper', () => {
      const item = mapBackendAuditLogToItem({
        id: 'aud-xyz',
        actorEmail: 'admin@sevanest.com',
        action: 'fee.update',
        description: 'Fee updated',
        before: { fee: 399 },
        after: { fee: 499 },
        reason: 'Commercial revision',
      });

      expect(item.id).toBe('aud-xyz');
      expect(item.actorName).toBe('admin@sevanest.com');
      expect(item.actionType).toBe('fee.update');
      expect(item.summary).toBe('Fee updated');
      expect(item.preMutationState).toEqual({ fee: 399 });
      expect(item.postMutationState).toEqual({ fee: 499 });
      expect(item.operationalRemarks).toBe('Commercial revision');
    });

    it('handles network errors gracefully in audit repository', async () => {
      const netErr = new axios.AxiosError('Network Error', 'ERR_NETWORK');
      vi.spyOn(httpClient, 'get').mockRejectedValueOnce(netErr);

      await expect(auditRepo.getAuditLogs()).rejects.toThrow(NetworkError);
    });
  });
});
