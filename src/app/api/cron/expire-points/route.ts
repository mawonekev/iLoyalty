/**
 * GET /api/cron/expire-points
 *
 * Scheduled daily job that reports expired points and confirms the job is running.
 * Protected by CRON_SECRET.
 *
 * PRD Section 4 (points expiry): Points expire 365 days after being earned.
 * The expiresAt field on PointsTransaction records is set at creation time.
 * The balance calculation in points.service.ts excludes transactions where
 * expiresAt <= now(), so expiry is effective immediately when the timestamp passes.
 *
 * This job reports the count of expired transactions for owner dashboard
 * monitoring and confirms the scheduler is firing correctly.
 *
 * Schedule: daily at 02:00 UTC (configure in your cron provider / Vercel Cron).
 */

import { NextRequest, NextResponse } from 'next/server'
import { reportExpiredPoints } from '@/lib/points/expiry.service'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-cron-secret')
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await reportExpiredPoints()

  return NextResponse.json({
    success: true,
    data: {
      expiredTransactionCount: result.expiredTransactionCount,
      totalPointsExpired: result.totalPointsExpired,
      ranAt: result.ranAt.toISOString(),
    },
  })
}
