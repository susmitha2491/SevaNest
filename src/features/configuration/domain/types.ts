export type ConfigurationTab = 'fees' | 'categories' | 'areas' | 'templates' | 'roles' | 'adminUsers';

export interface ServiceCategoryItem {
  id: string;
  name: string;
  tagline: string;
  iconName: string;
  allowedEngagementTypes: string[];
  skillsTaxonomy: string[];
  minExperienceMonths: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export interface OperationalAreaItem {
  id: string;
  cityName: string;
  clusterName: string;
  pincodes: string[];
  status: 'ACTIVE' | 'PILOT' | 'PLANNED';
  activeWorkersCount: number;
}

export interface FeePlanItem {
  id: string;
  parameterName: string;
  liveValueINR: number;
  draftValueINR: number;
  classification: 'ONE_TIME_FEE' | 'MONTHLY_COMMISSION' | 'SUBSCRIPTION' | 'GUARANTEE_ADDON';
  notes: string;
  decisionStatus: 'APPROVED' | 'PENDING_DECISION';
}

export interface NotificationTemplateItem {
  id: string;
  channel: 'FCM_PUSH' | 'SMS' | 'WHATSAPP';
  eventTrigger: string;
  titleTemplate: string;
  bodyTemplate: string;
  allowedPlaceholders: string[];
  status: 'ACTIVE' | 'DRAFT';
}

export interface RolePermissionDefinition {
  role: string;
  roleName: string;
  description: string;
  permissions: string[];
  isImmutable: boolean;
  accountsCount?: number;
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
  saveCategoryDraft(category: ServiceCategoryItem, rationale: string): Promise<ServiceCategoryItem>;
  getOperationalAreas(): Promise<OperationalAreaItem[]>;
  saveOperationalArea(area: OperationalAreaItem, remarks: string): Promise<OperationalAreaItem>;
  getFeePlans(): Promise<FeePlanItem[]>;
  publishFeeSchedule(fees: FeePlanItem[], rationale: string): Promise<FeePlanItem[]>;
  getNotificationTemplates(channel?: string): Promise<NotificationTemplateItem[]>;
  saveNotificationTemplate(template: NotificationTemplateItem, rationale: string): Promise<NotificationTemplateItem>;
  getRolePermissions(): Promise<RolePermissionDefinition[]>;
  getRolePermission?(roleCode: string): Promise<RolePermissionDefinition>;
  updateRolePermissions(role: string, permissions: string[], rationale: string): Promise<RolePermissionDefinition>;
  getPermissionCatalog?(): Promise<string[]>;
}

