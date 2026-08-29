export const dynamic = 'force-dynamic'
/**
 * POST /api/bookings/create
 *
 * Creates a new booking (PENDING) for a guest at an active hotel.
 * Payment is handled separately at /api/payments/charge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { createBooking } from '@/lib/payments/payments.service'

const CreateBookingSchema = z.object({
  guestId: z.string().min(1),
  hotelId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  // Verify guest exists by exact ID
  const guest = await prisma.guest.findUnique({
    where: { id: parsed.data.guestId },
    select: { id: true },
  })
  if (!guest) {
    return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 })
  }

  const result = await createBooking(parsed.data)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 422 })
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 })
}
