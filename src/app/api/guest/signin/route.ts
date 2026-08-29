export const dynamic = 'force-dynamic'
/**
 * POST /api/guest/signin
 *
 * Authentication endpoint: matches guest by their own email to establish session.
 * PRD Section 9: This is strictly authentication, not a query on financial records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGuestByEmail } from '@/lib/guest/guest.service'

export async function POST(request: NextRequest) {
  let body: { email?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
  }

  const guest = await getGuestByEmail(body.email)
  if (!guest) {
    return NextResponse.json(
      { success: false, error: 'No iLoyalty account found for this email. Please sign up first.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      id: guest.id,
      email: guest.email,
      phone: guest.phone,
    },
  })
}
