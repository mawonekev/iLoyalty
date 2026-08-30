'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GuestNav } from '@/components/GuestNav'

interface RedemptionRule {
  id: string
  description: string
  pointsCost: number
}

interface BalanceData {
  available: number
}

export default function RedeemPage() {
  const router = useRouter()
  const [guestId, setGuestId] = useState<string | null>(null)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [rules, setRules] = useState<RedemptionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem('iloyalty_guest_id')
    if (!storedId) {
      router.push('/signin')
      return
    }
    setGuestId(storedId)

    async function loadData() {
      try {
        const [balRes, rulesRes] = await Promise.all([
          fetch(`/api/guest/balance?guestId=${storedId}`),
          fetch('/api/rules'),
        ])
        const balJson = await balRes.json()
        const rulesJson = await rulesRes.json()

        if (balJson.data) setBalance(balJson.data)
        if (rulesJson.data) setRules(rulesJson.data)
      } catch {
        setErrorMsg('Error loading reward data.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleRedeem = async (rule: RedemptionRule) => {
    if (!guestId) return
    setErrorMsg(null)
    setSuccessMsg(null)
    setRedeemingId(rule.id)

    try {
      const res = await fetch('/api/guest/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, ruleId: rule.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Redemption was rejected.')
      } else {
        setSuccessMsg(`Successfully redeemed "${rule.description}" for ${rule.pointsCost} points!`)
        if (data.data?.newBalance !== undefined) {
          setBalance({ available: data.data.newBalance })
        }
      }
    } catch {
      setErrorMsg('Network error processing redemption.')
    } finally {
      setRedeemingId(null)
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              textDecoration: 'none',
              padding: '0.3rem 0.6rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
            }}
          >
            ← Home
          </Link>
          <span className="badge badge-gold">Group Rewards</span>
        </div>

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem' }}>Redeem Points</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Redeem verified points against your bookings and hotel perks.
          </p>
        </header>


        {/* Current Balance Bar */}
        {balance && (
          <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Your Available Balance</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {balance.available} <span style={{ fontSize: '0.9rem', color: 'var(--accent-gold)' }}>points</span>
              </div>
            </div>
            <span className="badge badge-emerald">Active</span>
          </div>
        )}

        {successMsg && (
          <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '1.25rem', color: '#6ee7b7' }}>
            ✓ {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
            ✕ {errorMsg}
          </div>
        )}

        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading verified redemption rules...</p>
          </div>
        )}

        {!loading && rules.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No active redemption rules available.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rules.map((rule) => {
            const hasEnough = balance ? balance.available >= rule.pointsCost : false
            const isRedeeming = redeemingId === rule.id

            return (
              <div key={rule.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{rule.description}</h3>
                  <span className="badge badge-gold" style={{ fontSize: '0.85rem' }}>
                    {rule.pointsCost} pts
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: hasEnough ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                    {hasEnough ? '✓ Balance sufficient' : `Need ${rule.pointsCost - (balance?.available || 0)} more pts`}
                  </span>

                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    disabled={!hasEnough || isRedeeming}
                    onClick={() => handleRedeem(rule)}
                  >
                    {isRedeeming ? 'Redeeming...' : 'Redeem Now'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <GuestNav />
    </div>
  )
}
