'use client'

import React, { useState, useEffect } from 'react'
import { StaffNav } from '@/components/StaffNav'

interface MergeDraft {
  id: string
  status: string
  proposedBy: string
  createdAt: string
  sourceGuest: { id: string; email: string; phone?: string; createdAt: string }
  targetGuest: { id: string; email: string; phone?: string; createdAt: string }
}

export default function StaffMergesPage() {
  const [sourceGuestId, setSourceGuestId] = useState('')
  const [targetGuestId, setTargetGuestId] = useState('')
  const [proposedBy, setProposedBy] = useState('frontdesk_staff_1')
  const [drafts, setDrafts] = useState<MergeDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadDrafts = async () => {
    try {
      const res = await fetch('/api/staff/merges/propose?status=PENDING')
      const json = await res.json()
      if (json.data) setDrafts(json.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    try {
      const res = await fetch('/api/staff/merges/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceGuestId, targetGuestId, proposedBy }),
      })
      const json = await res.json()

      if (!res.ok) {
        setMsg({ text: json.error || 'Failed to submit merge draft.', type: 'error' })
      } else {
        setMsg({ text: 'Merge proposal drafted and queued for owner review.', type: 'success' })
        setSourceGuestId('')
        setTargetGuestId('')
        loadDrafts()
      }
    } catch {
      setMsg({ text: 'Network error submitting merge.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <StaffNav />
      <div className="portal-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Propose Profile Merge</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              When a guest has duplicate accounts, staff drafts a merge. All points and stays will move into the Target profile once the owner signs off.
            </p>

            {msg && (
              <div className={msg.type === 'success' ? 'card' : 'alert-error'} style={{
                marginBottom: '1rem',
                borderColor: msg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : undefined,
                color: msg.type === 'success' ? '#6ee7b7' : undefined,
              }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handlePropose} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Source Guest ID (Account to be absorbed) *</label>
                <input
                  className="input-field"
                  placeholder="e.g. clx_guest_duplicate"
                  value={sourceGuestId}
                  onChange={(e) => setSourceGuestId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Target Guest ID (Primary account to keep) *</label>
                <input
                  className="input-field"
                  placeholder="e.g. clx_guest_primary"
                  value={targetGuestId}
                  onChange={(e) => setTargetGuestId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Staff Identifier</label>
                <input
                  className="input-field"
                  value={proposedBy}
                  onChange={(e) => setProposedBy(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Drafting...' : 'Draft Merge for Owner Approval'}
              </button>
            </form>
          </div>

          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pending Merge Queue</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Drafts waiting for owner sign-off.
            </p>

            {drafts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>No pending merge proposals.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {drafts.map((d) => (
                  <div key={d.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="badge badge-gold">Pending Owner</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <strong>Source:</strong> {d.sourceGuest?.email} ({d.sourceGuest?.id})
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <strong>Target:</strong> {d.targetGuest?.email} ({d.targetGuest?.id})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Proposed by {d.proposedBy}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
