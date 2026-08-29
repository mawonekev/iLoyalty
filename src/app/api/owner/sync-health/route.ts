/**
 * GET /api/owner/sync-health
 *
 * Daily sync health status across all pilot hotels.
 * PRD Section 6.12: The owner sees the daily sync health status across all pilot hotels.
 * Any failure surfaces on the owner's dashboard the same day, triggering the manual entry workflow.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const hotels = await prisma.hotel.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Get most recent sync log for each hotel
  const healthByHotel = await Promise.all(
    hotels.map(async (hotel) => {
      const latestLog = await prisma.syncLog.findFirst({
        where: { hotelId: hotel.id },
        orderBy: { startedAt: 'desc' },
      })

      // Count failures in last 24 hours
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const failuresLast24h = await prisma.syncLog.count({
        where: {
          hotelId: hotel.id,
          status: 'FAILED',
          startedAt: { gte: last24h },
        },
      })

      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        status: latestLog?.status || 'NEVER_RUN',
        lastSyncStartedAt: latestLog?.startedAt || null,
        lastSyncCompletedAt: latestLog?.completedAt || null,
        recordsProcessed: latestLog?.recordsProcessed || 0,
        recordsUpserted: latestLog?.recordsUpserted || 0,
        errorMessage: latestLog?.errorMessage || null,
        failuresLast24h,
        healthy: latestLog?.status === 'SUCCESS' && failuresLast24h === 0,
      }
    })
  )

  const overallHealthy = healthByHotel.every((h) => h.healthy)

  return NextResponse.json({
    success: true,
    data: {
      overallHealthy,
      timestamp: new Date().toISOString(),
      hotels: healthByHotel,
    },
  })
}
