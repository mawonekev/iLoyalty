'use client'

import React, { useState, useEffect } from 'react'
import { OwnerNav } from '@/components/OwnerNav'

interface HotelSyncHealth {
  hotelId: string
  hotelName: string
  status: string
  lastSyncStartedAt: string | null
  lastSyncCompletedAt: string | null
  recordsProcessed: number
  recordsUpserted: number
  errorMessage: string | null
  failuresLast24h: number
  healthy: boolean
}

export default function OwnerSyncHealthPage() {
  const [hotels, setHotels] = useState<HotelSyncHealth[]>([])
  const [overallHealthy, setOverallHealthy] = useState(true)
  const [loading, setLoading] = useState(true)

  const loadHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/sync-health')
      const json = await res.json()
      if (json.data) {
        setHotels(json.data.hotels)
        setOverallHealthy(json.data.overallHealthy)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  return (
    <div>
      <OwnerNav />
      <div className="portal-container">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>PMS Sync Health &amp; Failure Detection</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              PRD Section 6.7 &amp; 6.12: Automated daily sync monitoring. Any failure surfaces here the same day to trigger manual entry.
            </p>
          </div>

          <button onClick={loadHealth} className="btn-secondary" style={{ width: 'auto' }}>
            Refresh Status
          </button>
        </header>

        {/* Overall Health Banner */}
        <div className="card" style={{
          marginBottom: '2rem',
          background: overallHealthy ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.1)',
          borderColor: overallHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: overallHealthy ? '#6ee7b7' : '#fda4af', marginBottom: '0.25rem' }}>
              {overallHealthy ? '✓ All Pilot Hotel PMS Connectors Operational' : '⚠️ Sync Interruption Detected'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {overallHealthy
                ? 'All hotel sync jobs completed successfully in the last cycle with zero duplicate records.'
                : 'One or more hotel sync connectors encountered failures. Review error logs below and alert staff for manual recovery.'}
            </p>
          </div>
          <span className={overallHealthy ? 'badge badge-emerald' : 'badge badge-rose'} style={{ fontSize: '0.85rem' }}>
            {overallHealthy ? 'System Healthy' : 'Action Required'}
          </span>
        </div>

        {/* Per-Hotel Sync Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {hotels.map((h) => (
            <div key={h.hotelId} className="card" style={{ borderColor: h.healthy ? 'var(--border-subtle)' : 'rgba(244, 63, 94, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{h.hotelName}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {h.hotelId}</span>
                </div>
                <span className={h.healthy ? 'badge badge-emerald' : 'badge badge-rose'}>
                  {h.status}
                </span>
              </div>

              <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Last Started:</span>
                  <span>{h.lastSyncStartedAt ? new Date(h.lastSyncStartedAt).toLocaleString() : 'Never'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Records Upserted:</span>
                  <span style={{ fontWeight: 600 }}>{h.recordsUpserted} / {h.recordsProcessed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>24h Failures:</span>
                  <span style={{ color: h.failuresLast24h > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: 600 }}>
                    {h.failuresLast24h}
                  </span>
                </div>
              </div>

              {h.errorMessage && (
                <div className="alert-error" style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
                  <strong>Error:</strong> {h.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
