import { formatProductPrice, getProductPrice } from '../../src/modules/payments/pricing'

describe('payment pricing', () => {
  test.each([
    ['sr', 49900, 'RSD'],
    ['sr-RS', 49900, 'RSD'],
    ['mk', 24900, 'MKD'],
    ['bg', 500, 'BGN'],
    ['de', 499, 'EUR'],
    ['en', 499, 'EUR'],
    ['sq', 499, 'EUR'],
    ['fr', 499, 'EUR'],
  ])('resolves INSPECTION_REPORT launch price for %s', (locale, amountCents, currency) => {
    expect(getProductPrice('INSPECTION_REPORT', locale)).toMatchObject({
      amountCents,
      currency,
    })
  })

  test.each([
    ['sr', 'RSD', 49900, /499/],
    ['mk', 'MKD', 24900, /249/],
    ['bg', 'BGN', 500, /5/],
    ['de', 'EUR', 499, /4[,.]99/],
    ['en', 'EUR', 499, /4\.99/],
  ])('formats %s localized report price', (locale, currency, amountCents, expected) => {
    expect(formatProductPrice({ amountCents, currency }, locale)).toMatch(expected)
  })
})
