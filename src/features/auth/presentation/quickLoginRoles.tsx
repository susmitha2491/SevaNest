import React from 'react';
import { Shield, Briefcase, UserCheck, Headphones } from 'lucide-react';
import { AdminRole } from '../../../core/auth/authTypes';

export interface QuickLoginRole {
  id: string;
  role: AdminRole;
  name: string;
  email: string;
  password: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
}

export const QUICK_LOGIN_ROLES: QuickLoginRole[] = [
  {
    id: 'super-admin',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
    email: 'sevanest@admin.in',
    password: 'Sevanest@2026',
    badge: 'Governance',
    description: 'Platform configuration, system masters & audit inspection',
    icon: <Shield size={16} />,
  },
  {
    id: 'ops-admin',
    role: 'OPERATIONS_ADMIN',
    name: 'Operations Admin',
    email: 'operations.manager@sevanest.example.com',
    password: 'SnFFtzKHJQu3wm#7q',
    badge: 'Operations',
    description: 'Worker vetting, matching, booking triage & refunds',
    icon: <Briefcase size={16} />,
  },
  {
    id: 'verification-exec',
    role: 'VERIFICATION_EXECUTIVE',
    name: 'Verification Executive',
    email: 'verification.executive@sevanest.example.com',
    password: 'Sn-mvKYhFKPJE7#7q',
    badge: 'Trust & Safety',
    description: 'Worker identity review & KYC document verification',
    icon: <UserCheck size={16} />,
  },
  {
    id: 'support-exec',
    role: 'SUPPORT_EXECUTIVE',
    name: 'Support Executive',
    email: 'support.executive@sevanest.example.com',
    password: 'SnGprIJDAxciUB#7q',
    badge: 'Grievances',
    description: 'Customer inquiries, dispute arbitration & SLA tickets',
    icon: <Headphones size={16} />,
  },
];
