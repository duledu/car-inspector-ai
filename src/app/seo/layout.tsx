import Link from 'next/link'

export default function SeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ minHeight: '100svh', background: '#080c14', color: '#f1f5f9', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,12,20,0.96)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div style={{
          maxWidth: 820, margin: '0 auto',
          padding: '0 20px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.svg" alt="" height={28} style={{ width: 'auto', flexShrink: 0, display: 'block' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Used Cars Doctor
            </span>
          </Link>

          <Link href="/inspection" style={{
            fontSize: 12, fontWeight: 700,
            color: '#22d3ee',
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(34,211,238,0.3)',
            background: 'rgba(34,211,238,0.06)',
            letterSpacing: '0.01em',
          }}>
            Start Inspection →
          </Link>
        </div>
      </header>

      {/* ── Page content ── */}
      {children}

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 20px',
        textAlign: 'center',
        fontSize: 12,
        color: 'rgba(255,255,255,0.25)',
        lineHeight: 1.7,
      }}>
        <p style={{ margin: '0 0 8px' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Used Cars Doctor</Link>
          {' · '}
          <Link href="/legal/privacy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Privacy Policy</Link>
          {' · '}
          <Link href="/legal/terms" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Terms of Service</Link>
        </p>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Used Cars Doctor. AI-assisted inspection tool for used car buyers.
        </p>
      </footer>

    </div>
  )
}
