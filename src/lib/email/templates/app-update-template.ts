import { buildBaseEmailTemplate } from './base-email-template'
import { escHtml, interpolate } from './template-utils'
import { getAppUpdateStrings } from '@/lib/email/email-i18n'
import { resolveAnnouncementContent } from '@/lib/email/localized-template-content'
import type { AppUpdateTemplateProps, AppAnnouncementContent, EmailCardItem } from '../types/email-template.types'

const UPDATE_CARDS: EmailCardItem[] = [
  { icon: '🔍', title: 'Deeper VIN Analysis', description: 'More data sources cross-checked for every inspection.' },
  { icon: '🛡️', title: 'Enhanced Fraud Detection', description: 'Smarter red flag identification across all listings.' },
  { icon: '📊', title: 'Richer Reports', description: 'More detail and clearer formatting in every report.' },
  { icon: '⚡', title: 'Faster Processing', description: 'Full inspection results delivered in seconds.' },
]

function getAppUpdateBody(lang: string): string {
  switch (lang) {
    case 'sr':
      return 'Vredno smo radili na dodavanju novih funkcija i doterivanju svakog dela Used Car Inspector AI. Evo šta vas čeka.'
    case 'de':
      return 'Wir haben intensiv daran gearbeitet, neue Funktionen hinzuzufügen und jeden Bereich von Used Car Inspector AI zu verbessern. Das wartet auf Sie.'
    case 'mk':
      return 'Вредно работевме на додавање нови функции и полирање на секој дел од Used Car Inspector AI. Еве што ве очекува.'
    case 'sq':
      return 'Kemi punuar shumë për të shtuar funksione të reja dhe për të përmirësuar çdo pjesë të Used Car Inspector AI. Ja çfarë ju pret.'
    case 'bg':
      return 'Работихме усилено, за да добавим нови функции и да подобрим всеки аспект на Used Car Inspector AI. Ето какво ви очаква.'
    default:
      return "We've been hard at work adding new features and polishing every corner of Used Car Inspector AI. Here's what's waiting for you."
  }
}

function getHighlightsLabel(lang: string): string {
  switch (lang) {
    case 'sr': return 'Izdvojeno:'
    case 'de': return 'Highlights:'
    case 'mk': return 'Издвоено:'
    case 'sq': return 'Pikat kryesore:'
    case 'bg': return 'Акценти:'
    default: return 'Highlights:'
  }
}

export function buildAppUpdateTemplate(opts: AppUpdateTemplateProps): { html: string; text: string; subject: string } {
  const s = getAppUpdateStrings(opts.lang)
  const ctaUrl = opts.ctaUrl
  const previewText = opts.previewText ?? s.previewText
  const bodyContent = `<p style="margin:0 0 16px;">${escHtml(getAppUpdateBody(opts.lang ?? 'en'))}</p>`

  const html = buildBaseEmailTemplate({
    previewText,
    eyebrow: s.eyebrow,
    headline: s.headline,
    subheadline: s.subheadline,
    bodyContent,
    ctaLabel: s.ctaLabel,
    ctaUrl,
    cards: UPDATE_CARDS,
    lang: opts.lang ?? undefined,
  })

  const text = interpolate(s.textBody, { url: ctaUrl })
  return { html, text, subject: s.subject }
}

export function buildDynamicAppUpdateTemplate(content: AppAnnouncementContent, lang?: string): { html: string; text: string; subject: string } {
  const localized = resolveAnnouncementContent(content, lang)
  content = localized.content
  lang = localized.lang

  const cards: EmailCardItem[] = [
    { icon: content.card1Icon, title: content.card1Title, description: content.card1Description },
    { icon: content.card2Icon, title: content.card2Title, description: content.card2Description },
    { icon: content.card3Icon, title: content.card3Title, description: content.card3Description },
    { icon: content.card4Icon, title: content.card4Title, description: content.card4Description },
  ].filter(c => c.title || c.description)

  const bodyParts: string[] = []
  if (content.introBody) {
    bodyParts.push(`<p style="margin:0 0 16px;">${escHtml(content.introBody)}</p>`)
  }
  if (content.infoBlockTitle) {
    bodyParts.push(`<p style="margin:16px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.45);">${escHtml(content.infoBlockTitle)}</p>`)
  }
  if (content.infoBlockBody) {
    bodyParts.push(`<p style="margin:0 0 16px;">${escHtml(content.infoBlockBody)}</p>`)
  }
  if (content.signatureLine) {
    bodyParts.push(`<p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.35);">${escHtml(content.signatureLine)}</p>`)
  }

  const html = buildBaseEmailTemplate({
    previewText: content.previewText,
    eyebrow: content.eyebrow || undefined,
    headline: content.headline,
    subheadline: content.subheadline || undefined,
    bodyContent: bodyParts.join('\n'),
    ctaLabel: content.ctaLabel,
    ctaUrl: content.ctaUrl,
    lang,
    cards: cards.length > 0 ? cards : undefined,
    footnote: content.footnote || undefined,
    secondaryTitle: content.secondaryTitle || undefined,
    secondaryBody: content.secondaryBody || undefined,
    secondaryCtaLabel: content.secondaryCtaLabel || undefined,
    secondaryCtaUrl: content.secondaryCtaUrl || undefined,
  })

  const textLines: string[] = [
    content.headline,
    '',
    content.introBody,
  ]
  if (cards.length > 0) {
    textLines.push('', getHighlightsLabel(lang))
    cards.forEach(c => textLines.push(`• ${c.title}: ${c.description}`))
  }
  if (content.secondaryTitle) {
    textLines.push('', content.secondaryTitle)
    if (content.secondaryBody) textLines.push(content.secondaryBody)
    if (content.secondaryCtaLabel && content.secondaryCtaUrl) {
      textLines.push(`${content.secondaryCtaLabel}: ${content.secondaryCtaUrl}`)
    }
  }
  textLines.push('', `${content.ctaLabel}: ${content.ctaUrl}`)
  if (content.signatureLine) textLines.push('', content.signatureLine)

  return { html, text: textLines.join('\n'), subject: content.subject }
}
