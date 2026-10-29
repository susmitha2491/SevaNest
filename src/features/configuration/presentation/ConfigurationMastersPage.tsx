import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import {
  ConfigurationTab,
  ServiceCategoryItem,
  OperationalAreaItem,
  FeePlanItem,
  NotificationTemplateItem,
} from '../domain/types';
import { configurationRepository } from '../data/configurationRepository';
import { adminUserRepository } from '../../adminUsers/data/adminUserRepository';
import { AdminAccountItem } from '../../adminUsers/domain/types';
import { AdminRole } from '../../../core/auth/authTypes';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';

export const ConfigurationMastersPage: React.FC = () => {

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<ConfigurationTab>('fees');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

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
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaDraft, setAreaDraft] = useState<OperationalAreaItem | null>(null);
  const [newPincodeInput, setNewPincodeInput] = useState('');
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


  // Queries
  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ['config', 'categories'],
    queryFn: () => configurationRepository.getServiceCategories(),
  });

  const { data: operationalAreas, isLoading: loadingAreas } = useQuery({
    queryKey: ['config', 'areas'],
    queryFn: () => configurationRepository.getOperationalAreas(),
  });

  const { isLoading: loadingFees } = useQuery({
    queryKey: ['config', 'fees'],
    queryFn: async () => {
      const fees = await configurationRepository.getFeePlans();
      if (!editingFees) setEditingFees(fees);
      return fees;
    },
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['config', 'templates', selectedChannel],
    queryFn: () => configurationRepository.getNotificationTemplates(selectedChannel),
  });

  const { data: roleDefinitions, isLoading: loadingRoles } = useQuery({
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
  });

  const saveCategoryMutation = useMutation({
    mutationFn: ({ category, rationale }: { category: ServiceCategoryItem; rationale: string }) =>
      configurationRepository.saveCategoryDraft(category, rationale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
      setIsCategoryPublishOpen(false);
      setIsCategoryModalOpen(false);
      setSuccessToast('Service category taxonomy updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
  });

  const saveAreaMutation = useMutation({
    mutationFn: ({ area, remarks }: { area: OperationalAreaItem; remarks: string }) =>
      configurationRepository.saveOperationalArea(area, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'areas'] });
      setIsAreaPublishOpen(false);
      setIsAreaModalOpen(false);
      setSuccessToast('Operational cluster configuration updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
  });

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
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ role, permissions, rationale }: { role: string; permissions: string[]; rationale: string }) =>
      configurationRepository.updateRolePermissions(role, permissions, rationale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'roles'] });
      setIsRoleSaveOpen(false);
      setSuccessToast('Role permissions matrix updated successfully and synchronized.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
  });

  // Admin Users Queries & Mutations
  const { data: adminAccountsData, isLoading: loadingAdminUsers } = useQuery({
    queryKey: ['adminUsers', adminUserFilter],
    queryFn: () =>
      adminUserRepository.getAdminUsers({
        status: adminUserFilter === 'ALL' ? undefined : adminUserFilter,
      }),
    enabled: activeTab === 'adminUsers',
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


  // Permission Guard
  const canManageConfig = hasPermission(user?.permissions, PERMISSIONS.CONFIGURATION_MANAGE);
  if (!canManageConfig) {
    return (
      <NoAccessView
        moduleName="System Configuration Masters"
        requiredPermission={PERMISSIONS.CONFIGURATION_MANAGE}
      />
    );
  }

  if (loadingCats || loadingAreas || loadingFees || loadingTemplates || loadingRoles) {
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
    const currentPerms = rolePermissionsDraft[role] || [];
    const exists = currentPerms.includes(permKey);
    const updated = exists ? currentPerms.filter((p) => p !== permKey) : [...currentPerms, permKey];
    setRolePermissionsDraft({
      ...rolePermissionsDraft,
      [role]: updated,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

      {/* Configuration Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {[
          { id: 'fees', label: 'Fees & Pricing Plans', icon: Tag },
          { id: 'categories', label: 'Service Categories & Skills', icon: Sliders },
          { id: 'areas', label: 'Operational Areas & Clusters', icon: MapPin },
          { id: 'templates', label: 'Notification Templates', icon: MessageSquare },
          { id: 'roles', label: 'Roles & Permission Matrix', icon: Shield },
          { id: 'adminUsers', label: 'Admin Accounts & Personnel', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ConfigurationTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '12px 18px',
                borderBottom: isActive ? '3px solid var(--color-brand-600)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FEES & PRICING PLANS */}
      {activeTab === 'fees' && (
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
                      <tr key={fee.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <input
                              type="number"
                              min={0}
                              value={fee.draftValueINR}
                              onChange={(e) => handleFeeChange(fee.id, Number(e.target.value))}
                              style={{
                                width: '120px',
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-md)',
                                border: isChanged ? '2px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 700,
                              }}
                              aria-label={`Draft value for ${fee.parameterName}`}
                            />
                            {isChanged && (
                              <span style={{ fontSize: '11px', color: 'var(--color-brand-600)', fontWeight: 700 }}>
                                (Draft Modified)
                              </span>
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
      )}

      {/* TAB 2: SERVICE CATEGORIES & SKILLS */}
      {activeTab === 'categories' && (
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
      )}

      {/* TAB 3: OPERATIONAL AREAS & CLUSTERS */}
      {activeTab === 'areas' && (
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
                const newArea: OperationalAreaItem = {
                  id: '',
                  cityName: 'Hyderabad',
                  clusterName: '',
                  pincodes: [],
                  status: 'PILOT',
                  activeWorkersCount: 0,
                };
                setAreaDraft(newArea);
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
                {operationalAreas?.map((area) => (
                  <tr key={area.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                          setAreaDraft(JSON.parse(JSON.stringify(area)));
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
      )}

      {/* TAB 4: NOTIFICATION TEMPLATES */}
      {activeTab === 'templates' && (
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
      )}

      {/* TAB 5: ROLES & PERMISSION MATRIX */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Role-Based Access Control Governance Matrix
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Assign granular capabilities to system personas. Super Admin core controls remain strictly locked.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-surface)',
                }}
                aria-label="Select role to configure"
              >
                {roleDefinitions?.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.roleName} {r.isImmutable ? '(Immutable)' : ''}
                  </option>
                ))}
              </select>
              <button
                disabled={roleDefinitions?.find((r) => r.role === selectedRole)?.isImmutable}
                onClick={() => setIsRoleSaveOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: roleDefinitions?.find((r) => r.role === selectedRole)?.isImmutable ? 'var(--color-bg-subtle)' : 'var(--color-brand-600)',
                  color: roleDefinitions?.find((r) => r.role === selectedRole)?.isImmutable ? 'var(--color-text-tertiary)' : '#ffffff',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: roleDefinitions?.find((r) => r.role === selectedRole)?.isImmutable ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Save size={14} /> Save Role Privileges
              </button>
            </div>
          </div>

          {/* Role Description Card */}
          {roleDefinitions?.find((r) => r.role === selectedRole) && (
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
              {roleDefinitions.find((r) => r.role === selectedRole)?.isImmutable ? (
                <Lock size={20} color="var(--color-warning-dark)" />
              ) : (
                <Shield size={20} color="var(--color-brand-600)" />
              )}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {roleDefinitions.find((r) => r.role === selectedRole)?.roleName} Governance Policy
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {roleDefinitions.find((r) => r.role === selectedRole)?.description}
                </div>
              </div>
            </div>
          )}

          {/* Permissions Toggle Grid */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
              {Object.entries(PERMISSIONS).map(([key, permString]) => {
                const isChecked = (rolePermissionsDraft[selectedRole] || []).includes(permString);
                const isImmutable = roleDefinitions?.find((r) => r.role === selectedRole)?.isImmutable;

                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isChecked ? 'var(--color-brand-50)' : 'var(--color-bg-subtle)',
                      border: '1px solid',
                      borderColor: isChecked ? 'var(--color-brand-600)' : 'var(--color-border)',
                      cursor: isImmutable ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isImmutable}
                      onChange={() => handleTogglePermission(selectedRole, permString)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                        {permString}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ADMIN USER ACCOUNTS & PERSONNEL */}
      {activeTab === 'adminUsers' && (
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
                        <tr key={acc.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
      )}


      {/* MODAL: Edit Service Category */}
      {isCategoryModalOpen && categoryDraft && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Edit Category: {categoryDraft.name}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Display Tagline</label>
              <input
                type="text"
                value={categoryDraft.tagline}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, tagline: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Minimum Experience Required (Months)</label>
              <input
                type="number"
                min={0}
                value={categoryDraft.minExperienceMonths}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, minExperienceMonths: Number(e.target.value) })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Skills Taxonomy</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="Add new skill tag..."
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}
                />
                <button
                  onClick={() => {
                    if (newSkillInput.trim()) {
                      setCategoryDraft({
                        ...categoryDraft,
                        skillsTaxonomy: [...categoryDraft.skillsTaxonomy, newSkillInput.trim()],
                      });
                      setNewSkillInput('');
                    }
                  }}
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  Add Skill
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'var(--space-2)' }}>
                {categoryDraft.skillsTaxonomy.map((skill, idx) => (
                  <span
                    key={skill}
                    style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-brand-50)', color: 'var(--color-brand-700)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {skill}
                    <button
                      onClick={() => {
                        const updated = categoryDraft.skillsTaxonomy.filter((_, i) => i !== idx);
                        setCategoryDraft({ ...categoryDraft, skillsTaxonomy: updated });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-dark)', fontSize: '12px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsCategoryPublishOpen(true)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Save Category Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Operational Area */}
      {isAreaModalOpen && areaDraft && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {areaDraft.id ? `Edit Operational Area: ${areaDraft.clusterName}` : 'Add New Operational Area'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Cluster / Locality Name</label>
              <input
                type="text"
                value={areaDraft.clusterName}
                onChange={(e) => setAreaDraft({ ...areaDraft, clusterName: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>City Name</label>
              <input
                type="text"
                value={areaDraft.cityName}
                onChange={(e) => setAreaDraft({ ...areaDraft, cityName: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Covered Pin Codes</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="e.g. 500081"
                  value={newPincodeInput}
                  onChange={(e) => setNewPincodeInput(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}
                />
                <button
                  onClick={() => {
                    if (newPincodeInput.trim()) {
                      setAreaDraft({
                        ...areaDraft,
                        pincodes: [...areaDraft.pincodes, newPincodeInput.trim()],
                      });
                      setNewPincodeInput('');
                    }
                  }}
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  Add Pincode
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'var(--space-2)' }}>
                {areaDraft.pincodes.map((pin, idx) => (
                  <span
                    key={pin}
                    style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {pin}
                    <button
                      onClick={() => {
                        const updated = areaDraft.pincodes.filter((_, i) => i !== idx);
                        setAreaDraft({ ...areaDraft, pincodes: updated });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-dark)' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <button
                onClick={() => setIsAreaModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsAreaPublishOpen(true)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Notification Template */}
      {isTemplateModalOpen && templateDraft && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Edit Notification Template: {templateDraft.eventTrigger}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Message Title Template</label>
              <input
                type="text"
                value={templateDraft.titleTemplate}
                onChange={(e) => setTemplateDraft({ ...templateDraft, titleTemplate: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Message Body Copy Template</label>
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
        title={`Authorize Permission Updates for ${roleDefinitions?.find((r) => r.role === selectedRole)?.roleName}`}
        description="Changes to role capabilities will be enforced on staff authentication token refresh."
        confirmLabel="Authorize Role Update"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory security authorization justification..."
        onConfirm={(remarks) => {
          updateRoleMutation.mutate({
            role: selectedRole,
            permissions: rolePermissionsDraft[selectedRole] || [],
            rationale: remarks || 'Security role permission update.',
          });
        }}
        onCancel={() => setIsRoleSaveOpen(false)}
      />

      {/* MODAL: View Fee Diff Preview */}
      {isDiffPreviewOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '640px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Commercial Fee Schedule — Diff Preview
            </h2>
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
                      <tr key={fee.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Provision New Platform Administrator
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Create an administrative account and delegate an authoritative operational persona.
            </p>

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
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Administrator Email</label>
              <input
                type="email"
                placeholder="name@sevanest.internal"
                value={createAdminDraft.email}
                onChange={(e) => setCreateAdminDraft({ ...createAdminDraft, email: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Temporary Password (min 8 characters)</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={createAdminDraft.password}
                onChange={(e) => setCreateAdminDraft({ ...createAdminDraft, password: e.target.value })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Assigned Role Persona</label>
              <select
                value={createAdminDraft.roleCode}
                onChange={(e) => setCreateAdminDraft({ ...createAdminDraft, roleCode: e.target.value as AdminRole })}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', backgroundColor: 'var(--color-surface)' }}
              >
                <option value="OPERATIONS_ADMIN">Operations Admin (Full lifecycle & matching)</option>
                <option value="VERIFICATION_EXECUTIVE">Verification Executive (KYC document vetting)</option>
                <option value="SUPPORT_EXECUTIVE">Support Executive (Household dispute mediation)</option>
                <option value="SUPER_ADMIN">Super Admin (System master configuration)</option>
              </select>
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Reassign Administrative Role
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Reassigning role for <strong>{targetAdminForRole.name}</strong> ({targetAdminForRole.email}).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>New Role Persona</label>
              <select
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value as AdminRole)}
                style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', backgroundColor: 'var(--color-surface)' }}
              >
                <option value="OPERATIONS_ADMIN">Operations Admin</option>
                <option value="VERIFICATION_EXECUTIVE">Verification Executive</option>
                <option value="SUPPORT_EXECUTIVE">Support Executive</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Audit Justification Remarks</label>
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {newStatus === 'SUSPENDED' ? 'Suspend Administrator Account' : 'Reactivate Administrator Account'}
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {newStatus === 'SUSPENDED'
                ? `Suspending account for ${targetAdminForStatus.name} (${targetAdminForStatus.email}) revokes active sessions and prevents further portal access.`
                : `Reactivating account for ${targetAdminForStatus.name} (${targetAdminForStatus.email}) restores portal access.`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Operational Justification Remarks <span style={{ color: 'var(--color-status-danger-text)' }}>*</span>
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
    </div>
  );
};

