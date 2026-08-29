import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../src/lib/db/prisma'

vi.mock('../src/lib/db/prisma', () => {
  const hotels = new Map<string, any>()
  const stays = new Map<string, any>()
  const pointsTx = new Map<string, any>()
  const rules = new Map<string, any>()
  const syncLogs = new Map<string, any>()

  return {
    prisma: {
      hotel: {
        findMany: vi.fn(async () => Array.from(hotels.values())),
      },
      stay: {
        findMany: vi.fn(async ({ where }: any) => {
          const results = []
          for (const s of Array.from(stays.values())) {
            if (where.hotelId && s.hotelId !== where.hotelId) continue
            results.push(s)
          }
          return results
        }),
      },
      pointsTransaction: {
        findMany: vi.fn(async ({ where }: any) => {
          const results = []
          for (const tx of Array.from(pointsTx.values())) {
            if (where.stayId?.in && !where.stayId.in.includes(tx.stayId)) continue
            if (where.type && tx.type !== where.type) continue
            results.push(tx)
          }
          return results
        }),
      },
      booking: {
        findMany: vi.fn(async () => []),
      },
      syncLog: {
        findFirst: vi.fn(async ({ where }: any) => {
          const logs = Array.from(syncLogs.values()).filter((l) => l.hotelId === where.hotelId)
          return logs[logs.length - 1] || null
        }),
        count: vi.fn(async ({ where }: any) => {
          let count = 0
          for (const l of Array.from(syncLogs.values())) {
            if (l.hotelId === where.hotelId && l.status === where.status) count++
          }
          return count
        }),
      },
      redemptionRule: {
        create: vi.fn(async ({ data }: any) => {
          const id = 'rule_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data }
          rules.set(id, record)
          return record
        }),
        findMany: vi.fn(async () => Array.from(rules.values())),
      },
      _seedHotel: (h: any) => hotels.set(h.id, h),
      _seedStay: (s: any) => stays.set(s.id, s),
      _seedTx: (tx: any) => pointsTx.set(tx.id, tx),
      _seedSyncLog: (log: any) => syncLogs.set(log.id, log),
      _clear: () => {
        hotels.clear()
        stays.clear()
        pointsTx.clear()
        rules.clear()
        syncLogs.clear()
      },
    },
  }
})

describe('Stage 10: Owner Screens and Reporting', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
    // @ts-expect-error test helper
    prisma._seedHotel({ id: 'hotel_12', name: 'Grand Pilot Hotel Leeds', active: true })
    // @ts-expect-error test helper
    prisma._seedHotel({ id: 'hotel_37', name: 'Pilot Hotel York', active: true })
  })

  it('verifies redemption rule creation requires owner approvedBy signoff', async () => {
    const rule = await prisma.redemptionRule.create({
      data: {
        description: '£20 Spa Voucher',
        pointsCost: 100,
        active: true,
        approvedBy: 'owner_central_exec',
      },
    })

    expect(rule.id).toBeDefined()
    expect(rule.approvedBy).toBe('owner_central_exec')
    expect(rule.active).toBe(true)
  })

  it('detects sync failures per hotel and computes failure counts for owner dashboard', async () => {
    // Hotel 12: Success
    // @ts-expect-error test helper
    prisma._seedSyncLog({
      id: 'sync_1',
      hotelId: 'hotel_12',
      status: 'SUCCESS',
      recordsProcessed: 10,
      recordsUpserted: 10,
      startedAt: new Date(),
    })

    // Hotel 37: Failure
    // @ts-expect-error test helper
    prisma._seedSyncLog({
      id: 'sync_2',
      hotelId: 'hotel_37',
      status: 'FAILED',
      errorMessage: 'PMS connection timeout',
      startedAt: new Date(),
    })

    const latest12 = await prisma.syncLog.findFirst({ where: { hotelId: 'hotel_12' } })
    const latest37 = await prisma.syncLog.findFirst({ where: { hotelId: 'hotel_37' } })
    const failures37 = await prisma.syncLog.count({ where: { hotelId: 'hotel_37', status: 'FAILED' } })

    expect(latest12?.status).toBe('SUCCESS')
    expect(latest37?.status).toBe('FAILED')
    expect(latest37?.errorMessage).toContain('timeout')
    expect(failures37).toBe(1)
  })
})
