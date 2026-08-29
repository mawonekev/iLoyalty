'use client'

import React, { useState, useEffect } from 'react'
import { OwnerNav } from '@/components/OwnerNav'

interface MergeDraft {
  id: string
  status: string
  proposedBy: string
  createdAt: string
  sourceGuest: { id: string; email: string; phone?: string; createdAt: string }
  targetGuest: { id: string; email: string; phone?: string; createdAt: string }
}

export default function OwnerApprovalsPage() {
  const [drafts, setDrafts] = useState<MergeDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const loadDrafts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/merges/propose?status=PENDING')
      const json = await res.json()
      if (json.data) setDrafts(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const handleDecision = async (draftId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActingId(draftId)
    setMsg(null)

    try {
      const res = await fetch('/api/owner/merges/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          decision,
          reviewedBy: 'owner_central',
          reviewNote: decision === 'APPROVED' ? 'Approved by central owner.' : 'Rejected by owner.',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMsg(data.error || 'Failed to process decision.')
      } else {
        setMsg(`Merge draft ${decision.toLowerCase()} successfully.`)
        loadDrafts()
      }
    } catch {
      setMsg('Network error executing decision.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div>
      <OwnerNav />
      <div className="portal-container">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Pending Owner Sign-Offs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            PRD Section 6.6 &amp; 6.7: Profile merges and manual stay recoveries require owner approval before taking effect on guest data.
          </p>
        </header>

        {msg && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' }}>
            {msg}
          </div>
        )}

        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Profile Merge Proposals ({drafts.length})</h2>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading pending sign-off items...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No merge proposals pending owner review.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {drafts.map((d) => (
              <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge badge-gold">Merge Proposal</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drafted by {d.proposedBy}</span>
                  </div>

                  <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    <strong>Source (to delete):</strong> {d.sourceGuest?.email} <span style={{ color: 'var(--text-muted)' }}>({d.sourceGuest?.id})</span>
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong>Target (to keep &amp; credit):</strong> {d.targetGuest?.email} <span style={{ color: 'var(--text-muted)' }}>({d.targetGuest?.id})</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    disabled={actingId === d.id}
                    onClick={() => handleDecision(d.id, 'APPROVED')}
                  >
                    Approve &amp; Merge
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--accent-rose)' }}
                    disabled={actingId === d.id}
                    onClick={() => handleDecision(d.id, 'REJECTED')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
