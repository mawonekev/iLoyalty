export const dynamic = 'force-dynamic'
/**
 * GET /api/owner/reporting
 *
 * Usage and points reporting for the owner, broken down by hotel.
 * PRD Section 6.9: The owner views usage, points earned, and points redeemed,
 * broken down by hotel.
 *
 * Query params:
 *   from  - ISO date string (optional, default: 30 days ago)
 *   to    - ISO date string (optional, default: now)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')

  const to = toParam ? new Date(toParam) : new Date()
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000) // default 30 days

  // Fetch all active hotels
  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true, active: true },
    orderBy: { name: 'asc' },
  })

  const report = await Promise.all(
    hotels.map(async (hotel) => {
      // Stays in period for this hotel
      const stays = await prisma.stay.findMany({
        where: {
          hotelId: hotel.id,
          checkOut: { gte: from, lte: to },
        },
        select: {
          id: true,
          accommodationSpend: true,
          foodAndBeverageSpend: true,
          otherSpend: true,
          source: true,
          manualEntry: true,
        },
      })

      // Points earned (via stays at this hotel)
      const stayIds = stays.map((s) => s.id)
      const earnedTx = await prisma.pointsTransaction.findMany({
        where: { stayId: { in: stayIds }, type: 'earned' },
        select: { amount: true },
      })
      const totalPointsEarned = earnedTx.reduce((sum, tx) => sum + tx.amount, 0)

      // Points redeemed against bookings at this hotel
      const bookings = await prisma.booking.findMany({
        where: {
          hotelId: hotel.id,
          payment: { status: 'CONFIRMED' },
        },
        select: { id: true },
      })

      // Total spend
      const totalAccommodationSpend = stays.reduce(
        (sum, s) => sum + Number(s.accommodationSpend), 0
      )
      const totalFnbSpend = stays.reduce(
        (sum, s) => sum + Number(s.foodAndBeverageSpend), 0
      )
      const totalOtherSpend = stays.reduce(
        (sum, s) => sum + Number(s.otherSpend), 0
      )

      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        active: hotel.active,
        period: { from: from.toISOString(), to: to.toISOString() },
        stayCount: stays.length,
        iLoyaltyStayCount: stays.filter((s) => s.source === 'iLoyalty').length,
        manualEntryCount: stays.filter((s) => s.manualEntry).length,
        totalAccommodationSpend,
        totalFnbSpend,
        totalOtherSpend,
        totalPointsEarned,
        confirmedBookingCount: bookings.length,
      }
    })
  )

  // Group totals
  const groupTotals = {
    totalStays: report.reduce((s, h) => s + h.stayCount, 0),
    totalILoyaltyStays: report.reduce((s, h) => s + h.iLoyaltyStayCount, 0),
    totalPointsEarned: report.reduce((s, h) => s + h.totalPointsEarned, 0),
    totalConfirmedBookings: report.reduce((s, h) => s + h.confirmedBookingCount, 0),
  }

  return NextResponse.json({ success: true, data: { groupTotals, byHotel: report } })
}
