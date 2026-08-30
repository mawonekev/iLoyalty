'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function StaffLoginPage() {
  const router = useRouter()

  const handleStaffDemo = () => {
    router.push('/staff/stays/manual')
  }

  return (
    <div className="app-container">
      <div style={{ padding: '2.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="badge badge-blue" style={{ marginBottom: '0.75rem' }}>Staff Operations</span>
          <h1 style={{ fontSize: '1.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Staff Portal Sign-In</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Front desk and operations access for manual stay submissions, merge drafts, and operational logs.
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleStaffDemo}
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Enter Staff Portal (Demo / Direct Access)
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
