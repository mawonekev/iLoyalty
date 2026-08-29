export const dynamic = 'force-dynamic'
/**
 * GET /api/staff/messages
 *
 * Staff view of the guest-facing message and financial statement audit log.
 * PRD Section 6.8: Staff and owner can view a log of what the app has told guests
 * about points or money.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const guestId = request.nextUrl.searchParams.get('guestId')
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10))

  const messages = await prisma.messageLog.findMany({
    where: guestId ? { guestId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ success: true, data: messages })
}
