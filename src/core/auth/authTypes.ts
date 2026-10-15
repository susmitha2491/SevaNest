export type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'VERIFICATION_EXECUTIVE' | 'SUPPORT_EXECUTIVE';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: string[];
}

export interface AuthSession {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  deviceId?: string;
  deviceName?: string;
}

export interface ActiveSessionItem {
  id: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  lastActiveAt?: string;
  isCurrent?: boolean;
}

export interface IAuthRepository {
  login(credentials: LoginCredentials): Promise<{ user: AdminUser; accessToken: string; refreshToken?: string }>;
  logout(): Promise<void>;
  refreshToken(token?: string): Promise<{ accessToken: string; refreshToken?: string; user?: AdminUser }>;
  getCurrentSession(accessToken?: string): Promise<AdminUser | null>;
  listSessions?(): Promise<ActiveSessionItem[]>;
  revokeSession?(sessionId: string): Promise<void>;
}
