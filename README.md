# SevaNest Web Admin & Operations Portal

> **Enterprise Operations & Marketplace Administration Console**  
> Tagline: *Verified Help. Trusted Homes.*  
> Architecture: Layered, Feature-First React + TypeScript Single Page Application (SPA)

---

## 1. Project Overview

The **SevaNest Web Admin Portal** is the internal command center for operations staff managing a verified domestic workforce marketplace (Maids, Drivers, Cooks, Babysitters, Elderly Care Helpers, and Cleaning Helpers).

The portal serves four core administrative personas through server-issued permission evaluation:
1. **Super Admin:** Platform masters, pricing, geographic clusters, notification templates, RBAC governance, and authoritative audit logs.
2. **Operations Admin:** Booking pipeline triage, candidate worker matching, trial scheduling, replacement fulfillment, and audited refunds.
3. **Verification Executive:** Worker KYC document authentication (1 automated OTP pre-check + 5 operations-reviewed checks) and re-verification queues.
4. **Support Executive:** Grievance ticket triage, real-time SLA countdown tracking, dispute resolution, and escalation handoffs.

---

## 2. Technology Stack & Architectural Layers

- **Framework & Build:** React 18+, TypeScript (Strict), Vite
- **Routing:** React Router (v6+) with declarative route guards and accessible `NoAccessView`
- **State Management:** TanStack Query (v5) for server state caching; Zustand for lightweight in-memory session state
- **Form Handling:** React Hook Form + Zod schema validation
- **HTTP Client:** Axios with interceptor pipeline (Correlation IDs, Bearer Token injection, Version headers, Idempotency keys, and Domain Error mapping)
- **Data Tables:** TanStack Table (v8)
- **Icons:** Lucide React
- **Testing:** Vitest, React Testing Library, MSW (Mock Service Worker)

### Four-Layer Architecture:
1. **Presentation Layer (`src/features/*/presentation`, `src/layouts`):** Pure React views, dialogs, drawers, route guards, and UI hooks. Zero direct HTTP calls or business logic.
2. **Domain Layer (`src/features/*/domain`, `src/core/rbac`):** Framework-independent TypeScript entities, value types, permission policies, and repository interfaces.
3. **Data Layer (`src/features/*/data`, `src/core/api`):** Repository implementations, DTO mapping, and API integration satisfying domain interfaces.
4. **Core / Shared Layer (`src/core`, `src/shared`):** In-memory auth store, PII-safe logging, error taxonomy, IST/INR formatters, and design system components.

---

## 3. Getting Started & Development Commands

### Prerequisites
- **Node.js:** v18.0.0 or higher (Tested with Node v24.x)
- **NPM:** v9.0.0 or higher

### Environment Setup
1. Copy the environment variables template:
   `````bash
   cp .env.example .env.local
   ```
2. Configure `VITE_API_BASE_URL` to point to your local or staging Admin API Gateway.

### Installation
`````bash
npm install
```

### Running with Docker & Docker Compose

#### Production Mode (Nginx SPA + Reverse Proxy)
Ensure Docker Desktop is running, then execute:
```bash
docker compose up --build -d
```
The application will be served at http://localhost:3000 with Nginx handling SPA routing and reverse-proxying /api/ to the backend gateway.

To stop the container:
```bash
docker compose down
```

#### Development Mode with Hot Reload (HMR in Container)
```bash
docker compose --profile dev up --build
```
This mounts the local repository and runs the Vite dev server inside Docker on http://localhost:3001.

### Available NPM Scripts
- `npm run dev` — Start the local development server (Default port: `http://localhost:3000`)
- `npm run build` — Execute typechecking and produce production build bundle in `dist/`
- `npm run typecheck` — Run TypeScript compiler check without emitting files
- `npm run lint` — Execute ESLint static analysis across TS/TSX files
- `npm run test` — Run all Vitest unit and component test suites

---

## 4. Key Security & Privacy Safeguards
- **In-Memory Access Tokens:** Access tokens are stored strictly in client memory (Zustand store) and are **never** written to `localStorage` or `sessionStorage`.
- **PII Masking:** Customer and worker phone numbers and emails are masked in routine lists. Unmasking requires clicking `Reveal PII`, providing a mandatory business reason, and creates an audit log entry.
- **Trust Before Verified:** The frontend never independently computes or displays a verified trust badge; the badge reflects the backend-evaluated status of all 6 checks.
- **Mandatory Remarks:** Rejections, cancellations, suspensions, blacklisting, and refund actions mandate operational rationale notes.



