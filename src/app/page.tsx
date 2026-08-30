'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [demoLoading, setDemoLoading] = useState(false)

  const handleGuestDemo = async () => {
    setDemoLoading(true)
    try {
      const res = await fetch('/api/guest/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@iloyalty.test' }),
      })
      const data = await res.json()
      if (res.ok && data.data?.id) {
        localStorage.setItem('iloyalty_guest_id', data.data.id)
        localStorage.setItem('iloyalty_guest_email', data.data.email)
        router.push('/guest/balance')
      } else {
        // If demo user doesn't exist yet, try to auto-create
        const signupRes = await fetch('/api/guest/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'demo@iloyalty.test', phone: '+44 7700 900077' }),
        })
        const signupData = await signupRes.json()
        if (signupData.data?.id) {
          localStorage.setItem('iloyalty_guest_id', signupData.data.id)
          localStorage.setItem('iloyalty_guest_email', signupData.data.email)
          router.push('/guest/balance')
        } else {
          router.push('/signin')
        }
      }
    } catch {
      router.push('/signin')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '2.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span className="badge badge-gold">Pilot Group Access</span>
          </div>

          <h1 style={{ fontSize: '2.25rem', lineHeight: 1.15, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            One loyalty account across our group.
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            Earn verified reward points across all pilot hotels. Simple, direct rewards with no hidden tiers.
          </p>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
              ✦ Pilot Hotel Group
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Valid across 3 to 5 pilot properties sharing our central PMS system.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none' }}>
            Join iLoyalty
          </Link>
          <Link href="/signin" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Sign In to Existing Account
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Testing & Demo</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          <button
            onClick={handleGuestDemo}
            disabled={demoLoading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              borderColor: 'var(--accent-gold)',
              color: 'var(--accent-gold)'
            }}
          >
            {demoLoading ? 'Accessing Demo...' : '✦ Instant Guest Demo'}
          </button>
        </div>
      </div>
    </div>
  )
}

