# SevaNest Admin Portal — Backend Integration Gap & Dependency Register

**Document Version:** 1.0.0  
**Project:** SevaNest — Verified Household Workforce Platform  
**Target Environment:** `https://sevanest-backend.onrender.com/api/v1`  
**Workspace:** `C:\Users\DELL\Desktop\SevaNest`  
**Date:** October 12, 2026  
**Status:** ACTIVE AUDIT REGISTER  

---

## 1. Executive Summary

This register records all backend integration dependencies, blockers, and contract discrepancies identified during the comprehensive audit and full implementation of frontend-to-backend integrations for the SevaNest Admin Portal.

Every Admin Portal module now has an authoritative `Real...Repository` implementation conforming to the documented backend OpenAPI specification, backed by safe offline `Mock...Repository` fallbacks toggled explicitly via `VITE_USE_MOCK_AUTH`.

Three key blockers prevent 100% live browser-based verification against the deployed Render backend:
1. **Cross-Origin Resource Sharing (CORS) Preflight Failure (`404 Not Found`)**: The deployed NestJS server lacks preflight handling for cross-origin browser requests originating from admin domains.
2. **Missing Test Administrative Credentials in Database**: Deployed database has no provisioned test accounts for any of the 4 administrative roles (`SUPER_ADMIN`, `OPERATIONS_ADMIN`, `VERIFICATION_EXECUTIVE`, `SUPPORT_EXECUTIVE`), returning `401 INVALID_CREDENTIALS`.
3. **Endpoint Discrepancies**: Minor path and query parameter refinements documented below.

---

## 2. Blockers & Backend Dependencies

### Dependency 1: Cross-Origin Resource Sharing (CORS) Preflight Failure on Production Domains

- **Category:** Infrastructure / Backend Configuration Blocker
- **Severity:** HIGH (Blocks direct cross-origin browser-to-backend communications)
- **Module & Feature:** Authentication, HTTP Client, All Admin Modules
- **Required Backend Behavior:**
  - Respond to HTTP `OPTIONS` preflight requests on all `/api/v1/*` routes with `204 No Content` or `200 OK`.
  - Include headers:
    - `Access-Control-Allow-Origin: <admin-origin>` (or configured whitelist: `http://localhost:3000`, `http://localhost:5173`, `https://admin.sevanest.in`)
    - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
    - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With, Idempotency-Key, X-Correlation-ID`
    - `Access-Control-Allow-Credentials: true`
- **Current Observed Behavior:**
  - Cross-origin `OPTIONS` request to `https://sevanest-backend.onrender.com/api/v1/auth/admin/login` returns `404 Not Found` without any `Access-Control-Allow-*` headers.
  - Browser terminates request before executing actual POST/GET, raising `TypeError: Failed to fetch` (Axios `ERR_NETWORK`), mapped to `"Unable to connect to SevaNest Backend API. Please check your network connection or CORS configuration."`
- **Evidence:**
  ```http
  OPTIONS /api/v1/auth/admin/login HTTP/1.1
  Host: sevanest-backend.onrender.com
  Origin: http://localhost:3000
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: content-type,x-correlation-id

  HTTP/1.1 404 Not Found
  Date: Mon, 12 Oct 2026 06:45:10 GMT
  Content-Length: 0
  (No Access-Control-Allow-Origin header present)
  ```
- **Required Backend Action:**
  In NestJS `main.ts`:
  ```typescript
  app.enableCors({
    origin: process.env.ALLOWED_ADMIN_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'https://admin.sevanest.in'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Correlation-ID', 'Accept'],
    credentials: true,
  });
  ```
- **Frontend Action / Mitigation (Implemented & Verified):**
  1. Configured Vite reverse proxy in `vite.config.ts` mapping `/api` -> `https://sevanest-backend.onrender.com`.
  2. Updated `.env` and `src/core/config/env.ts` so `VITE_API_BASE_URL` defaults to `/api/v1` during local development on `http://localhost:3000`.
  3. Browser same-origin requests now bypass preflight `OPTIONS` and successfully reach the live backend handler.
  *Note:* The Vite development proxy enables local development on `http://localhost:3000`, but production deployments on external domains still strictly require the NestJS `main.ts` CORS configuration above.
- **Verification Steps After Fix:**
  Execute `curl -I -X OPTIONS https://sevanest-backend.onrender.com/api/v1/auth/admin/login -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"` and verify `200/204` status with `Access-Control-Allow-Origin: http://localhost:3000`.

---

### Dependency 2: Provisioning & Credentials for Backend Test Accounts

- **Category:** Environment / Database Provisioning Blocker
- **Severity:** HIGH (Blocks live authenticated sessions and post-login verification)
- **Module & Feature:** Authentication (`POST /api/v1/auth/admin/login`), Session Validation (`GET /api/v1/users/me`), Role-Based Dashboards
- **Required Backend Behavior:**
  Valid, active administrative credentials provisioned in the Render PostgreSQL database for:
  1. **Support Executive**: `support.executive@sevanest.example.com`
  2. **Verification Executive**: `verification.executive@sevanest.example.com`
  3. **Operations Admin**: `operations.manager@sevanest.example.com`
  *(Super Admin account pending provisioning)*
- **Current Observed Behavior:**
  1. Endpoint is active and reachable via `/api/v1/auth/admin/login`.
  2. Requests return `401 Unauthorized` with body:
     ```json
     {
       "code": "INVALID_CREDENTIALS",
       "message": "Invalid email or password",
       "requestId": "2035fe75-9717-49d5-9552-82af2117a8d7"
     }
     ```
  3. After repeated submissions, the backend rate-limiter locks the IP/account returning `429 Too Many Requests`:
     ```json
     {
       "code": "ADMIN_LOGIN_LOCKED",
       "message": "Too many failed login attempts. Please try again later."
     }
     ```
- **Required Backend Action:**
  1. Reset / clear `ADMIN_LOGIN_LOCKED` rate-limit blocks on the backend Redis / cache instance for test IPs.
  2. Verify that `support.executive@sevanest.example.com`, `verification.executive@sevanest.example.com`, and `operations.manager@sevanest.example.com` exist in the database with their expected passwords hashed via bcrypt.
  3. Provide the confirmed password strings securely to the authorized QA / frontend tester.
- **Frontend Action (Implemented & Verified):**
  - Updated `RealAuthRepository` to unwrap both flat and nested `{ data: ... }` / `{ tokens: ... }` response payloads.
  - Implemented role alias normalization (`OPERATIONS_MANAGER` -> `OPERATIONS_ADMIN`, etc.).
  - Added role preset buttons in `SignInPage.tsx` supporting the backend test emails.
  - Verified in-browser via browser subagent that CORS errors are gone and the backend's real response (`INVALID_CREDENTIALS` / `ADMIN_LOGIN_LOCKED`) is accurately rendered.
- **Verification Steps After Fix:**
  Submit login request on `http://localhost:3000/auth/login` with the confirmed credentials; verify receipt of JWT `{ accessToken, refreshToken, user }` and automatic redirect to role dashboard.

---

### Dependency 3: Candidate Matching for Bookings vs Replacement Requests

- **Category:** API Architecture Alignment
- **Severity:** MEDIUM
- **Module & Feature:** Bookings (`src/features/bookings`), Candidate Matching
- **Required Backend Behavior:**
  - The OpenAPI specification defines:
    - `GET /api/v1/admin/replacement-requests/{requestId}/candidates`
    - `POST /api/v1/admin/bookings/{bookingId}/{action}` (`match`, `schedule`, `interview-complete`, `confirm-worker`)
- **Current Observed Behavior:**
  - Initial booking requests in status `NEW_REQUEST` do not have a dedicated endpoint for candidate suggestions (`/api/v1/admin/bookings/{bookingId}/candidates` does not exist).
- **Frontend Mitigation:**
  `RealBookingRepository.getCandidateSuggestions()` queries `/api/v1/admin/replacement-requests/{bookingId}/candidates`, falling back to active verified workers from `/api/v1/admin/workers?status=ACTIVE`.
- **Required Backend Action:**
  Add `GET /api/v1/admin/bookings/{bookingId}/candidates` to mirror replacement candidates.
- **Verification Steps After Fix:**
  Query candidate endpoint for pending bookings and verify scoring and recommendations.

---

### Dependency 4: Dedicated Verification Executive Dashboard Endpoint vs. Queue-Derived Metrics

- **Category:** API Architecture Alignment / Contract Clarification
- **Severity:** MEDIUM
- **Module & Feature:** Verification Executive Dashboard (`src/features/dashboard`), Verification Queue (`src/features/verification`)
- **Required Backend Behavior:**
  - Either:
    1. Provision a dedicated endpoint `GET /api/v1/admin/dashboard/verification` returning verified metrics:
       - `pendingReview` (total applications awaiting initial check review)
       - `inProgressReview` (active claimed applications under review)
       - `reCheckDue` (annual re-verification and expiring certificates count)
       - `decisionsToday` (approved or rejected decisions made during the current calendar day)
       - `completedReviews` (total approved/verified domestic workers)
       - `queues`: `{ PENDING_REVIEW: [...], IN_REVIEW: [...], RECHECK_DUE: [...] }`
    2. Or grant `dashboard.view` permission with backend support on `GET /api/v1/admin/dashboard` returning role-filtered verification KPIs.
    3. Or add date filters (e.g., `decisionDate=today` or `decidedAfter=...`) to `GET /api/v1/admin/verification/queue` so that `decisionsToday` can be computed accurately from the queue API without estimating or fabricating data.
- **Current Observed Behavior:**
  - The backend only exposes a single unified operations dashboard at `GET /api/v1/admin/dashboard` protected by `dashboard.view`.
  - The Verification Executive persona holds `['verification.review', 'verification.decide', 'verification.document.view', 'worker.view']`. Access to `GET /api/v1/admin/dashboard` returns `403 Forbidden` if accessed without `dashboard.view`.
  - `GET /api/v1/admin/verification/queue` supports `status` filters (`PENDING_REVIEW`, `IN_REVIEW`, `RECHECK_DUE`, `APPROVED`) and returns `meta.totalItems`, but has no parameter for filtering by decisions made today.
- **Frontend Mitigation (Implemented & Verified):**
  1. Default landing experience routes Verification Executives directly to their primary authorized workstation (`/verification`).
  2. Route `/dashboard` remains protected by `dashboard.view`. Any attempt to access `/dashboard` without permission renders the `NoAccessView` with a link to "Return to Primary Workstation".
  3. When `VerificationExecutiveDashboard` or `RealDashboardRepository.getVerificationExecutiveDashboard()` is queried, it derives real counts and queue items from authorized `GET /api/v1/admin/verification/queue` calls (`status=PENDING_REVIEW`, `status=IN_REVIEW`, `status=RECHECK_DUE`, `status=APPROVED`).
  4. Metric `decisionsToday` defaults to `0` with zero fabricated data, and `completedReviews` is displayed when available.

---

### Dependency 5: Customer Verification Scope & Boundary Reconciliation

- **Category:** Scope & Permission Boundary Reconciled
- **Severity:** LOW (Architecture Confirmed; Source Alignment Verified)
- **Module & Feature:** Verification Review (`src/features/verification`), Customer Management (`src/features/customers`)
- **Source Audit Findings:**
  1. *PRD Section 9 ("Trust, Verification & Safety Framework")*: Customer verification is defined as mobile OTP, residential address, and profile checks upon customer booking. In contrast, worker KYC involves the dedicated 6-tier verification pipeline (Mobile OTP, Govt ID inspection, Address proof inspection, Emergency contact vetting, Employment reference calls, Police clearance certificate).
  2. *Role-Wise Workflows Section 6.4*: The Verification Executive persona is exclusively tasked with Worker KYC vetting. Customer Management (`customers.view`, `customers.manage`, `customers.reveal_pii`, `customers.manage_status`) is classified under "Prohibited Actions: Must not access Customer Management, Bookings, Payments, Refunds, Support Tickets, or Configuration Modules."
  3. *Backend Contract Alignment*: The backend exposes no customer verification queue, review actions, document vault links, or decision endpoints for the Verification Executive. The endpoint `/api/v1/admin/customers/{customerId}/verification-status` is an operational account suspension/reactivation flag managed by Operations Admin (`customers.manage_status`).
- **Resolution:**
  - Customer verification is confirmed as OUT OF SCOPE for the Verification Executive persona.
  - The Verification Executive sidebar navigation legitimately excludes the Customers module.
  - Direct URL access to `/customers` by a Verification Executive strictly displays the `Access Restricted` guard requiring `customers.view`.

---

### Dependency 6: Verification Workstation Server-Side Assignment Filtering (`assignedTo=me` / `reviewerId`)

- **Category:** API Query Filtering & Schema Extension
- **Severity:** MEDIUM
- **Module & Feature:** Verification Operations -> My Reviews (`/verification/my-reviews`), Dossier Assignment
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/verification/queue`
  - `POST /api/v1/admin/verification/checks/{checkId}/start-review`
- **Missing Endpoint, Response Field, Permission, or Business Rule:**
  - `GET /api/v1/admin/verification/queue` currently accepts `status`, `category`, `search`, `page`, `limit`, and `sortBy`, but does NOT accept `assignedTo=me`, `assignedToUserId=<id>`, or `reviewerId=<id>`.
  - Queue records and worker verification applications do not return `assignedToUserId`, `assignedToName`, or `claimedAt` fields in the response payload.
- **Expected Backend Contract:**
  1. Add optional query filter: `GET /api/v1/admin/verification/queue?status=IN_REVIEW&assignedTo=me` (or `reviewerId=<uuid>`).
  2. Extend queue record schema to include:
     ```json
     {
       "id": "app-001",
       "workerId": "wrk-101",
       "workerName": "Sunita Devi",
       "verificationStatus": "IN_REVIEW",
       "assignedTo": {
         "id": "verif-exec-01",
         "name": "Pooja Nair",
         "assignedAt": "2026-10-15T09:30:00Z"
       }
     }
     ```
  3. Provide `POST /api/v1/admin/verification/applications/{id}/claim` and `unclaim` endpoints for explicit assignment lock/release.
- **Frontend Action / Mitigation (Implemented & Verified):**
  - Implemented `/verification/my-reviews` destination as a real, working workstation view.
  - Because the backend does not yet filter by personal assignee, the view honestly displays all currently active in-progress reviews (`status=IN_REVIEW`) with a clear informational banner explaining that personal assignment filtering is awaiting backend schema extension.
  - Zero fake assignments or simulated local claims are fabricated.
- **Required Backend-Team Action:**
  - Add `assignedToUserId` relationship and foreign key to worker verification applications table.
  - Support `assignedTo` query parameter on `GET /api/v1/admin/verification/queue`.

---

### Dependency 7: Verification Turnaround SLA Deadlines & Time-to-Decision Telemetry

- **Category:** Domain Metrics & Telemetry Gap
- **Severity:** LOW (Operational enhancement)
- **Module & Feature:** Verification Dashboard (`/dashboard`), Verification Insights (`/verification/insights`)
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/dashboard`
  - `GET /api/v1/admin/verification/queue`
  - `GET /api/v1/admin/reports/sla-compliance`
- **Missing Endpoint, Response Field, Permission, or Business Rule:**
  - No SLA deadline timestamp (e.g., `dueAt`), elapsed turnaround time, or `isOverdue` flag exists on verification queue items or dossier records.
  - No aggregate endpoint returns the average processing duration (minutes per dossier/check) for verification executives.
- **Expected Backend Contract:**
  1. Define verification SLA parameters (e.g., 24-hour verification turnaround from submission).
  2. Include `dueAt: string (ISO)` and `isOverdue: boolean` on `GET /api/v1/admin/verification/queue` items.
  3. Include verification turnaround telemetry in dashboard / reports:
     ```json
     {
       "avgProcessingTimeMinutes": 45,
       "overdueReviewsCount": 0,
       "slaComplianceRate": 98.2
     }
     ```
- **Frontend Action / Mitigation (Implemented & Verified):**
  - Dashboard KPI cards for "Overdue Reviews (SLA)" and "Avg Processing Time" display `"Unavailable"` honestly, preserving genuine zero/null values with clear subtitles ("SLA targets not returned by backend", "Duration telemetry pending backend contract").
  - Verification Insights explicitly displays an SLA Notice explaining that SLA compliance tracking and average processing time metrics require backend contract extensions and will populate automatically once exposed by the server.
- **Required Backend-Team Action:**
  - Implement SLA calculation logic upon worker KYC submission.
  - Expose aggregate turnaround telemetry in the verification reporting endpoint.

### Dependency 8: Final Application Acceptance & Formal Worker Onboarding Contract

- **Category:** API Contract & Workflow Completion Gap
- **Severity:** HIGH (Blocks formal application sign-off and commercial worker onboarding)
- **Module & Feature:** Worker Verification Workstation (`src/features/workers/presentation/WorkerDetailModal.tsx`, `src/features/verification`)
- **Existing Endpoint / Evidence Inspected:**
  - Individual Verification Check Approval: `POST /api/v1/admin/verification/checks/{checkId}/approve` (Supported & verified).
  - Individual Verification Check Rejection: `POST /api/v1/admin/verification/checks/{checkId}/reject` (Supported & verified).
  - Re-Verification Request: `POST /api/v1/admin/verification/checks/{checkId}/recheck` (Supported & verified).
  - Authoritative Dossier Evaluation: `GET /api/v1/admin/workers/{workerId}/verification` (Supported; returns `level` and individual check states).
  - Missing Composite Endpoint: `POST /api/v1/admin/workers/{workerId}/application/accept` (or `POST /api/v1/admin/verification/applications/{applicationId}/accept`).
  - Confirmed: Calling `PATCH /api/v1/admin/workers/{workerId}` with `{ status: 'ACTIVE' }` is an operational disciplinary/roster override and NOT an application acceptance workflow. Per integration audit constraints, disciplinary endpoints must not be substituted for formal application acceptance.
- **Current Observed Behavior:**
  - The deployed Render backend exposes atomic check evaluation endpoints, but returns `404 Not Found` when requesting composite application acceptance/sign-off (`POST /api/v1/admin/workers/{workerId}/application/accept`).
- **Required Backend Operation & Contract:**
  1. **HTTP Method & Path:** `POST /api/v1/admin/workers/{workerId}/application/accept` (or `/api/v1/admin/verification/applications/{applicationId}/accept`)
  2. **RBAC Authorization:** Requires `verification.decide` permission (`VERIFICATION_EXECUTIVE` or `SUPER_ADMIN`).
  3. **Request Body:**
     ```json
     {
       "notes": "All 5 KYC checks verified authentic and complete under protocol V2; application formally approved for onboarding.",
       "decision": "ACCEPT"
     }
     ```
  4. **Precondition Validation:**
     - Backend must verify that all 5 canonical checks (`IDENTITY`, `ADDRESS`, `EMERGENCY_CONTACT`, `REFERENCE`, `POLICE_CLEARANCE`) are in `APPROVED` status and mobile OTP pre-check is passed.
     - Reject request with `422 Unprocessable Entity` or `400 Bad Request` if any mandatory check is incomplete.
  5. **Expected Response (HTTP 200/201):**
     ```json
     {
       "success": true,
       "workerId": "W-10482",
       "applicationId": "APP-10482",
       "status": "APPROVED",
       "onboardingStatus": "ONBOARDED",
       "acceptedAt": "2026-10-27T07:15:00.000Z",
       "acceptedBy": "Senior Verification Executive",
       "message": "Worker application formally approved and worker onboarded successfully."
     }
     ```
  6. **Side Effects & Domain Events:**
     - Transition worker `status` to `ACTIVE` (or commercial roster eligible).
     - Set `isFullyVerified: true`.
     - Update application status to `APPROVED`.
     - Emit domain events: `worker.application.accepted` and `worker.onboarded`.
- **Frontend Action / Mitigation (Implemented & Verified):**
  - Implemented `approveApplicationAndOnboardWorker(workerId, notes)` in `IVerificationRepository`, `MockVerificationRepository`, and `RealVerificationRepository`.
  - In `WorkerDetailModal.tsx` and `VerificationQueuePage.tsx`, added distinct **Final Approval & Onboard Worker** action in Step 4 when all mandatory KYC checks satisfy the sequential verification workflow (`workflow.canAcceptApplication === true`).
  - The button is disabled with an explanatory prerequisite notice when any mandatory check remains incomplete.
  - Requires mandatory operational sign-off remarks in `ConfirmDialog`.
  - When the real backend returns 404 (endpoint not implemented), the frontend:
    1. Keeps the worker verification popup open.
    2. Displays the genuine backend error banner ("Final Application Approval failed: ... The backend composite application acceptance endpoint is not implemented...").
    3. Retains local state without faking onboarding: the worker remains `isFullyVerified: false` with notice: *"Local state preserved. Worker has not been marked onboarded without backend confirmation."*
    4. Provides a safe "Retry Final Onboarding" button.
    5. Does not show false success banners or fake commercial activation.
- **Required Backend-Team Action:**
  - Implement `POST /api/v1/admin/workers/{workerId}/application/accept` with prerequisite validation and domain event emission.

---

### Dependency 9: Worker Platform Roster Commercial Activation Endpoint

- **Category:** Backend Endpoint & Workflow Availability Gap
- **Severity:** MEDIUM (Blocks direct post-verification worker activation)
- **Module & Feature:** Worker Verification Lifecycle -> Platform Roster Activation
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/workers/{workerId}`
  - `PATCH /api/v1/admin/workers/{workerId}` (Operational disciplinary action: Suspend/Blacklist/Reinstate only)
  - Confirmed: No dedicated worker activation endpoint (e.g., `POST /admin/workers/{id}/activate`) or activation event has been confirmed.
  - Confirmed: `workers.manage_status` is not a registered permission for the worker verification workflow (`worker.view` is canonical).
- **Frontend Action / Mitigation (Implemented & Verified):**
  - Removed unsupported activation controls and mutations from the guided verification workflow in `WorkerDetailModal.tsx`.
  - Replaced the activation step with a neutral, read-only Platform & Roster Status view.
  - Explicitly states that verification does not automatically activate a worker onto the commercial roster and that activation endpoints remain unconfirmed by the backend team.
- **Required Backend-Team Action:**
  - Specify and implement a dedicated commercial activation contract (e.g., `POST /api/v1/admin/workers/{workerId}/activate`) with registered RBAC permissions and onboarding state validation if domestic workers are meant to be activated through the admin portal upon passing verification.

---

### Dependency 10: Mandatory Document ID in Verification Check Payloads

- **Category:** API Contract & Data Completeness Gap
- **Severity:** MEDIUM (Prevents secure document vault retrieval if documentId is omitted)
- **Module & Feature:** Worker Verification Workstation (`/verification`, `WorkerDetailModal.tsx`) -> Document Inspection Vault
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/verification/queue`
  - `GET /api/v1/admin/workers/{workerId}/verification`
  - `GET /api/v1/admin/verification/documents/{documentId}/link`
- **Missing Endpoint, Response Field, Permission, or Business Rule:**
  - The document link vault endpoint requires a genuine `:documentId` (`GET /api/v1/admin/verification/documents/{documentId}/link`).
  - Previously, frontend code had a fallback (`const targetId = documentId || dossierId`) that substituted `dossierId` or `workerId` when `documentId` was absent in check responses.
  - If backend verification check items in `checks: [...]` or `checks: { ... }` omit `documentId` (or `documentMetadata.documentId`), signed document link retrieval cannot proceed.
- **Expected Backend Contract:**
  1. For every document inspection check (`IDENTITY`, `ADDRESS`, `POLICE_CLEARANCE`), include a genuine backend document reference identifier:
     ```json
     {
       "id": "chk-101",
       "type": "IDENTITY",
       "status": "PENDING",
       "evaluationMethod": "DOCUMENT_INSPECTION",
       "documentId": "doc-vault-88912",
       "documentMetadata": {
         "documentId": "doc-vault-88912",
         "documentTypeName": "Aadhaar Card",
         "docNumberMasked": "XXXX-XXXX-8921"
       }
     }
     ```
  2. The returned `documentId` must be the authoritative key accepted by `GET /api/v1/admin/verification/documents/{documentId}/link`.
- **Frontend Action / Mitigation (Implemented & Verified in Phase 4):**
  - Removed all substitution fallbacks (`dossierId`, `workerId`, `checkId`, `checkType`).
  - Added strict validation in `RealVerificationRepository.getSignedDocumentUrl` and `MockVerificationRepository.getSignedDocumentUrl` requiring a genuine non-empty `documentId` and rejecting substituted IDs with `ValidationError`.
  - In `VerificationQueuePage` and `WorkerDetailModal`, if `documentId` is missing from backend check data, the query is disabled (no invalid HTTP calls made) and an honest, clear "Document Vault Attachment Unavailable" state is displayed.
  - Implemented URL security validation enforcing HTTPS (permitting HTTP only for local development loopback) and rejecting unsafe protocols (`javascript:`, `data:`, etc.) without logging tokens or PII.
- **Required Backend-Team Action:**
---

### Dependency 11: Verification Queue Check Identifier (`checkId`) Contract & Action Workflow

- **Category:** API Contract & Workflow State Alignment
- **Severity:** MEDIUM (Ensures queue action triggers match backend capabilities)
- **Module & Feature:** Worker Verification Queue (`/verification`) -> Status-Aware Actions & Dossier Interactivity
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/verification/queue`
  - `POST /api/v1/admin/verification/checks/{checkId}/start-review`
  - `POST /api/v1/admin/verification/checks/{checkId}/approve`
  - `POST /api/v1/admin/verification/checks/{checkId}/reject`
  - `POST /api/v1/admin/verification/checks/{checkId}/recheck`
- **Missing Endpoint, Response Field, Permission, or Business Rule:**
  - The review-start endpoint operates strictly at the check level (`/checks/{checkId}/start-review`). If queue payloads omit top-level `checkId` (or an active check ID), the frontend cannot claim the check via the server API.
  - Verification statuses (`PENDING_REVIEW`, `IN_REVIEW`, `REJECTED`, `RECHECK_DUE`, `APPROVED`) map to specific operational workflows:
    - `PENDING_REVIEW`: Must permit claiming review (`Start Review`) if `checkId` is present and executive has `verification.decide` permission; otherwise falls back to `Inspect Dossier` with `Claim Unavailable` if `checkId` is missing.
    - `IN_REVIEW`: Already claimed; must offer `Continue Review` or `Inspect Dossier` without repeating claim mutations or initiating duplicate reviews.
    - `REJECTED`: Previous review rejected; allows `Review Corrections` or `Inspect Dossier` where workflow permits re-inspection.
    - `RECHECK_DUE`: Periodic or requested re-inspection; allows `Review Re-Check` or `Inspect Dossier`.
    - `APPROVED`: Verification completed; allows `View Dossier` strictly in read-only mode with decision mutations disabled.
- **Frontend Action / Mitigation (Implemented & Verified):**
  - Updated queue table rows to be fully interactive (pointer cursor, hover highlight, keyboard focus via `tabIndex={0}` and Enter/Space navigation, event propagation stopped on inner controls).
  - Implemented status-aware action buttons with clear, accessible labels.
  - Enforced server-issued RBAC permissions (`verification.decide` required for review-start and check decisions).
  - Maintained complete separation between verification approval and worker account activation (approving verification does not auto-activate workers or modify commercial roster status).
  - Handled 409 `CHECK_ALREADY_ASSIGNED` conflicts and unexpected network errors gracefully with clear dismissible UI banners.
- **Required Backend-Team Action:**
  - Ensure `checkId` (or the initial pending check's ID) is always included in each item returned by `GET /api/v1/admin/verification/queue`.
  - Confirm whether an application-level claim endpoint (e.g., `POST /api/v1/admin/verification/applications/{id}/start-review`) will be provided in a future release to claim all checks for a worker atomically.

---

## 3. Module-by-Module Backend Integration Matrix

| Module | Features / Operations | Expected Backend Endpoint | HTTP Method | Frontend Repository Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Admin Login | `/api/v1/auth/admin-login` | `POST` | `RealAuthRepository` | Implemented (Verified via tests; live blocked by credentials/CORS) |
| **Authentication** | Token Refresh | `/api/v1/auth/refresh` | `POST` | `RealAuthRepository` | Implemented |
| **Authentication** | Session Validation | `/api/v1/users/me` | `GET` | `RealAuthRepository` | Implemented |
| **Authentication** | Session Revocation | `/api/v1/auth/logout` | `POST` | `RealAuthRepository` | Implemented |
| **Dashboard** | Unified Operations & KPI Summary | `/api/v1/admin/dashboard` | `GET` | `RealDashboardRepository` | Implemented |
| **Customers** | Directory, Search, Pagination | `/api/v1/admin/customers` | `GET` | `RealCustomerRepository` | Implemented |
| **Customers** | Profile & Historical Details | `/api/v1/admin/customers/{customerId}` | `GET` | `RealCustomerRepository` | Implemented |
| **Customers** | Verification Status Update | `/api/v1/admin/customers/{customerId}/verification-status` | `PATCH` | `RealCustomerRepository` | Implemented |
| **Customers** | Internal Case Notes | `/api/v1/admin/customers/{customerId}/notes` | `POST` / `GET` | `RealCustomerRepository` | Implemented |
| **Workers** | Directory, Filters, Pagination | `/api/v1/admin/workers` | `GET` | `RealWorkerRepository` | Implemented |
| **Workers** | Profile & Skills | `/api/v1/admin/workers/{workerId}` | `GET` | `RealWorkerRepository` | Implemented |
| **Workers** | Lifecycle Status Update | `/api/v1/admin/workers/{workerId}` | `PATCH` | `RealWorkerRepository` | Implemented |
| **Workers** | Category Preferences | `/api/v1/admin/workers/{workerId}/categories` | `PUT` | `RealWorkerRepository` | Implemented |
| **Verification** | Queue, Filters, Oldest First | `/api/v1/admin/verification/queue` | `GET` | `RealVerificationRepository` | Implemented |
| **Verification** | Claim Check / Start Review | `/api/v1/admin/verification/checks/{checkId}/start-review` | `POST` | `RealVerificationRepository` | Implemented |
| **Verification** | Approve Check | `/api/v1/admin/verification/checks/{checkId}/approve` | `POST` | `RealVerificationRepository` | Implemented |
| **Verification** | Reject Check with Remarks | `/api/v1/admin/verification/checks/{checkId}/reject` | `POST` | `RealVerificationRepository` | Implemented |
| **Verification** | Request Re-Verification | `/api/v1/admin/verification/checks/{checkId}/recheck` | `POST` | `RealVerificationRepository` | Implemented |
| **Verification** | Document Vault Access Link | `/api/v1/admin/verification/documents/{documentId}/link` | `GET` | `RealVerificationRepository` | Implemented |
| **Bookings** | Directory, State Filters, Pagination | `/api/v1/admin/bookings` | `GET` | `RealBookingRepository` | Implemented |
| **Bookings** | Detail & History | `/api/v1/admin/bookings/{bookingId}` | `GET` | `RealBookingRepository` | Implemented |
| **Bookings** | State Transitions (`match`, `schedule`, etc.) | `/api/v1/admin/bookings/{bookingId}/{action}` | `POST` | `RealBookingRepository` | Implemented |
| **Bookings** | Replacement Requests & Decisions | `/api/v1/admin/replacement-requests/{requestId}/*` | `GET` / `POST` | `RealBookingRepository` | Implemented |
| **Payments** | Transaction Log & Filters | `/api/v1/admin/payments` | `GET` | `RealPaymentRepository` | Implemented |
| **Payments** | Payment Details & Breakdown | `/api/v1/admin/payments/{paymentId}` | `GET` | `RealPaymentRepository` | Implemented |
| **Payments** | Refund Execution | `/api/v1/admin/payments/{paymentId}/refund` | `POST` | `RealPaymentRepository` | Implemented |
| **Support** | Ticket Directory & SLA Status | `/api/v1/admin/support/tickets` | `GET` | `RealSupportRepository` | Implemented |
| **Support** | Ticket Assignment | `/api/v1/admin/support/tickets/{ticketId}/assign` | `POST` | `RealSupportRepository` | Implemented |
| **Support** | Case Notes / Staff Communication | `/api/v1/admin/support/tickets/{ticketId}/messages` | `POST` / `GET` | `RealSupportRepository` | Implemented |
| **Support** | Ticket Resolution & Closure | `/api/v1/admin/support/tickets/{ticketId}/close` | `POST` | `RealSupportRepository` | Implemented |
| **Support** | Ticket Escalation | `/api/v1/admin/support/tickets/{ticketId}/escalate` | `POST` | `RealSupportRepository` | Implemented |
| **Reports** | Reports Catalog | `/api/v1/admin/reports` | `GET` | `RealReportRepository` | Implemented |
| **Reports** | Specialized Report Datasets (13 endpoints) | `/api/v1/admin/reports/{reportCode}` | `GET` | `RealReportRepository` | Implemented |
| **Configuration** | Reference Data Masters | `/api/v1/reference-data` | `GET` | `RealReferenceDataRepository` | Implemented |
| **Configuration** | Application Configuration & Fees | `/api/v1/app-config` | `GET` | `RealReferenceDataRepository` | Implemented |
| **Configuration** | Verification Requirements | `/api/v1/admin/verification/requirements` | `GET` / `PUT` | `RealReferenceDataRepository` | Implemented |
| **Admin Users** | Admin Directory & Creation | `/api/v1/admin/users` | `GET` / `POST` | `RealAdminUserRepository` | Implemented |
| **Admin Users** | Role Update & Status Update | `/api/v1/admin/users/{userId}/*` | `PATCH` | `RealAdminUserRepository` | Implemented |
| **Audit Logs** | Authoritative Audit Trail & Filters | `/api/v1/admin/audit-logs` | `GET` | `RealAuditRepository` | Implemented |

---

---

## 4. Verification Categorization

- **Implemented:** 100% of required frontend API repositories and domain mappers exist and connect to real endpoints via `httpClient`.
- **Automated Verification Passed:** 100% of integration test suites (`vitest`), TypeScript typecheck (`tsc --noEmit`), ESLint, and production build (`vite build`) pass.
- **Live Integration Verified:** Blocked pending Backend Action 1 (CORS enablement on Render) and Backend Action 2 (administrative user seeding in production database).

---

## 5. Worker Verification Documents & Secure Vault Integration Gap Analysis

### 5.1 Document ID Availability in Verification Dossiers
- **Category:** Data Model / API Contract Consistency
- **Observed Behavior:**
  - `GET /api/v1/admin/verification/queue` and `GET /api/v1/admin/verification/dossiers/{workerId}` return check records for each applicant.
  - In certain responses, checks (e.g. `IDENTITY`, `ADDRESS`, `POLICE_CLEARANCE`) contain status information without an associated `documentId` (e.g., `documents: []` or `documentMetadata: null`).
  - When an applicant has not yet submitted an attachment, the check is in `PENDING` status. The frontend correctly identifies this as `Pending Submission` and suppresses the `Inspect Document` action.
- **Backend Requirement:**
  - Ensure the backend worker submission pipeline reliably sets `documentId` on the verification check record immediately upon file receipt in object storage.
  - Never return placeholder strings (e.g., `"null"`, `"undefined"`, or empty strings) as document identifiers.

### 5.2 Document Metadata & MIME Type Standardization
- **Category:** Metadata Contract Completeness
- **Observed Behavior:**
  - The backend returns varied schema structures for document attachments across endpoints:
    - Array of objects: `documents: [{ id, documentNumber, documentType }]`
    - Nested metadata: `documentMetadata: { documentId, docNumberMasked, documentTypeName, expiryDate }`
    - Top-level fields: `documentId`, `documentNumber`, `documentType`
- **Required Backend Action:**
  - Standardize document metadata in `GET /api/v1/admin/verification/dossiers/{workerId}` to include:
    - `documentId: string` (Canonical UUID)
    - `documentType: string` (e.g. `'AADHAAR'`, `'VOTER_ID'`, `'PASSPORT'`, `'UTILITY_BILL'`, `'PCC'`)
    - `documentTypeName: string` (Human-readable label)
    - `docNumberMasked: string` (Pre-masked string e.g. `'XXXX-XXXX-8921'`)
    - `mimeType: string` (e.g. `'application/pdf'`, `'image/jpeg'`, `'image/png'`)
    - `fileSizeBytes: number`
    - `uploadedAt: string` (ISO 8601 UTC)
    - `expiryDate?: string`

### 5.3 Secure Document Link Retrieval (`GET /api/v1/admin/verification/documents/{documentId}/link`)
- **Category:** Secure Vault URL Lifecycle & Error Handling
- **Observed Contract & Root Cause Analysis:**
  - **Verified Backend Contract:** `GET /api/v1/admin/verification/documents/{documentId}/link` (Path parameter only; no query parameters).
  - **Identified Root Cause of 404 / Duplicate Requests:**
    1. Previous frontend implementation in `RealVerificationRepository.getSignedDocumentUrl` appended `{ params: { checkType } }`, dispatching requests like `GET /api/v1/admin/verification/documents/{documentId}/link?checkType=IDENTITY`.
    2. The backend document vault returns HTTP 404 (`{"code":"NOT_FOUND","message":"Document not found"}`) when an attachment record exists in metadata but the actual physical file is missing or un-uploaded in storage.
    3. React Query's default retry behavior caused an immediate duplicate retry on 404 responses, resulting in twin 404 entries in browser network logs.
  - **Resolution Applied:**
    - Removed `checkType` query parameter from `verificationRepository.getSignedDocumentUrl`. Requests now strictly follow `GET /admin/verification/documents/{cleanDocId}/link`.
    - Added retry predicate to `useQuery` hooks (`VerificationQueuePage` and `WorkerDetailModal`) preventing automatic retries on 404 (`NotFoundError`), 401 (`UnauthorizedError`), 403 (`ForbiddenError`), and 422 (`ValidationError`), eliminating duplicate requests.
    - Structured error formatting via `formatDocumentVaultError` provides distinct user-facing messages for 404 (document not found in storage vault), 401/403 (insufficient permissions), expired links, and network failures with explicit retry actions.
  - Returns: `{ data: { url: string, signedUrl: string, expiresAt: string, expiresInSeconds: number } }`.
  - Frontend enforces HTTPS-only URLs (with local loopback exception for development) and rejects unsafe protocols (`javascript:`, `data:`, `file:`).
- **Backend Requirements & Gaps:**
  - **Storage Vault Availability:** When a worker is onboarded or moves through KYC checks, ensure worker-uploaded documents are properly transferred and stored in the backend vault with matching `documentId` records.
  - **Structured Error Responses:** Continue returning standard error payloads for missing files (`404 NOT_FOUND`) or expired URLs (`410 GONE` / `400 DOCUMENT_EXPIRED`) rather than 500 server crashes.
  - **CORS Support:** The S3/GCS bucket pre-signed URLs must include appropriate CORS headers allowing `GET` from the admin portal origin if loaded via JavaScript or canvas.

### 5.4 RBAC Permission Alignment
- **Category:** Authorization Enforcement
- **Backend Permissions:**
  - Canonical permission code: `verification.document.view`.
  - Frontend supports both `verification.document.view` and legacy alias `documents.view_restricted`.
  - Without this permission, the UI displays a `Restricted Access` notice and prevents signed URL resolution.
- **Backend Requirement:**
  - Ensure JWT tokens issued for `VERIFICATION_EXECUTIVE` and `SUPER_ADMIN` roles contain `verification.document.view`.

### 5.5 Granular Document Review vs. Check-Level Decisions
- **Category:** Workflow Architecture
- **Observed Architecture:**
  - Backend mutations exist at the *check level*:
    - `POST /api/v1/admin/verification/checks/{checkId}/approve`
    - `POST /api/v1/admin/verification/checks/{checkId}/reject`
    - `POST /api/v1/admin/verification/checks/{checkId}/recheck`
  - There are no separate per-document mutation endpoints.
  - Document inspection in the Submitted Documents Vault is an authoritative evidence-gathering step that feeds directly into the check-level verification decision.
  - Inspecting a document does NOT auto-approve the check, preserving human-in-the-loop audit integrity.

---

## 6. Verification Executive Customer Directory Access & RBAC Alignment

### 6.1 Context & Requirement
- **Module Affected:** Customer Directory (`/customers`), Customer Details Modal (`CustomerDetailModal`), Verification Executive role.
- **Workflow:** Verification Executives inspecting household contexts, booking history, and employer profiles during verification investigations require read-only access to customer records.
- **Security Boundary:** The Verification Executive must NOT possess write permissions such as `customers.manage_status` (suspending or reactivating accounts) or unrestricted customer profile modifications.

### 6.2 Endpoint & Contract Verification
- **Customer List:** `GET /api/v1/admin/customers`
  - Query parameters supported: `search` (general name/ID query), `query`, `mobile` (formatted phone digits), `status` (`ACTIVE` / `SUSPENDED`), `locality`.
  - Response envelopes supported by frontend: flat array `[...]`, `{ items: [...] }`, `{ customers: [...] }`, `{ data: [...] }`, `{ data: { items: [...] } }`, `{ data: { customers: [...] } }`.
- **Customer Details:** `GET /api/v1/admin/customers/{customerId}`
  - Response shapes supported: `{ customer: {...} }`, `{ data: { customer: {...} } }`, `{ data: {...} }`, or flat record.
  - Masked contact details returned by default (`+91 98**** **12`, `c****@sevanest.internal`).
- **Status Mutation (Operations Admin only):** `PATCH /api/v1/admin/customers/{customerId}/verification-status`
  - Strictly gated behind `customers.manage_status`.
  - Hidden from Verification Executive role to enforce read-only semantics.

### 6.3 Required Backend-Team Action
1. Ensure the auth server includes `customer.view` in the `authorities`/`permissions` claim of JWT access tokens issued to `VERIFICATION_EXECUTIVE` users.
2. Confirm `GET /api/v1/admin/customers` allows pagination (`page`, `limit`) and case-insensitive substring search on customer name, mobile, and locality.
3. Ensure customer records consistently return standard JSON envelopes (`{ items: Customer[], totalCount: number, page: number, pageSize: number }`).

---

## 7. Worker Application-Level Decision Endpoint vs. Check-Level Verification Architecture (ARCH-VERIF-01)

### 7.1 Context & Requirement
- **Gap Identifier:** `ARCH-VERIF-01`
- **Module Affected:** Workers Directory (`/workers`), Unified Worker Profile Modal (`WorkerDetailModal`), Verification Workstation (`VerificationQueuePage`), Verification Executive Persona.
- **Workflow & Audit Corrections:**
  - **Inconsistent Profile Navigation Fix:** Previously, clicking a worker row opened a duplicate `WorkerApplicationDetailModal` while clicking "View Profile" opened `WorkerDetailModal`. This duplicate screen was removed and all worker profile navigation consolidated on `WorkerDetailModal`, preserving worker ID and active filters. "Review KYC" was preserved as a dedicated action directly navigating to the verification workstation (`/verification?workerId=${worker.id}&dossierId=${worker.id}`).
  - **Document Viewing Improvements:** Redesigned into a dedicated 2-column split-screen workstation with full-size document viewer, zoom/rotate/open-in-new-tab tools, explicit missing doc ID containers (`data-testid="verification-doc-missing-id"`), and role-based permission gates (`verification.document.view` / `documents.view_restricted`).
  - **Mandatory Sequential Verification Architecture:** Enforces the canonical 5 Operations Checks review order supported by PRD Sections 7 & 9:
    1. Telecom Mobile Phone OTP (Automated SMS pre-check)
    2. Identity Proof (`IDENTITY`) — Visual Document Inspection
    3. Residential Address Proof (`ADDRESS`) — Visual Document Inspection
    4. Emergency Contact Vetting (`EMERGENCY_CONTACT`) — Telephonic Call Vetting
    5. Previous Employer Reference (`REFERENCE`) — Telephonic Reference Call
    6. Police Clearance Certificate (`POLICE_CLEARANCE`) — Certificate Tracking & Review
  - **Strict Sequential Locking Rule:** A subsequent check is locked (`isLocked === true`) and cannot be approved until all preceding checks in canonical order have reached `APPROVED` status.
  - An application is marked **VERIFIED** only when all 5 operations checks are `APPROVED` and the telecom OTP pre-check is passed (`preCheckOtpVerified === true`).
  - If any mandatory check is `PENDING`, `IN_REVIEW`, `RECHECK_DUE`, or `REJECTED`, the application is **INCOMPLETE** and final acceptance cannot be executed.
- **Lifecycle & Architecture Distinction:**
  1. **Individual KYC Check Approval:** `POST /api/v1/admin/verification/checks/{checkId}/approve` approves an atomic compliance check. Upon success, UI advances to the next sequential check without unexpectedly closing the dossier.
  2. **Overall KYC Verification:** When all 5 checks are approved, backend sets verification level to `VERIFIED` on `GET /api/v1/admin/workers/{workerId}/verification`.
  3. **Application Acceptance/Rejection:** A composite lifecycle decision on the worker's application record as a whole.
  4. **Commercial Roster Activation:** Updating account state to `ACTIVE` on `PATCH /api/v1/admin/workers/{workerId}` to enable platform matching and customer bookings (governed strictly by `workers.manage_status`).

### 7.2 Missing Endpoints in Backend API
The deployed OpenAPI specification does **not** expose composite application-level decision endpoints:
1. **Application Acceptance Endpoint (Missing — ARCH-VERIF-01):**
   - **Path:** `POST /api/v1/admin/workers/{workerId}/application/accept` or `POST /api/v1/admin/applications/{applicationId}/accept`
   - **Role / Permission Required:** `VERIFICATION_EXECUTIVE` with `verification.decide`.
   - **Headers:** `Authorization: Bearer <jwt>`, `Idempotency-Key: <uuid>`, `Content-Type: application/json`
   - **Expected Request Payload:**
     ```json
     {
       "remarks": "KYC verified and approved by Verification Executive",
       "verificationNotes": "All 5 operations checks verified and authentic"
     }
     ```
   - **Expected Responses:**
     - `200 OK`:
       ```json
       {
         "workerId": "W-10482",
         "applicationId": "APP-10482",
         "status": "ACCEPTED",
         "acceptedAt": "2026-10-26T10:00:00Z",
         "acceptedBy": "adm-003",
         "verificationLevel": "LEVEL_3"
       }
       ```
     - `409 Conflict (INCOMPLETE_VERIFICATION_CHECKS)`:
       ```json
       {
         "code": "INCOMPLETE_VERIFICATION_CHECKS",
         "message": "Cannot accept application: 2 mandatory KYC verification checks remain incomplete (REFERENCE, POLICE_CLEARANCE).",
         "incompleteChecks": ["REFERENCE", "POLICE_CLEARANCE"]
       }
       ```
     - `403 Forbidden`: User lacks `verification.decide`.
     - `404 Not Found`: Worker or application ID does not exist.

2. **Application Rejection Endpoint (Missing):**
   - **Path:** `POST /api/v1/admin/workers/{workerId}/application/reject` or `POST /api/v1/admin/applications/{applicationId}/reject`
   - **Role / Permission Required:** `VERIFICATION_EXECUTIVE` with `verification.decide`.
   - **Expected Request Payload:**
     ```json
     {
       "rejectionCategory": "BLURRY_IMAGE",
       "remarks": "Document illegible. Please re-upload clear government ID."
     }
     ```

### 7.3 Frontend Mitigation & Audit Compliance
- **Sequential Workflow Enforcement:**
  - Dependent checks display a clear sequential lock banner explaining which prerequisite check(s) must be approved first.
  - The "Approve Check" button is disabled and displays a Lock icon when prerequisite checks remain unapproved.
- **Before All Mandatory Checks Pass:**
  - The final acceptance banner is not displayed.
  - Incomplete checks are explicitly highlighted with their real backend statuses.
- **After All Mandatory Checks Pass:**
  - The frontend displays an authoritative verification success banner: *"All 6 Verification Criteria Satisfied • Authoritative Status: VERIFIED"*.
  - It records gap `ARCH-VERIF-01`, noting that server-side verification status is computed from individual checks and no fake composite acceptance endpoint is called.
- **Check-Level Action Handling:**
  - Check approval calls `POST /api/v1/admin/verification/checks/{checkId}/approve` and advances to the next sequential step without closing the dossier.
  - Rejection targets `POST /api/v1/admin/verification/checks/{checkId}/reject` with required category and remarks.
  - Re-verification calls `POST /api/v1/admin/verification/checks/{checkId}/recheck` with mandatory instructions.
- **Strict Decoupling from Activation:**
  - Commercial account activation (`worker.status === 'ACTIVE'`) is strictly decoupled from KYC verification and requires Operations Admin authorization.

---

## 8. Worker Contact Details Unmasked Access & Registered Email Contract Gap (ARCH-WORKER-02)

### 8.1 Context & Requirement
- **Gap Identifier:** `ARCH-WORKER-02`
- **Module Affected:** Worker Application Details (`WorkerApplicationDetailModal`), Workers Directory (`/workers`), Verification Executive Persona.
- **Workflow:** Verification Executives inspecting onboarding domestic workers require access to full registered mobile numbers and registered email addresses to perform telephonic verification calls, verify Aadhaar OTP receipts, and contact applicants for document re-submissions.
- **Security & PII Rules:**
  - Non-authorized roles (viewers, general staff lacking `verification.review` or `workers.manage`) must only see masked PII (e.g., `+91 98**** **12`).
  - Authorized Verification Executives (`verification.review` or `verification.document.view`) and Super Administrators must receive unmasked contact fields when returned by the backend.
  - The frontend MUST NOT guess, reconstruct, or fabricate contact numbers (e.g., regex replacement of masked strings is strictly prohibited).
  - Sensitive contact details must never be output to the browser console.

### 8.2 Endpoint & Contract Verification
- **Current Behavior:**
  - `GET /api/v1/admin/workers` and `GET /api/v1/admin/workers/{workerId}` currently provide only `phoneMasked` (e.g., `+91 98765 *****`).
  - The worker object omits an unmasked `phone` or `mobile` property even when the requesting session possesses `verification.review` and `verification.document.view`.
  - The worker registration object omits an explicit `email` field entirely.
- **Required Backend Behavior:**
  - When the caller's JWT includes `verification.review` or `workers.manage`:
    - `GET /api/v1/admin/workers/{workerId}` should return:
      ```json
      {
        "id": "W-10482",
        "phoneMasked": "+91 98765 *****",
        "phone": "+91 98765 43210",
        "mobile": "+91 98765 43210",
        "email": "sunita.devi@sevanest.worker"
      }
      ```
    - For callers lacking these authorities, the backend must continue to omit or nullify `phone`, `mobile`, and `email`, returning only `phoneMasked`.

### 8.3 Frontend Mitigation & Audit Alignment
- The frontend evaluates server-issued permissions (`VERIFICATION_REVIEW`, `VERIFICATION_DOCUMENT_VIEW`, or `WORKERS_MANAGE`).
- If unmasked contact fields are present in the response, they are rendered cleanly with verified indicators.
- If only `phoneMasked` is returned by the API, the frontend renders the masked string honestly with a note `(Full number restricted by backend response)` rather than reconstructing digits.

---

## 9. Unified Worker Application Review & Composite Decision Endpoint Gap (ARCH-VERIF-01)

### 9.1 Context & Requirement
- **Gap Identifier:** `ARCH-VERIF-01`
- **Module Affected:** Unified Worker Application Review (`WorkerApplicationDetailModal.tsx`), Workers Directory (`/workers`), Verification Operations.
- **Workflow:** The worker application review is unified into a single screen within the four-step application modal:
  1. **Step 1 — Applicant Details:** Core candidate information, skill categories, locality, contact details, and application metadata. Includes a "Complete KYC Review" CTA that directly activates Step 3 within the modal without changing the route.
  2. **Step 2 — Documents:** Submitted compliance documents and vault status inspection using secure signed URLs without leaving the modal.
  3. **Step 3 — KYC Verification:** Interactive check-level review for all 5 operational trust checks (Identity, Address, Emergency Contact, Employer Reference, Police Clearance) plus mobile OTP pre-check. Reviewer assignment is enforced (only claimed reviewer may approve/reject), real backend check IDs (`chk-*`) are used, check approvals validate prerequisites (e.g. CALL notes for employment, reference number and expiry for police clearance), and rejections require `reasonCode` and remarks.
  4. **Step 4 — Review & Decision:** Consolidated review summary showing completed/outstanding checks. When mandatory checks remain incomplete, final acceptance is strictly prevented.
- **Duplicate Navigation Removal:**
  - Removed all automatic redirects from `WorkerApplicationDetailModal.tsx` to `/verification?workerId=...`.
  - Stepper previous and next buttons advance between the 4 steps entirely within the modal.
  - The independent Verification Queue (`/verification`) is preserved for users navigating via the sidebar.

### 9.2 Endpoint & Contract Verification
- **Current Backend Contract:**
  - Check-level mutations are supported:
    - Claim: `POST /api/v1/admin/verification/checks/{checkId}/claim`
    - Approve: `POST /api/v1/admin/verification/checks/{checkId}/approve`
    - Reject: `POST /api/v1/admin/verification/checks/{checkId}/reject`
  - Document retrieval:
    - Signed URL: `GET /api/v1/admin/verification/documents/{documentId}/link`
  - Authoritative evaluation:
    - Dossier status & level: `GET /api/v1/admin/workers/{workerId}/verification`
- **Missing Composite Endpoint:**
  - There is NO composite application-level acceptance endpoint (e.g., `POST /api/v1/admin/workers/{id}/application/accept` or `POST /api/v1/admin/verification/applications/{id}/accept`).
  - No backend supervisor sign-off composite mutation is currently available.

### 9.3 Frontend Mitigation & Audit Alignment
- The frontend enforces all prerequisite compliance checks before enabling final decision states.
- If all 5 checks pass, Step 4 displays the readiness summary alongside an honest callout for Gap `ARCH-VERIF-01`, explaining that composite application-level acceptance is awaiting backend endpoint delivery.
- The portal does NOT simulate or fabricate a fake acceptance endpoint.
- Individual check approvals are never conflated with supervisor sign-off or commercial account activation (`worker.status = 'ACTIVE'`), which remains decoupled and managed under Operations Admin account controls.

---

## 10. Authentication Module Audit & Verification Supervisor Contract Gap (ARCH-AUTH-01)

### 10.1 Context & Scope
- **Gap Identifier:** `ARCH-AUTH-01`
- **Module Affected:** Authentication (`/auth/login`), Session Lifecycle, Storage Hygiene, RBAC (`AdminRole`), Staff Account Profile (`/account`).
- **Audit Findings Summary:**
  1. **Verification Supervisor Persona (`VERIFICATION_SUPERVISOR`):**
     - The product requirements and verification workflows specify a `VERIFICATION_SUPERVISOR` role for dossier oversight and final sign-off.
     - **Backend Contract Reality:** The deployed backend has no provisioned test accounts for `VERIFICATION_SUPERVISOR` in its PostgreSQL database seed, omits this role from the `/admin/roles` listing and OpenAPI role enum, and provides no supervisor-specific sign-off API endpoints.
     - **Frontend Audit Mitigation:** The frontend now fully recognizes `VERIFICATION_SUPERVISOR` in its domain types (`AdminRole`), maps backend aliases (`VERIF_SUPERVISOR`, `VERIFICATION_LEAD`), establishes baseline fail-closed permissions (`verification.review`, `verification.decide`, `verification.document.view`, `worker.view`, `customer.view`), maps landing route directly to `/verification`, and routes dashboard to `VerificationExecutiveDashboard`.
  2. **Multi-Tab Session Synchronization:**
     - The frontend coordinates session state across browser tabs via `BroadcastChannel('sevanest_auth_sync')` and `navigator.locks`.
     - When a user logs out in one tab, a `LOGOUT` broadcast message is dispatched to immediately clear local session state across all open tabs.
  3. **Cross-Session Query Cache Purging:**
     - When an administrator signs out, TanStack Query's cache (`queryClient.clear()`) is explicitly purged alongside `clearStoredRefreshToken()` and Zustand memory state to guarantee zero data leakage between different users or roles sharing the same browser.
  4. **Access & Token Storage Security:**
     - Access tokens are held exclusively in-memory (Zustand state) and are never written to `localStorage` or `sessionStorage`.
     - Only the single rotating refresh token is persisted in `localStorage` under key `sevanest_refresh_token` to support browser refresh rehydration (`restoreSession()`).
     - Passwords and raw credentials are never persisted and are cleared immediately upon failed submission.
  5. **Server-Side Token Revocation & Logout Limitation:**
     - While `POST /api/v1/auth/logout` is dispatched on sign-out, server-side JWT invalidation / refresh token blacklisting on the backend Redis store cannot be authoritatively verified due to missing live administrative credentials.
  6. **Live Environment Credential Blocker:**
     - Submitting login requests against `https://sevanest-backend.onrender.com/api/v1/auth/admin/login` continues to return `401 INVALID_CREDENTIALS` because the remote database contains no seeded administrative accounts. Repeated attempts trigger `429 ADMIN_LOGIN_LOCKED`.
     - Direct browser calls without proxy encounter CORS failures on `OPTIONS` preflight requests because the backend only whitelists `http://localhost:3000`.

---

### 10.2 Security Review: Storing Refresh Token in `localStorage` vs. `HttpOnly` Cookies

#### A. Threat Vector Analysis of `localStorage`
1. **Cross-Site Scripting (XSS) Token Exfiltration:**
   - `localStorage` is completely accessible to any JavaScript executing in the origin context (`window.localStorage.getItem(...)`).
   - If an XSS vulnerability exists anywhere in the portal (e.g., unsanitized customer/worker notes, third-party CDN script compromise, or vulnerable npm dependencies), an attacker script can read `sevanest_refresh_token` and exfiltrate it to an external server.
   - Using the exfiltrated refresh token, the attacker can indefinitely mint new access tokens through `POST /api/v1/auth/token/refresh` until the token expires or is manually revoked.
2. **Persistence Across Browser Sessions & Workstation Exposure:**
   - `localStorage` data persists indefinitely on disk across browser closures and system restarts until programmatically removed.
   - On shared administrative workstations or kiosks in operations centers, if staff members close the tab or window without explicitly clicking "Sign Out", the refresh token remains intact in the browser profile.
3. **Absence of Scoping and Flag Controls:**
   - Unlike HTTP cookies, `localStorage` lacks security attributes such as `HttpOnly` (blocking JavaScript access), `SameSite` (preventing cross-origin request inclusion), `Secure` (forcing HTTPS), and `Path` (restricting transmission to auth endpoints).

#### B. Current Client-Side Mitigations Implemented in SevaNest
- **In-Memory Access Tokens:** The short-lived `accessToken` is stored exclusively in Zustand memory and is never written to `localStorage`, `sessionStorage`, or IndexedDB.
- **Refresh Token Rotation (RTR):** Every successful refresh request issues a new refresh token and replaces the existing stored token.
- **Concurrency Serialization via Web Locks:** Cross-tab refresh calls are serialized using `navigator.locks.request('sevanest_refresh_token_lock')` to prevent race conditions from invalidating rotating tokens.
- **Synchronized Multi-Tab Logout:** Logging out in one tab sends a `LOGOUT` broadcast message across `BroadcastChannel('sevanest_auth_sync')`, immediately clearing the token from `localStorage` in all tabs.
- **Client Cache Purging:** `queryClient.clear()` is called on logout to wipe all cached PII and business records from TanStack Query memory.

#### C. Safest Compatible Approach Recommendation (Action for Backend Team)
The industry gold standard and safest approach for single-page applications is **`HttpOnly` + `Secure` + `SameSite=Strict` Cookie with Path Restriction**:
1. **Cookie Configuration:**
   - The backend sets the refresh token in a response cookie:
     ```http
     Set-Cookie: sevanest_refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/; Max-Age=604800
     ```
2. **Security Benefits:**
   - **Immune to XSS Token Theft:** JavaScript running in the browser cannot read, copy, or exfiltrate the cookie.
   - **Path Restriction:** The browser only sends the cookie to `/api/v1/auth/*` endpoints, preventing exposure to general API calls.
   - **CSRF Protection:** `SameSite=Strict` guarantees the cookie is never sent in cross-site contexts.
3. **Backward-Compatible Migration Strategy:**
   - **Phase 1 (Dual Support on Backend):** Update `POST /api/v1/auth/token/refresh` to check for `refreshToken` in incoming cookies (`req.cookies.sevanest_refresh_token`) OR fallback to the JSON request body (`req.body.refreshToken`).
   - **Phase 2 (Cookie Support on Frontend):** Add `withCredentials: true` to `httpClient` calls targeting `/auth/*`.
   - **Phase 3 (Deprecate LocalStorage):** Remove `setStoredRefreshToken()` and `getStoredRefreshToken()` from frontend code once cookie-based refresh is operational.

---

### 10.3 Backend Dependencies Verification & Live Probe Evidence

#### 1. Admin Test Accounts
- **Live Probe:** `POST /api/v1/auth/admin/login` against `https://sevanest-backend.onrender.com`.
- **Observed Response:** `HTTP 401 Unauthorized`:
  ```json
  {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "requestId": "8f159d95-f09e-49a4-a03b-e2ed507fbcaa"
  }
  ```
- **Rate-Limiter Lockout:** Repeated attempts trigger `HTTP 429 Too Many Requests`:
  ```json
  {
    "code": "ADMIN_LOGIN_LOCKED",
    "message": "Too many failed login attempts. Please try again later."
  }
  ```
- **Finding:** No test accounts are seeded in the remote PostgreSQL database on Render for any administrative persona.

#### 2. Verification Supervisor Role & API Contracts
- **Live Probe:** `GET /api/v1/admin/roles` returns `HTTP 401 Unauthorized` without credentials.
- **Contract Inspection:** The OpenAPI specification defines four roles: `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `VERIFICATION_EXECUTIVE`, and `SUPPORT_EXECUTIVE`. The role `VERIFICATION_SUPERVISOR` is absent from backend database schema enums and permission sets.
- **API Gap:** No composite supervisor sign-off endpoint (e.g. `POST /api/v1/admin/verification/applications/{id}/supervisor-sign-off`) exists on the backend.

#### 3. CORS Configuration on Live Render Backend
- **Live Probe with Origin `http://localhost:3000`:**
  ```http
  OPTIONS /api/v1/auth/admin/login HTTP/1.1
  Host: sevanest-backend.onrender.com
  Origin: http://localhost:3000
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: Content-Type,Authorization

  HTTP/1.1 204 No Content
  access-control-allow-origin: http://localhost:3000
  access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
  access-control-allow-headers: Content-Type,Authorization
  ```
- **Live Probe with Origin `http://localhost:8080` (Docker Environment):**
  ```http
  OPTIONS /api/v1/auth/admin/login HTTP/1.1
  Host: sevanest-backend.onrender.com
  Origin: http://localhost:8080
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: Content-Type,Authorization

  HTTP/1.1 204 No Content
  (Header access-control-allow-origin is completely missing)
  ```
- **Live Probe with Origin `https://admin.sevanest.in` (Production Domain):**
  ```http
  OPTIONS /api/v1/auth/admin/login HTTP/1.1
  Host: sevanest-backend.onrender.com
  Origin: https://admin.sevanest.in

  HTTP/1.1 204 No Content
  (Header access-control-allow-origin is completely missing)
  ```
- **Finding:** The NestJS backend `app.enableCors()` configuration hardcodes only `http://localhost:3000`. Direct cross-origin browser requests from port 8080 or the production domain are terminated by the browser with CORS policy errors. (The Docker environment functions solely because Nginx acts as a same-origin reverse proxy for `/api/v1`).

#### 4. Server-Side Logout & Token Revocation
- **Live Probe:** `POST /api/v1/auth/logout` returns `HTTP 401 Unauthorized` (`UNAUTHENTICATED`, `"Authentication is required"`).
- **Finding:** The endpoint is implemented and requires a valid Bearer token. However, server-side Redis token blacklisting cannot be verified until valid admin accounts are seeded.

---

### 10.4 Required Actions for Backend Team

#### Action 1: Seed Administrative Accounts in PostgreSQL Database
Run a database migration or seed script to populate test administrative accounts for each required persona:
```sql
-- Seed Admin Personas in PostgreSQL (with bcrypt password hash for 'Admin@12345')
INSERT INTO admin_users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at)
VALUES
  ('adm-super-01', 'super.admin@sevanest.internal', '$2b$12$e8J3mK...', 'Super', 'Admin', 'SUPER_ADMIN', 'ACTIVE', NOW(), NOW()),
  ('adm-oper-01', 'operations.admin@sevanest.internal', '$2b$12$e8J3mK...', 'Operations', 'Admin', 'OPERATIONS_ADMIN', 'ACTIVE', NOW(), NOW()),
  ('adm-verif-exec-01', 'verification.executive@sevanest.internal', '$2b$12$e8J3mK...', 'Verification', 'Executive', 'VERIFICATION_EXECUTIVE', 'ACTIVE', NOW(), NOW()),
  ('adm-verif-sup-01', 'verification.supervisor@sevanest.internal', '$2b$12$e8J3mK...', 'Verification', 'Supervisor', 'VERIFICATION_SUPERVISOR', 'ACTIVE', NOW(), NOW()),
  ('adm-supp-01', 'support.executive@sevanest.internal', '$2b$12$e8J3mK...', 'Support', 'Executive', 'SUPPORT_EXECUTIVE', 'ACTIVE', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE';
```

#### Action 2: Extend CORS Whitelist in NestJS `main.ts`
Update CORS configuration in the backend NestJS application to accept all official admin origins:
```typescript
// backend/src/main.ts
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'https://admin.sevanest.in',
  'https://staging-admin.sevanest.in',
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Correlation-ID',
    'X-Request-Id',
    'Accept',
  ],
  exposedHeaders: ['X-Request-Id', 'Content-Range', 'ETag'],
});
```

#### Action 3: Add `VERIFICATION_SUPERVISOR` to Role Enums and Permission Matrix
1. Add `VERIFICATION_SUPERVISOR` to the `admin_role` database enum and NestJS `AdminRole` TypeScript enum.
2. Grant the supervisor persona the following permissions:
   - `verification.review`
   - `verification.decide`
   - `verification.document.view`
   - `worker.view`
   - `customer.view`
   - `audit.view`
3. Expose the role in `GET /api/v1/admin/roles`.

#### Action 4: Implement `HttpOnly` Cookie Delivery for Refresh Tokens
Update `POST /api/v1/auth/admin/login` and `POST /api/v1/auth/token/refresh`:
```typescript
// backend/src/auth/auth.controller.ts
@Post('admin/login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const result = await this.authService.login(dto);
  
  // Set HttpOnly refresh token cookie
  res.cookie('sevanest_refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return {
    user: result.user,
    accessToken: result.accessToken,
    // Keep refreshToken in response body during transition period
    refreshToken: result.refreshToken,
  };
}
```

#### Action 5: Verify Server-Side Token Blacklisting on `POST /api/v1/auth/logout`
Ensure `POST /api/v1/auth/logout`:
1. Extracts the Bearer token from the `Authorization` header and places its `jti` in a Redis blacklist with a TTL matching remaining token validity.
2. Invalidates the active refresh token family associated with the session.
3. Clears the `sevanest_refresh_token` cookie by setting `Max-Age: 0`.

---

### 10.5 Comprehensive Verification Checklist for Live Authentication Testing

Once the backend team delivers Actions 1–5, execute the following exhaustive validation protocol:

| Phase | Test Scenario | Steps | Expected Result | Status |
|---|---|---|---|---|
| **Phase 1: Preflight & CORS** | Direct CORS Preflight from Port 8080 | `OPTIONS https://sevanest-backend.onrender.com/api/v1/auth/admin/login` with `Origin: http://localhost:8080` | `HTTP 204 No Content` with `Access-Control-Allow-Origin: http://localhost:8080` | Pending Backend Action 2 |
| **Phase 1: Preflight & CORS** | Direct CORS Preflight from Production Domain | `OPTIONS ...` with `Origin: https://admin.sevanest.in` | `HTTP 204 No Content` with `Access-Control-Allow-Origin: https://admin.sevanest.in` | Pending Backend Action 2 |
| **Phase 2: Live Login & Routing** | Super Admin Login | Submit valid credentials for `super.admin@sevanest.internal` | Authenticated; access token stored in-memory; landing route redirects to `/dashboard`; all admin sections visible | Pending Backend Action 1 |
| **Phase 2: Live Login & Routing** | Operations Admin Login | Submit valid credentials for `operations.admin@sevanest.internal` | Authenticated; landing route redirects to `/dashboard`; operations navigation active | Pending Backend Action 1 |
| **Phase 2: Live Login & Routing** | Verification Executive Login | Submit valid credentials for `verification.executive@sevanest.internal` | Authenticated; landing route redirects to `/verification`; customer directory accessible read-only | Pending Backend Action 1 |
| **Phase 2: Live Login & Routing** | Verification Supervisor Login | Submit valid credentials for `verification.supervisor@sevanest.internal` | Authenticated; landing route redirects to `/verification`; executive dashboard displayed; supervisory permissions applied | Pending Backend Action 1 & 3 |
| **Phase 2: Live Login & Routing** | Support Executive Login | Submit valid credentials for `support.executive@sevanest.internal` | Authenticated; landing route redirects to `/support`; support navigation active | Pending Backend Action 1 |
| **Phase 3: Session Lifecycle** | Automatic Token Refresh | Await access token expiration or simulate 401 response on protected endpoint | Interceptor calls `POST /api/v1/auth/token/refresh` with rotating token; original request re-executed transparently | Pending Backend Action 1 |
| **Phase 3: Session Lifecycle** | Browser Page Reload Deep-Link Retention | Navigate to `/workers?status=PENDING_REVIEW`, press F5 / reload browser | Session restored via `restoreSession()`; user stays on `/workers?status=PENDING_REVIEW` without redirect to login | Pending Backend Action 1 |
| **Phase 4: Concurrency & Sync** | Cross-Tab Refresh Serialization | Trigger simultaneous API calls across multiple open browser tabs | Web Locks serialize refresh; exactly one refresh HTTP request is sent; all tabs receive fresh tokens | Pending Backend Action 1 |
| **Phase 4: Concurrency & Sync** | Synchronized Multi-Tab Sign-Out | Click "Sign Out" in Tab 1 | Tab 1 logs out; Tab 2 and Tab 3 receive `LOGOUT` broadcast message and immediately transition to login screen | Pending Backend Action 1 |
| **Phase 5: Storage & Cache Hygiene** | Query Cache Purged on Logout | Inspect TanStack Query cache via React Query DevTools after sign-out | Cache is completely empty (`queryClient.clear()` called); zero stale user data retained | Verified in automated suite; live check pending Action 1 |
| **Phase 5: Storage & Cache Hygiene** | In-Memory Token Wiping | Check `localStorage` and `sessionStorage` after sign-out | `sevanest_refresh_token` removed; no access tokens in any storage mechanism | Verified in automated suite; live check pending Action 1 |
| **Phase 6: Edge Cases & Security** | Invalid Password Rejection | Submit invalid password for valid email | HTTP 401 handled; error alert displayed; password input cleared; no tokens stored | Verified in automated suite; live check pending Action 1 |
| **Phase 6: Edge Cases & Security** | Rate Limiting Lockout | Submit 5 consecutive incorrect passwords | HTTP 429 handled; "Too many failed login attempts" displayed; form locked | Verified in automated suite & live probe |
| **Phase 6: Edge Cases & Security** | Fail-Closed Unauthorized Role | Backend returns unexpected role string (e.g. `UNKNOWN_ROLE`) | Rejected with domain error; session not established; user not redirected | Verified in automated suite |
| **Phase 6: Edge Cases & Security** | Server-Side Revocation Verification | Call `POST /api/v1/auth/logout`, then attempt to use previous access token or refresh token | Backend returns `401 Unauthorized` (`TOKEN_REVOKED`); token successfully invalidated in Redis | Pending Backend Action 1 & 5 |

---

## 11. Dashboard Module Audit & PRD Category Integration Gaps (GAP-DASH-01)

### 11.1 Context & PRD Scope
- **Gap Identifier:** `GAP-DASH-01` (comprising `GAP-DASH-01` through `GAP-DASH-06` and `ARCH-DASH-01`)
- **Module Affected:** Admin Dashboard (`/dashboard`), Executive Overview, Operations Workstation, Verification Workstation, Support Workstation.
- **PRD Reference:** `SevaNest_PRD.pdf` Section 7 ("Admin & Operations Portal") and Section 3 ("Users, Roles & Personas").
- **Mandatory PRD Section 7 Categories:**
  1. **Bookings**
  2. **Active workers**
  3. **Pending KYC**
  4. **Complaints**
  5. **Replacements**
  6. **Collections**
- **Canonical Admin Roles:** Super Admin, Operations Admin, Verification Executive, Support Executive. (Note: `VERIFICATION_SUPERVISOR` is explicitly excluded from the Dashboard router in compliance with PRD Section 3).

---

### 11.2 Root Dashboard Endpoint & RBAC Authorization (`ARCH-DASH-01`)

- **Primary Endpoint:** `GET /api/v1/admin/dashboard`
- **HTTP Method:** `GET`
- **Observed Behavior (Unauthenticated):**
  - Status: `HTTP 401 Unauthorized`
  - Body:
    ```json
    {
      "code": "UNAUTHENTICATED",
      "message": "Authentication is required",
      "requestId": "2f42a9b2-3c81-42cb-bbf1-81729b1d5c22"
    }
    ```
- **Permission Matrix & RBAC Access:**
  - The endpoint is protected by backend permission guard `dashboard.view`.
  - In the backend permission model, only `SUPER_ADMIN` and `OPERATIONS_ADMIN` hold `dashboard.view`.
  - When `VERIFICATION_EXECUTIVE` or `SUPPORT_EXECUTIVE` personas call `/api/v1/admin/dashboard`, the backend returns `HTTP 403 Forbidden` (`FORBIDDEN`).
  - **Frontend Architecture Alignment:** The frontend preserves this server-side authorization model without weakening checks. It directs `VERIFICATION_EXECUTIVE` to `/verification` and `SUPPORT_EXECUTIVE` to `/support`, rendering dedicated role-specific operational workstations rather than unauthorized root dashboard queries.
- **Observed Schema of Live Backend Endpoint:**
  - The root `DashboardSummaryResponseDto` returns only high-level top-level counters:
    ```json
    {
      "totalUsers": 1420,
      "activeWorkers": 312,
      "pendingVerifications": 48,
      "activeBookings": 89
    }
    ```
  - It completely lacks granular `sections` for financial collections, complaint statistics, replacement counts, booking stage breakdowns, and workforce status breakdowns unless the backend populates the optional `sections` envelope.

---

### 11.3 Category-by-Category Contract Gaps & Analysis

#### Category 1: Bookings (`GAP-DASH-01`)
1. **Metric/Category:** Bookings (Gross Bookings, New Booking Requests, Awaiting Matching, Scheduled Trials Today, Awaiting Confirmation, Active Live Engagements, Cancellations, Completed).
2. **Existing Endpoint:** `GET /api/v1/admin/dashboard` returns flat counter `activeBookings`.
3. **Actual Observed Behavior:** The backend provides only `activeBookings`. Gross bookings (lifetime volume), trial booking counts, matching queue counts, and stage-wise breakdowns are absent from the summary. Operations Admin workstation falls back to fetching paginated raw bookings from `GET /api/v1/bookings` with client-side status filters, which does not scale for platform-wide metrics.
4. **Expected PRD Requirement:** PRD §7 explicitly mandates comprehensive bookings oversight across all operational stages.
5. **Exact Missing Contract Details:**
   Backend must populate `sections.bookings` in `GET /api/v1/admin/dashboard`:
   ```json
   {
     "bookings": {
       "total": 1250,
       "active": 89,
       "pendingMatch": 24,
       "scheduledTrials": 12,
       "awaitingConfirmation": 8,
       "cancelled": 35,
       "completed": 1082
     }
   }
   ```
6. **Status:** Confirmed backend contract gap.
7. **Frontend Handling:** `RealDashboardRepository` checks for `sections.bookings`. When absent, `activeBookings` is displayed on the primary KPI card, while unsupplied granular counters render an honest unavailable indicator (`—`) with an explanatory subtitle ("Data unavailable from backend"). Zero values (0) are preserved as valid genuine figures.
8. **Required Backend Action:** Add aggregate counts to `GET /api/v1/admin/dashboard` under `sections.bookings` or expose a dedicated summary endpoint `GET /api/v1/bookings/summary`.
9. **Frontend Impact:** Non-blocking; UI renders gracefully without fabricating numbers.

---

#### Category 2: Active Workers (`GAP-DASH-02`)
1. **Metric/Category:** Active Workers (Verified & Active Workforce vs. Total Registered vs. Suspended/Police Verification Due).
2. **Existing Endpoint:** `GET /api/v1/admin/dashboard` returns `activeWorkers`.
3. **Actual Observed Behavior:** The backend returns integer `activeWorkers`. However, the exact semantic definition (whether "active" means KYC verified + commercially active, or simply non-deleted worker accounts, or workers currently on assignment) is not documented. Registered worker totals and police verification due counts are absent from the root summary.
4. **Expected PRD Requirement:** PRD §7 and §9 mandate tracking verified active household workforce distinct from applicants awaiting KYC or workers under suspension.
5. **Exact Missing Contract Details:**
   Document formal SQL filter criteria for `activeWorkers` and populate `sections.workers` in `GET /api/v1/admin/dashboard`:
   ```json
   {
     "workers": {
       "registered": 680,
       "verifiedAndActive": 312,
       "policeVerifDue": 18,
       "suspended": 4
     }
   }
   ```
6. **Status:** Confirmed contract gap & semantic clarification required.
7. **Frontend Handling:** `activeWorkers` is mapped directly to the primary KPI card. Secondary metrics (total registered, police verification due) display `—` when omitted.
8. **Required Backend Action:** Clarify status filter used for `activeWorkers` (`status = 'ACTIVE' AND kyc_status = 'VERIFIED'`) and include `sections.workers` in response.
9. **Frontend Impact:** Non-blocking; metric accurately reflects backend response.

---

#### Category 3: Pending KYC (`GAP-DASH-03`)
1. **Metric/Category:** Pending KYC (Workers awaiting verification, pipeline split: Documents Submitted, In Review, Recheck Due, Police Verification Pending).
2. **Existing Endpoint:** `GET /api/v1/admin/dashboard` returns `pendingVerifications`. Verification Executive uses `GET /api/v1/admin/verification/queue`.
3. **Actual Observed Behavior:** The root dashboard returns a single scalar `pendingVerifications`. Granular pipeline stage counts (`SUBMITTED`, `IN_REVIEW`, `RECHECK_DUE`) are missing from the summary response. Full PII must remain excluded from dashboard overviews.
4. **Expected PRD Requirement:** PRD §7 and §9 mandate visibility into pending verification queues without exposing sensitive identity documents.
5. **Exact Missing Contract Details:**
   Backend must populate `sections.verification` in `GET /api/v1/admin/dashboard`:
   ```json
   {
     "verification": {
       "totalPending": 48,
       "submitted": 28,
       "inReview": 15,
       "recheckDue": 5
     }
   }
   ```
6. **Status:** Confirmed contract gap.
7. **Frontend Handling:** Super Admin and Operations Admin display `pendingVerifications` in the primary KPI card. Verification Executive workstation derives queue tab metrics directly from `GET /api/v1/admin/verification/queue`. Missing stage splits render `—`.
8. **Required Backend Action:** Include `sections.verification` pipeline aggregation in `GET /api/v1/admin/dashboard`.
9. **Frontend Impact:** Non-blocking; verification queue workflows operate via their dedicated endpoints.

---

#### Category 4: Complaints (`GAP-DASH-04`)
1. **Metric/Category:** Complaints & Grievances (Active Grievances, Open, In Progress, Escalated, SLA Breached).
2. **Existing Endpoint:** `GET /api/v1/admin/dashboard` completely omits complaint/grievance fields. Support Executive queries `GET /api/v1/admin/support/tickets`.
3. **Actual Observed Behavior:** The live backend root dashboard summary contains zero fields for customer or worker complaints. When `sections.support` is missing, `RealDashboardRepository` attempts an authorized secondary call to `/admin/support/tickets` metadata or safely returns `undefined`.
4. **Expected PRD Requirement:** PRD §7 and §14 require centralized complaint tracking and dispute resolution monitoring.
5. **Exact Missing Contract Details:**
   Backend must include support ticket aggregation in `GET /api/v1/admin/dashboard`:
   ```json
   {
     "support": {
       "activeGrievances": 14,
       "open": 8,
       "inProgress": 4,
       "escalated": 2,
       "slaBreached": 1
     }
   }
   ```
6. **Status:** Confirmed missing contract on root dashboard.
7. **Frontend Handling:** Super Admin dashboard displays `—` with subtitle "Data unavailable from backend" when complaints data is absent, avoiding any fabricated zero or mock numbers. Support Executive manages tickets directly on `/support`.
8. **Required Backend Action:** Add support ticket aggregation to `GET /api/v1/admin/dashboard` under `sections.support` or provide `GET /api/v1/admin/support/summary`.
9. **Frontend Impact:** Non-blocking; honest unavailable indicator prevents data fabrication.

---

#### Category 5: Replacements (`GAP-DASH-05`)
1. **Metric/Category:** Replacements (Requested, In Matching, Approved, Completed under warranty).
2. **Existing Endpoint:** No replacement summary exists in `GET /api/v1/admin/dashboard`.
3. **Actual Observed Behavior:** The backend does not aggregate replacement events in the dashboard summary.
4. **Expected PRD Requirement:** PRD §7 explicitly lists "Replacements" as one of the six mandatory Admin Portal dashboard categories, reflecting the SevaNest guarantee (1-2 free replacements within the warranty period).
5. **Exact Missing Contract Details:**
   Backend must deliver replacement aggregations under `sections.replacements`:
   ```json
   {
     "replacements": {
       "requested": 6,
       "inMatching": 4,
       "approved": 2,
       "completed": 18
     }
   }
   ```
6. **Status:** Confirmed missing contract.
7. **Frontend Handling:** Super Admin and Operations Admin dashboards render `—` for replacement volume when omitted by the backend. No synthetic replacement counts are generated.
8. **Required Backend Action:** Provide replacement lifecycle metrics in `GET /api/v1/admin/dashboard` under `sections.replacements` or via `GET /api/v1/admin/replacements/summary`.
9. **Frontend Impact:** Non-blocking; clear indicator communicates missing backend data.

---

#### Category 6: Collections (`GAP-DASH-06`)
1. **Metric/Category:** Collections (Gross Collections INR, Placement Fees, Booking Charges, Month-to-Date Collections, Today's Collections, Pending Refunds).
2. **Existing Endpoint:** `GET /api/v1/admin/dashboard` lacks financial fields.
3. **Actual Observed Behavior:** The backend provides no monetary or collections information in the root dashboard summary. Ineligible, cancelled, or refunded transactions must not be conflated with genuine collections.
4. **Expected PRD Requirement:** PRD §7 mandates Collections tracking; PRD §14 defines financial reporting and revenue recognition in INR.
5. **Exact Missing Contract Details:**
   Backend must deliver financial aggregations under `sections.revenue` restricted to authorized roles (`SUPER_ADMIN`, `OPERATIONS_ADMIN`), with explicit currency and unit definitions:
   ```json
   {
     "revenue": {
       "grossCollectionsINR": 2450000.00,
       "mtdCollectionsINR": 485000.00,
       "todayCollectionsINR": 32000.00,
       "pendingRefundsINR": 15000.00,
       "currency": "INR",
       "unit": "rupees"
     }
   }
   ```
6. **Status:** Confirmed missing contract.
7. **Frontend Handling:** `RealDashboardRepository` safely formats currency in Indian Rupees (`formatCurrencyINR`) when provided. When omitted, revenue metrics display `—` with "Data unavailable from backend". Genuine zero amounts (₹0.00) are correctly preserved and displayed.
8. **Required Backend Action:** Implement financial summary aggregation in `GET /api/v1/admin/dashboard` under `sections.revenue`, ensuring calculations exclude failed/cancelled transactions.
9. **Frontend Impact:** Non-blocking; financial cards gracefully render honest unavailable states without guessing.

---

### 11.4 Backend Action Plan & Priorities for Dashboard Completion

| Priority | Action Item | Target API Endpoint | Impact |
|---|---|---|---|
| **P1** | **Seed Admin Test Credentials in Remote DB** | `POST /api/v1/auth/admin/login` | Unblocks live end-to-end browser login and live dashboard data fetching |
| **P1** | **Deliver Collections & Revenue Aggregation** | `GET /api/v1/admin/dashboard` (`sections.revenue`) | Resolves PRD §7 Collections requirement |
| **P2** | **Deliver Support Complaints Aggregation** | `GET /api/v1/admin/dashboard` (`sections.support`) | Resolves PRD §7 Complaints requirement |
| **P2** | **Deliver Replacement Aggregation** | `GET /api/v1/admin/dashboard` (`sections.replacements`) | Resolves PRD §7 Replacements requirement |
| **P2** | **Deliver Granular Booking Stage Splits** | `GET /api/v1/admin/dashboard` (`sections.bookings`) | Resolves PRD §7 Bookings granular visibility |
| **P3** | **Deliver Granular Verification Stage Splits** | `GET /api/v1/admin/dashboard` (`sections.verification`) | Resolves PRD §7 Pending KYC granular breakdown |

---

## 12. Worker Management Module Audit & PRD Capability Gaps (GAP-WRK-01 to GAP-WRK-06)

### 12.1 Overview & PRD Alignment
PRD §7 explicitly defines the six mandatory capabilities of the Worker Management module:
1. **Profiles:** Comprehensive domestic worker profiles including personal details, verified identity, contact information (with strict PII masking), household experience, service radius, and operational locality.
2. **Documents:** KYC compliance document metadata, vault inspection, masked document numbers, secure signed-URL access, and role-based document access controls.
3. **Availability:** Explicit allocation availability and matching eligibility (`isFullyVerified && status === 'ACTIVE'`), distinct from account status or login activity.
4. **Skills:** Primary and secondary service categories, skill competencies chips, languages spoken, and experience duration.
5. **Rating:** Genuine average rating scale, star representation, review counts, completed/active operational engagements, and sortability.
6. **Blacklist/Status:** Clear separation of account lifecycle states (`ACTIVE`, `SUSPENDED`, `BLACKLISTED`) from KYC verification statuses (`PENDING`, `IN_REVIEW`, `VERIFIED`, `REJECTED`, `RECHECK_DUE`), with audited disciplinary actions requiring mandatory operational remarks.

### 12.2 Detailed Gap Register

#### GAP-WRK-01: Server-Side Query Filtering, Sorting & Pagination Contract
1. **Capability Affected:** Profiles, Availability, Skills, Ratings.
2. **Existing Endpoint:** `GET /api/v1/admin/workers`
3. **Actual Observed Behavior:** The endpoint returns `401 Unauthorized` without credentials. In codebase inspection and OpenAPI docs, supported query parameters are partially specified. Client-side filtering and sorting currently acts as an interim safety net.
4. **Expected PRD Requirement:** PRD §7 mandates efficient workforce catalog discovery across service categories, operational clusters, verification states, and ratings.
5. **Missing/Mismatched Contract Details:**
   Document and support standard query parameters:
   - `search`: Substring search across worker name, worker ID, primary category, locality.
   - `category`: Service category filter (e.g., `COOK`, `HOUSE_MAID`, `ELDER_CARE`).
   - `verificationStatus`: Verification pipeline filter (`ALL`, `VERIFIED`, `PENDING`, `IN_REVIEW`, `REJECTED`, `RECHECK_DUE`).
   - `status`: Account lifecycle state (`ALL`, `ACTIVE`, `SUSPENDED`, `BLACKLISTED`).
   - `locality`: Operating cluster / geographic locality.
   - `sortField` & `sortOrder`: Sorting by `ratingAverage`, `experienceYears`, `name`, `id` in `asc` or `desc`.
   - `page` & `limit`: Standard 1-indexed pagination envelopes (`items`, `totalCount`, `page`, `pageSize`).
6. **Required Backend Action:** Implement and document standard pagination and query filtering in `GET /api/v1/admin/workers`.
7. **Frontend Impact:** Non-blocking; frontend currently supports both server envelopes and client-side fallback sorting/pagination.
8. **Status:** Confirmed contract clarification required.

---

#### GAP-WRK-02: Authoritative Document Metadata in Worker Detail Payloads
1. **Capability Affected:** Documents & KYC.
2. **Existing Endpoint:** `GET /api/v1/admin/workers/{workerId}`
3. **Actual Observed Behavior:** In some responses, document items omit explicit `documentId` or provide synthetic IDs, complicating direct vault inspection links.
4. **Expected PRD Requirement:** PRD §7 and §9 require complete document vault tracking (Document Type, Masked ID, Verification State, Submission Timestamp, and Signed URL inspection).
5. **Missing/Mismatched Contract Details:**
   Ensure `GET /api/v1/admin/workers/{workerId}` consistently returns a structured `documents` array:
   ```json
   {
     "documents": [
       {
         "id": "doc-aadhaar-01",
         "documentTypeName": "Aadhaar Card",
         "docNumberMasked": "XXXX-XXXX-8921",
         "status": "VERIFIED",
         "submittedAt": "2026-10-20T10:30:00Z",
         "mimeType": "application/pdf"
       }
     ]
   }
   ```
6. **Required Backend Action:** Ensure worker detail responses return the canonical `documents` array with authoritative document IDs.
7. **Frontend Impact:** Resolved on frontend; eliminated synthetic document generation when backend returns no documents, rendering a clean empty state in the documents vault table.
8. **Status:** Confirmed contract gap.

---

#### GAP-WRK-03: Unmasked Contact PII Disclosure Policy & Dedicated Audit Event
1. **Capability Affected:** Profiles & Security.
2. **Existing Endpoint:** `GET /api/v1/admin/workers/{workerId}`
3. **Actual Observed Behavior:** The endpoint returns only `phoneMasked` (`+91 98765 *****`). Raw unmasked numbers (`phone`, `mobile`, `email`) are omitted even for authorized Verification Executives and Super Admins.
4. **Expected PRD Requirement:** PRD §7, §9, and §13 require restricted unmasked PII access for authorized verification calls and document re-submission follow-ups, with complete audit logging.
5. **Missing/Mismatched Contract Details:**
   - Supply unmasked `phone`, `mobile`, and `email` only when caller possesses `verification.review`, `verification.document.view`, or `workers.manage`.
   - Backend must emit a server-side audit event `WORKER_CONTACT_UNMASKED` recording `{ adminUserId, workerId, timestamp, ipAddress }`.
   - Never supply unmasked PII in worker roster listings (`GET /api/v1/admin/workers`).
6. **Required Backend Action:** Implement selective PII unmasking based on server-issued JWT authorities and add server-side audit event dispatch.
7. **Frontend Impact:** Resolved on frontend; the UI never reconstructs or synthesizes fake contact digits, rendering genuine unmasked values only when supplied by the backend and authorized.
8. **Status:** Confirmed contract gap (extends `ARCH-WORKER-02`).

---

#### GAP-WRK-04: Commercial Account Status Transition Semantics & Disciplinary Audit
1. **Capability Affected:** Blacklist/Status.
2. **Existing Endpoint:** `PATCH /api/v1/admin/workers/{workerId}` or `PUT /api/v1/admin/workers/{workerId}/status`
3. **Actual Observed Behavior:** Status mutations accept `status` (`ACTIVE`, `SUSPENDED`, `BLACKLISTED`) and `remarks`. However, backend state-machine transition guardrails are not formally documented.
4. **Expected PRD Requirement:** PRD §7 and §9 require strict decoupling of KYC verification from commercial activation. A worker cannot be transitioned to `ACTIVE` unless KYC status is `VERIFIED`. Blacklisting is permanent and revokes platform matching.
5. **Missing/Mismatched Contract Details:**
   - Backend must return `409 Conflict` (`KYC_INCOMPLETE`) if caller attempts to set `status = 'ACTIVE'` while verification is `PENDING`, `IN_REVIEW`, or `REJECTED`.
   - Mandatory operational remarks (minimum 5 characters) must be persisted in an immutable administrative audit log (`admin_audit_logs`).
   - Only `SUPER_ADMIN` and `OPERATIONS_ADMIN` may execute disciplinary status mutations.
6. **Required Backend Action:** Validate state-machine prerequisites on status mutations and persist operational remarks to the audit ledger.
7. **Frontend Impact:** Resolved on frontend; dedicated "Discipline" (Suspend) and "Blacklist" actions enforce mandatory operational remarks and confirmation checkboxes before dispatching mutations.
8. **Status:** Confirmed contract gap.

---

#### GAP-WRK-05: Dedicated Multi-Category Management Contract
1. **Capability Affected:** Skills & Categories.
2. **Existing Endpoint:** `PUT /api/v1/admin/workers/{workerId}/categories` or `PATCH /api/v1/admin/workers/{workerId}`
3. **Actual Observed Behavior:** Worker details include primary `category` and optional `categories` array. A dedicated multi-category management endpoint is not formally documented in OpenAPI.
4. **Expected PRD Requirement:** PRD §6 and §7 allow domestic workers to register across multiple household skill categories (e.g. Cook + House Maid). Operations Admins need to adjust assigned categories based on verified skill competency.
5. **Missing/Mismatched Contract Details:**
   Define explicit payload for updating worker categories:
   ```json
   {
     "primaryCategory": "COOK",
     "categories": ["COOK", "HOUSE_MAID"],
     "reason": "Competency verified during operational onboarding"
   }
   ```
6. **Required Backend Action:** Document and deploy category update endpoint contract.
7. **Frontend Impact:** Non-blocking; UI provides category chips and modal management dialog.
8. **Status:** Confirmed gap.

---

#### GAP-WRK-06: Genuine Worker Ratings Aggregation & Review Ledger Sub-Resource
1. **Capability Affected:** Rating.
2. **Existing Endpoint:** `GET /api/v1/admin/workers/{workerId}/reviews` (Missing)
3. **Actual Observed Behavior:** Worker summary records provide scalar `ratingAverage` and `totalReviews`. The detailed historical review ledger (customer review notes, star rating breakdown, date, booking ID) is not accessible as a sub-resource.
4. **Expected PRD Requirement:** PRD §7 mandates visibility into genuine worker ratings and customer review details under appropriate permissions.
5. **Missing/Mismatched Contract Details:**
   Expose `GET /api/v1/admin/workers/{workerId}/reviews`:
   ```json
   {
     "workerId": "W-10482",
     "ratingAverage": 4.8,
     "totalReviews": 42,
     "items": [
       {
         "id": "rev-101",
         "bookingId": "BK-9021",
         "customerNameMasked": "Priya S.",
         "rating": 5,
         "feedback": "Exceptional cooking and punctual service.",
         "createdAt": "2026-10-15T18:00:00Z"
       }
     ]
   }
   ```
6. **Required Backend Action:** Implement reviews sub-resource endpoint for worker profiles.
7. **Frontend Impact:** Resolved on frontend; summary metrics render genuine ratings honestly, with star visualizers and completed engagements, displaying clear unavailable states when review details are not yet provided.
8. **Status:** Confirmed contract gap.

---

### 12.3 Summary of Action Items for Backend Team

| Priority | Action Item | Target API Endpoint | Impact |
|---|---|---|---|
| **P1** | **Seed Admin Test Accounts in Remote DB** | `POST /api/v1/auth/admin/login` | Unblocks live browser login and end-to-end data validation |
| **P1** | **Enforce KYC Verification Guard on Activation** | `PATCH /api/v1/admin/workers/{id}` | Prevents unverified workers from commercial activation |
| **P2** | **Deploy Selective Contact PII Unmasking & Audit Log** | `GET /api/v1/admin/workers/{id}` | Complies with PRD §9 & §13 privacy and verification requirements |
| **P2** | **Document Standard Query Filtering & Pagination** | `GET /api/v1/admin/workers` | Standardizes server-side search, filtering, and sorting |
| **P3** | **Deliver Worker Review Ledger Sub-Resource** | `GET /api/v1/admin/workers/{id}/reviews` | Provides historical review details to complement summary rating |
| **P3** | **Formalize Multi-Category Update Contract** | `PUT /api/v1/admin/workers/{id}/categories` | Standardizes multi-skill category adjustments by Operations Admin |

---

## 13. Customer Management Module Audit & PRD Capability Gaps (GAP-CUST-01 to GAP-CUST-06)

### 13.1 Context & Regulatory Alignment
The Customer Management module of the SevaNest Admin Portal provides operational governance across customer accounts, household profiles, bookings, service histories, grievance disputes, and administrative notes pursuant to PRD §2, §3, §5, §7, §9, §12, §13, and §19.

Section 7 explicitly mandates six primary capabilities:
1. **Customer Profiles:** Household identity, contact numbers (masked by default), locality clusters, registered address, preferred communication language, and registration date.
2. **Customer Status:** Clear separation between account lifecycle state (`ACTIVE`, `SUSPENDED`) and customer verification state (`VERIFIED`, `PENDING`, `REJECTED`).
3. **Bookings:** Customer service engagements, assigned domestic workers, operational progress, and category allocations.
4. **History:** Chronological service delivery history and engagement records.
5. **Complaints:** Associated grievances, disputes, and warranty replacement requests with deep links to the Support Console.
6. **Notes:** Operational notes ledger, case updates, and interactive note recording via `POST /api/v1/admin/customers/{id}/notes`.

---

### 13.2 Detailed Customer Management Gap Register

#### GAP-CUST-01: Standardized Server-Side Query Filtering, Sorting & Pagination for Customer Directory
1. **Capability Affected:** Customer Profiles & Directory (`/customers`).
2. **Existing Endpoint:** `GET /api/v1/admin/customers`
3. **Actual Observed Behavior:** The endpoint returns a JSON array or envelope with customer records, but accepted query parameters for server-side search (`search`), status filtering (`status`), locality filtering (`locality`), and page-based pagination (`page`, `limit`) are not standardized in the OpenAPI specification.
4. **Expected PRD Requirement:** PRD §7 and §13 dictate administrative roster navigation supporting search by name/ID, filtering by account status (`ACTIVE`, `SUSPENDED`), clustering by locality, and paginated delivery to ensure sub-second response times across large customer cohorts.
5. **Missing/Mismatched Contract Details:**
   Define explicit query parameter contracts:
   - Query parameters:
     - `search`: string (case-insensitive search over `name`, `id`, `phone`)
     - `status`: enum (`ALL`, `ACTIVE`, `SUSPENDED`)
     - `locality`: string (cluster identifier)
     - `page`: integer (default `1`)
     - `limit`: integer (default `10`, max `100`)
   - Envelope response format:
     ```json
     {
       "success": true,
       "data": {
         "items": [
           {
             "id": "C-1092",
             "name": "Anand Sharma",
             "maskedPhone": "+91 98**** **12",
             "locality": "Kondapur",
             "status": "ACTIVE",
             "verificationStatus": "VERIFIED",
             "totalBookings": 3,
             "registeredDate": "2024-01-15",
             "preferredLanguage": "English, Hindi"
           }
         ],
         "pagination": {
           "page": 1,
           "limit": 10,
           "totalItems": 150,
           "totalPages": 15
         }
       }
     }
     ```
6. **Required Backend Action:** Implement and document standardized server-side query filters, sorting, and pagination envelope for `GET /api/v1/admin/customers`.
7. **Frontend Impact:** Resolved on frontend; the directory maintains bidirectional URL query parameter synchronization (`search`, `status`, `locality`, `customerId`) and transparently supports both paginated envelopes and flat arrays with fallback client-side clustering.
8. **Status:** Confirmed contract gap.

---

#### GAP-CUST-02: Formal Customer KYC Verification Pipeline & Verification Status Contract
1. **Capability Affected:** Customer Status & Trust Framework.
2. **Existing Endpoint:** `GET /api/v1/admin/customers/{id}`
3. **Actual Observed Behavior:** Backend customer objects include commercial account `status` (`ACTIVE`, `SUSPENDED`), but lack a formalized `verificationStatus` enum (`VERIFIED`, `PENDING`, `REJECTED`). Previous implementations conflated account status with verification status.
4. **Expected PRD Requirement:** PRD §5, §7, and §9 require basic customer verification (mobile OTP confirmation and address verification) prior to booking dispatch, explicitly distinct from commercial account standing.
5. **Missing/Mismatched Contract Details:**
   - Add explicit `verificationStatus` field:
     ```json
     {
       "id": "C-1092",
       "status": "ACTIVE",
       "verificationStatus": "VERIFIED",
       "preferredLanguage": "English, Hindi",
       "isVerified": true
     }
     ```
   - Prohibit auto-assuming customer verification merely because an account exists or has completed payment.
6. **Required Backend Action:** Expose distinct `verificationStatus` in customer entities and document verification criteria.
7. **Frontend Impact:** Resolved on frontend; UI renders distinct `StatusBadge` (account lifecycle) and `VerificationBadge` (KYC trust status) across directory rows and modal headers.
8. **Status:** Confirmed contract gap.

---

#### GAP-CUST-03: Unmasked Customer Contact Disclosure Policy & Server-Side Audit Event Dispatch
1. **Capability Affected:** Customer Profiles, Privacy & Security (PRD §13).
2. **Existing Endpoint:** `GET /api/v1/admin/customers/{id}` / `POST /api/v1/admin/customers/{id}/notes`
3. **Actual Observed Behavior:** Contact details (`phone`, `email`) are masked by default (`+91 98**** **12`, `a****@gmail.com`). Unmasking is currently simulated by retrieving unmasked fields from the detail payload and recording an audit note via `POST /api/v1/admin/customers/{id}/notes`. A dedicated atomic unmasking endpoint is not formally published.
4. **Expected PRD Requirement:** PRD §13 mandates strict customer data privacy. Only authorized administrative roles (`SUPER_ADMIN`, `OPERATIONS_ADMIN`) possessing `customers.manage` may access unmasked contact info, requiring mandatory operational justification and producing an immutable audit log entry.
5. **Missing/Mismatched Contract Details:**
   Provide dedicated atomic disclosure endpoint:
   - **Path:** `POST /api/v1/admin/customers/{id}/reveal-pii`
   - **Payload:**
     ```json
     {
       "reason": "Direct telephonic dispute resolution regarding ticket TKT-1082"
     }
     ```
   - **Response:**
     ```json
     {
       "unmaskedPhone": "+91 98765 43210",
       "unmaskedEmail": "anand.sharma@gmail.com",
       "auditLogId": "AUD-99120"
     }
     ```
   - Backend must emit immutable audit event `CUSTOMER_PII_REVEALED` recording admin ID, customer ID, operational rationale, timestamp, and IP address.
6. **Required Backend Action:** Implement dedicated `POST /api/v1/admin/customers/{id}/reveal-pii` with server-side validation and audit log persistence.
7. **Frontend Impact:** Resolved on frontend; contact details are strictly masked by default. The "Reveal Contact" button requires `PERMISSIONS.CUSTOMERS_MANAGE`, opens an audited confirmation modal requiring >= 5 characters justification, and dispatches an audit note to the backend before exposing unmasked digits.
8. **Status:** Confirmed contract gap.

---

#### GAP-CUST-04: Dedicated Customer Grievance & Complaints Sub-Resource Contract
1. **Capability Affected:** Customer Complaints & Support Integration (PRD §5, §7).
2. **Existing Endpoint:** `GET /api/v1/admin/customers/{id}/complaints` (Missing as dedicated sub-resource)
3. **Actual Observed Behavior:** Customer detail records currently embed scalar `openGrievances: number`. Detailed complaint records (dispute category, ticket ID, service category, complaint description, filing timestamp) are not consistently structured across backend environments.
4. **Expected PRD Requirement:** PRD §5 and §7 specify customer management visibility into service grievances, billing disputes, and warranty replacement requests, with seamless navigation into the Support Console.
5. **Missing/Mismatched Contract Details:**
   Expose structured customer complaints sub-resource or embed in customer detail:
   ```json
   {
     "complaints": [
       {
         "ticketId": "TKT-1082",
         "disputeCategory": "SERVICE_QUALITY",
         "serviceCategory": "House Maid",
         "status": "IN_PROGRESS",
         "createdAt": "2026-10-20T14:30:00Z",
         "description": "Trial maid arrived 45 minutes late and skipped kitchen cleaning duties."
       }
     ]
   }
   ```
6. **Required Backend Action:** Standardize customer complaints embedding or expose `GET /api/v1/admin/customers/{id}/complaints` sub-resource.
7. **Frontend Impact:** Resolved on frontend; dedicated "Support & Complaints" tab renders structured ticket records with dispute badges, incident descriptions, status indicators, and direct deep links to `/support?searchTerm={customerId}`.
8. **Status:** Confirmed contract gap.

---

#### GAP-CUST-05: Customer Operational Notes Persistence Schema & Timestamped Author Metadata
1. **Capability Affected:** Customer Notes (PRD §7).
2. **Existing Endpoint:** `POST /api/v1/admin/customers/{id}/notes`
3. **Actual Observed Behavior:** `POST /api/v1/admin/customers/{id}/notes` accepts `{ note: string }` and appends to an internal notes array. However, the returned note objects in `GET /api/v1/admin/customers/{id}` are returned as flat strings (`notes: string[]`) rather than rich objects containing `authorId`, `authorName`, `createdAt`, and `noteType`.
4. **Expected PRD Requirement:** PRD §7 mandates operational notes tracking for staff auditability, customer special requirements (e.g. language preferences, pet warnings), and dispute resolutions.
5. **Missing/Mismatched Contract Details:**
   Upgrade notes schema to include author and timestamp metadata:
   ```json
   {
     "notes": [
       {
         "id": "NOTE-401",
         "content": "Customer requested preferred Hindi-speaking cleaner for morning slots.",
         "authorId": "ADM-002",
         "authorName": "Operations Admin",
         "createdAt": "2026-10-18T09:15:00Z"
       }
     ]
   }
   ```
6. **Required Backend Action:** Enhance customer notes storage to capture author metadata and timestamps, returning structured note objects while preserving backward compatibility with plain strings.
7. **Frontend Impact:** Resolved on frontend; the dedicated "Operational Notes" tab supports interactive note submission with client-side validation (minimum 3 characters), prevents empty submissions, triggers TanStack Query cache invalidation, and gracefully formats both structured notes and plain strings.
8. **Status:** Confirmed contract gap.

---

#### GAP-CUST-06: Commercial Account Lifecycle Status Transition Semantics & Disciplinary Audit Guardrails
1. **Capability Affected:** Customer Status Mutations (PRD §7).
2. **Existing Endpoint:** `PATCH /api/v1/admin/customers/{id}/status` or `PUT /api/v1/admin/customers/{id}`
3. **Actual Observed Behavior:** Status mutations accept `status` (`ACTIVE`, `SUSPENDED`) and `remarks`. Permitted state transitions and validation constraints are not documented in the backend contract.
4. **Expected PRD Requirement:** PRD §7 permits Operations Admins to suspend accounts due to payment fraud, safety breaches, or abusive conduct. Suspended accounts must immediately be prevented from booking domestic services. Reactivation requires explicit administrative authorization.
5. **Missing/Mismatched Contract Details:**
   - Permitted transitions: `ACTIVE -> SUSPENDED`, `SUSPENDED -> ACTIVE`.
   - Mandatory operational remarks (minimum 5 characters) must be persisted to the administrative compliance ledger.
   - Suspension must automatically cancel or pause pending matching requests.
6. **Required Backend Action:** Validate state transitions and store operational remarks in the central audit ledger.
7. **Frontend Impact:** Resolved on frontend; status actions require `PERMISSIONS.CUSTOMERS_MANAGE_STATUS`, enforce mandatory operational remarks and destructive confirmation checkboxes, provide instant status updates, and invalidate relevant TanStack Query caches.
8. **Status:** Confirmed contract gap.

---

### 13.3 Summary of Action Items for Backend Team (Customer Management)

| Priority | Action Item | Target API Endpoint | Impact |
|---|---|---|---|
| **P1** | **Seed Customer Test Accounts in Remote DB** | `POST /api/v1/auth/admin/login` / DB | Enables live remote browser testing with authentic customer records |
| **P1** | **Enforce Account Status Separation from Verification** | `GET /api/v1/admin/customers/{id}` | Prevents conflating commercial standing with KYC verification |
| **P2** | **Implement Dedicated Contact PII Reveal Endpoint** | `POST /api/v1/admin/customers/{id}/reveal-pii` | Provides audited, compliant unmasked contact disclosure |
| **P2** | **Deploy Standardized Query Filters & Pagination Envelope** | `GET /api/v1/admin/customers` | Unifies server-side search, filtering, and pagination |
| **P3** | **Enrich Customer Notes with Author & Timestamp Metadata** | `GET /api/v1/admin/customers/{id}` | Delivers comprehensive audit history for operational notes |
| **P3** | **Standardize Complaints & Grievance Ticket Sub-Resource** | `GET /api/v1/admin/customers/{id}/complaints` | Structures customer dispute records with links to Support |

---

## 14. Strict Worker Application Verification, Document Vault & Onboarding Audit (October 2026 Verification Update)

### 14.1 Context & Objectives
An intensive end-to-end audit of the Worker Application Verification, Document Inspection, Check Decision, and Onboarding flow was executed against `SevaNest_PRD.pdf` (Sections 7 & 9), `docs/openapi.json`, and the live Render backend environment.

### 14.2 Detailed Findings & Frontend Implementations

#### GAP-VERIF-DOC-01: Document Extraction Across Disparate Response Locations
1. **Capability Affected:** Step 2: Documents & KYC Evidence Vault (`WorkerDetailModal`).
2. **Issue:** In the backend REST API, submitted documents may be returned in top-level `documents: [...]` array, nested inside `{ success: true, data: { documents: [...] } }`, or embedded within individual verification check objects under `checks[checkType].documents` or `checks[checkType].documentMetadata`. If the mapping logic only reads top-level `worker.documents`, Step 2 rendered an empty documents table despite worker submissions.
3. **Frontend Resolution:**
   - Updated `mapBackendWorkerDetailToWorkerDetail` in `src/features/workers/data/workerRepository.ts` to inspect and unwrap all payload envelopes (`data.data`, `verifData.data`).
   - Dynamically harvest documents from `worker.documents`, `verifData.documents`, and every check in `dossier.checks` (both array and object formats), extracting `documentMetadata` and `documentId`.
   - In `WorkerDetailModal.tsx`, unified `displayDocuments` memo combines all harvested documents and deduplicates by `documentId`.
   - Implemented honest empty state `<tr data-testid="no-documents-submitted">` with explicit notice: *"No verification documents submitted yet. Pending worker upload via the Worker Mobile App."* when no documents exist.
   - Enhanced inspection viewer to support rotating (90° increments), zooming (70%-150%), authorized link opening (`target="_blank"` with `rel="noopener noreferrer"`), and embedded PDF/image rendering without storing signed tokens in browser storage.
4. **Status:** Resolved on Frontend.

#### GAP-VERIF-CHK-01: Check Identification & Verification Operations Contract
1. **Capability Affected:** Step 3: Verification Action Center / Checklist (`WorkerDetailModal` and `VerificationQueuePage`).
2. **Issue:** Individual verification actions (`approve`, `reject`, `recheck`) require a valid backend check ID (`POST /api/v1/admin/verification/checks/{id}/approve`). When a check record in `GET /api/v1/admin/workers/{workerId}/verification` omitted top-level `id` or placed it under `checkId`, actions failed or were disabled.
3. **Frontend Resolution:**
   - Implemented fallback resolution for `targetCheckId`: `check.id || check.checkId || dossier?.checks?.[key]?.id || (key === 'IDENTITY' ? dossier?.checkId : undefined)`.
   - Connected `Approve Check` button to `ConfirmDialog` and `verificationRepository.approveCheck(checkId, checkType, notes)`.
   - Connected `Reject Check` button to `ConfirmDialog` with mandatory operational category selection and remarks input (minimum 5 characters).
   - Connected `Request Re-Verification` button to `ConfirmDialog` collecting mandatory correction instructions.
   - On success, TanStack Query caches for `['workers']`, `['verification']`, and `['dashboard']` are invalidated, refreshing authoritative data while keeping the worker dossier open.
4. **Status:** Resolved on Frontend.

#### GAP-VERIF-SEQ-01: Enforcement of 5-Point Sequential Operations Order
1. **Capability Affected:** Verification Integrity & Prerequisite Enforcement.
2. **Order Enforced (PRD §7 & §9):**
   - Tier 1: Automated Mobile OTP (SMS Gateway Pre-Check)
   - Step 1: Identity Proof (`IDENTITY`)
   - Step 2: Address Proof (`ADDRESS`)
   - Step 3: Emergency Contact Vetting (`EMERGENCY_CONTACT`)
   - Step 4: Previous Employer Reference (`REFERENCE`)
   - Step 5: Police Clearance Certificate (`POLICE_CLEARANCE`)
3. **Enforcement Behavior:** Dependent checks display a Lock badge and disabled action controls until preceding checks have achieved `APPROVED` status confirmed by the backend.
4. **Status:** Verified and strictly enforced on frontend and in tests.

#### ARCH-VERIF-01 & GAP-VERIF-02: Status of Application Acceptance & Worker Activation
1. **Composite Final Acceptance:** The deployed backend operates on an atomic check architecture; approving all 5 checks + pre-check causes `GET /api/v1/admin/workers/{id}/verification` to return overall `level: 'VERIFIED'`. There is no composite endpoint `POST /api/v1/admin/workers/{id}/application/accept` in the deployed OpenAPI.
2. **Commercial Activation:** Account roster activation (`status = 'ACTIVE'`) is decoupled from KYC verification and governed strictly by Operations Admin permissions (`workers.manage_status`).
3. **Frontend Integrity:** The frontend displays authoritative backend status honestly, reports `ARCH-VERIF-01` status without fabricating fake acceptance mutations, and displays read-only platform status in Step 5 without exposing unconfirmed activation controls.
4. **Status:** Confirmed architectural gap documented in register.

### 14.3 Action Items for Backend Team (Verification & Onboarding)

| Priority | Action Item | Target API Endpoint | Impact |
|---|---|---|---|
| **P1** | **Seed Administrative Test Accounts in Remote Database** | `POST /api/v1/auth/admin/login` | Unblocks authenticated live browser validation for Verification Executive |
| **P1** | **Standardize Document Metadata Envelope in Verification GET** | `GET /api/v1/admin/workers/{id}/verification` | Guarantees top-level `documents: [...]` array with signed URLs |
| **Resolved** | **Composite Application Acceptance Endpoint (ARCH-VERIF-01)** | `POST /api/v1/admin/workers/{id}/verification/sign-off` | Replaced speculative `/application/accept` with confirmed backend sign-off contract |
| **Resolved** | **Worker Commercial Activation API Contract (GAP-VERIF-02)** | `POST /api/v1/admin/workers/{id}/activate` | Replaced speculative `/activation` with confirmed backend activation contract |

---

## 15. Verification Approval 422 Root Cause Resolution and Confirmed Sign-Off & Activation Contracts (October 2026)

### 15.1 Individual Check Approval 422 Root Cause & Resolution

1. **Problem Statement:** Individual verification check approval via `POST /api/v1/admin/verification/checks/{checkId}/approve` was returning `422 Unprocessable Entity` (e.g. check ID `01a166fb-5c87-7265-8036-b68ac96d1880` for worker `01a166eb-8f68-7543-b394-a86124c4e66a`).
2. **Confirmed Root Cause:**
   - The frontend check approval payload was including extraneous legacy or UI fields: `referenceNumber`, `expiresOn`, `callNotes`, etc.
   - The backend `ApproveCheckDto` enforces strict NestJS validation pipes (`whitelist: true, forbidNonWhitelisted: true`), permitting strictly:
     ```json
     {
       "remarks": "string (optional)",
       "recheckAt": "ISO date-time string (optional)"
     }
     ```
   - Any extra fields triggered an immediate `422 Unprocessable Entity` rejection.
3. **Frontend Fix Implemented:**
   - In `RealVerificationRepository.approveCheck` (`src/features/verification/data/verificationRepository.ts`), stripped all extraneous properties and construct strict `ApproveCheckDto`:
     ```typescript
     const payload: { remarks?: string; recheckAt?: string } = {};
     if (typeof notes === 'string' && notes.trim() !== '') {
       payload.remarks = notes.trim();
     } else if (notes && typeof notes === 'object' && 'remarks' in notes && typeof notes.remarks === 'string' && notes.remarks.trim() !== '') {
       payload.remarks = notes.remarks.trim();
     }
     if (notes && typeof notes === 'object' && 'recheckAt' in notes && typeof notes.recheckAt === 'string') {
       payload.recheckAt = notes.recheckAt;
     }
     ```
   - In `WorkerDetailModal.tsx` and `VerificationQueuePage.tsx`, on check approval error, the worker modal and dossier remain open, preserving selected worker and check context while displaying actual backend error details.
   - On successful approval, check status is updated directly from the backend `AdminWorkerVerificationResponse`, and TanStack Query caches for `['workers']`, `['verification']`, and `['dashboard']` are refreshed.

---

### 15.2 Confirmed Final Sign-Off Contract (`verification.signoff`)

1. **Endpoint:** `POST /api/v1/admin/workers/{workerId}/verification/sign-off`
2. **Required Permission:** `verification.signoff` (Granted to: `OPERATIONS_ADMIN`, `VERIFICATION_SUPERVISOR`, `SUPER_ADMIN`).
3. **Role Boundary:** `VERIFICATION_EXECUTIVE` is restricted to check-level decisions and does NOT have access to execute final sign-off. If unauthorized, the UI displays clear guidance indicating the required role and permission.
4. **Request Body:**
   ```json
   {
     "remarks": "Optional supervisor sign-off remarks"
   }
   ```
5. **Contract Constraints & Handled Status Codes:**
   - `409 NOT_FULLY_VERIFIED`: Returned when mandatory verification checks remain incomplete. UI locks the button and displays explanatory text.
   - `409 WORKER_DISQUALIFIED`: Returned if worker has rejected checks. UI preserves error context without closing the modal.
   - `422 PROFILE_NOT_SUBMITTED`: Returned if worker profile has not been submitted.
   - `200/201 OK`: Transitions dossier and worker `applicationStatus` to `VERIFIED` and sets `signedOffAt`.

---

### 15.3 Confirmed Commercial Platform Activation Contract (`worker.activate`)

1. **Endpoint:** `POST /api/v1/admin/workers/{workerId}/activate`
2. **Required Permission:** `worker.activate` (Granted to: `OPERATIONS_ADMIN`, `SUPER_ADMIN`).
3. **Sequential Workflow Lock:** Commercial activation is available ONLY after verification sign-off is complete (`isSignedOff === true`). If not signed off, activation controls remain locked.
4. **Request Body:** None / empty body.
5. **Contract Constraints & Handled Status Codes:**
   - `409 NOT_SIGNED_OFF`: Backend validates that verification sign-off was previously executed.
   - `422 ACTIVATION_REQUIREMENTS_MISSING`: Backend performs authoritative prerequisite validation:
     1. Approved verification checks
     2. Primary service category assigned
     3. Designated operational service area
     4. Signed criminal self-declaration
     5. Active user account
     6. No blacklist or disciplinary suspension
     When prerequisites are missing, backend returns `details[0].messages: string[]`. The UI displays each individual missing requirement directly in both the Step 4 card and the activation dialog.
   - `200/201 OK`: Transitions worker `applicationStatus` to `ACTIVE` and sets `activatedAt`.

---

### 15.4 Authoritative Status & Zero Dummy Policy

1. **Authoritative Onboarded State:** A worker is reported as onboarded iff `applicationStatus === 'ACTIVE'` AND `activatedAt` is set.
2. **Preserved Distinction:** The UI cleanly differentiates:
   - `UNDER_REVIEW`: Checks in progress or awaiting supervisor sign-off.
   - `VERIFIED`: Formally signed off by supervisor, awaiting commercial activation.
   - `ACTIVE`: Activated on the commercial roster and eligible for household matching.
3. **Zero Dummy Policy:** No mock endpoints, fallback stubs (`/application/accept`), or fabricated activation assignments are used.

---

### 15.5 Live Environment & Verification State

1. **Remote Deployed Backend:** `https://sevanest-backend.onrender.com/api/v1`
   - `POST /admin/verification/checks/{checkId}/approve`: **Active (returns 401 UNAUTHENTICATED without token)**.
   - `POST /admin/workers/{workerId}/verification/sign-off`: **Active (returns 401 UNAUTHENTICATED without token)**.
   - `POST /admin/workers/{workerId}/activate`: **Active (returns 401 UNAUTHENTICATED without token)**.
   - `POST /auth/admin/login`: **Active (returns 401 INVALID_CREDENTIALS / 429 ADMIN_LOGIN_LOCKED)** due to unseeded test accounts in PostgreSQL on Render.
2. **Local Production Container Validation:**
   - Built with `docker build -t sevanest-admin-portal:latest .`
   - Running container: `sevanest-admin` on port 8080 (`http://localhost:8080`).
   - Healthcheck: `GET http://localhost:8080/healthz` -> **200 OK**.
   - Quality Gates: **Typecheck: 0 errors**, **ESLint: 0 warnings**, **Vite Build: Succeeded (5.89s)**, **Vitest: 45 passed (45), 573 passed (573)**.





