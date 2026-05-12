import type { PremiumProduct } from '@/types'

export type ProductPrice = {
  amountCents: number
  currency: string
  label: string
}

const BASE_PRODUCT_PRICES: Record<PremiumProduct, ProductPrice> = {
  CARVERTICAL_REPORT: {
    amountCents: 1499,
    currency: 'EUR',
    label: 'Full Vehicle History Report',
  },
  AI_DEEP_SCAN: {
    amountCents: 999,
    currency: 'EUR',
    label: 'AI Deep Photo Analysis, Full Scan',
  },
  FULL_INSPECTION_BUNDLE: {
    amountCents: 2499,
    currency: 'EUR',
    label: 'Full Inspection Bundle (History + AI)',
  },
  INSPECTION_REPORT: {
    amountCents: 499,
    currency: 'EUR',
    label: 'Professional AI Inspection Report',
  },
}

const INSPECTION_REPORT_REGIONAL_PRICES: Record<string, ProductPrice> = {
  sr: { amountCents: 49900, currency: 'RSD', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
  mk: { amountCents: 24900, currency: 'MKD', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
  bg: { amountCents: 500, currency: 'BGN', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
  de: { amountCents: 499, currency: 'EUR', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
  en: { amountCents: 499, currency: 'EUR', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
  sq: { amountCents: 499, currency: 'EUR', label: BASE_PRODUCT_PRICES.INSPECTION_REPORT.label },
}

export function normalizePricingLocale(locale: string | null | undefined): string {
  return (locale ?? 'en').toLowerCase().split('-')[0] || 'en'
}

export function getProductPrice(productType: PremiumProduct, locale?: string | null): ProductPrice {
  if (productType === 'INSPECTION_REPORT') {
    const lang = normalizePricingLocale(locale)
    return INSPECTION_REPORT_REGIONAL_PRICES[lang] ?? INSPECTION_REPORT_REGIONAL_PRICES.en
  }

  return BASE_PRODUCT_PRICES[productType]
}

export function formatProductPrice(price: Pick<ProductPrice, 'amountCents' | 'currency'>, locale?: string | null): string {
  const amount = price.amountCents / 100
  const hasFraction = price.amountCents % 100 !== 0
  try {
    return new Intl.NumberFormat(locale ?? 'en', {
      style: 'currency',
      currency: price.currency,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(amount)
  } catch {
    return `${hasFraction ? amount.toFixed(2) : Math.round(amount).toString()} ${price.currency}`
  }
}
