import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Toaster } from 'react-hot-toast'
import { I18nBootstrap } from '@/components/layout/I18nBootstrap'
import { FALLBACK_LANG, LANG_COOKIE, isSupportedLang } from '@/i18n/shared'
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
    default: 'Used Cars Doctor',
    template: '%s · Used Cars Doctor',
  },
  description: 'AI-assisted used car inspection and risk scoring. Take photos, review guidance, and make a more informed decision.',
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
    title: 'Used Cars Doctor',
    description: 'AI-assisted used car inspection and risk scoring',
    type: 'website',
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
