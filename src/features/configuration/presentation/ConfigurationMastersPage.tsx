import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import {
  Sliders,
  MapPin,
  Tag,
  MessageSquare,
  Shield,
  CheckCircle2,
  Plus,
  Edit2,
  Lock,
  Save,
  Eye,
  Users,
  UserPlus,
  AlertCircle,
  Clock,
  ShieldAlert,
  RefreshCw,
  RotateCcw,
  LucideIcon,
  X,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Briefcase,
  UserCheck,
  CalendarCheck,
  ClipboardCheck,
  Star,
  CreditCard,
  LifeBuoy,
  BarChart3,
  Info,
} from 'lucide-react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';
import { RequiredIndicator } from '../../../components/common/RequiredIndicator';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';
import {
  ConfigurationTab,
  ServiceCategoryItem,
  OperationalAreaItem,
  FeePlanItem,
  NotificationTemplateItem,
  PermissionCatalogItem,
} from '../domain/types';
import { configurationRepository } from '../data/configurationRepository';
import { workerRepository, resolveAreaId } from '../../workers/data/workerRepository';
import { validatePincodeFormat, getAreaPincodes } from '../../../core/utils/areaPincodeDirectory';
import { adminUserRepository } from '../../adminUsers/data/adminUserRepository';
import { authRepository } from '../../auth/data/authRepository';
import { AdminAccountItem } from '../../adminUsers/domain/types';
import { AdminRole } from '../../../core/auth/authTypes';
import { useAuthStore } from '../../../core/auth/authStore';
import {
  useSessionSecurityStore,
  MIN_TIMEOUT_MINUTES,
  MAX_TIMEOUT_MINUTES,
} from '../../../core/auth/sessionSecurityStore';
import {
  PERMISSIONS,
  hasPermission,
  isSuperAdminOnlyPermission,
  mapLegacyPermissionToCanonical,
} from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { CustomSelect } from '../../../components/common/CustomSelect';

const CONFIGURATION_SECTIONS: Array<{
  id: ConfigurationTab;
  label: string;
  shortDescription: string;
  icon: LucideIcon;
}> = [
  {
    id: 'fees',
    label: 'Pricing Plans',
    shortDescription: 'Commercial booking fees, placement commissions, and subscription packages',
    icon: Tag,
  },
  {
    id: 'categories',
    label: 'Service Categories & Skills',
    shortDescription: 'Workforce service roles, skills taxonomy, and minimum qualification rules',
    icon: Sliders,
  },
  {
    id: 'areas',
    label: 'Operational Areas & Clusters',
    shortDescription: 'Launch city geographical boundaries, operational clusters, and serviced pincodes',
    icon: MapPin,
  },
  {
    id: 'templates',
    label: 'Notification Templates',
    shortDescription: 'Multi-channel customer & worker message copy for Push, SMS, and WhatsApp',
    icon: MessageSquare,
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    shortDescription: 'Administrative access control matrix and granular server-evaluated permission keys',
    icon: Shield,
  },
  {
    id: 'adminUsers',
    label: 'Admin Users',
    shortDescription: 'Administrative staff provisioning, role delegation, and account status controls',
    icon: Users,
  },
  {
    id: 'security',
    label: 'Session & Security',
    shortDescription: 'Authentication lifecycle, inactivity timeout policy, and session token governance',
    icon: Lock,
  },
];

interface PermissionModuleConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  codes: string[];
}

const PERMISSION_MODULE_GROUPS: PermissionModuleConfig[] = [
  {
    id: 'dashboard',
    title: 'Dashboard & Operational Alerts',
    description: 'Command center triage, system overview, and operational alert lifecycle management',
    icon: LayoutDashboard,
    codes: ['alert.view', 'alert.manage'],
  },
  {
    id: 'customers',
    title: 'Customer Management',
    description: 'Household customer profiles, residential addresses, verification flags, and account status',
    icon: Users,
    codes: ['customer.view', 'customer.manage', 'user.view', 'user.status.manage'],
  },
  {
    id: 'workers',
    title: 'Domestic Worker Management',
    description: 'Helper workforce directory, assisted onboarding profile editing, emergency contact reveals, and blacklisting',
    icon: Briefcase,
    codes: [
      'worker.view',
      'worker.manage',
      'worker.activate',
      'worker.reveal_emergency_contact',
      'worker.blacklist',
      'worker.blacklist.lift',
    ],
  },
  {
    id: 'verification',
    title: 'Worker Verification & KYC',
    description: 'KYC identity vetting, address checks, criminal records check decisions, queue triage, and supervisor sign-off',
    icon: UserCheck,
    codes: [
      'verification.review',
      'verification.document.view',
      'verification.decide',
      'verification.reassign',
      'verification.signoff',
      'verification.configure',
    ],
  },
  {
    id: 'bookings',
    title: 'Booking Management & Fulfillment',
    description: 'Placement schedules, candidate matching algorithms, contract fulfillment, and replacement requests',
    icon: CalendarCheck,
    codes: [
      'booking.view',
      'booking.manage',
      'matching.run',
      'replacement.view',
      'replacement.manage',
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance & Daily Logs',
    description: 'Daily domestic service check-ins, punch logs, and audited attendance corrections',
    icon: ClipboardCheck,
    codes: ['attendance.view', 'attendance.manage'],
  },
  {
    id: 'ratings',
    title: 'Ratings & Reviews',
    description: 'Service feedback, customer satisfaction scores, and review moderation for abusive content',
    icon: Star,
    codes: ['rating.view', 'rating.moderate'],
  },
  {
    id: 'payments',
    title: 'Payments & Financial Ledger',
    description: 'Customer transactions, gateway settlement reconciliations, fee schedules, and financial refunds',
    icon: CreditCard,
    codes: ['payment.view', 'payment.manage', 'payment.refund'],
  },
  {
    id: 'support',
    title: 'Customer & Worker Support',
    description: 'Grievance ticket queues, priority escalations, telephonic resolution, and support categories',
    icon: LifeBuoy,
    codes: ['support.view', 'support.manage', 'support.category.manage'],
  },
  {
    id: 'reports',
    title: 'Reports & Business Analytics',
    description: 'Read-only business analytics, workforce retention, and operational reporting',
    icon: BarChart3,
    codes: ['report.view'],
  },
  {
    id: 'configuration',
    title: 'Platform Configuration & Masters',
    description: 'Service skill taxonomy, geographic operational clusters, push/SMS templates, and app start-up policies',
    icon: Sliders,
    codes: ['config.manage', 'category.manage', 'area.manage', 'notification.manage'],
  },
  {
    id: 'security',
    title: 'Administration, Roles & Security',
    description: 'Administrative staff provisioning, RBAC role-permission governance, and immutable audit logs',
    icon: Shield,
    codes: ['admin.manage_users', 'role.manage', 'audit.view'],
  },
];

export const ConfigurationMastersPage: React.FC = () => {

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  // Granular Administrative RBAC
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManageConfig = isSuperAdmin || hasPermission(user?.permissions, PERMISSIONS.CONFIGURATION_MANAGE);
  const canManageCategories = canManageConfig || hasPermission(user?.permissions, PERMISSIONS.CATEGORY_MANAGE);
  const canManageAreas = canManageConfig || hasPermission(user?.permissions, PERMISSIONS.AREA_MANAGE);
  const canManageTemplates = canManageConfig || hasPermission(user?.permissions, PERMISSIONS.NOTIFICATION_MANAGE);
  const canManageFees = canManageConfig;
  const canManageRoles = canManageConfig || hasPermission(user?.permissions, PERMISSIONS.ROLES_MANAGE);
  const canManageAdminUsers = canManageConfig;
  const canManageSecurity = canManageConfig;
  const hasAnyConfigAccess = canManageConfig || canManageCategories || canManageAreas || canManageTemplates;

  // Filter visible tabs strictly based on authoritative permissions
  const visibleSections = CONFIGURATION_SECTIONS.filter((section) => {
    if (section.id === 'fees') return canManageFees;
    if (section.id === 'categories') return canManageCategories;
    if (section.id === 'areas') return canManageAreas;
    if (section.id === 'templates') return canManageTemplates;
    if (section.id === 'roles') return canManageRoles;
    if (section.id === 'adminUsers') return canManageAdminUsers;
    if (section.id === 'security') return canManageSecurity;
    return false;
  });

  const defaultTab: ConfigurationTab = visibleSections[0]?.id || 'categories';

  const initialTabParam = searchParams.get('tab');
  const resolvedInitialTab: ConfigurationTab =
    initialTabParam === 'admins' || initialTabParam === 'adminUsers'
      ? 'adminUsers'
      : initialTabParam === 'security' || initialTabParam === 'session' || initialTabParam === 'sessionSecurity'
      ? 'security'
      : (['fees', 'categories', 'areas', 'templates', 'roles', 'adminUsers', 'security'].includes(initialTabParam as string)
        ? (initialTabParam as ConfigurationTab)
        : defaultTab);

  const [activeTab, setActiveTabState] = useState<ConfigurationTab>(resolvedInitialTab);

  const setActiveTab = (tab: ConfigurationTab) => {
    setActiveTabState(tab);
    setSearchParams({ tab }, { replace: true });
  };

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      const normalized: ConfigurationTab =
        tabFromUrl === 'admins' || tabFromUrl === 'adminUsers'
          ? 'adminUsers'
          : tabFromUrl === 'security' || tabFromUrl === 'session' || tabFromUrl === 'sessionSecurity'
          ? 'security'
          : (['fees', 'categories', 'areas', 'templates', 'roles', 'adminUsers', 'security'].includes(tabFromUrl)
            ? (tabFromUrl as ConfigurationTab)
            : defaultTab);
      if (normalized !== activeTab) {
        setActiveTabState(normalized);
      }
    }
  }, [searchParams, activeTab, defaultTab]);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Session & Security State
  const autoLogoutEnabled = useSessionSecurityStore((s) => s.autoLogoutEnabled);
  const timeoutMinutes = useSessionSecurityStore((s) => s.timeoutMinutes);
  const setPolicy = useSessionSecurityStore((s) => s.setPolicy);

  const [draftAutoLogout, setDraftAutoLogout] = useState<boolean>(autoLogoutEnabled);
  const [draftTimeout, setDraftTimeout] = useState<number>(timeoutMinutes);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(timeoutMinutes !== 10 && timeoutMinutes !== 15);
  const [customInputValue, setCustomInputValue] = useState<string>(
    timeoutMinutes !== 10 && timeoutMinutes !== 15 ? String(timeoutMinutes) : '30'
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [securitySaveSuccess, setSecuritySaveSuccess] = useState<string | null>(null);

  // Sync draft state if store changes externally (e.g. cross-tab sync or store reset)
  useEffect(() => {
    setDraftAutoLogout(autoLogoutEnabled);
    setDraftTimeout(timeoutMinutes);
    if (timeoutMinutes !== 10 && timeoutMinutes !== 15) {
      setIsCustomMode(true);
      setCustomInputValue(String(timeoutMinutes));
    } else {
      setIsCustomMode(false);
    }
    setCustomError(null);
  }, [autoLogoutEnabled, timeoutMinutes]);

  const validateCustomMinutes = (valStr: string): string | null => {
    const trimmed = valStr.trim();
    if (!trimmed) {
      return `Please enter a timeout value between ${MIN_TIMEOUT_MINUTES} and ${MAX_TIMEOUT_MINUTES} minutes.`;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || !Number.isInteger(num)) {
      return 'Timeout must be a valid whole number of minutes.';
    }
    if (num < MIN_TIMEOUT_MINUTES) {
      return `Minimum inactivity timeout is ${MIN_TIMEOUT_MINUTES} minutes.`;
    }
    if (num > MAX_TIMEOUT_MINUTES) {
      return `Maximum inactivity timeout is ${MAX_TIMEOUT_MINUTES} minutes.`;
    }
    return null;
  };

  const hasUnsavedChanges =
    draftAutoLogout !== autoLogoutEnabled ||
    (isCustomMode
      ? (timeoutMinutes === 10 || timeoutMinutes === 15 || Number(customInputValue.trim()) !== timeoutMinutes)
      : (draftTimeout !== timeoutMinutes || (timeoutMinutes !== 10 && timeoutMinutes !== 15)));

  const handleCustomChange = (val: string) => {
    setCustomInputValue(val);
    const err = validateCustomMinutes(val);
    setCustomError(err);
  };

  const handleSelectOption15 = () => {
    setIsCustomMode(false);
    setDraftTimeout(15);
    setCustomError(null);
  };

  const handleSelectOption10 = () => {
    setIsCustomMode(false);
    setDraftTimeout(10);
    setCustomError(null);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
    const initialCustom = (draftTimeout !== 10 && draftTimeout !== 15) ? String(draftTimeout) : (customInputValue || '30');
    setCustomInputValue(initialCustom);
    const err = validateCustomMinutes(initialCustom);
    setCustomError(err);
  };

  const handleSaveSecurityPolicy = () => {
    if (!canManageSecurity) return;
    if (isCustomMode) {
      const err = validateCustomMinutes(customInputValue);
      if (err) {
        setCustomError(err);
        return;
      }
      const customNum = Number(customInputValue.trim());
      setPolicy({ autoLogoutEnabled: draftAutoLogout, timeoutMinutes: customNum });
      setDraftTimeout(customNum);
    } else {
      setPolicy({ autoLogoutEnabled: draftAutoLogout, timeoutMinutes: draftTimeout });
    }
    useSessionSecurityStore.getState().recordActivity();
    setSecuritySaveSuccess('Session security policy saved successfully.');
    setTimeout(() => setSecuritySaveSuccess(null), 4000);
  };

  const handleCancelSecurityPolicy = () => {
    setDraftAutoLogout(autoLogoutEnabled);
    setDraftTimeout(timeoutMinutes);
    if (timeoutMinutes !== 10 && timeoutMinutes !== 15) {
      setIsCustomMode(true);
      setCustomInputValue(String(timeoutMinutes));
    } else {
      setIsCustomMode(false);
      setCustomInputValue('30');
    }
    setCustomError(null);
    setSecuritySaveSuccess(null);
  };

  const {
    data: activeSessions = [],
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => authRepository.listSessions(),
    enabled: canManageSecurity && activeTab === 'security',
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => authRepository.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      setSuccessToast('Active session terminated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setErrorToast(err instanceof Error ? err.message : 'Failed to terminate session.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  // Notification Events Query
  const { data: notificationEvents = [] } = useQuery({
    queryKey: ['config', 'notificationEvents'],
    queryFn: () => configurationRepository.getNotificationEvents?.() ?? Promise.resolve([]),
    enabled: canManageTemplates && activeTab === 'templates',
  });

  // Create Category State & Mutation
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [createCategoryDraft, setCreateCategoryDraft] = useState({ code: '', name: '', description: '' });
  const createCategoryMutation = useMutation({
    mutationFn: (dto: { code: string; name: string; description?: string }) =>
      configurationRepository.createCategory!(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
      setIsCreateCategoryModalOpen(false);
      setCreateCategoryDraft({ code: '', name: '', description: '' });
      setSuccessToast('Service category provisioned successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setErrorToast(err instanceof Error ? err.message : 'Failed to create category.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  // Operational Area Modal State & Mutation
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaModalMode, setAreaModalMode] = useState<'create' | 'edit'>('create');
  const [areaDraft, setAreaDraft] = useState<OperationalAreaItem>({
    id: '',
    cityName: 'Hyderabad',
    clusterName: '',
    pincodes: [],
    status: 'ACTIVE',
    activeWorkersCount: 0,
  });
  const [newPincodeInput, setNewPincodeInput] = useState('');
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [areaModalError, setAreaModalError] = useState<string | null>(null);

  const createAreaMutation = useMutation({
    mutationFn: (dto: { name: string; city: string; pincodes?: string[] }) =>
      configurationRepository.createOperationalArea!({
        name: dto.name,
        city: dto.city,
        pincodes: dto.pincodes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'areas'] });
      queryClient.invalidateQueries({ queryKey: ['workers', 'for-cluster-density'] });
      setIsAreaModalOpen(false);
      setAreaModalError(null);
      setPincodeError(null);
      setSuccessToast('Operational area cluster provisioned successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create operational area.';
      setAreaModalError(msg);
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  // Create Notification Template State & Mutation
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [createTemplateDraft, setCreateTemplateDraft] = useState({ eventCode: '', channel: 'PUSH', title: '', body: '', dltTemplateId: '' });
  const createTemplateMutation = useMutation({
    mutationFn: (dto: { eventCode: string; channel: string; title: string; body: string; dltTemplateId?: string }) =>
      configurationRepository.createNotificationTemplate!(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'templates'] });
      setIsCreateTemplateModalOpen(false);
      setCreateTemplateDraft({ eventCode: '', channel: 'PUSH', title: '', body: '', dltTemplateId: '' });
      setSuccessToast('Notification template provisioned successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setErrorToast(err instanceof Error ? err.message : 'Failed to create notification template.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });


  // Draft states for Fees
  const [editingFees, setEditingFees] = useState<FeePlanItem[] | null>(null);
  const [isPublishFeesOpen, setIsPublishFeesOpen] = useState(false);
  const [isDiffPreviewOpen, setIsDiffPreviewOpen] = useState(false);

  // Category Edit State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<ServiceCategoryItem | null>(null);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isCategoryPublishOpen, setIsCategoryPublishOpen] = useState(false);

  // Operational Area State
  const [isAreaPublishOpen, setIsAreaPublishOpen] = useState(false);

  // Template State
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | 'FCM_PUSH' | 'SMS' | 'WHATSAPP'>('ALL');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<NotificationTemplateItem | null>(null);
  const [isTemplatePublishOpen, setIsTemplatePublishOpen] = useState(false);

  // Roles & Permissions State
  const [selectedRole, setSelectedRole] = useState<string>('OPERATIONS_ADMIN');
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState<Record<string, string[]>>({});
  const [isRoleSaveOpen, setIsRoleSaveOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };
  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {};
    PERMISSION_MODULE_GROUPS.forEach((g) => { next[g.id] = true; });
    setCollapsedGroups(next);
  };
  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  // Admin Users State
  const [adminUserFilter, setAdminUserFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [createAdminDraft, setCreateAdminDraft] = useState<{ email: string; password: string; roleCode: AdminRole }>({
    email: '',
    password: '',
    roleCode: 'OPERATIONS_ADMIN',
  });
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);

  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [targetAdminForRole, setTargetAdminForRole] = useState<AdminAccountItem | null>(null);
  const [newRoleCode, setNewRoleCode] = useState<AdminRole>('OPERATIONS_ADMIN');
  const [changeRoleReason, setChangeRoleReason] = useState('');

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetAdminForStatus, setTargetAdminForStatus] = useState<AdminAccountItem | null>(null);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED'>('SUSPENDED');
  const [statusChangeReason, setStatusChangeReason] = useState('');

  const isAnyModalOpen = Boolean(
    isCreateCategoryModalOpen ||
    isCreateTemplateModalOpen ||
    isCategoryModalOpen ||
    isAreaModalOpen ||
    isTemplateModalOpen ||
    isCreateAdminModalOpen ||
    isChangeRoleModalOpen ||
    isStatusModalOpen ||
    isDiffPreviewOpen
  );
  useBodyScrollLock(isAnyModalOpen);


  // Queries
  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ['config', 'categories'],
    queryFn: () => configurationRepository.getServiceCategories(),
    enabled: canManageCategories,
  });

  const { data: operationalAreas, isLoading: loadingAreas } = useQuery({
    queryKey: ['config', 'areas'],
    queryFn: () => configurationRepository.getOperationalAreas(),
    enabled: canManageAreas,
  });

  const { data: workersForDensity } = useQuery({
    queryKey: ['workers', 'for-cluster-density'],
    queryFn: () => workerRepository.getWorkers({ status: 'ACTIVE', verified: true }),
    enabled: canManageAreas,
    staleTime: 60 * 1000,
  });

  const operationalAreasWithDensity = React.useMemo(() => {
    if (!operationalAreas) return [];
    if (!workersForDensity?.length) return operationalAreas;

    return operationalAreas.map((area) => {
      const areaClusterName = area.clusterName.toLowerCase().trim();
      const areaId = area.id.toLowerCase().trim();
      const areaResolvedId = resolveAreaId(area.id) || resolveAreaId(area.clusterName);

      const matchedCount = workersForDensity.filter((w) => {
        const isVerifiedAndActive =
          Boolean(w.isFullyVerified) &&
          (w.status === 'ACTIVE' || w.accountStatus === 'ACTIVE') &&
          w.verificationStatus !== 'REJECTED' &&
          w.verificationStatus !== 'PENDING' &&
          w.verificationStatus !== 'IN_REVIEW';
        if (!isVerifiedAndActive) return false;

        const workerAreaId = ((w as unknown as { areaId?: string }).areaId || '').toLowerCase().trim();
        if (workerAreaId && (workerAreaId === areaId || (areaResolvedId && workerAreaId === areaResolvedId.toLowerCase()))) {
          return true;
        }

        const workerLoc = (w.locality || '').toLowerCase().trim();
        const workerResolvedId = resolveAreaId(w.locality);
        if (workerResolvedId && areaResolvedId && workerResolvedId.toLowerCase() === areaResolvedId.toLowerCase()) {
          return true;
        }
        if (workerResolvedId && workerResolvedId.toLowerCase() === areaId) {
          return true;
        }
        if (workerLoc && (workerLoc === areaClusterName || areaClusterName.includes(workerLoc) || workerLoc.includes(areaClusterName))) {
          return true;
        }
        return false;
      }).length;

      return {
        ...area,
        activeWorkersCount: Math.max(area.activeWorkersCount || 0, matchedCount),
      };
    });
  }, [operationalAreas, workersForDensity]);

  const { isLoading: loadingFees } = useQuery({
    queryKey: ['config', 'fees'],
    queryFn: async () => {
      const fees = await configurationRepository.getFeePlans();
      if (!editingFees) setEditingFees(fees);
      return fees;
    },
    enabled: canManageFees,
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['config', 'templates', selectedChannel],
    queryFn: () => configurationRepository.getNotificationTemplates(selectedChannel),
    enabled: canManageTemplates,
  });

  const {
    data: roleDefinitions,
    isLoading: loadingRoles,
    isError: isRolesError,
    error: rolesError,
    refetch: refetchRoles,
  } = useQuery({
    queryKey: ['config', 'roles'],
    queryFn: async () => {
      const defs = await configurationRepository.getRolePermissions();
      const initialMap: Record<string, string[]> = {};
      defs.forEach((d) => {
        initialMap[d.role] = [...d.permissions];
      });
      setRolePermissionsDraft(initialMap);
      return defs;
    },
    enabled: canManageRoles,
  });

  const {
    data: permissionCatalog = [],
    isLoading: loadingPermissions,
    isError: isPermissionsError,
    error: permissionsError,
    refetch: refetchPermissions,
  } = useQuery({
    queryKey: ['config', 'permissionsCatalog'],
    queryFn: async (): Promise<PermissionCatalogItem[]> => {
      if (typeof configurationRepository.getPermissionCatalogItems === 'function') {
        return await configurationRepository.getPermissionCatalogItems();
      }
      const stringCodes = (await configurationRepository.getPermissionCatalog?.()) || [];
      return stringCodes.map((code) => ({
        code,
        description: code,
        superAdminOnly: isSuperAdminOnlyPermission(code),
      }));
    },
    enabled: canManageRoles,
  });

  // Mutations
  const publishFeesMutation = useMutation({
    mutationFn: ({ fees, rationale }: { fees: FeePlanItem[]; rationale: string }) =>
      configurationRepository.publishFeeSchedule(fees, rationale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'fees'] });
      setIsPublishFeesOpen(false);
      setSuccessToast('Commercial fee schedule published successfully and recorded in audit trail.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setIsPublishFeesOpen(false);
      setErrorToast(err instanceof Error ? err.message : 'Failed to publish commercial fee schedule.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: ({ category, rationale }: { category: ServiceCategoryItem; rationale: string }) =>
      configurationRepository.saveCategoryDraft(category, rationale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
      setIsCategoryPublishOpen(false);
      setIsCategoryModalOpen(false);
      setSuccessToast('Service category details and engagements successfully published and verified.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setIsCategoryPublishOpen(false);
      setErrorToast(err instanceof Error ? err.message : 'Failed to publish service category.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const saveAreaMutation = useMutation({
    mutationFn: ({ area, remarks }: { area: OperationalAreaItem; remarks: string }) =>
      configurationRepository.saveOperationalArea(area, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'areas'] });
      queryClient.invalidateQueries({ queryKey: ['workers', 'for-cluster-density'] });
      setIsAreaPublishOpen(false);
      setIsAreaModalOpen(false);
      setAreaModalError(null);
      setPincodeError(null);
      setSuccessToast('Operational cluster configuration updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setIsAreaPublishOpen(false);
      const msg = err instanceof Error ? err.message : 'Failed to update operational area.';
      setAreaModalError(msg);
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const isSubmittingArea = createAreaMutation.isPending || saveAreaMutation.isPending;

  const handleAddPincode = () => {
    const trimmed = newPincodeInput.trim();
    if (!trimmed) {
      setPincodeError('Please enter a 6-digit PIN code.');
      return;
    }
    const validation = validatePincodeFormat(trimmed);
    if (!validation.isValid) {
      setPincodeError(validation.error || 'PIN code must be a valid 6-digit number.');
      return;
    }
    if (areaDraft.pincodes.includes(trimmed)) {
      setPincodeError(`PIN code ${trimmed} is already added.`);
      return;
    }
    setAreaDraft((prev) => ({
      ...prev,
      pincodes: [...prev.pincodes, trimmed],
    }));
    setNewPincodeInput('');
    setPincodeError(null);
    if (areaModalError && areaModalError.includes('PIN')) {
      setAreaModalError(null);
    }
  };

  const handleRemovePincode = (pincodeToRemove: string) => {
    setAreaDraft((prev) => ({
      ...prev,
      pincodes: prev.pincodes.filter((pin) => pin !== pincodeToRemove),
    }));
    if (areaModalError && areaModalError.includes('PIN')) {
      setAreaModalError(null);
    }
  };

  const handleSaveArea = () => {
    const trimmedCluster = areaDraft.clusterName.trim();
    const trimmedCity = areaDraft.cityName.trim();

    if (!trimmedCluster) {
      setAreaModalError('Cluster / Locality Name is required.');
      return;
    }
    if (trimmedCluster.length < 2) {
      setAreaModalError('Cluster / Locality Name must be at least 2 characters.');
      return;
    }
    if (!trimmedCity) {
      setAreaModalError('City Name is required.');
      return;
    }
    if (trimmedCity.length < 2) {
      setAreaModalError('City Name must be at least 2 characters.');
      return;
    }

    let finalPincodes = [...areaDraft.pincodes];
    const pendingPin = newPincodeInput.trim();
    if (pendingPin && validatePincodeFormat(pendingPin).isValid && !finalPincodes.includes(pendingPin)) {
      finalPincodes.push(pendingPin);
      setAreaDraft((prev) => ({ ...prev, pincodes: finalPincodes }));
      setNewPincodeInput('');
      setPincodeError(null);
    }

    if (finalPincodes.length === 0) {
      finalPincodes = getAreaPincodes(areaDraft.id, trimmedCluster);
    }

    if (finalPincodes.length === 0) {
      setAreaModalError('At least one valid PIN code is required.');
      return;
    }

    setAreaModalError(null);
    setPincodeError(null);

    if (areaModalMode === 'edit' && areaDraft.id) {
      saveAreaMutation.mutate({
        area: {
          ...areaDraft,
          clusterName: trimmedCluster,
          cityName: trimmedCity,
          pincodes: finalPincodes,
        },
        remarks: 'Operational area cluster update',
      });
    } else {
      createAreaMutation.mutate({
        name: trimmedCluster,
        city: trimmedCity,
        pincodes: finalPincodes,
      });
    }
  };

  const saveTemplateMutation = useMutation({
    mutationFn: ({ template, rationale }: { template: NotificationTemplateItem; rationale: string }) =>
      configurationRepository.saveNotificationTemplate(template, rationale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'templates'] });
      setIsTemplatePublishOpen(false);
      setIsTemplateModalOpen(false);
      setSuccessToast('Notification template updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setIsTemplatePublishOpen(false);
      setErrorToast(err instanceof Error ? err.message : 'Failed to save notification template.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ role, permissions, rationale }: { role: string; permissions: string[]; rationale: string }) =>
      configurationRepository.updateRolePermissions(role, permissions, rationale),
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: ['config', 'roles'] });
      if (updatedRole && updatedRole.permissions) {
        setRolePermissionsDraft((prev) => ({
          ...prev,
          [updatedRole.role]: [...updatedRole.permissions],
        }));
      }
      setIsRoleSaveOpen(false);
      setSuccessToast(`Role permissions for ${updatedRole?.roleName || selectedRole} updated successfully and synchronized.`);
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setIsRoleSaveOpen(false);
      setErrorToast(err instanceof Error ? err.message : 'Failed to update role permissions.');
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  // Admin Users Queries & Mutations
  const { data: adminAccountsData, isLoading: loadingAdminUsers } = useQuery({
    queryKey: ['adminUsers', adminUserFilter],
    queryFn: () =>
      adminUserRepository.getAdminUsers({
        status: adminUserFilter === 'ALL' ? undefined : adminUserFilter,
      }),
    enabled: canManageAdminUsers && activeTab === 'adminUsers',
  });

  const createAdminMutation = useMutation({
    mutationFn: (dto: { email: string; password: string; roleCode: AdminRole }) =>
      adminUserRepository.createAdminUser(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsCreateAdminModalOpen(false);
      setCreateAdminDraft({ email: '', password: '', roleCode: 'OPERATIONS_ADMIN' });
      setCreateAdminError(null);
      setSuccessToast('Administrator account successfully provisioned and assigned to role.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: Error) => {
      setCreateAdminError(err.message);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleCode, reason }: { userId: string; roleCode: AdminRole; reason: string }) =>
      adminUserRepository.changeAdminUserRole(userId, { roleCode, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsChangeRoleModalOpen(false);
      setTargetAdminForRole(null);
      setChangeRoleReason('');
      setSuccessToast('Administrator role updated and recorded in audit trail.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: Error) => {
      setErrorToast(`Role update failed: ${err.message}`);
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: 'ACTIVE' | 'SUSPENDED'; reason: string }) =>
      adminUserRepository.updateAdminUserStatus(userId, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsStatusModalOpen(false);
      setTargetAdminForStatus(null);
      setStatusChangeReason('');
      setSuccessToast('Account status updated and recorded in audit trail.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: Error) => {
      setErrorToast(`Status update failed: ${err.message}`);
      setTimeout(() => setErrorToast(null), 5000);
    },
  });

  const configFetchingCount = useIsFetching({ queryKey: ['config'] });
  const isConfigFetching = configFetchingCount > 0 || isSessionsLoading;

  // Authoritative Configuration Access Guard
  if (!hasAnyConfigAccess) {
    return (
      <NoAccessView
        moduleName="System Configuration Masters"
        requiredPermission={PERMISSIONS.CONFIGURATION_MANAGE}
      />
    );
  }

  // Initial loading only waits on queries authorized for the current actor
  const isInitialLoading =
    (canManageCategories && loadingCats) ||
    (canManageAreas && loadingAreas) ||
    (canManageFees && loadingFees && !editingFees) ||
    (canManageTemplates && loadingTemplates) ||
    (canManageRoles && (loadingRoles || loadingPermissions));

  if (isInitialLoading) {
    return <LoadingSpinner message="Loading system configuration masters..." />;
  }

  const handleFeeChange = (id: string, value: number) => {
    if (!editingFees) return;
    setEditingFees(
      editingFees.map((fee) => (fee.id === id ? { ...fee, draftValueINR: Math.max(0, value) } : fee))
    );
  };

  const isFeeDraftModified = editingFees?.some((f) => f.draftValueINR !== f.liveValueINR);

  const handleTogglePermission = (role: string, permKey: string) => {
    if (role !== 'SUPER_ADMIN' && isSuperAdminOnlyPermission(permKey)) {
      return;
    }
    const currentPerms = rolePermissionsDraft[role] || [];
    const exists = currentPerms.includes(permKey);
    const updated = exists ? currentPerms.filter((p) => p !== permKey) : [...currentPerms, permKey];
    setRolePermissionsDraft((prev) => ({
      ...prev,
      [role]: updated,
    }));
  };

  const handleToggleModulePermissions = (role: string, moduleCodes: string[], selectAll: boolean) => {
    if (role === 'SUPER_ADMIN') return;
    const currentPerms = new Set(rolePermissionsDraft[role] || []);
    const allowedCodes = moduleCodes.filter((code) => !isSuperAdminOnlyPermission(code));
    if (selectAll) {
      allowedCodes.forEach((code) => currentPerms.add(code));
    } else {
      allowedCodes.forEach((code) => currentPerms.delete(code));
    }
    setRolePermissionsDraft((prev) => ({
      ...prev,
      [role]: Array.from(currentPerms),
    }));
  };

  const handleResetRoleDraft = (role: string) => {
    const originalRole = roleDefinitions?.find((r) => r.role === role);
    if (originalRole) {
      setRolePermissionsDraft((prev) => ({
        ...prev,
        [role]: [...originalRole.permissions],
      }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <style>{`
        .hide-number-spinners::-webkit-outer-spin-button,
        .hide-number-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        .hide-number-spinners {
          -moz-appearance: textfield !important;
        }
      `}</style>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Platform Configuration Masters
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Authoritative Super Admin governance for service categories, operational clusters, fee plans, templates, and role matrices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['config'] });
            queryClient.invalidateQueries({ queryKey: ['workers', 'for-cluster-density'] });
            queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
          }}
          disabled={isConfigFetching}
          aria-label="Refresh"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            cursor: isConfigFetching ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={isConfigFetching ? 'animate-spin' : ''} />
          <span>{isConfigFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {successToast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            color: 'var(--color-success-dark)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger-dark)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={16} />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Configuration Section Selector (Responsive Button Cards) */}
      <div
        data-testid="configuration-section-selector"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-testid={`config-section-${section.id}`}
              onClick={() => setActiveTab(section.id)}
              aria-selected={isActive}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                flex: '1 1 260px',
                minWidth: '240px',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg, 8px)',
                border: isActive
                  ? '2px solid var(--color-brand-600, #2563eb)'
                  : '1px solid var(--color-border, #e2e8f0)',
                backgroundColor: isActive
                  ? 'var(--color-brand-50, #eff6ff)'
                  : 'var(--color-surface, #ffffff)',
                boxShadow: isActive
                  ? '0 2px 4px rgba(37, 99, 235, 0.12)'
                  : '0 1px 2px rgba(0, 0, 0, 0.04)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md, 6px)',
                  backgroundColor: isActive
                    ? 'var(--color-brand-600, #2563eb)'
                    : 'var(--color-bg-subtle, #f1f5f9)',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary, #64748b)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm, 13px)',
                    fontWeight: 700,
                    color: isActive
                      ? 'var(--color-brand-700, #1d4ed8)'
                      : 'var(--color-text-primary, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{section.label}</span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs, 11px)',
                    color: 'var(--color-text-secondary, #64748b)',
                    marginTop: '3px',
                    lineHeight: 1.35,
                  }}
                >
                  {section.shortDescription}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FEES & PRICING PLANS */}
      {activeTab === 'fees' && (!canManageFees ? (
        <NoAccessView moduleName="Commercial Pricing & Fee Schedule" requiredPermission={PERMISSIONS.CONFIGURATION_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Commercial Pricing Schedule (Draft Workspace)
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Modifications exist in an uncommitted in-memory draft until validated with mandatory justification remarks.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => setIsDiffPreviewOpen(true)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={14} /> View Diff Preview
                </button>
                <button
                  disabled={!isFeeDraftModified}
                  onClick={() => setIsPublishFeesOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isFeeDraftModified ? 'var(--color-brand-600)' : 'var(--color-bg-subtle)',
                    color: isFeeDraftModified ? '#ffffff' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    cursor: isFeeDraftModified ? 'pointer' : 'not-allowed',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Save size={14} /> Publish Fee Schedule
                </button>
              </div>
            </div>

            {/* Fee Items Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Fee / Plan Parameter
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Classification
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Live Value
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Proposed Draft Value (₹)
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Decision Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editingFees?.map((fee) => {
                    const isChanged = fee.draftValueINR !== fee.liveValueINR;
                    return (
                      <tr
                        key={fee.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Configure ${fee.parameterName}`}
                        className="clickable-table-row"
                        onClick={(e) => {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('input, button, a, select') && target !== e.currentTarget) return;
                          const inputEl = (e.currentTarget as { querySelector?: (selector: string) => { focus?: () => void } | null }).querySelector?.('input');
                          inputEl?.focus?.();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            const target = e.target as { closest?: (selector: string) => unknown };
                            if (target?.closest && target.closest('input, button, a, select') && target !== e.currentTarget) return;
                            e.preventDefault();
                            const inputEl = (e.currentTarget as { querySelector?: (selector: string) => { focus?: () => void } | null }).querySelector?.('input');
                            inputEl?.focus?.();
                          }
                        }}
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: 'var(--space-4)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{fee.parameterName}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{fee.notes}</div>
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                            {fee.classification}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {formatCurrencyINR(fee.liveValueINR)}
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <div
                              className={`currency-input-group ${isChanged ? 'is-modified' : ''}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                position: 'relative',
                                width: '130px',
                                height: '36px',
                                minHeight: '36px',
                                backgroundColor: isChanged ? 'var(--color-primary-subtle, #f0fdfa)' : 'var(--color-bg-surface, #ffffff)',
                                border: isChanged ? '1.5px solid var(--color-primary, #0f766e)' : '1px solid var(--color-border, #cbd5e1)',
                                borderRadius: 'var(--radius-md, 8px)',
                                boxSizing: 'border-box',
                                boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
                              }}
                            >
                              <span
                                className="currency-input-prefix"
                                style={{
                                  position: 'absolute',
                                  left: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: isChanged ? 'var(--color-primary, #0f766e)' : 'var(--color-text-secondary, #64748b)',
                                  pointerEvents: 'none',
                                  userSelect: 'none',
                                  lineHeight: 1,
                                }}
                              >
                                ₹
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={fee.draftValueINR}
                                onChange={(e) => handleFeeChange(fee.id, Number(e.target.value))}
                                className="currency-draft-input hide-number-spinners"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  padding: '0 10px 0 26px',
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  boxShadow: 'none',
                                  fontFamily: 'inherit',
                                  fontSize: 'var(--font-size-sm, 14px)',
                                  fontWeight: 600,
                                  color: 'var(--color-text-primary, #0f172a)',
                                  boxSizing: 'border-box',
                                }}
                                aria-label={`Draft value for ${fee.parameterName}`}
                              />
                            </div>
                            {isChanged && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--color-brand-700, #0f766e)',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm, 4px)',
                                    border: '1px solid var(--color-brand-200, #99f6e4)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  (Draft Modified)
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Reset ${fee.parameterName} to live value`}
                                  title={`Reset to live value ₹${fee.liveValueINR}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFeeChange(fee.id, fee.liveValueINR);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: 'var(--radius-sm, 4px)',
                                    border: '1px solid var(--color-border, #cbd5e1)',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--color-text-secondary, #64748b)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <RotateCcw size={12} />
                                  Reset
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          {fee.decisionStatus === 'PENDING_DECISION' ? (
                            <span style={{ padding: '3px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-dark)', fontSize: '11px', fontWeight: 700 }}>
                              Pending Commercial Sign-off
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success-dark)', fontSize: '11px', fontWeight: 700 }}>
                              Approved Baseline
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* TAB 2: SERVICE CATEGORIES & SKILLS */}
      {activeTab === 'categories' && (!canManageCategories ? (
        <NoAccessView moduleName="Service Categories & Skills" requiredPermission={PERMISSIONS.CATEGORY_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Service Categories & Workforce Skills Taxonomy
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Configures allowed engagement contracts, required experience thresholds, and searchable skills.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateCategoryModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: 'var(--color-brand-600, #0d9488)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md, 6px)', fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} /> Add Service Category
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
            {categories?.map((cat) => (
              <div
                key={cat.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {cat.name}
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {cat.tagline}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCategoryDraft(JSON.parse(JSON.stringify(cat)));
                      setIsCategoryModalOpen(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Allowed Engagement Types:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {cat.allowedEngagementTypes.map((type) => (
                      <span key={type} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Skills Taxonomy Checklist:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {cat.skillsTaxonomy.map((skill) => (
                      <span key={skill} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-brand-700)', border: '1px solid var(--color-border)' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    Min Experience: <strong>{cat.minExperienceMonths} Months</strong>
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success-dark)' }}>
                    ● {cat.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* TAB 3: OPERATIONAL AREAS & CLUSTERS */}
      {activeTab === 'areas' && (!canManageAreas ? (
        <NoAccessView moduleName="Operational Areas & Clusters" requiredPermission={PERMISSIONS.AREA_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Hyderabad Operational Areas & Dispatch Clusters
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Manage supported launch clusters, covered pin codes, and workforce density parameters.
              </p>
            </div>
            <button
              onClick={() => {
                setAreaModalMode('create');
                setAreaDraft({
                  id: '',
                  clusterName: '',
                  cityName: 'Hyderabad',
                  pincodes: [],
                  status: 'ACTIVE',
                  activeWorkersCount: 0,
                });
                setNewPincodeInput('');
                setPincodeError(null);
                setAreaModalError(null);
                setIsAreaModalOpen(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-brand-600)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Plus size={14} /> Add Operational Area
            </button>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Cluster ID & Name
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    City
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Covered Pin Codes
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Active Worker Density
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Status
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {operationalAreasWithDensity.map((area) => (
                  <tr
                    key={area.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit cluster ${area.clusterName}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      setAreaModalMode('edit');
                      setAreaDraft({
                        id: area.id,
                        clusterName: area.clusterName,
                        cityName: area.cityName,
                        pincodes: Array.isArray(area.pincodes) ? [...area.pincodes] : [],
                        status: area.status,
                        activeWorkersCount: area.activeWorkersCount || 0,
                        etag: area.etag,
                      });
                      setNewPincodeInput('');
                      setPincodeError(null);
                      setAreaModalError(null);
                      setIsAreaModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        setAreaModalMode('edit');
                        setAreaDraft({
                          id: area.id,
                          clusterName: area.clusterName,
                          cityName: area.cityName,
                          pincodes: Array.isArray(area.pincodes) ? [...area.pincodes] : [],
                          status: area.status,
                          activeWorkersCount: area.activeWorkersCount || 0,
                          etag: area.etag,
                        });
                        setNewPincodeInput('');
                        setPincodeError(null);
                        setAreaModalError(null);
                        setIsAreaModalOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{area.clusterName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{area.id}</div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {area.cityName}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {area.pincodes.map((pin) => (
                          <span key={pin} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            {pin}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {area.activeWorkersCount} Verified Workers
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: area.status === 'ACTIVE' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                          color: area.status === 'ACTIVE' ? 'var(--color-success-dark)' : 'var(--color-warning-dark)',
                        }}
                      >
                        {area.status}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setAreaModalMode('edit');
                          setAreaDraft({
                            id: area.id,
                            clusterName: area.clusterName,
                            cityName: area.cityName,
                            pincodes: Array.isArray(area.pincodes) ? [...area.pincodes] : [],
                            status: area.status,
                            activeWorkersCount: area.activeWorkersCount || 0,
                            etag: area.etag,
                          });
                          setNewPincodeInput('');
                          setPincodeError(null);
                          setAreaModalError(null);
                          setIsAreaModalOpen(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* TAB 4: NOTIFICATION TEMPLATES */}
      {activeTab === 'templates' && (!canManageTemplates ? (
        <NoAccessView moduleName="Notification Templates" requiredPermission={PERMISSIONS.NOTIFICATION_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                System Notification Templates Registry
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Configures transactional copy and dynamic variables for Push Notifications, SMS, and WhatsApp alerts.
              </p>
            </div>
            {/* Channel filter pills */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['ALL', 'FCM_PUSH', 'SMS', 'WHATSAPP'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: selectedChannel === ch ? 'var(--color-brand-600)' : 'var(--color-border)',
                    backgroundColor: selectedChannel === ch ? 'var(--color-brand-600)' : 'var(--color-surface)',
                    color: selectedChannel === ch ? '#ffffff' : 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsCreateTemplateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: 'var(--color-brand-600, #0d9488)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md, 6px)', fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, cursor: 'pointer', marginLeft: 'var(--space-2)' }}
            >
              <Plus size={14} /> Add Notification Template
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
            {templates?.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                      {tpl.eventTrigger}
                    </span>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                      {tpl.titleTemplate}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setTemplateDraft(JSON.parse(JSON.stringify(tpl)));
                      setIsTemplateModalOpen(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  {tpl.bodyTemplate}
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Allowed Dynamic Placeholders:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {tpl.allowedPlaceholders.map((p) => (
                      <span key={p} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-brand-700)', fontFamily: 'monospace' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* TAB 5: ROLES & PERMISSION MATRIX */}
      {activeTab === 'roles' && (!canManageRoles ? (
        <NoAccessView moduleName="Role-Based Access Control Governance Matrix" requiredPermission={PERMISSIONS.ROLES_MANAGE} />
      ) : isPermissionsError || isRolesError ? (
        <div
          role="alert"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 'var(--space-3)',
            minHeight: '260px',
          }}
        >
          <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <AlertCircle size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '4px' }}>
              Failed to Load Permissions Catalog
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: '#b91c1c', maxWidth: '480px' }}>
              {permissionsError instanceof Error
                ? permissionsError.message
                : rolesError instanceof Error
                ? rolesError.message
                : 'Unable to retrieve authoritative role permissions from backend. Please verify backend connectivity and retry.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              refetchPermissions();
              refetchRoles();
            }}
            style={{
              marginTop: 'var(--space-2)',
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} /> Retry Authorization Sync
          </button>
        </div>
      ) : (() => {
        const selectedRoleDef = roleDefinitions?.find((r) => r.role === selectedRole);
        const isSelectedRoleImmutable = selectedRoleDef?.isImmutable ?? (selectedRole === 'SUPER_ADMIN');
        const selectedRoleDraftPerms = rolePermissionsDraft[selectedRole] || [];
        const selectedRoleServerPerms = selectedRoleDef?.permissions || [];
        const isRoleDirty =
          !isSelectedRoleImmutable &&
          (selectedRoleDraftPerms.length !== selectedRoleServerPerms.length ||
            selectedRoleDraftPerms.some((p) => !selectedRoleServerPerms.includes(p)) ||
            selectedRoleServerPerms.some((p) => !selectedRoleDraftPerms.includes(p)));

        // Collect grouped codes to detect any uncategorized permissions from backend
        const allGroupedCodes = new Set(PERMISSION_MODULE_GROUPS.flatMap((g) => g.codes));
        const additionalPerms = permissionCatalog.filter((p) => !allGroupedCodes.has(p.code));

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header with Title & Save Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Role-Based Access Control Governance Matrix
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Assign granular capabilities to system personas. Super Admin core controls remain strictly locked.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {isRoleDirty && (
                  <button
                    type="button"
                    onClick={() => handleResetRoleDraft(selectedRole)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCcw size={13} /> Discard Changes
                  </button>
                )}
                <button
                  disabled={isSelectedRoleImmutable || updateRoleMutation.isPending}
                  onClick={() => setIsRoleSaveOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelectedRoleImmutable
                      ? 'var(--color-bg-subtle)'
                      : isRoleDirty
                      ? 'var(--color-brand-600)'
                      : 'var(--color-brand-700)',
                    color: isSelectedRoleImmutable ? 'var(--color-text-tertiary)' : '#ffffff',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSelectedRoleImmutable ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isRoleDirty ? '0 1px 3px rgba(13, 148, 136, 0.3)' : 'none',
                  }}
                >
                  <Save size={14} />
                  {isSelectedRoleImmutable
                    ? 'Immutable Core Role'
                    : isRoleDirty
                    ? 'Save Role Privileges *'
                    : 'Save Role Privileges'}
                </button>
              </div>
            </div>

            {/* Role Selector Tabs (Interactive Cards) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-3)',
              }}
              role="tablist"
              aria-label="Select administrative role"
            >
              {(roleDefinitions || []).map((r) => {
                const isSelected = r.role === selectedRole;
                const roleDraftCount = (rolePermissionsDraft[r.role] || []).length;
                const isImm = r.isImmutable || r.role === 'SUPER_ADMIN';

                return (
                  <button
                    key={r.role}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedRole(r.role)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: '2px solid',
                      borderColor: isSelected ? 'var(--color-brand-600)' : 'var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-brand-50, #f0fdfa)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isImm ? (
                          <Lock size={15} color="var(--color-warning-dark, #b45309)" />
                        ) : (
                          <Shield size={15} color="var(--color-brand-600, #0d9488)" />
                        )}
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                          {r.roleName}
                        </span>
                      </div>
                      {isImm && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                            color: 'var(--color-warning-dark, #92400e)',
                          }}
                        >
                          LOCKED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span>{roleDraftCount} / {permissionCatalog.length} permissions</span>
                      <span style={{ fontWeight: 500 }}>
                        {r.accountsCount ?? r.userCount ?? 1} staff
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Role Policy Summary / Immutable Banner */}
            {isSelectedRoleImmutable ? (
              <div
                style={{
                  backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                  border: '1px solid var(--color-warning-border, #fcd34d)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                <Lock size={20} color="var(--color-warning-dark, #b45309)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning-dark, #92400e)' }}>
                    Super Administrator Core Matrix (Protected & Immutable)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-dark, #92400e)', marginTop: '2px', lineHeight: 1.5 }}>
                    The Super Admin role holds unrestricted system authority across all {permissionCatalog.length} platform permissions.
                    In accordance with backend security policy (ROLE_IMMUTABLE), Super Admin permissions are permanent and cannot be modified or reduced.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <Shield size={20} color="var(--color-brand-600)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {selectedRoleDef?.roleName} Governance Policy
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {selectedRoleDef?.description}
                  </div>
                </div>
              </div>
            )}

            {/* Unsaved Changes Banner */}
            {isRoleDirty && (
              <div
                style={{
                  backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                  border: '1px solid var(--color-brand-600, #0d9488)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertCircle size={18} color="var(--color-brand-600)" />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-brand-900, #134e4a)' }}>
                    Unsaved permission changes for {selectedRoleDef?.roleName} ({selectedRoleDraftPerms.length} permissions currently assigned).
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => handleResetRoleDraft(selectedRole)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRoleSaveOpen(true)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#ffffff',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            )}

            {/* Quick Toolbar above Categories */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                padding: '6px 12px',
                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Permission Matrix
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                    color: 'var(--color-brand-700, #0f766e)',
                    border: '1px solid var(--color-brand-200, #99f6e4)',
                  }}
                >
                  {selectedRoleDraftPerms.length} / {permissionCatalog.length} Active
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={expandAllGroups}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-brand-600, #0d9488)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Expand All
                </button>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <button
                  type="button"
                  onClick={collapseAllGroups}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Compact Collapsible Module Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {PERMISSION_MODULE_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const groupItems = group.codes
                  .map((code) => permissionCatalog.find((p) => p.code === code))
                  .filter((p): p is PermissionCatalogItem => p !== undefined);

                if (groupItems.length === 0) return null;

                const isCollapsed = Boolean(collapsedGroups[group.id]);
                const activeCount = groupItems.filter((item) =>
                  selectedRoleDraftPerms.includes(item.code)
                ).length;

                const configurableItems = isSelectedRoleImmutable
                  ? []
                  : groupItems.filter((item) => !item.superAdminOnly);
                const allConfigurableChecked =
                  configurableItems.length > 0 &&
                  configurableItems.every((item) => selectedRoleDraftPerms.includes(item.code));

                return (
                  <div
                    key={group.id}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-xs)',
                    }}
                  >
                    {/* Collapsible Module Header */}
                    <div
                      onClick={() => toggleGroupCollapse(group.id)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: isCollapsed ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                        borderBottom: isCollapsed ? 'none' : '1px solid var(--color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        {isCollapsed ? (
                          <ChevronRight size={15} color="var(--color-text-secondary)" />
                        ) : (
                          <ChevronDown size={15} color="var(--color-brand-600)" />
                        )}
                        <GroupIcon size={15} color="var(--color-brand-600)" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          {group.title}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: activeCount === groupItems.length ? '#dcfce7' : activeCount > 0 ? '#f0fdfa' : '#f1f5f9',
                            color: activeCount === groupItems.length ? '#166534' : activeCount > 0 ? '#0f766e' : '#64748b',
                            border: `1px solid ${activeCount === groupItems.length ? '#bbf7d0' : activeCount > 0 ? '#ccfbf1' : '#e2e8f0'}`,
                          }}
                        >
                          {activeCount}/{groupItems.length}
                        </span>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isSelectedRoleImmutable && configurableItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleModulePermissions(
                                selectedRole,
                                groupItems.map((p) => p.code),
                                !allConfigurableChecked
                              )
                            }
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: allConfigurableChecked ? '#b91c1c' : 'var(--color-brand-700)',
                            }}
                          >
                            {allConfigurableChecked ? 'Clear All' : 'Select All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permissions List Rows (When Expanded) */}
                    {!isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {groupItems.map((p, idx) => {
                          const isChecked = selectedRoleDraftPerms.includes(p.code);
                          const isRestricted = p.superAdminOnly && selectedRole !== 'SUPER_ADMIN';
                          const isDisabled = isSelectedRoleImmutable || isRestricted;

                          return (
                            <label
                              key={p.code}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 12px',
                                borderBottom: idx < groupItems.length - 1 ? '1px solid var(--color-border-subtle, #f1f5f9)' : 'none',
                                backgroundColor: isRestricted
                                  ? '#f8fafc'
                                  : isChecked
                                  ? 'var(--color-brand-50, #f0fdfa)'
                                  : '#ffffff',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.1s ease',
                                flexWrap: 'wrap',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => handleTogglePermission(selectedRole, p.code)}
                                  style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                />
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    color: isChecked && !isRestricted ? 'var(--color-brand-800, #115e59)' : 'var(--color-text-primary)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {p.code}
                                </span>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--color-text-secondary)',
                                    lineHeight: 1.3,
                                  }}
                                >
                                  — {p.description}
                                </span>
                              </div>

                              {p.superAdminOnly && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                                    color: 'var(--color-warning-dark, #92400e)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Lock size={10} /> Super Admin Only
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Additional uncategorized permissions if any */}
              {additionalPerms.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      Additional Platform Capabilities
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {additionalPerms.map((p, idx) => {
                      const isChecked = selectedRoleDraftPerms.includes(p.code);
                      const isRestricted = p.superAdminOnly && selectedRole !== 'SUPER_ADMIN';
                      const isDisabled = isSelectedRoleImmutable || isRestricted;

                      return (
                        <label
                          key={p.code}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 12px',
                            borderBottom: idx < additionalPerms.length - 1 ? '1px solid var(--color-border-subtle, #f1f5f9)' : 'none',
                            backgroundColor: isRestricted
                              ? '#f8fafc'
                              : isChecked
                              ? 'var(--color-brand-50)'
                              : '#ffffff',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => handleTogglePermission(selectedRole, p.code)}
                              style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                              {p.code}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              — {p.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })())}

      {/* TAB 6: ADMIN USER ACCOUNTS & PERSONNEL */}
      {activeTab === 'adminUsers' && (!canManageAdminUsers ? (
        <NoAccessView moduleName="Administrative Staff & Role Governance" requiredPermission={PERMISSIONS.CONFIGURATION_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Platform Administrator Personnel & Access Governance
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Provision operational staff accounts, reassign role boundaries, and govern account suspension states.
              </p>
            </div>
            <button
              onClick={() => {
                setCreateAdminDraft({ email: '', password: '', roleCode: 'OPERATIONS_ADMIN' });
                setCreateAdminError(null);
                setIsCreateAdminModalOpen(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-brand-600)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserPlus size={14} /> Provision Administrator
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setAdminUserFilter(status)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: adminUserFilter === status ? 'var(--color-brand-600)' : 'var(--color-border)',
                  backgroundColor: adminUserFilter === status ? 'var(--color-brand-50)' : 'var(--color-surface)',
                  color: adminUserFilter === status ? 'var(--color-brand-700)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {status === 'ALL' ? 'All Accounts' : status === 'ACTIVE' ? 'Active Staff' : 'Suspended Staff'}
              </button>
            ))}
          </div>

          {/* Accounts Table */}
          {loadingAdminUsers ? (
            <LoadingSpinner message="Loading administrative accounts..." />
          ) : (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Staff ID & Name
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Email Address
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Masked Contact
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Assigned Role
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Account Status
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adminAccountsData?.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        No administrative personnel accounts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    adminAccountsData?.items.map((acc) => {
                      const isSelf = user?.id === acc.id;
                      return (
                        <tr
                          key={acc.id}
                          tabIndex={isSelf ? undefined : 0}
                          role={isSelf ? undefined : 'button'}
                          aria-label={isSelf ? undefined : `Modify role for ${acc.name}`}
                          className={isSelf ? undefined : 'clickable-table-row'}
                          onClick={(e) => {
                            if (isSelf) return;
                            const target = e.target as { closest?: (selector: string) => unknown };
                            if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                              return;
                            }
                            setTargetAdminForRole(acc);
                            setNewRoleCode(acc.role);
                            setChangeRoleReason('');
                            setIsChangeRoleModalOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (isSelf) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              const target = e.target as { closest?: (selector: string) => unknown };
                              if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                                return;
                              }
                              e.preventDefault();
                              setTargetAdminForRole(acc);
                              setNewRoleCode(acc.role);
                              setChangeRoleReason('');
                              setIsChangeRoleModalOpen(true);
                            }
                          }}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            cursor: isSelf ? 'default' : 'pointer',
                          }}
                        >
                          <td style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{acc.name}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {acc.id} {isSelf && <span style={{ color: 'var(--color-brand-600)', fontWeight: 600 }}>(You)</span>}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            {acc.email}
                          </td>
                          <td style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                            {acc.mobileMasked || '—'}
                          </td>
                          <td style={{ padding: 'var(--space-4)' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor:
                                  acc.role === 'SUPER_ADMIN'
                                    ? 'var(--color-brand-100)'
                                    : acc.role === 'OPERATIONS_ADMIN'
                                    ? 'var(--color-status-info-bg)'
                                    : acc.role === 'VERIFICATION_EXECUTIVE'
                                    ? 'var(--color-status-success-bg)'
                                    : 'var(--color-status-warning-bg)',
                                color:
                                  acc.role === 'SUPER_ADMIN'
                                    ? 'var(--color-brand-800)'
                                    : acc.role === 'OPERATIONS_ADMIN'
                                    ? 'var(--color-status-info-text)'
                                    : acc.role === 'VERIFICATION_EXECUTIVE'
                                    ? 'var(--color-status-success-text)'
                                    : 'var(--color-status-warning-text)',
                              }}
                            >
                              {acc.role.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--space-4)' }}>
                            <StatusBadge status={acc.status} />
                          </td>
                          <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                              <button
                                disabled={isSelf}
                                title={isSelf ? 'You cannot alter your own role assignment.' : 'Reassign role persona'}
                                onClick={() => {
                                  setTargetAdminForRole(acc);
                                  setNewRoleCode(acc.role);
                                  setChangeRoleReason('');
                                  setIsChangeRoleModalOpen(true);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--color-border)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  color: isSelf ? 'var(--color-text-tertiary)' : 'var(--color-brand-600)',
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Change Role
                              </button>
                              <button
                                disabled={isSelf}
                                title={isSelf ? 'You cannot suspend your own account.' : acc.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
                                onClick={() => {
                                  setTargetAdminForStatus(acc);
                                  setNewStatus(acc.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
                                  setStatusChangeReason('');
                                  setIsStatusModalOpen(true);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'transparent',
                                  border: '1px solid',
                                  borderColor: acc.status === 'ACTIVE' ? 'var(--color-status-danger-border)' : 'var(--color-status-success-border)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  color: isSelf
                                    ? 'var(--color-text-tertiary)'
                                    : acc.status === 'ACTIVE'
                                    ? 'var(--color-status-danger-text)'
                                    : 'var(--color-status-success-text)',
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {acc.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* TAB 7: SESSION & SECURITY (GAP-SEC-01) */}
      {activeTab === 'security' && (!canManageSecurity ? (
        <NoAccessView moduleName="Session & Security Policy" requiredPermission={PERMISSIONS.CONFIGURATION_MANAGE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Session Governance & Security Settings
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Manage administrative session persistence, automated inactivity logout, and authentication security policies.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
                  color: 'var(--color-status-success-text, #065f46)',
                  border: '1px solid var(--color-status-success-border, #a7f3d0)',
                }}
              >
                <CheckCircle2 size={12} />
                {timeoutMinutes === 15 ? '15-Minute Standard Active' : autoLogoutEnabled ? `${timeoutMinutes}-Minute Policy Active` : 'Inactivity Logout Disabled'}
              </span>
            </div>
          </div>

          {/* Sub-card 1: Inactivity Logout Controls */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 'var(--font-size-md, 15px)', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', margin: 0 }}>
                    Automated Session Inactivity Logout
                  </h3>
                  <div
                    data-testid="active-timeout-badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      backgroundColor: autoLogoutEnabled ? 'var(--color-status-success-bg, #ecfdf5)' : 'var(--color-bg-subtle, #f1f5f9)',
                      border: `1px solid ${autoLogoutEnabled ? 'var(--color-status-success-border, #a7f3d0)' : 'var(--color-border, #cbd5e1)'}`,
                      color: autoLogoutEnabled ? 'var(--color-status-success-text, #065f46)' : 'var(--color-text-secondary, #64748b)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={12} />
                    <span>
                      Active: {autoLogoutEnabled ? `${timeoutMinutes} Minutes` : 'Disabled'}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  Automatically terminate idle administrator sessions to protect sensitive customer records, KYC documents, and financial operations from physical tampering.
                </p>
              </div>

              {/* Enable / Disable Toggle */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: canManageSecurity ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-sm, 13px)',
                  color: 'var(--color-text-primary, #0f172a)',
                  opacity: canManageSecurity ? 1 : 0.7,
                }}
              >
                <input
                  type="checkbox"
                  data-testid="auto-logout-toggle"
                  checked={draftAutoLogout}
                  disabled={!canManageSecurity}
                  onChange={(e) => setDraftAutoLogout(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: canManageSecurity ? 'pointer' : 'not-allowed' }}
                />
                <span>Enable Inactivity Logout</span>
              </label>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e2e8f0)', margin: 0 }} />

            {/* Inactivity Threshold Options */}
            <div style={{ opacity: draftAutoLogout ? 1 : 0.6, pointerEvents: draftAutoLogout ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs, 12px)', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)', margin: 0 }}>
                  INACTIVITY TIMEOUT THRESHOLD
                </label>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)' }}>
                  Permitted: 5 – 60 minutes
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                {/* 15 Minutes Default */}
                <label
                  onClick={handleSelectOption15}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: (!isCustomMode && draftTimeout === 15) ? '2px solid var(--color-brand-600, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                    backgroundColor: (!isCustomMode && draftTimeout === 15) ? 'var(--color-brand-50, #eff6ff)' : 'transparent',
                    cursor: canManageSecurity ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="inactivityTimeout"
                    data-testid="timeout-option-15"
                    checked={!isCustomMode && draftTimeout === 15}
                    onChange={handleSelectOption15}
                    disabled={!canManageSecurity}
                    style={{ marginTop: '2px', cursor: canManageSecurity ? 'pointer' : 'not-allowed' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm, 13px)', color: 'var(--color-text-primary, #0f172a)' }}>
                      15 Minutes (Recommended Default)
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #64748b)', marginTop: '2px' }}>
                      Aligned with backend JWT access token lifetime (900 seconds) and standard administrative posture.
                    </div>
                  </div>
                </label>

                {/* 10 Minutes Strict */}
                <label
                  onClick={handleSelectOption10}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: (!isCustomMode && draftTimeout === 10) ? '2px solid var(--color-brand-600, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                    backgroundColor: (!isCustomMode && draftTimeout === 10) ? 'var(--color-brand-50, #eff6ff)' : 'transparent',
                    cursor: canManageSecurity ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="inactivityTimeout"
                    data-testid="timeout-option-10"
                    checked={!isCustomMode && draftTimeout === 10}
                    onChange={handleSelectOption10}
                    disabled={!canManageSecurity}
                    style={{ marginTop: '2px', cursor: canManageSecurity ? 'pointer' : 'not-allowed' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm, 13px)', color: 'var(--color-text-primary, #0f172a)' }}>
                      10 Minutes (Strict Policy)
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #64748b)', marginTop: '2px' }}>
                      Accelerated client-side timeout window for high-compliance shared administrative environments.
                    </div>
                  </div>
                </label>

                {/* Custom Option */}
                <label
                  onClick={handleSelectCustom}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: isCustomMode ? '2px solid var(--color-brand-600, #2563eb)' : '1px solid var(--color-border, #cbd5e1)',
                    backgroundColor: isCustomMode ? 'var(--color-brand-50, #eff6ff)' : 'transparent',
                    cursor: canManageSecurity ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="inactivityTimeout"
                    data-testid="timeout-option-custom"
                    checked={isCustomMode}
                    onChange={handleSelectCustom}
                    disabled={!canManageSecurity}
                    style={{ marginTop: '2px', cursor: canManageSecurity ? 'pointer' : 'not-allowed' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm, 13px)', color: 'var(--color-text-primary, #0f172a)' }}>
                      Custom Timeout
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #64748b)', marginTop: '2px' }}>
                      Specify custom inactivity duration between 5 and 60 minutes.
                    </div>
                    <div style={{ marginTop: 'var(--space-2)' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          data-testid="custom-timeout-input"
                          min={MIN_TIMEOUT_MINUTES}
                          max={MAX_TIMEOUT_MINUTES}
                          step={1}
                          disabled={!draftAutoLogout || !canManageSecurity}
                          value={customInputValue}
                          onChange={(e) => handleCustomChange(e.target.value)}
                          placeholder="5 - 60"
                          aria-label="Custom timeout in minutes"
                          style={{
                            width: '80px',
                            height: '34px',
                            padding: '0 8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary, #0f172a)',
                            backgroundColor: !draftAutoLogout || !canManageSecurity ? 'var(--color-bg-subtle, #f1f5f9)' : '#ffffff',
                            border: isCustomMode && customError ? '1.5px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border, #cbd5e1)',
                            borderRadius: 'var(--radius-md, 6px)',
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
                          minutes
                        </span>
                      </div>
                      {isCustomMode && customError && (
                        <div
                          data-testid="custom-timeout-error"
                          role="alert"
                          style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            color: 'var(--color-danger, #ef4444)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertCircle size={12} />
                          <span>{customError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Warning Window Details */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md, 6px)',
                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                border: '1px solid var(--color-border, #e2e8f0)',
                fontSize: 'var(--font-size-xs, 12px)',
                color: 'var(--color-text-secondary, #475569)',
              }}
            >
              <Clock size={16} color="var(--color-brand-600, #2563eb)" />
              <span>
                <strong>Pre-Logout Warning:</strong> A countdown dialog appears <strong>60 seconds (1 minute)</strong> before automatic termination. Administrators may select <strong>"Stay Logged In"</strong> to refresh credentials and continue their work without losing unsaved changes.
              </span>
            </div>

            {/* Save & Cancel Action Bar with Unsaved Changes Handling */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--color-border, #e2e8f0)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: '26px' }}>
                {hasUnsavedChanges && !securitySaveSuccess && (
                  <span
                    data-testid="unsaved-changes-indicator"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <AlertCircle size={13} />
                    Unsaved changes
                  </span>
                )}
                {securitySaveSuccess && (
                  <span
                    data-testid="save-feedback-message"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
                      border: '1px solid var(--color-status-success-border, #a7f3d0)',
                      color: 'var(--color-status-success-text, #065f46)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {securitySaveSuccess}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  data-testid="cancel-security-policy-btn"
                  onClick={handleCancelSecurityPolicy}
                  disabled={!hasUnsavedChanges}
                  style={{
                    padding: '7px 16px',
                    fontSize: 'var(--font-size-sm, 13px)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md, 6px)',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    backgroundColor: '#ffffff',
                    color: !hasUnsavedChanges ? 'var(--color-text-disabled, #94a3b8)' : 'var(--color-text-secondary, #475569)',
                    cursor: !hasUnsavedChanges ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  data-testid="save-security-policy-btn"
                  onClick={handleSaveSecurityPolicy}
                  disabled={!hasUnsavedChanges || (isCustomMode && Boolean(customError)) || !canManageSecurity}
                  style={{
                    padding: '7px 18px',
                    fontSize: 'var(--font-size-sm, 13px)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md, 6px)',
                    border: 'none',
                    backgroundColor: (!hasUnsavedChanges || (isCustomMode && Boolean(customError)) || !canManageSecurity)
                      ? 'var(--color-bg-disabled, #cbd5e1)'
                      : 'var(--color-primary, #0f766e)',
                    color: '#ffffff',
                    cursor: (!hasUnsavedChanges || (isCustomMode && Boolean(customError)) || !canManageSecurity) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sub-card 2: Architecture & Gap Register Notice */}
          <div
            data-testid="session-gap-notice"
            style={{
              backgroundColor: 'var(--color-status-info-bg, #eff6ff)',
              border: '1px solid var(--color-status-info-border, #bfdbfe)',
              borderRadius: 'var(--radius-lg, 8px)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldAlert size={18} color="var(--color-brand-600, #2563eb)" />
              <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm, 13px)', fontWeight: 700, color: 'var(--color-brand-900, #1e3a8a)' }}>
                Server Session Architecture & Contract Reference (GAP-SEC-01)
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-brand-800, #1e40af)', lineHeight: 1.5 }}>
              The SevaNest backend currently issues access tokens with a fixed 15-minute (900s) lifetime (`TokenResponse.expiresIn: 900`) and rotating single-use refresh tokens via `/api/v1/auth/admin/login` and `/api/v1/auth/token/refresh`. Dynamic per-tenant server persistence of custom timeout values (`GET/PUT /api/v1/admin/security/session-policy`) is documented in the <strong>Backend Integration Gap Register (GAP-SEC-01)</strong>. The portal enforces the 15-minute standard policy natively with cross-tab Web Locks, while dynamic backend persistence remains pending contract provisioning.
            </p>
          </div>

          {/* Sub-card 3: Active Device Sessions List */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--color-border, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm, 14px)', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                  Active Administrator Token Sessions
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)' }}>
                  Active administrative logins and connected devices tracked via `/api/v1/auth/sessions`.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchSessions()}
                disabled={isSessionsLoading}
                aria-label="Refresh"
                title="Refresh sessions list"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  backgroundColor: 'transparent',
                  fontSize: 'var(--font-size-xs, 11px)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary, #475569)',
                  cursor: isSessionsLoading ? 'not-allowed' : 'pointer',
                  opacity: isSessionsLoading ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} className={isSessionsLoading ? 'animate-spin' : ''} />
                <span>{isSessionsLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>

            {isSessionsLoading ? (
              <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : activeSessions.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary, #64748b)', fontSize: 'var(--font-size-xs, 12px)' }}>
                No active device sessions returned by administrative server.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: 'var(--color-bg-subtle, #f8fafc)', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                    <tr>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>DEVICE / CLIENT</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>SESSION REF</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>CREATED AT</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>LAST ACTIVE</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>STATUS</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)', textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((session) => (
                      <tr key={session.id} style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                          {session.deviceName || 'Administrative Web Browser'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-secondary, #64748b)' }}>
                          {session.id}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)' }}>
                          {formatDateTimeIST(session.createdAt || '')}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)' }}>
                          {formatDateTimeIST(session.lastActiveAt || session.createdAt || '')}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          {session.isCurrent ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm, 4px)',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: 'var(--color-brand-100, #dbeafe)',
                                color: 'var(--color-brand-800, #1e40af)',
                              }}
                            >
                              Current Session
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm, 4px)',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
                                color: 'var(--color-text-secondary, #64748b)',
                              }}
                            >
                              Active Device
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                          {!session.isCurrent && (
                            <button
                              type="button"
                              onClick={() => revokeSessionMutation.mutate(session.id)}
                              disabled={revokeSessionMutation.isPending}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm, 4px)',
                                border: '1px solid var(--color-status-danger-border, #fecaca)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-status-danger-text, #991b1b)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ))}

      {/* MODAL: Edit Service Category */}
      {isCategoryModalOpen && categoryDraft && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-3) var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '860px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              margin: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                <h2
                  aria-label={`Edit Category: ${categoryDraft.name}`}
                  style={{
                    fontSize: 'var(--font-size-md, 15px)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>Edit Service Category</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-brand-700)',
                      backgroundColor: 'var(--color-brand-50, #eff6ff)',
                      border: '1px solid var(--color-brand-200, #bfdbfe)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {categoryDraft.name}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsCategoryModalOpen(false)}
                className="modal-close-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body: Compact 2-Column Balanced Grid */}
            <div
              style={{
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '16px',
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
              }}
            >
              {/* Left Column: Basic Information & Experience */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                  Basic Information
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label htmlFor="category-name-input" style={{ fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Category Name <RequiredIndicator />
                  </label>
                  <input
                    id="category-name-input"
                    type="text"
                    value={categoryDraft.name}
                    onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs, 12px)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label htmlFor="category-tagline-input" style={{ fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Display Tagline / Description
                  </label>
                  <input
                    id="category-tagline-input"
                    type="text"
                    value={categoryDraft.tagline}
                    onChange={(e) => setCategoryDraft({ ...categoryDraft, tagline: e.target.value })}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-xs, 12px)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label htmlFor="category-status-select" style={{ fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Catalog Status
                    </label>
                    <select
                      id="category-status-select"
                      value={categoryDraft.status}
                      onChange={(e) => setCategoryDraft({ ...categoryDraft, status: e.target.value as 'ACTIVE' | 'ARCHIVED' })}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs, 12px)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <option value="ACTIVE">Active (Available)</option>
                      <option value="ARCHIVED">Archived / Disabled</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label htmlFor="category-min-experience-input" style={{ fontSize: 'var(--font-size-xs, 12px)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Min Experience (Months)
                    </label>
                    <input
                      id="category-min-experience-input"
                      type="number"
                      min={0}
                      value={categoryDraft.minExperienceMonths}
                      onChange={(e) => setCategoryDraft({ ...categoryDraft, minExperienceMonths: Number(e.target.value) })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs, 12px)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                </div>

                {/* Subtle Information Note */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-brand-700, #1d4ed8)',
                    backgroundColor: 'var(--color-brand-50, #eff6ff)',
                    border: '1px solid var(--color-brand-200, #bfdbfe)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 8px',
                    lineHeight: 1.35,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: 'auto',
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0, color: 'var(--color-brand-600)' }} />
                  <span>
                    Category details and engagements are synchronized with backend APIs. Skills taxonomy is governed by SevaNest Standards.
                  </span>
                </div>
              </div>

              {/* Right Column: Allowed Engagement Types & Skills Taxonomy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Allowed Engagement Types */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                    Allowed Engagement Types
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '4px 6px',
                      backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {[
                      { value: 'FULL_TIME', label: 'Full-time' },
                      { value: 'PART_TIME', label: 'Part-time' },
                      { value: 'LIVE_IN', label: 'Live-in' },
                      { value: 'DAILY', label: 'Daily' },
                      { value: 'HOURLY', label: 'Hourly' },
                      { value: 'SHIFT', label: 'Shift' },
                      { value: 'ONE_TIME', label: 'One-time' },
                      { value: 'MONTHLY', label: 'Monthly' },
                    ].map((opt) => {
                      const currentEngs = Array.isArray(categoryDraft.allowedEngagementTypes) ? categoryDraft.allowedEngagementTypes : [];
                      const isChecked = currentEngs.some(
                        (e) => e.toUpperCase().replace(/[-\s]/g, '_') === opt.value
                      );
                      return (
                        <label
                          key={opt.value}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isChecked ? 'var(--color-brand-50, #eff6ff)' : 'transparent',
                            border: isChecked ? '1px solid var(--color-brand-200, #bfdbfe)' : '1px solid transparent',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...currentEngs, opt.value]
                                : currentEngs.filter((item) => item.toUpperCase().replace(/[-\s]/g, '_') !== opt.value);
                              setCategoryDraft({ ...categoryDraft, allowedEngagementTypes: updated });
                            }}
                            style={{ margin: 0, cursor: 'pointer' }}
                          />
                          <span style={{ color: isChecked ? 'var(--color-brand-900, #1e3a8a)' : 'var(--color-text-primary)' }}>
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Skills Taxonomy */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                      Skills Taxonomy
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {categoryDraft.skillsTaxonomy.length} skills defined
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Add new skill tag..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newSkillInput.trim()) {
                            setCategoryDraft({
                              ...categoryDraft,
                              skillsTaxonomy: [...categoryDraft.skillsTaxonomy, newSkillInput.trim()],
                            });
                            setNewSkillInput('');
                          }
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-xs, 12px)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSkillInput.trim()) {
                          setCategoryDraft({
                            ...categoryDraft,
                            skillsTaxonomy: [...categoryDraft.skillsTaxonomy, newSkillInput.trim()],
                          });
                          setNewSkillInput('');
                        }
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        fontSize: 'var(--font-size-xs, 12px)',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Add Skill
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      maxHeight: '76px',
                      overflowY: 'auto',
                      padding: '4px 6px',
                      backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      minHeight: '32px',
                      alignContent: 'flex-start',
                    }}
                  >
                    {categoryDraft.skillsTaxonomy.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '2px 4px' }}>
                        No skills assigned yet.
                      </span>
                    ) : (
                      categoryDraft.skillsTaxonomy.map((skill, idx) => (
                        <span
                          key={`${skill}-${idx}`}
                          style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-brand-50, #eff6ff)',
                            color: 'var(--color-brand-700, #1d4ed8)',
                            border: '1px solid var(--color-brand-200, #bfdbfe)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {skill}
                          <button
                            type="button"
                            aria-label={`Remove ${skill} skill`}
                            onClick={() => {
                              const updated = categoryDraft.skillsTaxonomy.filter((_, i) => i !== idx);
                              setCategoryDraft({ ...categoryDraft, skillsTaxonomy: updated });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-error-dark, #dc2626)',
                              fontSize: '13px',
                              lineHeight: 1,
                              padding: '0 2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderTop: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={saveCategoryMutation.isPending}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-size-xs, 12px)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveCategoryMutation.isPending}
                onClick={() => {
                  if (categoryDraft) {
                    setIsCategoryPublishOpen(true);
                  }
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs, 12px)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: saveCategoryMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: saveCategoryMutation.isPending ? 0.7 : 1,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {saveCategoryMutation.isPending ? 'Saving...' : 'Save Category Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Operational Area & Cluster (Create & Edit) */}
      {isAreaModalOpen && areaDraft && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', margin: 0, wordBreak: 'break-word' }}>
                  {areaModalMode === 'edit'
                    ? (areaDraft.clusterName ? `Edit Operational Area: ${areaDraft.clusterName}` : 'Edit Operational Area')
                    : 'Add New Operational Area'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary, #64748b)' }}>
                  {areaModalMode === 'edit'
                    ? 'Update cluster locality, city, and covered postal PIN codes.'
                    : 'Configure a new launch cluster and covered postal PIN codes.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => {
                  setIsAreaModalOpen(false);
                  setAreaModalError(null);
                  setPincodeError(null);
                }}
                className="modal-close-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary, #94a3b8)',
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Alert */}
            {areaModalError && (
              <div
                role="alert"
                style={{
                  backgroundColor: 'var(--color-error-bg, #fef2f2)',
                  border: '1px solid var(--color-error-border, #fecaca)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: 'var(--color-error-text, #991b1b)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{areaModalError}</span>
              </div>
            )}

            {/* Field 1: Cluster / Locality Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="area-cluster-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Cluster / Locality Name <RequiredIndicator />
              </label>
              <input
                id="area-cluster-name"
                type="text"
                placeholder="e.g. Kondapur Hub"
                value={areaDraft.clusterName}
                disabled={isSubmittingArea}
                onChange={(e) => {
                  setAreaDraft((prev) => ({ ...prev, clusterName: e.target.value }));
                  if (areaModalError) setAreaModalError(null);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '14px',
                  backgroundColor: isSubmittingArea ? 'var(--color-bg-subtle, #f8fafc)' : 'var(--color-surface, #ffffff)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Field 2: City Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="area-city-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                City Name <RequiredIndicator />
              </label>
              <input
                id="area-city-name"
                type="text"
                placeholder="e.g. Hyderabad"
                value={areaDraft.cityName}
                disabled={isSubmittingArea}
                onChange={(e) => {
                  setAreaDraft((prev) => ({ ...prev, cityName: e.target.value }));
                  if (areaModalError) setAreaModalError(null);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '14px',
                  backgroundColor: isSubmittingArea ? 'var(--color-bg-subtle, #f8fafc)' : 'var(--color-surface, #ffffff)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Field 3: Covered PIN Codes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="area-pincode-input" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Covered Pin Codes
                </label>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                  6 digits each
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="area-pincode-input"
                  type="text"
                  placeholder="e.g. 500081"
                  maxLength={6}
                  value={newPincodeInput}
                  disabled={isSubmittingArea}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setNewPincodeInput(cleaned);
                    if (pincodeError) setPincodeError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPincode();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: pincodeError ? '1px solid var(--color-error-border, #f87171)' : '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddPincode}
                  disabled={isSubmittingArea || !newPincodeInput.trim()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md, 6px)',
                    backgroundColor: 'var(--color-brand-600, #0d9488)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmittingArea || !newPincodeInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingArea || !newPincodeInput.trim() ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus size={13} /> Add Pincode
                </button>
              </div>

              {pincodeError && (
                <div style={{ fontSize: '11px', color: 'var(--color-error-text, #dc2626)', fontWeight: 600 }}>
                  {pincodeError}
                </div>
              )}

              {/* Pincode chips container */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md, 6px)',
                  backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  minHeight: '40px',
                  alignItems: 'center',
                  marginTop: '2px',
                }}
              >
                {areaDraft.pincodes.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary, #94a3b8)', fontStyle: 'italic' }}>
                    No PIN codes added yet. Enter a 6-digit PIN code and click Add Pincode.
                  </span>
                ) : (
                  areaDraft.pincodes.map((pin) => (
                    <span
                      key={pin}
                      style={{
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm, 4px)',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        color: 'var(--color-text-primary, #0f172a)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {pin}
                      <button
                        type="button"
                        aria-label={`Remove PIN code ${pin}`}
                        title={`Remove PIN code ${pin}`}
                        disabled={isSubmittingArea}
                        onClick={() => handleRemovePincode(pin)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: isSubmittingArea ? 'not-allowed' : 'pointer',
                          color: 'var(--color-error-dark, #dc2626)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
              <button
                type="button"
                onClick={() => {
                  setIsAreaModalOpen(false);
                  setAreaModalError(null);
                  setPincodeError(null);
                }}
                disabled={isSubmittingArea}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary, #475569)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmittingArea ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Save Area"
                disabled={isSubmittingArea}
                onClick={handleSaveArea}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md, 6px)',
                  backgroundColor: 'var(--color-brand-600, #0d9488)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isSubmittingArea ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingArea ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isSubmittingArea ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Area'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Notification Template */}
      {isTemplateModalOpen && templateDraft && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>
                Edit Notification Template: {templateDraft.eventTrigger}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsTemplateModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Message Title Template <RequiredIndicator />
              </label>
              <input
                type="text"
                value={templateDraft.titleTemplate}
                onChange={(e) => setTemplateDraft({ ...templateDraft, titleTemplate: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Message Body Copy Template <RequiredIndicator />
              </label>
              <textarea
                rows={4}
                value={templateDraft.bodyTemplate}
                onChange={(e) => setTemplateDraft({ ...templateDraft, bodyTemplate: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsTemplatePublishOpen(true)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG: Publish Category */}
      <ConfirmDialog
        isOpen={isCategoryPublishOpen}
        title={`Publish Updates to ${categoryDraft?.name}`}
        description="This mutation will update mobile customer and worker search taxonomies across the platform."
        confirmLabel="Confirm & Publish Category"
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational rationale for category taxonomy update..."
        onConfirm={(remarks) => {
          if (categoryDraft) {
            saveCategoryMutation.mutate({ category: categoryDraft, rationale: remarks || 'Category taxonomy update.' });
          }
        }}
        onCancel={() => setIsCategoryPublishOpen(false)}
      />

      {/* CONFIRM DIALOG: Publish Area */}
      <ConfirmDialog
        isOpen={isAreaPublishOpen}
        title={`Save Operational Area: ${areaDraft?.clusterName}`}
        description="Updates will modify search clustering and match radius for this dispatch zone."
        confirmLabel="Confirm Area Update"
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory operational rationale for cluster update..."
        isLoading={saveAreaMutation.isPending}
        errorMessage={saveAreaMutation.error instanceof Error ? saveAreaMutation.error.message : null}
        onConfirm={(remarks) => {
          if (areaDraft) {
            saveAreaMutation.mutate({ area: areaDraft, remarks: remarks || 'Cluster update.' });
          }
        }}
        onCancel={() => setIsAreaPublishOpen(false)}
      />

      {/* CONFIRM DIALOG: Publish Template */}
      <ConfirmDialog
        isOpen={isTemplatePublishOpen}
        title={`Save Notification Template: ${templateDraft?.eventTrigger}`}
        description="Updated messaging copy will apply to subsequent transactional triggers."
        confirmLabel="Confirm Template Update"
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory revision notes..."
        onConfirm={(remarks) => {
          if (templateDraft) {
            saveTemplateMutation.mutate({ template: templateDraft, rationale: remarks || 'Template revision.' });
          }
        }}
        onCancel={() => setIsTemplatePublishOpen(false)}
      />

      {/* CONFIRM DIALOG: Publish Fees */}
      <ConfirmDialog
        isOpen={isPublishFeesOpen}
        title="Publish Commercial Pricing Schedule"
        description="Updated fees will take effect immediately for all subsequent customer checkout transactions and invoices."
        confirmLabel="Confirm & Publish Fees"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory commercial and operational justification for fee adjustments..."
        onConfirm={(remarks) => {
          if (editingFees) {
            publishFeesMutation.mutate({ fees: editingFees, rationale: remarks || 'Commercial fee update.' });
          }
        }}
        onCancel={() => setIsPublishFeesOpen(false)}
      />

      {/* CONFIRM DIALOG: Save Role Privileges */}
      <ConfirmDialog
        isOpen={isRoleSaveOpen}
        title={`Authorize Permission Updates for ${roleDefinitions?.find((r) => r.role === selectedRole)?.roleName || selectedRole}`}
        description="Changes to role capabilities will be enforced on staff authentication token refresh."
        confirmLabel="Authorize Role Update"
        isDestructive={true}
        requireRemarks={true}
        remarksLabel="Mandatory Audit Reason"
        remarksPlaceholder="Explain why these role permissions are being changed..."
        onConfirm={(remarks) => {
          const rawCodes = rolePermissionsDraft[selectedRole] || [];
          const cleanedCodes = Array.from(
            new Set(
              rawCodes
                .map((c) => mapLegacyPermissionToCanonical(c))
                .filter((code) => {
                  if (!code) return false;
                  if (selectedRole !== 'SUPER_ADMIN' && isSuperAdminOnlyPermission(code)) return false;
                  return true;
                })
            )
          );
          updateRoleMutation.mutate({
            role: selectedRole,
            permissions: cleanedCodes,
            rationale: remarks || 'Security role permission update.',
          });
        }}
        onCancel={() => setIsRoleSaveOpen(false)}
      >
        {(() => {
          const roleDef = roleDefinitions?.find((r) => r.role === selectedRole);
          const currentPerms = roleDef?.permissions || [];
          const proposedPerms = rolePermissionsDraft[selectedRole] || [];
          const added = proposedPerms.filter((p) => !currentPerms.includes(p));
          const removed = currentPerms.filter((p) => !proposedPerms.includes(p));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              {/* Selected Role Identification */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="var(--color-brand-600, #0d9488)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Target Role: {roleDef?.roleName || selectedRole}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {selectedRole}
                </span>
              </div>

              {/* Added / Removed Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {added.length > 0 && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                      +{added.length} Permissions Added:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {added.map((code) => (
                        <span
                          key={code}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }}
                        >
                          +{code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {removed.length > 0 && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                      -{removed.length} Permissions Removed:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {removed.map((code) => (
                        <span
                          key={code}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                          }}
                        >
                          -{code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {added.length === 0 && removed.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                    No permissions modified.
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </ConfirmDialog>

      {/* MODAL: View Fee Diff Preview */}
      {isDiffPreviewOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '640px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>
                Commercial Fee Schedule — Diff Preview
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsDiffPreviewOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>Parameter</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>Live Baseline</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>Proposed Draft</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {editingFees?.map((fee) => {
                    const delta = fee.draftValueINR - fee.liveValueINR;
                    return (
                      <tr
                        key={fee.id}
                        tabIndex={0}
                        className="clickable-table-row"
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                          {fee.parameterName}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                          {formatCurrencyINR(fee.liveValueINR)}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                          {formatCurrencyINR(fee.draftValueINR)}
                        </td>
                        <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: delta > 0 ? 'var(--color-brand-600)' : delta < 0 ? 'var(--color-error-dark)' : 'var(--color-text-tertiary)' }}>
                          {delta > 0 ? `+${formatCurrencyINR(delta)}` : delta < 0 ? `-${formatCurrencyINR(Math.abs(delta))}` : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button
                onClick={() => setIsDiffPreviewOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Provision Administrator */}
      {isCreateAdminModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word' }}>
                  Provision New Platform Administrator
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0', wordBreak: 'break-word' }}>
                  Create an administrative account and delegate an authoritative operational persona.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsCreateAdminModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            {createAdminError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  backgroundColor: 'var(--color-status-danger-bg)',
                  border: '1px solid var(--color-status-danger-border)',
                  color: 'var(--color-status-danger-text)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} />
                <span>{createAdminError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Administrator Email <RequiredIndicator /></label>
              <input
                type="email"
                placeholder="name@sevanest.internal"
                value={createAdminDraft.email}
                onChange={(e) => setCreateAdminDraft({ ...createAdminDraft, email: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Temporary Password (min 8 characters) <RequiredIndicator /></label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={createAdminDraft.password}
                onChange={(e) => setCreateAdminDraft({ ...createAdminDraft, password: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Assigned Role Persona <RequiredIndicator /></label>
              <CustomSelect
                value={createAdminDraft.roleCode}
                onChange={(val) => setCreateAdminDraft({ ...createAdminDraft, roleCode: val as AdminRole })}
                options={[
                  { value: 'OPERATIONS_ADMIN', label: 'Operations Admin (Full lifecycle & matching)' },
                  { value: 'VERIFICATION_EXECUTIVE', label: 'Verification Executive (KYC document vetting)' },
                  { value: 'SUPPORT_EXECUTIVE', label: 'Support Executive (Household dispute mediation)' },
                  { value: 'SUPER_ADMIN', label: 'Super Admin (System master configuration)' },
                ]}
                ariaLabel="Assigned Role Persona"
                width="100%"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setIsCreateAdminModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createAdminMutation.isPending}
                onClick={() => createAdminMutation.mutate(createAdminDraft)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: createAdminMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {createAdminMutation.isPending ? 'Provisioning...' : 'Provision Administrator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Change Role */}
      {isChangeRoleModalOpen && targetAdminForRole && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word' }}>
                  Reassign Administrative Role
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0', wordBreak: 'break-word' }}>
                  Reassigning role for <strong>{targetAdminForRole.name}</strong> ({targetAdminForRole.email}).
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsChangeRoleModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>New Role Persona <RequiredIndicator /></label>
              <CustomSelect
                value={newRoleCode}
                onChange={(val) => setNewRoleCode(val as AdminRole)}
                options={[
                  { value: 'OPERATIONS_ADMIN', label: 'Operations Admin' },
                  { value: 'VERIFICATION_EXECUTIVE', label: 'Verification Executive' },
                  { value: 'SUPPORT_EXECUTIVE', label: 'Support Executive' },
                  { value: 'SUPER_ADMIN', label: 'Super Admin' },
                ]}
                ariaLabel="New Role Persona"
                width="100%"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Audit Justification Remarks <RequiredIndicator /></label>
              <textarea
                rows={3}
                placeholder="Reason for role change (recorded in authoritative audit log)..."
                value={changeRoleReason}
                onChange={(e) => setChangeRoleReason(e.target.value)}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setIsChangeRoleModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={changeRoleMutation.isPending}
                onClick={() =>
                  changeRoleMutation.mutate({
                    userId: targetAdminForRole.id,
                    roleCode: newRoleCode,
                    reason: changeRoleReason,
                  })
                }
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-brand-600)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: changeRoleMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {changeRoleMutation.isPending ? 'Updating...' : 'Confirm Role Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Suspend / Reactivate Status */}
      {isStatusModalOpen && targetAdminForStatus && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word' }}>
                  {newStatus === 'SUSPENDED' ? 'Suspend Administrator Account' : 'Reactivate Administrator Account'}
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0', wordBreak: 'break-word' }}>
                  {newStatus === 'SUSPENDED'
                    ? `Suspending account for ${targetAdminForStatus.name} (${targetAdminForStatus.email}) revokes active sessions and prevents further portal access.`
                    : `Reactivating account for ${targetAdminForStatus.name} (${targetAdminForStatus.email}) restores portal access.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsStatusModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Operational Justification Remarks <RequiredIndicator />
              </label>
              <textarea
                rows={3}
                placeholder="Mandatory justification recorded in audit log..."
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending || !statusChangeReason.trim()}
                onClick={() =>
                  updateStatusMutation.mutate({
                    userId: targetAdminForStatus.id,
                    status: newStatus,
                    reason: statusChangeReason,
                  })
                }
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: newStatus === 'SUSPENDED' ? 'var(--color-status-danger-text)' : 'var(--color-status-success-text)',
                  color: '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: updateStatusMutation.isPending || !statusChangeReason.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {updateStatusMutation.isPending
                  ? 'Processing...'
                  : newStatus === 'SUSPENDED'
                  ? 'Confirm Suspension'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Service Category */}
      {isCreateCategoryModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 8px)',
              maxWidth: '500px',
              width: '100%',
              padding: 'var(--space-6, 24px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4, 16px)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ fontSize: 'var(--font-size-lg, 18px)', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', margin: 0, wordBreak: 'break-word' }}>
                  Add New Service Category
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)', wordBreak: 'break-word' }}>
                  Provision an authoritative workforce domain role. Code must be unique.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={() => setIsCreateCategoryModalOpen(false)}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Category Machine Code (e.g. COOK, CHEF)</label>
              <input
                type="text"
                placeholder="COOK"
                value={createCategoryDraft.code}
                onChange={(e) => setCreateCategoryDraft({ ...createCategoryDraft, code: e.target.value.toUpperCase() })}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Display Name</label>
              <input
                type="text"
                placeholder="Cook & Chef"
                value={createCategoryDraft.name}
                onChange={(e) => setCreateCategoryDraft({ ...createCategoryDraft, name: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Description / Tagline</label>
              <input
                type="text"
                placeholder="Professional meal prep and home chef services"
                value={createCategoryDraft.description}
                onChange={(e) => setCreateCategoryDraft({ ...createCategoryDraft, description: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => setIsCreateCategoryModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!createCategoryDraft.code.trim() || !createCategoryDraft.name.trim() || createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate(createCategoryDraft)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600, #0d9488)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {createCategoryMutation.isPending ? 'Provisioning...' : 'Provision Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create Notification Template */}
      {isCreateTemplateModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
            overscrollBehavior: 'contain',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content modal-scrollable-body"
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 8px)',
              maxWidth: '560px',
              width: '100%',
              padding: 'var(--space-6, 24px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4, 16px)',
              maxHeight: 'min(90vh, calc(100vh - 32px))',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg, 18px)', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', margin: 0 }}>
              Add Notification Template
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs, 12px)', color: 'var(--color-text-secondary, #64748b)' }}>
              Configure transactional message copy for Push, SMS, or WhatsApp.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Trigger Event Code</label>
                <input
                  type="text"
                  list="notification-events-list"
                  placeholder="BOOKING_CONFIRMED"
                  value={createTemplateDraft.eventCode}
                  onChange={(e) => setCreateTemplateDraft({ ...createTemplateDraft, eventCode: e.target.value.toUpperCase() })}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                />
                <datalist id="notification-events-list">
                  {notificationEvents.map((ev) => (
                    <option key={ev.eventCode} value={ev.eventCode}>
                      {ev.eventCode}
                    </option>
                  ))}
                </datalist>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Delivery Channel</label>
                <select
                  value={createTemplateDraft.channel}
                  onChange={(e) => setCreateTemplateDraft({ ...createTemplateDraft, channel: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                >
                  <option value="PUSH">PUSH (FCM)</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="EMAIL">EMAIL</option>
                  <option value="IN_APP">IN_APP</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Notification Title</label>
              <input
                type="text"
                placeholder="Booking Confirmed!"
                value={createTemplateDraft.title}
                onChange={(e) => setCreateTemplateDraft({ ...createTemplateDraft, title: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Message Body</label>
              <textarea
                rows={3}
                placeholder="Your booking #{{bookingId}} has been confirmed with {{workerName}}."
                value={createTemplateDraft.body}
                onChange={(e) => setCreateTemplateDraft({ ...createTemplateDraft, body: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', fontFamily: 'sans-serif' }}
              />
            </div>

            {createTemplateDraft.channel === 'SMS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>DLT Template ID (Mandatory for SMS in India)</label>
                <input
                  type="text"
                  placeholder="1107161234567890123"
                  value={createTemplateDraft.dltTemplateId}
                  onChange={(e) => setCreateTemplateDraft({ ...createTemplateDraft, dltTemplateId: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => setIsCreateTemplateModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!createTemplateDraft.eventCode.trim() || !createTemplateDraft.body.trim() || createTemplateMutation.isPending}
                onClick={() => createTemplateMutation.mutate(createTemplateDraft)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600, #0d9488)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {createTemplateMutation.isPending ? 'Provisioning...' : 'Provision Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

