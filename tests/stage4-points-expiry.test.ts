import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reportExpiredPoints } from '../src/lib/points/expiry.service'
import { prisma } from '../src/lib/db/prisma'

vi.mock('../src/lib/db/prisma', () => {
  const pointsTx = new Map<string, any>()

  return {
    prisma: {
      pointsTransaction: {
        findMany: vi.fn(async ({ where }: any) => {
          const results = []
          const now = where.expiresAt?.lte || new Date()

          for (const tx of Array.from(pointsTx.values())) {
            if (where.type && tx.type !== where.type) continue
            if (where.expiresAt?.lte && tx.expiresAt > now) continue
            results.push(tx)
          }
          return results
        }),
      },
      _seedTx: (tx: any) => pointsTx.set(tx.id, tx),
      _clear: () => pointsTx.clear(),
    },
  }
})

describe('Stage 4: Points Expiry Scheduled Job', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
  })

  it('correctly identifies and reports transactions whose 365-day lifetime has elapsed', async () => {
    const now = new Date()

    // 1. Batch earned 400 days ago (expiresAt was 35 days ago) -> EXPIRED
    const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_old',
      guestId: 'guest_1',
      stayId: 'stay_old',
      type: 'earned',
      amount: 50,
      expiresAt: expiredDate,
      createdAt: new Date(expiredDate.getTime() - 365 * 24 * 60 * 60 * 1000),
    })

    // 2. Batch earned 100 days ago (expires in 265 days) -> ACTIVE
    const activeDate = new Date(now.getTime() + 265 * 24 * 60 * 60 * 1000)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_new',
      guestId: 'guest_1',
      stayId: 'stay_new',
      type: 'earned',
      amount: 100,
      expiresAt: activeDate,
      createdAt: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000),
    })

    const report = await reportExpiredPoints()

    expect(report.expiredTransactionCount).toBe(1)
    expect(report.totalPointsExpired).toBe(50)
    expect(report.ranAt).toBeInstanceOf(Date)
  })

  it('handles per-batch expiry across different dates and stays independently', async () => {
    const now = new Date()

    // Guest has 3 batches from 3 different stays
    // Batch 1: Expired 10 days ago (30 points)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_1',
      guestId: 'guest_sarah',
      stayId: 'stay_1',
      type: 'earned',
      amount: 30,
      expiresAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    })

    // Batch 2: Expired 2 days ago (20 points)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_2',
      guestId: 'guest_sarah',
      stayId: 'stay_2',
      type: 'earned',
      amount: 20,
      expiresAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    })

    // Batch 3: Still active, expires in 90 days (40 points)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_3',
      guestId: 'guest_sarah',
      stayId: 'stay_3',
      type: 'earned',
      amount: 40,
      expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    })

    const report = await reportExpiredPoints()

    expect(report.expiredTransactionCount).toBe(2)
    expect(report.totalPointsExpired).toBe(50) // 30 + 20
  })
})
