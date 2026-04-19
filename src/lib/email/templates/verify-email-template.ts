import { escHtml, interpolate } from './template-utils'
import { getVerifyEmailStrings } from '@/lib/email/email-i18n'
import type { VerifyEmailTemplateProps } from '../types/email-template.types'

export function buildVerifyEmailTemplate(opts: VerifyEmailTemplateProps): { html: string; text: string; subject: string } {
  const { name, verifyUrl, lang, expiresInHours = 24 } = opts
  const s     = getVerifyEmailStrings(lang)
  const hours = String(expiresInHours)

  const html = buildPremiumVerifyEmailHtml({
    previewText: s.previewText,
    eyebrow: s.eyebrow,
    headline: s.headline,
    subheadline: s.subheadline,
    greeting: interpolate(s.greeting, { name: escHtml(name) }),
    p1: s.p1,
    p2: interpolate(s.p2, { hours }),
    ctaLabel: s.ctaLabel,
    ctaUrl: verifyUrl,
    footnote: s.footnote,
  })

  const text = interpolate(s.textBody, { name, url: verifyUrl, hours })

  return { html, text, subject: s.subject }
}

interface PremiumVerifyEmailHtmlOptions {
  previewText: string
  eyebrow: string
  headline: string
  subheadline: string
  greeting: string
  p1: string
  p2: string
  ctaLabel: string
  ctaUrl: string
  footnote: string
}

function buildPremiumVerifyEmailHtml(opts: PremiumVerifyEmailHtmlOptions): string {
  const year = new Date().getFullYear()
  const safeUrl = escHtml(opts.ctaUrl)

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
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { padding: 18px 12px 28px !important; }
      .email-card { border-radius: 18px !important; }
      .email-body { padding: 30px 22px 28px !important; }
      .brand-row { padding-bottom: 24px !important; }
      .headline { font-size: 28px !important; line-height: 1.12 !important; letter-spacing: -0.7px !important; }
      .subheadline { font-size: 15px !important; line-height: 1.55 !important; margin-bottom: 26px !important; }
      .copy { font-size: 15px !important; line-height: 1.68 !important; }
      .cta-cell { display: block !important; width: 100% !important; }
      .cta-link { display: block !important; padding: 16px 18px !important; text-align: center !important; }
      .fallback-box { padding: 15px 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#06070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#06070a;">
    ${escHtml(opts.previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#06070a;">
    <tr>
      <td class="email-shell" align="center" style="padding:38px 16px 48px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;">
          <tr>
            <td class="email-card" style="background:#0d121c;border:1px solid #1b2535;border-radius:24px;overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:4px;background:#00c2ff;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td class="email-body" style="padding:46px 46px 38px;">

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="brand-row" style="padding-bottom:34px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#00c2ff;">${escHtml(opts.eyebrow)}</p>
                          <p style="margin:0;font-size:14px;font-weight:800;letter-spacing:-0.1px;color:#ffffff;">
                            <span style="color:#00c2ff;">Used Car</span> Inspector AI
                          </p>
                        </td>
                      </tr>
                    </table>

                    <h1 class="headline" style="margin:0 0 14px;font-size:34px;font-weight:850;color:#ffffff;letter-spacing:-0.95px;line-height:1.12;">
                      ${escHtml(opts.headline)}
                    </h1>

                    <p class="subheadline" style="margin:0 0 32px;font-size:16px;color:rgba(255,255,255,0.58);line-height:1.62;">
                      ${escHtml(opts.subheadline)}
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:30px;">
                      <tr>
                        <td style="height:1px;background:#1b2535;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>

                    <div class="copy" style="font-size:16px;color:rgba(255,255,255,0.76);line-height:1.72;">
                      <p style="margin:0 0 18px;color:#ffffff;font-weight:700;">${opts.greeting}</p>
                      <p style="margin:0 0 18px;">${escHtml(opts.p1)}</p>
                      <p style="margin:0;">${opts.p2}</p>
                    </div>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:34px 0 22px;">
                      <tr>
                        <td class="cta-cell" style="border-radius:14px;background:#00c2ff;box-shadow:0 10px 30px rgba(0,194,255,0.18);">
                          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:52px;v-text-anchor:middle;width:250px;" arcsize="20%" strokecolor="#00c2ff" fillcolor="#00c2ff"><w:anchorlock/><center style="color:#020617;font-family:Arial,sans-serif;font-size:15px;font-weight:800;">${escHtml(opts.ctaLabel)}</center></v:roundrect><![endif]-->
                          <!--[if !mso]><!-->
                          <a class="cta-link" href="${safeUrl}" target="_blank" style="display:inline-block;padding:16px 34px;font-size:15px;font-weight:850;color:#020617;text-decoration:none;border-radius:14px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                            ${escHtml(opts.ctaLabel)}
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:30px;">
                      <tr>
                        <td class="fallback-box" style="background:#0a0f18;border:1px solid #1b2535;border-radius:14px;padding:16px 18px;">
                          <p style="margin:0 0 7px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.36);">
                            Button not working?
                          </p>
                          <p style="margin:0;font-size:12px;color:#00c2ff;word-break:break-all;line-height:1.55;">
                            <a href="${safeUrl}" target="_blank" style="color:#00c2ff;text-decoration:underline;">${safeUrl}</a>
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.34);line-height:1.7;">
                      ${escHtml(opts.footnote)}
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 10px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.22);">
                &copy; ${year} Used Cars Doctor
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.22);">
                AI-powered vehicle inspection
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
