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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#080c14',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://usedcarsdoctor.com'),
  title: {
    default:  'Check Before You Buy | Used Cars Doctor',
    template: '%s | Used Cars Doctor',
  },
  description: 'AI-powered used car inspection. Photograph the car, complete a guided checklist, and get a confidence score before you buy. Detect paint defects, panel damage, and hidden issues.',
  keywords: 'used car inspection, AI car inspection, check car before buying, car inspection checklist, detect car damage from photos',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Used Cars Doctor',
  },
  icons: {
    icon:     '/icons/favicon_used_cars_doctor.png',
    apple:    '/icons/favicon_used_cars_doctor.png',
    shortcut: '/icons/favicon_used_cars_doctor.png',
  },
  openGraph: {
    title:       'Check Before You Buy | Used Cars Doctor',
    description: 'AI-powered used car inspection. Photograph the car, complete a guided checklist, and get a confidence score before you buy.',
    url:         'https://usedcarsdoctor.com',
    siteName:    'Used Cars Doctor',
    type:        'website',
    locale:      'en_US',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Check Before You Buy | Used Cars Doctor',
    description: 'AI-powered used car inspection. Detect paint defects, panel damage, and hidden issues before you buy.',
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
