/**
 * Shared application types for iLoyalty v1.
 * These mirror the Prisma schema enums and add API response shapes.
 */

// ─── Prisma Enum Mirrors ─────────────────────────────────────────────────────

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED'
export type SyncLogStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'
export type MergeDraftStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type PointsTransactionType = 'earned' | 'redeemed'
export type PaymentMethod = 'points' | 'card' | 'mixed'

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

/** Points balance response — includes expiry warnings per PRD Section 6.1 */
export interface PointsBalanceResponse {
  guestId: string
  totalPoints: number
  /** Points expiring within 30 days, may be 0 */
  expiringWithin30Days: number
  /** Date of the earliest upcoming expiry, null if no expiry within 30 days */
  nearestExpiryDate: string | null
  lastUpdatedAt: string
}

/** A single stay in the guest's stay history */
export interface StayHistoryItem {
  stayId: string
  hotelName: string
  checkIn: string
  checkOut: string
  pointsEarned: number
  accommodationSpend: number
  foodAndBeverageSpend: number
  source: string
}

/** A hotel result from semantic or list-based discovery */
export interface HotelDiscoveryResult {
  hotelId: string
  name: string
  description?: string
  rooms: RoomDiscoveryResult[]
  /** Similarity score from vector search; absent for list fallback results */
  score?: number
}

export interface RoomDiscoveryResult {
  roomId: string
  hotelId: string
  description: string
  score?: number
}
