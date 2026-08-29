import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'iLoyalty',
  description: 'Your loyalty rewards across our hotel group',
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
