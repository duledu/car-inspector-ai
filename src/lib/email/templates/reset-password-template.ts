import { buildBaseEmailTemplate } from './base-email-template'
import { escHtml, interpolate } from './template-utils'
import { getResetPasswordStrings } from '@/lib/email/email-i18n'
import type { ResetPasswordTemplateProps } from '../types/email-template.types'

export function buildResetPasswordTemplate(opts: ResetPasswordTemplateProps): { html: string; text: string; subject: string } {
  const { name, resetUrl, lang, expiresInHours = 1 } = opts
  const s     = getResetPasswordStrings(lang)
  const hours = String(expiresInHours)

  const bodyContent = [
    `<p style="margin:0 0 16px;">${interpolate(s.greeting, { name: escHtml(name) })}</p>`,
    `<p style="margin:0 0 16px;">${s.p1}</p>`,
    `<p style="margin:0 0 16px;">${interpolate(s.p2, { hours })}</p>`,
    `<p style="margin:0;">${s.p3}</p>`,
  ].join('\n    ')

  const html = buildBaseEmailTemplate({
    previewText: s.previewText,
    eyebrow:     s.eyebrow,
    headline:    s.headline,
    subheadline: s.subheadline,
    bodyContent,
    ctaLabel:    s.ctaLabel,
    ctaUrl:      resetUrl,
    footnote:    s.footnote,
  })

  const text = interpolate(s.textBody, { name, url: resetUrl, hours })

  return { html, text, subject: s.subject }
}
