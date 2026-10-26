# SevaNest Admin Portal — Backend Endpoint Gap Report

**Audit Date:** October 2026  
**Frontend Version:** 1.0.0  
**Target Backend:** `https://sevanest-backend.onrender.com/api/v1`  
**API Specification Source:** OpenAPI 3.0.0 / NestJS Backend Deployment  
**Auditor:** Senior Frontend Architect & Release-Readiness Reviewer  

---

## 1. Classification Categories

Every identified integration gap or backend dependency is assigned to one of eight canonical categories:
- **Category A — Missing Endpoint:** Endpoint does not exist in backend routes or deployed OpenAPI spec.
- **Category B — Contract Mismatch:** Endpoint exists, but request shape, response structure, or parameter naming differs from frontend requirements.
- **Category C — Endpoint Failing / Unreachable:** Endpoint exists in code/spec but throws 500, crashes, or times out.
- **Category D — Missing Response Field / Unsupported Workflow:** Endpoint exists, but lacks crucial fields required by admin workflows.
- **Category E — Infrastructure, CORS & Environment Blocker:** External infrastructure issues (e.g. CORS preflight 404, missing database seed accounts) blocking live integration.
- **Category F — Ambiguous Product / Business Rule:** Unresolved policy requiring stakeholder decision.
- **Category G — Previously Reported Gap (Unresolved):** Gaps documented in previous audits that remain unaddressed by the backend team.
- **Category H — Resolved Gap:** Previously identified frontend or backend issue that has been formally repaired and verified with evidence.

---

## 2. Comprehensive Backend Gap Register

---

### GAP-BE-001: Remote CORS Preflight OPTIONS Rejection (Category E / G)
- **Module & Workflow:** Global API Client / Remote Backend Access
- **Description:** Preflight `OPTIONS` requests sent by web browsers from any external origin (including `http://localhost:8080`, `http://localhost:5173`) return HTTP 404 Not Found without `Access-Control-Allow-Origin` or `Access-Control-Allow-Headers`.
- **Endpoint:** `OPTIONS /*` across all `/api/v1/*` routes
- **Impact on Frontend:** Complete block on direct browser-to-backend communication against `https://sevanest-backend.onrender.com/api/v1`. The frontend handles this in local Docker/development via Nginx/Vite reverse proxying `/api/v1`, but production deployments pointing directly to the remote URL fail immediately.
- **Safe Frontend Workaround:** Reverse proxying through Nginx (configured in `nginx.conf`). Direct client-side requests cannot bypass browser CORS security.
- **Exact Action Required from Backend Team:**
  - Configure NestJS CORS middleware in `main.ts`:
    ```typescript
    app.enableCors({
      origin: ['http://localhost:8080', 'http://localhost:5173', 'https://admin.sevanest.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    });
    ```
- **Current Status:** **OPEN — BLOCKED BY ENVIRONMENT**

---

### GAP-BE-002: Missing Seed Administrative Accounts in Remote Database (Category E / G)
- **Module & Workflow:** Authentication (`/auth/login`)
- **Description:** Standard administrative personas (`superadmin@sevanest.com`, `ops@sevanest.com`, `verification@sevanest.com`, `support@sevanest.com`) do not exist in the remote PostgreSQL database on Render. Submitting login requests returns `401 INVALID_CREDENTIALS`, and repeated attempts trigger `429 ADMIN_LOGIN_LOCKED`.
- **Endpoint:** `POST /api/v1/auth/login`
- **Impact on Frontend:** Live automated end-to-end browser authentication against the remote backend cannot complete without valid credentials.
- **Safe Frontend Workaround:** Dual-mode repository architecture (`MockAuthRepository` for local Vitest test suites; `RealAuthRepository` for production).
- **Exact Action Required from Backend Team:**
  - Execute a database seed migration on the Render PostgreSQL database inserting initial accounts for each of the four roles with known test credentials.
- **Current Status:** **OPEN — BLOCKED BY ENVIRONMENT**

---

### GAP-BE-003: Candidate Worker Matching Endpoint Verified (RESOLVED)
- **Module & Workflow:** Bookings Module — Candidate Matching Wizard (`/bookings`)
- **Status:** **RESOLVED — VERIFIED IN BACKEND OPENAPI CONTRACT**
- **Endpoint:** `POST /api/v1/admin/matching/candidates`
- **Method:** `POST`
- **Request Schema (`MatchRequirementDto`):**
  ```json
  {
    "category": "HOUSE_MAID",
    "areaId": "IND_HYD_KONDAPUR",
    "engagement": "FULL_TIME",
    "availableFrom": "09:00",
    "availableTo": "13:00",
    "startDate": "2026-11-01",
    "language": "hi",
    "minExperienceMonths": 12,
    "page": 1,
    "limit": 20
  }
  ```
- **Response Schema (`MatchCandidatesResponse`):**
  - Returns `data: CandidateView[]`, `meta: MatchMeta`, `ordering: "SUBMITTED_ASC"`, `ranked: false`.
  - Candidates are active, profile-submitted, fully verified workers who match category, area, engagement, and availability timings.
- **Frontend Integration:** Wired into `RealBookingRepository.matchCandidates` and `getCandidateSuggestions`. Fallback to replacement candidates remains in place for edge cases (e.g., 422 AREA_NOT_AVAILABLE).

---

### GAP-BE-004: Dashboard Missing Calculated Financial & Compliance Metrics (Category D)
- **Module & Workflow:** Dashboard (`/dashboard`)
- **Description:** The dashboard endpoint `GET /admin/dashboard` provides general active counts, but omits `grossBookings` (currency total) and `policeVerifDue` (urgency count) expected by the Super Admin view.
- **Existing Endpoint:** `GET /api/v1/admin/dashboard`
- **Existing Response:**
  ```json
  {
    "success": true,
    "data": {
      "totalUsers": 1420,
      "activeWorkers": 385,
      "pendingVerifications": 18,
      "activeBookings": 42
    }
  }
  ```
- **Proposed Contract Enhancement:**
  ```json
  {
    "success": true,
    "data": {
      "totalUsers": 1420,
      "activeWorkers": 385,
      "pendingVerifications": 18,
      "activeBookings": 42,
      "grossBookingsINR": 1845000,
      "policeVerifDueCount": 6,
      "monthlyRevenueINR": 369000
    }
  }
  ```
- **Safe Frontend Workaround:** The frontend checks for nullish values and displays honest "Unavailable" status chips rather than fabricating zero or synthetic financial totals.
- **Exact Action Required from Backend Team:** Include financial aggregations (`grossBookingsINR`, `monthlyRevenueINR`) and compliance backlog count (`policeVerifDueCount`) in the dashboard DTO.
- **Current Status:** **OPEN — BLOCKED BY BACKEND**

---

### GAP-BE-005: Verification Queue Filter by Reviewer (`assignedTo=me`) (Category D / G)
- **Module & Workflow:** Worker Verification Queue (`/verification/queue`)
- **Description:** Verification Executives need to toggle between all pending queue items and dossiers currently assigned to them. The backend `GET /admin/verification/queue` does not support query filtering by `assignedTo` or `reviewerId`.
- **Existing Endpoint:** `GET /api/v1/admin/verification/queue`
- **Proposed Query Parameter:** `assignedTo=me` or `reviewerId={uuid}`
- **Proposed Contract:**
  ```http
  GET /api/v1/admin/verification/queue?status=IN_REVIEW&assignedTo=me
  ```
- **Safe Frontend Workaround:** Frontend performs client-side filtering on the returned array by checking `item.claimedBy === currentUserId`.
- **Exact Action Required from Backend Team:** Support `assignedTo=me` query parameter in the queue controller to optimize database queries and reduce bandwidth.
- **Current Status:** **OPEN — BLOCKED BY BACKEND**

---

### GAP-BE-006: Document Link Resolution Requires Document ID (Category H — RESOLVED)
- **Module & Workflow:** Verification Document Viewer (`/verification/queue`)
- **Description:** Previously, `verificationRepository.ts` used a fallback `const targetId = documentId || dossierId;` when requesting signed document links from `GET /admin/verification/documents/{documentId}/link`. This resulted in 404/500 errors because the backend expects an indexed `documentId`.
- **Resolution Evidence:**
  - Removed fallback in `verificationRepository.ts` line 1042.
  - Implemented strict document ID validation. If `documentId` is missing, the frontend halts gracefully and renders an explicit "Document ID Missing from Backend Record" state without making invalid API calls.
  - Added test suite `src/tests/verificationDocumentIdHandling.test.tsx` verifying no invalid requests are dispatched.
- **Current Status:** **RESOLVED (FRONTEND REPAIRED)**

---

### GAP-BE-007: Verification Claim Conflict (HTTP 409) Handling (Category H — RESOLVED)
- **Module & Workflow:** Verification Queue Claim Action (`/verification/queue`)
- **Description:** When two executives concurrently attempted to claim the same dossier, the backend returned HTTP 409 Conflict, but the UI previously opened the dossier optimistically.
- **Resolution Evidence:**
  - In `VerificationQueuePage.tsx`, optimistic state mutation was removed.
  - HTTP 409 is caught explicitly, displaying a non-blocking conflict dialog: "This dossier was claimed by another reviewer. The queue will now refresh."
  - Auto-refreshes queue query cache via TanStack Query invalidation.
  - Validated by unit test in `src/tests/workerVerificationPhase3Contracts.test.tsx`.
- **Current Status:** **RESOLVED (FRONTEND REPAIRED)**

---

### GAP-BE-008: Refund Processing Idempotency Header & Payload Support (Category H — RESOLVED)
- **Module & Workflow:** Financial Transactions & Refunds (`/payments`)
- **Description:** Financial refunds must be idempotent to prevent duplicate payouts across network retries.
- **Resolution Evidence:**
  - `PaymentRepository.processRefund` updated to transmit `idempotencyKey` both in payload and in HTTP header `Idempotency-Key`.
  - `RefundProcessingModal.tsx` generates a unique idempotency reference key per transaction modal session.
  - Validated in `src/tests/paymentWorkflow.test.tsx` and `src/tests/backendFullModulesIntegration.test.tsx`.
- **Current Status:** **RESOLVED (FRONTEND REPAIRED)**

---

### GAP-BE-009: Support Executive Server-Issued Database Permissions (`customers.view` & `customers.reveal_pii`) (Category D / E)
- **Module & Workflow:** RBAC / Customers Directory Access (`/customers`)
- **Description:** In production seed environments, Support Executive identities returned by `POST /api/v1/auth/login` must include `customers.view` and `customers.reveal_pii`. If the backend database seed assigns only `['support.view', 'support.manage', 'dashboard.view']`, the user will encounter an honest `Access Restricted` guard upon accessing the Customers directory.
- **Endpoint:** `POST /api/v1/auth/login`, `GET /api/v1/users/me`
- **Impact on Frontend:** Support Executive is authorized by product requirements to inspect customer profiles for grievance fact-finding and dispute arbitration. Missing `customers.view` halts telephonic dispute investigation.
- **Safe Frontend Workaround:** The frontend strictly enforces server-issued permissions without inventing client-side wildcard grants. When `customers.view` is missing, it displays `<AccessRestrictedView requiredPermission="customers.view" />`. Default fallback templates in `authRepository.ts` and `configurationRepository.ts` include `customers.view` and `customers.reveal_pii`.
- **Exact Action Required from Backend Team:**
  - Ensure the PostgreSQL database role definition for `SUPPORT_EXECUTIVE` includes `customers.view` and `customers.reveal_pii` alongside `dashboard.view`, `worker.view`, `bookings.view`, `support.view`, and `support.manage`.
- **Current Status:** **OPEN — BLOCKED BY BACKEND SEED / ENVIRONMENT**

---

### GAP-BE-010: Support Operations Dashboard KPI Aggregations in `/admin/dashboard` (Category D)
- **Module & Workflow:** Support Operations Dashboard (`/dashboard`)
- **Description:** The root administrative dashboard endpoint `GET /api/v1/admin/dashboard` returns general platform counts (`totalUsers`, `activeWorkers`, `activeBookings`, `pendingVerifications`), but omits grievance and SLA breakdown metrics (`openTickets`, `assignedToMe`, `slaAtRisk`, `slaBreached`, `escalatedTickets`, `resolvedToday`).
- **Existing Endpoint:** `GET /api/v1/admin/dashboard`
- **Proposed Contract Extension:**
  ```json
  {
    "success": true,
    "data": {
      "support": {
        "openTickets": 14,
        "assignedToMe": 4,
        "slaAtRisk": 3,
        "slaBreached": 1,
        "escalatedTickets": 2,
        "resolvedToday": 6
      }
    }
  }
  ```
- **Safe Frontend Workaround (Implemented & Verified):**
  - In `RealDashboardRepository.getSupportExecutiveDashboard()`, if the backend `/admin/dashboard` response lacks a `support` key, the repository queries `/admin/support/tickets` with pagination parameters and aggregates real metrics directly from the authoritative ticket dataset.
  - Zero synthetic data, fabricated statistics, or hardcoded numbers are rendered.
- **Exact Action Required from Backend Team:** Expose pre-aggregated `support` KPI counts on `GET /api/v1/admin/dashboard` to avoid secondary client-side API requests.
- **Current Status:** **RESOLVED (FRONTEND REPAIRED WITH SAFE ADAPTIVE FALLBACK)**

---

### GAP-BE-011: Ticket Telephonic Contact Logging Contract Alignment (Category B)
- **Module & Workflow:** Support Tickets & Grievance Mediation (`/support`, `TicketDetailModal.tsx`)
- **Description:** The Support Executive workflow requires recording customer and domestic worker telephone contact attempts and mediation findings. The OpenAPI specification exposes `POST /api/v1/admin/support/tickets/{ticketId}/messages` (`StaffMessageDto: { body: string, internal?: boolean }`), but does not have a dedicated endpoint for call duration or call outcome enum (`ANSWERED`, `UNREACHABLE`, `CALL_BACK_REQUESTED`).
- **Existing Endpoint:** `POST /api/v1/admin/support/tickets/{ticketId}/messages`
- **Safe Frontend Workaround (Implemented & Verified):**
  - The frontend maps telephonic contact logs directly to internal case notes (`{ body: "[Telephonic Log] " + noteText, internal: true }`).
  - Saved notes display author name, timestamp, and contact log styling.
- **Proposed Dedicated Contract (Optional Backend Enhancement):**
  ```http
  POST /api/v1/admin/support/tickets/{ticketId}/contact-logs
  Content-Type: application/json

  {
    "contactTarget": "WORKER",
    "callOutcome": "UNREACHABLE",
    "durationSeconds": 45,
    "remarks": "Dialed worker primary number. Call went unanswered."
  }
  ```
- **Exact Action Required from Backend Team:** Confirm whether the existing `POST /admin/support/tickets/{ticketId}/messages` (`internal: true`) is the permanent standard for telephonic notes or if a structured contact log table will be introduced.
- **Current Status:** **RESOLVED (FRONTEND ALIGNED TO EXISTING STAFF MESSAGE CONTRACT)**

---

### GAP-BE-012: Ticket Priority & Category Classification Modifications (Category D)
- **Module & Workflow:** Support Tickets Workstation (`/support`)
- **Description:** The backend OpenAPI specification defines `POST /api/v1/admin/support/tickets/{ticketId}/priority` (`SetPriorityDto: { priority: "LOW" | "MEDIUM" | "HIGH" }`), and `PATCH /api/v1/admin/support/categories/{categoryId}`.
- **Frontend Alignment:** `RealSupportRepository` provides full support for querying categories via `GET /api/v1/admin/support/categories` and unwrap category labels from `{ id, code, label }` objects.
- **Current Status:** **COMPLETE (FRONTEND COMPLIANT WITH BACKEND CONTRACT)**

---

## 3. Summary of Backend Team Action Items

To enable full end-to-end live operation against the remote deployed environment, the backend engineering team must prioritize the following actionable deliverables:

1. **Deploy CORS Configuration on Render:** Enable origins `http://localhost:8080`, `http://localhost:5173`, and production admin domains in `main.ts` with credentials and standard headers.
2. **Seed Initial Admin Accounts in Database:** Insert test user records with bcrypt-hashed passwords for `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `VERIFICATION_EXECUTIVE`, and `SUPPORT_EXECUTIVE`.
3. **Verify Support Executive Role Permissions in Database:** Confirm that the database seed for `SUPPORT_EXECUTIVE` includes `customers.view` and `customers.reveal_pii` alongside `dashboard.view`, `worker.view`, `bookings.view`, `support.view`, and `support.manage`.
4. **Implement Candidate Matching Endpoint:** Add `GET /api/v1/admin/bookings/{id}/candidates` returning verified worker profiles sorted by relevance.
5. **Add Support Aggregations to Dashboard DTO:** Include `support` ticket counts on `GET /api/v1/admin/dashboard` to streamline dashboard loading.
