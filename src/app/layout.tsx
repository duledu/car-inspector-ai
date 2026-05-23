import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Toaster } from 'react-hot-toast'
import { I18nBootstrap } from '@/components/layout/I18nBootstrap'
import { FALLBACK_LANG, LANG_COOKIE, isSupportedLang } from '@/i18n/shared'
import JsonLd from '@/components/JsonLd'
import { websiteSchema, organizationSchema, softwareApplicationSchema } from '@/lib/schema'
import { PWAProvider } from './pwa'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#080c14',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://usedcarsdoctor.com'),
  title: {
    default:  'Used Car Inspection Reports | Used Cars Doctor',
    template: '%s | Used Cars Doctor',
  },
  description: 'Used car inspection reports for buyers. Check visible damage, panel gaps, repaint indicators, interior wear, dashboard warnings, leaks, and risk notes before buying.',
  keywords: 'used car inspection, used car risk analysis, check used car before buying, car inspection report, used car buying assistant',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Used Cars Doctor',
  },
  icons: {
    icon: [
      { url: '/favicon-16.png',    sizes: '16x16',   type: 'image/png' },
      { url: '/favicon-32.png',    sizes: '32x32',   type: 'image/png' },
      { url: '/favicon-64.png',    sizes: '64x64',   type: 'image/png' },
      { url: '/favicon_new_3.png', sizes: '512x512', type: 'image/png' },
    ],
    apple:    [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon_new_3.png',
  },
  openGraph: {
    title:       'Used Car Inspection Reports | Used Cars Doctor',
    description: 'Check visible used car condition signals and generate a structured inspection report before buying.',
    url:         'https://usedcarsdoctor.com',
    siteName:    'Used Cars Doctor',
    type:        'website',
    locale:      'en_US',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Used Car Inspection Reports | Used Cars Doctor',
    description: 'Used car inspection assistant with visible damage checks, risk notes, and a structured report.',
  },
  alternates: {
    canonical: 'https://usedcarsdoctor.com',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieLocale = cookies().get(LANG_COOKIE)?.value
  const initialLocale = isSupportedLang(cookieLocale) ? cookieLocale : FALLBACK_LANG

  return (
    <html
      lang={initialLocale}
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <JsonLd schema={websiteSchema()} />
        <JsonLd schema={organizationSchema()} />
        <JsonLd schema={softwareApplicationSchema()} />
        <I18nBootstrap initialLocale={initialLocale}>
          {children}
        </I18nBootstrap>
        <PWAProvider />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#0d1420',
              color: '#e8eaf6',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              maxWidth: '90vw',
            },
            duration: 3000,
          }}
        />
      </body>
    </html>
  )
}
