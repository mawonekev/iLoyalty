/**
 * POST /api/payments/webhook
 *
 * Receives Stripe webhook events and updates payment/booking status.
 *
 * PRD Section 5a requirements:
 *  - Processed exactly once per providerTxId (Stripe PaymentIntent ID)
 *  - Duplicate webhook deliveries are ignored (idempotent)
 *  - Payment is NEVER confirmed until this webhook fires — the app
 *    does not self-confirm based on its own state
 *
 * Webhook verification: requests are authenticated using the Stripe
 * webhook signing secret (STRIPE_WEBHOOK_SECRET) to prevent spoofed
 * confirmation events.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { confirmPaymentFromWebhook } from '@/lib/payments/payments.service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-08-26.dahlia' as any,
})

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? ''
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 400 })
  }

  // We only care about PaymentIntent success and failure events
  if (
    event.type === 'payment_intent.succeeded' ||
    event.type === 'payment_intent.payment_failed'
  ) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const succeeded = event.type === 'payment_intent.succeeded'

    const result = await confirmPaymentFromWebhook(paymentIntent.id, succeeded)

    if (!result.success) {
      console.error('Webhook processing error:', result.error)
      // Return 200 to Stripe so it doesn't retry — we log the issue
      return NextResponse.json({ received: true, warning: result.error })
    }

    if (result.alreadyProcessed) {
      // Duplicate delivery — silently acknowledge (PRD Section 5a)
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  // Acknowledge all other event types
  return NextResponse.json({ received: true })
}
