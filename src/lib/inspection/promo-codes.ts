export interface PromoMeta {
  grantedVia: string
}

const PROMO_CODES: Record<string, PromoMeta> = {
  VIP0629: { grantedVia: 'promo' },
}

export function getPromoMeta(code: string): PromoMeta | null {
  return PROMO_CODES[code.toUpperCase()] ?? null
}
