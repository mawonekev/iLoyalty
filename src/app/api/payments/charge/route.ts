export const dynamic = 'force-dynamic'
/**
 * POST /api/payments/charge
 *
 * Initiates a payment for a booking.
 *
 * PRD Section 5a: The idempotencyKey MUST be generated client-side at the
 * moment the guest taps "Pay" and sent with this request.
 * If the same key is submitted again, it is rejected with 409 Conflict.
 *
 * The payment stays PENDING until the Stripe webhook confirms it.
 * The client should use the returned clientSecret to complete card payment
 * in the Stripe Elements UI, then wait for the booking status to update.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chargePayment } from '@/lib/payments/payments.service'

const ChargeSchema = z.object({
  guestId: z.string().min(1),
  bookingId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum(['points', 'card', 'mixed']),
  /** UUID generated client-side at the moment the user taps Pay */
  idempotencyKey: z.string().uuid('idempotencyKey must be a UUID'),
  ruleId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ChargeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const result = await chargePayment(parsed.data)

  if (!result.success) {
    // Duplicate idempotency key → 409; other errors → 422
    const isDuplicate = result.error?.includes('already been submitted')
    return NextResponse.json(
      { success: false, error: result.error },
      { status: isDuplicate ? 409 : 422 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      paymentId: result.paymentId,
      status: result.status,
      // clientSecret is returned for card payments so Stripe Elements can complete payment
      ...(result.clientSecret ? { clientSecret: result.clientSecret } : {}),
    },
  })
}
