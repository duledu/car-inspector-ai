import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Used Cars Doctor, including AI decision-support disclaimers, premium report terms, third-party provider limitations, and liability limits.',
  alternates: {
    canonical: '/legal/terms',
    languages: {
      'x-default': '/legal/terms',
    },
  },
  openGraph: {
    title: 'Terms of Service | Used Cars Doctor',
    description: 'Terms governing use of Used Cars Doctor, AI-generated outputs, paid features, vehicle history data, and user responsibilities.',
    url: '/legal/terms',
    type: 'website',
  },
}

export default function TermsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
