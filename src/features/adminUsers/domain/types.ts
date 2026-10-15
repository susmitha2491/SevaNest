import { AdminRole } from '../../../core/auth/authTypes';

export interface AdminAccountItem {
  id: string;
  email: string;
  name: string;
  mobileMasked?: string;
  type: 'ADMIN' | 'CUSTOMER' | 'WORKER';
  status: 'ACTIVE' | 'SUSPENDED';
  role: AdminRole;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAdminAccountDto {
  email: string;
  password: string;
  roleCode: AdminRole;
}

export interface ChangeAdminAccountRoleDto {
  roleCode: AdminRole;
  reason?: string;
}

export interface UpdateAdminAccountStatusDto {
  status: 'ACTIVE' | 'SUSPENDED';
  reason: string;
}

export interface PaginatedAdminAccounts {
  items: AdminAccountItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IAdminUserRepository {
  getAdminUsers(params?: {
    page?: number;
    limit?: number;
    status?: 'ACTIVE' | 'SUSPENDED';
  }): Promise<PaginatedAdminAccounts>;
  getAdminUserById(userId: string): Promise<AdminAccountItem>;
  createAdminUser(dto: CreateAdminAccountDto): Promise<AdminAccountItem>;
  changeAdminUserRole(userId: string, dto: ChangeAdminAccountRoleDto): Promise<AdminAccountItem>;
  updateAdminUserStatus(userId: string, dto: UpdateAdminAccountStatusDto): Promise<AdminAccountItem>;
}
