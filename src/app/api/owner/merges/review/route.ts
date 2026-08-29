export const dynamic = 'force-dynamic'
/**
 * POST /api/owner/merges/review
 *
 * Owner approves or rejects a staff-proposed profile merge.
 *
 * PRD Section 6.6: The merge takes effect only after owner approval.
 * On approval, all of source guest's stays, pointsTransactions, and bookings
 * are reassigned to the target guest. The source guest record is then deleted.
 *
 * This is a destructive operation and is wrapped in a DB transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

const ReviewSchema = z.object({
  draftId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewedBy: z.string().min(1, 'Owner identifier required'),
  reviewNote: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { draftId, decision, reviewedBy, reviewNote } = parsed.data

  const draft = await prisma.profileMergeDraft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true, sourceGuestId: true, targetGuestId: true },
  })

  if (!draft) return NextResponse.json({ success: false, error: 'Merge draft not found.' }, { status: 404 })
  if (draft.status !== 'PENDING') {
    return NextResponse.json({ success: false, error: 'This draft has already been reviewed.' }, { status: 409 })
  }

  if (decision === 'REJECTED') {
    await prisma.profileMergeDraft.update({
      where: { id: draftId },
      data: { status: 'REJECTED', reviewedBy, reviewNote: reviewNote ?? null },
    })
    return NextResponse.json({ success: true, data: { decision: 'REJECTED' } })
  }

  // APPROVED: execute the merge inside a transaction
  await prisma.$transaction(async (tx) => {
    const { sourceGuestId, targetGuestId } = draft

    // Reassign all source guest data to target guest
    await tx.stay.updateMany({ where: { guestId: sourceGuestId }, data: { guestId: targetGuestId } })
    await tx.pointsTransaction.updateMany({ where: { guestId: sourceGuestId }, data: { guestId: targetGuestId } })
    await tx.booking.updateMany({ where: { guestId: sourceGuestId }, data: { guestId: targetGuestId } })
    await tx.messageLog.updateMany({ where: { guestId: sourceGuestId }, data: { guestId: targetGuestId } })

    // Update other merge drafts that reference this source guest
    await tx.profileMergeDraft.updateMany({
      where: { sourceGuestId, id: { not: draftId } },
      data: { status: 'REJECTED', reviewNote: 'Source guest was merged into another account.' },
    })

    // Mark draft as approved
    await tx.profileMergeDraft.update({
      where: { id: draftId },
      data: { status: 'APPROVED', reviewedBy, reviewNote: reviewNote ?? null },
    })

    // Delete the source guest record
    await tx.guest.delete({ where: { id: sourceGuestId } })
  })

  return NextResponse.json({
    success: true,
    data: { decision: 'APPROVED', mergedInto: draft.targetGuestId },
  })
}
