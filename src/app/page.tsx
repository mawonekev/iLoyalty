'use client'

import React from 'react'
import Link from 'next/link'

export default function HomePage() {
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

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <Link href="/staff/stays/manual" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Staff Portal</Link>
            <Link href="/owner/reporting" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Owner Portal</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
