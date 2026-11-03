# SevaNest Admin Portal — Authoritative Documentation Index

This directory serves as the centralized, authoritative documentation repository for the SevaNest Web Admin & Operations Portal. All documentation is categorized according to architectural purpose and domain boundaries.

---

## 1. Directory Structure

```text
docs/
├── architecture/
│   └── SevaNest_Admin_Portal_Frontend_Architecture_Document.pdf
│
├── project/
│   └── SevaNest_PRD.pdf
│
├── workflows/
│   ├── sevanest-admin-portal-role-wise-workflows.md
│   ├── sevanest-admin-portal-workflow-and-development-plan.md
│   ├── sevanest-operations-admin-workflow.md
│   ├── sevanest-super-admin-workflow.md
│   ├── sevanest-support-executive-workflow.md
│   └── sevanest-verification-executive-workflow.md
│
├── api/
│   ├── admin_openapi_inventory.json
│   ├── openapi.json
│   ├── admin-portal-backend-endpoint-gap-report.md
│   ├── worker-verification-backend-gap-report.md
│   └── sevanest-backend-integration-gap-register.md
│
└── testing/
    ├── admin-portal-completion-tracker.md
    ├── admin-portal-final-completion-report.md
    ├── sevanest-admin-portal-complete-audit.md
    ├── support-executive-completion-tracker.md
    └── support-executive-final-completion-report.md
```

---

## 2. Documentation Registry

### `architecture/` — System & Frontend Architecture
- **[SevaNest_Admin_Portal_Frontend_Architecture_Document.pdf](file:///c:/Users/DELL/Desktop/SevaNest/docs/architecture/SevaNest_Admin_Portal_Frontend_Architecture_Document.pdf)**: Complete frontend architecture specification defining layered clean architecture (Presentation, Domain, Data, Core), state management patterns, RBAC enforcement policies, and security controls.

### `project/` — Product Requirements & Scope
- **[SevaNest_PRD.pdf](file:///c:/Users/DELL/Desktop/SevaNest/docs/project/SevaNest_PRD.pdf)**: Single source of truth for all product scope, functional requirements, operational workflows, business rules, and administrative personas across SevaNest.

### `workflows/` — Role-Specific Operational Workflows
- **[sevanest-admin-portal-role-wise-workflows.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-admin-portal-role-wise-workflows.md)**: End-to-end matrix of operational workflows mapped across all 4 administrative roles (`SUPER_ADMIN`, `OPERATIONS_ADMIN`, `VERIFICATION_EXECUTIVE`, `SUPPORT_EXECUTIVE`).
- **[sevanest-admin-portal-workflow-and-development-plan.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-admin-portal-workflow-and-development-plan.md)**: Development milestones, route-to-module mappings, and delivery schedules.
- **[sevanest-operations-admin-workflow.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-operations-admin-workflow.md)**: Operations Admin specific procedures for trial scheduling, replacement fulfillment, and operational exceptions.
- **[sevanest-super-admin-workflow.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-super-admin-workflow.md)**: Super Admin administrative procedures for staff management, configuration masters, fee schedules, and system audit logs.
- **[sevanest-support-executive-workflow.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-support-executive-workflow.md)**: Customer and worker support grievance ticket handling, SLA management, and dispute escalations.
- **[sevanest-verification-executive-workflow.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/workflows/sevanest-verification-executive-workflow.md)**: Worker document inspection, KYC verification checklist, correction handling, and application approval.

### `api/` — API Contracts & Integration Registers
- **[openapi.json](file:///c:/Users/DELL/Desktop/SevaNest/docs/api/openapi.json)**: Full OpenAPI 3.0 specification for the SevaNest backend API gateway.
- **[admin_openapi_inventory.json](file:///c:/Users/DELL/Desktop/SevaNest/docs/api/admin_openapi_inventory.json)**: Normalized inventory of all `/api/v1/admin/*` endpoints and parameters.
- **[admin-portal-backend-endpoint-gap-report.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/api/admin-portal-backend-endpoint-gap-report.md)**: Gap analysis between frontend consumer expectations and live backend endpoints.
- **[worker-verification-backend-gap-report.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/api/worker-verification-backend-gap-report.md)**: Verification module endpoint analysis covering document URLs, checks, and KYC workflows.
- **[sevanest-backend-integration-gap-register.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/api/sevanest-backend-integration-gap-register.md)**: Exhaustive integration gap register covering all 10 administrative modules.

### `testing/` — Quality Assurance & Verification Reports
- **[admin-portal-completion-tracker.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/testing/admin-portal-completion-tracker.md)**: Master completion tracking matrix covering all routes, components, permissions, and test suites.
- **[admin-portal-final-completion-report.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/testing/admin-portal-final-completion-report.md)**: Comprehensive sign-off report for the Admin Portal frontend.
- **[sevanest-admin-portal-complete-audit.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/testing/sevanest-admin-portal-complete-audit.md)**: Full codebase audit covering permissions, error handling, Docker runtime, and design compliance.
- **[support-executive-completion-tracker.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/testing/support-executive-completion-tracker.md)**: Focused QA tracker for the Support Executive console and ticket management.
- **[support-executive-final-completion-report.md](file:///c:/Users/DELL/Desktop/SevaNest/docs/testing/support-executive-final-completion-report.md)**: Final sign-off document for Support Executive operational readiness.
