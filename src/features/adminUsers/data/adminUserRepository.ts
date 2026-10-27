import {
  AdminAccountItem,
  CreateAdminAccountDto,
  ChangeAdminAccountRoleDto,
  UpdateAdminAccountStatusDto,
  PaginatedAdminAccounts,
  IAdminUserRepository,
} from '../domain/types';
import { AdminRole } from '../../../core/auth/authTypes';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import {
  ValidationError,
  ForbiddenError,
  ServerFailureError,
} from '../../../core/errors/DomainError';

const VALID_ADMIN_ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'VERIFICATION_EXECUTIVE',
  'VERIFICATION_SUPERVISOR',
  'SUPPORT_EXECUTIVE',
];

export function mapBackendAccountToAdminItem(raw: Record<string, unknown>): AdminAccountItem {
  const id = String(raw.id || raw.userId || '');
  const email = String(raw.email || '');
  const rawRole = String(raw.roleCode || raw.role || (Array.isArray(raw.roles) ? raw.roles[0] : '') || '');

  if (!VALID_ADMIN_ROLES.includes(rawRole as AdminRole)) {
    throw new ForbiddenError(
      `Access denied: Account "${id || email}" does not possess an authorized administrative role.`
    );
  }

  const role = rawRole as AdminRole;
  const status = String(raw.status || '').toUpperCase() === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
  const type = 'ADMIN';

  // Respect PII masking: Mask phone number if present and not already masked
  let mobileMasked = raw.mobileMasked ? String(raw.mobileMasked) : undefined;
  if (!mobileMasked && raw.mobile) {
    const rawMobile = String(raw.mobile);
    if (rawMobile.length >= 10) {
      mobileMasked = `${rawMobile.slice(0, 3)} ***** ${rawMobile.slice(-4)}`;
    } else {
      mobileMasked = rawMobile;
    }
  }

  const name = String(raw.name || raw.fullName || email.split('@')[0] || 'Admin User');
  const createdAt = String(raw.createdAt || new Date().toISOString());
  const updatedAt = raw.updatedAt ? String(raw.updatedAt) : undefined;

  return {
    id,
    email,
    name,
    mobileMasked,
    type,
    status,
    role,
    createdAt,
    updatedAt,
  };
}

export class RealAdminUserRepository implements IAdminUserRepository {
  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'SUSPENDED';
  }): Promise<PaginatedAdminAccounts> {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const queryParams: Record<string, unknown> = {
        type: 'ADMIN',
        page,
        limit,
      };

      if (params?.status) {
        queryParams.status = params.status;
      }

      const response = await httpClient.get('/admin/users', { params: queryParams });
      const data = response.data;

      let items: unknown[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        items = data;
        totalCount = data.length;
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        if (Array.isArray(record.items)) items = record.items;
        else if (Array.isArray(record.users)) items = record.users;
        else if (Array.isArray(record.data)) items = record.data;

        totalCount =
          typeof record.totalCount === 'number'
            ? record.totalCount
            : typeof record.total === 'number'
            ? record.total
            : items.length;
      }

      const mappedItems = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(mapBackendAccountToAdminItem);

      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      return {
        items: mappedItems,
        totalCount,
        page,
        limit,
        totalPages,
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getAdminUserById(userId: string): Promise<AdminAccountItem> {
    if (!userId?.trim()) {
      throw new ValidationError('User identifier is required.');
    }

    try {
      const response = await httpClient.get(`/admin/users/${encodeURIComponent(userId.trim())}`);
      if (!response.data || typeof response.data !== 'object') {
        throw new ServerFailureError(`Invalid response received for user ${userId}.`);
      }
      return mapBackendAccountToAdminItem(response.data as Record<string, unknown>);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async createAdminUser(dto: CreateAdminAccountDto): Promise<AdminAccountItem> {
    const email = dto.email?.trim();
    const password = dto.password;
    const roleCode = dto.roleCode;

    if (!email || !email.includes('@')) {
      throw new ValidationError('A valid email address is required for administrator provisioning.');
    }

    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long.');
    }

    if (!VALID_ADMIN_ROLES.includes(roleCode)) {
      throw new ValidationError(`Invalid role code "${roleCode}".`);
    }

    try {
      const response = await httpClient.post('/admin/users', {
        email,
        password,
        roleCode,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new ServerFailureError('Unexpected response from administrator creation endpoint.');
      }

      return mapBackendAccountToAdminItem(response.data as Record<string, unknown>);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async changeAdminUserRole(userId: string, dto: ChangeAdminAccountRoleDto): Promise<AdminAccountItem> {
    if (!userId?.trim()) {
      throw new ValidationError('User identifier is required.');
    }

    if (!VALID_ADMIN_ROLES.includes(dto.roleCode)) {
      throw new ValidationError(`Invalid role code "${dto.roleCode}".`);
    }

    try {
      const response = await httpClient.put(`/admin/users/${encodeURIComponent(userId.trim())}/role`, {
        roleCode: dto.roleCode,
        reason: dto.reason?.trim() || undefined,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new ServerFailureError('Unexpected response from role modification endpoint.');
      }

      return mapBackendAccountToAdminItem(response.data as Record<string, unknown>);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateAdminUserStatus(userId: string, dto: UpdateAdminAccountStatusDto): Promise<AdminAccountItem> {
    if (!userId?.trim()) {
      throw new ValidationError('User identifier is required.');
    }

    if (!dto.reason?.trim()) {
      throw new ValidationError('Operational justification remarks are mandatory for status changes.');
    }

    if (dto.status !== 'ACTIVE' && dto.status !== 'SUSPENDED') {
      throw new ValidationError('Status must be either ACTIVE or SUSPENDED.');
    }

    try {
      const response = await httpClient.patch(`/admin/users/${encodeURIComponent(userId.trim())}/status`, {
        status: dto.status,
        reason: dto.reason.trim(),
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new ServerFailureError('Unexpected response from status modification endpoint.');
      }

      return mapBackendAccountToAdminItem(response.data as Record<string, unknown>);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockAdminUserRepository implements IAdminUserRepository {
  private accounts: AdminAccountItem[] = [
    {
      id: 'adm-001',
      email: 'super.admin@sevanest.internal',
      name: 'Rajesh Sharma',
      mobileMasked: '+91 98111 *****',
      type: 'ADMIN',
      status: 'ACTIVE',
      role: 'SUPER_ADMIN',
      createdAt: '2026-01-15T09:00:00.000Z',
    },
    {
      id: 'adm-002',
      email: 'ops.admin@sevanest.internal',
      name: 'Vikram Joshi',
      mobileMasked: '+91 98222 *****',
      type: 'ADMIN',
      status: 'ACTIVE',
      role: 'OPERATIONS_ADMIN',
      createdAt: '2026-02-01T10:30:00.000Z',
    },
    {
      id: 'adm-003',
      email: 'verification.exec@sevanest.internal',
      name: 'Pooja Varma',
      mobileMasked: '+91 98333 *****',
      type: 'ADMIN',
      status: 'ACTIVE',
      role: 'VERIFICATION_EXECUTIVE',
      createdAt: '2026-02-15T11:00:00.000Z',
    },
    {
      id: 'adm-004',
      email: 'support.exec@sevanest.internal',
      name: 'Kavita Rao',
      mobileMasked: '+91 98444 *****',
      type: 'ADMIN',
      status: 'ACTIVE',
      role: 'SUPPORT_EXECUTIVE',
      createdAt: '2026-03-01T08:45:00.000Z',
    },
  ];

  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'SUSPENDED';
  }): Promise<PaginatedAdminAccounts> {
    let list = this.accounts;
    if (params?.status) {
      list = list.filter((a) => a.status === params.status);
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const totalCount = list.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const items = list.slice(startIndex, startIndex + limit);

    return {
      items: JSON.parse(JSON.stringify(items)),
      totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async getAdminUserById(userId: string): Promise<AdminAccountItem> {
    const acc = this.accounts.find((a) => a.id === userId);
    if (!acc) throw new ServerFailureError(`Admin account ${userId} not found.`);
    return JSON.parse(JSON.stringify(acc));
  }

  async createAdminUser(dto: CreateAdminAccountDto): Promise<AdminAccountItem> {
    if (!dto.email?.trim() || !dto.email.includes('@')) {
      throw new ValidationError('A valid email address is required.');
    }
    if (!dto.password || dto.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long.');
    }
    if (this.accounts.some((a) => a.email.toLowerCase() === dto.email.trim().toLowerCase())) {
      throw new ValidationError(`An account with email "${dto.email}" already exists.`);
    }

    const newAcc: AdminAccountItem = {
      id: `adm-${Date.now().toString().slice(-4)}`,
      email: dto.email.trim().toLowerCase(),
      name: dto.email.split('@')[0],
      mobileMasked: '+91 98*** *****',
      type: 'ADMIN',
      status: 'ACTIVE',
      role: dto.roleCode,
      createdAt: new Date().toISOString(),
    };

    this.accounts.push(newAcc);
    return JSON.parse(JSON.stringify(newAcc));
  }

  async changeAdminUserRole(userId: string, dto: ChangeAdminAccountRoleDto): Promise<AdminAccountItem> {
    const acc = this.accounts.find((a) => a.id === userId);
    if (!acc) throw new ServerFailureError(`Admin account ${userId} not found.`);

    acc.role = dto.roleCode;
    acc.updatedAt = new Date().toISOString();
    return JSON.parse(JSON.stringify(acc));
  }

  async updateAdminUserStatus(userId: string, dto: UpdateAdminAccountStatusDto): Promise<AdminAccountItem> {
    if (!dto.reason?.trim()) {
      throw new ValidationError('Operational justification remarks are mandatory for status changes.');
    }
    const acc = this.accounts.find((a) => a.id === userId);
    if (!acc) throw new ServerFailureError(`Admin account ${userId} not found.`);

    acc.status = dto.status;
    acc.updatedAt = new Date().toISOString();
    return JSON.parse(JSON.stringify(acc));
  }
}

export function createAdminUserRepository(): IAdminUserRepository {
  if (env.VITE_USE_MOCK_AUTH) {
    return new MockAdminUserRepository();
  }
  return new RealAdminUserRepository();
}

export const adminUserRepository = createAdminUserRepository();
