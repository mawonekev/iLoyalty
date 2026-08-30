'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { GuestNav } from '@/components/GuestNav'

function BookingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hotelId = searchParams.get('hotelId')
  const roomId = searchParams.get('roomId')

  const [guestId, setGuestId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [method, setMethod] = useState<'card' | 'points' | 'mixed'>('card')
  const [loading, setLoading] = useState(false)
  const [bookingStatus, setBookingStatus] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem('iloyalty_guest_id')
    if (!storedId) {
      router.push('/signin')
      return
    }
    setGuestId(storedId)

    // Fetch guest balance
    fetch(`/api/guest/balance?guestId=${storedId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setBalance(d.data.available)
      })
      .catch(console.error)
  }, [router])

  const handlePay = async () => {
    if (!guestId || !hotelId) return
    setErrorMsg(null)
    setLoading(true)
    setBookingStatus('Creating booking...')

    try {
      // 1. Create PENDING booking
      const bookRes = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, hotelId }),
      })
      const bookData = await bookRes.json()
      if (!bookRes.ok) {
        throw new Error(bookData.error || 'Failed to create booking')
      }

      const bookingId = bookData.data.id
      setBookingStatus('Processing payment with provider...')

      // 2. Generate client-side UUID idempotency key at the moment of payment tap (PRD Section 5a)
      const idempotencyKey = uuidv4()

      // 3. Initiate payment charge
      const chargeRes = await fetch('/api/payments/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          bookingId,
          amount: 12000, // £120.00 standard room rate (in pence)
          method,
          idempotencyKey,
        }),
      })

      const chargeData = await chargeRes.json()
      if (!chargeRes.ok) {
        throw new Error(chargeData.error || 'Payment failed')
      }

      // Status is PENDING for card/mixed (waiting for provider confirmation) or CONFIRMED for points-only
      if (chargeData.data?.status === 'CONFIRMED') {
        setBookingStatus('CONFIRMED')
      } else {
        setBookingStatus('PENDING_PROVIDER_CONFIRMATION')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed')
      setBookingStatus(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              textDecoration: 'none',
              padding: '0.3rem 0.6rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
            }}
          >
            ← Home
          </Link>
          <span className="badge badge-gold">In-App Reservation</span>
        </div>

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem' }}>Complete Booking</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Payment is routed directly to the hotel&apos;s own merchant account.
          </p>
        </header>


        {errorMsg && (
          <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
            ✕ {errorMsg}
          </div>
        )}

        {/* Confirmation Status Card */}
        {bookingStatus === 'CONFIRMED' && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem', marginBottom: '1.5rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <div className="badge badge-emerald" style={{ marginBottom: '0.75rem' }}>Confirmed</div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Reservation Confirmed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Your stay has been confirmed with the hotel. Eligible accommodation and F&amp;B charges will accrue points after checkout.
            </p>
            <Link href="/guest/balance" className="btn-primary" style={{ textDecoration: 'none' }}>
              Return to Balance
            </Link>
          </div>
        )}

        {bookingStatus === 'PENDING_PROVIDER_CONFIRMATION' && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
            <div className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>Payment Pending Provider</div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Awaiting Provider Confirmation</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Your payment is being verified by the card network. Under PRD rules, your booking will be confirmed immediately once the provider confirmation webhook arrives.
            </p>
            <Link href="/guest/balance" className="btn-secondary" style={{ textDecoration: 'none' }}>
              View Account
            </Link>
          </div>
        )}

        {!bookingStatus && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Booking Summary */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Stay Details</h3>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Property ID:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{hotelId || 'Pilot Hotel'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nightly Rate:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>£120.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>£120.00</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector (PRD Section 6.5) */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Payment Method</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="method"
                    value="card"
                    checked={method === 'card'}
                    onChange={() => setMethod('card')}
                  />
                  <div>
                    <strong style={{ fontSize: '0.875rem', display: 'block' }}>Credit / Debit Card</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Routed to hotel merchant account</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="method"
                    value="points"
                    checked={method === 'points'}
                    onChange={() => setMethod('points')}
                  />
                  <div>
                    <strong style={{ fontSize: '0.875rem', display: 'block' }}>Points ({balance} available)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pay with group loyalty balance</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Tap to Pay Button */}
            <button
              className="btn-primary"
              disabled={loading}
              onClick={handlePay}
            >
              {loading ? 'Processing...' : `Pay £120.00 (${method.toUpperCase()})`}
            </button>
          </div>
        )}
      </div>
      <GuestNav />
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="app-container"><div style={{ padding: '2rem' }}>Loading reservation...</div></div>}>
      <BookingForm />
    </Suspense>
  )
}
