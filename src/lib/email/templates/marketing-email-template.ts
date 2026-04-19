import { escHtml } from './template-utils'
import type { MarketingCampaignContent } from '../types/email-template.types'

export function buildMarketingEmailTemplate(c: MarketingCampaignContent): { html: string; text: string; subject: string } {
  const year    = new Date().getFullYear()
  const support = 'support@usedcarsdoctor.com'

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escHtml(c.headline)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#06070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#06070a;">
    ${escHtml(c.previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#06070a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,#00c2ff 0%,#7dd3fc 50%,#00c2ff 100%);border-radius:2px 2px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:linear-gradient(170deg,#0f1823 0%,#0a1018 100%);border:1px solid #1a2232;border-top:none;border-radius:0 0 24px 24px;padding:44px 48px 40px;">

              <!-- Brand (minimal — no icon) -->
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Used Cars Doctor</p>
              <p style="margin:0;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                <span style="color:#00c2ff;">Used Car</span> Inspector AI
              </p>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 32px;">
                <tr>
                  <td style="height:1px;background:#1a2232;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0 0 20px;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.8px;line-height:1.15;">
                ${escHtml(c.headline)}
              </h1>

              <!-- Intro paragraph -->
              <p style="margin:0 0 32px;font-size:16px;color:rgba(255,255,255,0.62);line-height:1.7;">
                ${escHtml(c.introParagraph)}
              </p>

              <!-- Primary CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:40px;">
                <tr>
                  <td style="border-radius:12px;background:#00c2ff;">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${c.ctaUrl}" style="height:54px;v-text-anchor:middle;width:260px;" arcsize="22%" strokecolor="#00c2ff" fillcolor="#00c2ff"><w:anchorlock/><center style="color:#000000;font-family:Arial,sans-serif;font-size:16px;font-weight:800;">${escHtml(c.ctaLabel)}</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${c.ctaUrl}" target="_blank" style="display:inline-block;padding:16px 42px;font-size:16px;font-weight:800;color:#000000;text-decoration:none;border-radius:12px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${escHtml(c.ctaLabel)}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Value block label -->
              <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);">What you get</p>

              <!-- Value items -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:36px;">
                <tr>
                  <td style="vertical-align:top;width:22px;font-size:16px;font-weight:800;color:#00c2ff;line-height:1.65;padding-top:1px;">✓</td>
                  <td style="font-size:15px;color:rgba(255,255,255,0.72);line-height:1.65;padding-left:12px;">${escHtml(c.value1)}</td>
                </tr>
                <tr><td colspan="2" style="height:12px;">&nbsp;</td></tr>
                <tr>
                  <td style="vertical-align:top;width:22px;font-size:16px;font-weight:800;color:#00c2ff;line-height:1.65;padding-top:1px;">✓</td>
                  <td style="font-size:15px;color:rgba(255,255,255,0.72);line-height:1.65;padding-left:12px;">${escHtml(c.value2)}</td>
                </tr>
                <tr><td colspan="2" style="height:12px;">&nbsp;</td></tr>
                <tr>
                  <td style="vertical-align:top;width:22px;font-size:16px;font-weight:800;color:#00c2ff;line-height:1.65;padding-top:1px;">✓</td>
                  <td style="font-size:15px;color:rgba(255,255,255,0.72);line-height:1.65;padding-left:12px;">${escHtml(c.value3)}</td>
                </tr>
              </table>

              <!-- Thin divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:28px;">
                <tr>
                  <td style="height:1px;background:rgba(255,255,255,0.07);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Trust paragraph -->
              <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.42);line-height:1.75;font-style:italic;">
                ${escHtml(c.trustParagraph)}
              </p>

              <!-- Secondary CTA (text link) -->
              <p style="margin:0 0 36px;font-size:14px;">
                <a href="${c.secondaryCtaUrl}" target="_blank" style="color:#00c2ff;text-decoration:none;font-weight:700;">${escHtml(c.secondaryCtaLabel)} →</a>
              </p>

              <!-- Bottom divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Footer note -->
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.22);line-height:1.6;">
                ${escHtml(c.footerNote)}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.16);">
                © ${year} Used Cars Doctor · AI-powered vehicle inspection
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.16);">
                Questions? <a href="mailto:${support}" style="color:rgba(0,194,255,0.35);text-decoration:none;">${support}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    c.headline,
    '',
    c.introParagraph,
    '',
    `${c.ctaLabel}: ${c.ctaUrl}`,
    '',
    '— What you get —',
    `✓ ${c.value1}`,
    `✓ ${c.value2}`,
    `✓ ${c.value3}`,
    '',
    c.trustParagraph,
    '',
    `${c.secondaryCtaLabel}: ${c.secondaryCtaUrl}`,
    '',
    '—',
    c.footerNote,
    '',
    `© ${year} Used Cars Doctor`,
    support,
  ].join('\n')

  return { html, text, subject: c.subject }
}
