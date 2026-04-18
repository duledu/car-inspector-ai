import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Deletion',
  description: 'How to request deletion of a Used Cars Doctor account and associated app data.',
  alternates: {
    canonical: '/legal/account-deletion',
    languages: {
      'x-default': '/legal/account-deletion',
    },
  },
  openGraph: {
    title: 'Account Deletion | Used Cars Doctor',
    description: 'Instructions for requesting deletion of a Used Cars Doctor account and associated app data.',
    url: '/legal/account-deletion',
    type: 'website',
  },
}

export default function AccountDeletionLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
