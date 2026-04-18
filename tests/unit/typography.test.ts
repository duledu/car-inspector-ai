import { balanceHeadlineText } from '@/lib/typography'

describe('balanceHeadlineText', () => {
  it('keeps the last two words together for multi-word headlines', () => {
    expect(balanceHeadlineText('zaslužuje bolje podatke.')).toBe('zaslužuje bolje\u00A0podatke.')
  })

  it('protects short two-word accent lines from splitting into orphan words', () => {
    expect(balanceHeadlineText('sa sigurnošću.')).toBe('sa\u00A0sigurnošću.')
  })

  it('keeps known phrase pairs together without locking the whole heading', () => {
    expect(balanceHeadlineText('Svako polovni auto ima priču.')).toBe('Svako polovni\u00A0auto ima\u00A0priču.')
  })

  it('does not make long two-word headings unbreakable', () => {
    expect(balanceHeadlineText('Gebrauchtwagen kaufen')).toBe('Gebrauchtwagen kaufen')
  })
})
