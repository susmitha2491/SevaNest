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

### Dependency 8: Absence of Worker-Level Final Decision Endpoint & Event

- **Category:** API Contract Clarification / Architecture Alignment
- **Severity:** MEDIUM (Frontend workflow aligned to read-only summary)
- **Module & Feature:** Worker Verification Workstation (`src/features/workers/presentation/WorkerDetailModal.tsx`, `src/features/verification`)
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/workers/{workerId}/verification`
  - Confirmed: `level` field provides authoritative overall verification evaluation.
  - Confirmed: There is NO worker-level final-decision endpoint (`POST /admin/verification/checks/{id}/decision` and `POST /admin/workers/{id}/verification/decision` are nonexistent).
  - Confirmed: No `worker.verification.completed` event is confirmed.
- **Frontend Action / Mitigation (Implemented & Verified in Phase 2):**
  - Removed unsupported `submitFinalDecision` from `IVerificationRepository`, `MockVerificationRepository`, and `RealVerificationRepository`.
  - Replaced the decision submission step in `WorkerDetailModal.tsx` with a read-only authoritative Verification Summary.
  - Overall status is determined strictly by the backend `level` field, displaying an explicit error/unavailable state if `level` fails to load or is missing.
  - The frontend never infers approval from individual checks or submits worker-level decision mutations.
- **Required Backend-Team Action:**
  - If a worker-level override decision or manual final sign-off is required by business operations, the backend team must define and implement an explicit contract (e.g., `POST /api/v1/admin/workers/{workerId}/verification/decision` with audit schema) and publish the `worker.verification.completed` domain event.
  - Otherwise, maintain the current architectural pattern where the backend computes the authoritative `level` from individual check results.

---

### Dependency 9: Worker Post-Verification Commercial Activation Endpoint

- **Category:** Backend Endpoint & Workflow Availability Gap
- **Severity:** MEDIUM (Blocks direct post-verification worker activation)
- **Module & Feature:** Worker Verification Lifecycle -> Platform Roster Activation
- **Existing Endpoint / Evidence Inspected:**
  - `GET /api/v1/admin/workers/{workerId}`
  - `PATCH /api/v1/admin/workers/{workerId}` (Operational disciplinary action: Suspend/Blacklist/Reinstate only)
  - Confirmed: No dedicated worker activation endpoint (e.g., `POST /admin/workers/{id}/activate`) or activation event has been confirmed.
  - Confirmed: `workers.manage_status` is not a registered permission for the worker verification workflow (`worker.view` is canonical).
- **Frontend Action / Mitigation (Implemented & Verified in Phase 2):**
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

