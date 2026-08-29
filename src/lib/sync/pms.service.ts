/**
 * PMS Sync Service — Stage 3
 *
 * Fetches completed stays from the pilot hotels' shared PMS API and upserts
 * them into the Stay table using pmsRecordId as the unique key.
 *
 * Duplicate prevention (PRD Section 8, Risk 1):
 *   The pmsRecordId field has a DB-level UNIQUE constraint. If the PMS returns
 *   the same record on a repeated sync run, the upsert updates the existing row
 *   instead of creating a second one. This makes it impossible to double-count
 *   points from a repeated sync.
 *
 * Points calculation (PRD Section 11):
 *   - Eligible spend = accommodationSpend + foodAndBeverageSpend
 *   - Only applies when Stay.source === "iLoyalty"
 *   - Rate is read from the LoyaltyConfig table at sync time (no code change needed for rate changes)
 *   - Points = Math.floor(eligibleSpend * earnRate)
 *   - expiresAt = createdAt + 365 days (PRD Section 11)
 *
 * Sync logging (PRD Section 6 requirement 7):
 *   Every sync run writes a SyncLog record with status SUCCESS or FAILED.
 *   Failures surface on the owner dashboard the same day.
 */

import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// ─── PMS API types (what the PMS connector returns) ──────────────────────────

export interface PmsStayRecord {
  /** Unique identifier from the PMS — used as pmsRecordId for upsert deduplication */
  pmsRecordId: string
  /** Guest's email address — used to look up (or skip) the matching Guest record */
  guestEmail: string
  hotelId: string
  checkIn: string  // ISO 8601
  checkOut: string // ISO 8601
  accommodationSpend: number
  foodAndBeverageSpend: number
  otherSpend: number
  /** "iLoyalty" for bookings eligible for points; other values earn nothing */
  source: string
}

// ─── Sync result types ────────────────────────────────────────────────────────

export interface SyncRunResult {
  hotelId: string
  status: 'SUCCESS' | 'FAILED'
  recordsProcessed: number
  recordsUpserted: number
  pointsCreated: number
  errorMessage?: string
}

// ─── Points calculation ───────────────────────────────────────────────────────

/**
 * Fetch the currently active LoyaltyConfig earn rate.
 * Reads the most-recently-effective config row.
 */
async function getEarnRate(): Promise<Decimal> {
  const config = await prisma.loyaltyConfig.findFirst({
    orderBy: { effectiveFrom: 'desc' },
    select: { earnRate: true },
  })
  if (!config) {
    throw new Error('No LoyaltyConfig found. At least one row must exist before syncing.')
  }
  return config.earnRate
}

/**
 * Calculate points earned for a stay.
 * Returns 0 if the stay source is not "iLoyalty".
 */
function calculatePoints(
  accommodationSpend: number,
  foodAndBeverageSpend: number,
  source: string,
  earnRate: Decimal
): number {
  if (source !== 'iLoyalty') return 0
  const eligibleSpend = accommodationSpend + foodAndBeverageSpend
  // Use floor to never award fractional points
  return Math.floor(eligibleSpend * earnRate.toNumber())
}

// ─── Core upsert function ─────────────────────────────────────────────────────

/**
 * Upsert a single PMS stay record.
 * Returns the stay ID and whether points were created.
 */
async function upsertStayRecord(
  record: PmsStayRecord,
  earnRate: Decimal
): Promise<{ stayId: string; pointsCreated: number }> {
  // Look up the guest by email — this is the connector matching the PMS identity
  // to the app identity. It is NOT used to return financial data; it finds the
  // guest so we can attach the stay to their account.
  const guest = await prisma.guest.findUnique({
    where: { email: record.guestEmail.trim().toLowerCase() },
    select: { id: true },
  })

  if (!guest) {
    // Guest not enrolled in iLoyalty — skip silently, record processed count
    return { stayId: '', pointsCreated: 0 }
  }

  const checkIn = new Date(record.checkIn)
  const checkOut = new Date(record.checkOut)
  const pointsAmount = calculatePoints(
    record.accommodationSpend,
    record.foodAndBeverageSpend,
    record.source,
    earnRate
  )

  // Upsert on pmsRecordId — the UNIQUE constraint ensures idempotency
  const stay = await prisma.stay.upsert({
    where: { pmsRecordId: record.pmsRecordId },
    update: {
      // Update mutable spend fields in case the PMS corrects them
      accommodationSpend: record.accommodationSpend,
      foodAndBeverageSpend: record.foodAndBeverageSpend,
      otherSpend: record.otherSpend,
    },
    create: {
      pmsRecordId: record.pmsRecordId,
      guestId: guest.id,
      hotelId: record.hotelId,
      checkIn,
      checkOut,
      accommodationSpend: record.accommodationSpend,
      foodAndBeverageSpend: record.foodAndBeverageSpend,
      otherSpend: record.otherSpend,
      source: record.source,
      manualEntry: false,
    },
    select: { id: true },
  })

  // Only create a PointsTransaction if this is a new stay (created) and eligible
  // We detect "new" by checking if any PointsTransaction already exists for this stay
  let pointsCreated = 0
  if (pointsAmount > 0) {
    const existingTx = await prisma.pointsTransaction.findFirst({
      where: { stayId: stay.id, type: 'earned' },
      select: { id: true },
    })

    if (!existingTx) {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 365 days from earned date

      await prisma.pointsTransaction.create({
        data: {
          guestId: guest.id,
          stayId: stay.id,
          type: 'earned',
          amount: pointsAmount,
          expiresAt, // PRD Section 11: expires 365 days after earned
        },
      })
      pointsCreated = pointsAmount
    }
  }

  return { stayId: stay.id, pointsCreated }
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Run a PMS sync for a given hotel.
 * Fetches records from the PMS API, upserts stays, creates points transactions,
 * and logs the result.
 */
export async function runPmsSync(
  hotelId: string,
  fetchPmsRecords: (hotelId: string) => Promise<PmsStayRecord[]>
): Promise<SyncRunResult> {
  const startedAt = new Date()

  // Create a RUNNING log entry at the start
  const syncLog = await prisma.syncLog.create({
    data: {
      hotelId,
      status: 'RUNNING',
      recordsProcessed: 0,
      recordsUpserted: 0,
      startedAt,
    },
    select: { id: true },
  })

  try {
    const earnRate = await getEarnRate()
    const records = await fetchPmsRecords(hotelId)

    let recordsUpserted = 0
    let totalPointsCreated = 0

    for (const record of records) {
      const { stayId, pointsCreated } = await upsertStayRecord(record, earnRate)
      if (stayId) {
        recordsUpserted++
        totalPointsCreated += pointsCreated
      }
    }

    // Update the log to SUCCESS
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        recordsProcessed: records.length,
        recordsUpserted,
        completedAt: new Date(),
      },
    })

    return {
      hotelId,
      status: 'SUCCESS',
      recordsProcessed: records.length,
      recordsUpserted,
      pointsCreated: totalPointsCreated,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Update the log to FAILED — this surfaces on the owner dashboard same day
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      },
    })

    return {
      hotelId,
      status: 'FAILED',
      recordsProcessed: 0,
      recordsUpserted: 0,
      pointsCreated: 0,
      errorMessage,
    }
  }
}
