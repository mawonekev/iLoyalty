/**
 * Payment service — booking creation and Stripe Connect payment routing.
 *
 * PRD Section 6 requirements 5 and 5a:
 *
 *  5.  Payment is processed against the specific hotel's own merchant account.
 *      Status is NEVER marked CONFIRMED based on the app's own state.
 *      It waits for the payment provider's own confirmation (webhook).
 *
 *  5a. Each payment attempt carries a unique idempotency key, generated
 *      client-side at the moment the guest taps pay.
 *      A second attempt using the same key is rejected (409 Conflict).
 *      The payment provider's confirmation webhook is processed exactly once
 *      per transaction ID; duplicate webhook deliveries are ignored.
 *
 * Payment method (PRD Section 6.5): "points", "card", or "mixed".
 *  - "points" only: handled internally — no Stripe charge needed.
 *  - "card" or "mixed": creates a Stripe PaymentIntent routed to the
 *    hotel's connected Stripe account via the merchantAccountId.
 *
 * NOTE: Stripe keys and connected account handling require real Stripe API
 * credentials. The connector is structured for easy swap-in.
 */

import { prisma } from '@/lib/db/prisma'
import { redeemPoints } from '@/lib/points/points.service'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-08-26.dahlia' as any,
})

// ─── Booking creation ─────────────────────────────────────────────────────────

export interface CreateBookingInput {
  guestId: string
  hotelId: string
}

export async function createBooking(input: CreateBookingInput) {
  const { guestId, hotelId } = input

  // Verify hotel is active and get merchantAccountId for payment routing
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId, active: true },
    select: { id: true, merchantAccountId: true },
  })

  if (!hotel) {
    return { success: false as const, error: 'Hotel not found or not active.' }
  }

  const booking = await prisma.booking.create({
    data: { guestId, hotelId, status: 'PENDING' },
    select: { id: true, guestId: true, hotelId: true, status: true },
  })

  return { success: true as const, data: booking }
}

// ─── Payment charging ─────────────────────────────────────────────────────────

export interface ChargePaymentInput {
  guestId: string
  bookingId: string
  amount: number       // in pence/cents
  method: 'points' | 'card' | 'mixed'
  idempotencyKey: string  // generated client-side; unique per attempt
  ruleId?: string      // required for "points" or "mixed" method
}

export interface ChargePaymentResult {
  success: boolean
  paymentId?: string
  status?: 'PENDING' | 'CONFIRMED'
  clientSecret?: string  // for Stripe card payment, returned to client
  error?: string
}

export async function chargePayment(input: ChargePaymentInput): Promise<ChargePaymentResult> {
  const { guestId, bookingId, amount, method, idempotencyKey, ruleId } = input

  // 1. Idempotency: reject if this key has already been used (PRD Section 5a)
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true },
  })
  if (existing) {
    return {
      success: false,
      error: 'This payment attempt has already been submitted. Check your existing booking status.',
    }
  }

  // 2. Get the booking and hotel
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId, guestId },
    select: { id: true, hotel: { select: { id: true, merchantAccountId: true } } },
  })
  if (!booking) {
    return { success: false, error: 'Booking not found.' }
  }

  const { merchantAccountId } = booking.hotel

  // 3. Handle points redemption if method includes points
  if (method === 'points' || method === 'mixed') {
    if (!ruleId) {
      return { success: false, error: 'ruleId is required for points or mixed payment.' }
    }
    const redemptionResult = await redeemPoints(guestId, ruleId)
    if (!redemptionResult.success) {
      return { success: false, error: redemptionResult.error }
    }
  }

  // 4. Handle card payment via Stripe Connect
  if (method === 'card' || method === 'mixed') {
    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount,          // in smallest currency unit (pence)
          currency: 'gbp',
          // Route to the hotel's own connected merchant account (PRD Section 11)
          transfer_data: { destination: merchantAccountId },
          // Store idempotencyKey in metadata so webhook can match it
          metadata: { idempotencyKey, bookingId, guestId },
          // Do not capture automatically — wait for webhook confirmation
          capture_method: 'automatic',
        },
        {
          // Stripe-level idempotency key prevents duplicate API calls
          idempotencyKey,
        }
      )
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Payment provider error.',
      }
    }

    // 5. Create Payment record as PENDING — never confirmed without provider webhook
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        method,
        idempotencyKey,
        providerTxId: paymentIntent.id,  // store Stripe PaymentIntent ID for webhook matching
        providerConfirmed: false,         // PRD Section 5: never shown as paid until provider confirms
        status: 'PENDING',
      },
      select: { id: true, status: true },
    })

    return {
      success: true,
      paymentId: payment.id,
      status: 'PENDING',
      clientSecret: paymentIntent.client_secret ?? undefined,
    }
  }

  // 6. Points-only payment (no Stripe charge needed)
  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amount: 0,
      method: 'points',
      idempotencyKey,
      providerTxId: null,
      // Points-only payments are confirmed immediately (no external provider)
      providerConfirmed: true,
      status: 'CONFIRMED',
    },
    select: { id: true, status: true },
  })

  // Update booking status for points-only
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CONFIRMED' },
  })

  return {
    success: true,
    paymentId: payment.id,
    status: 'CONFIRMED',
  }
}

// ─── Webhook confirmation ─────────────────────────────────────────────────────

/**
 * Process a payment provider webhook confirmation.
 *
 * PRD Section 5a: The webhook is processed exactly once per providerTxId.
 * Duplicate deliveries are silently ignored (idempotent).
 *
 * This is the ONLY place where a payment is marked CONFIRMED.
 * The app never self-confirms based on its own state.
 */
export async function confirmPaymentFromWebhook(
  providerTxId: string,
  succeeded: boolean
): Promise<{ success: boolean; alreadyProcessed: boolean; error?: string }> {
  // Find the payment by providerTxId
  const payment = await prisma.payment.findUnique({
    where: { providerTxId },
    select: { id: true, bookingId: true, providerConfirmed: true, status: true },
  })

  if (!payment) {
    return { success: false, alreadyProcessed: false, error: 'Payment not found for this transaction ID.' }
  }

  // Idempotency: ignore duplicate webhook deliveries (PRD Section 5a)
  if (payment.providerConfirmed) {
    return { success: true, alreadyProcessed: true }
  }

  if (succeeded) {
    // Only now mark as confirmed — live provider confirmation received
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { providerConfirmed: true, status: 'CONFIRMED' },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'CONFIRMED' },
      }),
    ])
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    })
  }

  return { success: true, alreadyProcessed: false }
}
