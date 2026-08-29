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

  return NextResponse.json({ success: true, data: rules })
}
