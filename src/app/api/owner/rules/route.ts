export const dynamic = 'force-dynamic'
/**
 * /api/owner/rules
 *
 * GET: Lists all redemption rules (active and inactive) for owner review.
 * POST: Owner creates or updates a redemption rule with signed approvedBy ID.
 *
 * PRD Section 6.10: The owner reviews and approves the redemption rules record before it goes live.
 * PRD Section 8: approvedBy (owner ID) is required before active: true.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

const RuleSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'description required'),
  pointsCost: z.number().int().positive('pointsCost must be positive'),
  active: z.boolean().default(true),
  approvedBy: z.string().min(1, 'approvedBy (owner identifier) required'),
})

export async function GET() {
  const rules = await prisma.redemptionRule.findMany({
    orderBy: { pointsCost: 'asc' },
  })

  return NextResponse.json({ success: true, data: rules })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { id, description, pointsCost, active, approvedBy } = parsed.data

  let rule
  if (id) {
    rule = await prisma.redemptionRule.update({
      where: { id },
      data: { description, pointsCost, active, approvedBy },
    })
  } else {
    rule = await prisma.redemptionRule.create({
      data: { description, pointsCost, active, approvedBy },
    })
  }

  return NextResponse.json({ success: true, data: rule }, { status: id ? 200 : 201 })
}
