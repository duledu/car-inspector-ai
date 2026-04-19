'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/store'
import { adminApi } from '@/services/api/admin.api'
import type { BulkSendResult } from '@/services/api/admin.api'
import { DEFAULT_ANNOUNCEMENT, DEFAULT_MARKETING_CAMPAIGN } from '@/lib/admin/announcement-defaults'
import type { AppAnnouncementContent, MarketingCampaignContent } from '@/lib/email/types/email-template.types'
import type { RecipientMode } from '@/lib/admin/bulk-email-sender'

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Design tokens ───────────────────────────────────────────────────────────

const S = {
  page:        { minHeight: '100vh', background: '#080c14', color: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" } as React.CSSProperties,
  header:      { padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' } as React.CSSProperties,
  badge:       { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  tabs:        { display: 'flex', gap: 4, padding: '16px 32px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } as React.CSSProperties,
  tab:         (active: boolean): React.CSSProperties => ({ padding: '10px 18px', fontSize: 13, fontWeight: 600, color: active ? '#22d3ee' : 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', borderBottom: active ? '2px solid #22d3ee' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }),
  body:        { padding: '28px 32px', maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  sectionHead: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: 16 },
  card:        { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '24px' } as React.CSSProperties,
  row:         { display: 'flex', gap: 24, flexWrap: 'wrap' as const } as React.CSSProperties,
  label:       { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.04em' } as React.CSSProperties,
  input:       { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  textarea:    { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit', lineHeight: 1.5 },
  fieldGroup:  { marginBottom: 16 } as React.CSSProperties,
  divider:     { height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' } as React.CSSProperties,
  groupTitle:  { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 },
  btn:         (variant: 'primary' | 'ghost' | 'danger' | 'active'): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: variant === 'primary' ? '#22d3ee' : variant === 'active' ? 'rgba(34,211,238,0.12)' : variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
    color: variant === 'primary' ? '#000' : variant === 'active' ? '#22d3ee' : variant === 'danger' ? '#f87171' : 'rgba(255,255,255,0.8)',
    transition: 'opacity 0.15s',
  }),
  statCard:    { flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' } as React.CSSProperties,
  statNum:     { fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 } as React.CSSProperties,
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 } as React.CSSProperties,
}

// ─── Primitive form components ────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}>) {
  return (
    <div style={S.fieldGroup}>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextArea({ label, value, onChange, rows = 3, placeholder }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}>) {
  return (
    <div style={S.fieldGroup}>
      <label style={S.label}>{label}</label>
      <textarea style={{ ...S.textarea, minHeight: rows * 22 + 18 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
    </div>
  )
}

// ─── Manual email input + recipient mode ─────────────────────────────────────

function parseManualEmails(raw: string): string[] {
  return [...new Set(
    raw.split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => EMAIL_RE.test(e))
  )]
}

function ManualEmailSection({ raw, onRawChange, mode, onModeChange }: Readonly<{
  raw: string
  onRawChange: (v: string) => void
  mode: RecipientMode
  onModeChange: (m: RecipientMode) => void
}>) {
  const parsed  = parseManualEmails(raw)
  const modeLabels: Record<RecipientMode, string> = { db: 'DB users only', manual: 'Manual only', both: 'DB + manual' }

  return (
    <div>
      <p style={S.groupTitle}>Recipients</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['db', 'manual', 'both'] as RecipientMode[]).map(m => (
          <button key={m} style={{ ...S.btn(mode === m ? 'active' : 'ghost'), padding: '7px 14px', fontSize: 12 }} onClick={() => onModeChange(m)}>
            {modeLabels[m]}
          </button>
        ))}
      </div>
      <div style={S.fieldGroup}>
        <label style={S.label}>
          Manual emails
          {parsed.length > 0 && <span style={{ marginLeft: 8, color: '#22d3ee', fontWeight: 400 }}>{parsed.length} valid</span>}
        </label>
        <textarea
          style={{ ...S.textarea, minHeight: 80 }}
          value={raw}
          onChange={e => onRawChange(e.target.value)}
          placeholder={'user@example.com, another@example.com\none-per-line@works.too'}
        />
        <p style={{ margin: '5px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
          Comma or newline separated. Validated and deduplicated server-side.
        </p>
      </div>
    </div>
  )
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({ dbCount, manualCount, mode, onConfirm, onCancel, sending }: Readonly<{
  dbCount: number | null; manualCount: number; mode: RecipientMode
  onConfirm: () => void; onCancel: () => void; sending: boolean
}>) {
  const est = mode === 'db'
    ? `${dbCount !== null ? dbCount : 'all'} DB users`
    : mode === 'manual'
      ? `${manualCount} manual email${manualCount !== 1 ? 's' : ''}`
      : `DB users + ${manualCount} manual email${manualCount !== 1 ? 's' : ''}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, maxWidth: 480, width: '90%' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Confirm bulk send</div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 20 }}>
          This will send to <strong style={{ color: '#fff' }}>{est}</strong>. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={{ ...S.btn('ghost'), opacity: sending ? 0.5 : 1 }} onClick={onCancel} disabled={sending}>Cancel</button>
          <button style={{ ...S.btn('danger'), background: '#dc2626', color: '#fff', opacity: sending ? 0.5 : 1 }} onClick={onConfirm} disabled={sending}>
            {sending ? 'Sending…' : 'Confirm Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk send result ─────────────────────────────────────────────────────────

function BulkResult({ result, onReset }: Readonly<{ result: BulkSendResult; onReset: () => void }>) {
  return (
    <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#34d399' }}>✓ Bulk send complete</p>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', lineHeight: 1.9 }}>
        DB users: <strong style={{ color: '#fff' }}>{result.dbUsers}</strong><br />
        Manual emails: <strong style={{ color: '#fff' }}>{result.manualEmails}</strong><br />
        Valid recipients: <strong style={{ color: '#fff' }}>{result.valid}</strong><br />
        Sent: <strong style={{ color: '#34d399' }}>{result.sent}</strong><br />
        Failed: <strong style={{ color: result.failed > 0 ? '#f87171' : '#fff' }}>{result.failed}</strong>
      </p>
      <button style={{ ...S.btn('ghost'), marginTop: 12, fontSize: 11 }} onClick={onReset}>Reset</button>
    </div>
  )
}

// ─── Shared right panel ───────────────────────────────────────────────────────

interface RightPanelProps {
  onPreview:           () => Promise<void>
  previewing:          boolean
  previewHtml:         string | null
  testEmail:           string
  onTestEmailChange:   (v: string) => void
  onTestSend:          () => Promise<void>
  testSending:         boolean
  testResult:          string | null
  manualEmailsRaw:     string
  onManualEmailsChange: (v: string) => void
  recipientMode:       RecipientMode
  onRecipientModeChange: (m: RecipientMode) => void
  onBulkSendClick:     () => void
  bulkSending:         boolean
  bulkResult:          BulkSendResult | null
  onBulkReset:         () => void
  dbUserCount:         number | null
}

function RightPanel(props: Readonly<RightPanelProps>) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const manualCount = parseManualEmails(props.manualEmailsRaw).length

  return (
    <div style={{ flex: 1, minWidth: 320 }}>
      <div style={{ ...S.card, position: 'sticky', top: 24 }}>

        {/* Preview */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ ...S.groupTitle, margin: 0 }}>Preview</p>
          <button style={{ ...S.btn('ghost'), padding: '7px 14px', fontSize: 12, opacity: props.previewing ? 0.5 : 1 }} onClick={props.onPreview} disabled={props.previewing}>
            {props.previewing ? 'Rendering…' : '↻ Refresh'}
          </button>
        </div>

        {props.previewHtml ? (
          <iframe ref={iframeRef} srcDoc={props.previewHtml} style={{ width: '100%', height: 560, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} title="Email preview" sandbox="allow-same-origin" />
        ) : (
          <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            <span style={{ fontSize: 26, marginBottom: 8 }}>👁</span>
            Click Refresh to render
          </div>
        )}

        <div style={S.divider} />

        {/* Test send */}
        <p style={S.groupTitle}>Test Email</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input style={{ ...S.input, flex: 1 }} placeholder="Optional test recipient email" value={props.testEmail} onChange={e => props.onTestEmailChange(e.target.value)} />
          <button style={{ ...S.btn('ghost'), whiteSpace: 'nowrap', opacity: props.testSending ? 0.5 : 1 }} onClick={props.onTestSend} disabled={props.testSending}>
            {props.testSending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        {props.testResult && (
          <p style={{ fontSize: 12, color: props.testResult.startsWith('✓') ? '#34d399' : '#f87171', margin: '0 0 4px' }}>{props.testResult}</p>
        )}

        <div style={S.divider} />

        {/* Recipients */}
        <ManualEmailSection
          raw={props.manualEmailsRaw}
          onRawChange={props.onManualEmailsChange}
          mode={props.recipientMode}
          onModeChange={props.onRecipientModeChange}
        />

        <div style={S.divider} />

        {/* Bulk send */}
        <p style={S.groupTitle}>Bulk Send</p>
        {props.bulkResult ? (
          <BulkResult result={props.bulkResult} onReset={props.onBulkReset} />
        ) : (
          <button
            style={{ ...S.btn('danger'), width: '100%', padding: '13px', opacity: props.bulkSending ? 0.5 : 1 }}
            onClick={props.onBulkSendClick}
            disabled={props.bulkSending}
          >
            {props.bulkSending ? 'Sending…' : `🚀 Send to ${props.recipientMode === 'manual' ? `${manualCount} manual` : props.recipientMode === 'both' ? `DB + ${manualCount} manual` : 'all DB users'}`}
          </button>
        )}

      </div>
    </div>
  )
}

// ─── Announcement form fields ─────────────────────────────────────────────────

function AnnouncementFormFields({ form, onChange }: Readonly<{
  form: AppAnnouncementContent
  onChange: (f: AppAnnouncementContent) => void
}>) {
  const set = useCallback((key: keyof AppAnnouncementContent) => (v: string) => onChange({ ...form, [key]: v }), [form, onChange])

  return (
    <div style={{ flex: '0 0 520px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.card}>
        <p style={S.groupTitle}>Email Metadata</p>
        <Field label="Subject" value={form.subject} onChange={set('subject')} />
        <TextArea label="Preview text" value={form.previewText} onChange={set('previewText')} rows={2} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Header</p>
        <Field label="Eyebrow / badge" value={form.eyebrow} onChange={set('eyebrow')} placeholder="App Update" />
        <Field label="Headline" value={form.headline} onChange={set('headline')} />
        <TextArea label="Subheadline" value={form.subheadline} onChange={set('subheadline')} rows={2} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Content</p>
        <TextArea label="Intro paragraph" value={form.introBody} onChange={set('introBody')} rows={3} />
        <Field label="Info block title (optional)" value={form.infoBlockTitle} onChange={set('infoBlockTitle')} placeholder="Leave empty to hide" />
        <TextArea label="Info block body (optional)" value={form.infoBlockBody} onChange={set('infoBlockBody')} rows={2} placeholder="Leave empty to hide" />
        <Field label="Signature line (optional)" value={form.signatureLine} onChange={set('signatureLine')} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Primary CTA</p>
        <Field label="Button label" value={form.ctaLabel} onChange={set('ctaLabel')} />
        <Field label="Button URL" value={form.ctaUrl} onChange={set('ctaUrl')} />
      </div>

      <div style={S.card}>
        <p style={S.groupTitle}>Feature Cards</p>
        {([1, 2, 3, 4] as const).map(n => (
          <div key={n} style={{ marginBottom: n < 4 ? 16 : 0 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontWeight: 600 }}>Card {n}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: '0 0 64px' }}><Field label="Icon" value={form[`card${n}Icon`]} onChange={set(`card${n}Icon`)} /></div>
              <div style={{ flex: 1 }}><Field label="Title" value={form[`card${n}Title`]} onChange={set(`card${n}Title`)} /></div>
            </div>
            <Field label="Description" value={form[`card${n}Description`]} onChange={set(`card${n}Description`)} />
          </div>
        ))}
      </div>

      <div style={S.card}>
        <p style={S.groupTitle}>Secondary Section (optional)</p>
        <Field label="Section title" value={form.secondaryTitle} onChange={set('secondaryTitle')} placeholder="Leave empty to hide" />
        <TextArea label="Section body" value={form.secondaryBody} onChange={set('secondaryBody')} rows={3} />
        <Field label="Secondary CTA label" value={form.secondaryCtaLabel} onChange={set('secondaryCtaLabel')} />
        <Field label="Secondary CTA URL" value={form.secondaryCtaUrl} onChange={set('secondaryCtaUrl')} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Footer</p>
        <TextArea label="Footnote (optional)" value={form.footnote} onChange={set('footnote')} rows={2} placeholder="Leave empty to hide" />
        <Field label="Footer link label (optional)" value={form.footerLinkLabel} onChange={set('footerLinkLabel')} />
        <Field label="Footer link URL (optional)" value={form.footerLinkUrl} onChange={set('footerLinkUrl')} />
      </div>
    </div>
  )
}

// ─── Marketing form fields ────────────────────────────────────────────────────

function MarketingFormFields({ form, onChange }: Readonly<{
  form: MarketingCampaignContent
  onChange: (f: MarketingCampaignContent) => void
}>) {
  const set = useCallback((key: keyof MarketingCampaignContent) => (v: string) => onChange({ ...form, [key]: v }), [form, onChange])

  return (
    <div style={{ flex: '0 0 520px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.card}>
        <p style={S.groupTitle}>Email Metadata</p>
        <Field label="Subject" value={form.subject} onChange={set('subject')} />
        <TextArea label="Preview text" value={form.previewText} onChange={set('previewText')} rows={2} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Body</p>
        <TextArea label="Headline" value={form.headline} onChange={set('headline')} rows={2} />
        <TextArea label="Intro paragraph" value={form.introParagraph} onChange={set('introParagraph')} rows={4} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Primary CTA</p>
        <Field label="Button label" value={form.ctaLabel} onChange={set('ctaLabel')} />
        <Field label="Button URL" value={form.ctaUrl} onChange={set('ctaUrl')} />
      </div>

      <div style={S.card}>
        <p style={S.groupTitle}>Value Points</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16, marginTop: -8 }}>Three checkmark bullet points shown below the CTA.</p>
        <Field label="Value 1" value={form.value1} onChange={set('value1')} />
        <Field label="Value 2" value={form.value2} onChange={set('value2')} />
        <Field label="Value 3" value={form.value3} onChange={set('value3')} />
      </div>

      <div style={S.card}>
        <p style={S.groupTitle}>Trust &amp; Social Proof</p>
        <TextArea label="Trust paragraph" value={form.trustParagraph} onChange={set('trustParagraph')} rows={4} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Secondary CTA</p>
        <Field label="Link label" value={form.secondaryCtaLabel} onChange={set('secondaryCtaLabel')} />
        <Field label="Link URL" value={form.secondaryCtaUrl} onChange={set('secondaryCtaUrl')} />
        <div style={S.divider} />
        <p style={S.groupTitle}>Footer</p>
        <TextArea label="Footer note" value={form.footerNote} onChange={set('footerNote')} rows={2} />
      </div>
    </div>
  )
}

// ─── Email Tools Tab ──────────────────────────────────────────────────────────

type CampaignType = 'announcement' | 'marketing'

function EmailToolsTab({ dbUserCount }: Readonly<{ dbUserCount: number | null }>) {
  const [campaignType,    setCampaignType]    = useState<CampaignType>('announcement')
  const [announcementForm, setAnnouncementForm] = useState<AppAnnouncementContent>(DEFAULT_ANNOUNCEMENT)
  const [marketingForm,    setMarketingForm]    = useState<MarketingCampaignContent>(DEFAULT_MARKETING_CAMPAIGN)
  const [loading,         setLoading]          = useState(true)
  const [saving,          setSaving]           = useState(false)
  const [saveMsg,         setSaveMsg]          = useState<string | null>(null)
  const [previewHtml,     setPreviewHtml]      = useState<string | null>(null)
  const [previewing,      setPreviewing]       = useState(false)
  const [testEmail,       setTestEmail]        = useState('')
  const [testSending,     setTestSending]      = useState(false)
  const [testResult,      setTestResult]       = useState<string | null>(null)
  const [manualEmailsRaw, setManualEmailsRaw]  = useState('')
  const [recipientMode,   setRecipientMode]    = useState<RecipientMode>('db')
  const [showConfirm,     setShowConfirm]      = useState(false)
  const [bulkSending,     setBulkSending]      = useState(false)
  const [bulkResult,      setBulkResult]       = useState<BulkSendResult | null>(null)

  useEffect(() => {
    Promise.all([adminApi.getAnnouncement(), adminApi.getMarketing()])
      .then(([a, m]) => { setAnnouncementForm(a); setMarketingForm(m) })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const switchCampaign = (type: CampaignType) => {
    setCampaignType(type)
    setPreviewHtml(null)
    setTestResult(null)
    setBulkResult(null)
  }

  const campaignName = campaignType === 'announcement' ? announcementForm.campaignName : marketingForm.campaignName

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null)
    try {
      if (campaignType === 'announcement') await adminApi.saveAnnouncement(announcementForm)
      else await adminApi.saveMarketing(marketingForm)
      setSaveMsg('Saved.')
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      const html = campaignType === 'announcement'
        ? await adminApi.previewAnnouncement(announcementForm)
        : await adminApi.previewMarketing(marketingForm)
      setPreviewHtml(html)
    } catch {
      setPreviewHtml('<p style="color:#f87171;padding:20px;font-family:sans-serif;">Preview failed.</p>')
    } finally {
      setPreviewing(false)
    }
  }

  const handleTestSend = async () => {
    setTestSending(true); setTestResult(null)
    try {
      const r = campaignType === 'announcement'
        ? await adminApi.sendAnnouncementTest(announcementForm, testEmail || undefined)
        : await adminApi.sendMarketingTest(marketingForm, testEmail || undefined)
      setTestResult(`✓ Sent to ${r.sentTo}`)
    } catch {
      setTestResult('✗ Test send failed.')
    } finally {
      setTestSending(false)
    }
  }

  const handleBulkConfirm = async () => {
    setBulkSending(true)
    const manual = parseManualEmails(manualEmailsRaw)
    try {
      const result = campaignType === 'announcement'
        ? await adminApi.sendAnnouncementToAll(announcementForm, manual, recipientMode)
        : await adminApi.sendMarketingToAll(marketingForm, manual, recipientMode)
      setBulkResult(result)
    } catch {
      setTestResult('✗ Bulk send failed.')
    } finally {
      setBulkSending(false)
      setShowConfirm(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Loading…</div>

  const manualCount = parseManualEmails(manualEmailsRaw).length

  return (
    <div>
      {showConfirm && (
        <ConfirmModal
          dbCount={dbUserCount}
          manualCount={manualCount}
          mode={recipientMode}
          onConfirm={handleBulkConfirm}
          onCancel={() => setShowConfirm(false)}
          sending={bulkSending}
        />
      )}

      {/* Campaign type toggle + campaign name + save */}
      <div style={{ ...S.card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['announcement', 'marketing'] as CampaignType[]).map(type => (
            <button key={type} onClick={() => switchCampaign(type)}
              style={{ padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: campaignType === type ? 'rgba(34,211,238,0.12)' : 'transparent', color: campaignType === type ? '#22d3ee' : 'rgba(255,255,255,0.4)' }}>
              {type === 'announcement' ? '📢 App Update' : '✉ Marketing'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={S.label}>Campaign name (internal)</label>
          <input style={{ ...S.input, maxWidth: 340 }}
            value={campaignName}
            onChange={e => campaignType === 'announcement'
              ? setAnnouncementForm(p => ({ ...p, campaignName: e.target.value }))
              : setMarketingForm(p => ({ ...p, campaignName: e.target.value }))}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, paddingTop: 16 }}>
          <button style={{ ...S.btn('ghost'), opacity: saving ? 0.5 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saveMsg && <span style={{ fontSize: 12, color: saveMsg === 'Saved.' ? '#34d399' : '#f87171' }}>{saveMsg}</span>}
        </div>
      </div>

      {/* Two-column editor */}
      <div style={S.row}>
        {campaignType === 'announcement'
          ? <AnnouncementFormFields form={announcementForm} onChange={setAnnouncementForm} />
          : <MarketingFormFields    form={marketingForm}    onChange={setMarketingForm} />
        }

        <RightPanel
          onPreview={handlePreview}
          previewing={previewing}
          previewHtml={previewHtml}
          testEmail={testEmail}
          onTestEmailChange={setTestEmail}
          onTestSend={handleTestSend}
          testSending={testSending}
          testResult={testResult}
          manualEmailsRaw={manualEmailsRaw}
          onManualEmailsChange={setManualEmailsRaw}
          recipientMode={recipientMode}
          onRecipientModeChange={setRecipientMode}
          onBulkSendClick={() => setShowConfirm(true)}
          bulkSending={bulkSending}
          bulkResult={bulkResult}
          onBulkReset={() => setBulkResult(null)}
          dbUserCount={dbUserCount}
        />
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ onStatsLoaded }: Readonly<{ onStatsLoaded: (count: number) => void }>) {
  const [data,    setData]    = useState<{ stats: { total: number; verified: number; unverified: number }; recentUsers: { id: string; email: string; name: string; emailVerified: string | null; createdAt: string; role: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getUserStats()
      .then(d => { setData(d); onStatsLoaded(d.stats.total) })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [onStatsLoaded])

  if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Loading…</div>
  if (!data)   return <div style={{ padding: 40, color: '#f87171', fontSize: 14 }}>Failed to load user data.</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total users',  value: data.stats.total,      color: '#fff'     },
          { label: 'Verified',     value: data.stats.verified,   color: '#34d399'  },
          { label: 'Unverified',   value: data.stats.unverified, color: '#f59e0b'  },
        ].map(s => (
          <div key={s.label} style={S.statCard}>
            <div style={{ ...S.statNum, color: s.color }}>{s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <p style={S.groupTitle}>Recent Registrations (last 20)</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Name', 'Email', 'Role', 'Verified', 'Joined'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px 10px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recentUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '9px 12px', color: '#fff' }}>{u.name}</td>
                <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.6)' }}>{u.email}</td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 7px', color: 'rgba(255,255,255,0.5)' }}>{u.role}</span></td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, color: u.emailVerified ? '#34d399' : '#f59e0b' }}>{u.emailVerified ? '✓' : '—'}</span></td>
                <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab() {
  return (
    <div style={S.card}>
      <p style={{ ...S.groupTitle, marginBottom: 8 }}>System &amp; Admin Tools</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.7 }}>
        Planned: homepage notices, maintenance banners, release notes, premium announcement banners, temporary alerts. Coming soon.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainTab = 'email' | 'users' | 'system'

export default function AdminPanelPage() {
  const router          = useRouter()
  const user            = useUserStore(s => s.user)
  const isAuthenticated = useUserStore(s => s.isAuthenticated)
  const [ready,        setReady]        = useState(false)
  const [activeTab,    setActiveTab]    = useState<MainTab>('email')
  const [dbUserCount,  setDbUserCount]  = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated || user?.role !== 'ADMIN') router.replace('/')
  }, [ready, isAuthenticated, user, router])

  const handleStatsLoaded = useCallback((count: number) => setDbUserCount(count), [])

  if (!ready || !isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Checking access…</span>
      </div>
    )
  }

  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'email',  label: '✉ Email Tools'  },
    { id: 'users',  label: '👥 User Tools'  },
    { id: 'system', label: '⚙ System'       },
  ]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
            <span style={{ color: '#22d3ee' }}>Used Car</span> Inspector AI
          </span>
          <span style={S.badge}>⬡ Admin Panel</span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{user.email}</span>
      </div>

      <div style={S.tabs}>
        {mainTabs.map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={S.body}>
        {activeTab === 'email'  && <div><p style={S.sectionHead}>Email Campaign Manager</p><EmailToolsTab dbUserCount={dbUserCount} /></div>}
        {activeTab === 'users'  && <div><p style={S.sectionHead}>User Tools</p><UsersTab onStatsLoaded={handleStatsLoaded} /></div>}
        {activeTab === 'system' && <div><p style={S.sectionHead}>System &amp; Admin Tools</p><SystemTab /></div>}
      </div>
    </div>
  )
}
