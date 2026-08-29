/**
 * Points expiry service — Stage 4.
 *
 * PRD Section 11: Points expire 365 days after being earned if not used.
 * Expiry is tracked per points batch (per PointsTransaction), not per account.
 *
 * This service is called by the scheduled cron job at /api/cron/expire-points.
 * It does NOT do a display-only calculation — it performs a real query and the
 * results immediately affect the balance calculation in points.service.ts.
 *
 * The balance calculation in points.service.ts reads expiresAt to exclude
 * expired transactions from the running total, so no extra "expired" flag is
 * needed on the transaction row. The expiresAt field on the row IS the record.
 *
 * This job simply reports how many transactions have now passed their expiresAt,
 * which is used for monitoring and owner dashboard display.
 */

import { prisma } from '@/lib/db/prisma'

export interface ExpiryRunResult {
  expiredTransactionCount: number
  totalPointsExpired: number
  ranAt: Date
}

/**
 * Count and report transactions that have passed their expiresAt.
 *
 * The actual balance exclusion happens in getPointsBalance() which checks
 * expiresAt at read time — no separate write is needed to "mark" them expired.
 * This job exists to:
 *  1. Provide monitoring data for the owner dashboard
 *  2. Confirm the scheduled job is running (its own SyncLog-equivalent)
 *  3. Allow future extension (e.g. emailing guests before expiry)
 */
export async function reportExpiredPoints(): Promise<ExpiryRunResult> {
  const now = new Date()

  const expiredTx = await prisma.pointsTransaction.findMany({
    where: {
      type: 'earned',
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      amount: true,
      expiresAt: true,
    },
  })

  return {
    expiredTransactionCount: expiredTx.length,
    totalPointsExpired: expiredTx.reduce((sum, tx) => sum + tx.amount, 0),
    ranAt: now,
  }
}
