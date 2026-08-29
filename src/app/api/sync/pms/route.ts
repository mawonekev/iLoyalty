export const dynamic = 'force-dynamic'
/**
 * POST /api/sync/pms
 *
 * Triggers a PMS sync run for one or all pilot hotels.
 * Protected by CRON_SECRET to prevent unauthorized triggering.
 *
 * This route is called by:
 *   - The scheduled cron job (automated daily sync)
 *   - Owner dashboard manually if a sync failure was detected
 *
 * Body (optional): { hotelId: string } — sync a specific hotel only.
 * If hotelId is omitted, all active hotels are synced in sequence.
 *
 * The sync result is logged to SyncLog in all cases (SUCCESS or FAILED).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { runPmsSync } from '@/lib/sync/pms.service'
import { fetchPmsRecordsForHotel } from '@/lib/sync/pms.connector'

function isCronAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-cron-secret')
  return secret === process.env.CRON_SECRET && !!process.env.CRON_SECRET
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { hotelId?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional — default to syncing all hotels
  }

  // Determine which hotels to sync
  const hotels = body.hotelId
    ? await prisma.hotel.findMany({
        where: { id: body.hotelId, active: true },
        select: { id: true },
      })
    : await prisma.hotel.findMany({
        where: { active: true },
        select: { id: true },
      })

  if (hotels.length === 0) {
    return NextResponse.json({ success: false, error: 'No active hotels found to sync' }, { status: 404 })
  }

  const results = []
  for (const hotel of hotels) {
    const result = await runPmsSync(hotel.id, fetchPmsRecordsForHotel)
    results.push(result)
  }

  const allSucceeded = results.every((r) => r.status === 'SUCCESS')

  return NextResponse.json(
    {
      success: allSucceeded,
      data: results,
    },
    { status: allSucceeded ? 200 : 207 } // 207 Multi-Status if some failed
  )
}
