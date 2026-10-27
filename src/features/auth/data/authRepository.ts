import { AdminRole, AdminUser, LoginCredentials, IAuthRepository, ActiveSessionItem } from '../../../core/auth/authTypes';
import { UnauthorizedError, ForbiddenError, ServerFailureError } from '../../../core/errors/DomainError';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { useAuthStore } from '../../../core/auth/authStore';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { getStoredRefreshToken } from '../../../core/auth/tokenStorage';
import { requestTokenRefresh } from '../../../core/auth/tokenRefreshCoordinator';

/**
 * Defined development-only demo credentials.
 * Used exclusively when VITE_USE_MOCK_AUTH is enabled.
 */
export const DEMO_AUTH_PASSWORD = 'password123';

export const DEMO_ADMIN_ACCOUNTS: Record<
  string,
  {
    id: string;
    name: string;
    role: AdminRole;
    permissions: string[];
    aliases: string[];
  }
> = {
  'super.admin@sevanest.internal': {
    id: 'adm-001',
    name: 'Super Administrator',
    role: 'SUPER_ADMIN',
    permissions: ['*'],
    aliases: ['super.admin@sevanest.internal', 'super@sevanest.internal'],
  },
  'ops.admin@sevanest.internal': {
    id: 'adm-002',
    name: 'Operations Manager',
    role: 'OPERATIONS_ADMIN',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
      PERMISSIONS.WORKER_VIEW,
      PERMISSIONS.WORKERS_MANAGE,
      PERMISSIONS.WORKERS_MANAGE_STATUS,
      PERMISSIONS.WORKER_ACTIVATE,
      PERMISSIONS.VERIFICATION_REVIEW,
      PERMISSIONS.VERIFICATION_SIGNOFF,
      PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.REFUNDS_MANAGE,
      PERMISSIONS.SUPPORT_VIEW,
      PERMISSIONS.SUPPORT_MANAGE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.EXPORTS_GENERATE,
    ],
    aliases: ['ops.admin@sevanest.internal', 'ops@sevanest.internal', 'operations.manager@sevanest.example.com'],
  },
  'verification.exec@sevanest.internal': {
    id: 'adm-003',
    name: 'Verification Executive',
    role: 'VERIFICATION_EXECUTIVE',
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.WORKER_VIEW,
      PERMISSIONS.VERIFICATION_REVIEW,
      PERMISSIONS.VERIFICATION_DECIDE,
      PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
    ],
    aliases: ['verification.exec@sevanest.internal', 'verif.exec@sevanest.internal', 'verif@sevanest.internal', 'verification.executive@sevanest.example.com'],
  },
  'support.exec@sevanest.internal': {
    id: 'adm-004',
    name: 'Support Executive',
    role: 'SUPPORT_EXECUTIVE',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.WORKER_VIEW,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.SUPPORT_VIEW,
      PERMISSIONS.SUPPORT_MANAGE,
    ],
    aliases: ['support.exec@sevanest.internal', 'support@sevanest.internal', 'support.executive@sevanest.example.com'],
  },
  'verification.supervisor@sevanest.internal': {
    id: 'adm-005',
    name: 'Verification Supervisor',
    role: 'VERIFICATION_SUPERVISOR',
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.WORKER_VIEW,
      PERMISSIONS.VERIFICATION_REVIEW,
      PERMISSIONS.VERIFICATION_DECIDE,
      PERMISSIONS.VERIFICATION_SIGNOFF,
      PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
    ],
    aliases: [
      'verification.supervisor@sevanest.internal',
      'verif.supervisor@sevanest.internal',
      'supervisor@sevanest.internal',
      'verification.supervisor@sevanest.example.com',
    ],
  },
};

export function getDefaultPermissionsForRole(role: AdminRole): string[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['*'];
    case 'OPERATIONS_ADMIN':
      return [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.CUSTOMERS_MANAGE,
        PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.WORKERS_MANAGE,
        PERMISSIONS.WORKERS_MANAGE_STATUS,
        PERMISSIONS.WORKER_ACTIVATE,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_SIGNOFF,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.BOOKINGS_MANAGE,
        PERMISSIONS.PAYMENTS_VIEW,
        PERMISSIONS.REFUNDS_MANAGE,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.EXPORTS_GENERATE,
      ];
    case 'VERIFICATION_EXECUTIVE':
      return [
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DECIDE,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
      ];
    case 'VERIFICATION_SUPERVISOR':
      return [
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DECIDE,
        PERMISSIONS.VERIFICATION_SIGNOFF,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
      ];
    case 'SUPPORT_EXECUTIVE':
      return [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_MANAGE,
      ];
  }
}

/**
 * Validates and maps a backend user object into the strongly-typed AdminUser domain model.
 * Does NOT fabricate role permissions or grant elevated access for missing or unknown roles.
 * Preserves authoritative server-issued permissions consistently across login, refresh, and session restoration.
 */
export function mapBackendUserToAdminUser(data: unknown, emailFallback?: string): AdminUser {
  if (!data || typeof data !== 'object') {
    throw new ServerFailureError('Invalid user profile received from authentication server.');
  }

  const root = data as Record<string, unknown>;

  // Recursively unwrap nested envelopes: { data: ... }, { user: ... }, { admin: ... }, { profile: ... }, { account: ... }
  let record = root;
  let unwrapped = true;
  while (unwrapped && record && typeof record === 'object' && !Array.isArray(record)) {
    unwrapped = false;
    for (const key of ['data', 'user', 'admin', 'profile', 'account'] as const) {
      const nested = record[key];
      if (
        nested &&
        typeof nested === 'object' &&
        !Array.isArray(nested) &&
        !('role' in record || 'roleCode' in record || 'roles' in record)
      ) {
        record = nested as Record<string, unknown>;
        unwrapped = true;
        break;
      }
    }
  }

  // Identify nested user entity inside record or root for secondary field resolution
  const findNestedObject = (obj: Record<string, unknown>): Record<string, unknown> | null => {
    for (const key of ['user', 'admin', 'profile', 'account', 'data'] as const) {
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return val as Record<string, unknown>;
      }
    }
    return null;
  };

  const nestedUser = findNestedObject(record) || findNestedObject(root);

  const getField = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (record[k] !== undefined && record[k] !== null && record[k] !== '') return record[k];
      if (nestedUser && nestedUser[k] !== undefined && nestedUser[k] !== null && nestedUser[k] !== '') return nestedUser[k];
      if (root[k] !== undefined && root[k] !== null && root[k] !== '') return root[k];
    }
    return undefined;
  };

  // Extract raw role representation supporting strings and structured role objects
  let rawRole = '';
  const directRole = getField('role');
  if (typeof directRole === 'string') {
    rawRole = directRole;
  } else if (directRole && typeof directRole === 'object') {
    const roleObj = directRole as Record<string, unknown>;
    rawRole = String(roleObj.code || roleObj.role || roleObj.id || roleObj.name || '');
  } else if (getField('roleCode', 'role_code')) {
    rawRole = String(getField('roleCode', 'role_code'));
  } else {
    const rolesArr = (getField('roles') || root.roles || record.roles) as unknown;
    if (Array.isArray(rolesArr) && rolesArr.length > 0) {
      const firstRole = rolesArr[0];
      if (typeof firstRole === 'string') {
        rawRole = firstRole;
      } else if (firstRole && typeof firstRole === 'object') {
        const roleObj = firstRole as Record<string, unknown>;
        rawRole = String(roleObj.code || roleObj.role || roleObj.id || roleObj.name || '');
      }
    } else if (getField('roleName', 'role_name')) {
      rawRole = String(getField('roleName', 'role_name'));
    }
  }

  rawRole = rawRole.toUpperCase().trim();

  // Role alias normalization: map backend variations to canonical AdminRole
  if (rawRole === 'OPERATIONS_MANAGER' || rawRole === 'OPS_MANAGER' || rawRole === 'OPS_ADMIN') {
    rawRole = 'OPERATIONS_ADMIN';
  } else if (rawRole === 'VERIFICATION_OFFICER' || rawRole === 'VERIF_EXEC') {
    rawRole = 'VERIFICATION_EXECUTIVE';
  } else if (rawRole === 'VERIFICATION_SUPERVISOR' || rawRole === 'VERIF_SUPERVISOR' || rawRole === 'VERIFICATION_LEAD') {
    rawRole = 'VERIFICATION_SUPERVISOR';
  } else if (rawRole === 'SUPPORT_EXEC' || rawRole === 'SUPPORT_MANAGER') {
    rawRole = 'SUPPORT_EXECUTIVE';
  }

  const validRoles: AdminRole[] = [
    'SUPER_ADMIN',
    'OPERATIONS_ADMIN',
    'VERIFICATION_EXECUTIVE',
    'VERIFICATION_SUPERVISOR',
    'SUPPORT_EXECUTIVE',
  ];

  if (!validRoles.includes(rawRole as AdminRole)) {
    throw new ForbiddenError(
      `Access denied: The administrative role "${rawRole || 'UNASSIGNED'}" is not authorized for the Admin Portal.`
    );
  }

  const role = rawRole as AdminRole;

  // Extract permissions from all possible authoritative server shapes
  let rawPermissionsList: unknown[] | null = null;
  const permissionsCandidate =
    getField('permissions') ??
    getField('permissionCodes', 'permission_codes') ??
    getField('rolePermissions', 'role_permissions') ??
    getField('authorities') ??
    getField('scopes');

  if (Array.isArray(permissionsCandidate)) {
    rawPermissionsList = permissionsCandidate;
  } else if (Array.isArray(record.permissions)) {
    rawPermissionsList = record.permissions;
  } else if (Array.isArray(root.permissions)) {
    rawPermissionsList = root.permissions;
  } else if (root.data && typeof root.data === 'object' && Array.isArray((root.data as Record<string, unknown>).permissions)) {
    rawPermissionsList = (root.data as Record<string, unknown>).permissions as unknown[];
  } else if (directRole && typeof directRole === 'object') {
    const roleObj = directRole as Record<string, unknown>;
    if (Array.isArray(roleObj.permissions)) {
      rawPermissionsList = roleObj.permissions;
    } else if (Array.isArray(roleObj.permissionCodes)) {
      rawPermissionsList = roleObj.permissionCodes;
    }
  } else if (Array.isArray(record.roles) && record.roles[0] && typeof record.roles[0] === 'object') {
    const firstRoleObj = record.roles[0] as Record<string, unknown>;
    if (Array.isArray(firstRoleObj.permissions)) {
      rawPermissionsList = firstRoleObj.permissions;
    } else if (Array.isArray(firstRoleObj.permissionCodes)) {
      rawPermissionsList = firstRoleObj.permissionCodes;
    }
  }

  const extractPermissionString = (item: unknown): string => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const candidate = obj.code || obj.permissionCode || obj.permission || obj.name || obj.key || obj.id;
      if (candidate) return String(candidate).trim();
    }
    return String(item).trim();
  };

  let permissions: string[] = [];
  if (role === 'SUPER_ADMIN') {
    permissions = ['*'];
  } else if (rawPermissionsList !== null) {
    // Authoritative server-issued permissions provided by backend
    permissions = rawPermissionsList
      .map(extractPermissionString)
      .filter((p) => p && p !== '[object Object]');
  } else {
    // Fall back to role-defined baseline when server response omits permissions array
    permissions = getDefaultPermissionsForRole(role);
  }

  const rawFirst = String(getField('firstName', 'first_name') || '').trim();
  const rawLast = String(getField('lastName', 'last_name') || '').trim();
  const nameFromParts = [rawFirst, rawLast].filter(Boolean).join(' ');

  const candidateName =
    String(getField('name', 'fullName', 'full_name', 'displayName', 'display_name') || '').trim() ||
    nameFromParts ||
    String(getField('username', 'user_name') || '').trim();

  const candidateEmail =
    String(getField('email', 'emailAddress', 'email_address') || '').trim() ||
    emailFallback?.trim() ||
    '';

  // Fallback approved by requirements: non-misleading 'Account' when backend omits display name
  const resolvedName = candidateName || 'Account';

  return {
    id: String(getField('id', 'userId', 'user_id', 'uuid', 'adminId') || 'admin-user'),
    name: resolvedName,
    email: candidateEmail,
    role,
    permissions,
  };
}

/**
 * Real Backend Authentication Repository Implementation for SevaNest Admin Portal.
 * Connects directly to deployed SevaNest API endpoints:
 * - POST /api/v1/auth/admin/login
 * - POST /api/v1/auth/logout
 * - POST /api/v1/auth/token/refresh
 * - GET  /api/v1/users/me
 */
export class RealAuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<{ user: AdminUser; accessToken: string; refreshToken?: string }> {
    const email = credentials.email?.trim();
    const password = credentials.password;

    if (!email || !password) {
      throw new UnauthorizedError('Administrative email and password are required.');
    }

    try {
      // Call POST /auth/admin/login
      const response = await httpClient.post<Record<string, unknown>>('/auth/admin/login', {
        email,
        password,
        ...(credentials.deviceId ? { deviceId: credentials.deviceId } : {}),
        ...(credentials.deviceName ? { deviceName: credentials.deviceName } : {}),
      });

      const rawData = response.data;
      if (!rawData || typeof rawData !== 'object') {
        throw new ServerFailureError('Unexpected response from authentication server.');
      }

      // Safely support both flat responses and nested envelopes ({ data: ... } or { tokens: ... })
      const payload = (rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data))
        ? (rawData.data as Record<string, unknown>)
        : (rawData.tokens && typeof rawData.tokens === 'object' && !Array.isArray(rawData.tokens))
        ? (rawData.tokens as Record<string, unknown>)
        : rawData;

      const accessToken = (payload.accessToken || payload.token || payload.access_token || rawData.accessToken) as string | undefined;
      const refreshToken = (payload.refreshToken || payload.refresh_token || rawData.refreshToken) as string | undefined;

      if (!accessToken || typeof accessToken !== 'string') {
        throw new ServerFailureError('Unexpected response from authentication server: missing accessToken.');
      }

      // If user object or roles/permissions are returned directly with login response, map them; otherwise fetch from /users/me
      let user: AdminUser;
      const userSource = (payload.user || rawData.user) as Record<string, unknown> | undefined;
      const hasDirectRoleOrPermissions =
        payload.role !== undefined ||
        rawData.role !== undefined ||
        payload.roles !== undefined ||
        rawData.roles !== undefined ||
        payload.permissions !== undefined ||
        rawData.permissions !== undefined;

      if (userSource && typeof userSource === 'object') {
        const mergedUser = {
          ...userSource,
          ...(payload.permissions !== undefined ? { permissions: payload.permissions } : rawData.permissions !== undefined ? { permissions: rawData.permissions } : {}),
          ...(payload.permissionCodes !== undefined ? { permissionCodes: payload.permissionCodes } : rawData.permissionCodes !== undefined ? { permissionCodes: rawData.permissionCodes } : {}),
          ...(payload.role !== undefined ? { role: payload.role } : rawData.role !== undefined ? { role: rawData.role } : {}),
          ...(payload.roles !== undefined ? { roles: payload.roles } : rawData.roles !== undefined ? { roles: rawData.roles } : {}),
        };
        user = mapBackendUserToAdminUser(mergedUser, email);
      } else if (hasDirectRoleOrPermissions) {
        user = mapBackendUserToAdminUser(payload, email);
      } else {
        const meResponse = await httpClient.get('/users/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        user = mapBackendUserToAdminUser(meResponse.data, email);
      }

      return { user, accessToken, refreshToken };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async logout(): Promise<void> {
    try {
      await httpClient.post('/auth/logout');
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async refreshToken(token?: string): Promise<{ accessToken: string; refreshToken?: string; user?: AdminUser }> {
    return requestTokenRefresh(token);
  }

  async getCurrentSession(accessToken?: string): Promise<AdminUser | null> {
    const token = accessToken || useAuthStore.getState().accessToken;
    if (!token) {
      try {
        const response = await httpClient.get('/users/me');
        return mapBackendUserToAdminUser(response.data);
      } catch {
        return null;
      }
    }

    try {
      const response = await httpClient.get('/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return mapBackendUserToAdminUser(response.data);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async listSessions(): Promise<ActiveSessionItem[]> {
    try {
      const response = await httpClient.get<ActiveSessionItem[]>('/auth/sessions');
      return Array.isArray(response.data) ? response.data : [];
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    try {
      await httpClient.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

/**
 * Mock Authentication Repository Implementation for SevaNest Admin Portal.
 * Used for development sandbox and offline testing.
 */
export class MockAuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<{ user: AdminUser; accessToken: string; refreshToken?: string }> {
    const email = credentials.email?.trim().toLowerCase();
    const password = credentials.password || '';

    if (!email || !password) {
      throw new UnauthorizedError('Administrative email and password are required.');
    }

    const accountEntry = Object.entries(DEMO_ADMIN_ACCOUNTS).find(([accountEmail, config]) => {
      return (
        accountEmail === email ||
        config.aliases.includes(email) ||
        email === config.role.toLowerCase() ||
        (email.includes(config.role.split('_')[0].toLowerCase().slice(0, 5)) && email.endsWith('@sevanest.internal'))
      );
    });

    if (!accountEntry) {
      throw new UnauthorizedError('Administrative account not found. Please verify your email address.');
    }

    if (password !== DEMO_AUTH_PASSWORD) {
      throw new UnauthorizedError('Invalid administrative credentials. Please verify your email and password.');
    }

    const [accountEmail, accountConfig] = accountEntry;
    const rolePrefix = accountConfig.role.split('_')[0].toLowerCase();

    return {
      user: {
        id: accountConfig.id,
        name: accountConfig.name,
        email: accountEmail,
        role: accountConfig.role,
        permissions: [...accountConfig.permissions],
      },
      accessToken: `token-${rolePrefix}-${Date.now()}`,
      refreshToken: `refresh-${rolePrefix}-${Date.now()}`,
    };
  }

  async logout(): Promise<void> {
    return Promise.resolve();
  }

  async refreshToken(token?: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const currentRefreshToken = token || useAuthStore.getState().refreshToken || getStoredRefreshToken();
    if (!currentRefreshToken) {
      throw new UnauthorizedError('No active refresh token available.');
    }

    const match = currentRefreshToken.match(/^refresh-([a-z]+)-/);
    if (!match || currentRefreshToken.includes('invalid') || currentRefreshToken.includes('expired')) {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    const rolePrefix = match[1];
    const newAccessToken = `token-${rolePrefix}-${Date.now()}`;
    const newRefreshToken = `refresh-${rolePrefix}-${Date.now()}`;

    useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
    return Promise.resolve({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  }

  async getCurrentSession(accessToken?: string): Promise<AdminUser | null> {
    const token = accessToken || useAuthStore.getState().accessToken;
    if (!token) return Promise.resolve(null);

    const match = token.match(/token-([a-z]+)-/);
    const rolePrefix = match ? match[1] : '';

    const account = Object.values(DEMO_ADMIN_ACCOUNTS).find((acc) =>
      acc.role.toLowerCase().startsWith(rolePrefix)
    );

    if (account) {
      const email = Object.keys(DEMO_ADMIN_ACCOUNTS).find(
        (key) => DEMO_ADMIN_ACCOUNTS[key].id === account.id
      ) || 'super.admin@sevanest.internal';

      return Promise.resolve({
        id: account.id,
        name: account.name,
        email,
        role: account.role,
        permissions: [...account.permissions],
      });
    }

    return Promise.resolve(null);
  }

  async listSessions(): Promise<ActiveSessionItem[]> {
    return Promise.resolve([
      {
        id: 'sess-mock-01',
        deviceName: 'Chrome on Windows (Current Session)',
        ipAddress: '127.0.0.1',
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
      },
    ]);
  }

  async revokeSession(_sessionId: string): Promise<void> {
    return Promise.resolve();
  }
}

// Preserve backwards-compatible alias
export const AuthRepositoryImpl = RealAuthRepository;

/**
 * Factory creating the active IAuthRepository instance based on application configuration.
 */
export function createAuthRepository(useMock: boolean = env.VITE_USE_MOCK_AUTH): IAuthRepository {
  return useMock ? new MockAuthRepository() : new RealAuthRepository();
}

export const authRepository = createAuthRepository();

