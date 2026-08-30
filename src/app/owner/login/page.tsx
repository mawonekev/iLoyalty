'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function OwnerLoginPage() {
  const router = useRouter()

  const handleOwnerDemo = () => {
    router.push('/owner/reporting')
  }

  return (
    <div className="app-container">
      <div style={{ padding: '2.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>Group Intelligence</span>
          <h1 style={{ fontSize: '1.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Owner Portal Sign-In</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Executive oversight for pilot reporting, sync health monitoring, redemption rules, and governance.
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleOwnerDemo}
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Enter Owner Portal (Demo / Direct Access)
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ← Return to Guest View
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
