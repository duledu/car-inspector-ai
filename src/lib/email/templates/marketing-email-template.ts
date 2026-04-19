import { escHtml } from './template-utils'
import type { MarketingCampaignContent } from '../types/email-template.types'

export function buildMarketingEmailTemplate(
  c: MarketingCampaignContent,
  lang = 'en',
): { html: string; text: string; subject: string } {
  const year = new Date().getFullYear()
  const support = 'support@usedcarsdoctor.com'
  const safeCtaUrl = escHtml(c.ctaUrl)
  const safeSecondaryUrl = escHtml(c.secondaryCtaUrl)
  const labels = getMarketingTemplateLabels(lang)

  const html = `<!DOCTYPE html>
<html lang="${escHtml(lang)}" xmlns="http://www.w3.org/1999/xhtml">
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
  <style>
    @media only screen and (max-width: 620px) {
      .outer-pad { padding: 18px 12px 26px !important; }
      .card-pad { padding: 22px 20px 24px !important; border-radius: 0 0 18px 18px !important; }
      .brand-name { font-size: 15px !important; }
      .divider { margin: 18px 0 20px !important; }
      .headline { font-size: 25px !important; line-height: 1.16 !important; margin-bottom: 12px !important; }
      .intro { font-size: 15px !important; line-height: 1.55 !important; margin-bottom: 18px !important; }
      .cta-table { width: 100% !important; margin-bottom: 22px !important; }
      .cta-cell { display: block !important; width: 100% !important; }
      .cta-link { display: block !important; padding: 15px 16px !important; text-align: center !important; }
      .value-table { margin-bottom: 22px !important; }
      .footer-pad { padding-top: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#06070a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#06070a;">
    ${escHtml(c.previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#06070a;min-height:100vh;">
    <tr>
      <td class="outer-pad" align="center" style="padding:24px 16px 34px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="height:2px;background:#00c2ff;border-radius:2px 2px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td class="card-pad" style="background:linear-gradient(170deg,#0f1823 0%,#0a1018 100%);border:1px solid #1a2232;border-top:none;border-radius:0 0 22px 22px;padding:30px 34px 30px;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Used Cars Doctor</p>
              <p class="brand-name" style="margin:0;font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                <span style="color:#00c2ff;">Used Car</span> Inspector AI
              </p>

              <table class="divider" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:22px 0 24px;">
                <tr><td style="height:1px;background:#1a2232;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <h1 class="headline" style="margin:0 0 14px;font-size:29px;font-weight:800;color:#ffffff;letter-spacing:-0.7px;line-height:1.15;">
                ${escHtml(c.headline)}
              </h1>

              <p class="intro" style="margin:0 0 22px;font-size:16px;color:rgba(255,255,255,0.68);line-height:1.6;">
                ${escHtml(c.introParagraph)}
              </p>

              <table class="cta-table" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td class="cta-cell" style="border-radius:12px;background:#00c2ff;box-shadow:0 10px 26px rgba(0,194,255,0.16);">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeCtaUrl}" style="height:50px;v-text-anchor:middle;width:245px;" arcsize="22%" strokecolor="#00c2ff" fillcolor="#00c2ff"><w:anchorlock/><center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:800;">${escHtml(c.ctaLabel)}</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a class="cta-link" href="${safeCtaUrl}" target="_blank" style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:800;color:#000000;text-decoration:none;border-radius:12px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${escHtml(c.ctaLabel)}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);">${escHtml(labels.valueHeading)}</p>

              <table class="value-table" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:26px;">
                <tr>
                  <td style="vertical-align:top;width:20px;font-size:15px;font-weight:800;color:#00c2ff;line-height:1.5;padding-top:1px;">✓</td>
                  <td style="font-size:14px;color:rgba(255,255,255,0.74);line-height:1.5;padding-left:10px;">${escHtml(c.value1)}</td>
                </tr>
                <tr><td colspan="2" style="height:9px;">&nbsp;</td></tr>
                <tr>
                  <td style="vertical-align:top;width:20px;font-size:15px;font-weight:800;color:#00c2ff;line-height:1.5;padding-top:1px;">✓</td>
                  <td style="font-size:14px;color:rgba(255,255,255,0.74);line-height:1.5;padding-left:10px;">${escHtml(c.value2)}</td>
                </tr>
                <tr><td colspan="2" style="height:9px;">&nbsp;</td></tr>
                <tr>
                  <td style="vertical-align:top;width:20px;font-size:15px;font-weight:800;color:#00c2ff;line-height:1.5;padding-top:1px;">✓</td>
                  <td style="font-size:14px;color:rgba(255,255,255,0.74);line-height:1.5;padding-left:10px;">${escHtml(c.value3)}</td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:20px;">
                <tr><td style="height:1px;background:rgba(255,255,255,0.07);font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.48);line-height:1.6;font-style:italic;">
                ${escHtml(c.trustParagraph)}
              </p>

              <p style="margin:0 0 24px;font-size:14px;">
                <a href="${safeSecondaryUrl}" target="_blank" style="color:#00c2ff;text-decoration:none;font-weight:700;">${escHtml(c.secondaryCtaLabel)} →</a>
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
                <tr><td style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.22);line-height:1.6;">
                ${escHtml(c.footerNote)}
              </p>
            </td>
          </tr>

          <tr>
            <td class="footer-pad" style="padding:20px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.16);">
                © ${year} Used Cars Doctor · ${escHtml(labels.productLine)}
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.16);">
                ${escHtml(labels.questions)} <a href="mailto:${support}" style="color:rgba(0,194,255,0.35);text-decoration:none;">${support}</a>
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
    labels.valueHeading,
    `- ${c.value1}`,
    `- ${c.value2}`,
    `- ${c.value3}`,
    '',
    c.trustParagraph,
    '',
    `${c.secondaryCtaLabel}: ${c.secondaryCtaUrl}`,
    '',
    c.footerNote,
    '',
    `© ${year} Used Cars Doctor`,
    support,
  ].join('\n')

  return { html, text, subject: c.subject }
}

function getMarketingTemplateLabels(lang: string) {
  switch (lang) {
    case 'sr':
      return {
        valueHeading: 'Šta dobijate',
        productLine: 'AI pregled polovnih vozila',
        questions:   'Pitanja?',
      }
    case 'de':
      return {
        valueHeading: 'Was Sie bekommen',
        productLine: 'KI-gestützte Fahrzeugprüfung',
        questions:   'Fragen?',
      }
    case 'mk':
      return {
        valueHeading: 'Што добивате',
        productLine: 'AI проверка на возила',
        questions:   'Прашања?',
      }
    case 'sq':
      return {
        valueHeading: 'Çfarë përfitoni',
        productLine: 'Inspektim automjeti me AI',
        questions:   'Pyetje?',
      }
    default:
      return {
        valueHeading: 'What you get',
        productLine: 'AI-powered vehicle inspection',
        questions:   'Questions?',
      }
  }
}
