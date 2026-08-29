export const dynamic = 'force-dynamic'
/**
 * GET /api/discovery/search?q=somewhere+near+Leeds+with+parking
 *
 * Semantic search over active hotel and room descriptions.
 *
 * PRD Section 6.4 requirements:
 *  - Searches by meaning (vector similarity over shared hotel/room descriptions)
 *  - If semantic search returns no confident match, falls back to a plain
 *    browsable list of ALL active pilot hotels — never an empty screen
 *  - Private guest data is never involved in this query
 *
 * PRD Section 7: AI adds value here (meaning-based discovery).
 * AI is NOT used for balance, stays, redemption, or payment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { semanticSearch, SearchResult } from '@/lib/vector/vector.service'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'q (search query) is required' },
      { status: 400 }
    )
  }

  let semanticResults: SearchResult[] = []
  let usedFallback = false

  try {
    semanticResults = await semanticSearch(query)
  } catch (err) {
    // If embedding generation fails (e.g. no OpenAI key in dev), fall back to list
    console.error('Semantic search failed, falling back to list:', err)
    semanticResults = []
  }

  if (semanticResults.length === 0) {
    // PRD Section 6.4: never leave the guest with an empty screen
    usedFallback = true
    const allHotels = await prisma.hotel.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        rooms: {
          where: { active: true },
          select: { id: true, description: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      query,
      usedFallback,
      data: allHotels.map((hotel) => ({
        type: 'hotel',
        id: hotel.id,
        name: hotel.name,
        score: null, // no score for fallback results
        rooms: hotel.rooms.map((room) => ({
          roomId: room.id,
          description: room.description,
        })),
      })),
    })
  }

  // Enrich semantic results with hotel/room names
  const hotelIds = [
    ...new Set(
      semanticResults
        .map((r) => (r.type === 'hotel' ? r.id : r.hotelId))
        .filter(Boolean) as string[]
    ),
  ]

  const hotels = await prisma.hotel.findMany({
    where: { id: { in: hotelIds }, active: true },
    select: {
      id: true,
      name: true,
      rooms: {
        where: { active: true },
        select: { id: true, description: true },
      },
    },
  })

  const hotelMap = new Map(hotels.map((h) => [h.id, h]))

  return NextResponse.json({
    success: true,
    query,
    usedFallback,
    data: semanticResults.map((result) => {
      if (result.type === 'hotel') {
        const hotel = hotelMap.get(result.id)
        return {
          type: 'hotel',
          id: result.id,
          name: hotel?.name ?? result.id,
          score: result.score,
          rooms: hotel?.rooms.map((r) => ({ roomId: r.id, description: r.description })) ?? [],
        }
      } else {
        const hotel = result.hotelId ? hotelMap.get(result.hotelId) : undefined
        const room = hotel?.rooms.find((r) => r.id === result.id)
        return {
          type: 'room',
          id: result.id,
          hotelId: result.hotelId,
          hotelName: hotel?.name,
          description: room?.description,
          score: result.score,
        }
      }
    }),
  })
}
