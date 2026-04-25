import type { Metadata } from 'next'
import { buildPageMetadata, getLangFromCookies } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLangFromCookies()
  return { ...buildPageMetadata('community', lang), robots: { index: false, follow: false } }
}

export default function CommunityLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
