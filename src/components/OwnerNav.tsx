'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function OwnerNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/owner/reporting', label: 'Usage & Points' },
    { href: '/owner/sync-health', label: 'PMS Sync Health' },
    { href: '/owner/rules', label: 'Redemption Rules' },
    { href: '/owner/approvals', label: 'Pending Approvals' },
    { href: '/owner/messages', label: 'Group Message Log' },
  ]

  return (
    <header style={{
      background: 'var(--bg-surface-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/owner/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Portal</Link>
        <span className="badge badge-gold">Owner Portal</span>
        <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          iLoyalty Group Intelligence
        </span>
      </div>

      <nav style={{ display: 'flex', gap: '1.25rem' }}>
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
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
