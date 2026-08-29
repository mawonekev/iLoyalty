'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GuestNav } from '@/components/GuestNav'

interface BalanceData {
  guestId: string
  available: number
  totalEarned: number
  totalRedeemed: number
  expiringWithin30Days: number
  nearestExpiryDate: string | null
  lastUpdatedAt: string
}

export default function BalancePage() {
  const router = useRouter()
  const [guestId, setGuestId] = useState<string | null>(null)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem('iloyalty_guest_id')
    if (!storedId) {
      router.push('/signin')
      return
    }
    setGuestId(storedId)

    async function fetchBalance() {
      try {
        const res = await fetch(`/api/guest/balance?guestId=${storedId}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || 'Failed to load points balance.')
        } else {
          setBalance(json.data)
        }
      } catch {
        setError('Network error loading balance.')
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [router])

  // Calculate next reward goal (e.g. 50 points for free breakfast / discount)
  const nextRewardTarget = 50
  const progressPercent = balance
    ? Math.min(100, Math.round((balance.available / nextRewardTarget) * 100))
    : 0

  return (
    <div className="app-container">
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <span className="badge badge-gold" style={{ marginBottom: '0.25rem' }}>iLoyalty Account</span>
            <h1 style={{ fontSize: '1.5rem' }}>Points Balance</h1>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('iloyalty_guest_id')
              localStorage.removeItem('iloyalty_guest_email')
              router.push('/signin')
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </header>

        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading verified points record...</p>
          </div>
        )}

        {error && (
          <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {balance && (
          <>
            {/* 30-Day Expiry Warning Banner (PRD Section 6.1) */}
            {balance.expiringWithin30Days > 0 && balance.nearestExpiryDate && (
              <div className="alert-warning" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Points Expiry Warning
                  </strong>
                  <strong>{balance.expiringWithin30Days} points</strong> will expire on{' '}
                  <strong>{new Date(balance.nearestExpiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong>{' '}
                  (points expire 365 days after being earned).
                </div>
              </div>
            )}

            {/* Main Balance Hero Card */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                  Available to Redeem
                </span>
                <span className="badge badge-emerald">Verified PMS Record</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {balance.available}
                </span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '1.1rem' }}>points</span>
              </div>

              {/* Progress to next reward (PRD Section 6.1) */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  <span>Progress to next reward ({nextRewardTarget} pts)</span>
                  <span>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span>Lifetime Earned: {balance.totalEarned} pts</span>
                <span>Redeemed: {balance.totalRedeemed} pts</span>
              </div>
            </div>

            {/* Stated Last-Updated Time (PRD Section 6.1) */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem' }}>
              Record last updated: {new Date(balance.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Link href="/guest/redeem" className="btn-primary" style={{ padding: '0.75rem', fontSize: '0.9rem', textAlign: 'center' }}>
                Redeem Points
              </Link>
              <Link href="/guest/discover" className="btn-secondary" style={{ padding: '0.75rem', fontSize: '0.9rem', textAlign: 'center' }}>
                Book Hotel
              </Link>
            </div>
          </>
        )}
      </div>
      <GuestNav />
    </div>
  )
}
