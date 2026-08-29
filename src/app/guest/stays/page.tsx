'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GuestNav } from '@/components/GuestNav'

interface StayItem {
  stayId: string
  hotelId: string
  hotelName: string
  checkIn: string
  checkOut: string
  accommodationSpend: string
  foodAndBeverageSpend: string
  source: string
  pointsEarned: number
  manualEntry: boolean
}

export default function StaysPage() {
  const router = useRouter()
  const [stays, setStays] = useState<StayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem('iloyalty_guest_id')
    if (!storedId) {
      router.push('/signin')
      return
    }

    async function fetchStays() {
      try {
        const res = await fetch(`/api/guest/stays?guestId=${storedId}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Failed to load stay history.')
        } else {
          setStays(json.data || [])
        }
      } catch {
        setError('Network error loading stay history.')
      } finally {
        setLoading(false)
      }
    }

    fetchStays()
  }, [router])

  return (
    <div className="app-container">
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <span className="badge badge-gold" style={{ marginBottom: '0.25rem' }}>Pilot Hotel Group</span>
          <h1 style={{ fontSize: '1.5rem' }}>Stay History</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Verified stays and points earned across group properties.
          </p>
        </header>

        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading verified stay records...</p>
          </div>
        )}

        {error && (
          <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {!loading && stays.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏨</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Stays Recorded Yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Stays booked directly inside iLoyalty will appear here after checkout, with points credited to your balance.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stays.map((stay) => {
            const checkInDate = new Date(stay.checkIn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            const checkOutDate = new Date(stay.checkOut).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div key={stay.stayId} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{stay.hotelName}</h3>
                  {stay.pointsEarned > 0 ? (
                    <span className="badge badge-gold">+{stay.pointsEarned} pts</span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>0 pts</span>
                  )}
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {checkInDate} – {checkOutDate}
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-muted)',
                }}>
                  <span>Accom: £{stay.accommodationSpend} | F&amp;B: £{stay.foodAndBeverageSpend}</span>
                  <span style={{ textTransform: 'capitalize' }}>Via {stay.source}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <GuestNav />
    </div>
  )
}
