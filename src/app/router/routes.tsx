import React from 'react';
import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { PublicLayout } from '../../layouts/PublicLayout';
import { AppShell } from '../../layouts/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LazyRoute } from './LazyRoute';
import { IndexRedirect } from './IndexRedirect';
import { PERMISSIONS } from '../../core/rbac/permissions';
import { NotFoundView } from '../../shared/components/NotFoundView/NotFoundView';

// Route-based code-splitting via React.lazy for optimized bundle performance
const SignInPage = React.lazy(() =>
  import('../../features/auth/presentation/SignInPage').then((m) => ({ default: m.SignInPage }))
);
const DashboardPage = React.lazy(() =>
  import('../../features/dashboard/presentation/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const CustomersListPage = React.lazy(() =>
  import('../../features/customers/presentation/CustomersListPage').then((m) => ({ default: m.CustomersListPage }))
);
const WorkersListPage = React.lazy(() =>
  import('../../features/workers/presentation/WorkersListPage').then((m) => ({ default: m.WorkersListPage }))
);
const VerificationQueuePage = React.lazy(() =>
  import('../../features/verification/presentation/VerificationQueuePage').then((m) => ({ default: m.VerificationQueuePage }))
);
const VerificationHistoryPage = React.lazy(() =>
  import('../../features/verification/presentation/VerificationHistoryPage').then((m) => ({ default: m.VerificationHistoryPage }))
);
const VerificationInsightsPage = React.lazy(() =>
  import('../../features/verification/presentation/VerificationInsightsPage').then((m) => ({ default: m.VerificationInsightsPage }))
);
const MyAccountPage = React.lazy(() =>
  import('../../features/auth/presentation/MyAccountPage').then((m) => ({ default: m.MyAccountPage }))
);
const BookingsListPage = React.lazy(() =>
  import('../../features/bookings/presentation/BookingsListPage').then((m) => ({ default: m.BookingsListPage }))
);
const PaymentsListPage = React.lazy(() =>
  import('../../features/payments/presentation/PaymentsListPage').then((m) => ({ default: m.PaymentsListPage }))
);
const SupportTicketsPage = React.lazy(() =>
  import('../../features/support/presentation/SupportTicketsPage').then((m) => ({ default: m.SupportTicketsPage }))
);
const ReportsDashboardPage = React.lazy(() =>
  import('../../features/reports/presentation/ReportsDashboardPage').then((m) => ({ default: m.ReportsDashboardPage }))
);
const ConfigurationMastersPage = React.lazy(() =>
  import('../../features/configuration/presentation/ConfigurationMastersPage').then((m) => ({ default: m.ConfigurationMastersPage }))
);
const AuditTrailPage = React.lazy(() =>
  import('../../features/audit/presentation/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage }))
);

export const routes: RouteObject[] = [
  // Public / Authentication Routes
  {
    path: '/auth',
    element: <PublicLayout />,
    children: [
      {
        path: 'login',
        element: (
          <LazyRoute label="Loading sign in console...">
            <SignInPage />
          </LazyRoute>
        ),
      },
      { index: true, element: <Navigate to="/auth/login" replace /> },
    ],
  },

  // Authenticated Portal Routes (Protected by AppShell & Granular Route Guards)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <IndexRedirect /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute permission={PERMISSIONS.DASHBOARD_VIEW}>
            <LazyRoute label="Loading command center...">
              <DashboardPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading verification workstation...">
              <VerificationQueuePage viewMode="all" />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification/my-reviews',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading my reviews workstation...">
              <VerificationQueuePage viewMode="my-reviews" defaultStatus="IN_REVIEW" />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification/rechecks',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading rechecks & expiry workstation...">
              <VerificationQueuePage viewMode="rechecks" defaultStatus="RECHECK_DUE" />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification/corrections',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading corrections required workstation...">
              <VerificationQueuePage viewMode="corrections" defaultStatus="REJECTED" />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification/history',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading verification decision history...">
              <VerificationHistoryPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'verification/insights',
        element: (
          <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
            <LazyRoute label="Loading verification insights...">
              <VerificationInsightsPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'account',
        element: (
          <ProtectedRoute>
            <LazyRoute label="Loading staff profile...">
              <MyAccountPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'bookings',
        element: (
          <ProtectedRoute permission={PERMISSIONS.BOOKINGS_VIEW}>
            <LazyRoute label="Loading booking management...">
              <BookingsListPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <ProtectedRoute permission={PERMISSIONS.CUSTOMERS_VIEW}>
            <LazyRoute label="Loading customer directory...">
              <CustomersListPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'workers',
        element: (
          <ProtectedRoute permission={PERMISSIONS.WORKER_VIEW}>
            <LazyRoute label="Loading workforce roster...">
              <WorkersListPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'payments',
        element: (
          <ProtectedRoute permission={PERMISSIONS.PAYMENTS_VIEW}>
            <LazyRoute label="Loading financial ledgers...">
              <PaymentsListPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'support',
        element: (
          <ProtectedRoute permission={PERMISSIONS.SUPPORT_VIEW}>
            <LazyRoute label="Loading support console...">
              <SupportTicketsPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW}>
            <LazyRoute label="Loading reporting intelligence...">
              <ReportsDashboardPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'configuration',
        element: (
          <ProtectedRoute permission={PERMISSIONS.CONFIGURATION_MANAGE}>
            <LazyRoute label="Loading configuration masters...">
              <ConfigurationMastersPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute permission={PERMISSIONS.AUDIT_VIEW}>
            <LazyRoute label="Loading authoritative audit trail...">
              <AuditTrailPage />
            </LazyRoute>
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <NotFoundView /> },
    ],
  },

  // Global 404 Fallback
  { path: '*', element: <NotFoundView /> },
];

export const router = createBrowserRouter(routes);
