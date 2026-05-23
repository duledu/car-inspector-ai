// =============================================================================
// Regional Automotive Market Configuration
//
// Maps ISO 3166-1 alpha-2 country codes to:
//   - Local currency
//   - Regional price multiplier vs Serbia baseline (1.0)
//   - Primary marketplace sources (used in AI prompts + display)
//   - Market description for AI context
//
// Price multipliers are used by the LocalMarketProvider fallback only.
// The AI provider uses its training data for the target country directly.
//
// Future: replace multipliers with real pricing APIs or live scraping.
// =============================================================================

export interface CountryMarketConfig {
  /** Display name */
  name: string
  /** ISO 4217 currency code */
  currency: string
  /** Currency symbol for display */
  currencySymbol: string
  /** Price multiplier vs Serbia EUR baseline (RS = 1.0) */
  regionalMultiplier: number
  /** Primary local marketplaces — used in AI prompts */
  primarySources: readonly string[]
  /** One-sentence market description for AI context */
  marketDescription: string
  /** BCP 47 locale for number formatting (e.g. 'de-DE') */
  numberLocale: string
}

// =============================================================================
// Country → Market Config Registry
// =============================================================================

export const COUNTRY_MARKET_CONFIG: Record<string, CountryMarketConfig> = {

  // ─── Balkans ────────────────────────────────────────────────────────────────

  RS: {
    name: 'Serbia',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.00,
    primarySources: ['Polovni Automobili', 'Oglasi.rs', '4x4 Oglasi'],
    marketDescription: 'Serbia used-car market (prices in EUR, typically 15–25% below western Europe)',
    numberLocale: 'sr-RS',
  },
  MK: {
    name: 'North Macedonia',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.05,
    primarySources: ['Reklama5', 'Pazar3', 'CarsDB Macedonia'],
    marketDescription: 'North Macedonia used-car market (prices in EUR, similar to Serbian market)',
    numberLocale: 'mk-MK',
  },
  BG: {
    name: 'Bulgaria',
    currency: 'BGN',
    currencySymbol: 'лв',
    regionalMultiplier: 0.95,
    primarySources: ['Mobile.bg', 'Bazar.bg'],
    marketDescription: 'Bulgaria used-car market (prices in BGN; 1 EUR ≈ 1.96 BGN, slightly below Serbia prices)',
    numberLocale: 'bg-BG',
  },
  HR: {
    name: 'Croatia',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.30,
    primarySources: ['Njuškalo Autos', 'AutoBazar.hr'],
    marketDescription: 'Croatia used-car market (prices in EUR, moderately above Serbia)',
    numberLocale: 'hr-HR',
  },
  SI: {
    name: 'Slovenia',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.60,
    primarySources: ['Avto.net', 'Bolha.com Avti'],
    marketDescription: 'Slovenia used-car market (prices in EUR, significantly higher than Serbia)',
    numberLocale: 'sl-SI',
  },
  BA: {
    name: 'Bosnia & Herzegovina',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 0.90,
    primarySources: ['Olx.ba Automobili', 'AutoBosnia'],
    marketDescription: 'Bosnia & Herzegovina used-car market (prices in EUR, slightly below Serbia)',
    numberLocale: 'bs-BA',
  },
  ME: {
    name: 'Montenegro',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.05,
    primarySources: ['AutoMontenegro', 'Olx.me Automobili'],
    marketDescription: 'Montenegro used-car market (prices in EUR, comparable to Serbia)',
    numberLocale: 'sr-ME',
  },
  AL: {
    name: 'Albania',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 0.85,
    primarySources: ['Njoftime.com Makina', 'Merrjep.com Makina'],
    marketDescription: 'Albania used-car market (prices in EUR, typically below Serbian market)',
    numberLocale: 'sq-AL',
  },
  RO: {
    name: 'Romania',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.05,
    primarySources: ['Autovit.ro', 'OLX.ro Auto'],
    marketDescription: 'Romania used-car market (prices in EUR, comparable to Serbia)',
    numberLocale: 'ro-RO',
  },

  // ─── Central Europe ──────────────────────────────────────────────────────────

  AT: {
    name: 'Austria',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.80,
    primarySources: ['Willhaben Autos', 'AutoScout24 Austria', 'Mobile.de AT'],
    marketDescription: 'Austria used-car market (prices in EUR, near German market levels)',
    numberLocale: 'de-AT',
  },
  DE: {
    name: 'Germany',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.85,
    primarySources: ['Mobile.de', 'AutoScout24 Germany', 'Kleinanzeigen Auto'],
    marketDescription: 'Germany used-car market (prices in EUR; Mobile.de is the primary benchmark)',
    numberLocale: 'de-DE',
  },
  CH: {
    name: 'Switzerland',
    currency: 'CHF',
    currencySymbol: 'CHF',
    regionalMultiplier: 2.10,
    primarySources: ['AutoScout24 Switzerland', 'Tutti.ch Autos'],
    marketDescription: 'Switzerland used-car market (prices in CHF; typically the most expensive in Europe)',
    numberLocale: 'de-CH',
  },
  PL: {
    name: 'Poland',
    currency: 'PLN',
    currencySymbol: 'zł',
    regionalMultiplier: 1.35,
    primarySources: ['OTOMOTO', 'OLX.pl Motoryzacja'],
    marketDescription: 'Poland used-car market (prices in PLN; OTOMOTO is the primary benchmark)',
    numberLocale: 'pl-PL',
  },
  CZ: {
    name: 'Czech Republic',
    currency: 'CZK',
    currencySymbol: 'Kč',
    regionalMultiplier: 1.40,
    primarySources: ['TipCars.cz', 'SAutoBase.cz', 'AutoBazar.eu CZ'],
    marketDescription: 'Czech Republic used-car market (prices in CZK, moderately priced)',
    numberLocale: 'cs-CZ',
  },
  HU: {
    name: 'Hungary',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.25,
    primarySources: ['HasználtAutó.hu', 'Autonavigator.hu'],
    marketDescription: 'Hungary used-car market (prices in HUF often listed in EUR equivalent)',
    numberLocale: 'hu-HU',
  },

  // ─── Western Europe ───────────────────────────────────────────────────────────

  FR: {
    name: 'France',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.80,
    primarySources: ['La Centrale', 'Leboncoin Voitures', 'AutoScout24 France'],
    marketDescription: 'France used-car market (prices in EUR; La Centrale and Leboncoin are benchmarks)',
    numberLocale: 'fr-FR',
  },
  IT: {
    name: 'Italy',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.65,
    primarySources: ['Subito.it Motori', 'AutoScout24 Italy', 'DonnaModerna Auto'],
    marketDescription: 'Italy used-car market (prices in EUR; Subito.it is the leading marketplace)',
    numberLocale: 'it-IT',
  },
  NL: {
    name: 'Netherlands',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.90,
    primarySources: ['AutoTrader NL', 'Marktplaats Auto', 'AutoScout24 NL'],
    marketDescription: 'Netherlands used-car market (prices in EUR, high pricing market)',
    numberLocale: 'nl-NL',
  },
  BE: {
    name: 'Belgium',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.75,
    primarySources: ['2ememain.be Voitures', 'AutoScout24 Belgium'],
    marketDescription: 'Belgium used-car market (prices in EUR, comparable to France)',
    numberLocale: 'fr-BE',
  },
  ES: {
    name: 'Spain',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.55,
    primarySources: ['Coches.net', 'Wallapop Coches', 'AutoScout24 Spain'],
    marketDescription: 'Spain used-car market (prices in EUR, moderately priced)',
    numberLocale: 'es-ES',
  },
  PT: {
    name: 'Portugal',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.50,
    primarySources: ['StandVirtual', 'CustoJusto Auto', 'AutoScout24 Portugal'],
    marketDescription: 'Portugal used-car market (prices in EUR, comparable to Spain)',
    numberLocale: 'pt-PT',
  },
  SE: {
    name: 'Sweden',
    currency: 'SEK',
    currencySymbol: 'kr',
    regionalMultiplier: 1.85,
    primarySources: ['Blocket Fordon', 'AutoScout24 Sweden'],
    marketDescription: 'Sweden used-car market (prices in SEK; Blocket is the primary marketplace)',
    numberLocale: 'sv-SE',
  },
  DK: {
    name: 'Denmark',
    currency: 'DKK',
    currencySymbol: 'kr',
    regionalMultiplier: 2.00,
    primarySources: ['BilBasen.dk', 'AutoScout24 Denmark'],
    marketDescription: 'Denmark used-car market (prices in DKK; high vehicle registration taxes inflate prices)',
    numberLocale: 'da-DK',
  },
  NO: {
    name: 'Norway',
    currency: 'NOK',
    currencySymbol: 'kr',
    regionalMultiplier: 2.20,
    primarySources: ['Finn.no Bil', 'AutoScout24 Norway'],
    marketDescription: 'Norway used-car market (prices in NOK, typically the highest in Europe)',
    numberLocale: 'nb-NO',
  },
  FI: {
    name: 'Finland',
    currency: 'EUR',
    currencySymbol: '€',
    regionalMultiplier: 1.85,
    primarySources: ['Nettiauto.com', 'AutoScout24 Finland'],
    marketDescription: 'Finland used-car market (prices in EUR, comparable to Germany)',
    numberLocale: 'fi-FI',
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    regionalMultiplier: 1.75,
    primarySources: ['AutoTrader UK', 'Gumtree Cars', 'Motors.co.uk'],
    marketDescription: 'UK used-car market (prices in GBP; AutoTrader is the primary benchmark)',
    numberLocale: 'en-GB',
  },

  // ─── Americas ────────────────────────────────────────────────────────────────

  US: {
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    regionalMultiplier: 2.50,
    primarySources: ['AutoTrader', 'Cars.com', 'CarGurus', 'Kelley Blue Book', 'Carvana', 'TrueCar'],
    marketDescription: 'US used-car market (prices in USD; KBB and CarGurus are valuation benchmarks)',
    numberLocale: 'en-US',
  },
  CA: {
    name: 'Canada',
    currency: 'CAD',
    currencySymbol: 'CA$',
    regionalMultiplier: 2.20,
    primarySources: ['AutoTrader Canada', 'Kijiji Autos', 'CarGurus Canada'],
    marketDescription: 'Canada used-car market (prices in CAD; AutoTrader Canada is the primary benchmark)',
    numberLocale: 'en-CA',
  },

  // ─── Asia Pacific ─────────────────────────────────────────────────────────────

  AU: {
    name: 'Australia',
    currency: 'AUD',
    currencySymbol: 'A$',
    regionalMultiplier: 2.30,
    primarySources: ['CarsGuide', 'Carsales.com.au', 'Drive.com.au'],
    marketDescription: 'Australia used-car market (prices in AUD; Carsales.com.au is the primary benchmark)',
    numberLocale: 'en-AU',
  },
}

// =============================================================================
// Sorted list for country selector UI
// =============================================================================

export const COUNTRY_LIST = Object.entries(COUNTRY_MARKET_CONFIG)
  .map(([code, cfg]) => ({ code, name: cfg.name, currency: cfg.currency }))
  .sort((a, b) => a.name.localeCompare(b.name))

// =============================================================================
// Helper functions
// =============================================================================

/** Returns the config for a country code, falling back to Serbia (RS) if unknown. */
export function getCountryConfig(countryCode: string | null | undefined): CountryMarketConfig {
  const code = (countryCode ?? 'RS').toUpperCase()
  return COUNTRY_MARKET_CONFIG[code] ?? COUNTRY_MARKET_CONFIG['RS']!
}

/** Returns the primary marketplace list as a human-readable string. */
export function getSourcesLabel(countryCode: string | null | undefined): string {
  const cfg = getCountryConfig(countryCode)
  return cfg.primarySources.join(', ')
}

/** Returns the regional market name for a given country code. */
export function getRegionalMarketName(countryCode: string | null | undefined): string {
  return getCountryConfig(countryCode).name
}

/** Returns the default currency for a country. */
export function getDefaultCurrency(countryCode: string | null | undefined): string {
  return getCountryConfig(countryCode).currency
}

/**
 * Formats a price in the regional currency.
 * Falls back to simple formatting if Intl is unavailable.
 */
export function formatRegionalPrice(
  amount: number,
  countryCode: string | null | undefined,
): string {
  const cfg = getCountryConfig(countryCode)
  try {
    return new Intl.NumberFormat(cfg.numberLocale, {
      style: 'currency',
      currency: cfg.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${cfg.currencySymbol}${amount.toLocaleString()}`
  }
}
