import {
  ServiceCategoryItem,
  OperationalAreaItem,
  FeePlanItem,
  NotificationTemplateItem,
  RolePermissionDefinition,
  IConfigurationRepository,
} from '../domain/types';
import { PERMISSIONS } from '../../../core/rbac/permissions';
import { AdminRole } from '../../../core/auth/authTypes';
import { getDefaultPermissionsForRole } from '../../auth/data/authRepository';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import {
  ForbiddenError,
  ValidationError,
  ConcurrencyConflictError,
  ServerFailureError,
} from '../../../core/errors/DomainError';

export function getRoleDisplayName(role: AdminRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'OPERATIONS_ADMIN':
      return 'Operations Admin';
    case 'VERIFICATION_EXECUTIVE':
      return 'Verification Executive';
    case 'SUPPORT_EXECUTIVE':
      return 'Support Executive';
  }
}

export function getRoleDefaultDescription(role: AdminRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'System master configuration, role delegation, financial policy approvals, and audit trail oversight.';
    case 'OPERATIONS_ADMIN':
      return 'Candidate matching, replacement fulfillment, booking lifecycle management, and financial refunds.';
    case 'VERIFICATION_EXECUTIVE':
      return 'Worker document vetting, Aadhaar & address proof validation, and reference phone checks.';
    case 'SUPPORT_EXECUTIVE':
      return 'Household grievance mediation, telephonic dispute logging, SLA countdowns, and Operations escalation.';
  }
}

export function mapBackendRoleToDefinition(raw: Record<string, unknown>): RolePermissionDefinition {
  const roleCode = String(raw.roleCode || raw.role || raw.code || '');
  const validRoles: AdminRole[] = [
    'SUPER_ADMIN',
    'OPERATIONS_ADMIN',
    'VERIFICATION_EXECUTIVE',
    'SUPPORT_EXECUTIVE',
  ];

  if (!validRoles.includes(roleCode as AdminRole)) {
    throw new ForbiddenError(
      `Access denied: Unknown or unauthorized administrative role "${roleCode || 'UNASSIGNED'}".`
    );
  }

  const role = roleCode as AdminRole;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  let permissions: string[] = [];
  if (Array.isArray(raw.permissions)) {
    permissions = raw.permissions.map(String);
  } else if (Array.isArray(raw.permissionCodes)) {
    permissions = raw.permissionCodes.map(String);
  } else if (isSuperAdmin) {
    permissions = ['*'];
  } else {
    permissions = getDefaultPermissionsForRole(role);
  }

  const roleName = String(raw.roleName || raw.name || getRoleDisplayName(role));
  const description = String(raw.description || getRoleDefaultDescription(role));
  const isImmutable = typeof raw.isImmutable === 'boolean' ? raw.isImmutable : isSuperAdmin;
  const accountsCount =
    typeof raw.accountsCount === 'number'
      ? raw.accountsCount
      : typeof raw.accountCount === 'number'
      ? raw.accountCount
      : typeof raw.count === 'number'
      ? raw.count
      : undefined;

  return {
    role,
    roleName,
    description,
    permissions,
    isImmutable,
    accountsCount,
  };
}

/**
 * Mock Configuration Repository for offline demo and isolated test suites.
 */
export class MockConfigurationRepository implements IConfigurationRepository {
  private categories: ServiceCategoryItem[] = [
    {
      id: 'CAT-MAID',
      name: 'House Maid',
      tagline: 'Household cleaning, sweeping, mopping, and utensil upkeep',
      iconName: 'Sparkles',
      allowedEngagementTypes: ['Part-time', 'Full-time', 'Live-in', 'Hourly'],
      skillsTaxonomy: ['Deep Cleaning', 'Utensil Washing', 'Mopping & Sweeping', 'Ironing Clothes', 'Kitchen Prep Support'],
      minExperienceMonths: 6,
      status: 'ACTIVE',
    },
    {
      id: 'CAT-DRIVER',
      name: 'Driver',
      tagline: 'Private chauffeur, family transit, and commute assistance',
      iconName: 'Car',
      allowedEngagementTypes: ['Full-time', 'Daily', 'Monthly Contract'],
      skillsTaxonomy: ['Manual Transmission', 'Automatic Transmission', 'City Navigation', 'Night Driving', 'Highway Transit'],
      minExperienceMonths: 24,
      status: 'ACTIVE',
    },
    {
      id: 'CAT-COOK',
      name: 'Cook',
      tagline: 'Culinary preparation, meal planning, and diet customization',
      iconName: 'Utensils',
      allowedEngagementTypes: ['Part-time', 'Full-time', 'Live-in'],
      skillsTaxonomy: ['North Indian', 'South Indian', 'Continental', 'Vegetarian Specialized', 'Dietary/Low-Oil Prep'],
      minExperienceMonths: 12,
      status: 'ACTIVE',
    },
    {
      id: 'CAT-BABYSITTER',
      name: 'Babysitter',
      tagline: 'Infant care, toddler supervision, and child feeding',
      iconName: 'Baby',
      allowedEngagementTypes: ['Hourly', 'Part-time', 'Full-time'],
      skillsTaxonomy: ['Infant Feeding', 'Diapering & Hygiene', 'Toddler Engagement', 'Basic First Aid', 'Bedtime Routine'],
      minExperienceMonths: 12,
      status: 'ACTIVE',
    },
    {
      id: 'CAT-ELDERLY',
      name: 'Elderly Care Helper',
      tagline: 'Non-clinical companionship, mobility, and medication reminders',
      iconName: 'HeartHandshake',
      allowedEngagementTypes: ['Day Shift', 'Night Shift', 'Live-in'],
      skillsTaxonomy: ['Mobility Support', 'Medication Reminders', 'Companionship', 'Nutritional Care', 'Assisted Bathing'],
      minExperienceMonths: 18,
      status: 'ACTIVE',
    },
    {
      id: 'CAT-CLEANER',
      name: 'Cleaning Helper',
      tagline: 'One-time or periodic deep sanitation and floor care',
      iconName: 'Brush',
      allowedEngagementTypes: ['One-time Visit', 'Hourly Shift'],
      skillsTaxonomy: ['Deep Bathroom Scrubbing', 'Window Cleaning', 'Appliance Degreasing', 'Balcony Sanitation'],
      minExperienceMonths: 3,
      status: 'ACTIVE',
    },
  ];

  private operationalAreas: OperationalAreaItem[] = [
    {
      id: 'AREA-HYD-01',
      cityName: 'Hyderabad',
      clusterName: 'HITEC City',
      pincodes: ['500081', '500082'],
      status: 'ACTIVE',
      activeWorkersCount: 142,
    },
    {
      id: 'AREA-HYD-02',
      cityName: 'Hyderabad',
      clusterName: 'Madhapur',
      pincodes: ['500086', '500033'],
      status: 'ACTIVE',
      activeWorkersCount: 118,
    },
    {
      id: 'AREA-HYD-03',
      cityName: 'Hyderabad',
      clusterName: 'Kondapur',
      pincodes: ['500084'],
      status: 'ACTIVE',
      activeWorkersCount: 96,
    },
    {
      id: 'AREA-HYD-04',
      cityName: 'Hyderabad',
      clusterName: 'Gachibowli',
      pincodes: ['500032'],
      status: 'ACTIVE',
      activeWorkersCount: 135,
    },
    {
      id: 'AREA-HYD-05',
      cityName: 'Hyderabad',
      clusterName: 'Kukatpally',
      pincodes: ['500072'],
      status: 'PILOT',
      activeWorkersCount: 64,
    },
  ];

  private feePlans: FeePlanItem[] = [
    {
      id: 'FEE-01',
      parameterName: 'Maid One-Time Booking & Matching Fee',
      liveValueINR: 499,
      draftValueINR: 499,
      classification: 'ONE_TIME_FEE',
      notes: 'Standard trial matching and candidate reservation charge. Non-refundable upon trial completion.',
      decisionStatus: 'APPROVED',
    },
    {
      id: 'FEE-02',
      parameterName: 'Driver Monthly Placement Commission',
      liveValueINR: 1999,
      draftValueINR: 1999,
      classification: 'MONTHLY_COMMISSION',
      notes: 'Quarterly/Monthly placement commission for full-time chauffeurs.',
      decisionStatus: 'APPROVED',
    },
    {
      id: 'FEE-03',
      parameterName: 'Customer Monthly Priority Membership',
      liveValueINR: 799,
      draftValueINR: 799,
      classification: 'SUBSCRIPTION',
      notes: 'Includes expedited replacement turnaround, dedicated support executive, and zero-fee rematches.',
      decisionStatus: 'PENDING_DECISION',
    },
    {
      id: 'FEE-04',
      parameterName: 'Extended 30-Day Replacement Plan Add-on',
      liveValueINR: 499,
      draftValueINR: 499,
      classification: 'GUARANTEE_ADDON',
      notes: 'Provides up to 2 verified candidate replacements within 30 days of active household placement.',
      decisionStatus: 'APPROVED',
    },
  ];

  private notificationTemplates: NotificationTemplateItem[] = [
    {
      id: 'TPL-01',
      channel: 'FCM_PUSH',
      eventTrigger: 'TRIAL_SCHEDULED',
      titleTemplate: 'Trial Scheduled: {{worker_name}} arrives {{trial_time}}',
      bodyTemplate: 'Your trial interview with {{worker_name}} ({{category_name}}) is scheduled for {{trial_time}} at {{customer_address}}. Booking Ref: {{booking_ref}}.',
      allowedPlaceholders: ['{{worker_name}}', '{{trial_time}}', '{{category_name}}', '{{customer_address}}', '{{booking_ref}}'],
      status: 'ACTIVE',
    },
    {
      id: 'TPL-02',
      channel: 'SMS',
      eventTrigger: 'VERIFICATION_APPROVED',
      titleTemplate: 'SevaNest Verification Approved',
      bodyTemplate: 'Namaste {{worker_name}}, your identity and police verification for {{category_name}} is APPROVED. You are now live on SevaNest.',
      allowedPlaceholders: ['{{worker_name}}', '{{category_name}}'],
      status: 'ACTIVE',
    },
    {
      id: 'TPL-03',
      channel: 'WHATSAPP',
      eventTrigger: 'REPLACEMENT_SHORTLIST_SENT',
      titleTemplate: 'Verified Replacement Match Ready',
      bodyTemplate: 'Hello {{customer_name}}, we have matched verified replacement candidates for Booking {{booking_ref}}. View profiles now in your SevaNest app.',
      allowedPlaceholders: ['{{customer_name}}', '{{booking_ref}}'],
      status: 'ACTIVE',
    },
  ];

  private roleDefinitions: RolePermissionDefinition[] = [
    {
      role: 'SUPER_ADMIN',
      roleName: 'Super Admin',
      description: 'System master configuration, role delegation, financial policy approvals, and audit trail oversight.',
      permissions: Object.values(PERMISSIONS),
      isImmutable: true,
      accountsCount: 1,
    },
    {
      role: 'OPERATIONS_ADMIN',
      roleName: 'Operations Admin',
      description: 'Candidate matching, replacement fulfillment, booking lifecycle management, and financial refunds.',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CUSTOMER_VIEW,
        PERMISSIONS.CUSTOMERS_MANAGE,
        PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.WORKERS_MANAGE,
        PERMISSIONS.WORKERS_MANAGE_STATUS,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.BOOKINGS_MANAGE,
        PERMISSIONS.PAYMENTS_VIEW,
        PERMISSIONS.REFUNDS_MANAGE,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.EXPORTS_GENERATE,
      ],
      isImmutable: false,
      accountsCount: 3,
    },
    {
      role: 'VERIFICATION_EXECUTIVE',
      roleName: 'Verification Executive',
      description: 'Worker document vetting, Aadhaar & address proof validation, and reference phone checks.',
      permissions: [
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.VERIFICATION_REVIEW,
        PERMISSIONS.VERIFICATION_DECIDE,
        PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
      ],
      isImmutable: false,
      accountsCount: 4,
    },
    {
      role: 'SUPPORT_EXECUTIVE',
      roleName: 'Support Executive',
      description: 'Household grievance mediation, telephonic dispute logging, SLA countdowns, and Operations escalation.',
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.CUSTOMERS_VIEW,
        PERMISSIONS.WORKER_VIEW,
        PERMISSIONS.BOOKINGS_VIEW,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_MANAGE,
      ],
      isImmutable: false,
      accountsCount: 6,
    },
  ];

  async getServiceCategories(): Promise<ServiceCategoryItem[]> {
    return JSON.parse(JSON.stringify(this.categories));
  }

  async saveCategoryDraft(category: ServiceCategoryItem, rationale: string): Promise<ServiceCategoryItem> {
    if (!rationale?.trim()) {
      throw new ValidationError('Operational rationale is mandatory for category modifications.');
    }
    const idx = this.categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      this.categories[idx] = { ...category, status: 'ACTIVE' };
      return this.categories[idx];
    }
    const newCat = { ...category, id: `CAT-${Date.now()}`, status: 'ACTIVE' as const };
    this.categories.push(newCat);
    return newCat;
  }

  async getOperationalAreas(): Promise<OperationalAreaItem[]> {
    return JSON.parse(JSON.stringify(this.operationalAreas));
  }

  async saveOperationalArea(area: OperationalAreaItem, remarks: string): Promise<OperationalAreaItem> {
    if (!remarks?.trim()) {
      throw new ValidationError('Operational remarks are mandatory for operational area modifications.');
    }
    const idx = this.operationalAreas.findIndex((a) => a.id === area.id);
    if (idx >= 0) {
      this.operationalAreas[idx] = area;
      return area;
    }
    const newArea = { ...area, id: `AREA-HYD-${Date.now()}` };
    this.operationalAreas.push(newArea);
    return newArea;
  }

  async getFeePlans(): Promise<FeePlanItem[]> {
    return JSON.parse(JSON.stringify(this.feePlans));
  }

  async publishFeeSchedule(fees: FeePlanItem[], rationale: string): Promise<FeePlanItem[]> {
    if (!rationale?.trim()) {
      throw new ValidationError('Operational rationale is mandatory for commercial pricing publish.');
    }
    this.feePlans = fees.map((f) => ({
      ...f,
      liveValueINR: f.draftValueINR,
    }));
    return JSON.parse(JSON.stringify(this.feePlans));
  }

  async getNotificationTemplates(channel?: string): Promise<NotificationTemplateItem[]> {
    if (channel && channel !== 'ALL') {
      return this.notificationTemplates.filter((t) => t.channel === channel);
    }
    return JSON.parse(JSON.stringify(this.notificationTemplates));
  }

  async saveNotificationTemplate(template: NotificationTemplateItem, rationale: string): Promise<NotificationTemplateItem> {
    if (!rationale?.trim()) {
      throw new ValidationError('Revision rationale is mandatory for notification template updates.');
    }
    const idx = this.notificationTemplates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      this.notificationTemplates[idx] = template;
      return template;
    }
    this.notificationTemplates.push(template);
    return template;
  }

  async getRolePermissions(): Promise<RolePermissionDefinition[]> {
    return JSON.parse(JSON.stringify(this.roleDefinitions));
  }

  async getRolePermission(roleCode: string): Promise<RolePermissionDefinition> {
    const def = this.roleDefinitions.find((r) => r.role === roleCode);
    if (!def) {
      throw new ForbiddenError(`Role ${roleCode} not found.`);
    }
    return JSON.parse(JSON.stringify(def));
  }

  async updateRolePermissions(role: string, permissions: string[], rationale: string): Promise<RolePermissionDefinition> {
    if (!rationale?.trim()) {
      throw new ValidationError('Security authorization rationale is mandatory for role permission updates.');
    }
    const def = this.roleDefinitions.find((r) => r.role === role);
    if (!def) {
      throw new ForbiddenError(`Role ${role} not found.`);
    }
    if (def.isImmutable) {
      throw new ConcurrencyConflictError('Super Admin core permission matrix cannot be modified (ROLE_IMMUTABLE).');
    }
    def.permissions = permissions;
    return JSON.parse(JSON.stringify(def));
  }

  async getPermissionCatalog(): Promise<string[]> {
    return Object.values(PERMISSIONS);
  }
}

export { RealConfigurationRepository as ConfigurationRepositoryImpl };

/**
 * Real Configuration Repository connecting to live backend endpoints:
 * - GET /api/v1/admin/roles
 * - GET /api/v1/admin/roles/{roleCode}
 * - PUT /api/v1/admin/roles/{roleCode}/permissions
 * - GET /api/v1/admin/permissions
 * - GET /api/v1/admin/service-categories
 * - GET /api/v1/admin/service-areas
 * - GET /api/v1/admin/fees
 */
export class RealConfigurationRepository implements IConfigurationRepository {
  async getRolePermissions(): Promise<RolePermissionDefinition[]> {
    try {
      const response = await httpClient.get('/admin/roles');
      const data = response.data;
      let list: unknown[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        if (Array.isArray(record.roles)) {
          list = record.roles;
        } else if (Array.isArray(record.data)) {
          list = record.data;
        } else if (Array.isArray(record.items)) {
          list = record.items;
        }
      }

      if (!Array.isArray(list) || list.length === 0) {
        throw new ServerFailureError('Empty or invalid roles list returned by administrative server.');
      }

      return list.map((item) => {
        if (!item || typeof item !== 'object') {
          throw new ServerFailureError('Malformed role item returned by administrative server.');
        }
        return mapBackendRoleToDefinition(item as Record<string, unknown>);
      });
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getRolePermission(roleCode: string): Promise<RolePermissionDefinition> {
    const validRoles: AdminRole[] = [
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'VERIFICATION_EXECUTIVE',
      'SUPPORT_EXECUTIVE',
    ];
    if (!validRoles.includes(roleCode as AdminRole)) {
      throw new ForbiddenError(`Unknown or unauthorized role "${roleCode}".`);
    }

    try {
      const response = await httpClient.get(`/admin/roles/${encodeURIComponent(roleCode)}`);
      if (!response.data || typeof response.data !== 'object') {
        throw new ServerFailureError(`Malformed response returned for role ${roleCode}.`);
      }
      return mapBackendRoleToDefinition(response.data as Record<string, unknown>);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateRolePermissions(
    role: string,
    permissions: string[],
    rationale: string
  ): Promise<RolePermissionDefinition> {
    if (!rationale?.trim()) {
      throw new ValidationError('Security authorization rationale is mandatory for role permission updates.');
    }

    const validRoles: AdminRole[] = [
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'VERIFICATION_EXECUTIVE',
      'SUPPORT_EXECUTIVE',
    ];

    if (!validRoles.includes(role as AdminRole)) {
      throw new ForbiddenError(`Cannot update unknown or unauthorized role "${role}".`);
    }

    if (role === 'SUPER_ADMIN') {
      throw new ConcurrencyConflictError(
        'Super Admin core permission matrix is immutable and cannot be modified (ROLE_IMMUTABLE).'
      );
    }

    try {
      const response = await httpClient.put(
        `/admin/roles/${encodeURIComponent(role)}/permissions`,
        {
          permissionCodes: permissions,
        },
        {
          headers: {
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );

      if (response.data && typeof response.data === 'object') {
        return mapBackendRoleToDefinition(response.data as Record<string, unknown>);
      }

      return {
        role,
        roleName: getRoleDisplayName(role as AdminRole),
        description: getRoleDefaultDescription(role as AdminRole),
        permissions,
        isImmutable: false,
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getPermissionCatalog(): Promise<string[]> {
    try {
      const response = await httpClient.get('/admin/permissions');
      const data = response.data;
      if (Array.isArray(data)) {
        return data
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const rec = item as Record<string, unknown>;
              return String(rec.code || rec.permissionCode || rec.name || '');
            }
            return '';
          })
          .filter(Boolean);
      }
      if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        const list = rec.permissions || rec.catalog || rec.data || rec.items;
        if (Array.isArray(list)) {
          return list
            .map((item) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                const r = item as Record<string, unknown>;
                return String(r.code || r.permissionCode || r.name || '');
              }
              return '';
            })
            .filter(Boolean);
        }
      }
      throw new ServerFailureError('Unexpected response shape from permission catalog endpoint.');
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getServiceCategories(): Promise<ServiceCategoryItem[]> {
    try {
      const response = await httpClient.get('/admin/service-categories');
      const data = response.data;
      let items: unknown[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.items)) items = rec.items;
        else if (Array.isArray(rec.data)) items = rec.data;
      }
      if (items.length > 0) {
        return items.map((cat, idx) => {
          const c = cat as Record<string, unknown>;
          return {
            id: String(c.id || c.code || `CAT-${idx + 1}`),
            name: String(c.name || 'Unnamed Category'),
            tagline: String(c.tagline || c.description || 'Household services'),
            iconName: String(c.iconName || 'Sparkles'),
            allowedEngagementTypes: Array.isArray(c.allowedEngagementTypes)
              ? c.allowedEngagementTypes.map(String)
              : ['Part-time', 'Full-time'],
            skillsTaxonomy: Array.isArray(c.skillsTaxonomy)
              ? c.skillsTaxonomy.map(String)
              : ['Standard Skills'],
            minExperienceMonths: typeof c.minExperienceMonths === 'number' ? c.minExperienceMonths : 6,
            status: c.isEnabled === false ? 'ARCHIVED' : 'ACTIVE',
          };
        });
      }
      return [];
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async saveCategoryDraft(category: ServiceCategoryItem, rationale: string): Promise<ServiceCategoryItem> {
    try {
      const response = await httpClient.put(
        `/admin/service-categories/${encodeURIComponent(category.id)}`,
        category,
        {
          headers: {
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );
      if (response.data && typeof response.data === 'object') {
        const c = response.data as Record<string, unknown>;
        return {
          ...category,
          id: String(c.id || category.id),
          name: String(c.name || category.name),
        };
      }
      return category;
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getOperationalAreas(): Promise<OperationalAreaItem[]> {
    try {
      const response = await httpClient.get('/admin/service-areas');
      const data = response.data;
      let items: unknown[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.items)) items = rec.items;
        else if (Array.isArray(rec.data)) items = rec.data;
      }
      if (items.length > 0) {
        return items.map((area, idx) => {
          const a = area as Record<string, unknown>;
          return {
            id: String(a.id || `AREA-${idx + 1}`),
            cityName: String(a.city || a.cityName || 'Hyderabad'),
            clusterName: String(a.name || a.clusterName || 'General Area'),
            pincodes: Array.isArray(a.pincodes) ? a.pincodes.map(String) : ['500001'],
            status: a.isEnabled === false ? 'PLANNED' : 'ACTIVE',
            activeWorkersCount: typeof a.activeWorkersCount === 'number' ? a.activeWorkersCount : 0,
          };
        });
      }
      return [];
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async saveOperationalArea(area: OperationalAreaItem, remarks: string): Promise<OperationalAreaItem> {
    try {
      const response = await httpClient.put(
        `/admin/service-areas/${encodeURIComponent(area.id)}`,
        area,
        {
          headers: {
            'X-Audit-Reason': remarks.trim(),
          },
        }
      );
      if (response.data && typeof response.data === 'object') {
        const a = response.data as Record<string, unknown>;
        return {
          ...area,
          id: String(a.id || area.id),
          clusterName: String(a.name || a.clusterName || area.clusterName),
        };
      }
      return area;
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getFeePlans(): Promise<FeePlanItem[]> {
    try {
      const response = await httpClient.get('/admin/fees');
      const data = response.data;
      let items: unknown[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.items)) items = rec.items;
        else if (Array.isArray(rec.data)) items = rec.data;
      }
      if (items.length > 0) {
        return items.map((fee, idx) => {
          const f = fee as Record<string, unknown>;
          const amountPaise = typeof f.amountMinor === 'number' ? f.amountMinor : 49900;
          return {
            id: String(f.id || f.code || `FEE-${idx + 1}`),
            parameterName: String(f.code || f.name || `Configured Fee ${idx + 1}`),
            liveValueINR: Math.round(amountPaise / 100),
            draftValueINR: Math.round(amountPaise / 100),
            classification: 'ONE_TIME_FEE',
            notes: String(f.description || 'Configured administrative platform fee.'),
            decisionStatus: 'APPROVED',
          };
        });
      }
      return [];
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async publishFeeSchedule(fees: FeePlanItem[], rationale: string): Promise<FeePlanItem[]> {
    try {
      await httpClient.put(
        '/admin/fees',
        { fees },
        {
          headers: {
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );
      return fees;
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getNotificationTemplates(channel?: string): Promise<NotificationTemplateItem[]> {
    try {
      const params = channel && channel !== 'ALL' ? { channel } : undefined;
      const response = await httpClient.get('/admin/notification-templates', { params });
      const data = response.data;
      let items: unknown[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.items)) items = rec.items;
        else if (Array.isArray(rec.data)) items = rec.data;
      }
      return items.map((item, idx) => {
        const t = item as Record<string, unknown>;
        return {
          id: String(t.id || `TMPL-${idx + 1}`),
          channel: (t.channel as NotificationTemplateItem['channel']) || 'SMS',
          eventTrigger: String(t.eventTrigger || t.triggerEvent || 'SYSTEM_EVENT'),
          titleTemplate: String(t.titleTemplate || t.title || t.name || 'Notification Title'),
          bodyTemplate: String(t.bodyTemplate || t.body || ''),
          allowedPlaceholders: Array.isArray(t.allowedPlaceholders)
            ? t.allowedPlaceholders.map(String)
            : Array.isArray(t.variables)
            ? t.variables.map(String)
            : [],
          status: (t.status === 'DRAFT' || t.isEnabled === false ? 'DRAFT' : 'ACTIVE') as NotificationTemplateItem['status'],
        };
      });
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async saveNotificationTemplate(template: NotificationTemplateItem, rationale: string): Promise<NotificationTemplateItem> {
    try {
      const response = await httpClient.put(
        `/admin/notification-templates/${encodeURIComponent(template.id)}`,
        template,
        {
          headers: {
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );
      if (response.data && typeof response.data === 'object') {
        const t = response.data as Record<string, unknown>;
        return {
          ...template,
          id: String(t.id || template.id),
          titleTemplate: String(t.titleTemplate || template.titleTemplate),
        };
      }
      return template;
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export function createConfigurationRepository(): IConfigurationRepository {
  if (env.VITE_USE_MOCK_AUTH) {
    return new MockConfigurationRepository();
  }
  return new RealConfigurationRepository();
}

export const configurationRepository = createConfigurationRepository();
