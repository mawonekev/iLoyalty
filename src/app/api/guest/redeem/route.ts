/**
 * POST /api/guest/redeem
 *
 * Redeems points for a guest against an active redemption rule.
 *
 * PRD Section 6.3 requirements:
 *  1. Checks the shared redemption rules record (must be active and owner-approved)
 *  2. Checks the guest's current private balance
 *  3. Responds yes or no, and by how much
 *  4. HARD REJECTION: any redemption that would take balance below zero is blocked
 *
 * The balance check and transaction creation are atomic (DB transaction).
 * Also logs the redemption to MessageLog for staff/owner audit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { redeemPoints } from '@/lib/points/points.service'

const RedeemSchema = z.object({
  guestId: z.string().min(1, 'guestId is required'),
  ruleId: z.string().min(1, 'ruleId is required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RedeemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { guestId, ruleId } = parsed.data

  // Verify guest exists by exact ID
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true },
  })
  if (!guest) {
    return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 })
  }

  const result = await redeemPoints(guestId, ruleId)

  if (!result.success) {
    // Log failed attempt for audit
    await prisma.messageLog.create({
      data: {
        guestId,
        message: `Redemption attempt rejected: ${result.error}`,
        context: 'redemption',
      },
    })
    return NextResponse.json({ success: false, error: result.error }, { status: 422 })
  }

  // Log successful redemption
  await prisma.messageLog.create({
    data: {
      guestId,
      message: `Redeemed ${result.pointsRedeemed} points. New balance: ${result.newBalance} points.`,
      context: 'redemption',
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      pointsRedeemed: result.pointsRedeemed,
      newBalance: result.newBalance,
    },
  })
}
