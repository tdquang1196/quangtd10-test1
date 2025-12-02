import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'User Migration Tool',
  description: 'Simple tool for migrating users',
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
