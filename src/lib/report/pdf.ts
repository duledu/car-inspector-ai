import path from 'node:path'
import pdfMake from 'pdfmake'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { createPdfTranslator, normalizePdfLocale, type PdfTranslate } from '@/lib/report/i18n'
import type {
  AIFinding,
  ChecklistItem,
  RiskScore,
  Vehicle,
  VehicleResearchResult,
} from '@/types'

type PdfPhotoDraft = {
  key: string
  label: string
  thumbUrl: string
}

type PdfReportInput = {
  vehicle: Vehicle
  score: RiskScore
  research: VehicleResearchResult
  findings: AIFinding[]
  checklistItems: ChecklistItem[]
  photos: PdfPhotoDraft[]
  generatedAt: Date
  locale: string
}

const fontBase = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto')

pdfMake.addFonts({
  Roboto: {
    normal: path.join(fontBase, 'Roboto-Regular.ttf'),
    bold: path.join(fontBase, 'Roboto-Medium.ttf'),
    italics: path.join(fontBase, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontBase, 'Roboto-MediumItalic.ttf'),
  },
})
;(pdfMake as unknown as { setUrlAccessPolicy?: (policy: (url: string) => boolean) => void })
  .setUrlAccessPolicy?.(() => false)

const verdictColor: Record<RiskScore['verdict'], string> = {
  STRONG_BUY: '#059669',
  BUY_WITH_CAUTION: '#d97706',
  HIGH_RISK: '#dc2626',
  WALK_AWAY: '#7f1d1d',
}

const severityColor: Record<AIFinding['severity'], string> = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
}

const BRAND = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  cyan: '#0891b2',
  cyanSoft: '#e6f9fc',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  line: '#dbeafe',
  panel: '#f8fafc',
}

function text(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function vehicleTitle(vehicle: Vehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

function engineLine(vehicle: Vehicle, t: PdfTranslate): string {
  const parts = [
    vehicle.engineCc ? `${vehicle.engineCc} cc` : null,
    vehicle.powerKw ? `${vehicle.powerKw} kW` : null,
    vehicle.fuelType ? text(vehicle.fuelType, '') : null,
    vehicle.transmission ? text(vehicle.transmission, '') : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : t('pdf.engineUnavailable')
}

function formatDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function formatMoney(amount: number | null | undefined, currency = 'EUR', locale = 'en', fallback: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return fallback
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString('en')} ${currency}`
  }
}

function uniqueStrings(values: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw?.trim()
    if (!value || value.length < 4) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}

function isGenericFinding(finding: AIFinding): boolean {
  const combined = `${finding.title} ${finding.description}`.toLowerCase()
  if (combined.length < 12) return true
  return [
    'no ai findings',
    'photos appear clean',
    'no visual anomalies',
    'analysis unavailable',
    'could not be analyzed',
    'image could not be analyzed',
    'no issue detected',
    'no issues detected',
  ].some(marker => combined.includes(marker))
}

function meaningfulFindings(findings: AIFinding[]): AIFinding[] {
  const seen = new Set<string>()
  const ranked = [...findings]
    .filter(f => !isGenericFinding(f))
    .filter(f => f.confidence >= 45 || f.severity !== 'info')
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 }
      return rank[a.severity] - rank[b.severity] || b.confidence - a.confidence
    })

  return ranked.filter(f => {
    const key = `${f.area}|${f.title}|${f.description}`.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

function issueRows(items: VehicleResearchResult['sections']['commonProblems']['items'], t: PdfTranslate, limit = 6): Content[] {
  return items.slice(0, limit).map(issue => ({
    margin: [0, 0, 0, 9],
    table: {
      widths: [74, '*'],
      body: [[
        {
          text: t(`pdf.issueSeverity.${issue.severity}`),
          style: 'pill',
          color: issue.severity === 'high' ? BRAND.red : issue.severity === 'medium' ? BRAND.amber : BRAND.cyan,
          fillColor: issue.severity === 'high' ? '#fee2e2' : issue.severity === 'medium' ? '#fef3c7' : BRAND.cyanSoft,
          margin: [7, 5, 7, 5],
        },
        {
          stack: [
            { text: issue.title, style: 'itemTitle' },
            { text: issue.description, style: 'body', margin: [0, 2, 0, 0] },
          ],
          margin: [10, 7, 10, 7],
        },
      ]],
    },
    layout: {
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      fillColor: () => '#ffffff',
    },
  }))
}

function bulletList(items: string[], fallback: string): Content {
  return {
    ul: items.length ? items : [fallback],
    style: 'body',
    margin: [0, 4, 0, 0],
  }
}

function section(title: string, body: Content | Content[]): Content {
  return {
    margin: [0, 0, 0, 20],
    stack: [
      {
        columns: [
          { width: 5, canvas: [{ type: 'rect', x: 0, y: 2, w: 5, h: 16, r: 2, color: BRAND.cyan }] },
          { width: '*', text: title, style: 'sectionTitle', margin: [8, 0, 0, 9] },
        ],
      },
      ...(Array.isArray(body) ? body : [body]),
    ],
  }
}

function safePhotoImages(photos: PdfPhotoDraft[]): Content[] {
  return photos
    .filter(photo => /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photo.thumbUrl))
    .slice(0, 6)
    .map(photo => ({
      margin: [0, 0, 10, 12],
      stack: [
        {
          image: photo.thumbUrl,
          width: 150,
          height: 96,
          fit: [150, 96],
          alignment: 'center',
        },
        { text: photo.label || photo.key, style: 'caption', alignment: 'center', margin: [0, 5, 0, 0] },
      ],
    }))
}

function photoGrid(photos: PdfPhotoDraft[]): Content | null {
  const images = safePhotoImages(photos)
  if (images.length === 0) return null
  const rows: Content[][] = []
  for (let i = 0; i < images.length; i += 3) {
    rows.push([images[i], images[i + 1] ?? { text: '' }, images[i + 2] ?? { text: '' }])
  }
  return {
    margin: [0, 0, 0, 8],
    table: {
      widths: ['*', '*', '*'],
      body: rows,
    },
    layout: 'noBorders',
  }
}

function scoreGauge(score: number, color: string): Content {
  const width = 190
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)))
  return {
    stack: [
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: width, h: 10, r: 5, color: '#e5e7eb' },
          { type: 'rect', x: 0, y: 0, w: filled, h: 10, r: 5, color },
        ],
      },
      {
        columns: [
          { text: '0', style: 'caption' },
          { text: '100', style: 'caption', alignment: 'right' },
        ],
        margin: [0, 4, 0, 0],
      },
    ],
  }
}

function dimensionBars(score: RiskScore, t: PdfTranslate): Content {
  const items = [
    ['ai', score.dimensions.ai.score],
    ['exterior', score.dimensions.exterior.score],
    ['interior', score.dimensions.interior.score],
    ['mechanical', score.dimensions.mechanical.score],
    ['documents', score.dimensions.documents.score],
    ['testDrive', score.dimensions.testDrive.score],
  ] as const
  return {
    margin: [0, 8, 0, 0],
    table: {
      widths: [78, '*', 28],
      body: items.map(([key, value]) => [
        { text: t(`dim.${key}`), style: 'caption', margin: [0, 3, 6, 3] },
        {
          canvas: [
            { type: 'rect', x: 0, y: 4, w: 190, h: 7, r: 4, color: '#e5e7eb' },
            { type: 'rect', x: 0, y: 4, w: Math.round((Math.max(0, Math.min(100, value)) / 100) * 190), h: 7, r: 4, color: value >= 75 ? BRAND.green : value >= 55 ? BRAND.amber : BRAND.red },
          ],
        },
        { text: String(value), style: 'caption', bold: true, alignment: 'right', margin: [0, 2, 0, 0] },
      ]),
    },
    layout: 'noBorders',
  }
}

function severityDistribution(findings: AIFinding[], t: PdfTranslate): Content {
  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    warning: findings.filter(f => f.severity === 'warning').length,
    info: findings.filter(f => f.severity === 'info').length,
  }
  const total = Math.max(1, counts.critical + counts.warning + counts.info)
  const width = 220
  let offset = 0
  const segments = ([
    ['critical', counts.critical, BRAND.red],
    ['warning', counts.warning, BRAND.amber],
    ['info', counts.info, BRAND.cyan],
  ] as const).map(([key, count, color]) => {
    const w = count === 0 ? 0 : Math.max(12, Math.round((count / total) * width))
    const seg = { type: 'rect' as const, x: offset, y: 0, w, h: 10, r: 5, color }
    offset += w
    return seg
  }).filter(seg => seg.w > 0)

  return {
    margin: [0, 4, 0, 10],
    stack: [
      { text: t('pdf.findingsDistribution'), style: 'itemTitle', margin: [0, 0, 0, 6] },
      { canvas: segments.length ? segments : [{ type: 'rect', x: 0, y: 0, w: width, h: 10, r: 5, color: '#e5e7eb' }] },
      {
        margin: [0, 7, 0, 0],
        columns: [
          { text: `${t('pdf.severity.critical')}: ${counts.critical}`, style: 'caption', color: BRAND.red },
          { text: `${t('pdf.severity.warning')}: ${counts.warning}`, style: 'caption', color: BRAND.amber },
          { text: `${t('pdf.severity.info')}: ${counts.info}`, style: 'caption', color: BRAND.cyan },
        ],
      },
    ],
  }
}

function createDocDefinition(input: PdfReportInput): TDocumentDefinitions {
  const { vehicle, score, research, checklistItems, photos, generatedAt, locale } = input
  const lang = normalizePdfLocale(locale)
  const t = createPdfTranslator(lang)
  const findings = meaningfulFindings(input.findings)
  const mainPhoto = safePhotoImages(photos)[0] ?? null
  const embeddedPhotoGrid = photoGrid(photos)
  const knownIssues = [
    ...research.sections.commonProblems.items,
    ...research.sections.mechanicalWatchouts.items,
    ...research.sections.visualAttention.items,
  ]
  const priorityChecks = uniqueStrings([
    ...research.sections.highPriorityChecks.items.map(i => `${i.title}: ${i.description}`),
    ...research.sections.testDriveFocus.items.map(i => `${i.title}: ${i.description}`),
    ...checklistItems
      .filter(i => i.status === 'WARNING' || i.status === 'PROBLEM')
      .map(i => `${i.itemLabel}${i.notes ? `: ${i.notes}` : ''}`),
    ...score.negotiationHints,
  ], 9)
  const summary = uniqueStrings([
    research.summary,
    ...score.reasonsAgainst,
    ...score.reasonsFor,
  ], 4)

  return {
    pageSize: 'A4',
    pageMargins: [42, 48, 42, 54],
    info: {
      title: `Used Cars Doctor AI - ${vehicleTitle(vehicle)}`,
      author: 'Used Cars Doctor AI',
      subject: t('pdf.metadata.subject'),
    },
    defaultStyle: {
      font: 'Roboto',
      color: '#172033',
      fontSize: 10,
      lineHeight: 1.35,
    },
    styles: {
      brand: { fontSize: 12, bold: true, color: '#0f172a', characterSpacing: 1.8 },
      coverTitle: { fontSize: 29, bold: true, color: BRAND.ink, lineHeight: 1.08 },
      coverSubtitle: { fontSize: 11, color: '#64748b', characterSpacing: 1.2 },
      sectionTitle: { fontSize: 13, bold: true, color: BRAND.ink, margin: [0, 0, 0, 9] },
      score: { fontSize: 40, bold: true, color: verdictColor[score.verdict] },
      badge: { fontSize: 8, bold: true, characterSpacing: 0.7 },
      pill: { fontSize: 8, bold: true, characterSpacing: 0.4, alignment: 'center' },
      itemTitle: { fontSize: 10.5, bold: true, color: '#111827' },
      body: { fontSize: 9.5, color: BRAND.body, lineHeight: 1.38 },
      caption: { fontSize: 8, color: BRAND.muted },
      muted: { fontSize: 9, color: BRAND.muted },
    },
    footer: (currentPage, pageCount) => ({
      margin: [42, 0],
      columns: [
        { text: 'Used Cars Doctor AI', style: 'caption' },
        { text: `${currentPage} / ${pageCount}`, style: 'caption', alignment: 'right' },
      ],
    }),
    content: [
      {
        canvas: [
          { type: 'rect', x: -42, y: -48, w: 595, h: 270, color: BRAND.panel },
          { type: 'rect', x: -42, y: -48, w: 595, h: 8, color: BRAND.cyan },
          { type: 'rect', x: -42, y: 210, w: 595, h: 1, color: '#bae6fd' },
        ],
      },
      { text: 'USED CARS DOCTOR AI', style: 'brand', margin: [0, 10, 0, 18] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: t('pdf.cover.title'), style: 'coverTitle' },
              { text: t('pdf.cover.subtitle'), style: 'coverSubtitle', margin: [0, 9, 0, 0] },
              { text: vehicleTitle(vehicle), fontSize: 18, bold: true, color: '#0f172a', margin: [0, 18, 0, 4] },
              { text: engineLine(vehicle, t), style: 'muted' },
              { text: t('pdf.inspectionDate', { date: formatDate(generatedAt, lang) }), style: 'muted', margin: [0, 7, 0, 0] },
            ],
          },
          mainPhoto ? { width: 170, stack: [mainPhoto] } : {
            width: 170,
            margin: [0, 4, 0, 0],
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'USED CARS', style: 'badge', color: BRAND.cyan, alignment: 'center' },
                  { text: t('pdf.vehicleImageUnavailable'), style: 'caption', alignment: 'center', margin: [0, 8, 0, 0] },
                ],
                alignment: 'center',
                color: '#64748b',
                fillColor: BRAND.cyanSoft,
                margin: [8, 46, 8, 46],
              }]],
            },
            layout: {
              hLineColor: () => '#bae6fd',
              vLineColor: () => '#bae6fd',
            },
          },
        ],
      },
      {
        margin: [0, 42, 0, 24],
        table: {
          widths: ['*', '*', '*'],
          body: [[
            { text: [{ text: `${t('pdf.label.mileage')}\n`, style: 'badge' }, { text: text(vehicle.mileage, t('pdf.notProvided')), style: 'itemTitle' }], margin: [12, 10] },
            { text: [{ text: `${t('pdf.label.askingPrice')}\n`, style: 'badge' }, { text: formatMoney(vehicle.askingPrice, vehicle.currency, lang, t('pdf.notProvided')), style: 'itemTitle' }], margin: [12, 10] },
            { text: [{ text: `${t('pdf.label.vin')}\n`, style: 'badge' }, { text: text(vehicle.vin, t('pdf.notSupplied')), style: 'itemTitle' }], margin: [12, 10] },
          ]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
      },
      {
        columns: [
          {
            width: 120,
            stack: [
              { text: String(score.buyScore), style: 'score', alignment: 'center' },
              { text: t('pdf.overallScore'), style: 'caption', alignment: 'center' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: t(`pdf.risk.${score.verdict}`), fontSize: 17, bold: true, color: verdictColor[score.verdict] },
              { text: summary.join(' '), style: 'body', margin: [0, 7, 0, 0] },
              { stack: [scoreGauge(score.buyScore, verdictColor[score.verdict])], margin: [0, 13, 0, 0] },
            ],
          },
        ],
      },
      { text: '', pageBreak: 'after' },
      section(t('pdf.section.summary'), [
        bulletList(summary, t('pdf.empty.summary')),
        {
          margin: [0, 12, 0, 0],
          table: {
            widths: ['*'],
            body: [[{ stack: [{ text: t('pdf.sectionScoreSummary'), style: 'itemTitle' }, dimensionBars(score, t)], margin: [14, 12, 14, 12], fillColor: BRAND.panel }]],
          },
          layout: {
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
          },
        },
      ]),
      section(t('pdf.section.photoAnalysis'), [
        severityDistribution(findings, t),
        embeddedPhotoGrid
          ? embeddedPhotoGrid
          : { text: t('pdf.empty.images'), style: 'body' },
        findings.length
          ? ({
              table: {
                widths: [64, '*', 52],
                body: [
                  [
                    { text: t('pdf.label.severity'), style: 'badge' },
                    { text: t('pdf.label.finding'), style: 'badge' },
                    { text: t('pdf.label.confidence'), style: 'badge', alignment: 'right' },
                  ],
                  ...findings.map(f => [
                    { text: t(`pdf.severity.${f.severity}`), color: severityColor[f.severity], style: 'badge' },
                    {
                      stack: [
                        { text: f.title, style: 'itemTitle' },
                        { text: f.description, style: 'body' },
                      ],
                    },
                    { text: `${Math.round(f.confidence)}%`, alignment: 'right', style: 'body' },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            } as Content)
          : { text: t('pdf.empty.findings'), style: 'body' },
      ]),
      section(t('pdf.section.knownIssues'), [
        { text: research.summary, style: 'body', margin: [0, 0, 0, 8] },
        ...issueRows(knownIssues, t, 8),
      ]),
      section(t('pdf.section.priorityChecks'), [
        bulletList(priorityChecks, t('pdf.empty.priorityChecks')),
      ]),
      section(t('pdf.section.priceInsights'), [
        research.priceContext
          ? {
              stack: [
                { text: research.priceContext.evaluationLabel, style: 'itemTitle', color: '#0f172a' },
                { text: research.priceContext.summary, style: 'body', margin: [0, 3, 0, 0] },
              ],
            }
          : { text: t('pdf.empty.priceInsights'), style: 'body' },
      ]),
      section(t('pdf.section.disclaimer'), [
        {
          text: t('pdf.disclaimer.body'),
          style: 'body',
        },
      ]),
    ],
  }
}

export async function buildInspectionReportPdf(input: PdfReportInput): Promise<Buffer> {
  const pdf = pdfMake.createPdf(createDocDefinition(input))
  return pdf.getBuffer()
}
