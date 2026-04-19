import { buildBaseEmailTemplate } from './base-email-template'
import { escHtml, interpolate } from './template-utils'
import { getVerifyEmailStrings } from '@/lib/email/email-i18n'
import type { VerifyEmailTemplateProps } from '../types/email-template.types'

export function buildVerifyEmailTemplate(opts: VerifyEmailTemplateProps): { html: string; text: string; subject: string } {
  const { name, verifyUrl, lang, expiresInHours = 24 } = opts
  const s     = getVerifyEmailStrings(lang)
  const hours = String(expiresInHours)

  const bodyContent = [
    `<p style="margin:0 0 16px;">${interpolate(s.greeting, { name: escHtml(name) })}</p>`,
    `<p style="margin:0 0 16px;">${s.p1}</p>`,
    `<p style="margin:0 0 16px;">${interpolate(s.p2, { hours })}</p>`,
  ].join('\n    ')

  const html = buildBaseEmailTemplate({
    previewText: s.previewText,
    eyebrow:     s.eyebrow,
    headline:    s.headline,
    subheadline: s.subheadline,
    bodyContent,
    ctaLabel:    s.ctaLabel,
    ctaUrl:      verifyUrl,
    footnote:    s.footnote,
  })

  const text = interpolate(s.textBody, { name, url: verifyUrl, hours })

  return { html, text, subject: s.subject }
}
