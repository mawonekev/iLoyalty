'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function StaffNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/staff/stays/manual', label: 'Manual Stay Entry' },
    { href: '/staff/merges', label: 'Profile Merges' },
    { href: '/staff/messages', label: 'Message Log' },
  ]

  return (
    <header style={{
      background: 'var(--bg-surface-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '1rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, padding: '0.2rem 0.5rem', background: 'var(--bg-primary)', borderRadius: '4px' }}>← Home</Link>
        <span className="badge badge-blue">Staff Portal</span>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>iLoyalty Operations</span>
      </div>

      <nav style={{ display: 'flex', gap: '1rem' }}>
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
