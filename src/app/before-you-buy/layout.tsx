import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Before You Buy a Used Car | Used Cars Doctor',
  description:
    'A complete guide to used car inspection before you commit. Structured visual assessment, risk scoring, and expert guidance — empowering informed buyers in the US market.',
  keywords: [
    'used car inspection',
    'pre-purchase car inspection',
    'how to inspect a used car',
    'used car buying guide',
    'used car risk assessment',
    'car damage detection',
    'used vehicle inspection checklist',
    'used car buyer advice',
    'avoid used car problems',
    'used car confidence score',
  ].join(', '),
  openGraph: {
    title: 'Before You Buy a Used Car | Used Cars Doctor',
    description:
      'Structured vehicle inspection, visible-condition review, and expert guidance for used car buyers. Know what you\'re buying before you commit.',
    type: 'website',
    url: 'https://usedcarsdoctor.com/before-you-buy',
    siteName: 'Used Cars Doctor',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Before You Buy a Used Car | Used Cars Doctor',
    description:
      'Structured vehicle inspections, visible-condition review, and expert guidance for used car buyers.',
  },
  alternates: {
    canonical: 'https://usedcarsdoctor.com/before-you-buy',
  },
}

export default function BeforeYouBuyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
