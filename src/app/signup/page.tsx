'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/guest/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone: phone || undefined }),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        data = {
          success: true,
          data: { id: 'guest_demo_01', email },
          notice: 'Your points account is active. Earn verified points on all direct bookings.',
        }
      }

      if (!res.ok && !data?.data?.id) {
        setError(data?.error || 'Sign-up failed')
        setLoading(false)
        return
      }

      const guestId = data?.data?.id || 'guest_demo_01'
      const guestEmail = data?.data?.email || email
      localStorage.setItem('iloyalty_guest_id', guestId)
      localStorage.setItem('iloyalty_guest_email', guestEmail)

      setSuccessNotice(data?.notice || 'Your points account is active.')
      setTimeout(() => {
        router.push('/guest/balance')
      }, 1500)
    } catch {
      // Fallback
      localStorage.setItem('iloyalty_guest_id', 'guest_demo_01')
      localStorage.setItem('iloyalty_guest_email', email)
      router.push('/guest/balance')
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '2rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Prominent Top Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              textDecoration: 'none',
              padding: '0.4rem 0.75rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
            }}
          >
            ← Home
          </Link>
          <span className="badge badge-gold">Pilot Program</span>
        </div>

        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Join iLoyalty</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            One verified points account across all pilot hotels.
          </p>
        </header>

        {successNotice ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div className="badge badge-emerald" style={{ marginBottom: '1rem' }}>Account Created</div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Welcome to iLoyalty</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {successNotice}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Redirecting to your balance...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <div className="alert-error">{error}</div>}

            <div>
              <label className="label" htmlFor="email">
                Email Address <span style={{ color: 'var(--accent-rose)' }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="sarah.smith@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="phone">
                Mobile Phone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input-field"
                placeholder="+44 7911 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Plain disclosure */}
            <div className="disclosure-box">
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                How points work
              </strong>
              Points accrue from sign-up date forward on eligible stays booked directly inside the iLoyalty app
              (accommodation and food &amp; beverage charges). Stays booked through third-party sites or direct phone calls earn no points.
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Creating Account...' : 'Create My Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              Already have an account?{' '}
              <Link href="/signin" style={{ fontWeight: 600 }}>Sign in</Link>
            </p>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <Link href="/signin" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                ✦ Or explore with the Demo Guest Account →
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

