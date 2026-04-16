import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Used Cars Doctor, including account data, vehicle inspection data, AI photo analysis, premium reports, payments, and data rights.',
  alternates: {
    canonical: '/legal/privacy',
    languages: {
      'x-default': '/legal/privacy',
    },
  },
  openGraph: {
    title: 'Privacy Policy | Used Cars Doctor',
    description: 'How Used Cars Doctor collects, uses, protects, and shares data for inspection, AI analysis, and premium vehicle history features.',
    url: '/legal/privacy',
    type: 'website',
  },
}

export default function PrivacyLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
