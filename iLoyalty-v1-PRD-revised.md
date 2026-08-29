# iLoyalty — Product Requirements Document (Version One, Revised)

## 1. Product Summary
iLoyalty is a mobile app that gives a guest one loyalty account across a pilot group of 3 to 5 hotels that share a PMS. A guest checks their points balance, sees their stay history, redeems points, discovers and books another pilot hotel, and pays inside the app. The app answers only from the business's own private and shared records. It never guesses. When it has no answer, it names a reservations team instead. A full rollout across all 50 hotels is a later phase, not part of version one.

## 2. Problem
A guest stays at hotel 12 in March and hotel 37 in June. Neither hotel knows the other stay happened. In March, nothing acknowledges this is her fourth stay with the group that year. In June, choosing between hotel 37 and a competitor £5 cheaper, nothing tells her that staying with the group is worth anything personally. She books the competitor. The group loses the booking and never finds out it lost her, because her loyalty was never made visible to her or the business. Repeated across thousands of guests, this is money and trust lost quietly, every week.

## 3. Goals

**Business goals**
- Increase repeat bookings across pilot hotels among enrolled guests, measured against a comparable non-enrolled guest group.
- Prove or disprove that a visible cross-hotel reward changes guest behavior before committing to a full 50-hotel rollout.
- Launch-blocking requirement: the comparison method (for example, matched cohort versus before/after) and the measurement period must be defined and signed off before pilot launch. The pilot does not go live without this.

**Product goals**
- A guest can see an accurate, current points balance without contacting staff. Testable: balance displayed matches the PMS record at time of query, within the stated update lag.
- A guest can redeem points and pay for a booking entirely inside the app, with payment routed to the correct hotel's own merchant account, and without ever going below a zero balance. Testable: a test transaction against a pilot hotel account settles correctly, with no misrouting and no negative balance possible.

## 4. Users and Personas

**Primary persona: Sarah**
41, project manager. Stays in pilot group hotels about eight times a year for work and twice for personal trips. Owns an inexpensive Android phone, tops up data in £10 bundles, has no technical support available to her. Opens the app in three moments only: the morning after checkout, the week before booking her next trip, and when deciding between two group hotels. She does not open it out of curiosity.

No second persona is added, since staff and owners are not app users, only input sources behind the scenes. Note for design: staff tasks described in Section 6, such as profile merges and manual stay entry, are performed by working staff, often mid-shift, so those interfaces must be fast to complete, not exploratory.

## 5. Scope

**In scope for version one**
- Guest balance view, covering the pilot group of 3 to 5 hotels sharing a PMS, not all 50.
- Guest stay history view.
- Points redemption against a booking, with balance validation.
- Hotel and room discovery, searchable by meaning, with a non-empty fallback.
- In-app booking and payment, routed to the correct hotel's merchant account, with duplicate-payment protection.
- Staff screens: profile merge approval, manual stay entry approval, guest-facing message log.
- Owner screens: usage and points reporting, message log, redemption rules sign-off, sync health status.

**Out of scope for version one**
- Loyalty tier badges (bronze/silver/gold).
- Any automated message, nudge, or follow-up to a guest.
- Any personalized offer or churn prediction.
- Historic stay backfill. Points accrue from sign-up date forward only.
- Points earning on any booking made outside the app, or on spend outside accommodation and food and beverage.
- Hotels outside the pilot group.

## 6. Functional Requirements

**Guest-facing**
1. The guest asks for their points balance. The system responds with a number and progress toward the next reward, using the guest's own private profile record fetched by exact guest ID, with a stated last-updated time. If any portion of the balance is due to expire within 30 days, the system states that amount and the expiry date plainly, since points expire 365 days after being earned if unused.
2. The guest asks for their stay history. The system responds with a list of hotel, dates, and points earned per stay, using the guest's own private profile record fetched by exact guest ID.
3. The guest asks if they can redeem points against a booking. The system checks both the shared redemption rules record and the guest's current private balance. It responds yes or no, and by how much. It rejects any redemption that would take the balance below zero.
4. The guest searches for a hotel or room by description. The system responds with matching results from the shared hotel and room record, searched by meaning. If semantic search returns no confident match, the system falls back to a simple browsable list of all pilot hotels, never an empty screen.
5. The guest pays for a booking, in points, card, or both. The system processes payment against the specific hotel's own merchant account and responds with a confirmed or pending state, never a guessed state, using live confirmation from the payment provider.
5a. Each payment attempt carries a unique idempotency key, generated at the moment the guest taps pay. The system rejects a second attempt using the same key. The payment provider's confirmation webhook is processed exactly once per transaction ID; duplicate webhook deliveries are ignored.

**Staff-facing (input, not guest features)**
6. Staff reviews two profiles flagged as belonging to one guest. The system presents both records; staff drafts a merge; the owner approves before it takes effect.
7. The PMS sync job logs its own success or failure on every run. Any failure surfaces on the owner's dashboard the same day, triggering the manual entry workflow, rather than relying on a guest or staff member noticing a missing stay first. Staff then enters the stay manually. The system logs the entry as manual and routes it for owner approval before it affects any guest-visible balance.
8. Staff, and the owner, can view a log of what the app has told guests about points or money.

**Owner-facing**
9. The owner views usage, points earned, and points redeemed, broken down by hotel.
10. The owner reviews and approves the redemption rules record before it goes live.
11. The owner reviews the guest-message log at group level.
12. The owner sees the daily sync health status across all pilot hotels.

## 7. AI and AI-Related Tools and Solutions
AI is not required for balance, stay history, redemption, or payment. These are exact-match database lookups against a guest's own private record by ID, and a normal database query answers them correctly and more cheaply than an AI call.

AI, specifically semantic search over embeddings, adds real value in exactly one place: hotel and room discovery, where a guest describes what they want in their own words ("somewhere with parking near Leeds") rather than using fixed filters. When semantic search returns no confident match, the app falls back to a plain browsable list rather than leaving the guest with nothing.

No AI is used to generate, summarize, or interpret a guest's private financial data. No AI is used to decide a payment, refund, or balance figure. Those remain deterministic database operations.

## 8. Technical Architecture

**Components**
- Next.js frontend and API routes, serving the guest app and staff/owner screens.
- PostgreSQL as the system of record for the app's own tables (profiles, points transactions, bookings, payments, redemption rules, loyalty config).
- Prisma as the ORM connecting the Next.js backend to PostgreSQL.
- A connector to the pilot hotels' shared PMS via its confirmed API, pulling stay and spend data into the app's points transaction table as a scheduled or webhook-triggered sync job. The job upserts on a unique PMS record identifier to prevent duplicate ingestion, and logs its own success or failure on every run.
- A payment provider integration capable of routing to multiple separate connected merchant accounts, one per hotel, with idempotency keys on outgoing payment attempts and deduplication on incoming confirmation webhooks.
- A vector store, described in Section 9, holding embeddings of shared hotel and room records only, kept in sync with record activation and deactivation.

**Prisma schema (core models)**

```prisma
model Guest {
  id           String   @id @default(cuid())
  email        String   @unique
  phone        String?  @unique
  createdAt    DateTime @default(now())
  stays        Stay[]
  pointsTx     PointsTransaction[]
  bookings     Booking[]
}

model Hotel {
  id                String   @id @default(cuid())
  name              String
  merchantAccountId String   // routes payments to this hotel's own account
  active            Boolean  @default(true)
  stays             Stay[]
  bookings          Booking[]
  rooms             Room[]
}

model Room {
  id          String   @id @default(cuid())
  hotelId     String
  hotel       Hotel    @relation(fields: [hotelId], references: [id])
  description String   // source text for embedding, see vector store
  active      Boolean  @default(true)
}

model Stay {
  id                   String   @id @default(cuid())
  pmsRecordId          String   @unique // source of truth identifier from the PMS; prevents duplicate ingestion on repeated sync runs
  guestId              String
  guest                Guest    @relation(fields: [guestId], references: [id])
  hotelId              String
  hotel                Hotel    @relation(fields: [hotelId], references: [id])
  checkIn              DateTime
  checkOut             DateTime
  accommodationSpend   Decimal
  foodAndBeverageSpend Decimal
  otherSpend           Decimal  // not eligible for points, tracked for owner reporting only
  source               String   // "iLoyalty" or other channel; only "iLoyalty" bookings are eligible for points
  manualEntry          Boolean  @default(false)
  approvedBy           String?  // owner ID, required if manualEntry is true
}

model PointsTransaction {
  id                    String   @id @default(cuid())
  guestId               String
  guest                 Guest    @relation(fields: [guestId], references: [id])
  stayId                String?  // required for type "earned"; optional only for type "redeemed"
  type                  String   // "earned" or "redeemed"
  amount                Int
  expiresAt             DateTime? // set for "earned" type only: createdAt + 365 days; null for "redeemed"
  pointsCostAtRedemption Int?    // captured for "redeemed" type, preserves the rule's cost at time of use
  createdAt             DateTime @default(now())
}

model RedemptionRule {
  id          String   @id @default(cuid())
  description String
  pointsCost  Int
  active      Boolean  @default(true)
  approvedBy  String   // owner ID, required before active
}

model LoyaltyConfig {
  id         String   @id @default(cuid())
  earnRate   Decimal  // e.g. 0.02 for 2 percent; stored as data so a rate change needs no deployment
  effectiveFrom DateTime @default(now())
}

model Booking {
  id        String       @id @default(cuid())
  guestId   String
  guest     Guest        @relation(fields: [guestId], references: [id])
  hotelId   String
  hotel     Hotel        @relation(fields: [hotelId], references: [id])
  status    BookingStatus @default(PENDING)
  payment   Payment?
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

model Payment {
  id                String        @id @default(cuid())
  bookingId         String        @unique
  booking           Booking       @relation(fields: [bookingId], references: [id])
  amount            Decimal
  method            String        // "points", "card", "mixed"
  idempotencyKey    String        @unique // generated client-side per payment attempt; blocks duplicate submissions
  providerTxId      String?       @unique // from payment provider; blocks duplicate webhook processing
  providerConfirmed Boolean       @default(false) // never shown as paid until true
  status            PaymentStatus @default(PENDING)
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  FAILED
}
```

Field-level notes: `Guest.email` and `Guest.phone` are unique to enforce one profile per identifier. `Stay.pmsRecordId` is unique so a repeated sync run updates the existing row instead of creating a duplicate, directly preventing double-counted points. `Payment.idempotencyKey` and `providerTxId` are both unique to stop duplicate payment attempts and duplicate webhook processing from creating two charges for one booking. `PointsTransaction.stayId` is enforced at the application layer as required for "earned" type records, so every earned point traces back to a real stay. `PointsTransaction.expiresAt` is set to 365 days after `createdAt` for "earned" records, and a scheduled job marks expired points as no longer redeemable when their expiry date passes. `Stay.hotelId` is never removed if a hotel is dropped from the group or rebranded; existing points remain valid and redeemable group-wide, since expiry runs on a per-points basis, not on hotel membership.

## 9. Vector Database Architecture and Design
Only shared records are placed in the vector store: hotel descriptions and room descriptions, used for meaning-based discovery. This applies to no other data.

Private guest records, meaning stay history, points balances, and bookings, are never embedded and never placed in a vector database. They are always fetched from PostgreSQL by the guest's own exact ID. This is a hard rule, not a preference, because a similarity search across private records risks surfacing one guest's data in response to another guest's query.

What gets embedded: the free-text description field on the `Hotel` and `Room` models, so a guest's natural-language query can be matched by meaning. When a hotel or room record is deactivated in PostgreSQL (`active: false`), its corresponding vector entry is deleted in the same operation, not on a delayed batch job.

What does not get embedded: guest profiles, stay records, points transactions, redemption rules, bookings, and payments.

## 10. Vector Database Model
The specific vector database product is not yet chosen; see Open Questions. The schema below is described generically so it can be implemented against any compliant provider.

Each vector store entry contains:
- `id`: matches the corresponding `Hotel.id` or `Room.id` in PostgreSQL.
- `embedding`: vector representation of the description text.
- `metadata`:
  - `type`: "hotel" or "room"
  - `hotelId`: for filtering room results by hotel
  - `city` or `region`: for location-based filtering alongside semantic search
  - `lastUpdated`: to support the weekly shared-record review cycle

No guest-identifying data appears in this store under any field, including metadata.

## 11. Business Model
- Guests earn points at a rate stored in the `LoyaltyConfig` table, currently set to 2 percent of eligible spend, so a future rate change is a data update, not a code change.
- Eligible spend is restricted to accommodation and food and beverage charges only. No other spend category earns points.
- Eligible spend must come from a reservation made through iLoyalty. A stay booked through a travel agent, third-party site, or direct phone call earns no points. This restriction is stated plainly to the guest at sign-up.
- Each pilot hotel holds its own separate merchant account. In-app payments are routed to the specific hotel's account at the point of payment, never a single group account.
- Legal ownership of the points liability sits with the central hotel group, which signs off on redemption rules and any points-to-pounds framing before either appears on screen.
- Points expire 365 days after being earned if not used. Expiry is tracked per points batch, not per guest account, so a guest with multiple earning events has points expiring on different dates.
- If a hotel is later dropped from the pilot group or rebranded, guest points already earned are not affected and remain usable group-wide, across whichever hotels remain in the group.

## 12. Success Metrics
Whether pilot-hotel enrolled guests book a second group hotel more often than a comparable group of non-enrolled guests, measured over a set period. As stated in Section 3, the exact comparison method and measurement period are a launch-blocking requirement and must be signed off before the pilot goes live.

## 13. Risks

1. **A wrong balance leads to a room given away, or a guest wrongly turned away.** Highest severity: direct financial loss and a single-incident trust break. Mitigation: the PMS is the source of truth, and duplicate PMS records are prevented by a unique `pmsRecordId` constraint on the `Stay` model, so a repeated sync run cannot create a second, wrongly-counted stay.
2. **A guest sees another guest's record.** Low likelihood, catastrophic severity. Mitigation: private records are fetched only by exact guest ID, never by similarity search, enforced as a hard architectural rule.
3. **A stuck or double payment**, especially likely given cheap phones, small data bundles, and unreliable power among part of the guest base. Mitigation: a payment is never marked confirmed until the payment provider itself confirms it, and idempotency keys on both the payment attempt and the provider's confirmation webhook prevent duplicate processing.
4. PMS sync failure causing stale or missing balances during the pilot. Mitigation: the sync job logs success or failure on every run, and a failure surfaces on the owner dashboard the same day, triggering manual entry rather than an undetected gap.
5. Guest confusion from the iLoyalty-booking-only eligibility rule, leading to a guest believing the app is broken when a non-app booking earns no points. Mitigation: this restriction is stated plainly at sign-up, not buried in terms and conditions.

## 14. Open Questions
- What vector database product will be used? Left to the engineering team to specify during build.

Resolved since the prior draft: the PMS API returns itemised spend per stay, so the eligible spend rule can be calculated automatically. Points expire 365 days after being earned if unused. A guest's points are unaffected if a pilot hotel is later dropped from the group or rebranded, and remain usable group-wide.
