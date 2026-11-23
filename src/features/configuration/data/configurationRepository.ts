import {
  ServiceCategoryItem,
  OperationalAreaItem,
  FeePlanItem,
  NotificationTemplateItem,
  RolePermissionDefinition,
  PermissionCatalogItem,
  AppSettingItem,
  NotificationEventDefinition,
  IConfigurationRepository,
} from '../domain/types';
import { SUPER_ADMIN_ONLY_PERMISSIONS } from '../../../core/rbac/permissions';
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
    case 'VERIFICATION_SUPERVISOR':
      return 'Verification Supervisor';
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
    case 'VERIFICATION_SUPERVISOR':
      return 'Worker verification oversight, identity validation, document compliance audits, and supervisor sign-off.';
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
    'VERIFICATION_SUPERVISOR',
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
    typeof raw.userCount === 'number'
      ? raw.userCount
      : typeof raw.accountsCount === 'number'
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
    userCount: accountsCount,
  };
}

export const AUTHORITATIVE_BACKEND_PERMISSIONS: PermissionCatalogItem[] = [
  { code: 'admin.manage_users', description: 'Create admin accounts and change admin account status', superAdminOnly: true },
  { code: 'alert.manage', description: 'Acknowledge and resolve operational alerts', superAdminOnly: false },
  { code: 'alert.view', description: 'See operational alerts addressed to the permissions this role holds', superAdminOnly: false },
  { code: 'area.manage', description: 'View and manage service areas', superAdminOnly: false },
  { code: 'attendance.manage', description: 'Record and correct attendance on behalf of the parties (audited)', superAdminOnly: false },
  { code: 'attendance.view', description: 'View attendance records', superAdminOnly: false },
  { code: 'audit.view', description: 'Read the audit log', superAdminOnly: true },
  { code: 'booking.manage', description: 'Match, schedule, confirm, cancel and otherwise move bookings on behalf of the parties', superAdminOnly: false },
  { code: 'booking.view', description: 'View bookings and their timeline', superAdminOnly: false },
  { code: 'category.manage', description: 'View and manage service categories', superAdminOnly: false },
  { code: 'config.manage', description: 'Edit the app start-up settings (update policy, support contact, policy text) and the rating tag catalogue', superAdminOnly: false },
  { code: 'customer.manage', description: 'Change customer verification status and add notes', superAdminOnly: false },
  { code: 'customer.view', description: 'View customer profiles, addresses and notes', superAdminOnly: false },
  { code: 'matching.run', description: 'Run manual worker matching for a requirement', superAdminOnly: false },
  { code: 'notification.manage', description: 'Manage notification templates and view the delivery log', superAdminOnly: false },
  { code: 'payment.manage', description: 'Configure fees and reconcile a payment with the gateway', superAdminOnly: false },
  { code: 'payment.refund', description: 'Initiate a refund', superAdminOnly: false },
  { code: 'payment.view', description: 'View payments, receipts and fee configuration', superAdminOnly: false },
  { code: 'rating.moderate', description: 'Hide or restore a rating or review (abusive content, audited)', superAdminOnly: false },
  { code: 'rating.view', description: 'View all ratings and reviews', superAdminOnly: false },
  { code: 'replacement.manage', description: 'Approve or reject replacement requests and select the replacement worker', superAdminOnly: false },
  { code: 'replacement.view', description: 'View replacement requests', superAdminOnly: false },
  { code: 'report.view', description: 'View the read-only operational reports', superAdminOnly: false },
  { code: 'role.manage', description: 'View roles and permissions and change which permissions a role holds', superAdminOnly: true },
  { code: 'support.category.manage', description: 'Manage the configured list of support categories', superAdminOnly: false },
  { code: 'support.manage', description: 'Assign, prioritise, escalate and close support tickets', superAdminOnly: false },
  { code: 'support.view', description: 'View support tickets and their history', superAdminOnly: false },
  { code: 'user.status.manage', description: 'Suspend or reactivate customer and worker accounts', superAdminOnly: false },
  { code: 'user.view', description: 'View a user account', superAdminOnly: false },
  { code: 'verification.configure', description: 'Choose which checks are required for a worker to count as verified', superAdminOnly: false },
  { code: 'verification.decide', description: 'Approve or reject a verification check, trigger a re-check', superAdminOnly: false },
  { code: 'verification.document.view', description: 'Open KYC documents (a short-lived link is issued and audited)', superAdminOnly: false },
  { code: 'verification.reassign', description: 'Release or reassign a verification check claimed by another reviewer', superAdminOnly: false },
  { code: 'verification.review', description: 'View the verification queue and worker verification status, start a review', superAdminOnly: false },
  { code: 'verification.signoff', description: 'Give the final verification sign-off for a worker once all required checks are approved', superAdminOnly: false },
  { code: 'worker.activate', description: 'Activate a signed-off worker so they appear in search and matching', superAdminOnly: false },
  { code: 'worker.blacklist', description: 'Blacklist a worker: excluded from search and matching, account suspended, open bookings flagged', superAdminOnly: false },
  { code: 'worker.blacklist.lift', description: 'Lift a worker blacklisting (Super Admin only)', superAdminOnly: true },
  { code: 'worker.manage', description: 'Edit worker profiles and availability on a worker behalf (assisted onboarding)', superAdminOnly: false },
  { code: 'worker.reveal_emergency_contact', description: 'Reveal a worker emergency contact with a stated reason (every reveal is audited)', superAdminOnly: false },
  { code: 'worker.view', description: 'View worker profiles and availability', superAdminOnly: false },
];

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
      permissions: AUTHORITATIVE_BACKEND_PERMISSIONS.map((p) => p.code),
      isImmutable: true,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'OPERATIONS_ADMIN',
      roleName: 'Operations Admin',
      description: 'Candidate matching, replacement fulfillment, booking lifecycle management, and financial refunds.',
      permissions: [
        'alert.manage',
        'alert.view',
        'area.manage',
        'attendance.manage',
        'attendance.view',
        'booking.manage',
        'booking.view',
        'category.manage',
        'customer.manage',
        'customer.view',
        'matching.run',
        'notification.manage',
        'payment.view',
        'rating.moderate',
        'rating.view',
        'replacement.manage',
        'replacement.view',
        'report.view',
        'support.view',
        'user.view',
        'verification.reassign',
        'verification.signoff',
        'worker.activate',
        'worker.manage',
        'worker.view',
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'VERIFICATION_EXECUTIVE',
      roleName: 'Verification Executive',
      description: 'Worker document vetting, Aadhaar & address proof validation, and reference phone checks.',
      permissions: [
        'alert.view',
        'verification.decide',
        'verification.document.view',
        'verification.review',
        'worker.view',
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
    },
    {
      role: 'SUPPORT_EXECUTIVE',
      roleName: 'Support Executive',
      description: 'Household grievance mediation, telephonic dispute logging, SLA countdowns, and Operations escalation.',
      permissions: [
        'booking.view',
        'customer.view',
        'rating.view',
        'support.manage',
        'support.view',
        'worker.view',
      ],
      isImmutable: false,
      accountsCount: 1,
      userCount: 1,
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
      this.categories[idx] = { ...category, status: 'ACTIVE', etag: category.etag || `mock-etag-${Date.now()}` };
      return this.categories[idx];
    }
    const newCat = { ...category, id: `CAT-${Date.now()}`, status: 'ACTIVE' as const, etag: `mock-etag-${Date.now()}` };
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

  async createCategory(dto: { code: string; name: string; description?: string }): Promise<ServiceCategoryItem> {
    if (!dto.name?.trim() || !dto.code?.trim()) {
      throw new ValidationError('Category name and machine code are mandatory.');
    }
    const newCat: ServiceCategoryItem = {
      id: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      tagline: dto.description?.trim() || 'Household services',
      iconName: 'Sparkles',
      allowedEngagementTypes: ['Part-time', 'Full-time'],
      skillsTaxonomy: ['Standard Skills'],
      minExperienceMonths: 6,
      status: 'ACTIVE',
    };
    this.categories.push(newCat);
    return newCat;
  }

  async createOperationalArea(dto: { name: string; city: string; centerLatitude?: number; centerLongitude?: number; radiusMeters?: number }): Promise<OperationalAreaItem> {
    if (!dto.name?.trim() || !dto.city?.trim()) {
      throw new ValidationError('Locality name and city are mandatory.');
    }
    const newArea: OperationalAreaItem = {
      id: `AREA-${Date.now()}`,
      cityName: dto.city.trim(),
      clusterName: dto.name.trim(),
      pincodes: ['500001'],
      status: 'ACTIVE',
      activeWorkersCount: 0,
    };
    this.operationalAreas.push(newArea);
    return newArea;
  }

  async createNotificationTemplate(dto: { eventCode: string; channel: string; title: string; body: string; dltTemplateId?: string }): Promise<NotificationTemplateItem> {
    if (!dto.eventCode?.trim() || !dto.channel?.trim() || !dto.body?.trim()) {
      throw new ValidationError('Event trigger, channel, and message body are mandatory.');
    }
    const newTmpl: NotificationTemplateItem = {
      id: `TMPL-${Date.now()}`,
      channel: dto.channel.trim(),
      eventTrigger: dto.eventCode.trim(),
      titleTemplate: dto.title?.trim() || 'Notification',
      bodyTemplate: dto.body.trim(),
      allowedPlaceholders: [],
      status: 'ACTIVE',
      dltTemplateId: dto.dltTemplateId?.trim() || null,
    };
    this.notificationTemplates.push(newTmpl);
    return newTmpl;
  }

  async getAppSettings(): Promise<AppSettingItem[]> {
    return [
      { key: 'maintenance', kind: 'boolean', description: 'True shows maintenance screen in both apps', value: false, source: 'DATABASE', updatedAt: new Date().toISOString() },
      { key: 'supportPhone', kind: 'string', description: 'Support phone number shown in apps', value: '+91 98765 43210', source: 'DATABASE', updatedAt: new Date().toISOString() },
      { key: 'supportEmail', kind: 'string', description: 'Support email address shown in apps', value: 'support@sevanest.in', source: 'DATABASE', updatedAt: new Date().toISOString() },
      { key: 'customerMinVersion', kind: 'string', description: 'Oldest customer app version that may keep running', value: '1.0.0', source: 'DATABASE', updatedAt: new Date().toISOString() },
      { key: 'workerMinVersion', kind: 'string', description: 'Oldest worker app version that may keep running', value: '1.0.0', source: 'DATABASE', updatedAt: new Date().toISOString() },
    ];
  }

  async updateAppSetting(key: string, value: string | boolean): Promise<AppSettingItem> {
    return {
      key,
      kind: typeof value === 'boolean' ? 'boolean' : 'string',
      description: `Configured setting for ${key}`,
      value,
      source: 'DATABASE',
      updatedAt: new Date().toISOString(),
    };
  }

  async getNotificationEvents(): Promise<NotificationEventDefinition[]> {
    return [
      { eventCode: 'JOB_OPPORTUNITY', params: ['bookingId', 'category', 'area'] },
      { eventCode: 'BOOKING_CONFIRMED', params: ['bookingId', 'startDate'] },
      { eventCode: 'PAYMENT_SUCCEEDED', params: ['bookingId', 'paymentId', 'receiptNumber'] },
      { eventCode: 'VERIFICATION_APPROVED', params: ['checkType'] },
    ];
  }

  async getPermissionCatalog(): Promise<string[]> {
    return AUTHORITATIVE_BACKEND_PERMISSIONS.map((p) => p.code);
  }

  async getPermissionCatalogItems(): Promise<PermissionCatalogItem[]> {
    return JSON.parse(JSON.stringify(AUTHORITATIVE_BACKEND_PERMISSIONS));
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
export const PRD_CATEGORY_SKILLS_TAXONOMY: Record<string, string[]> = {
  BABYSITTER: ['Infant Feeding', 'Diapering & Hygiene', 'Toddler Engagement', 'Basic First Aid', 'Bedtime Routine'],
  HOUSE_MAID: ['Deep Cleaning', 'Utensil Washing', 'Mopping & Sweeping', 'Ironing Clothes', 'Kitchen Prep Support'],
  DRIVER: ['Manual Transmission', 'Automatic Transmission', 'City Navigation', 'Night Driving', 'Highway Transit'],
  COOK: ['North Indian', 'South Indian', 'Continental', 'Vegetarian Specialized', 'Dietary/Low-Oil Prep'],
  ELDERLY_CARE_HELPER: ['Mobility Support', 'Medication Reminders', 'Companionship', 'Nutritional Care', 'Assisted Bathing'],
  CLEANING_HELPER: ['Deep Bathroom Scrubbing', 'Window Cleaning', 'Appliance Degreasing', 'Balcony Sanitation'],
};

// In-memory / session store for published category skills since backend ServiceCategory schema lacks skills column
const categorySkillsStore = new Map<string, string[]>();

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
      'VERIFICATION_SUPERVISOR',
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
      'VERIFICATION_SUPERVISOR',
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
      const items = await this.getPermissionCatalogItems();
      return items.map((p) => p.code);
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getPermissionCatalogItems(): Promise<PermissionCatalogItem[]> {
    try {
      const response = await httpClient.get('/admin/permissions');
      const data = response.data;
      let list: unknown[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        const rawList = rec.permissions || rec.catalog || rec.data || rec.items;
        if (Array.isArray(rawList)) {
          list = rawList;
        }
      }

      if (!Array.isArray(list) || list.length === 0) {
        throw new ServerFailureError('Authoritative permissions catalog is empty or unavailable on the backend server.');
      }

      return list
        .map((item) => {
          if (typeof item === 'string') {
            return {
              code: item,
              description: item,
              superAdminOnly: SUPER_ADMIN_ONLY_PERMISSIONS.has(item),
            };
          }
          if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>;
            const code = String(rec.code || rec.permissionCode || rec.name || '');
            if (!code) return null;
            const description = String(rec.description || rec.desc || code);
            const superAdminOnly =
              typeof rec.superAdminOnly === 'boolean'
                ? rec.superAdminOnly
                : SUPER_ADMIN_ONLY_PERMISSIONS.has(code);
            return {
              code,
              description,
              superAdminOnly,
            };
          }
          return null;
        })
        .filter((item): item is PermissionCatalogItem => item !== null);
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
          const code = String(c.code || '').toUpperCase();
          const categoryId = String(c.id || c.code || `CAT-${idx + 1}`);
          const storedSkills = categorySkillsStore.get(categoryId) || categorySkillsStore.get(code);
          const prdSkills = PRD_CATEGORY_SKILLS_TAXONOMY[code] || ['Standard Skills'];
          const skillsTaxonomy = storedSkills || (Array.isArray(c.skillsTaxonomy) ? (c.skillsTaxonomy as string[]).map(String) : prdSkills);

          return {
            id: categoryId,
            code: String(c.code || ''),
            name: String(c.name || 'Unnamed Category'),
            tagline: String(c.tagline || c.description || 'Household services'),
            iconName: String(c.iconName || 'Sparkles'),
            allowedEngagementTypes: Array.isArray(c.engagements || c.allowedEngagements)
              ? ((c.engagements || c.allowedEngagements) as string[]).map(String)
              : Array.isArray(c.allowedEngagementTypes)
              ? (c.allowedEngagementTypes as string[]).map(String)
              : ['PART_TIME', 'FULL_TIME'],
            skillsTaxonomy,
            minExperienceMonths: typeof c.minExperienceMonths === 'number' ? c.minExperienceMonths : 6,
            status: c.isEnabled === false ? 'ARCHIVED' : 'ACTIVE',
            etag: typeof c.etag === 'string' ? c.etag : undefined,
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
      // 1. PATCH /admin/service-categories/{categoryId}
      // Backend contract: UpdateServiceCategoryDto { name: string, description?: string | null, isEnabled?: boolean }
      // OpenAPI mandates: If-Match header with ETag from GET or * to overwrite
      const patchResponse = await httpClient.patch(
        `/admin/service-categories/${encodeURIComponent(category.id)}`,
        {
          name: category.name,
          description: category.tagline,
          isEnabled: category.status !== 'ARCHIVED',
        },
        {
          headers: {
            'If-Match': category.etag || '*',
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );

      // 2. PUT /admin/service-categories/{categoryId}/engagements
      // Backend contract: SetCategoryEngagementsDto { engagements: string[] }
      if (Array.isArray(category.allowedEngagementTypes) && category.allowedEngagementTypes.length > 0) {
        const allowedEngagementsEnum = ['FULL_TIME', 'PART_TIME', 'LIVE_IN', 'DAILY', 'HOURLY', 'SHIFT', 'ONE_TIME', 'MONTHLY'];
        const normalizedEngagements = Array.from(
          new Set(
            category.allowedEngagementTypes
              .map((t) => t.toUpperCase().replace(/[-\s]/g, '_'))
              .filter((t) => allowedEngagementsEnum.includes(t))
          )
        );

        if (normalizedEngagements.length > 0) {
          try {
            await httpClient.put(
              `/admin/service-categories/${encodeURIComponent(category.id)}/engagements`,
              { engagements: normalizedEngagements },
              {
                headers: {
                  'X-Audit-Reason': rationale.trim(),
                },
              }
            );
          } catch (putErr) {
            console.warn('Failed to update allowed engagements on category', putErr);
          }
        }
      }

      // 3. Post-mutation verification check from backend
      let verifiedData = null;
      let newEtag = (patchResponse.headers?.etag) || (patchResponse.headers?.['etag']);
      try {
        const verifyRes = await httpClient.get(`/admin/service-categories/${encodeURIComponent(category.id)}`);
        if (verifyRes.data && typeof verifyRes.data === 'object') {
          verifiedData = verifyRes.data;
          newEtag = (verifyRes.headers?.etag) || (verifyRes.headers?.['etag']) || newEtag;
        }
      } catch {
        if (patchResponse.data && typeof patchResponse.data === 'object') {
          verifiedData = patchResponse.data;
        }
      }

      // 4. Save published custom skills into categorySkillsStore
      if (Array.isArray(category.skillsTaxonomy)) {
        categorySkillsStore.set(category.id, category.skillsTaxonomy);
        if (category.code) {
          categorySkillsStore.set(category.code.toUpperCase(), category.skillsTaxonomy);
        }
      }

      const mergedAllowedEngagements = verifiedData && Array.isArray(verifiedData.engagements || verifiedData.allowedEngagements)
        ? (verifiedData.engagements || verifiedData.allowedEngagements).map(String)
        : category.allowedEngagementTypes;

      return {
        ...category,
        id: String(verifiedData?.id || category.id),
        code: String(verifiedData?.code || category.code),
        name: String(verifiedData?.name || category.name),
        tagline: String(verifiedData?.description || category.tagline),
        allowedEngagementTypes: mergedAllowedEngagements,
        skillsTaxonomy: category.skillsTaxonomy,
        status: verifiedData?.isEnabled === false ? 'ARCHIVED' : 'ACTIVE',
        etag: newEtag || category.etag,
      };
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
      // Backend contract: PATCH /admin/service-areas/{areaId} with UpdateServiceAreaDto: { name, city, isEnabled }
      const response = await httpClient.patch(
        `/admin/service-areas/${encodeURIComponent(area.id)}`,
        {
          name: area.clusterName,
          city: area.cityName,
          isEnabled: area.status !== 'PLANNED',
        },
        {
          headers: {
            'If-Match': area.etag || '*',
            'X-Audit-Reason': remarks.trim(),
          },
        }
      );
      const newEtag = (response.headers?.etag as string) || (response.headers?.['etag'] as string);
      if (response.data && typeof response.data === 'object') {
        const a = response.data as Record<string, unknown>;
        return {
          ...area,
          id: String(a.id || area.id),
          clusterName: String(a.name || a.clusterName || area.clusterName),
          cityName: String(a.city || a.cityName || area.cityName),
          status: a.isEnabled === false ? 'PLANNED' : 'ACTIVE',
          etag: newEtag || area.etag,
        };
      }
      return { ...area, etag: newEtag || area.etag };
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
            etag: typeof f.etag === 'string' ? f.etag : undefined,
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
      // Backend contract: update fees individually via PUT /admin/fees/{code} with SetFeeDto: { amountMinor, isActive }
      await Promise.all(
        fees.map((fee) => {
          const code = fee.parameterName || fee.id;
          const endpoint = code === 'BOOKING_FEE' ? '/admin/fees/booking-fee' : `/admin/fees/${encodeURIComponent(code)}`;
          return httpClient.put(
            endpoint,
            {
              amountMinor: Math.round(fee.draftValueINR * 100),
              isActive: true,
            },
            {
              headers: {
                'If-Match': fee.etag || '*',
                'X-Audit-Reason': rationale.trim(),
              },
            }
          );
        })
      );
      return fees.map((f) => ({ ...f, liveValueINR: f.draftValueINR }));
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
      // Backend contract: PATCH /admin/notification-templates/{templateId} with UpdateTemplateDto: { title?, body?, isActive? }
      const response = await httpClient.patch(
        `/admin/notification-templates/${encodeURIComponent(template.id)}`,
        {
          title: template.titleTemplate,
          body: template.bodyTemplate,
          isActive: template.status === 'ACTIVE',
        },
        {
          headers: {
            'If-Match': template.etag || '*',
            'X-Audit-Reason': rationale.trim(),
          },
        }
      );
      const newEtag = (response.headers?.etag as string) || (response.headers?.['etag'] as string);
      if (response.data && typeof response.data === 'object') {
        const t = response.data as Record<string, unknown>;
        return {
          ...template,
          id: String(t.id || template.id),
          titleTemplate: String(t.titleTemplate || template.titleTemplate),
          bodyTemplate: String(t.body || template.bodyTemplate),
          status: t.isActive === false ? 'DRAFT' : 'ACTIVE',
          etag: newEtag || template.etag,
        };
      }
      return { ...template, etag: newEtag || template.etag };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async createCategory(dto: { code: string; name: string; description?: string }): Promise<ServiceCategoryItem> {
    try {
      const response = await httpClient.post('/admin/service-categories', {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
      });
      const c = (response.data?.data || response.data) as Record<string, unknown>;
      return {
        id: String(c.id || dto.code),
        name: String(c.name || dto.name),
        tagline: String(c.description || dto.description || 'Household services'),
        iconName: 'Sparkles',
        allowedEngagementTypes: ['Part-time', 'Full-time'],
        skillsTaxonomy: ['Standard Skills'],
        minExperienceMonths: 6,
        status: 'ACTIVE',
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async createOperationalArea(dto: { name: string; city: string; centerLatitude?: number; centerLongitude?: number; radiusMeters?: number }): Promise<OperationalAreaItem> {
    try {
      const response = await httpClient.post('/admin/service-areas', {
        name: dto.name.trim(),
        city: dto.city.trim(),
        centerLatitude: dto.centerLatitude ?? null,
        centerLongitude: dto.centerLongitude ?? null,
        radiusMeters: dto.radiusMeters ?? null,
      });
      const a = (response.data?.data || response.data) as Record<string, unknown>;
      return {
        id: String(a.id || `AREA-${Date.now()}`),
        cityName: String(a.city || dto.city),
        clusterName: String(a.name || dto.name),
        pincodes: ['500001'],
        status: 'ACTIVE',
        activeWorkersCount: 0,
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async createNotificationTemplate(dto: { eventCode: string; channel: string; title: string; body: string; dltTemplateId?: string }): Promise<NotificationTemplateItem> {
    try {
      const response = await httpClient.post('/admin/notification-templates', {
        eventCode: dto.eventCode.trim(),
        channel: dto.channel.trim(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        dltTemplateId: dto.dltTemplateId?.trim() || undefined,
        language: 'en',
        isActive: true,
      });
      const t = (response.data?.data || response.data) as Record<string, unknown>;
      return {
        id: String(t.id || `TMPL-${Date.now()}`),
        channel: String(t.channel || dto.channel),
        eventTrigger: String(t.eventCode || dto.eventCode),
        titleTemplate: String(t.title || dto.title),
        bodyTemplate: String(t.body || dto.body),
        allowedPlaceholders: [],
        status: 'ACTIVE',
        dltTemplateId: t.dltTemplateId ? String(t.dltTemplateId) : dto.dltTemplateId,
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getAppSettings(): Promise<AppSettingItem[]> {
    try {
      const response = await httpClient.get('/admin/app-settings');
      const data = response.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list.map((item: Record<string, unknown>) => ({
        key: String(item.key || ''),
        kind: (item.kind as 'string' | 'boolean') || 'string',
        description: String(item.description || ''),
        value: (item.value as string | boolean | null) ?? null,
        source: (item.source as AppSettingItem['source']) || 'UNSET',
        updatedAt: item.updatedAt ? String(item.updatedAt) : null,
      }));
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateAppSetting(key: string, value: string | boolean): Promise<AppSettingItem> {
    try {
      const response = await httpClient.put(`/admin/app-settings/${encodeURIComponent(key)}`, { value });
      const item = (response.data?.data || response.data) as Record<string, unknown>;
      return {
        key: String(item.key || key),
        kind: (item.kind as 'string' | 'boolean') || (typeof value === 'boolean' ? 'boolean' : 'string'),
        description: String(item.description || ''),
        value: (item.value as string | boolean | null) ?? value,
        source: (item.source as AppSettingItem['source']) || 'DATABASE',
        updatedAt: item.updatedAt ? String(item.updatedAt) : new Date().toISOString(),
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getNotificationEvents(): Promise<NotificationEventDefinition[]> {
    try {
      const response = await httpClient.get('/admin/notification-events');
      const data = response.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list.map((item: Record<string, unknown>) => ({
        eventCode: String(item.eventCode || item.code || ''),
        params: Array.isArray(item.params) ? item.params.map(String) : [],
      }));
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
