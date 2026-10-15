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

## 4. Verification Categorization

- **Implemented:** 100% of required frontend API repositories and domain mappers exist and connect to real endpoints via `httpClient`.
- **Automated Verification Passed:** 100% of integration test suites (`vitest`), TypeScript typecheck (`tsc --noEmit`), ESLint, and production build (`vite build`) pass.
- **Live Integration Verified:** Blocked pending Backend Action 1 (CORS enablement on Render) and Backend Action 2 (administrative user seeding in production database).
