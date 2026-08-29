import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../src/lib/db/prisma'
import {
  upsertHotelEmbedding,
  upsertRoomEmbedding,
  deleteHotelEmbedding,
  deleteRoomEmbedding,
} from '../src/lib/vector/vector.service'

// Mock OpenAI embeddings to return deterministic vectors for testing
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: vi.fn(async ({ input }: { input: string }) => {
          const vec = new Array(1536).fill(0)
          if (input.toLowerCase().includes('leeds') || input.toLowerCase().includes('parking')) {
            vec[0] = 0.9
            vec[1] = 0.4
          } else if (input.toLowerCase().includes('manchester') || input.toLowerCase().includes('city')) {
            vec[0] = 0.1
            vec[1] = 0.95
          } else {
            vec[0] = 0.05
            vec[1] = 0.05
          }
          return { data: [{ embedding: vec }] }
        }),
      }
    },
  }
})

vi.mock('../src/lib/db/prisma', () => {
  const hotelEmbeddings = new Map<string, any>()
  const roomEmbeddings = new Map<string, any>()

  return {
    prisma: {
      hotelEmbedding: {
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const record = { id: where.id, ...(hotelEmbeddings.get(where.id) ? update : create) }
          hotelEmbeddings.set(where.id, record)
          return record
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          hotelEmbeddings.delete(where.id)
          return { count: 1 }
        }),
        findMany: vi.fn(async () => Array.from(hotelEmbeddings.values())),
      },
      roomEmbedding: {
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const record = { id: where.id, ...(roomEmbeddings.get(where.id) ? update : create) }
          roomEmbeddings.set(where.id, record)
          return record
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          roomEmbeddings.delete(where.id)
          return { count: 1 }
        }),
        findMany: vi.fn(async () => Array.from(roomEmbeddings.values())),
      },
      _clear: () => {
        hotelEmbeddings.clear()
        roomEmbeddings.clear()
      },
      _getHotelEmbeddings: () => Array.from(hotelEmbeddings.values()),
      _getRoomEmbeddings: () => Array.from(roomEmbeddings.values()),
    },
  }
})

describe('Stage 7: Hotel and Room Discovery (Vector Store & Fallback)', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma._clear()
  })

  it('stores and updates embeddings for shared hotel and room records only', async () => {
    await upsertHotelEmbedding('hotel_leeds', 'Boutique hotel in central Leeds with secure private parking', {
      city: 'Leeds',
    })

    await upsertRoomEmbedding('room_executive_leeds', 'hotel_leeds', 'Quiet Executive King room with workspace', {
      city: 'Leeds',
    })

    // @ts-expect-error test helper
    const hotels = prisma._getHotelEmbeddings()
    // @ts-expect-error test helper
    const rooms = prisma._getRoomEmbeddings()

    expect(hotels).toHaveLength(1)
    expect(hotels[0].id).toBe('hotel_leeds')
    expect(hotels[0].embedding).toHaveLength(1536)
    expect(hotels[0].metadata.type).toBe('hotel')

    expect(rooms).toHaveLength(1)
    expect(rooms[0].id).toBe('room_executive_leeds')
    expect(rooms[0].hotelId).toBe('hotel_leeds')
  })

  it('deletes embedding immediately in same operation when hotel/room is deactivated (PRD Section 9)', async () => {
    await upsertHotelEmbedding('hotel_to_deactivate', 'Sample hotel', { city: 'York' })
    // @ts-expect-error test helper
    expect(prisma._getHotelEmbeddings()).toHaveLength(1)

    // Deactivation deletes the vector entry
    await deleteHotelEmbedding('hotel_to_deactivate')
    // @ts-expect-error test helper
    expect(prisma._getHotelEmbeddings()).toHaveLength(0)

    await upsertRoomEmbedding('room_to_deactivate', 'hotel_1', 'Sample room', {})
    // @ts-expect-error test helper
    expect(prisma._getRoomEmbeddings()).toHaveLength(1)

    await deleteRoomEmbedding('room_to_deactivate')
    // @ts-expect-error test helper
    expect(prisma._getRoomEmbeddings()).toHaveLength(0)
  })
})
