'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (emailToUse: string) => {
    const res = await fetch(`/api/guest/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToUse }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Account not found.')
    if (data.data?.id) {
      localStorage.setItem('iloyalty_guest_id', data.data.id)
      localStorage.setItem('iloyalty_guest_email', data.data.email)
    }
    router.push('/guest/balance')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    setError(null)
    setDemoLoading(true)
    try {
      await signIn('demo@iloyalty.test')
    } catch {
      setError('Demo account not found. Please run the seed script first: npm run db:seed')
      setDemoLoading(false)
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

          <button type="submit" className="btn-primary" disabled={loading || demoLoading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Checking Account...' : 'Continue to My Account'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          <button
            type="button"
            onClick={handleDemo}
            disabled={loading || demoLoading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {demoLoading ? 'Loading...' : '✦ Try Demo Account'}
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
