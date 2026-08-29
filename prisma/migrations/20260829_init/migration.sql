-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "MergeDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable: Guest
-- email and phone are unique to enforce one profile per identifier (PRD Section 8)
CREATE TABLE "Guest" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "phone"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Guest_email_key" ON "Guest"("email");
CREATE UNIQUE INDEX "Guest_phone_key" ON "Guest"("phone");

-- CreateTable: Hotel
CREATE TABLE "Hotel" (
    "id"                TEXT    NOT NULL,
    "name"              TEXT    NOT NULL,
    "merchantAccountId" TEXT    NOT NULL,
    "active"            BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Room
CREATE TABLE "Room" (
    "id"            TEXT    NOT NULL,
    "hotelId"       TEXT    NOT NULL,
    "description"   TEXT    NOT NULL,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "embedSyncedAt" TIMESTAMP(3),
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Stay
-- pmsRecordId is unique to prevent duplicate ingestion on repeated sync runs (PRD Section 8)
CREATE TABLE "Stay" (
    "id"                   TEXT           NOT NULL,
    "pmsRecordId"          TEXT           NOT NULL,
    "guestId"              TEXT           NOT NULL,
    "hotelId"              TEXT           NOT NULL,
    "checkIn"              TIMESTAMP(3)   NOT NULL,
    "checkOut"             TIMESTAMP(3)   NOT NULL,
    "accommodationSpend"   DECIMAL(12,2)  NOT NULL,
    "foodAndBeverageSpend" DECIMAL(12,2)  NOT NULL,
    "otherSpend"           DECIMAL(12,2)  NOT NULL,
    "source"               TEXT           NOT NULL,
    "manualEntry"          BOOLEAN        NOT NULL DEFAULT false,
    "approvedBy"           TEXT,
    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stay_pmsRecordId_key" ON "Stay"("pmsRecordId");

-- CreateTable: PointsTransaction
CREATE TABLE "PointsTransaction" (
    "id"                    TEXT         NOT NULL,
    "guestId"               TEXT         NOT NULL,
    "stayId"                TEXT,
    "type"                  TEXT         NOT NULL,
    "amount"                INTEGER      NOT NULL,
    "expiresAt"             TIMESTAMP(3),
    "pointsCostAtRedemption" INTEGER,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointsTransaction_guestId_type_expiresAt_idx"
    ON "PointsTransaction"("guestId", "type", "expiresAt");

-- CreateTable: RedemptionRule
CREATE TABLE "RedemptionRule" (
    "id"          TEXT    NOT NULL,
    "description" TEXT    NOT NULL,
    "pointsCost"  INTEGER NOT NULL,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "approvedBy"  TEXT    NOT NULL,
    CONSTRAINT "RedemptionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LoyaltyConfig
CREATE TABLE "LoyaltyConfig" (
    "id"            TEXT         NOT NULL,
    "earnRate"      DECIMAL(6,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Booking
CREATE TABLE "Booking" (
    "id"      TEXT            NOT NULL,
    "guestId" TEXT            NOT NULL,
    "hotelId" TEXT            NOT NULL,
    "status"  "BookingStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Payment
-- idempotencyKey and providerTxId are both unique to prevent duplicate payments
-- and duplicate webhook processing (PRD Section 8 / Section 5a)
CREATE TABLE "Payment" (
    "id"                TEXT            NOT NULL,
    "bookingId"         TEXT            NOT NULL,
    "amount"            DECIMAL(12,2)   NOT NULL,
    "method"            TEXT            NOT NULL,
    "idempotencyKey"    TEXT            NOT NULL,
    "providerTxId"      TEXT,
    "providerConfirmed" BOOLEAN         NOT NULL DEFAULT false,
    "status"            "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_bookingId_key"      ON "Payment"("bookingId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_providerTxId_key"   ON "Payment"("providerTxId");

-- ─── Operational Tables ──────────────────────────────────────────────────────

-- CreateTable: SyncLog — tracks every PMS sync run; failures surface on owner dashboard
CREATE TABLE "SyncLog" (
    "id"               TEXT           NOT NULL,
    "hotelId"          TEXT           NOT NULL,
    "status"           "SyncLogStatus" NOT NULL,
    "recordsProcessed" INTEGER        NOT NULL DEFAULT 0,
    "recordsUpserted"  INTEGER        NOT NULL DEFAULT 0,
    "errorMessage"     TEXT,
    "startedAt"        TIMESTAMP(3)   NOT NULL,
    "completedAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncLog_hotelId_createdAt_idx" ON "SyncLog"("hotelId", "createdAt");

-- CreateTable: MessageLog — auditable log of what app tells guests about points/money
CREATE TABLE "MessageLog" (
    "id"        TEXT         NOT NULL,
    "guestId"   TEXT         NOT NULL,
    "message"   TEXT         NOT NULL,
    "context"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageLog_guestId_createdAt_idx" ON "MessageLog"("guestId", "createdAt");

-- CreateTable: ProfileMergeDraft — staff merge proposals held for owner approval
CREATE TABLE "ProfileMergeDraft" (
    "id"            TEXT               NOT NULL,
    "sourceGuestId" TEXT               NOT NULL,
    "targetGuestId" TEXT               NOT NULL,
    "status"        "MergeDraftStatus" NOT NULL DEFAULT 'PENDING',
    "proposedBy"    TEXT               NOT NULL,
    "reviewedBy"    TEXT,
    "reviewNote"    TEXT,
    "createdAt"     TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)       NOT NULL,
    CONSTRAINT "ProfileMergeDraft_pkey" PRIMARY KEY ("id")
);

-- ─── Embedding Tables (pgvector — shared records only, no guest data) ────────

-- HotelEmbedding: embedding of Hotel.description for semantic discovery
CREATE TABLE "HotelEmbedding" (
    "id"        TEXT         NOT NULL,
    "metadata"  JSONB        NOT NULL,
    "embedding" FLOAT8[]     NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelEmbedding_pkey" PRIMARY KEY ("id")
);

-- RoomEmbedding: embedding of Room.description for semantic discovery
CREATE TABLE "RoomEmbedding" (
    "id"        TEXT         NOT NULL,
    "hotelId"   TEXT         NOT NULL,
    "metadata"  JSONB        NOT NULL,
    "embedding" FLOAT8[]     NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomEmbedding_hotelId_idx" ON "RoomEmbedding"("hotelId");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stay" ADD CONSTRAINT "Stay_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stay" ADD CONSTRAINT "Stay_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_stayId_fkey"
    FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfileMergeDraft" ADD CONSTRAINT "ProfileMergeDraft_sourceGuestId_fkey"
    FOREIGN KEY ("sourceGuestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfileMergeDraft" ADD CONSTRAINT "ProfileMergeDraft_targetGuestId_fkey"
    FOREIGN KEY ("targetGuestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
