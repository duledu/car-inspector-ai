import type { Metadata } from 'next'
import { buildPageMetadata, getLangFromCookies } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLangFromCookies()
  return buildPageMetadata('terms', lang)
}

export default function TermsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
