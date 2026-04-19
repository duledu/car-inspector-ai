import { escHtml } from './template-utils'
import type { BaseEmailTemplateProps, EmailCardItem } from '../types/email-template.types'

function getBaseLabels(lang?: string) {
  switch (lang) {
    case 'sr': return { buttonFallback: 'Dugme ne radi? Kopirajte ovaj link:', productLine: 'AI pregled polovnih vozila', questions: 'Pitanja?' }
    case 'de': return { buttonFallback: 'Schaltfläche funktioniert nicht? Kopieren Sie diesen Link:', productLine: 'KI-gestützte Fahrzeugprüfung', questions: 'Fragen?' }
    case 'mk': return { buttonFallback: 'Копчето не работи? Копирајте го овој линк:', productLine: 'AI проверка на возила', questions: 'Прашања?' }
    case 'sq': return { buttonFallback: 'Butoni nuk funksionon? Kopjojeni këtë lidhje:', productLine: 'Inspektim automjeti me AI', questions: 'Pyetje?' }
    default:   return { buttonFallback: 'Button not working? Copy this link:', productLine: 'AI-powered vehicle inspection', questions: 'Questions?' }
  }
}

export function buildBaseEmailTemplate(opts: BaseEmailTemplateProps): string {
  const support = opts.supportEmail ?? 'support@usedcarsdoctor.com'
  const year    = new Date().getFullYear()
  const labels  = getBaseLabels(opts.lang)

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escHtml(opts.headline)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#06070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#06070a;">
    ${escHtml(opts.previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#06070a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#00c2ff 0%,#7dd3fc 50%,#00c2ff 100%);border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background:linear-gradient(160deg,#111723 0%,#0b1018 100%);border:1px solid #1a2232;border-top:none;border-radius:0 0 24px 24px;padding:48px 48px 40px;">

              <!-- Brand header -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="vertical-align:middle;">
                    ${opts.eyebrow ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#00c2ff;">${escHtml(opts.eyebrow)}</p>` : ''}
                    <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.28);">Used Cars Doctor</p>
                    <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                      <span style="color:#00c2ff;">Used Car</span> Inspector AI
                    </p>
                  </td>
                  <td align="right" style="vertical-align:middle;width:41px;">
                    <img src="https://usedcarsdoctor.com/icons/logo_usedcarsdoctor_no_bg_newlast.svg" width="41" height="34" alt="" style="display:block;width:41px;height:34px;" />
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:36px;">
                <tr>
                  <td style="height:1px;background:#1a2232;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.6px;line-height:1.2;">
                ${escHtml(opts.headline)}
              </h1>

              ${opts.subheadline ? `
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.48);line-height:1.6;">
                ${escHtml(opts.subheadline)}
              </p>` : ''}

              <!-- Body content -->
              <div style="margin-bottom:32px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
                ${opts.bodyContent}
              </div>

              <!-- CTA button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="border-radius:12px;background:#00c2ff;">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${opts.ctaUrl}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="24%" strokecolor="#00c2ff" fillcolor="#00c2ff"><w:anchorlock/><center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:800;">${escHtml(opts.ctaLabel)}</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:#000000;text-decoration:none;border-radius:12px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${escHtml(opts.ctaLabel)}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Fallback plain link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:${opts.cards && opts.cards.length > 0 ? '36px' : '32px'};">
                <tr>
                  <td style="background:rgba(0,194,255,0.04);border:1px solid rgba(0,194,255,0.1);border-radius:10px;padding:14px 16px;">
                    <p style="margin:0 0 5px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:rgba(255,255,255,0.28);">
                      ${labels.buttonFallback}
                    </p>
                    <p style="margin:0;font-size:12px;color:#00c2ff;word-break:break-all;line-height:1.5;">
                      <a href="${opts.ctaUrl}" target="_blank" style="color:#00c2ff;text-decoration:underline;">${opts.ctaUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              ${opts.cards && opts.cards.length > 0 ? renderCards(opts.cards) : ''}

              ${renderSecondarySection(opts)}

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="height:1px;background:#1a2232;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              ${opts.footnote ? `
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.28);line-height:1.6;">
                ${opts.footnote}
              </p>` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.18);">
                © ${year} Used Cars Doctor · ${labels.productLine}
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);">
                ${labels.questions} <a href="mailto:${support}" style="color:rgba(0,194,255,0.4);text-decoration:none;">${support}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function renderSecondarySection(opts: BaseEmailTemplateProps): string {
  if (!opts.secondaryTitle && !opts.secondaryBody) return ''
  const titleHtml = opts.secondaryTitle
    ? `<h2 style="margin:0 0 10px;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${escHtml(opts.secondaryTitle)}</h2>`
    : ''
  const bodyHtml = opts.secondaryBody
    ? `<p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">${escHtml(opts.secondaryBody)}</p>`
    : ''
  const ctaHtml = (opts.secondaryCtaLabel && opts.secondaryCtaUrl)
    ? `<a href="${opts.secondaryCtaUrl}" target="_blank" style="display:inline-block;font-size:13px;font-weight:700;color:#00c2ff;text-decoration:none;">${escHtml(opts.secondaryCtaLabel)} →</a>`
    : ''
  return `
              <!-- Secondary section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="background:rgba(0,194,255,0.04);border:1px solid rgba(0,194,255,0.1);border-radius:14px;padding:24px 22px;">
                    ${titleHtml}
                    ${bodyHtml}
                    ${ctaHtml}
                  </td>
                </tr>
              </table>`
}

function renderCards(cards: EmailCardItem[]): string {
  const rows: string[] = []
  for (let i = 0; i < cards.length; i += 2) {
    const left  = cards[i]
    const right = cards[i + 1]
    rows.push(`
              <tr>
                <td width="48%" style="background:#0f1520;border:1px solid #1a2333;border-radius:16px;padding:20px 18px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;line-height:1;">${left.icon}</p>
                  <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:-0.1px;">${escHtml(left.title)}</p>
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.55;">${escHtml(left.description)}</p>
                </td>
                <td width="4%">&nbsp;</td>
                ${right ? `
                <td width="48%" style="background:#0f1520;border:1px solid #1a2333;border-radius:16px;padding:20px 18px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;line-height:1;">${right.icon}</p>
                  <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:-0.1px;">${escHtml(right.title)}</p>
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.55;">${escHtml(right.description)}</p>
                </td>` : '<td width="48%">&nbsp;</td>'}
              </tr>
              ${i + 2 < cards.length ? '<tr><td colspan="3" style="height:12px;">&nbsp;</td></tr>' : ''}`)
  }
  return `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
                ${rows.join('')}
              </table>`
}
