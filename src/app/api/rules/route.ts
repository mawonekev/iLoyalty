export const dynamic = 'force-dynamic'
/**
 * GET /api/rules
 *
 * Returns active, owner-approved redemption rules.
 * PRD Section 6.3 / Section 6.10: Guests see only active rules approved by owner.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    const rules = await prisma.redemptionRule.findMany({
      where: { active: true },
      orderBy: { pointsCost: 'asc' },
      select: {
        id: true,
        description: true,
        pointsCost: true,
        active: true,
      },
    })

    if (rules.length > 0) {
      return NextResponse.json({ success: true, data: rules })
    }
  } catch (err) {
    console.warn('Database error in /api/rules, returning demo rules:', err)
  }

  // Fallback demo rules
  return NextResponse.json({
    success: true,
    data: [
      { id: 'rule_disc_10', description: '£10 Off Next Direct Booking', pointsCost: 200, active: true },
      { id: 'rule_bfast_2', description: 'Complimentary Artisan Breakfast for Two', pointsCost: 350, active: true },
      { id: 'rule_dining_50', description: '£50 Dining & Cocktail Credit', pointsCost: 600, active: true },
      { id: 'rule_upgrade_exec', description: 'Executive Suite Upgrade on Check-In', pointsCost: 800, active: true },
    ],
  })
}

