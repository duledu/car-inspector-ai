// =============================================================================
// JSON-LD structured data generators — safe, no fake data, no overclaims
// =============================================================================

const DOMAIN   = 'https://usedcarsdoctor.com'
const ORG_NAME = 'Used Cars Doctor'
const LOGO_URL = `${DOMAIN}/icons/favicon_used_cars_doctor.png`

// ─── WebSite ──────────────────────────────────────────────────────────────────
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    name:        ORG_NAME,
    url:         DOMAIN,
    description: 'AI-assisted used car inspection tool for buyers.',
  } as const
}

// ─── Organization ─────────────────────────────────────────────────────────────
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:        ORG_NAME,
    url:         DOMAIN,
    logo:        LOGO_URL,
    contactPoint: {
      '@type':      'ContactPoint',
      email:         'contact@usedcarsdoctor.com',
      contactType:   'customer support',
    },
  } as const
}

// ─── SoftwareApplication ──────────────────────────────────────────────────────
// applicationCategory: valid schema.org enum value for a utility / tool app.
// No AggregateRating — we do not fabricate reviews or ratings.
// Description explicitly states AI outputs are informational and advisory only.
export function softwareApplicationSchema() {
  return {
    '@context':           'https://schema.org',
    '@type':              'SoftwareApplication',
    name:                  ORG_NAME,
    applicationCategory:   'UtilitiesApplication',
    operatingSystem:       'Web',
    url:                   DOMAIN,
    description:
      'AI-assisted used car inspection tool. Photograph the vehicle, complete a guided condition checklist, and receive an informational confidence assessment. AI outputs are advisory only and do not constitute a professional mechanical inspection.',
    offers: {
      '@type':        'Offer',
      price:           '0',
      priceCurrency:   'EUR',
      description:     'Free inspection with optional paid vehicle history report.',
    },
  } as const
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':    'ListItem',
      position:    index + 1,
      name:        item.name,
      item:        item.url,
    })),
  }
}
