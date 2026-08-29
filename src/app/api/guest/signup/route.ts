export const dynamic = 'force-dynamic'
/**
 * POST /api/guest/signup
 *
 * Creates a new guest account with a unique email and optional unique phone.
 * Returns the created guest record (no financial data included).
 *
 * This is the only entry point for guest account creation.
 * Duplicate email and duplicate phone are rejected with a 409 Conflict.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createGuest, SignUpSchema } from '@/lib/guest/guest.service'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate input
  const parsed = SignUpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const result = await createGuest(parsed.data)

  if (!result.success) {
    // Duplicate email or phone
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data,
      // PRD Section 13 Risk 5: eligibility restriction stated plainly at sign-up
      notice:
        'Points accrue from today forward on stays booked through iLoyalty only ' +
        '(accommodation and food & beverage charges). Stays booked via a travel agent, ' +
        'third-party site, or direct phone call earn no points.',
    },
    { status: 201 }
  )
}
