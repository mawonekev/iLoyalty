/**
 * Guest service — all operations involving guest records.
 *
 * HARD RULE (PRD Section 9, Section 13 Risk 2):
 * Guest records are ONLY fetched by exact guest ID.
 * No similarity search, fuzzy match, or email/phone lookup is performed
 * in any function that returns guest financial data (balance, stays, bookings).
 *
 * The only exceptions are:
 *  - getGuestByEmail: used exclusively during sign-in to find the guest by
 *    their own credential — this is authentication, not a cross-guest query.
 *  - createGuest: validation check that no other guest shares the same email/phone.
 *
 * Any future function added here that queries by anything other than exact ID
 * must be reviewed and flagged before merging.
 */

import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

// ─── Validation schemas ───────────────────────────────────────────────────────

export const SignUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-().]{7,20}$/, 'Must be a valid phone number')
    .optional()
    .or(z.literal('')),
})

export type SignUpInput = z.infer<typeof SignUpSchema>

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new guest account.
 * Enforces unique email and optional unique phone at the application layer
 * (the DB unique constraints are the final guarantee).
 */
export async function createGuest(input: SignUpInput) {
  const parsed = SignUpSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0].message }
  }

  const { email, phone } = parsed.data
  const normalizedPhone = phone && phone !== '' ? phone : null

  // Check for existing email before attempting insert
  const existingEmail = await prisma.guest.findUnique({ where: { email } })
  if (existingEmail) {
    return { success: false as const, error: 'An account with this email already exists.' }
  }

  // Check for existing phone if provided
  if (normalizedPhone) {
    const existingPhone = await prisma.guest.findUnique({ where: { phone: normalizedPhone } })
    if (existingPhone) {
      return { success: false as const, error: 'An account with this phone number already exists.' }
    }
  }

  const guest = await prisma.guest.create({
    data: {
      email,
      phone: normalizedPhone,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  })

  return { success: true as const, data: guest }
}

/**
 * Fetch a guest by EXACT ID only.
 * Returns null if no guest exists with that ID.
 * Used by all authenticated routes after the guest has been identified via session.
 *
 * NOTE: This function intentionally does not accept email, phone, or any
 * other identifier. See module-level comment for rationale.
 */
export async function getGuestById(guestId: string) {
  return prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  })
}

/**
 * Look up a guest by email — ONLY for authentication purposes.
 * Must never be used to answer a query about a guest's financial data.
 */
export async function getGuestByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return prisma.guest.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  })
}
