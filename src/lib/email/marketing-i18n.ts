import { FALLBACK_LANG, isSupportedLang } from '@/i18n/shared'
import type { SupportedLang } from '@/i18n/shared'
import type { MarketingCampaignContent } from './types/email-template.types'

export function resolveMarketingLang(raw: string | null | undefined): SupportedLang {
  return isSupportedLang(raw) ? raw : FALLBACK_LANG
}

type MarketingStrings = Omit<MarketingCampaignContent, 'campaignName' | 'ctaUrl' | 'secondaryCtaUrl'>

const marketingTranslations: Record<SupportedLang, MarketingStrings> = {
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

export function localizeMarketingContent(
  base: MarketingCampaignContent,
  rawLang: string | null | undefined,
): { content: MarketingCampaignContent; lang: SupportedLang } {
  const lang     = resolveMarketingLang(rawLang)
  const defaults = marketingTranslations[lang]

  return {
    lang,
    content: {
      campaignName:      base.campaignName,
      subject:           base.subject           || defaults.subject,
      previewText:       base.previewText        || defaults.previewText,
      headline:          base.headline           || defaults.headline,
      introParagraph:    base.introParagraph     || defaults.introParagraph,
      ctaLabel:          base.ctaLabel           || defaults.ctaLabel,
      ctaUrl:            base.ctaUrl,
      value1:            base.value1             || defaults.value1,
      value2:            base.value2             || defaults.value2,
      value3:            base.value3             || defaults.value3,
      trustParagraph:    base.trustParagraph     || defaults.trustParagraph,
      secondaryCtaLabel: base.secondaryCtaLabel  || defaults.secondaryCtaLabel,
      secondaryCtaUrl:   base.secondaryCtaUrl,
      footerNote:        base.footerNote         || defaults.footerNote,
    },
  }
}
