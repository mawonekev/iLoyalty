'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { GuestNav } from '@/components/GuestNav'

interface RoomResult {
  roomId: string
  description: string
  score?: number
}

interface HotelResult {
  type: 'hotel' | 'room'
  id: string
  name?: string
  hotelId?: string
  hotelName?: string
  description?: string
  score?: number | null
  rooms?: RoomResult[]
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HotelResult[]>([])
  const [loading, setLoading] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Initial load: show all pilot hotels (browse mode)
  useEffect(() => {
    async function loadAllHotels() {
      setLoading(true)
      try {
        const res = await fetch('/api/discovery/search?q=all')
        const json = await res.json()
        if (json.data) {
          setResults(json.data)
          setUsedFallback(json.usedFallback ?? true)
        }
      } catch (err) {
        console.error('Failed to load hotels:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAllHotels()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/discovery/search?q=${encodeURIComponent(query)}`)
      const json = await res.json()

      if (json.data) {
        setResults(json.data)
        setUsedFallback(json.usedFallback ?? false)
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <span className="badge badge-gold" style={{ marginBottom: '0.25rem' }}>Pilot Hotel Group</span>
          <h1 style={{ fontSize: '1.5rem' }}>Discover &amp; Book</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Search by meaning (e.g. &ldquo;quiet room with desk near Leeds&rdquo;).
          </p>
        </header>

        {/* Semantic Search Input */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Describe what you are looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 1.25rem' }} disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
        </form>

        {/* Fallback Notice (PRD Section 6.4) */}
        {hasSearched && usedFallback && (
          <div className="card" style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}>
            ℹ️ No exact semantic match found for &ldquo;{query}&rdquo;. Showing all available pilot group hotels and rooms below so you can still browse and book.
          </div>
        )}

        {/* Results List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((item, idx) => (
            <div key={item.id || idx} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {item.type === 'hotel' ? item.name : item.hotelName || 'Group Hotel'}
                </h3>
                {item.score && !usedFallback ? (
                  <span className="badge badge-emerald">
                    {Math.round(item.score * 100)}% Match
                  </span>
                ) : (
                  <span className="badge badge-gold">Pilot Property</span>
                )}
              </div>

              {item.description && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {item.description}
                </p>
              )}

              {/* Room items for hotel type */}
              {item.rooms && item.rooms.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {item.rooms.map((room) => (
                    <div key={room.roomId} style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {room.description}
                      </div>
                      <Link
                        href={`/guest/book?hotelId=${item.id}&roomId=${room.roomId}`}
                        className="btn-primary"
                        style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        Book
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Single room booking button */}
              {item.type === 'room' && item.hotelId && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <Link
                    href={`/guest/book?hotelId=${item.hotelId}&roomId=${item.id}`}
                    className="btn-primary"
                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Book This Room
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <GuestNav />
    </div>
  )
}
