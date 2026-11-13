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

---

### GAP-BE-013: Reports & Analytics Detail-Level Data & Backend Export Endpoint Gaps (Category B / C / D)
- **Audit Date:** 2026-11-12 (Live probes against `/api/v1/admin/reports/*` and `/api/v1/admin/reports/export/*`)
- **Module & Workflow:** Reports & Analytics (`FR-RPT-001` through `FR-RPT-012`)
- **Findings from Live Audit:**
  1. **Aggregate-Only Report Endpoints (`FR-RPT-001`–`FR-RPT-011`):**
     - `GET /admin/reports/new-customers`, `worker-registrations`, `booking-funnel`, `demand-by-category`, `demand-by-area`, `worker-utilization`, `interview-conversion`, `cancellation-rate`, `replacement-rate`, `payment-collections`, and `support-tickets` return aggregated series/totals only and omit individual customer, worker, booking, payment, and ticket records.
     - `GET /admin/reports/demand-by-category` returns `requests` only and omits confirmed booking counts per category.
  2. **Backend CSV Export Limitations (`GET /api/v1/admin/reports/export/{report}`):**
     - Per OpenAPI specification (`Aggregates only - no personal data beyond what the on-screen report shows`), `export/{report}` exports minimal aggregate CSV rows only (for example, `payment-collections` exports only `totalsByFeeType` and `support-tickets` exports only `status,count` without periodic trend or average resolution time).
     - Live probes to `GET /api/v1/admin/reports/export/top-rated-workers` and `GET /api/v1/admin/reports/export/repeat-customers` returned **HTTP 502 Bad Gateway**.
     - `GET /api/v1/admin/payments-export` returns IDs and gateway references only (`no customer name, mobile or card data`).
  3. **List-vs-Detail Omissions & Masking on Secondary Operational Record Endpoints:**
     - `GET /admin/bookings` list items **omit `customerUserId` completely** (`GET /admin/bookings/{id}` returns both `customerUserId` and `timeline` history), and list items may lack a dedicated `cancelledAt` timestamp (`updatedAt` / timeline entry must be used when `status` is cancelled).
     - `GET /admin/customers` list items mask `mobile` (`+91******7410`) and omit `addresses`, whereas `GET /admin/customers/{id}` returns unmasked `mobile` (`+919638527410`) and `addresses` (`area`, `city`, `isDefault`).
     - `GET /admin/workers` list items mask `mobile` (`+91******3210`) and omit `address`, whereas `GET /admin/workers/{id}` returns unmasked `mobile` (`+919685743210`) and `address` (`area`, `city`).
     - `GET /admin/support/tickets` list items omit complainant/creator display names (only exposing `creatorUserId`, `creatorKind`, `category`, `priority` which may be `null`, `createdAt`, `closedAt`).
     - `GET /admin/interviews`, `GET /admin/replacement-requests`, `GET /admin/payments`, and `GET /admin/support/tickets`: do not accept server-side `from`/`to` (`createdFrom`/`createdTo`) date query parameters in OpenAPI; client-side IST date filtering is required after paginated retrieval.
     - `GET /admin/replacement-requests`: exposes `replacementBookingId` rather than replacement worker name directly.
- **Safe Frontend Enrichment Implemented (`reportDetailEnricher.ts`):**
  - When `includeDetailedRecords: true` is active in Report Detail View and Exports, `RealReportRepository` fetches paginated records (`limit=100`) from the documented OpenAPI endpoints, selectively enriches records via `GET /admin/customers/{id}`, `GET /admin/workers/{id}`, and `GET /admin/bookings/{id}` (with in-memory caching, bounded concurrency, and `phoneDirectory.ts` resolution) so authorized reports display unmasked `+91 XXXXX XXXXX` numbers (stored as Excel text `@`), real customer/worker names, localities, complainant names, and clean business worksheets without developer notes.
- **Exact Action Required from Backend Team:**
  1. Include `customerUserId`, `cancelledAt`, and customer summary on `GET /admin/bookings` list items so list callers do not need N+1 `GET /admin/bookings/{id}` hydration.
  2. Fix HTTP `502` on `/api/v1/admin/reports/export/top-rated-workers` and `/api/v1/admin/reports/export/repeat-customers`.
  3. Add `createdFrom`/`createdTo` date filters to `/admin/interviews`, `/admin/replacement-requests`, `/admin/payments`, and `/admin/support/tickets`, and include `creatorName` on `/admin/support/tickets`.
  4. Add `confirmedCount` to `/api/v1/admin/reports/demand-by-category` and allow authorized list projections to include locality/city without N+1 detail fetches.

---

### GAP-BE-014: Operations Admin Server-Issued Permissions vs. Verification & Support Write Actions (Category D / F)
- **Audit Date:** 2026-11-12 (Live probes with `OPERATIONS_ADMIN` credentials and `GET /api/v1/admin/roles`)
- **Module & Workflow:** Operations Admin Role (`Worker Management`, `Payments Management`, `Support Management`)
- **Live Server-Issued `OPERATIONS_ADMIN` Permissions (25 keys):**
  `alert.manage`, `alert.view`, `area.manage`, `attendance.manage`, `attendance.view`, `booking.manage`, `booking.view`, `category.manage`, `customer.manage`, `customer.view`, `matching.run`, `notification.manage`, `payment.view`, `rating.moderate`, `rating.view`, `replacement.manage`, `replacement.view`, `report.view`, `support.view`, `user.view`, `verification.reassign`, `verification.signoff`, `worker.activate`, `worker.manage`, `worker.view`.
- **Confirmed 403 Responses for `OPERATIONS_ADMIN` on Live Backend:**
  - `GET /api/v1/admin/verification/queue` -> `403 Forbidden` (`verification.review` is NOT granted to `OPERATIONS_ADMIN`).
  - `GET /api/v1/admin/workers/{id}/verification` -> `403 Forbidden` (requires `verification.review`).
  - `GET /api/v1/admin/roles` -> `403 Forbidden` (`config.manage` is NOT granted).
  - `GET /api/v1/admin/audit-logs` -> `403 Forbidden` (`audit.view` is NOT granted).
  - Operations Admin also does NOT receive `payment.refund`, `payment.manage`, or `support.manage` in the live database seed.
- **Frontend Alignment Implemented:**
  - `WorkerDetailModal.tsx`: skips `/admin/workers/{id}/verification` dossier query when `verification.review` is absent so Ops Admin never triggers background `403` errors, while keeping `verification.signoff`, `worker.activate`, availability/category updates (`worker.manage`), and rating moderation (`rating.view`/`rating.moderate`) functional.
  - `TransactionDetailModal.tsx`: gates `Reconcile with Gateway` on `payment.manage` (`PERMISSIONS.PAYMENT_MANAGE`), matching `Process Refund` (`payment.refund`).
- **Exact Action Required from Backend Team:**
  - Confirm whether `OPERATIONS_ADMIN` should receive `verification.review` (read-only dossier inspection) to view verification check prerequisites alongside `verification.signoff`, and whether `support.manage` / `payment.refund` are intentionally withheld per PRD/role-matrix or should be granted.

---

### GAP-BE-015: `GET /admin/bookings/{id}` & `GET /admin/workers/{id}` Response Omissions (Category D)
- **Audit Date:** 2026-11-12 (Live API response audit)
- **Module & Workflow:** Booking Management & Worker Management
- **Observed Payload Omissions:**
  1. `GET /api/v1/admin/bookings/{id}` does not return `allowedActions` (`undefined` in live payloads), so the frontend must derive allowed lifecycle transitions directly from the canonical backend `status` (`NEW_REQUEST` -> `/match` or `/schedule`, `MATCHED` -> `/schedule` or `/reopen-matching`, `INTERVIEW_TRIAL_SCHEDULED` -> `/interview-complete`, `INTERVIEW_TRIAL_COMPLETED` -> `/confirm-worker`, `CONFIRMED` -> `/start`, `ACTIVE` -> `/complete`).
  2. `GET /api/v1/admin/workers/{id}` omits `signedOffAt`, `activatedAt`, and `verificationLevel` fields that are present in `GET /api/v1/admin/workers` list projections.
- **Safe Frontend Handling Implemented:**
  - `BookingsListPage.tsx` and `BookingDetailModal.tsx` enforce exact state-machine button transitions matching backend `@Post` endpoints (`/match`, `/schedule`, `/reopen-matching`, `/interview-complete`, `/confirm-worker`, `/start`, `/complete`).
  - `RealBookingRepository.getCandidateSuggestions` extracts real `category.code`, `area.id` UUID, `availableFrom`, `availableTo`, and `engagement` (falling back to `/admin/service-areas` UUID lookup when `area.id` is absent) so `POST /admin/matching/candidates` succeeds without `422` validation failures.
  - `WorkerDetailModal.tsx` evaluates `isSignedOff` and `isOnboarded` using fallback flags (`isFullyVerified`, `verificationStatus`, `status`) when detail payloads omit timestamps.

---

### GAP-BE-016: Customer Verification Governance Endpoint Confirmed (Category H — RESOLVED)
- **Module & Workflow:** Customer Management (`CustomerDetailModal.tsx`)
- **Verified Contract:** `PATCH /api/v1/admin/customers/{id}/verification-status` accepts `{ status: "PENDING" | "VERIFIED", note?: string }` with optimistic concurrency `If-Match` header.
- **Frontend Alignment Implemented:** Added `updateCustomerVerificationStatus` in `customerRepository.ts` and verification status toggle action in `CustomerDetailModal.tsx` gated on `customer.manage` (`PERMISSIONS.CUSTOMERS_MANAGE`).

---

### GAP-BE-017: Operations Admin Dashboard — Activity Feed, Customer Section & Worker Definition Delta (Category A / D)
- **Audit Date:** 2026-11-12 (Live probe to `GET /admin/dashboard`, `/admin/audit-logs`, `/admin/reports/worker-utilization`)
- **Module & Workflow:** Operations Admin Dashboard (`/dashboard`, `OperationsAdminDashboard.tsx`)
- **Expected PRD Behaviour:** Display recent operational activity updates, customer registration/verification summaries, and available/active worker counts on the Operations Command Console.
- **Observed Backend Behaviour:**
  1. `GET /api/v1/admin/audit-logs` returns `403 FORBIDDEN` for `OPERATIONS_ADMIN` (`audit.view` not granted), and OpenAPI defines no dedicated operational activity endpoint (`/admin/activity`).
  2. `GET /api/v1/admin/dashboard` omits the `customers` section for `OPERATIONS_ADMIN` (only returning `bookings`, `workers`, `complaints`, `replacements`, `alerts`, `collections`).
  3. `GET /api/v1/admin/dashboard` reports `sections.workers.verifiedAndActive: 28`, whereas `GET /api/v1/admin/reports/worker-utilization` reports `verifiedWorkers: 34` (`workersWithActiveBooking: 2`).
- **Safe Frontend Handling:** Dashboard fetches `customersTotal`/`Verified`/`Pending` via permitted `GET /admin/customers?limit=1` filters, daily registrations via `GET /admin/reports/new-customers` & `worker-registrations`, available workers from `worker-utilization`, and displays an honest permission/unavailable notice for Recent Operational Activity when `audit.view` is absent without manufacturing fake logs.
- **Exact Action Required from Backend Team:**
  1. Expose a scoped `GET /api/v1/admin/activity` endpoint (or `recentActivity` inside `GET /api/v1/admin/dashboard`) permitted under `dashboard.view` for operational events (booking/attendance/replacement/alert changes) without granting full `audit.view`.
  2. Include `customers` (`total`, `verified`, `pendingVerification`) inside `GET /api/v1/admin/dashboard` sections for Operations Admin and clarify the definition delta between `sections.workers.verifiedAndActive` and `worker-utilization.verifiedWorkers`.

---

### GAP-BE-018: Attendance & Daily Logs — Missing Global `GET /admin/attendance` Endpoint, Filters & Name Enrichment (Category A / B / D)
- **Audit Date:** 2026-11-12 (OpenAPI & live probe across `/admin/bookings` & `/admin/attendance/*`)
- **Module & Workflow:** Attendance & Daily Logs (`/attendance`, `AttendanceLogsPage.tsx`)
- **Expected PRD Behaviour:** Operations Admin views platform-wide attendance logs directly on `/attendance` with summary totals (`Total Recorded`, `Present`, `Absent`, `Exceptions`), filters by `search`, `from`, `to`, and `status`, paginates reliably across all bookings, and records or corrects daily attendance.
- **Backend Audit Findings:**
  1. **Only Booking-Scoped Endpoints Exist:** OpenAPI defines `GET /api/v1/admin/attendance/bookings/{bookingId}`, `GET /api/v1/admin/attendance/bookings/{bookingId}/summary`, `POST /api/v1/admin/attendance/bookings/{bookingId}`, and `PATCH /api/v1/admin/attendance/{attendanceId}`. There is **no `GET /api/v1/admin/attendance`** global listing or **`GET /api/v1/admin/attendance/summary`** cross-booking summary endpoint.
  2. **Scalability & Reliability Limit of Booking Fan-Out:** On live database inspection (`50` total bookings; `23` post-match bookings with `workerId`; `6` bookings holding `26` total attendance records, including `ACTIVE`, `COMPLETED`, and `CANCELLED` bookings), client-side N+1 aggregation (`GET /admin/bookings` pages + per-booking `/admin/attendance/bookings/{id}`) is temporarily bounded (`<= 80` started bookings), **but cannot reliably scale**: as bookings grow, N+1 fan-out hits rate limits (`429 RATE_LIMITED`), increases failure surface, and cannot provide server-side cross-booking pagination, sorting, or filtering.
  3. **Missing Query Params & Response Enrichment:** `GET /admin/attendance/bookings/{bookingId}` supports `page`, `limit`, `from`, `to` only — lacking `status` and `search` query params — and omits `customerName`, `workerName`, and readable short booking references. Additionally, `GET /api/v1/admin/bookings` list items omit `customerUserId` and `customerName` (only `GET /api/v1/admin/bookings/{bookingId}` includes `customerUserId`), and `GET /api/v1/admin/customers/{id}` rejects `customerUserId` (`404 CUSTOMER_NOT_FOUND`), forcing extra detail calls plus full `/admin/customers` list lookup to resolve customer names on attendance rows.
  4. **Timestamps & Concurrency:** `AdminRecordAttendanceDto` (`POST`) accepts `{ date, status, note? }` (`Idempotency-Key` optional header; `409 BOOKING_NOT_ACTIVE` for non-active bookings) without manual check-in/out inputs; `PATCH /admin/attendance/{attendanceId}` requires `{ status, note?, reason }` and does not declare `ETag` / `If-Match` concurrency headers in OpenAPI.
- **Safe Frontend Handling:** `RealBookingRepository.getAllAttendanceOverview` paginates all `/admin/bookings`, `/admin/customers`, and `/admin/workers` pages (caching registries for 60s), batched `/admin/attendance/bookings/{id}` pages with an explicit safety limit (`80` started bookings) and failure counter (`isComplete` / `failedBookingsCount`), and lazily batch-enriches rendered/active bookings lacking `customerUserId` via `GET /admin/bookings/{id}` (`bookingDetailCache`) before resolving real customer names.
- **Exact Action Required from Backend Team:**
  1. Implement `GET /api/v1/admin/attendance` supporting query params: `page`, `limit`, `from` (`YYYY-MM-DD`), `to` (`YYYY-MM-DD`), `status` (`PRESENT | ABSENT | LATE | LEAVE | EXCEPTION`), `search` (booking ID/ref, customer name, worker name, note), and optional `bookingId`, returning `{ data: AdminGlobalAttendanceView[], meta: { page, limit, total } }` with inline `customerName` and `workerName`.
  2. Include `customerUserId` (and optionally `customerName`) on `GET /api/v1/admin/bookings` list items to eliminate secondary per-booking detail fetches.
  3. Implement `GET /api/v1/admin/attendance/summary` supporting `from`, `to`, `search` returning `{ totalRecorded, present, absent, exception, late, leave }`.
  4. Optionally support `ETag` / `If-Match` on `PATCH /api/v1/admin/attendance/{attendanceId}`.

---

### GAP-BE-019: Ratings & Reviews — Missing Name Enrichment, Aggregate Summary & Filter Query Parameters (Category B / D)
- **Audit Date:** 2026-11-12 (OpenAPI & live probe across `/admin/ratings/*`)
- **Module & Workflow:** Ratings & Reviews (`/ratings`, `RatingsReviewsPage.tsx`)
- **Expected PRD Behaviour:** Operations Admin views ratings overview (total, average, distribution, pending moderation), searches by worker/customer name, and filters by star rating, date range, and moderation status.
- **Observed Backend Behaviour:**
  1. `GET /api/v1/admin/ratings` supports `page`, `limit`, `status` (`VISIBLE|HIDDEN`), `workerId`, `bookingId`, but omits `score`, `from`/`to` date filters, and text `search`.
  2. Items expose `workerId` and `customerUserId` without `workerName` or `customerName`.
  3. Only per-worker summary (`GET /api/v1/admin/ratings/workers/{workerId}/summary`) exists; there is no platform-wide `GET /api/v1/admin/ratings/summary` aggregate endpoint or `PENDING_MODERATION` status enum (only `VISIBLE` and `HIDDEN`).
- **Safe Frontend Handling:** `ratingRepository.ts` enriches names using cached `/admin/workers` and `/admin/customers` lists, obtains authoritative `VISIBLE`/`HIDDEN` counts via server `meta.total`, and loads complete pages before applying secondary score/date/search filters so partial-page distortion never occurs.
- **Exact Action Required from Backend Team:**
  1. Add `workerName` and `customerName` to `AdminRatingView` items on `GET /api/v1/admin/ratings` and `GET /api/v1/admin/ratings/{ratingId}`.
  2. Add server-side `score`, `from`, `to`, and `search` query params to `GET /api/v1/admin/ratings`.
  3. Expose `GET /api/v1/admin/ratings/summary` returning global `total`, `average`, `scaleMax`, and star distribution counts.

---

### GAP-BE-020: Payments Management — Missing Name & Category on `/admin/payments`, Merchant Entity in Customer Registry, and Raw Developer CSV Export (Category B / C / D)
- **Audit Date:** 2026-11-13 (OpenAPI & live probe across `/admin/payments`, `/admin/payments-export`, `/admin/reports/payment-collections`, and `/admin/customers`)
- **Module & Workflow:** Financial Transactions & Refunds (`/payments`, `PaymentsListPage.tsx`, `paymentRepository.ts`)
- **Expected PRD Behaviour:** Operations Admin views transaction ledgers with authentic Customer Name, Customer Phone, Booking Reference, Service Category, Fee Classification, Amount, Method, Status, and Date. Filters by search, fee type, status, and exports complete filtered dataset to formatted Excel (.xlsx) and clean CSV with business headers.
- **Backend Audit Findings:**
  1. **Missing Name, Phone & Category on Payment Items:** `GET /api/v1/admin/payments` items return `customerUserId`, `bookingId`, `amountMinor`, `feeCode`, but omit `customerName`, `customerPhone`, `serviceCategory`, and readable short booking reference.
  2. **Merchant / Test Placeholder Entity in Customer Registry:** Customer `01a192ee-1a73-7449-9822-da9ac3221ef2` has registered `name: "PawGuard"`, `email: "pawguard@gmail.com"`, which was appearing as the customer name for linked transactions instead of an authentic customer name.
  3. **No Server-Side Text Search or FeeType Filter:** `GET /api/v1/admin/payments` only accepts `page`, `limit`, `status`, `bookingId`, `refunded`, `customerUserId`. It lacks `search` and `feeType` query parameters.
  4. **Raw Developer CSV on `/admin/payments-export`:** `GET /api/v1/admin/payments-export` returns raw developer columns (`payment_id`, `provider_order_id`, `provider_payment_id`, `amount_minor`, `currency`, raw UTC timestamps) without resolved customer names, formatted booking references, service categories, or fee classifications.
- **Safe Frontend Handling:**
  1. `RealPaymentRepository` cross-references `customerUserId` and `bookingId` with pre-cached `/admin/customers` and `/admin/bookings` registries to resolve genuine customer names, formatted `BK-XXXXXXXX` booking references, and real service categories (`Cook`, `House Maid`, `Driver`, etc.).
  2. `isInvalidCustomerName()` filters out merchant/test entities (`PawGuard`, `SevaNest`, `Merchant`, `Platform`, UUIDs, test placeholders), displaying `"Customer Details Unavailable"` instead of test brand names.
  3. Multi-page pagination (`getAllFilteredTransactions`) fetches all payment pages (`limit: 100`) and applies text search and fee type filtering across the complete ledger, preventing page-1 truncation.
  4. Client-side export generator creates structured Excel (.xlsx) with business metadata headers, IST dates, and formatted currency, and clean UTF-8 BOM CSV.
- **Exact Action Required from Backend Team:**
  1. Enrich `GET /api/v1/admin/payments` response items with `customerName`, `customerPhoneMasked`, and `serviceCategory` directly.
  2. Clean up test customer `pawguard@gmail.com` in customer database or flag as internal test entity.
  3. Add `search` and `feeType` query parameters to `GET /api/v1/admin/payments`.
  4. Update `GET /api/v1/admin/payments-export` to output business-oriented columns (Customer Name, Booking Ref, Service Category, Fee Classification, Formatted Amount).
