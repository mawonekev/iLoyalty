'use client'

import React, { useState, useEffect } from 'react'
import { OwnerNav } from '@/components/OwnerNav'

interface HotelReport {
  hotelId: string
  hotelName: string
  active: boolean
  stayCount: number
  iLoyaltyStayCount: number
  manualEntryCount: number
  totalAccommodationSpend: number
  totalFnbSpend: number
  totalOtherSpend: number
  totalPointsEarned: number
  confirmedBookingCount: number
}

interface ReportData {
  groupTotals: {
    totalStays: number
    totalILoyaltyStays: number
    totalPointsEarned: number
    totalConfirmedBookings: number
  }
  byHotel: HotelReport[]
}

export default function OwnerReportingPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/owner/reporting')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setData(json.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <OwnerNav />
      <div className="portal-container">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Group Usage &amp; Points Intelligence</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            PRD Section 6.9: Group-level and per-hotel breakdown of stays, eligible spend, points earned, and bookings.
          </p>
        </header>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Aggregating group metrics across pilot hotels...</p>
          </div>
        ) : !data ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No reporting data available.</p>
          </div>
        ) : (
          <>
            {/* Top KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="card">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Stays</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {data.groupTotals.totalStays}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>
                  {data.groupTotals.totalILoyaltyStays} via iLoyalty
                </span>
              </div>

              <div className="card">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Points Liability Earned</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-gold)', marginTop: '0.25rem' }}>
                  {data.groupTotals.totalPointsEarned} <span style={{ fontSize: '0.9rem' }}>pts</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Central Group Liability</span>
              </div>

              <div className="card">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>In-App Bookings</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-blue)', marginTop: '0.25rem' }}>
                  {data.groupTotals.totalConfirmedBookings}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>Multi-merchant settled</span>
              </div>

              <div className="card">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Pilot Properties</span>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {data.byHotel.filter((h) => h.active).length} / {data.byHotel.length}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shared PMS Group</span>
              </div>
            </div>

            {/* Per-Hotel Breakdown Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontSize: '1.15rem' }}>Per-Hotel Performance Breakdown</h2>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.875rem 1.5rem' }}>Hotel</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Stays (iLoyalty / Total)</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Eligible Spend (£)</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Other Spend (£)</th>
                      <th style={{ padding: '0.875rem 1rem' }}>Points Awarded</th>
                      <th style={{ padding: '0.875rem 1.5rem' }}>Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byHotel.map((h) => (
                      <tr key={h.hotelId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{h.hotelName}</td>
                        <td style={{ padding: '1rem 1rem' }}>
                          <span className={h.active ? 'badge badge-emerald' : 'badge'}>
                            {h.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1rem' }}>
                          {h.iLoyaltyStayCount} / {h.stayCount}
                        </td>
                        <td style={{ padding: '1rem 1rem' }}>
                          £{(h.totalAccommodationSpend + h.totalFnbSpend).toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem 1rem', color: 'var(--text-muted)' }}>
                          £{h.totalOtherSpend.toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem 1rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                          +{h.totalPointsEarned} pts
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {h.confirmedBookingCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
