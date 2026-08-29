export const dynamic = 'force-dynamic'
/**
 * GET /api/owner/messages
 *
 * Group-level message and financial statement audit log for the owner.
 * PRD Section 6.11: The owner reviews the guest-message log at group level.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const context = request.nextUrl.searchParams.get('context')
  const limit = Math.min(200, parseInt(request.nextUrl.searchParams.get('limit') || '100', 10))

  const messages = await prisma.messageLog.findMany({
    where: context ? { context } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Group-level context summary
  const summary = await prisma.messageLog.groupBy({
    by: ['context'],
    _count: { id: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      totalLogged: messages.length,
      byContext: summary.map((s) => ({ context: s.context, count: s._count.id })),
      messages,
    },
  })
}
