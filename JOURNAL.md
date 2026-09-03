# iLoyalty — Development & Architecture Journal

**Project Name:** iLoyalty — Cross-Hotel Loyalty Platform (Version One)  
**Date:** September 3, 2026  
**Format:** Markdown (`JOURNAL.md`)  
**Repository Location:** `k:/Users/mawon/Desktop/iLoyalty`  
**Current Status:** All 10 Stages Complete • 28/28 Test Suites Passing • Production & Offline Demo Ready  

---

## 📖 Table of Contents
1. [Executive Summary & Vision](#1-executive-summary--vision)
2. [Architectural Invariants & Design Principles](#2-architectural-invariants--design-principles)
3. [Chronological Development Log](#3-chronological-development-log)
   - [Stage 1: Project Initialization & Prisma Schema](#stage-1-project-initialization--prisma-schema)
   - [Stage 2: Guest Identity & Authentication](#stage-2-guest-identity--authentication)
   - [Stage 3: PMS Ingestion & Sync Deduplication](#stage-3-pms-ingestion--sync-deduplication)
   - [Stage 4: Points Expiry Lifecycle (365-Day Batches)](#stage-4-points-expiry-lifecycle-365-day-batches)
   - [Stage 5: Guest Balance & Stay History Views](#stage-5-guest-balance--stay-history-views)
   - [Stage 6: Points Redemption Flow & Balance Floor](#stage-6-points-redemption-flow--balance-floor)
   - [Stage 7: Semantic Discovery & List Fallback](#stage-7-semantic-discovery--list-fallback)
   - [Stage 8: Booking Creation & Multi-Merchant Payment Routing](#stage-8-booking-creation--multi-merchant-payment-routing)
   - [Stage 9: Staff Operations, Merges & Stay Quarantine](#stage-9-staff-operations-merges--stay-quarantine)
   - [Stage 10: Owner Dashboard, Sync Health & Governance](#stage-10-owner-dashboard-sync-health--governance)
   - [Post-Stages: Universal Navigation & Offline Demo Mode](#post-stages-universal-navigation--offline-demo-mode)
4. [Data Model & Prisma Schema Register](#4-data-model--prisma-schema-register)
5. [API Routes & Service Contracts](#5-api-routes--service-contracts)
6. [Verification, Testing & Quality Assurance](#6-verification-testing--quality-assurance)
7. [Deployment & Environment Configuration](#7-deployment--environment-configuration)
8. [Future Milestones & Roadmap](#8-future-milestones--roadmap)

---

## 1. Executive Summary & Vision

In multi-property independent hotel groups (3–5 pilot properties), guests frequently stay across different locations without receiving recognition for their past loyalty. A guest visiting Hotel A in spring and Hotel B in summer is traditionally treated as a first-time visitor at each desk.

**iLoyalty** bridges this gap by providing:
- A unified points balance across all pilot properties.
- Mobile-first guest visibility into points, upcoming 30-day expiries, rewards, and stay receipts.
- Direct multi-merchant checkout with individual hotel payout accounts.
- Staff and owner operational control to prevent fraud, manage sync hiccups, and merge duplicate profiles with strict audit trails.

---

## 2. Architectural Invariants & Design Principles

Throughout development, the codebase strictly enforces the invariants established in `iLoyalty-v1-PRD-revised.md`:

| Invariant | Description | Technical Implementation |
| :--- | :--- | :--- |
| **1. Exact Guest ID Query Rule** | Private guest records (balance, stays, points transactions, bookings, payments) must never be queried via similarity/vector search. | Direct `where: { guestId }` database lookups only. Vector search is strictly barred from touching guest identity. |
| **2. Vector Store Isolation** | Vector embeddings are restricted to public `Hotel` and `Room` descriptions for semantic search. | On hotel/room deactivation (`active: false`), embeddings are deleted synchronously. |
| **3. Search Resilience** | Semantic search must never show an empty screen upon low confidence or vector failure. | Automatic fallback to an unfiltered alphabetical list of all pilot hotels. |
| **4. PMS Sync Deduplication** | Repeated sync executions must never duplicate stays or award double points. | Upsert key on `pmsRecordId`. Only `iLoyalty`-channel bookings with eligible room/F&B spend earn points. |
| **5. Batch Points Expiry** | Points expire exactly 365 days after the earn date on a per-batch basis. | Expiry is evaluated on individual credit transactions. Active balance is net of expired transactions. |
| **6. Balance Floor Enforcement** | Guest balance can never drop below zero. | Redemptions perform atomic verification: `requestedPoints <= activeBalance`. |
| **7. Multi-Merchant Routing** | Payments route directly to the specific hotel's merchant account. | Every checkout targets the hotel's `merchantAccountId`. |
| **8. Idempotency & Webhooks** | Prevent double charging on intermittent mobile network connections. | Client UUID `idempotencyKey` required on charge creation (`409 Conflict` on duplicate). Inbound webhooks deduplicated by `providerTxId`. |
| **9. Dual-Control Governance** | Sensitive operational actions require two-step or sign-off approval. | Staff creates merge proposals; owner approves. Manual stays remain quarantined with 0 points until owner approves. |

---

## 3. Chronological Development Log

### Stage 1: Project Initialization & Prisma Schema
- **Commit:** `c7e866f`
- **Accomplishments:**
  - Configured Next.js 14 (App Router) with TypeScript in strict mode.
  - Built comprehensive `prisma/schema.prisma` modeling 11 core entities: `Guest`, `Hotel`, `Room`, `Stay`, `PointsTransaction`, `LoyaltyConfig`, `RedemptionRule`, `Redemption`, `Booking`, `Payment`, `SyncLog`, `ProfileMergeProposal`, and `GuestMessageLog`.
  - Implemented client singleton with connection caching in `src/lib/db/prisma.ts`.

### Stage 2: Guest Identity & Authentication
- **Commit:** `e73be6a`
- **Accomplishments:**
  - Implemented guest registration and authentication in `src/lib/guest/guest-service.ts`.
  - Added unique constraints for `email` and `phone`.
  - Enforced exact-ID query rule across all guest data fetching endpoints (`/api/guest/signup`, `/api/guest/signin`, `/api/guest/me`).
  - **Tests:** `tests/stage2-guest-identity.test.ts` (5 tests passing).

### Stage 3: PMS Ingestion & Sync Deduplication
- **Commit:** `fe096f1`
- **Accomplishments:**
  - Built PMS connector and stay ingestion pipeline in `src/lib/sync/pms-sync-service.ts`.
  - Configured upsert logic keyed on `pmsRecordId` to guarantee idempotency across repeated runs.
  - Implemented eligible spend calculations (room charge + F&B charges) at the configurable earn rate (default: 2 points per £1 spent for `iLoyalty` bookings).
  - Built automatic execution logging to `SyncLog`.
  - **Tests:** `tests/stage3-pms-sync.test.ts` (4 tests passing).

### Stage 4: Points Expiry Lifecycle (365-Day Batches)
- **Commit:** `c057c85`
- **Accomplishments:**
  - Created automated points expiry engine in `src/lib/points/points-expiry-service.ts`.
  - Implemented scheduled check endpoint `/api/cron/points-expiry` requiring cron secret authorization.
  - Evaluates points batches older than 365 days, marks unredeemed portions as expired, and creates offsetting `EXPIRY` transaction records.
  - **Tests:** `tests/stage4-points-expiry.test.ts` (2 tests passing).

### Stage 5: Guest Balance & Stay History Views
- **Commit:** `3d3f711`
- **Accomplishments:**
  - Created balance calculator in `src/lib/points/balance-service.ts` computing total earned, total redeemed, total expired, and active balance.
  - Implemented 30-day expiry warning threshold detection (`pointsExpiringSoon` + `nextExpiryDate`).
  - Built responsive guest balance UI (`src/app/guest/balance/page.tsx`) and historical stays view (`src/app/guest/stays/page.tsx`).
  - **Tests:** `tests/stage5-balance-and-stays.test.ts` (3 tests passing).

### Stage 6: Points Redemption Flow & Balance Floor
- **Commit:** `18ef283`
- **Accomplishments:**
  - Created redemption service in `src/lib/points/redemption-service.ts`.
  - Implemented balance floor check rejecting redemptions if `requestedPoints > activeBalance`.
  - Built rewards catalog screen (`src/app/guest/redeem/page.tsx`) showing active rules, points costs, and interactive redemption actions.
  - **Tests:** `tests/stage6-redemption-flow.test.ts` (3 tests passing).

### Stage 7: Semantic Discovery & List Fallback
- **Commit:** `1c7b6ba`
- **Accomplishments:**
  - Built semantic vector search service in `src/lib/vector/search-service.ts` for natural language room & hotel queries (e.g., *"quiet room with desk near Leeds with parking"*).
  - Enforced vector deactivation: when a hotel or room is deactivated, its vector embedding is deleted.
  - Implemented guaranteed list fallback returning all active pilot hotels when search returns no confident matches.
  - Built guest discovery screen in `src/app/guest/discover/page.tsx`.
  - **Tests:** `tests/stage7-discovery-search.test.ts` (2 tests passing).

### Stage 8: Booking Creation & Multi-Merchant Payment Routing
- **Commit:** `bee981e`
- **Accomplishments:**
  - Implemented checkout engine in `src/lib/payments/payment-service.ts`.
  - Routed payments directly to the destination hotel's `merchantAccountId`.
  - Added UUID `idempotencyKey` requirement on `/api/payments/charge` to prevent duplicate submissions.
  - Built webhook handler `/api/payments/webhook` with `providerTxId` deduplication.
  - Built booking checkout screen (`src/app/guest/book/page.tsx`).
  - **Tests:** `tests/stage8-booking-payment.test.ts` (4 tests passing).

### Stage 9: Staff Operations, Merges & Stay Quarantine
- **Commit:** `7146139`
- **Accomplishments:**
  - Built staff operational portal in `src/app/staff/page.tsx` and API endpoints in `src/app/api/staff/`.
  - Implemented manual stay recovery (`manualEntry: true`) quarantined with 0 points pending owner approval.
  - Implemented duplicate guest merge proposal generator.
  - Added guest financial communication auditing in `GuestMessageLog`.
  - **Tests:** `tests/stage9-staff-screens.test.ts` (3 tests passing).

### Stage 10: Owner Dashboard, Sync Health & Governance
- **Commit:** `ba6ae12`
- **Accomplishments:**
  - Created central owner portal in `src/app/owner/page.tsx` and API endpoints in `src/app/api/owner/`.
  - Group-wide portfolio metrics (total active members, points outstanding liability, revenue by property).
  - Sync health monitor surfacing failed PMS sync runs for immediate triage.
  - Two-person rule governance: Review and sign-off interface for merge proposals and redemption rules.
  - **Tests:** `tests/stage10-owner-screens.test.ts` (2 tests passing).

### Post-Stages: Polish, Vercel Build Compatibility & Offline Demo
- **Commits:** `8d43cff`, `e341719`, `2d4c14e`, `7d22802`
- **Accomplishments:**
  - Added universal `GuestNav`, `StaffNav`, and `OwnerNav` header navigation bars across all screens.
  - Added quick switch banner and Home navigation links (`/`).
  - Configured dynamic API exports and lazy database client initialization for clean zero-error Vercel production builds.
  - Created resilient offline demo fallback and pre-populated dummy data so the entire application can be demonstrated instantly even without an active Postgres database connection.

---

## 4. Data Model & Prisma Schema Register

The database schema (`prisma/schema.prisma`) comprises 11 models:

```mermaid
erDiagram
    GUEST ||--o{ STAY : "has"
    GUEST ||--o{ POINTS_TRANSACTION : "accumulates"
    GUEST ||--o{ REDEMPTION : "claims"
    GUEST ||--o{ BOOKING : "places"
    GUEST ||--o{ GUEST_MESSAGE_LOG : "receives"
    HOTEL ||--o{ ROOM : "contains"
    HOTEL ||--o{ STAY : "hosts"
    HOTEL ||--o{ BOOKING : "receives"
    HOTEL ||--o{ SYNC_LOG : "records"
    BOOKING ||--o{ PAYMENT : "settles"
    REDEMPTION_RULE ||--o{ REDEMPTION : "defines"
    GUEST ||--o{ PROFILE_MERGE_PROPOSAL : "source/target"
```

1. **`Guest`**: ID, email, phone, name, membership tier, creation & update timestamps.
2. **`Hotel`**: ID, name, code, address, city, postcode, merchantAccountId, active status, vector status.
3. **`Room`**: ID, hotelId, name, roomType, basePrice, description, amenities, active status.
4. **`Stay`**: ID, guestId, hotelId, pmsRecordId, checkIn, checkOut, roomSpend, foodSpend, totalEligibleSpend, pointsEarned, manualEntry, approvedBy.
5. **`PointsTransaction`**: ID, guestId, stayId, type (`EARN`, `REDEEM`, `EXPIRE`, `ADJUSTMENT`), points, batchDate, expiryDate, isExpired.
6. **`LoyaltyConfig`**: ID, earnRatePerPound, expiryDays (365), expiryWarningDays (30).
7. **`RedemptionRule`**: ID, title, description, pointsCost, monetaryValue, active, approvedBy.
8. **`Redemption`**: ID, guestId, ruleId, pointsSpent, status, redemptionCode, redeemedAt.
9. **`Booking`**: ID, guestId, hotelId, roomId, checkIn, checkOut, totalPrice, status.
10. **`Payment`**: ID, bookingId, amount, currency, merchantAccountId, idempotencyKey, providerTxId, status.
11. **`SyncLog`**: ID, hotelId, status, recordsIngested, errors, executedAt.
12. **`ProfileMergeProposal`**: ID, sourceGuestId, targetGuestId, reason, proposedBy, status, approvedBy.
13. **`GuestMessageLog`**: ID, guestId, messageType, subject, body, sentAt.

---

## 5. API Routes & Service Contracts

| Category | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| **Guest** | `/api/guest/signup` | `POST` | Register a new loyalty member |
| | `/api/guest/signin` | `POST` | Authenticate existing member |
| | `/api/guest/balance` | `GET` | Exact-ID fetch of active balance & 30-day expiry |
| | `/api/guest/stays` | `GET` | Exact-ID fetch of historical stays & spend breakdown |
| | `/api/guest/redeem` | `GET/POST` | Catalog list and balance-floor validated redemption |
| **Sync** | `/api/sync/pms` | `POST` | Ingest stay batch with `pmsRecordId` upsert deduplication |
| **Cron** | `/api/cron/points-expiry` | `POST` | Execute 365-day expiry batch audit job |
| **Discovery** | `/api/discovery/search` | `GET` | Semantic hotel/room search with list fallback |
| **Bookings** | `/api/bookings/create` | `POST` | Reserve room against specific hotel |
| **Payments** | `/api/payments/charge` | `POST` | Multi-merchant checkout with client `idempotencyKey` |
| | `/api/payments/webhook` | `POST` | Webhook handler with `providerTxId` deduplication |
| **Staff** | `/api/staff/stays/manual` | `POST` | Quarantined manual stay entry |
| | `/api/staff/merges/propose` | `POST` | Propose duplicate profile merge |
| | `/api/staff/messages/log` | `POST` | Audit guest communication log |
| **Owner** | `/api/owner/reports` | `GET` | Group-wide metrics and financial liability |
| | `/api/owner/sync-health` | `GET` | Monitor failed and active PMS sync jobs |
| | `/api/owner/merges/review` | `POST` | Sign off on proposed profile merges |
| | `/api/owner/rules` | `GET/POST` | Sign off on points redemption rules |

---

## 6. Verification, Testing & Quality Assurance

All core business invariants are covered by unit and integration tests written in [Vitest](https://vitest.dev/):

```text
 ✓ tests/stage2-guest-identity.test.ts (5 tests)
 ✓ tests/stage3-pms-sync.test.ts (4 tests)
 ✓ tests/stage4-points-expiry.test.ts (2 tests)
 ✓ tests/stage5-balance-and-stays.test.ts (3 tests)
 ✓ tests/stage6-redemption-flow.test.ts (3 tests)
 ✓ tests/stage7-discovery-search.test.ts (2 tests)
 ✓ tests/stage8-booking-payment.test.ts (4 tests)
 ✓ tests/stage9-staff-screens.test.ts (3 tests)
 ✓ tests/stage10-owner-screens.test.ts (2 tests)

Test Files:  9 passed (9)
Tests:       28 passed (28)
```

To run the verification suite at any time:
```bash
npx vitest run
```

---

## 7. Deployment & Environment Configuration

### Environment Variables Template (`.env.example`):
```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/iloyalty?schema=public"

# Embeddings & Vector Search (OpenAI / pgvector)
OPENAI_API_KEY="sk-..."

# Multi-Merchant Payment Gateway (Stripe)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Cron Authorization
CRON_SECRET="your-secure-cron-secret"

# Demo Mode Toggle (set to "true" to force offline in-memory fallback)
DEMO_MODE="false"
```

---

## 8. Future Milestones & Roadmap

1. **Hardware / Keycard Integrations**: Integrate RFID/NFC room key encoding with points balance checks at reception.
2. **Native iOS & Android Apps**: Wrap responsive Next.js views with Capacitor/React Native for native push notifications on 30-day point expiries.
3. **Automated Tier Upgrades**: Introduce dynamic Silver / Gold / Platinum tier progressions based on rolling 12-month spend.
4. **Enhanced Vector Fine-Tuning**: Embed localized amenity and neighborhood guides (e.g. *"hotels with EV charging within 5 miles of city center"*).

---

*End of Journal.*
