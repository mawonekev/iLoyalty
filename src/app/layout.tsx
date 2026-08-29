import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iLoyalty — Pilot Hotel Rewards',
  description: 'Your verified loyalty account across pilot group hotels.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
