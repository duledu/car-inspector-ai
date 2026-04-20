import { FALLBACK_LANG, isSupportedLang, SUPPORTED_LANGS } from '@/i18n/shared'
import { DEFAULT_ANNOUNCEMENT, DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import { getAppUpdateStrings } from '@/lib/email/email-i18n'
import type {
  AppAnnouncementContent,
  AppAnnouncementLocalizedFields,
  MarketingCampaignContent,
  MarketingCampaignLocalizedFields,
} from './types/email-template.types'
import type { SupportedLang } from '@/i18n/shared'

export const ANNOUNCEMENT_LOCALIZED_KEYS: (keyof AppAnnouncementLocalizedFields)[] = [
  'subject',
  'previewText',
  'eyebrow',
  'headline',
  'subheadline',
  'introBody',
  'ctaLabel',
  'ctaUrl',
  'card1Icon',
  'card1Title',
  'card1Description',
  'card2Icon',
  'card2Title',
  'card2Description',
  'card3Icon',
  'card3Title',
  'card3Description',
  'card4Icon',
  'card4Title',
  'card4Description',
  'infoBlockTitle',
  'infoBlockBody',
  'secondaryTitle',
  'secondaryBody',
  'secondaryCtaLabel',
  'secondaryCtaUrl',
  'footnote',
  'footerLinkLabel',
  'footerLinkUrl',
  'signatureLine',
]

export const MARKETING_LOCALIZED_KEYS: (keyof MarketingCampaignLocalizedFields)[] = [
  'subject',
  'previewText',
  'headline',
  'introParagraph',
  'ctaLabel',
  'ctaUrl',
  'value1',
  'value2',
  'value3',
  'trustParagraph',
  'secondaryCtaLabel',
  'secondaryCtaUrl',
  'footerNote',
]

type LanguageDefaults<TFields extends Record<string, string>> = Partial<Record<SupportedLang, Partial<TFields>>>

const marketingLanguageDefaults: LanguageDefaults<MarketingCampaignLocalizedFields> = {
  en: {
    subject:           'Know before you buy.',
    previewText:       'Spot hidden car problems before you commit.',
    headline:          'Inspect before you buy.',
    introParagraph:    'Check VIN history, photos, and fraud signals before you meet the seller.',
    ctaLabel:          'Start a free inspection',
    value1:            'VIN and accident history checks',
    value2:            'AI photo review for hidden damage',
    value3:            'Fraud signals before you pay',
    trustParagraph:    'Used Cars Doctor helps buyers catch costly issues early, from accident history to odometer red flags.',
    secondaryCtaLabel: 'See how it works',
    footerNote:        'You are receiving this because you created an account with Used Car Inspector AI.',
  },
  sr: {
    subject:           'Proverite pre kupovine.',
    previewText:       'Uočite skrivene probleme pre nego što se obavežete.',
    headline:          'Pregled pre kupovine.',
    introParagraph:    'Proverite VIN istoriju, fotografije i signale prevare pre susreta sa prodavcem.',
    ctaLabel:          'Pokreni besplatan pregled',
    value1:            'Provera VIN-a i istorije nezgoda',
    value2:            'AI analiza fotografija za skrivenu štetu',
    value3:            'Signali prevare pre plaćanja',
    trustParagraph:    'Used Cars Doctor pomaže kupcima da ranije uoče skupe probleme, od istorije nezgoda do sumnjive kilometraže.',
    secondaryCtaLabel: 'Pogledajte kako radi',
    footerNote:        'Ovu poruku primate jer ste kreirali nalog na Used Car Inspector AI.',
  },
  de: {
    subject:           'Prüfen, bevor Sie kaufen.',
    previewText:       'Erkennen Sie versteckte Fahrzeugprobleme vor der Entscheidung.',
    headline:          'Erst prüfen, dann kaufen.',
    introParagraph:    'Prüfen Sie VIN-Historie, Fotos und Betrugssignale, bevor Sie den Verkäufer treffen.',
    ctaLabel:          'Kostenlose Prüfung starten',
    value1:            'VIN- und Unfallhistorie prüfen',
    value2:            'KI-Fotoprüfung für versteckte Schäden',
    value3:            'Betrugssignale vor der Zahlung',
    trustParagraph:    'Used Cars Doctor hilft Käufern, teure Probleme früh zu erkennen, von Unfallschäden bis zu Kilometerstand-Warnsignalen.',
    secondaryCtaLabel: 'So funktioniert es',
    footerNote:        'Sie erhalten diese E-Mail, weil Sie ein Konto bei Used Car Inspector AI erstellt haben.',
  },
  mk: {
    subject:           'Проверете пред да купите.',
    previewText:       'Откријте скриени проблеми пред да се обврзете.',
    headline:          'Проверка пред купување.',
    introParagraph:    'Проверете VIN историја, фотографии и сигнали за измама пред средба со продавачот.',
    ctaLabel:          'Започни бесплатна проверка',
    value1:            'Проверка на VIN и историја на незгоди',
    value2:            'AI анализа на фотографии за скриена штета',
    value3:            'Сигнали за измама пред плаќање',
    trustParagraph:    'Used Cars Doctor им помага на купувачите рано да откријат скапи проблеми, од незгоди до сомнителна километража.',
    secondaryCtaLabel: 'Погледнете како работи',
    footerNote:        'Оваа порака ја добивате затоа што креиравте налог на Used Car Inspector AI.',
  },
  sq: {
    subject:           'Kontrolloni para blerjes.',
    previewText:       'Zbuloni problemet e fshehura para se të vendosni.',
    headline:          'Inspektoni para blerjes.',
    introParagraph:    'Kontrolloni historikun VIN, fotot dhe sinjalet e mashtrimit para takimit me shitësin.',
    ctaLabel:          'Fillo inspektimin falas',
    value1:            'Kontroll i VIN-it dhe historikut të aksidenteve',
    value2:            'Analizë fotosh me AI për dëme të fshehura',
    value3:            'Sinjale mashtrimi para pagesës',
    trustParagraph:    'Used Cars Doctor ndihmon blerësit të kapin herët probleme të kushtueshme, nga aksidentet deri te kilometrazhi i dyshimtë.',
    secondaryCtaLabel: 'Shikoni si funksionon',
    footerNote:        'Po e merrni këtë email sepse keni krijuar llogari në Used Car Inspector AI.',
  },
}

const announcementBodyDefaults: LanguageDefaults<AppAnnouncementLocalizedFields> = {
  en: {
    introBody:         "We've been hard at work adding new features and polishing every corner of Used Car Inspector AI. Here's what's waiting for you.",
    card1Title:        'Deeper VIN Analysis',
    card1Description:  'More data sources cross-checked for every inspection.',
    card2Title:        'Enhanced Fraud Detection',
    card2Description:  'Smarter red flag identification across all listings.',
    card3Title:        'Richer Reports',
    card3Description:  'More detail and clearer formatting in every report.',
    card4Title:        'Faster Processing',
    card4Description:  'Full inspection results delivered in seconds.',
    signatureLine:     '— The Used Cars Doctor Team',
  },
  sr: {
    introBody:         'Vredno smo radili na dodavanju novih funkcija i doterivanju svakog dela Used Car Inspector AI. Evo šta vas čeka.',
    card1Title:        'Detaljnija VIN analiza',
    card1Description:  'Više izvora podataka se unakrsno proverava za svaku inspekciju.',
    card2Title:        'Poboljšano otkrivanje prevara',
    card2Description:  'Pametnije prepoznavanje upozorenja u svim oglasima.',
    card3Title:        'Bogatiji izveštaji',
    card3Description:  'Više detalja i jasnije formatiranje u svakom izveštaju.',
    card4Title:        'Brža obrada',
    card4Description:  'Kompletni rezultati inspekcije stižu za nekoliko sekundi.',
    signatureLine:     '— Tim Used Cars Doctor',
  },
  de: {
    introBody:         'Wir haben intensiv daran gearbeitet, neue Funktionen hinzuzufügen und jeden Bereich von Used Car Inspector AI zu verbessern. Das wartet auf Sie.',
    card1Title:        'Tiefere VIN-Analyse',
    card1Description:  'Mehr Datenquellen werden für jede Inspektion gegengeprüft.',
    card2Title:        'Verbesserte Betrugserkennung',
    card2Description:  'Intelligentere Erkennung von Warnsignalen in allen Inseraten.',
    card3Title:        'Umfangreichere Berichte',
    card3Description:  'Mehr Details und klarere Formatierung in jedem Bericht.',
    card4Title:        'Schnellere Verarbeitung',
    card4Description:  'Vollständige Inspektionsergebnisse werden in Sekunden geliefert.',
    signatureLine:     '— Das Used Cars Doctor Team',
  },
  mk: {
    introBody:         'Вредно работевме на додавање нови функции и полирање на секој дел од Used Car Inspector AI. Еве што ве очекува.',
    card1Title:        'Подлабока VIN анализа',
    card1Description:  'Повеќе извори на податоци се вкрстено проверуваат за секоја инспекција.',
    card2Title:        'Подобрено откривање измами',
    card2Description:  'Попаметно препознавање предупредувачки знаци низ сите огласи.',
    card3Title:        'Побогати извештаи',
    card3Description:  'Повеќе детали и појасно форматирање во секој извештај.',
    card4Title:        'Побрза обработка',
    card4Description:  'Целосни резултати од инспекцијата се доставуваат за неколку секунди.',
    signatureLine:     '— Тимот на Used Cars Doctor',
  },
  sq: {
    introBody:         'Kemi punuar shumë për të shtuar funksione të reja dhe për të përmirësuar çdo pjesë të Used Car Inspector AI. Ja çfarë ju pret.',
    card1Title:        'Analizë më e thellë e VIN-it',
    card1Description:  'Më shumë burime të dhënash kontrollohen për çdo inspektim.',
    card2Title:        'Zbulim i përmirësuar i mashtrimit',
    card2Description:  'Identifikim më i zgjuar i sinjaleve paralajmëruese në të gjitha shpalljet.',
    card3Title:        'Raporte më të pasura',
    card3Description:  'Më shumë detaje dhe formatim më i qartë në çdo raport.',
    card4Title:        'Përpunim më i shpejtë',
    card4Description:  'Rezultatet e plota të inspektimit dorëzohen brenda sekondave.',
    signatureLine:     '— Ekipi i Used Cars Doctor',
  },
}

function getAnnouncementLanguageDefaults(lang: SupportedLang): Partial<AppAnnouncementLocalizedFields> {
  const strings = getAppUpdateStrings(lang)
  return {
    ...announcementBodyDefaults[lang],
    subject:     strings.subject,
    previewText: strings.previewText,
    eyebrow:     strings.eyebrow,
    headline:    strings.headline,
    subheadline: strings.subheadline,
    ctaLabel:    strings.ctaLabel,
  }
}

export function resolveEmailTemplateLang(raw: string | null | undefined): SupportedLang {
  return isSupportedLang(raw) ? raw : FALLBACK_LANG
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function sanitizeLocalizations<T extends Record<string, string>>(
  raw: unknown,
  keys: (keyof T)[],
): Partial<Record<SupportedLang, Partial<T>>> {
  const source = readObject(raw)
  const localizations: Partial<Record<SupportedLang, Partial<T>>> = {}

  for (const lang of SUPPORTED_LANGS) {
    const langSource = readObject(source[lang])
    const cleaned: Partial<T> = {}

    for (const key of keys) {
      const value = langSource[String(key)]
      if (hasText(value)) {
        cleaned[key] = value as T[keyof T]
      }
    }

    if (Object.keys(cleaned).length > 0) {
      localizations[lang] = cleaned
    }
  }

  return localizations
}

function normalizeContent<TContent extends { localizations?: unknown }, TFields extends Record<string, string>>(
  defaults: TContent,
  raw: unknown,
  keys: (keyof TFields)[],
): TContent {
  const source = readObject(raw)
  return {
    ...defaults,
    ...source,
    localizations: sanitizeLocalizations<TFields>(source.localizations, keys),
  }
}

function resolveContent<TContent extends { localizations?: Partial<Record<SupportedLang, Partial<TFields>>> }, TFields extends Record<string, string>>(
  content: TContent,
  rawLang: string | null | undefined,
  keys: (keyof TFields)[],
  getLanguageDefaults?: (lang: SupportedLang) => Partial<TFields>,
): { content: TContent; lang: SupportedLang } {
  const lang = resolveEmailTemplateLang(rawLang)
  const localized = content.localizations?.[lang]

  if (lang === FALLBACK_LANG) {
    return { content, lang }
  }

  const resolved: TContent = { ...content }
  const resolvedFields = resolved as unknown as Record<string, string>
  const languageDefaults: Partial<TFields> = getLanguageDefaults?.(lang) ?? {}

  for (const key of keys) {
    const languageDefault = languageDefaults[key]
    if (hasText(languageDefault)) {
      resolvedFields[String(key)] = languageDefault
    }
  }

  for (const key of keys) {
    const localizedValue = localized?.[key]
    if (hasText(localizedValue)) {
      resolvedFields[String(key)] = localizedValue
    }
  }

  return { content: resolved, lang }
}

function getEditorContent<TContent extends { localizations?: Partial<Record<SupportedLang, Partial<TFields>>> }, TFields extends Record<string, string>>(
  content: TContent,
  rawLang: string | null | undefined,
  keys: (keyof TFields)[],
  getLanguageDefaults?: (lang: SupportedLang) => Partial<TFields>,
): TContent {
  return resolveContent(content, rawLang, keys, getLanguageDefaults).content
}

function setLocalizedField<TContent extends { localizations?: Partial<Record<SupportedLang, Partial<TFields>>> }, TFields extends Record<string, string>>(
  content: TContent,
  rawLang: string | null | undefined,
  key: keyof TFields,
  value: string,
): TContent {
  const lang = resolveEmailTemplateLang(rawLang)
  if (lang === FALLBACK_LANG) {
    return { ...content, [key]: value }
  }

  return {
    ...content,
    localizations: {
      ...content.localizations,
      [lang]: {
        ...content.localizations?.[lang],
        [key]: value,
      },
    },
  }
}

export function normalizeAnnouncementContent(raw: unknown): AppAnnouncementContent {
  return normalizeContent<AppAnnouncementContent, AppAnnouncementLocalizedFields>(
    DEFAULT_ANNOUNCEMENT,
    raw,
    ANNOUNCEMENT_LOCALIZED_KEYS,
  )
}

export function normalizeMarketingContent(raw: unknown): MarketingCampaignContent {
  return normalizeContent<MarketingCampaignContent, MarketingCampaignLocalizedFields>(
    DEFAULT_MARKETING_CAMPAIGN,
    raw,
    MARKETING_LOCALIZED_KEYS,
  )
}

export function resolveAnnouncementContent(content: AppAnnouncementContent, rawLang: string | null | undefined) {
  return resolveContent<AppAnnouncementContent, AppAnnouncementLocalizedFields>(
    content,
    rawLang,
    ANNOUNCEMENT_LOCALIZED_KEYS,
    getAnnouncementLanguageDefaults,
  )
}

export function resolveMarketingContent(content: MarketingCampaignContent, rawLang: string | null | undefined) {
  return resolveContent<MarketingCampaignContent, MarketingCampaignLocalizedFields>(
    content,
    rawLang,
    MARKETING_LOCALIZED_KEYS,
    lang => marketingLanguageDefaults[lang] ?? {},
  )
}

export function getAnnouncementEditorContent(content: AppAnnouncementContent, rawLang: string | null | undefined) {
  return getEditorContent<AppAnnouncementContent, AppAnnouncementLocalizedFields>(
    content,
    rawLang,
    ANNOUNCEMENT_LOCALIZED_KEYS,
    getAnnouncementLanguageDefaults,
  )
}

export function getMarketingEditorContent(content: MarketingCampaignContent, rawLang: string | null | undefined) {
  return getEditorContent<MarketingCampaignContent, MarketingCampaignLocalizedFields>(
    content,
    rawLang,
    MARKETING_LOCALIZED_KEYS,
    lang => marketingLanguageDefaults[lang] ?? {},
  )
}

export function setAnnouncementLocalizedField(
  content: AppAnnouncementContent,
  rawLang: string | null | undefined,
  key: keyof AppAnnouncementLocalizedFields,
  value: string,
) {
  return setLocalizedField<AppAnnouncementContent, AppAnnouncementLocalizedFields>(content, rawLang, key, value)
}

export function setMarketingLocalizedField(
  content: MarketingCampaignContent,
  rawLang: string | null | undefined,
  key: keyof MarketingCampaignLocalizedFields,
  value: string,
) {
  return setLocalizedField<MarketingCampaignContent, MarketingCampaignLocalizedFields>(content, rawLang, key, value)
}
