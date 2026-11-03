# SevaNest Admin Portal — Worker Verification Backend Gap & Contract Dependency Report

**Document Version:** 1.0.0  
**Audit Date:** October 2026  
**Auditor:** Antigravity Senior Frontend & Integration Architecture Team  
**Scope:** Worker Verification, 6-Point Trust Verification, Reviewer Ownership, Dossier Inspection, and Platform Matching Eligibility Workflows  
**Target Backend:** SevaNest Admin REST API (`/api/v1/admin/...`)

---

## Executive Summary

This report provides a comprehensive, evidence-grounded audit of the SevaNest backend API contracts against the frontend requirements for the **Worker Verification Executive** role and associated trust operations in the SevaNest Admin Portal.

All findings are based on the deployed OpenAPI v3 specification (`scratch/deployed-openapi.json`), real runtime endpoint probes, and frontend repository integration audits.

The frontend implementation strictly adheres to the principle of **no synthetic data, no local status fabrication, and no mock fallbacks in production paths**. Where backend endpoints or fields are missing, the frontend displays clear, non-blocking operational states and documents the required backend contracts herein.

---

## Summary of Backend Endpoint Contracts

| Workflow Capability | Documented Backend Endpoint | HTTP Method | Status in OpenAPI | Frontend Integration Status |
|---------------------|-----------------------------|-------------|-------------------|-----------------------------|
| **Verification Queue** | `/api/v1/admin/verification/queue` | `GET` | ✅ Present | Fully Integrated with status parameter normalization |
| **Worker Verification Record** | `/api/v1/admin/workers/{workerId}/verification` | `GET` | ✅ Present | Fully Integrated (returns authoritative `level` and checks) |
| **Claim Review (Start)** | `/api/v1/admin/verification/checks/{checkId}/start-review` | `POST` | ✅ Present | Fully Integrated with 409 conflict handling |
| **Release / Unclaim Review** | `/api/v1/admin/verification/checks/{checkId}/release-review` | `POST` | ❌ Missing | **GAP-VERIF-01** (Documented below) |
| **Approve Check** | `/api/v1/admin/verification/checks/{checkId}/approve` | `POST` | ✅ Present | Fully Integrated with confirmation step & remarks |
| **Reject Check** | `/api/v1/admin/verification/checks/{checkId}/reject` | `POST` | ✅ Present | Fully Integrated with category & mandatory remarks |
| **Request Re-Verification** | `/api/v1/admin/verification/checks/{checkId}/recheck` | `POST` | ✅ Present | Fully Integrated with mandatory instructions |
| **Signed Document URL** | `/api/v1/admin/verification/documents/{documentId}/link` | `GET` | ✅ Present | Fully Integrated with URL safety validation & expiry |
| **Commercial Account Activation** | `/api/v1/admin/workers/{workerId}/activate` | `POST` | ❌ Missing | **GAP-VERIF-02** (Documented below) |
| **Worker-Level Composite Approval** | `/api/v1/admin/workers/{workerId}/approve` | `POST` | ❌ Not Present (By Design) | **ARCH-VERIF-01** (Documented below) |

---

## Detailed Gap Analysis & Actionable Items

### GAP-VERIF-01: Missing Review Release / Unclaim Review Endpoint

- **Workflow Step:** Review Ownership & Workload Reassignment (Section 6: My Reviews)
- **Required Capability:** When a Verification Executive claims a check (`POST /checks/{checkId}/start-review`), the review transitions to `IN_REVIEW` assigned to that reviewer. If the executive goes off-shift, encounters a conflict of interest, or requires team lead intervention, they must be able to release ownership back to the unassigned queue.
- **Existing Endpoint:** `POST /api/v1/admin/verification/checks/{checkId}/start-review` (Claim only).
- **Missing Endpoint:** `POST /api/v1/admin/verification/checks/{checkId}/release-review` (or `/unclaim`).
- **Expected Request Contract:**
  ```http
  POST /api/v1/admin/verification/checks/{checkId}/release-review
  Authorization: Bearer <token>
  Content-Type: application/json

  {
    "reason": "Executive shift completed; returning to unassigned queue"
  }
  ```
- **Expected Response Contract:**
  ```json
  {
    "success": true,
    "data": {
      "checkId": "chk-identity-101",
      "status": "SUBMITTED",
      "assignedTo": null,
      "releasedAt": "2026-10-23T10:45:00Z"
    }
  }
  ```
- **Current Frontend Behavior:** The frontend documents this limitation. Only `claimCheck` is exposed. No fake local unclaim is simulated.
- **Classification:** Missing Endpoint in backend OpenAPI specification.
- **Action Required from Backend Team:** Expose `POST /api/v1/admin/verification/checks/{checkId}/release-review` or `unclaim` to reset check state from `IN_REVIEW` to `SUBMITTED` and clear `reviewerUserId`.

---

### GAP-VERIF-02: Commercial Roster Activation Decoupled from KYC Approval

- **Workflow Step:** Worker Acceptance, Account Status, and Platform Matching Eligibility (Section 5)
- **Required Capability:** Explicitly activate a worker onto the active commercial roster after KYC verification is completed.
- **Context & Business Rules:**
  - In backend `GET /api/v1/admin/workers`:
    > *"verified: true = only fully verified workers (level = VERIFIED). Note: verification does not change the account status."*
  - Matching eligibility requires **both**:
    1. KYC Verification: `worker.isFullyVerified === true` (`level === 'VERIFIED'`).
    2. Operational Account Status: `worker.status === 'ACTIVE'`.
  - The backend OpenAPI specification does **not** expose commercial activation endpoints (`POST /admin/workers/{workerId}/activate` or `/deactivate`).
- **Observed Behavior:** Approving all 5 operational verification checks sets `level: "VERIFIED"`. However, if the worker's operational status is `INACTIVE` or `PENDING_ACTIVATION`, they remain ineligible for customer matching.
- **Current Frontend Behavior:** The frontend explicitly decouples KYC verification from account roster status:
  - Step 4 / Dossier Summary displays authoritative `level` returned by the backend.
  - Step 5 / Worker Profile displays Platform Matching Eligibility with explanatory notices informing the executive that commercial activation must be performed via Operations Admin workflows.
  - Workers Directory enforces the same two-tier rule without fabricating activation states.
- **Classification:** Missing Commercial Activation Endpoint / Unconfirmed Lifecycle Event.
- **Action Required from Backend Team:** Clarify whether account activation is an automated backend event upon full KYC approval or requires an explicit `POST /admin/workers/{workerId}/status` mutation by an Operations Admin.

---

### ARCH-VERIF-01: Check-by-Check Decision Architecture vs Worker-Level Decision Endpoint

- **Workflow Step:** Final Worker Verification Decision (Section 4)
- **Observed Architecture:**
  - The backend does **not** expose a single composite endpoint such as `POST /admin/workers/{workerId}/approve` or `POST /admin/workers/{workerId}/reject`.
  - The backend maintains an **atomic check architecture**:
    1. Identity Proof (`IDENTITY`)
    2. Residential Address Proof (`ADDRESS`)
    3. Emergency Contact Vetting (`EMERGENCY_CONTACT`)
    4. Employer Reference Vetting (`REFERENCE`)
    5. Police Clearance Certificate (`POLICE_CLEARANCE`)
  - When each individual check is approved via `POST /api/v1/admin/verification/checks/{checkId}/approve`, the backend recalculates `level` on `GET /api/v1/admin/workers/{workerId}/verification`:
    - `VERIFIED` when all required checks are `APPROVED`.
    - `IN_PROGRESS` when at least one check is in progress or pending.
    - `NOT_STARTED` when checks have not commenced.
- **Current Frontend Behavior:**
  - In `VerificationQueuePage` and `WorkerDetailModal`, executives approve or reject individual checks with confirmation modals.
  - The UI presents an Authoritative Overall Verification & Matching Eligibility card displaying the genuine backend `level` and check count without inventing a synthetic composite mutation.
- **Classification:** Architectural Contract Alignment (Resolved in Frontend).
- **Action Required from Backend Team:** Keep current architecture or document if a future composite endpoint will be introduced.

---

### GAP-VERIF-03: Queue Filter Parameter Enum Mismatch (`SUBMITTED` vs `PENDING_REVIEW`)

- **Workflow Step:** Verification Queue Loading & Tab Filtering (Section 2)
- **Observed Discrepancy:**
  - Backend OpenAPI specification for `GET /api/v1/admin/verification/queue`:
    - Parameter: `status`
    - Allowed Schema Enum: `["NOT_SUBMITTED", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"]`
  - Frontend domain models and product requirements historically used `PENDING_REVIEW`. Passing `status=PENDING_REVIEW` caused runtime query failures (HTTP 400).
- **Frontend Resolution:**
  - In `verificationRepository.ts`, `filter.status === 'PENDING_REVIEW'` is automatically mapped to `params.status = 'SUBMITTED'`.
  - On receiving items, raw status `'SUBMITTED'` is normalized to `'PENDING_REVIEW'` for presentation consistency.
- **Classification:** Parameter Schema Normalization (Resolved in Frontend).
- **Action Required from Backend Team:** Accept `PENDING_REVIEW` as an alias in query parameters to ensure developer ergonomics across microservices.

---

### GAP-VERIF-04: Document Metadata and Check ID Extraction in Queue Endpoint

- **Workflow Step:** Queue Ingestion to Dossier Split-Screen Review
- **Observed Discrepancy:**
  - `GET /api/v1/admin/verification/queue` returns `QueueItem` objects containing:
    `checkId`, `checkType`, `workerId`, `workerName`, `category`, `status`.
  - It does **not** include the full `checks: []` array or document metadata.
- **Frontend Resolution:**
  - In `verificationRepository.ts`, `mapChecks` was updated to construct the check record directly from `checkType` and `checkId` if `raw.checks` is missing.
  - When a dossier is selected, the frontend invokes `GET /api/v1/admin/workers/{workerId}/verification` to fetch complete document metadata, check IDs, and the authoritative `level`.
- **Classification:** Payload Optimization Recommendation.
- **Action Required from Backend Team:** Optional optimization: Include `checks` summary in `QueueItem` to minimize secondary network roundtrips.

---

### GAP-VERIF-05: Account Status vs KYC Status Mismatch & Workforce Acceptance Separation

- **Workflow Step:** Workforce Acceptance & Directory Visibility (Section 5 & 6)
- **Investigated Discrepancy:**
  - In `/workers`, some workers appeared with `Account Status: ACTIVE` while `KYC Status: PENDING`.
  - Thorough investigation of the backend domain model revealed:
    1. `worker.status` (`ACTIVE`, `SUSPENDED`, `BLACKLISTED`) represents the worker's operational account lifecycle. New worker registrations default to `ACTIVE`.
    2. `worker.isFullyVerified` / `worker.verificationStatus` represents KYC compliance (`level === 'VERIFIED'`).
    3. The backend documentation explicitly notes: *"verified: true = only fully verified workers (level = VERIFIED). Note: verification does not change the account status."*
  - Therefore, an active account with pending KYC is **authoritative backend data**, not a frontend defect.
- **Frontend Resolution:**
  - Decoupled and clarified the directory table columns: "KYC Status" vs "Account Status".
  - Enforced strict compound filtering on the "Active & Verified Roster (Matching Eligible)" tab: `worker.isFullyVerified === true && worker.status === 'ACTIVE'`.
  - Workers with pending KYC appear strictly in "All Registered Workers" and "Pending Verification / Incomplete KYC".
- **Classification:** Domain Lifecycle Separation / Business Rule Clarification.
- **Action Required from Backend Team:** None; current backend model is validated and correctly adhered to by the frontend.

---

### GAP-VERIF-06: Verification Queue Server-Side Reviewer Filter (`assignedTo=me`)

- **Workflow Step:** My Reviews Workstation (`viewMode === 'my-reviews'`)
- **Observed Discrepancy:**
  - The deployed OpenAPI specification for `GET /api/v1/admin/verification/queue` lists query parameters: `page`, `pageSize`, `status`, `category`, and `search`.
  - It does **not** officially document `assignedTo` or `reviewerId`.
- **Frontend Resolution:**
  - The frontend passes `assignedTo=me` in query parameters and also performs client-side ownership validation via `resolveClaimOwnership(item.reviewerUserId, item.claimedAt, user.id)`.
- **Classification:** Missing Filter Parameter in OpenAPI Specification.
- **Action Required from Backend Team:** Support server-side `assignedTo=me` or `reviewerId={uuid}` filtering to prevent over-fetching in high-volume queues.

---

### GAP-VERIF-07: Telephonic Vetting Call Notes and Call Outcome Persistence

- **Workflow Step:** 6-Point Verification (Emergency Contact & Prior Employer Reference)
- **Observed Discrepancy:**
  - Verification Executives record detailed call notes during live phone vetting with references and emergency contacts.
  - The backend only accepts `notes` or `remarks` upon final check decision (`POST /checks/{checkId}/approve` or `POST /checks/{checkId}/reject`).
  - There is no interim endpoint (e.g., `PATCH /checks/{checkId}/notes` or `POST /checks/{checkId}/call-attempt`) to save notes or record call outcomes (e.g., "Reference unreachable on first call; scheduled retry").
- **Classification:** Missing Interim Call Logging / Notes Persistence Endpoint.
- **Action Required from Backend Team:** Expose `PATCH /api/v1/admin/verification/checks/{checkId}/notes` or call attempt tracking endpoint.

---

### GAP-VERIF-08: Document Signed URL Expiration and Missing Document Reference Integrity

- **Workflow Step:** Submitted Documents Vault & Inspection Canvas
- **Observed Discrepancy:**
  - `GET /api/v1/admin/verification/documents/{documentId}/link` returns short-lived signed URLs for confidential documents.
  - If a worker uploaded a document without an assigned database `documentId`, querying the document link returns HTTP 400/404.
- **Frontend Resolution:**
  - Implemented safe document link querying with `documentUrlValidator.ts` and fallback to non-crashing disabled states when `documentId` is missing.
- **Classification:** Error Handling & Document Storage Reference Integrity.
- **Action Required from Backend Team:** Ensure mobile worker upload pipeline guarantees foreign-key `documentId` assignment on all submitted verification checks.

---

## RBAC & Security Policy Verification

| Role | Verification Queue Access | Inspect Dossier | Approve / Reject Check | Request Recheck | Workers Directory |
|------|---------------------------|-----------------|------------------------|-----------------|-------------------|
| **Verification Executive** | ✅ Full Access | ✅ Full Access | ✅ Permitted (`verification.decide`) | ✅ Permitted (`verification.review`) | ✅ Permitted (Read-only) |
| **Super Admin** | ✅ Full Access | ✅ Full Access | ✅ Permitted (`verification.decide`) | ✅ Permitted (`verification.review`) | ✅ Full Access |
| **Operations Admin** | ✅ Read-only oversight | ✅ View Only | ❌ Forbidden (Buttons hidden & guarded) | ❌ Forbidden | ✅ Full Access |
| **Support Executive** | ❌ No Access | ❌ No Access | ❌ Forbidden | ❌ Forbidden | ✅ Read-only profile access |

All actions enforce backend permission keys (`verification.decide`, `verification.review`, `verification.document.view`). Unauthorized roles are rendered read-only or routed to access-controlled empty states without leaking PII or document links.

---

## Conclusion & Next Steps

1. **Frontend Completion:** The worker verification workflow is fully complete, type-safe, and integrated with genuine backend endpoints.
2. **Quality Gates Passed:**
   - Vitest: 36 test files, 444 tests passing (11 verification test files, 164 verification tests).
   - TypeScript: `tsc --noEmit` exited 0 (zero errors).
   - ESLint: exited 0 with 0 warnings and 0 errors.
   - Vite: Production bundle successfully built (`dist/`).
   - Docker: Built and serving `http://localhost:8080` (HTTP 200 OK, healthy).
3. **Backend Recommendations:** Implement `release-review` endpoint (**GAP-VERIF-01**), clarify commercial roster activation endpoint (**GAP-VERIF-02**), and support server-side `assignedTo=me` filtering (**GAP-VERIF-06**).
