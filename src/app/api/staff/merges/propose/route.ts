export const dynamic = 'force-dynamic'
/**
 * POST /api/staff/merges/propose
 *
 * Staff proposes merging two guest profiles believed to belong to the same person.
 *
 * PRD Section 6.6: Staff presents both records; staff drafts a merge; the owner
 * approves before it takes effect. This route creates the PENDING draft.
 * The actual merge only happens after owner approval at /api/owner/merges/review.
 *
 * GET /api/staff/merges/propose?status=PENDING
 * Lists pending merge drafts for review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

const ProposeSchema = z.object({
  sourceGuestId: z.string().min(1, 'sourceGuestId required'),
  targetGuestId: z.string().min(1, 'targetGuestId required'),
  proposedBy: z.string().min(1, 'proposedBy (staff identifier) required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ProposeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { sourceGuestId, targetGuestId, proposedBy } = parsed.data

  if (sourceGuestId === targetGuestId) {
    return NextResponse.json({ success: false, error: 'Source and target must be different guests.' }, { status: 400 })
  }

  // Verify both guests exist by exact ID
  const [source, target] = await Promise.all([
    prisma.guest.findUnique({ where: { id: sourceGuestId }, select: { id: true, email: true, phone: true, createdAt: true } }),
    prisma.guest.findUnique({ where: { id: targetGuestId }, select: { id: true, email: true, phone: true, createdAt: true } }),
  ])

  if (!source) return NextResponse.json({ success: false, error: 'Source guest not found.' }, { status: 404 })
  if (!target) return NextResponse.json({ success: false, error: 'Target guest not found.' }, { status: 404 })

  // Check for existing pending merge between these two guests
  const existing = await prisma.profileMergeDraft.findFirst({
    where: {
      sourceGuestId,
      targetGuestId,
      status: 'PENDING',
    },
    select: { id: true },
  })

  if (existing) {
    return NextResponse.json({ success: false, error: 'A pending merge draft for these guests already exists.' }, { status: 409 })
  }

  const draft = await prisma.profileMergeDraft.create({
    data: { sourceGuestId, targetGuestId, proposedBy, status: 'PENDING' },
    select: { id: true, sourceGuestId: true, targetGuestId: true, status: true, proposedBy: true, createdAt: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      draft,
      sourceGuest: source,
      targetGuest: target,
    },
  }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? 'PENDING'

  const drafts = await prisma.profileMergeDraft.findMany({
    where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      proposedBy: true,
      reviewedBy: true,
      reviewNote: true,
      createdAt: true,
      updatedAt: true,
      sourceGuest: { select: { id: true, email: true, phone: true, createdAt: true } },
      targetGuest: { select: { id: true, email: true, phone: true, createdAt: true } },
    },
  })

  return NextResponse.json({ success: true, data: drafts })
}
