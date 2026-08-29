'use client'

import React, { useState, useEffect } from 'react'
import { StaffNav } from '@/components/StaffNav'

interface MessageLogItem {
  id: string
  guestId: string
  message: string
  context: string
  createdAt: string
}

export default function StaffMessagesPage() {
  const [messages, setMessages] = useState<MessageLogItem[]>([])
  const [guestFilter, setGuestFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const loadMessages = async (filter?: string) => {
    setLoading(true)
    try {
      const url = filter ? `/api/staff/messages?guestId=${encodeURIComponent(filter)}` : '/api/staff/messages'
      const res = await fetch(url)
      const json = await res.json()
      if (json.data) setMessages(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    loadMessages(guestFilter.trim() || undefined)
  }

  return (
    <div>
      <StaffNav />
      <div className="portal-container">
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Guest Statement &amp; Message Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Auditable log of what the iLoyalty app has stated to guests regarding points, balances, redemptions, and money.
          </p>
        </header>

        {/* Filter bar */}
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <input
            className="input-field"
            placeholder="Filter by Exact Guest ID..."
            value={guestFilter}
            onChange={(e) => setGuestFilter(e.target.value)}
            style={{ maxWidth: '360px' }}
          />
          <button type="submit" className="btn-secondary" style={{ width: 'auto' }}>
            Filter Log
          </button>
          {guestFilter && (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: 'auto' }}
              onClick={() => {
                setGuestFilter('')
                loadMessages()
              }}
            >
              Clear
            </button>
          )}
        </form>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading message records...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No messages logged yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m) => (
              <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>{m.context}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Guest: {m.guestId}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {m.message}
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
