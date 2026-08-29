# iLoyalty — Cross-Hotel Loyalty Platform (Version One)

**iLoyalty** is a Next.js and TypeScript loyalty application designed for a pilot group of 3 to 5 hotels that share a central Property Management System (PMS). It unifies guest recognition across independent properties while maintaining strict privacy isolation, multi-merchant payment routing, and audit-level governance.

---

## 🎯 The Problem & Vision

In multi-property hotel groups, guests frequently stay at different properties without their loyalty being recognized across the portfolio. A guest checking into Hotel A in March and Hotel B in June is treated as a first-time guest each time, leading to lost repeat bookings and broken customer trust.

**iLoyalty solves this by:**
1. Providing **one verified points account** across all participating pilot hotels.
2. Making rewards and stay history visible to guests directly inside a mobile-friendly web app.
3. Enabling in-app semantic discovery and reservations with payments routed directly to each hotel's separate merchant account.

---

## 🏗️ Core Architectural Principles & Invariants

This project is built strictly to the specifications of the `iLoyalty PRD (Version One)`:

### 1. 🔒 Exact Guest ID Query Rule
- **Hard Rule**: Private guest financial and identity records (balance, stays, points transactions, bookings, payments) are **fetched strictly by exact guest ID**.
- **No Similarity Matching**: Guest data is never searched, clustered, or matched by vector/similarity search to prevent cross-tenant data leaks.

### 2. 🧠 Vector Store Isolation & Meaning-Based Discovery
- **Shared Records Only**: Only public `Hotel` and `Room` descriptions are embedded in the vector store for semantic search (e.g. *"quiet room with desk near Leeds with parking"*).
- **Synchronous Deactivation**: When a hotel or room is marked inactive (`active: false`), its vector embedding is deleted in the same operation.
- **Guaranteed Fallback**: If semantic search yields no confident match or the embedding service is unreachable, the system falls back to a browsable list of all pilot hotels—**never an empty screen**.

### 3. 🏨 PMS Sync Ingestion & Deduplication
- **Unique `pmsRecordId`**: The PMS sync upserts stays on `pmsRecordId`, preventing duplicate ingestion and double-counting of points during repeated runs.
- **Eligible Spend Only**: Points are awarded strictly on accommodation and food & beverage charges for bookings originating from the `iLoyalty` channel at the rate configured in `LoyaltyConfig` (e.g., 2%).
- **Sync Failure Detection**: Every sync run logs its status to `SyncLog`. Failures surface on the owner dashboard the same day to trigger manual recovery workflows.

### 4. ⏱️ 365-Day Points Expiry Lifecycle
- Points expire **365 days after the date they were earned**.
- Expiry is tracked **per batch (per transaction)**, not per account.
- **30-Day Warning**: The guest balance screen plainly highlights any points due to expire within 30 days and displays the exact expiry date.
- **Group-Wide Portability**: If a hotel leaves the pilot group, previously earned points remain valid and usable group-wide across remaining hotels.

### 5. 💳 Multi-Merchant Payments & Idempotency
- **Direct Merchant Routing**: Payments are routed directly to the specific hotel's `merchantAccountId`.
- **Client Idempotency Key**: Every payment attempt requires a UUID `idempotencyKey` generated client-side at the moment the guest taps *Pay*. Re-submitting the same key returns a `409 Conflict`.
- **Live Provider Confirmation**: Payments remain `PENDING` until confirmed by the payment provider's webhook. Inbound webhooks are deduplicated by `providerTxId`.

### 6. 👥 Staff & Owner Operational Governance
- **Profile Merges**: Staff drafts merge proposals for duplicate accounts; merges take effect only after owner approval.
- **Manual Stay Recovery**: Staff can enter missing stays after sync failures (`manualEntry: true`), which remain quarantined with zero points credited until the owner signs off (`approvedBy`).
- **Redemption Rules Sign-Off**: The central hotel group holds the legal liability for points; the owner must review and sign off (`approvedBy`) on redemption rules before they appear to guests.
- **Audit Message Log**: Auditable log of all financial statements and points balances communicated to guests.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Vector Search**: PostgreSQL `pgvector` / Cosine Similarity embedding index
- **Payments**: Stripe Connect (multi-merchant account routing & webhooks)
- **Validation**: [Zod](https://zod.dev/)
- **Styling**: Vanilla CSS Design Tokens (mobile-first guest app & desktop portals)
- **Testing**: [Vitest](https://vitest.dev/) for automated unit and integration suites

---

## 📁 Repository Structure

```text
iLoyalty/
├── prisma/
│   ├── schema.prisma              # Full Prisma schema matching PRD Section 8
│   └── migrations/                # Version-controlled SQL migrations
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   # REST API routes
│   │   │   ├── guest/             # Signup, signin, balance, stays, redeem
│   │   │   ├── sync/              # PMS sync connector & ingestion
│   │   │   ├── cron/              # Points expiry scheduled job
│   │   │   ├── discovery/         # Semantic search & fallback
│   │   │   ├── bookings/          # Booking creation
│   │   │   ├── payments/          # Charge & webhook deduplication
│   │   │   ├── staff/             # Manual stays, merges, message log
│   │   │   └── owner/             # Reporting, sync health, rules sign-off
│   │   ├── guest/                 # Guest mobile web screens
│   │   │   ├── balance/           # Points balance & 30-day expiry warning
│   │   │   ├── stays/             # Historical stays & spend breakdown
│   │   │   ├── discover/          # Semantic hotel & room discovery
│   │   │   ├── redeem/            # Rewards catalog & balance-floor check
│   │   │   └── book/              # Multi-merchant checkout & payment
│   │   ├── staff/                 # Staff operational portal
│   │   ├── owner/                 # Owner reporting & governance portal
│   │   ├── globals.css            # Design system & tokens
│   │   └── layout.tsx             # Root layout
│   ├── lib/
│   │   ├── db/                    # Prisma client singleton
│   │   ├── guest/                 # Guest identity service (exact-ID rule)
│   │   ├── sync/                  # PMS connector & upsert service
│   │   ├── points/                # Balance, stay history, expiry & redemption
│   │   ├── vector/                # Semantic search & embedding management
│   │   └── payments/              # Multi-merchant payment & webhook service
│   ├── components/                # Shared UI components (GuestNav, StaffNav, OwnerNav)
│   └── types/                     # Shared TypeScript interfaces & enums
├── tests/                         # Automated test suites (28 tests across 9 suites)
├── .env.example                   # Environment configuration template
└── vitest.config.ts               # Vitest configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **PostgreSQL**: PostgreSQL 15+ (or any hosted Postgres instance like Supabase/Neon)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd iLoyalty
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with your database URL, OpenAI key (for embeddings), and Stripe keys.

4. **Initialize the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

The codebase includes full automated test suites covering all 10 stages:

```bash
# Run all automated test suites
npm test

# Run tests with vitest runner directly
npx vitest run

# Run TypeScript type check
npx tsc --noEmit
```

### Test Coverage Highlights:
- **`tests/stage2-guest-identity.test.ts`**: Email/phone uniqueness & exact-ID queries.
- **`tests/stage3-pms-sync.test.ts`**: PMS `pmsRecordId` upsert deduplication & spend calculations.
- **`tests/stage4-points-expiry.test.ts`**: 365-day expiry batch detection & cron reporting.
- **`tests/stage5-balance-and-stays.test.ts`**: Available balance, 30-day warning threshold, stay history.
- **`tests/stage6-redemption-flow.test.ts`**: Balance floor enforcement (blocking negative balances).
- **`tests/stage7-discovery-search.test.ts`**: Semantic search, deactivation vector deletion, list fallback.
- **`tests/stage8-booking-payment.test.ts`**: Idempotency key duplicate rejection & webhook deduplication.
- **`tests/stage9-staff-screens.test.ts`**: Profile merge proposals & manual stay quarantine.
- **`tests/stage10-owner-screens.test.ts`**: Group reporting, sync failure detection, rules sign-off.

---

## 📄 License & Source of Truth

Built in accordance with the `iLoyalty PRD (Version One, Revised)`. All rights reserved by the pilot hotel group.
