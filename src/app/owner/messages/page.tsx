'use client'

import React, { useState, useEffect } from 'react'
import { OwnerNav } from '@/components/OwnerNav'

interface ContextSummary {
  context: string
  count: number
}

interface MessageLogItem {
  id: string
  guestId: string
  message: string
  context: string
  createdAt: string
}

export default function OwnerMessagesPage() {
  const [messages, setMessages] = useState<MessageLogItem[]>([])
  const [summary, setSummary] = useState<ContextSummary[]>([])
  const [total, setTotal] = useState(0)
  const [selectedContext, setSelectedContext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMessages = async (ctx?: string | null) => {
    setLoading(true)
    try {
      const url = ctx ? `/api/owner/messages?context=${encodeURIComponent(ctx)}` : '/api/owner/messages'
      const res = await fetch(url)
      const json = await res.json()
      if (json.data) {
        setMessages(json.data.messages)
        setSummary(json.data.byContext || [])
        setTotal(json.data.totalLogged || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages(selectedContext)
  }, [selectedContext])

  return (
    <div>
      <OwnerNav />
      <div className="portal-container">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Group-Level Guest Statement Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            PRD Section 6.11: Full audit trail of what iLoyalty has stated to guests regarding balances, points, money, and redemptions across all pilot properties.
          </p>
        </header>

        {/* Summary Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setSelectedContext(null)}
            className={selectedContext === null ? 'btn-primary' : 'btn-secondary'}
            style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          >
            All Statements ({total})
          </button>
          {summary.map((s) => (
            <button
              key={s.context}
              onClick={() => setSelectedContext(s.context)}
              className={selectedContext === s.context ? 'btn-primary' : 'btn-secondary'}
              style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            >
              {s.context} ({s.count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading group audit records...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No statements recorded for this context.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m) => (
              <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>{m.context}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Guest ID: {m.guestId}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {m.message}
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '1.5rem' }}>
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
