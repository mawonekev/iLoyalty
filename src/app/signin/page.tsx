'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // In Stage 2, signin checks the email exists to set the guest session
      const res = await fetch(`/api/guest/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Account not found with this email.')
        setLoading(false)
        return
      }

      if (data.data?.id) {
        localStorage.setItem('iloyalty_guest_id', data.data.id)
        localStorage.setItem('iloyalty_guest_email', data.data.email)
        router.push('/guest/balance')
      }
    } catch {
      setError('An unexpected error occurred.')
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Sign In</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Access your iLoyalty points and stay history.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <div className="alert-error">{error}</div>}

          <div>
            <label className="label" htmlFor="email">Your Registered Email</label>
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

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Checking Account...' : 'Continue to My Account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ fontWeight: 600 }}>Join iLoyalty</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
