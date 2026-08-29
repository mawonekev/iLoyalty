import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runPmsSync, PmsStayRecord } from '../src/lib/sync/pms.service'
import { prisma } from '../src/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// Mock prisma for isolated verification of PMS sync rules
vi.mock('../src/lib/db/prisma', () => {
  const guests = new Map<string, { id: string; email: string }>()
  const stays = new Map<string, any>()
  const pointsTx = new Map<string, any>()
  const syncLogs = new Map<string, any>()

  return {
    prisma: {
      loyaltyConfig: {
        findFirst: vi.fn(async () => ({
          id: 'config_1',
          earnRate: new Decimal('0.02'), // 2%
          effectiveFrom: new Date(),
        })),
      },
      guest: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.email) {
            for (const g of Array.from(guests.values())) {
              if (g.email === where.email) return g
            }
          }
          return null
        }),
      },
      stay: {
        upsert: vi.fn(async ({ where, update, create }: any) => {
          const existing = stays.get(where.pmsRecordId)
          if (existing) {
            const updated = { ...existing, ...update }
            stays.set(where.pmsRecordId, updated)
            return updated
          }
          const id = 'stay_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...create }
          stays.set(where.pmsRecordId, record)
          return record
        }),
      },
      pointsTransaction: {
        findFirst: vi.fn(async ({ where }: any) => {
          for (const tx of Array.from(pointsTx.values())) {
            if (tx.stayId === where.stayId && tx.type === where.type) {
              return tx
            }
          }
          return null
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = 'ptx_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data, createdAt: new Date() }
          pointsTx.set(id, record)
          return record
        }),
      },
      syncLog: {
        create: vi.fn(async ({ data }: any) => {
          const id = 'sync_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data }
          syncLogs.set(id, record)
          return record
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const existing = syncLogs.get(where.id)
          const updated = { ...existing, ...data }
          syncLogs.set(where.id, updated)
          return updated
        }),
      },
      _seedGuest: (g: { id: string; email: string }) => guests.set(g.id, g),
      _clear: () => {
        guests.clear()
        stays.clear()
        pointsTx.clear()
        syncLogs.clear()
      },
      _getStays: () => Array.from(stays.values()),
      _getPointsTx: () => Array.from(pointsTx.values()),
      _getSyncLogs: () => Array.from(syncLogs.values()),
    },
  }
})

describe('Stage 3: PMS Stay and Points Ingestion', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
    // @ts-expect-error test helper
    prisma._seedGuest({ id: 'guest_sarah', email: 'sarah.smith@example.com' })
  })

  it('ingests stay and calculates points only on accommodation + F&B for iLoyalty source', async () => {
    const mockPmsRecords: PmsStayRecord[] = [
      {
        pmsRecordId: 'PMS-1001',
        guestEmail: 'sarah.smith@example.com',
        hotelId: 'hotel_12',
        checkIn: '2026-03-01T14:00:00Z',
        checkOut: '2026-03-04T10:00:00Z',
        accommodationSpend: 300, // £300 eligible
        foodAndBeverageSpend: 100, // £100 eligible
        otherSpend: 50, // £50 parking/spa - ineligible
        source: 'iLoyalty',
      },
    ]

    const result = await runPmsSync('hotel_12', async () => mockPmsRecords)

    expect(result.status).toBe('SUCCESS')
    expect(result.recordsProcessed).toBe(1)
    expect(result.recordsUpserted).toBe(1)
    // 2% of (£300 + £100) = £400 * 0.02 = 8 points
    expect(result.pointsCreated).toBe(8)

    // @ts-expect-error test helper
    const ptxList = prisma._getPointsTx()
    expect(ptxList).toHaveLength(1)
    expect(ptxList[0].amount).toBe(8)
    expect(ptxList[0].type).toBe('earned')
    expect(ptxList[0].guestId).toBe('guest_sarah')

    // Verify 365 days expiry
    const now = new Date()
    const diffDays = Math.round((ptxList[0].expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBeGreaterThanOrEqual(364)
    expect(diffDays).toBeLessThanOrEqual(366)
  })

  it('awards ZERO points if stay source is not iLoyalty (e.g. Booking.com / phone)', async () => {
    const mockPmsRecords: PmsStayRecord[] = [
      {
        pmsRecordId: 'PMS-1002',
        guestEmail: 'sarah.smith@example.com',
        hotelId: 'hotel_12',
        checkIn: '2026-03-10T14:00:00Z',
        checkOut: '2026-03-12T10:00:00Z',
        accommodationSpend: 500,
        foodAndBeverageSpend: 200,
        otherSpend: 0,
        source: 'Booking.com', // Third-party channel
      },
    ]

    const result = await runPmsSync('hotel_12', async () => mockPmsRecords)

    expect(result.status).toBe('SUCCESS')
    expect(result.recordsProcessed).toBe(1)
    expect(result.recordsUpserted).toBe(1)
    expect(result.pointsCreated).toBe(0) // No points for external channels

    // @ts-expect-error test helper
    const ptxList = prisma._getPointsTx()
    expect(ptxList).toHaveLength(0)
  })

  it('prevents duplicate points creation when same PMS stay is ingested multiple times', async () => {
    const mockPmsRecords: PmsStayRecord[] = [
      {
        pmsRecordId: 'PMS-1003',
        guestEmail: 'sarah.smith@example.com',
        hotelId: 'hotel_37',
        checkIn: '2026-06-01T14:00:00Z',
        checkOut: '2026-06-03T10:00:00Z',
        accommodationSpend: 200,
        foodAndBeverageSpend: 50,
        otherSpend: 20,
        source: 'iLoyalty',
      },
    ]

    // First sync run
    const result1 = await runPmsSync('hotel_37', async () => mockPmsRecords)
    expect(result1.pointsCreated).toBe(5) // 2% of £250 = 5 points

    // Repeated sync run with identical pmsRecordId
    const result2 = await runPmsSync('hotel_37', async () => mockPmsRecords)
    expect(result2.pointsCreated).toBe(0) // No duplicate points awarded

    // @ts-expect-error test helper
    const ptxList = prisma._getPointsTx()
    expect(ptxList).toHaveLength(1) // Still exactly 1 points transaction
  })

  it('logs sync run outcome to SyncLog on both success and failure', async () => {
    // 1. Successful run logging
    await runPmsSync('hotel_12', async () => [])
    // @ts-expect-error test helper
    let logs = prisma._getSyncLogs()
    expect(logs[0].status).toBe('SUCCESS')
    expect(logs[0].hotelId).toBe('hotel_12')

    // 2. Failed run logging (e.g. network/PMS error)
    await runPmsSync('hotel_37', async () => {
      throw new Error('PMS API gateway timeout (504)')
    })
    // @ts-expect-error test helper
    logs = prisma._getSyncLogs()
    const failedLog = logs.find((l: any) => l.hotelId === 'hotel_37')
    expect(failedLog).toBeDefined()
    expect(failedLog.status).toBe('FAILED')
    expect(failedLog.errorMessage).toContain('gateway timeout')
  })
})
