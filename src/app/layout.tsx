import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
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
  title: {
    default: 'Used Car Inspector AI',
    template: '%s · Used Car Inspector AI',
  },
  description: 'AI-powered used car inspection and risk scoring. Take photos, get analysis, buy with confidence.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Car Inspector AI',
  },
  icons: {
    icon:      '/icons/app-icon.png',
    apple:     '/icons/app-icon.png',
    shortcut:  '/icons/app-icon.png',
  },
  openGraph: {
    title: 'Used Car Inspector AI',
    description: 'AI-powered used car inspection and risk scoring',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
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
