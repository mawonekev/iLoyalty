'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function GuestNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/guest/balance', label: 'Balance', icon: '✦' },
    { href: '/guest/stays', label: 'My Stays', icon: '🏨' },
    { href: '/guest/discover', label: 'Discover', icon: '🔍' },
    { href: '/guest/redeem', label: 'Rewards', icon: '🎁' },
  ]

  return (
    <nav style={{
      position: 'sticky',
      bottom: 0,
      background: 'var(--bg-surface-elevated)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.75rem 0.5rem',
      zIndex: 50,
    }}>
      {navItems.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              color: active ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: active ? 600 : 500,
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
