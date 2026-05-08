export interface PromoMeta {
  grantedVia: string
  unlimited?: boolean
}

const PROMO_CODES: Record<string, PromoMeta> = {
  VIP0629: { grantedVia: 'promo', unlimited: true },
}

export function getPromoMeta(code: string): PromoMeta | null {
  return PROMO_CODES[code.toUpperCase()] ?? null
}
