import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getSeoPage, getAllSeoSlugs } from '@/lib/seo-pages'
import JsonLd from '@/components/JsonLd'
import { breadcrumbSchema } from '@/lib/schema'

const DOMAIN = 'https://usedcarsdoctor.com'

// ─── Static generation ────────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllSeoSlugs().map(slug => ({ slug }))
}

// ─── Per-page metadata ────────────────────────────────────────────────────────

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getSeoPage(params.slug)
  if (!page) return {}

  const url = `${DOMAIN}/seo/${page.slug}`

  return {
    title:       { absolute: page.metaTitle },
    description: page.metaDescription,
    keywords:    page.keywords,
    alternates:  { canonical: url },
    openGraph: {
      title:       page.metaTitle,
      description: page.metaDescription,
      url,
      siteName:    'Used Cars Doctor',
      type:        'article',
      locale:      'en_US',
    },
    twitter: {
      card:        'summary_large_image',
      title:       page.metaTitle,
      description: page.metaDescription,
    },
  }
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const S = {
  article: {
    maxWidth: 820,
    margin: '0 auto',
    padding: 'clamp(32px, 5vw, 56px) 20px 72px',
  } satisfies React.CSSProperties,

  h1: {
    margin: '0 0 20px',
    fontSize: 'clamp(24px, 4vw, 36px)',
    fontWeight: 900,
    letterSpacing: '-0.8px',
    color: '#fff',
    lineHeight: 1.2,
  } satisfies React.CSSProperties,

  lead: {
    margin: '0 0 40px',
    fontSize: 'clamp(15px, 2vw, 17px)',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.75,
    borderLeft: '3px solid #22d3ee',
    paddingLeft: 18,
  } satisfies React.CSSProperties,

  section: {
    marginBottom: 40,
  } satisfies React.CSSProperties,

  h2: {
    margin: '0 0 12px',
    fontSize: 'clamp(17px, 2.2vw, 21px)',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    lineHeight: 1.3,
  } satisfies React.CSSProperties,

  body: {
    margin: '0 0 12px',
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.75,
  } satisfies React.CSSProperties,

  ul: {
    margin: '8px 0 0',
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } satisfies React.CSSProperties,

  li: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.7,
  } satisfies React.CSSProperties,

  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '40px 0',
  } satisfies React.CSSProperties,

  ctaBox: {
    padding: 'clamp(20px, 4vw, 32px)',
    background: 'linear-gradient(135deg, rgba(34,211,238,0.07) 0%, rgba(129,140,248,0.05) 100%)',
    border: '1px solid rgba(34,211,238,0.18)',
    borderRadius: 16,
    marginTop: 48,
  } satisfies React.CSSProperties,

  ctaHeading: {
    margin: '0 0 10px',
    fontSize: 'clamp(17px, 2.2vw, 20px)',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.3px',
  } satisfies React.CSSProperties,

  ctaBody: {
    margin: '0 0 20px',
    fontSize: 15,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.65,
  } satisfies React.CSSProperties,

  ctaLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '12px 22px',
    background: '#22d3ee',
    color: '#050810',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    textDecoration: 'none',
    letterSpacing: '-0.1px',
  } satisfies React.CSSProperties,

  disclaimer: {
    marginTop: 32,
    padding: '12px 16px',
    background: 'rgba(251,191,36,0.05)',
    border: '1px solid rgba(251,191,36,0.18)',
    borderRadius: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.65,
  } satisfies React.CSSProperties,
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function SeoPage({ params }: Readonly<{ params: { slug: string } }>) {
  const page = getSeoPage(params.slug)
  if (!page) notFound()

  const crumbs = breadcrumbSchema([
    { name: 'Home',    url: DOMAIN },
    { name: page.h1,  url: `${DOMAIN}/seo/${page.slug}` },
  ])

  return (
    <article style={S.article}>

      {/* Structured data */}
      <JsonLd schema={crumbs} />

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 24, fontSize: 12, color: 'rgba(255,255,255,0.3)' }} aria-label="Breadcrumb">
        <Link href="/" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Home</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span>{page.h1}</span>
      </nav>

      {/* H1 */}
      <h1 style={S.h1}>{page.h1}</h1>

      {/* Lead paragraph */}
      <p style={S.lead}>{page.lead}</p>

      <div style={S.divider} />

      {/* Sections */}
      {page.sections.map((section) => (
        <section key={section.heading} style={S.section}>
          <h2 style={S.h2}>{section.heading}</h2>
          <p style={S.body}>{section.body}</p>
          {section.bullets && section.bullets.length > 0 && (
            <ul style={S.ul}>
              {section.bullets.map((bullet) => (
                <li key={bullet} style={S.li}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div style={S.divider} />

      {/* CTA */}
      <div style={S.ctaBox}>
        <h2 style={S.ctaHeading}>{page.ctaHeading}</h2>
        <p style={S.ctaBody}>{page.ctaBody}</p>
        <Link href="/inspection" style={S.ctaLink}>
          Start a Free Inspection
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>

      {/* Disclaimer */}
      {page.disclaimer && (
        <p style={S.disclaimer}>
          <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Note: </strong>
          {page.disclaimer}
        </p>
      )}

    </article>
  )
}
