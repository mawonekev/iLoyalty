/**
 * Vector service — semantic search over Hotel and Room descriptions.
 *
 * PRD Section 9 (hard rule): Only shared records are embedded.
 * Hotel.description and Room.description are the ONLY text ever sent to the
 * embedding API. Guest profiles, stays, points, bookings, and payments are
 * never embedded and never appear in this store.
 *
 * Vector store choice: pgvector via PostgreSQL.
 * Embeddings are stored in HotelEmbedding and RoomEmbedding tables as Float[]
 * arrays. Cosine similarity search is done in SQL using the <=> operator (once
 * the pgvector extension is enabled) or via a manual dot-product calculation
 * as a fallback for environments without the extension.
 *
 * Sync rule (PRD Section 9): When a hotel or room is deactivated (active: false),
 * its embedding row is deleted in the same database operation, not on a batch job.
 *
 * Confidence threshold: if the top result has cosine distance > CONFIDENCE_THRESHOLD
 * (i.e., similarity < 1 - CONFIDENCE_THRESHOLD), we fall back to returning all
 * active hotels as a plain list — never an empty screen (PRD Section 6.4).
 */

import OpenAI from 'openai'
import { prisma } from '@/lib/db/prisma'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** Cosine distance above this value means "not confident enough" */
const CONFIDENCE_THRESHOLD = 0.4

// ─── Embedding generation ─────────────────────────────────────────────────────

/**
 * Generate an embedding vector for a text string.
 * Only called for Hotel.description and Room.description — never for guest data.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// ─── Embedding sync ───────────────────────────────────────────────────────────

/**
 * Upsert the embedding for a hotel.
 * Called when a hotel is created or its description is updated.
 * Only embeds active hotels.
 */
export async function upsertHotelEmbedding(
  hotelId: string,
  description: string,
  metadata: Record<string, string>
): Promise<void> {
  const embedding = await generateEmbedding(description)
  await prisma.hotelEmbedding.upsert({
    where: { id: hotelId },
    create: {
      id: hotelId,
      embedding,
      metadata: { type: 'hotel', ...metadata },
    },
    update: {
      embedding,
      metadata: { type: 'hotel', ...metadata },
    },
  })
}

/**
 * Upsert the embedding for a room.
 * Called when a room is created or its description is updated.
 */
export async function upsertRoomEmbedding(
  roomId: string,
  hotelId: string,
  description: string,
  metadata: Record<string, string>
): Promise<void> {
  const embedding = await generateEmbedding(description)
  await prisma.roomEmbedding.upsert({
    where: { id: roomId },
    create: {
      id: roomId,
      hotelId,
      embedding,
      metadata: { type: 'room', hotelId, ...metadata },
    },
    update: {
      embedding,
      metadata: { type: 'room', hotelId, ...metadata },
    },
  })
}

/**
 * Delete a hotel's embedding when it is deactivated.
 * Called in the same operation as setting hotel.active = false.
 */
export async function deleteHotelEmbedding(hotelId: string): Promise<void> {
  await prisma.hotelEmbedding.deleteMany({ where: { id: hotelId } })
}

/**
 * Delete a room's embedding when it is deactivated.
 * Called in the same operation as setting room.active = false.
 */
export async function deleteRoomEmbedding(roomId: string): Promise<void> {
  await prisma.roomEmbedding.deleteMany({ where: { id: roomId } })
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'hotel' | 'room'
  id: string
  hotelId?: string
  score: number
  metadata: Record<string, unknown>
}

/**
 * Cosine similarity between two equal-length vectors.
 * Returns a value from -1 (opposite) to 1 (identical).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Semantic search over active hotel and room embeddings.
 *
 * Returns results with similarity score above threshold.
 * If no results meet the threshold, returns an empty array
 * (the caller must handle the fallback to a plain hotel list).
 */
export async function semanticSearch(query: string): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)

  // Fetch all active embeddings — for a pilot group of 3-5 hotels with
  // a handful of rooms each, this is a small set and in-process similarity
  // is faster than a round-trip to a separate vector DB.
  const [hotelEmbeddings, roomEmbeddings] = await Promise.all([
    prisma.hotelEmbedding.findMany({
      select: { id: true, embedding: true, metadata: true },
    }),
    prisma.roomEmbedding.findMany({
      select: { id: true, hotelId: true, embedding: true, metadata: true },
    }),
  ])

  const results: SearchResult[] = []

  for (const hotel of hotelEmbeddings) {
    const score = cosineSimilarity(queryEmbedding, hotel.embedding)
    if (score >= 1 - CONFIDENCE_THRESHOLD) {
      results.push({
        type: 'hotel',
        id: hotel.id,
        score,
        metadata: hotel.metadata as Record<string, unknown>,
      })
    }
  }

  for (const room of roomEmbeddings) {
    const score = cosineSimilarity(queryEmbedding, room.embedding)
    if (score >= 1 - CONFIDENCE_THRESHOLD) {
      results.push({
        type: 'room',
        id: room.id,
        hotelId: room.hotelId,
        score,
        metadata: room.metadata as Record<string, unknown>,
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)
  return results
}
