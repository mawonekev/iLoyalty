import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getPointsBalance, getStayHistory } from '../src/lib/points/points.service'
import { prisma } from '../src/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

vi.mock('../src/lib/db/prisma', () => {
  const pointsTx = new Map<string, any>()
  const stays = new Map<string, any>()

  return {
    prisma: {
      pointsTransaction: {
        findMany: vi.fn(async ({ where }: any) => {
          const results = []
          for (const tx of Array.from(pointsTx.values())) {
            if (where.guestId && tx.guestId !== where.guestId) continue
            results.push(tx)
          }
          return results
        }),
      },
      stay: {
        findMany: vi.fn(async ({ where }: any) => {
          const results = []
          for (const s of Array.from(stays.values())) {
            if (where.guestId && s.guestId !== where.guestId) continue
            results.push(s)
          }
          return results.sort((a, b) => b.checkOut.getTime() - a.checkOut.getTime())
        }),
      },
      _seedTx: (tx: any) => pointsTx.set(tx.id, tx),
      _seedStay: (stay: any) => stays.set(stay.id, stay),
      _clear: () => {
        pointsTx.clear()
        stays.clear()
      },
    },
  }
})

describe('Stage 5: Guest-Facing Balance and Stay History', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
  })

  it('calculates available balance as unexpired earned minus redeemed (never below zero)', async () => {
    const now = new Date()

    // 1. Unexpired earned: 100 points
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_1',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 100,
      expiresAt: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
    })

    // 2. Unexpired earned: 50 points
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_2',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 50,
      expiresAt: new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000),
    })

    // 3. Expired earned: 40 points (should NOT be counted in balance)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_3',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 40,
      expiresAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    })

    // 4. Redeemed: 30 points
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_4',
      guestId: 'guest_sarah',
      type: 'redeemed',
      amount: 30,
      expiresAt: null,
    })

    const balance = await getPointsBalance('guest_sarah')

    expect(balance.totalEarned).toBe(150) // 100 + 50 (40 expired excluded)
    expect(balance.totalRedeemed).toBe(30)
    expect(balance.available).toBe(120) // 150 - 30
  })

  it('detects points expiring within 30 days and surfaces amount and earliest expiry date', async () => {
    const now = new Date()

    // Batch 1: Expiring in 12 days (25 points) -> Inside 30 days
    const expiryDate1 = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_expiring_soon',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 25,
      expiresAt: expiryDate1,
    })

    // Batch 2: Expiring in 20 days (15 points) -> Inside 30 days
    const expiryDate2 = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_expiring_later',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 15,
      expiresAt: expiryDate2,
    })

    // Batch 3: Expiring in 180 days (60 points) -> Outside 30 days
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_far_away',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 60,
      expiresAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
    })

    const balance = await getPointsBalance('guest_sarah')

    expect(balance.expiringWithin30Days).toBe(40) // 25 + 15
    expect(balance.nearestExpiryDate).toEqual(expiryDate1)
  })

  it('fetches stay history by exact guest ID with spend breakdown and points per stay', async () => {
    // @ts-expect-error test helper
    prisma._seedStay({
      id: 'stay_1',
      guestId: 'guest_sarah',
      hotelId: 'hotel_12',
      hotel: { name: 'Grand Pilot Hotel Leeds' },
      checkIn: new Date('2026-03-01'),
      checkOut: new Date('2026-03-04'),
      accommodationSpend: new Decimal('300.00'),
      foodAndBeverageSpend: new Decimal('100.00'),
      source: 'iLoyalty',
      manualEntry: false,
      pointsTransactions: [{ amount: 8 }],
    })

    const history = await getStayHistory('guest_sarah')

    expect(history).toHaveLength(1)
    expect(history[0].hotelName).toBe('Grand Pilot Hotel Leeds')
    expect(history[0].pointsEarned).toBe(8)
    expect(history[0].accommodationSpend.toString()).toBe('300')
    expect(history[0].foodAndBeverageSpend.toString()).toBe('100')
  })
})
