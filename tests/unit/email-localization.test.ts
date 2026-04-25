import { DEFAULT_ANNOUNCEMENT, DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { SUPPORTED_LANGS, FALLBACK_LANG } from '@/i18n/shared'
import {
  getAnnouncementEditorContent,
  getMarketingEditorContent,
  normalizeAnnouncementContent,
  normalizeMarketingContent,
  resolveAnnouncementContent,
  resolveMarketingContent,
  setAnnouncementLocalizedField,
  setMarketingLocalizedField,
} from '@/lib/email/localized-template-content'
import { buildDynamicAppUpdateTemplate } from '@/lib/email/templates/app-update-template'
import { buildMarketingEmailTemplate } from '@/lib/email/templates/marketing-email-template'
import { getAppUpdateStrings } from '@/lib/email/email-i18n'
import type { SupportedLang } from '@/i18n/shared'

describe('email template localization', () => {
  const nonFallbackLangs = SUPPORTED_LANGS.filter(lang => lang !== FALLBACK_LANG)

  it('stores marketing edits per language without changing the default template', () => {
    const srContent = setMarketingLocalizedField(DEFAULT_MARKETING_CAMPAIGN, 'sr', 'subject', 'Srpski naslov')
    const deContent = setMarketingLocalizedField(srContent, 'de', 'subject', 'Deutscher Betreff')

    expect(deContent.subject).toBe(DEFAULT_MARKETING_CAMPAIGN.subject)
    expect(deContent.localizations?.sr?.subject).toBe('Srpski naslov')
    expect(deContent.localizations?.de?.subject).toBe('Deutscher Betreff')
    expect(getMarketingEditorContent(deContent, 'sr').subject).toBe('Srpski naslov')
  })

  it('falls back one missing localized marketing field at a time', () => {
    const content = normalizeMarketingContent({
      ...DEFAULT_MARKETING_CAMPAIGN,
      subject: 'Default subject',
      headline: 'Default headline',
      localizations: {
        sr: {
          subject: 'Srpski naslov',
          headline: '',
        },
      },
    })

    const localized = resolveMarketingContent(content, 'sr').content

    expect(localized.subject).toBe('Srpski naslov')
    expect(localized.headline).toBe('Pregled pre kupovine.')
  })

  it('stores and resolves app update localizations with the same field fallback rules', () => {
    const content = normalizeAnnouncementContent({
      ...DEFAULT_ANNOUNCEMENT,
      subject: 'Default app update subject',
      headline: 'Default app update headline',
    })

    const localizedDraft = setAnnouncementLocalizedField(content, 'sr', 'headline', 'Srpski naslov aplikacije')
    const localized = resolveAnnouncementContent(localizedDraft, 'sr').content

    expect(localized.subject).toBe(getAppUpdateStrings('sr').subject)
    expect(localized.headline).toBe('Srpski naslov aplikacije')
    expect(resolveAnnouncementContent(localizedDraft, 'not-supported').lang).toBe('en')
  })

  it.each(nonFallbackLangs)('switches marketing editor away from English defaults for %s before localized content is saved', lang => {
    const editor = getMarketingEditorContent(DEFAULT_MARKETING_CAMPAIGN, lang)
    const previewResolved = resolveMarketingContent(DEFAULT_MARKETING_CAMPAIGN, lang).content

    expect(editor.subject).toBe(previewResolved.subject)
    expect(editor.headline).toBe(previewResolved.headline)
    expect(editor.subject).not.toBe(DEFAULT_MARKETING_CAMPAIGN.subject)
    expect(editor.headline).not.toBe(DEFAULT_MARKETING_CAMPAIGN.headline)
  })

  it.each(nonFallbackLangs)('switches app update editor away from English defaults for %s before localized content is saved', lang => {
    const editor = getAnnouncementEditorContent(DEFAULT_ANNOUNCEMENT, lang)
    const previewResolved = resolveAnnouncementContent(DEFAULT_ANNOUNCEMENT, lang).content

    expect(editor.subject).toBe(previewResolved.subject)
    expect(editor.headline).toBe(previewResolved.headline)
    expect(editor.subject).toBe(getAppUpdateStrings(lang).subject)
    expect(editor.headline).toBe(getAppUpdateStrings(lang).headline)
  })

  it('uses the shared supported language list for all email localization variants', () => {
    expect(SUPPORTED_LANGS).toEqual(['en', 'sr', 'de', 'mk', 'sq', 'bg'])
  })

  it.each(SUPPORTED_LANGS)('resolves and renders marketing content for %s', lang => {
    const expectedSubject = `Marketing subject ${lang}`
    const expectedHeadline = `Marketing headline ${lang}`
    const defaultContent = {
      ...DEFAULT_MARKETING_CAMPAIGN,
      subject: 'Marketing subject en',
      headline: 'Marketing headline en',
      introParagraph: 'Marketing intro en',
    }

    const content = lang === FALLBACK_LANG
      ? defaultContent
      : normalizeMarketingContent({
        ...defaultContent,
        localizations: {
          [lang]: {
            subject: expectedSubject,
            headline: expectedHeadline,
            introParagraph: `Marketing intro ${lang}`,
          },
        },
      })

    const resolved = resolveMarketingContent(content, lang)
    const template = buildMarketingEmailTemplate(resolved.content, resolved.lang)

    expect(resolved.lang).toBe(lang)
    expect(resolved.content.subject).toBe(expectedSubject)
    expect(resolved.content.headline).toBe(expectedHeadline)
    expect(template.subject).toBe(expectedSubject)
    expect(template.html).toContain(expectedHeadline)
  })

  it.each(SUPPORTED_LANGS)('resolves and renders app update content for %s', lang => {
    const expectedSubject = `App update subject ${lang}`
    const expectedHeadline = `App update headline ${lang}`
    const defaultContent = {
      ...DEFAULT_ANNOUNCEMENT,
      subject: 'App update subject en',
      headline: 'App update headline en',
      introBody: 'App update intro en',
    }

    const content = lang === FALLBACK_LANG
      ? defaultContent
      : normalizeAnnouncementContent({
        ...defaultContent,
        localizations: {
          [lang]: {
            subject: expectedSubject,
            headline: expectedHeadline,
            introBody: `App update intro ${lang}`,
          },
        },
      })

    const resolved = resolveAnnouncementContent(content, lang)
    const template = buildDynamicAppUpdateTemplate(content, lang)

    expect(resolved.lang).toBe(lang)
    expect(resolved.content.subject).toBe(expectedSubject)
    expect(resolved.content.headline).toBe(expectedHeadline)
    expect(template.subject).toBe(expectedSubject)
    expect(template.html).toContain(expectedHeadline)
  })

  it.each(nonFallbackLangs)('keeps editor state isolated for %s across template types', lang => {
    const localizedMarketing = setMarketingLocalizedField(DEFAULT_MARKETING_CAMPAIGN, lang as SupportedLang, 'subject', `Marketing ${lang}`)
    const localizedAnnouncement = setAnnouncementLocalizedField(DEFAULT_ANNOUNCEMENT, lang as SupportedLang, 'subject', `Announcement ${lang}`)

    expect(getMarketingEditorContent(localizedMarketing, lang).subject).toBe(`Marketing ${lang}`)
    expect(getAnnouncementEditorContent(localizedAnnouncement, lang).subject).toBe(`Announcement ${lang}`)
    expect(resolveMarketingContent(localizedMarketing, lang).content.subject).toBe(`Marketing ${lang}`)
    expect(resolveAnnouncementContent(localizedAnnouncement, lang).content.subject).toBe(`Announcement ${lang}`)
  })

  it.each(SUPPORTED_LANGS)('marketing editor and preview resolver use identical fallback semantics for %s', lang => {
    const content = {
      ...DEFAULT_MARKETING_CAMPAIGN,
      subject: 'Default marketing subject',
      headline: 'Default marketing headline',
      localizations: lang === FALLBACK_LANG
        ? {}
        : {
          [lang]: {
            subject: `Localized marketing subject ${lang}`,
            headline: '',
          },
        },
    }

    const editor = getMarketingEditorContent(content, lang)
    const resolved = resolveMarketingContent(content, lang).content
    const template = buildMarketingEmailTemplate(editor, lang)

    expect(editor.subject).toBe(resolved.subject)
    expect(editor.headline).toBe(resolved.headline)
    expect(template.subject).toBe(resolved.subject)
    expect(template.html).toContain(resolved.headline)
  })

  it.each(SUPPORTED_LANGS)('app update editor and preview resolver use identical fallback semantics for %s', lang => {
    const content = {
      ...DEFAULT_ANNOUNCEMENT,
      subject: 'Default announcement subject',
      headline: 'Default announcement headline',
      localizations: lang === FALLBACK_LANG
        ? {}
        : {
          [lang]: {
            subject: `Localized announcement subject ${lang}`,
            headline: '',
          },
        },
    }

    const editor = getAnnouncementEditorContent(content, lang)
    const resolved = resolveAnnouncementContent(content, lang).content
    const template = buildDynamicAppUpdateTemplate(editor, lang)

    expect(editor.subject).toBe(resolved.subject)
    expect(editor.headline).toBe(resolved.headline)
    expect(template.subject).toBe(resolved.subject)
    expect(template.html).toContain(resolved.headline)
  })

  it.each(nonFallbackLangs)('renders a fully localized marketing preview for %s without default English copy', lang => {
    const resolved = resolveMarketingContent(DEFAULT_MARKETING_CAMPAIGN, lang).content
    const template = buildMarketingEmailTemplate(resolved, lang)

    expect(template.html).toContain(resolved.headline)
    expect(template.html).toContain(resolved.introParagraph)
    expect(template.html).toContain(resolved.value1)
    expect(template.html).toContain(resolved.value2)
    expect(template.html).toContain(resolved.value3)
    expect(template.html).toContain(resolved.trustParagraph)
    expect(template.html).toContain(resolved.footerNote)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.headline)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.introParagraph)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.value1)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.value2)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.value3)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.trustParagraph)
    expect(template.html).not.toContain(DEFAULT_MARKETING_CAMPAIGN.footerNote)
  })

  it.each(nonFallbackLangs)('renders a fully localized app update preview for %s without default English copy', lang => {
    const resolved = resolveAnnouncementContent(DEFAULT_ANNOUNCEMENT, lang).content
    const template = buildDynamicAppUpdateTemplate(DEFAULT_ANNOUNCEMENT, lang)

    expect(template.html).toContain(resolved.headline)
    expect(template.html).toContain(resolved.introBody)
    expect(template.html).toContain(resolved.card1Title)
    expect(template.html).toContain(resolved.card1Description)
    expect(template.html).toContain(resolved.card2Title)
    expect(template.html).toContain(resolved.card2Description)
    expect(template.html).toContain(resolved.card3Title)
    expect(template.html).toContain(resolved.card3Description)
    expect(template.html).toContain(resolved.card4Title)
    expect(template.html).toContain(resolved.card4Description)
    expect(template.html).toContain(resolved.signatureLine)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.headline)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.introBody)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card1Title)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card1Description)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card2Title)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card2Description)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card3Title)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card3Description)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card4Title)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.card4Description)
    expect(template.html).not.toContain(DEFAULT_ANNOUNCEMENT.signatureLine)
  })
})
