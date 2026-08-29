/**
 * GET /api/guest/balance?guestId=xxx
 *
 * Returns the authenticated guest's current points balance.
 * Fetched by EXACT guest ID only (PRD Section 9 hard rule).
 *
 * Response includes (PRD Section 6.1):
 *  - Current available balance
 *  - Points expiring within 30 days and the expiry date, stated plainly
 *  - Last-updated timestamp
 *
 * Also logs this balance view to MessageLog for staff/owner audit (PRD Section 6.8).
 *
 * NOTE: In a production app this route would read the guestId from a verified
 * session/JWT rather than from a query parameter. The session layer is added
 * in a later stage. The guestId param is used here for testability.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getPointsBalance } from '@/lib/points/points.service'

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
    select: { id: true, email: true, createdAt: true },
  })

  if (!guest) {
    return NextResponse.json(
      { success: false, error: 'Guest not found' },
      { status: 404 }
    )
  }

  const balance = await getPointsBalance(guestId)
  const now = new Date()

  // Log this balance view for audit trail (PRD Section 6.8)
  await prisma.messageLog.create({
    data: {
      guestId,
      message: `Balance viewed: ${balance.available} points available.` +
        (balance.expiringWithin30Days > 0
          ? ` ${balance.expiringWithin30Days} points expire by ${balance.nearestExpiryDate?.toDateString()}.`
          : ''),
      context: 'balance',
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      guestId,
      available: balance.available,
      totalEarned: balance.totalEarned,
      totalRedeemed: balance.totalRedeemed,
      // PRD Section 6.1: state expiry plainly if within 30 days
      expiringWithin30Days: balance.expiringWithin30Days,
      nearestExpiryDate: balance.nearestExpiryDate?.toISOString() ?? null,
      lastUpdatedAt: now.toISOString(),
    },
  })
}
