import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Staff Dashboard – OrderIQ',
  description: 'Personal-Dashboard für Bestellungen und Service',
  manifest: '/manifest-staff.json',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
