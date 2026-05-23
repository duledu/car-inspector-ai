import { getCountryConfig, getDefaultCurrency, getSourcesLabel, COUNTRY_LIST } from '../../src/lib/markets/country-config'
import { LocalMarketProvider } from '../../src/modules/pricing/providers/local-market.provider'
import { PricingService } from '../../src/modules/pricing/pricing.service'

// ─── country-config helpers ──────────────────────────────────────────────────

describe('getCountryConfig', () => {
  test('returns RS config for null', () => {
    const cfg = getCountryConfig(null)
    expect(cfg.currency).toBe('EUR')
    expect(cfg.name).toBe('Serbia')
    expect(cfg.regionalMultiplier).toBe(1.0)
  })

  test('returns RS config for undefined', () => {
    expect(getCountryConfig(undefined).name).toBe('Serbia')
  })

  test('returns RS config for unknown code', () => {
    expect(getCountryConfig('ZZ').name).toBe('Serbia')
  })

  test('returns DE config', () => {
    const cfg = getCountryConfig('DE')
    expect(cfg.currency).toBe('EUR')
    expect(cfg.regionalMultiplier).toBe(1.85)
    expect(cfg.primarySources).toContain('Mobile.de')
  })

  test('returns US config with USD', () => {
    const cfg = getCountryConfig('US')
    expect(cfg.currency).toBe('USD')
    expect(cfg.regionalMultiplier).toBe(2.5)
  })

  test('is case-insensitive', () => {
    expect(getCountryConfig('de').name).toBe('Germany')
  })
})

describe('getDefaultCurrency', () => {
  test.each([
    ['RS', 'EUR'],
    ['DE', 'EUR'],
    ['GB', 'GBP'],
    ['US', 'USD'],
    ['CH', 'CHF'],
    ['PL', 'PLN'],
  ])('country %s → currency %s', (code, expected) => {
    expect(getDefaultCurrency(code)).toBe(expected)
  })
})

describe('getSourcesLabel', () => {
  test('includes Polovni Automobili for RS', () => {
    expect(getSourcesLabel('RS')).toContain('Polovni Automobili')
  })

  test('includes Mobile.de for DE', () => {
    expect(getSourcesLabel('DE')).toContain('Mobile.de')
  })
})

describe('COUNTRY_LIST', () => {
  test('is sorted alphabetically by name', () => {
    const names = COUNTRY_LIST.map(c => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  test('includes all required fields', () => {
    for (const c of COUNTRY_LIST) {
      expect(c.code).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.currency).toBeTruthy()
    }
  })

  test('has at least 20 countries', () => {
    expect(COUNTRY_LIST.length).toBeGreaterThanOrEqual(20)
  })
})

// ─── LocalMarketProvider — regional multiplier ───────────────────────────────

describe('LocalMarketProvider regional pricing', () => {
  const provider = new LocalMarketProvider()
  const baseQuery = { make: 'Volkswagen', model: 'Golf', year: 2018 }

  test('RS baseline returns EUR', async () => {
    const result = await provider.getMarketPrice({ ...baseQuery, countryCode: 'RS' })
    expect(result.currency).toBe('EUR')
  })

  test('DE market price is higher than RS', async () => {
    const [rs, de] = await Promise.all([
      provider.getMarketPrice({ ...baseQuery, countryCode: 'RS' }),
      provider.getMarketPrice({ ...baseQuery, countryCode: 'DE' }),
    ])
    expect(de.avgPrice).toBeGreaterThan(rs.avgPrice)
  })

  test('DE multiplier ≈ 1.85× RS', async () => {
    const [rs, de] = await Promise.all([
      provider.getMarketPrice({ ...baseQuery, countryCode: 'RS' }),
      provider.getMarketPrice({ ...baseQuery, countryCode: 'DE' }),
    ])
    const ratio = de.avgPrice / rs.avgPrice
    expect(ratio).toBeGreaterThan(1.7)
    expect(ratio).toBeLessThan(2.0)
  })

  test('US market returns USD', async () => {
    const result = await provider.getMarketPrice({ ...baseQuery, countryCode: 'US' })
    expect(result.currency).toBe('USD')
  })

  test('GB market returns GBP', async () => {
    const result = await provider.getMarketPrice({ ...baseQuery, countryCode: 'GB' })
    expect(result.currency).toBe('GBP')
  })

  test('null countryCode falls back to RS', async () => {
    const [withNull, withRS] = await Promise.all([
      provider.getMarketPrice({ ...baseQuery, countryCode: null }),
      provider.getMarketPrice({ ...baseQuery, countryCode: 'RS' }),
    ])
    expect(withNull.avgPrice).toBe(withRS.avgPrice)
    expect(withNull.currency).toBe(withRS.currency)
  })

  test('source label reflects market', async () => {
    const de = await provider.getMarketPrice({ ...baseQuery, countryCode: 'DE' })
    expect(de.source).toContain('Germany')
  })
})

// ─── PricingService — Palovni bypass ─────────────────────────────────────────

describe('PricingService provider routing', () => {
  test('skips Palovni for non-RS country and still returns a result', async () => {
    const mockPalovni = {
      providerId: 'polovni',
      providerName: 'Polovni',
      isAvailable: () => true,
      getMarketPrice: jest.fn().mockRejectedValue(new Error('should not be called')),
    }
    const mockLocal = {
      providerId: 'local-market',
      providerName: 'Local',
      isAvailable: () => true,
      getMarketPrice: jest.fn().mockResolvedValue({
        minPrice: 10000, maxPrice: 15000, avgPrice: 12000,
        currency: 'EUR', confidence: 'medium' as const,
        source: 'test', listingCount: 0,
      }),
    }

    const service = new PricingService([mockPalovni, mockLocal])
    const result = await service.getMarketPrice({
      make: 'BMW', model: '3 Series', year: 2019, countryCode: 'DE',
    })

    expect(mockPalovni.getMarketPrice).not.toHaveBeenCalled()
    expect(mockLocal.getMarketPrice).toHaveBeenCalledTimes(1)
    expect(result.avgPrice).toBe(12000)
  })

  test('uses Palovni for RS country', async () => {
    const mockPalovni = {
      providerId: 'polovni',
      providerName: 'Polovni',
      isAvailable: () => true,
      getMarketPrice: jest.fn().mockResolvedValue({
        minPrice: 8000, maxPrice: 12000, avgPrice: 10000,
        currency: 'EUR', confidence: 'high' as const,
        source: 'Polovni', listingCount: 15,
      }),
    }
    const mockLocal = {
      providerId: 'local-market',
      providerName: 'Local',
      isAvailable: () => true,
      getMarketPrice: jest.fn(),
    }

    const service = new PricingService([mockPalovni, mockLocal])
    await service.getMarketPrice({
      make: 'BMW', model: '3 Series', year: 2019, countryCode: 'RS',
    })

    expect(mockPalovni.getMarketPrice).toHaveBeenCalledTimes(1)
    expect(mockLocal.getMarketPrice).not.toHaveBeenCalled()
  })
})
