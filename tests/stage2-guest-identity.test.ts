import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SignUpSchema, createGuest, getGuestById } from '../src/lib/guest/guest.service'
import { prisma } from '../src/lib/db/prisma'

// Mock prisma for isolated unit verification of Stage 2 rules
vi.mock('../src/lib/db/prisma', () => {
  const store = new Map<string, { id: string; email: string; phone: string | null; createdAt: Date }>()

  return {
    prisma: {
      guest: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string; phone?: string } }) => {
          if (where.id) {
            return store.get(where.id) || null
          }
          if (where.email) {
            for (const guest of Array.from(store.values())) {
              if (guest.email === where.email) return guest
            }
            return null
          }
          if (where.phone) {
            for (const guest of Array.from(store.values())) {
              if (guest.phone === where.phone) return guest
            }
            return null
          }
          return null
        }),
        create: vi.fn(async ({ data }: { data: { email: string; phone: string | null } }) => {
          const id = 'guest_' + Math.random().toString(36).substring(2, 9)
          const record = {
            id,
            email: data.email,
            phone: data.phone,
            createdAt: new Date(),
          }
          store.set(id, record)
          return record
        }),
        _clear: () => store.clear(),
      },
    },
  }
})

describe('Stage 2: Guest Identity Verification', () => {
  beforeEach(() => {
    // @ts-expect-error test helper
    prisma.guest._clear()
  })

  it('validates email format and optional phone format in SignUpSchema', () => {
    const valid = SignUpSchema.safeParse({
      email: 'sarah.smith@example.com',
      phone: '+447911123456',
    })
    expect(valid.success).toBe(true)

    const validNoPhone = SignUpSchema.safeParse({
      email: 'sarah.smith@example.com',
    })
    expect(validNoPhone.success).toBe(true)

    const invalidEmail = SignUpSchema.safeParse({
      email: 'not-an-email',
      phone: '+447911123456',
    })
    expect(invalidEmail.success).toBe(false)

    const invalidPhone = SignUpSchema.safeParse({
      email: 'sarah@example.com',
      phone: 'short',
    })
    expect(invalidPhone.success).toBe(false)
  })

  it('creates guest profile with unique email and optional phone (one profile per identifier)', async () => {
    const result = await createGuest({
      email: 'sarah.smith@example.com',
      phone: '+447911123456',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('sarah.smith@example.com')
      expect(result.data.phone).toBe('+447911123456')
      expect(result.data.id).toBeDefined()
    }
  })

  it('rejects duplicate email to enforce one profile per email', async () => {
    await createGuest({
      email: 'sarah.smith@example.com',
      phone: '+447911123456',
    })

    const duplicateResult = await createGuest({
      email: 'sarah.smith@example.com',
      phone: '+447911999999',
    })

    expect(duplicateResult.success).toBe(false)
    if (!duplicateResult.success) {
      expect(duplicateResult.error).toContain('already exists')
    }
  })

  it('rejects duplicate phone to enforce one profile per phone number', async () => {
    await createGuest({
      email: 'first@example.com',
      phone: '+447911123456',
    })

    const duplicatePhoneResult = await createGuest({
      email: 'second@example.com',
      phone: '+447911123456',
    })

    expect(duplicatePhoneResult.success).toBe(false)
    if (!duplicatePhoneResult.success) {
      expect(duplicatePhoneResult.error).toContain('phone number already exists')
    }
  })

  it('fetches guest record by EXACT guest ID only (Section 9 hard rule)', async () => {
    const created = await createGuest({
      email: 'sarah.smith@example.com',
      phone: '+447911123456',
    })

    expect(created.success).toBe(true)
    if (created.success) {
      const guestId = created.data.id

      // Query by exact ID
      const fetched = await getGuestById(guestId)
      expect(fetched).not.toBeNull()
      expect(fetched?.id).toBe(guestId)
      expect(fetched?.email).toBe('sarah.smith@example.com')

      // Query by non-existent ID
      const notFound = await getGuestById('non_existent_id')
      expect(notFound).toBeNull()
    }
  })
})
