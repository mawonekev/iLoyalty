'use client'

import React, { useState } from 'react'
import { StaffNav } from '@/components/StaffNav'

export default function StaffManualStayPage() {
  const [guestId, setGuestId] = useState('')
  const [hotelId, setHotelId] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [accommodationSpend, setAccommodationSpend] = useState('')
  const [foodAndBeverageSpend, setFoodAndBeverageSpend] = useState('')
  const [otherSpend, setOtherSpend] = useState('0')
  const [enteredBy, setEnteredBy] = useState('frontdesk_staff_1')

  const [loading, setLoading] = useState(false)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessNotice(null)

    try {
      const res = await fetch('/api/staff/stays/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          hotelId,
          referenceId,
          checkIn: new Date(checkIn).toISOString(),
          checkOut: new Date(checkOut).toISOString(),
          accommodationSpend: parseFloat(accommodationSpend),
          foodAndBeverageSpend: parseFloat(foodAndBeverageSpend),
          otherSpend: parseFloat(otherSpend || '0'),
          enteredBy,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to record manual stay entry.')
      } else {
        setSuccessNotice(data.notice || 'Stay recorded and routed for owner approval.')
        // Reset form
        setReferenceId('')
        setAccommodationSpend('')
        setFoodAndBeverageSpend('')
      }
    } catch {
      setErrorMsg('Network error submitting manual stay.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <StaffNav />
      <div className="portal-container">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Manual Stay Entry</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Used mid-shift to recover missing stays from PMS sync interruptions. Manual entries require owner sign-off before points hit the guest account.
            </p>
          </div>

          {successNotice && (
            <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7', marginBottom: '1.5rem' }}>
              ✓ {successNotice}
            </div>
          )}

          {errorMsg && (
            <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
              ✕ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label">Guest Exact ID *</label>
                <input
                  className="input-field"
                  placeholder="e.g. clx123abc"
                  value={guestId}
                  onChange={(e) => setGuestId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Hotel ID *</label>
                <input
                  className="input-field"
                  placeholder="e.g. hotel_12"
                  value={hotelId}
                  onChange={(e) => setHotelId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">PMS Reference / Folio ID *</label>
              <input
                className="input-field"
                placeholder="e.g. FOLIO-2026-9812"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Unique reference used to prevent duplicate manual entries.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label">Check-In Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Check-Out Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label">Accom (£) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="150.00"
                  value={accommodationSpend}
                  onChange={(e) => setAccommodationSpend(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">F&amp;B (£) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="45.00"
                  value={foodAndBeverageSpend}
                  onChange={(e) => setFoodAndBeverageSpend(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Other (£)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={otherSpend}
                  onChange={(e) => setOtherSpend(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Staff Signer ID</label>
              <input
                className="input-field"
                value={enteredBy}
                onChange={(e) => setEnteredBy(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Submitting...' : 'Submit for Owner Approval'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
