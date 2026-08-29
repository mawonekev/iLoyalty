import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createBooking, chargePayment, confirmPaymentFromWebhook } from '../src/lib/payments/payments.service'
import { prisma } from '../src/lib/db/prisma'

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents = {
        create: vi.fn(async ({ transfer_data, metadata }: any) => {
          return {
            id: 'pi_mock_' + Math.random().toString(36).substring(2, 9),
            client_secret: 'pi_secret_mock',
            transfer_data,
            metadata,
          }
        }),
      }
    },
  }
})

vi.mock('../src/lib/db/prisma', () => {
  const hotels = new Map<string, any>()
  const bookings = new Map<string, any>()
  const payments = new Map<string, any>()

  return {
    prisma: {
      hotel: {
        findUnique: vi.fn(async ({ where }: any) => hotels.get(where.id) || null),
      },
      booking: {
        create: vi.fn(async ({ data }: any) => {
          const id = 'booking_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data, status: 'PENDING' }
          bookings.set(id, record)
          return record
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const b = bookings.get(where.id)
          if (!b) return null
          const hotel = hotels.get(b.hotelId)
          return { ...b, hotel }
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const b = bookings.get(where.id)
          const updated = { ...b, ...data }
          bookings.set(where.id, updated)
          return updated
        }),
      },
      payment: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.idempotencyKey) {
            for (const p of Array.from(payments.values())) {
              if (p.idempotencyKey === where.idempotencyKey) return p
            }
          }
          if (where.providerTxId) {
            for (const p of Array.from(payments.values())) {
              if (p.providerTxId === where.providerTxId) return p
            }
          }
          return null
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = 'payment_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data }
          payments.set(id, record)
          return record
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const p = payments.get(where.id)
          const updated = { ...p, ...data }
          payments.set(where.id, updated)
          return updated
        }),
      },
      $transaction: vi.fn(async (ops: any[]) => {
        return Promise.all(ops)
      }),
      _seedHotel: (h: any) => hotels.set(h.id, h),
      _clear: () => {
        hotels.clear()
        bookings.clear()
        payments.clear()
      },
      _getPayments: () => Array.from(payments.values()),
    },
  }
})

describe('Stage 8: Booking and Multi-Merchant Payment Flow', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
    // @ts-expect-error test helper
    prisma._seedHotel({
      id: 'hotel_12',
      name: 'Grand Pilot Hotel Leeds',
      merchantAccountId: 'acct_hotel12_stripe',
      active: true,
    })
  })

  it('creates booking in PENDING status with correct hotel routing', async () => {
    const result = await createBooking({
      guestId: 'guest_sarah',
      hotelId: 'hotel_12',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('PENDING')
      expect(result.data.hotelId).toBe('hotel_12')
    }
  })

  it('processes payment attempt with unique idempotencyKey as PENDING (not self-confirmed)', async () => {
    const bookingRes = await createBooking({
      guestId: 'guest_sarah',
      hotelId: 'hotel_12',
    })
    const bookingId = (bookingRes as any).data.id

    const idempotencyKey = 'uuid-payment-attempt-1'
    const result = await chargePayment({
      guestId: 'guest_sarah',
      bookingId,
      amount: 12000, // £120.00
      method: 'card',
      idempotencyKey,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('PENDING') // Never confirmed until provider webhook confirms it
    expect(result.clientSecret).toBeDefined()

    // @ts-expect-error test helper
    const payments = prisma._getPayments()
    expect(payments).toHaveLength(1)
    expect(payments[0].providerConfirmed).toBe(false)
    expect(payments[0].status).toBe('PENDING')
    expect(payments[0].idempotencyKey).toBe(idempotencyKey)
  })

  it('rejects duplicate payment attempt using identical idempotencyKey', async () => {
    const bookingRes = await createBooking({
      guestId: 'guest_sarah',
      hotelId: 'hotel_12',
    })
    const bookingId = (bookingRes as any).data.id

    const idempotencyKey = 'uuid-payment-attempt-duplicate'

    // First attempt
    await chargePayment({
      guestId: 'guest_sarah',
      bookingId,
      amount: 12000,
      method: 'card',
      idempotencyKey,
    })

    // Second attempt with same idempotency key (e.g. network retry or double-tap)
    const result2 = await chargePayment({
      guestId: 'guest_sarah',
      bookingId,
      amount: 12000,
      method: 'card',
      idempotencyKey,
    })

    expect(result2.success).toBe(false)
    expect(result2.error).toContain('already been submitted')
  })

  it('confirms payment and booking only upon verified webhook delivery and ignores duplicates', async () => {
    const bookingRes = await createBooking({
      guestId: 'guest_sarah',
      hotelId: 'hotel_12',
    })
    const bookingId = (bookingRes as any).data.id

    await chargePayment({
      guestId: 'guest_sarah',
      bookingId,
      amount: 12000,
      method: 'card',
      idempotencyKey: 'uuid-payment-webhook-test',
    })

    // @ts-expect-error test helper
    const payment = prisma._getPayments()[0]
    const providerTxId = payment.providerTxId

    // 1. First webhook confirmation
    const webhookResult1 = await confirmPaymentFromWebhook(providerTxId, true)
    expect(webhookResult1.success).toBe(true)
    expect(webhookResult1.alreadyProcessed).toBe(false)

    // 2. Duplicate webhook delivery (e.g. Stripe retry)
    const webhookResult2 = await confirmPaymentFromWebhook(providerTxId, true)
    expect(webhookResult2.success).toBe(true)
    expect(webhookResult2.alreadyProcessed).toBe(true) // Ignored safely
  })
})
