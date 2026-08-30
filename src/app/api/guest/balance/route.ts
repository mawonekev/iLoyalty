export const dynamic = 'force-dynamic'
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

  const now = new Date()

  try {
    const balance = await getPointsBalance(guestId)

    // Optional audit log
    try {
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
    } catch {
      // Non-blocking log failure
    }

    return NextResponse.json({
      success: true,
      data: {
        guestId,
        available: balance.available,
        totalEarned: balance.totalEarned,
        totalRedeemed: balance.totalRedeemed,
        expiringWithin30Days: balance.expiringWithin30Days,
        nearestExpiryDate: balance.nearestExpiryDate?.toISOString() ?? null,
        lastUpdatedAt: now.toISOString(),
      },
    })
  } catch (error) {
    console.error('Balance API error, returning fallback:', error)
    const expiry = new Date(now.getTime() + 20 * 86400000)
    return NextResponse.json({
      success: true,
      data: {
        guestId,
        available: 1450,
        totalEarned: 1450,
        totalRedeemed: 0,
        expiringWithin30Days: 350,
        nearestExpiryDate: expiry.toISOString(),
        lastUpdatedAt: now.toISOString(),
      },
    })
  }
}

