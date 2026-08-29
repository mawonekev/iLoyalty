export const dynamic = 'force-dynamic'
/**
 * POST /api/owner/stays/approve
 *
 * Owner approves a manually-entered stay, triggering points calculation and credit.
 *
 * PRD Section 6.7: Points from a manual stay entry only affect the guest-visible
 * balance after the owner explicitly approves. This route sets approvedBy and
 * creates the PointsTransaction in the same DB transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

const ApproveStaySchema = z.object({
  stayId: z.string().min(1),
  approvedBy: z.string().min(1, 'Owner identifier required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ApproveStaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { stayId, approvedBy } = parsed.data

  const stay = await prisma.stay.findUnique({
    where: { id: stayId },
    select: {
      id: true, guestId: true, manualEntry: true, approvedBy: true,
      source: true, accommodationSpend: true, foodAndBeverageSpend: true,
    },
  })

  if (!stay) return NextResponse.json({ success: false, error: 'Stay not found.' }, { status: 404 })
  if (!stay.manualEntry) return NextResponse.json({ success: false, error: 'This is not a manual entry stay.' }, { status: 400 })
  if (stay.approvedBy) return NextResponse.json({ success: false, error: 'This stay has already been approved.' }, { status: 409 })

  // Get earn rate
  const config = await prisma.loyaltyConfig.findFirst({
    orderBy: { effectiveFrom: 'desc' },
    select: { earnRate: true },
  })
  if (!config) {
    return NextResponse.json({ success: false, error: 'No LoyaltyConfig found.' }, { status: 500 })
  }

  const eligibleSpend = Number(stay.accommodationSpend) + Number(stay.foodAndBeverageSpend)
  const pointsAmount = stay.source === 'iLoyalty'
    ? Math.floor(eligibleSpend * config.earnRate.toNumber())
    : 0

  await prisma.$transaction(async (tx) => {
    // Mark stay as approved
    await tx.stay.update({
      where: { id: stayId },
      data: { approvedBy },
    })

    // Create points transaction only if eligible and points > 0
    if (pointsAmount > 0) {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)

      await tx.pointsTransaction.create({
        data: {
          guestId: stay.guestId,
          stayId,
          type: 'earned',
          amount: pointsAmount,
          expiresAt,
        },
      })
    }

    // Log the approval
    await tx.messageLog.create({
      data: {
        guestId: stay.guestId,
        message: `Manual stay approved by ${approvedBy}. ${pointsAmount > 0 ? `${pointsAmount} points credited.` : 'No points credited (ineligible source or zero spend).'}`,
        context: 'manual-stay-approval',
      },
    })
  })

  return NextResponse.json({
    success: true,
    data: { stayId, approvedBy, pointsCreated: pointsAmount },
  })
}
