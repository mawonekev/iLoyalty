import { describe, it, expect, beforeEach, vi } from 'vitest'
import { redeemPoints } from '../src/lib/points/points.service'
import { prisma } from '../src/lib/db/prisma'

vi.mock('../src/lib/db/prisma', () => {
  const pointsTx = new Map<string, any>()
  const rules = new Map<string, any>()

  const txMock = {
    redemptionRule: {
      findUnique: vi.fn(async ({ where }: any) => rules.get(where.id) || null),
    },
    pointsTransaction: {
      findMany: vi.fn(async ({ where }: any) => {
        const results = []
        for (const tx of Array.from(pointsTx.values())) {
          if (where.guestId && tx.guestId !== where.guestId) continue
          results.push(tx)
        }
        return results
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = 'ptx_' + Math.random().toString(36).substring(2, 9)
        const record = { id, ...data, createdAt: new Date() }
        pointsTx.set(id, record)
        return record
      }),
    },
  }

  return {
    prisma: {
      $transaction: vi.fn(async (cb: any) => cb(txMock)),
      _seedRule: (rule: any) => rules.set(rule.id, rule),
      _seedTx: (tx: any) => pointsTx.set(tx.id, tx),
      _clear: () => {
        pointsTx.clear()
        rules.clear()
      },
      _getPointsTx: () => Array.from(pointsTx.values()),
    },
  }
})

describe('Stage 6: Points Redemption Flow', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()

    // Active owner-approved rule: £10 F&B credit for 50 points
    // @ts-expect-error test helper
    prisma._seedRule({
      id: 'rule_fnb_10',
      description: '£10 Food & Beverage Voucher',
      pointsCost: 50,
      active: true,
      approvedBy: 'owner_central',
    })

    // Inactive rule: Room upgrade (pending owner signoff)
    // @ts-expect-error test helper
    prisma._seedRule({
      id: 'rule_upgrade',
      description: 'Complimentary Room Upgrade',
      pointsCost: 100,
      active: false,
      approvedBy: 'owner_central',
    })
  })

  it('successfully redeems points when guest has sufficient balance and rule is active', async () => {
    const now = new Date()

    // Guest has 80 unexpired earned points
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_earned_80',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 80,
      expiresAt: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
    })

    const result = await redeemPoints('guest_sarah', 'rule_fnb_10')

    expect(result.success).toBe(true)
    expect(result.pointsRedeemed).toBe(50)
    expect(result.newBalance).toBe(30) // 80 - 50 = 30

    // @ts-expect-error test helper
    const allTx = prisma._getPointsTx()
    const redeemTx = allTx.find((t: any) => t.type === 'redeemed')
    expect(redeemTx).toBeDefined()
    expect(redeemTx.amount).toBe(50)
    expect(redeemTx.pointsCostAtRedemption).toBe(50)
    expect(redeemTx.expiresAt).toBeNull()
    expect(redeemTx.stayId).toBeNull()
  })

  it('strictly blocks redemption if balance would go below zero (PRD Section 6.3)', async () => {
    const now = new Date()

    // Guest has only 30 earned points (rule costs 50)
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_earned_30',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 30,
      expiresAt: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
    })

    const result = await redeemPoints('guest_sarah', 'rule_fnb_10')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Insufficient points')
    expect(result.error).toContain('30 points')

    // No redeemed transaction was created
    // @ts-expect-error test helper
    const allTx = prisma._getPointsTx()
    const redeemTx = allTx.find((t: any) => t.type === 'redeemed')
    expect(redeemTx).toBeUndefined()
  })

  it('rejects redemption against an inactive rule', async () => {
    const now = new Date()

    // Guest has 200 points
    // @ts-expect-error test helper
    prisma._seedTx({
      id: 'tx_earned_200',
      guestId: 'guest_sarah',
      type: 'earned',
      amount: 200,
      expiresAt: new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000),
    })

    const result = await redeemPoints('guest_sarah', 'rule_upgrade') // Inactive rule

    expect(result.success).toBe(false)
    expect(result.error).toContain('not active')
  })
})
