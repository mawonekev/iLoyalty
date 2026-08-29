'use client'

import React, { useState, useEffect } from 'react'
import { OwnerNav } from '@/components/OwnerNav'

interface RedemptionRule {
  id: string
  description: string
  pointsCost: number
  active: boolean
  approvedBy: string
}

export default function OwnerRulesPage() {
  const [rules, setRules] = useState<RedemptionRule[]>([])
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState('')
  const [approvedBy, setApprovedBy] = useState('owner_central')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadRules = async () => {
    try {
      const res = await fetch('/api/owner/rules')
      const json = await res.json()
      if (json.data) setRules(json.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    try {
      const res = await fetch('/api/owner/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          pointsCost: parseInt(pointsCost, 10),
          active,
          approvedBy,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setMsg({ text: json.error || 'Failed to save rule.', type: 'error' })
      } else {
        setMsg({ text: 'Redemption rule signed off and saved.', type: 'success' })
        setDescription('')
        setPointsCost('')
        loadRules()
      }
    } catch {
      setMsg({ text: 'Network error saving rule.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const toggleRuleActive = async (rule: RedemptionRule) => {
    try {
      await fetch('/api/owner/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          description: rule.description,
          pointsCost: rule.pointsCost,
          active: !rule.active,
          approvedBy,
        }),
      })
      loadRules()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <OwnerNav />
      <div className="portal-container">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Redemption Rules Sign-Off</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            PRD Section 6.10 &amp; 11: The central hotel group holds the legal points liability. The owner reviews and signs off on all rules before they appear to guests.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Create / Sign-off Form */}
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Create / Approve New Rule</h2>

            {msg && (
              <div className={msg.type === 'success' ? 'card' : 'alert-error'} style={{
                marginBottom: '1rem',
                borderColor: msg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : undefined,
                color: msg.type === 'success' ? '#6ee7b7' : undefined,
              }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Rule Description (as seen by guests) *</label>
                <input
                  className="input-field"
                  placeholder="e.g. £10 Food & Beverage Credit"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Points Cost *</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 50"
                  value={pointsCost}
                  onChange={(e) => setPointsCost(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Owner Sign-off ID *</label>
                <input
                  className="input-field"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Required by PRD schema before rule can be activated.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <label htmlFor="active" style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Make active immediately upon sign-off
                </label>
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Signing Off...' : 'Sign Off & Save Rule'}
              </button>
            </form>
          </div>

          {/* Current Rules List */}
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Active &amp; Pending Rules</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rules.map((r) => (
                <div key={r.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{r.description}</h3>
                    <span className="badge badge-gold">{r.pointsCost} pts</span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Signed off by: <strong style={{ color: 'var(--text-secondary)' }}>{r.approvedBy}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <span className={r.active ? 'badge badge-emerald' : 'badge'}>
                      {r.active ? 'Active on Guest Screen' : 'Inactive / Draft'}
                    </span>

                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => toggleRuleActive(r)}
                    >
                      {r.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
