/**
 * GET /api/guest/stays?guestId=xxx
 *
 * Returns the authenticated guest's stay history.
 * Fetched by EXACT guest ID only (PRD Section 9 hard rule).
 *
 * Response includes (PRD Section 6.2):
 *  - Hotel name, check-in/check-out dates, points earned per stay
 *  - Source (iLoyalty or other channel)
 *  - Whether the stay was manually entered (for transparency)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getStayHistory } from '@/lib/points/points.service'

export async function GET(request: NextRequest) {
  const guestId = request.nextUrl.searchParams.get('guestId')

  if (!guestId || typeof guestId !== 'string' || guestId.trim() === '') {
    return NextResponse.json(
      { success: false, error: 'guestId is required' },
      { status: 400 }
    )
  }

  // Verify the guest exists — by exact ID only
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true },
  })

  if (!guest) {
    return NextResponse.json(
      { success: false, error: 'Guest not found' },
      { status: 404 }
    )
  }

  const stays = await getStayHistory(guestId)

  return NextResponse.json({
    success: true,
    data: stays.map((stay) => ({
      stayId: stay.stayId,
      hotelId: stay.hotelId,
      hotelName: stay.hotelName,
      checkIn: stay.checkIn.toISOString(),
      checkOut: stay.checkOut.toISOString(),
      accommodationSpend: stay.accommodationSpend.toString(),
      foodAndBeverageSpend: stay.foodAndBeverageSpend.toString(),
      source: stay.source,
      pointsEarned: stay.pointsEarned,
      manualEntry: stay.manualEntry,
    })),
  })
}
