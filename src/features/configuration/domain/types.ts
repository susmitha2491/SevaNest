export type ConfigurationTab =
  | 'fees'
  | 'categories'
  | 'areas'
  | 'templates'
  | 'roles'
  | 'adminUsers'
  | 'security';

export interface ServiceCategoryItem {
  id: string;
  code?: string;
  name: string;
  tagline: string;
  iconName: string;
  allowedEngagementTypes: string[];
  skillsTaxonomy: string[];
  minExperienceMonths: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  etag?: string;
}

export interface OperationalAreaItem {
  id: string;
  cityName: string;
  clusterName: string;
  pincodes: string[];
  status: 'ACTIVE' | 'PILOT' | 'PLANNED';
  activeWorkersCount: number;
  etag?: string;
}

export interface FeePlanItem {
  id: string;
  parameterName: string;
  liveValueINR: number;
  draftValueINR: number;
  classification: 'ONE_TIME_FEE' | 'MONTHLY_COMMISSION' | 'SUBSCRIPTION' | 'GUARANTEE_ADDON';
  notes: string;
  decisionStatus: 'APPROVED' | 'PENDING_DECISION';
  etag?: string;
}

export interface NotificationTemplateItem {
  id: string;
  channel: 'PUSH' | 'FCM_PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP' | string;
  eventTrigger: string;
  titleTemplate: string;
  bodyTemplate: string;
  allowedPlaceholders: string[];
  status: 'ACTIVE' | 'DRAFT';
  dltTemplateId?: string | null;
  etag?: string;
}

export interface AppSettingItem {
  key: string;
  kind: 'string' | 'boolean';
  description: string;
  value: string | boolean | null;
  source: 'DATABASE' | 'ENVIRONMENT' | 'UNSET';
  updatedAt: string | null;
}

export interface NotificationEventDefinition {
  eventCode: string;
  params: string[];
}

export interface RolePermissionDefinition {
  role: string;
  roleName: string;
  description: string;
  permissions: string[];
  isImmutable: boolean;
  accountsCount?: number;
  userCount?: number;
}

export interface PermissionCatalogItem {
  code: string;
  description: string;
  superAdminOnly: boolean;
}

export interface BackendReferenceData {
  engagements: string[];
  budgetPeriods: string[];
  reportReasons: string[];
  ticketPriorities: string[];
  languages: string[];
}

export interface BackendAppConfig {
  customer: { minVersion: string | null };
  worker: { minVersion: string | null };
  maintenance: boolean;
  support: { phone: string | null; email: string | null };
  legal: { acceptanceRequired: boolean; terms: string | null; privacy: string | null };
  languages: string[];
}

export interface BackendVerificationRequirements {
  checkTypes: string[];
}

export interface IReferenceDataRepository {
  getReferenceData(): Promise<BackendReferenceData>;
  getAppConfig(): Promise<BackendAppConfig>;
  getVerificationRequirements(): Promise<BackendVerificationRequirements>;
}

export interface IConfigurationRepository {
  getServiceCategories(): Promise<ServiceCategoryItem[]>;
  createCategory?(dto: { code: string; name: string; description?: string }): Promise<ServiceCategoryItem>;
  saveCategoryDraft(category: ServiceCategoryItem, rationale: string): Promise<ServiceCategoryItem>;
  getOperationalAreas(): Promise<OperationalAreaItem[]>;
  createOperationalArea?(dto: { name: string; city: string; pincodes?: string[]; centerLatitude?: number; centerLongitude?: number; radiusMeters?: number }): Promise<OperationalAreaItem>;
  saveOperationalArea(area: OperationalAreaItem, remarks: string): Promise<OperationalAreaItem>;
  getFeePlans(): Promise<FeePlanItem[]>;
  publishFeeSchedule(fees: FeePlanItem[], rationale: string): Promise<FeePlanItem[]>;
  getNotificationTemplates(channel?: string): Promise<NotificationTemplateItem[]>;
  createNotificationTemplate?(dto: { eventCode: string; channel: string; title: string; body: string; dltTemplateId?: string }): Promise<NotificationTemplateItem>;
  saveNotificationTemplate(template: NotificationTemplateItem, rationale: string): Promise<NotificationTemplateItem>;
  getRolePermissions(): Promise<RolePermissionDefinition[]>;
  getRolePermission?(roleCode: string): Promise<RolePermissionDefinition>;
  updateRolePermissions(role: string, permissions: string[], rationale: string): Promise<RolePermissionDefinition>;
  getPermissionCatalog?(): Promise<string[]>;
  getPermissionCatalogItems?(): Promise<PermissionCatalogItem[]>;
  getAppSettings?(): Promise<AppSettingItem[]>;
  updateAppSetting?(key: string, value: string | boolean): Promise<AppSettingItem>;
  getNotificationEvents?(): Promise<NotificationEventDefinition[]>;
}

