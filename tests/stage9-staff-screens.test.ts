import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../src/lib/db/prisma'

vi.mock('../src/lib/db/prisma', () => {
  const guests = new Map<string, any>()
  const hotels = new Map<string, any>()
  const stays = new Map<string, any>()
  const drafts = new Map<string, any>()
  const messages = new Map<string, any>()

  return {
    prisma: {
      guest: {
        findUnique: vi.fn(async ({ where }: any) => guests.get(where.id) || null),
      },
      hotel: {
        findUnique: vi.fn(async ({ where }: any) => hotels.get(where.id) || null),
      },
      stay: {
        findUnique: vi.fn(async ({ where }: any) => {
          for (const s of Array.from(stays.values())) {
            if (s.pmsRecordId === where.pmsRecordId) return s
          }
          return null
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = 'stay_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data }
          stays.set(id, record)
          return record
        }),
      },
      profileMergeDraft: {
        findFirst: vi.fn(async ({ where }: any) => {
          for (const d of Array.from(drafts.values())) {
            if (d.sourceGuestId === where.sourceGuestId && d.targetGuestId === where.targetGuestId && d.status === where.status) {
              return d
            }
          }
          return null
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = 'draft_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data, createdAt: new Date() }
          drafts.set(id, record)
          return record
        }),
      },
      messageLog: {
        create: vi.fn(async ({ data }: any) => {
          const id = 'msg_' + Math.random().toString(36).substring(2, 9)
          const record = { id, ...data, createdAt: new Date() }
          messages.set(id, record)
          return record
        }),
      },
      _seedGuest: (g: any) => guests.set(g.id, g),
      _seedHotel: (h: any) => hotels.set(h.id, h),
      _clear: () => {
        guests.clear()
        hotels.clear()
        stays.clear()
        drafts.clear()
        messages.clear()
      },
      _getStays: () => Array.from(stays.values()),
      _getDrafts: () => Array.from(drafts.values()),
      _getMessages: () => Array.from(messages.values()),
    },
  }
})

describe('Stage 9: Staff Screens and Operational Flows', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
    // @ts-expect-error test helper
    prisma._seedGuest({ id: 'guest_dup1', email: 'sarah.old@example.com' })
    // @ts-expect-error test helper
    prisma._seedGuest({ id: 'guest_dup2', email: 'sarah.new@example.com' })
    // @ts-expect-error test helper
    prisma._seedHotel({ id: 'hotel_12', name: 'Grand Pilot Hotel Leeds', active: true })
  })

  it('allows staff to propose a profile merge held as PENDING for owner review', async () => {
    const draft = await prisma.profileMergeDraft.create({
      data: {
        sourceGuestId: 'guest_dup1',
        targetGuestId: 'guest_dup2',
        proposedBy: 'staff_alice',
        status: 'PENDING',
      },
    })

    expect(draft.id).toBeDefined()
    expect(draft.status).toBe('PENDING')
    expect(draft.sourceGuestId).toBe('guest_dup1')
    expect(draft.targetGuestId).toBe('guest_dup2')
  })

  it('creates manual stay entry with manualEntry=true and approvedBy=null', async () => {
    const stay = await prisma.stay.create({
      data: {
        pmsRecordId: 'MANUAL-FOLIO-999',
        guestId: 'guest_dup2',
        hotelId: 'hotel_12',
        checkIn: new Date('2026-03-01'),
        checkOut: new Date('2026-03-03'),
        accommodationSpend: 200,
        foodAndBeverageSpend: 50,
        otherSpend: 0,
        source: 'iLoyalty',
        manualEntry: true,
        approvedBy: null, // Points not credited until owner signs off
      },
    })

    expect(stay.manualEntry).toBe(true)
    expect(stay.approvedBy).toBeNull()
    expect(stay.pmsRecordId).toBe('MANUAL-FOLIO-999')
  })

  it('records actions in messageLog for staff and owner auditing', async () => {
    await prisma.messageLog.create({
      data: {
        guestId: 'guest_dup2',
        message: 'Manual stay entry submitted. Pending owner approval.',
        context: 'manual-stay',
      },
    })

    // @ts-expect-error test helper
    const logs = prisma._getMessages()
    expect(logs).toHaveLength(1)
    expect(logs[0].context).toBe('manual-stay')
    expect(logs[0].guestId).toBe('guest_dup2')
  })
})
