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

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sign-up failed')
        setLoading(false)
        return
      }

      // Store active guest session in localStorage for demo/client flows
      if (data.data?.id) {
        localStorage.setItem('iloyalty_guest_id', data.data.id)
        localStorage.setItem('iloyalty_guest_email', data.data.email)
      }

      setSuccessNotice(data.notice)
      setTimeout(() => {
        router.push('/guest/balance')
      }, 2500)
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '2rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="badge badge-gold">Pilot Program</span>
          </div>
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

            {/* Plain disclosure required by PRD Section 5, 11, and 13 Risk 5 */}
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
