// =============================================================================
// Base Email Template
// Premium dark automotive-tech layout, email-client safe.
// All styles are inline; no external CSS; tested across Gmail/Outlook/Apple Mail.
// =============================================================================

import { escHtml } from './template-utils'

export interface BaseTemplateOptions {
  previewText: string
  headline: string
  subheadline?: string
  bodyContent: string       // Inner HTML
  ctaLabel: string
  ctaUrl: string
  footnote?: string         // Security/ignore note
  supportEmail?: string
}

export function buildBaseTemplate(opts: BaseTemplateOptions): string {
  const support = opts.supportEmail ?? 'support@usedcarsdoctor.com'
  const year    = new Date().getFullYear()

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
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#080c14;">
    ${escHtml(opts.previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#080c14;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">

        <!-- Container card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Top accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#0891b2 0%,#22d3ee 50%,#0891b2 100%);height:3px;border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 16px 16px;padding:48px 48px 40px;">

              <!-- Brand -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:36px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Used Cars Doctor</p>
                    <p style="margin:0;font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;">
                      <span style="color:#22d3ee;">Used Car</span> Inspector AI
                    </p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <!-- Decorative icon -->
                    <div style="width:42px;height:42px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.18);border-radius:10px;display:inline-block;text-align:center;line-height:42px;font-size:20px;">🚗</div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.06);height:1px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                ${escHtml(opts.headline)}
              </h1>

              ${opts.subheadline ? `
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
                ${escHtml(opts.subheadline)}
              </p>` : ''}

              <!-- Body content -->
              <div style="margin-bottom:32px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
                ${opts.bodyContent}
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:11px;background:#22d3ee;">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${opts.ctaUrl}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="22%" strokecolor="#22d3ee" fillcolor="#22d3ee"><w:anchorlock/><center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:800;">${escHtml(opts.ctaLabel)}</center></v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:#000000;text-decoration:none;border-radius:11px;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${escHtml(opts.ctaLabel)}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Fallback plain link -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:9px;padding:14px 16px;">
                    <p style="margin:0 0 5px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:rgba(255,255,255,0.3);">
                      Button not working? Copy this link:
                    </p>
                    <p style="margin:0;font-size:12px;color:#22d3ee;word-break:break-all;line-height:1.5;">
                      <a href="${opts.ctaUrl}" target="_blank" style="color:#22d3ee;text-decoration:underline;">${opts.ctaUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.06);height:1px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              ${opts.footnote ? `
              <!-- Security note -->
              <p style="margin:0 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
                ${opts.footnote}
              </p>` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.2);">
                      © ${year} Used Cars Doctor · AI-powered vehicle inspection
                    </p>
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
                      Questions? <a href="mailto:${support}" style="color:rgba(34,211,238,0.5);text-decoration:none;">${support}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

