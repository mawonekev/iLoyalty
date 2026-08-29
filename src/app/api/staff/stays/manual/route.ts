export const dynamic = 'force-dynamic'
/**
 * POST /api/staff/stays/manual
 *
 * Staff enters a stay manually after a PMS sync failure is detected.
 *
 * PRD Section 6.7: Staff enters the stay; the system logs it as manualEntry=true
 * and routes it for owner approval before it affects any guest-visible balance.
 *
 * The stay is created with manualEntry=true and approvedBy=null.
 * Points are NOT created at this stage. They are created only after the owner
 * approves at /api/owner/stays/approve.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

const ManualStaySchema = z.object({
  guestId: z.string().min(1),
  hotelId: z.string().min(1),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  accommodationSpend: z.number().nonnegative(),
  foodAndBeverageSpend: z.number().nonnegative(),
  otherSpend: z.number().nonnegative(),
  /** Used as pmsRecordId — must be a stable unique identifier for this stay */
  referenceId: z.string().min(1, 'A stable reference ID is required for deduplication'),
  enteredBy: z.string().min(1, 'enteredBy (staff identifier) required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ManualStaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const d = parsed.data

  // Verify guest and hotel by exact ID
  const [guest, hotel] = await Promise.all([
    prisma.guest.findUnique({ where: { id: d.guestId }, select: { id: true } }),
    prisma.hotel.findUnique({ where: { id: d.hotelId, active: true }, select: { id: true } }),
  ])

  if (!guest) return NextResponse.json({ success: false, error: 'Guest not found.' }, { status: 404 })
  if (!hotel) return NextResponse.json({ success: false, error: 'Hotel not found or not active.' }, { status: 404 })

  // Use "MANUAL-{referenceId}" as pmsRecordId to namespace manual entries
  // and prevent collision with real PMS record IDs
  const pmsRecordId = `MANUAL-${d.referenceId}`

  // Check for duplicate using the same deduplication constraint as PMS sync
  const existing = await prisma.stay.findUnique({
    where: { pmsRecordId },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A stay with this reference ID already exists.' },
      { status: 409 }
    )
  }

  // Create stay with manualEntry=true, approvedBy=null
  // Points are NOT created here — owner must approve first (PRD Section 6.7)
  const stay = await prisma.stay.create({
    data: {
      pmsRecordId,
      guestId: d.guestId,
      hotelId: d.hotelId,
      checkIn: new Date(d.checkIn),
      checkOut: new Date(d.checkOut),
      accommodationSpend: d.accommodationSpend,
      foodAndBeverageSpend: d.foodAndBeverageSpend,
      otherSpend: d.otherSpend,
      source: 'iLoyalty',   // manual entries are always treated as iLoyalty source
      manualEntry: true,
      approvedBy: null,     // null until owner approves
    },
    select: {
      id: true, pmsRecordId: true, guestId: true, hotelId: true,
      checkIn: true, checkOut: true, manualEntry: true, approvedBy: true,
    },
  })

  // Log the manual entry action
  await prisma.messageLog.create({
    data: {
      guestId: d.guestId,
      message: `Manual stay entry submitted by ${d.enteredBy} for ${new Date(d.checkIn).toDateString()} – ${new Date(d.checkOut).toDateString()} at hotel ${d.hotelId}. Pending owner approval.`,
      context: 'manual-stay',
    },
  })

  return NextResponse.json({
    success: true,
    data: stay,
    notice: 'Stay created. Points will not be credited until the owner approves this entry.',
  }, { status: 201 })
}
