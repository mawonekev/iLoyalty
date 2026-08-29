/**
 * PMS Connector — thin adapter over the real PMS API.
 *
 * This is the only file that calls the external PMS. It translates raw PMS
 * responses into the PmsStayRecord shape expected by pms.service.ts.
 *
 * Replace the fetch calls below with the actual PMS API endpoints and
 * authentication when the PMS vendor provides their API spec.
 */

import { PmsStayRecord } from './pms.service'

const PMS_BASE_URL = process.env.PMS_API_BASE_URL ?? ''
const PMS_API_KEY = process.env.PMS_API_KEY ?? ''

interface PmsApiStay {
  record_id: string
  guest_email: string
  hotel_id: string
  check_in_date: string
  check_out_date: string
  accommodation_charge: number
  fnb_charge: number
  other_charge: number
  booking_channel: string
}

/**
 * Fetch completed stays from the PMS for a given hotel.
 * Returns stays that checked out since the last sync (or last 24 hours as default).
 */
export async function fetchPmsRecordsForHotel(hotelId: string): Promise<PmsStayRecord[]> {
  const url = `${PMS_BASE_URL}/hotels/${hotelId}/stays/completed`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${PMS_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `PMS API returned ${response.status} for hotel ${hotelId}: ${await response.text()}`
    )
  }

  const raw: PmsApiStay[] = await response.json()

  // Map from PMS field names to our internal PmsStayRecord shape
  return raw.map((stay): PmsStayRecord => ({
    pmsRecordId: stay.record_id,
    guestEmail: stay.guest_email,
    hotelId: stay.hotel_id,
    checkIn: stay.check_in_date,
    checkOut: stay.check_out_date,
    accommodationSpend: stay.accommodation_charge,
    foodAndBeverageSpend: stay.fnb_charge,
    otherSpend: stay.other_charge,
    // Normalise the booking channel: treat "ILOYALTY", "iloyalty" etc as "iLoyalty"
    source: stay.booking_channel.toLowerCase() === 'iloyalty' ? 'iLoyalty' : stay.booking_channel,
  }))
}
