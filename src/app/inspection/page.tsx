'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore } from '@/store'
import type { ChecklistCategory, InspectionPhase, ItemStatus } from '@/types'
import { CameraCapture } from '@/components/inspection/CameraCapture'
import { ModelResearchGuide } from '@/components/inspection/ModelResearchGuide'
import AppShell from '../AppShell'

// ─── Photo categories ──────────────────────────────────────────────────────────
const PHOTO_ANGLES = [
  { key: 'FRONT',       label: 'Front',          hint: 'Straight on from front' },
  { key: 'REAR',        label: 'Rear',            hint: 'Straight on from behind' },
  { key: 'LEFT_SIDE',   label: 'Left Side',       hint: 'Full left profile' },
  { key: 'RIGHT_SIDE',  label: 'Right Side',      hint: 'Full right profile' },
  { key: 'FRONT_LEFT',  label: 'Front-Left 45°',  hint: 'Front corner angle' },
  { key: 'FRONT_RIGHT', label: 'Front-Right 45°', hint: 'Front corner angle' },
  { key: 'HOOD',        label: 'Hood',            hint: 'Top of hood close-up' },
  { key: 'ROOF',        label: 'Roof',            hint: 'Roof panel' },
  { key: 'TRUNK',       label: 'Trunk / Boot',    hint: 'Rear trunk area' },
  { key: 'ENGINE_BAY',  label: 'Engine Bay',      hint: 'Open hood, engine visible' },
  { key: 'INTERIOR',    label: 'Interior',        hint: 'Dashboard and seats' },
  { key: 'ODOMETER',    label: 'Odometer',        hint: 'Dashboard showing mileage' },
  { key: 'VIN_PLATE',   label: 'VIN Plate',       hint: 'VIN number visible' },
  { key: 'WHEELS_FL',   label: 'Wheel – Front L', hint: 'Front left wheel close-up' },
  { key: 'WHEELS_FR',   label: 'Wheel – Front R', hint: 'Front right wheel close-up' },
  { key: 'UNDERBODY',   label: 'Underbody',       hint: 'Under vehicle if accessible' },
] as const

// ─── Phase config ──────────────────────────────────────────────────────────────
const PHASES: { phase: InspectionPhase; label: string; short: string; category?: ChecklistCategory }[] = [
  { phase: 'PRE_SCREENING', label: 'Overview',   short: 'Overview',  category: 'PRE_SCREENING' },
  { phase: 'AI_PHOTOS',     label: 'Photos + AI',short: 'Photos',    category: undefined },
  { phase: 'EXTERIOR',      label: 'Exterior',   short: 'Exterior',  category: 'EXTERIOR' },
  { phase: 'INTERIOR',      label: 'Interior',   short: 'Interior',  category: 'INTERIOR' },
  { phase: 'MECHANICAL',    label: 'Mechanical', short: 'Mech',      category: 'MECHANICAL' },
  { phase: 'TEST_DRIVE',    label: 'Test Drive', short: 'Drive',     category: 'TEST_DRIVE' },
  { phase: 'VIN_DOCS',      label: 'Documents',  short: 'Docs',      category: 'DOCUMENTS' },
  { phase: 'RISK_ANALYSIS', label: 'AI Score',   short: 'Score',     category: undefined },
]

const STATUS_CFG = {
  PENDING: { bg: 'transparent',            border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.28)', icon: null },
  OK:      { bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.25)',   text: '#22c55e',                icon: '✓' },
  WARNING: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b',                icon: '!' },
  PROBLEM: { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444',                icon: '✕' },
} as const

type PhotoEntry   = { key: string; label: string; file: File; previewUrl: string; aiPending: boolean; aiResult?: MockAIResult }
type MockAIResult = { signal: string; severity: 'ok' | 'warn' | 'flag'; detail: string }
type ChecklistRow = { id: string; itemLabel: string; status: ItemStatus; notes?: string | null }

// ─── Real AI analysis via OpenAI Vision ───────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function runAI(key: string, label: string, file: File): Promise<MockAIResult> {
  try {
    const imageBase64 = await fileToBase64(file)
    const res = await fetch('/api/inspection/analyze-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/jpeg', angle: key, angleLabel: label }),
    })
    const json = await res.json()
    if (json?.data) return json.data as MockAIResult
    throw new Error('No data in response')
  } catch {
    return { signal: 'Analysis unavailable', severity: 'warn', detail: 'Could not analyse this image. Check connection and try again.' }
  }
}

// ─── AI Badge ─────────────────────────────────────────────────────────────────
function AIBadge({ result }: Readonly<{ result: MockAIResult }>) {
  const colors = {
    ok:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)',  text: '#22c55e', dot: '#22c55e' },
    warn: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', text: '#f59e0b', dot: '#f59e0b' },
    flag: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  text: '#ef4444', dot: '#ef4444' },
  }
  const c = colors[result.severity]
  return (
    <div style={{ padding: '8px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, marginTop: 8, display: 'flex', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 2 }}>{result.signal}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{result.detail}</div>
      </div>
    </div>
  )
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onAdd }: Readonly<{ photos: PhotoEntry[]; onAdd: (key: string, label: string) => void }>) {
  const captured = photos.length
  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
          {captured} of {PHOTO_ANGLES.length} captured
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(captured / PHOTO_ANGLES.length) * 100}%`, background: '#22d3ee', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{Math.round((captured / PHOTO_ANGLES.length) * 100)}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHOTO_ANGLES.map(angle => {
          const photo = photos.find(p => p.key === angle.key)
          return (
            <div key={angle.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px',
              background: photo ? 'rgba(34,211,238,0.03)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${photo ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 12,
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                overflow: 'hidden',
                background: photo ? 'transparent' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${photo ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.07)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.previewUrl} alt={angle.label} className="photo-thumb" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
                {photo?.aiPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>

              {/* Info + AI result */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: photo ? '#fff' : 'rgba(255,255,255,0.55)' }}>{angle.label}</span>
                  {photo && !photo.aiPending && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', letterSpacing: '0.04em' }}>AI</span>
                  )}
                  {photo?.aiPending && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', letterSpacing: '0.04em' }}>Analysing…</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{angle.hint}</div>
                {photo?.aiResult && <AIBadge result={photo.aiResult} />}
              </div>

              {/* Capture / retake button */}
              <button
                onClick={() => onAdd(angle.key, angle.label)}
                style={{
                  flexShrink: 0, width: 40, height: 40,
                  background: photo ? 'rgba(255,255,255,0.04)' : 'rgba(34,211,238,0.09)',
                  border: `1px solid ${photo ? 'rgba(255,255,255,0.09)' : 'rgba(34,211,238,0.22)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: photo ? 'rgba(255,255,255,0.35)' : '#22d3ee',
                  transition: 'all 0.15s',
                }}
                aria-label={photo ? `Retake ${angle.label}` : `Capture ${angle.label}`}
              >
                {photo ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Checklist Phase ──────────────────────────────────────────────────────────
function ChecklistPhase({ items, isLoading, onStatus }: Readonly<{
  items: ChecklistRow[]
  isLoading: boolean
  onStatus: (id: string, st: ItemStatus) => void
}>) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="skeleton" style={{ height: 78, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)' }}>No items for this category</div>
      </div>
    )
  }

  const done = items.filter(i => i.status !== 'PENDING').length
  return (
    <div>
      {/* Mini progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          {done} / {items.length} checked
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {items.map(item => (
            <div key={item.id} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: item.status === 'OK' ? '#22c55e' : item.status === 'WARNING' ? '#f59e0b' : item.status === 'PROBLEM' ? '#ef4444' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const s = STATUS_CFG[item.status]
          return (
            <div key={item.id} style={{
              padding: '13px 14px', borderRadius: 12,
              background: s.bg, border: `1px solid ${s.border}`,
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: item.status === 'PENDING' ? 'rgba(255,255,255,0.6)' : '#fff', marginBottom: 10, lineHeight: 1.4 }}>
                {item.itemLabel}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['OK', 'WARNING', 'PROBLEM'] as ItemStatus[]).map(st => {
                  const cfg = STATUS_CFG[st]
                  const sel = item.status === st
                  const labels: Record<string, string> = { OK: 'OK', WARNING: 'Warning', PROBLEM: 'Issue' }
                  return (
                    <button
                      key={st}
                      onClick={() => onStatus(item.id, st)}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 8,
                        border: `1px solid ${sel ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                        background: sel ? cfg.bg : 'rgba(255,255,255,0.02)',
                        color: sel ? cfg.text : 'rgba(255,255,255,0.25)',
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.12s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      {sel && cfg.icon && <span style={{ fontSize: 11 }}>{cfg.icon}</span>}
                      {labels[st]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Risk Analysis ─────────────────────────────────────────────────────────────
function RiskAnalysisPhase({ photos }: Readonly<{ photos: PhotoEntry[] }>) {
  const flagged = photos.filter(p => p.aiResult && p.aiResult.severity !== 'ok')
  const allOk   = flagged.length === 0 && photos.length > 0

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Photo Analysis Summary
          </div>
          {allOk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>No flags raised in photo analysis</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flagged.map(p => (
                <div key={p.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: p.aiResult?.severity === 'flag' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)',
                  border: `1px solid ${p.aiResult?.severity === 'flag' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.aiResult?.severity === 'flag' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{p.aiResult?.signal}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 24 }}>
          Checklist complete. Calculate your full AI confidence score.
        </div>
        <Link
          href="/report"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '15px 32px',
            background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
            color: '#000', borderRadius: 14, fontSize: 15, fontWeight: 800,
            textDecoration: 'none', letterSpacing: '-0.2px',
            boxShadow: '0 4px 20px rgba(34,211,238,0.3)',
          }}
        >
          Calculate Risk Score
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InspectionPage() {
  const { activeVehicle } = useVehicleStore()
  const {
    session, currentPhase, checklistItems, isLoadingChecklist, error,
    initSession, setPhase, updateChecklistItem, getItemsByCategory, pushAIResult,
  } = useInspectionStore()

  const [photos, setPhotos]             = useState<PhotoEntry[]>([])
  const [cameraTarget, setCameraTarget] = useState<{ key: string; label: string } | null>(null)
  const [findingsSaved, setFindingsSaved] = useState(false)

  useEffect(() => {
    if (activeVehicle?.id && !session) initSession(activeVehicle.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicle?.id])

  // When the user reaches the RISK_ANALYSIS phase, persist all photo AI findings
  // to the DB so the scoring service can factor them in, and push into the store
  // so the report's "AI Findings" section is populated.
  useEffect(() => {
    if (currentPhase !== 'RISK_ANALYSIS') return
    if (findingsSaved) return
    const vehicleId = activeVehicle?.id
    if (!vehicleId) return
    const completed = photos.filter(p => p.aiResult && !p.aiPending)
    if (completed.length === 0) return

    setFindingsSaved(true)

    const photoResults = completed.map(p => ({
      angle:    p.key,
      label:    p.label,
      signal:   p.aiResult!.signal,
      severity: p.aiResult!.severity,
      detail:   p.aiResult!.detail,
    }))

    // Get JWT from localStorage (same pattern as apiClient interceptor)
    let authHeader = ''
    try {
      const stored = localStorage.getItem('uci-user-store')
      if (stored) {
        const token = JSON.parse(stored)?.state?.session?.accessToken
        if (token) authHeader = `Bearer ${token}`
      }
    } catch { /* ignore */ }

    fetch('/api/ai-analysis/analyze', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ vehicleId, photoResults }),
    })
      .then(r => r.json())
      .then(json => { if (json?.data) pushAIResult(json.data) })
      .catch(err => console.error('[inspection] failed to save photo findings:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase])

  const phaseIdx  = PHASES.findIndex(p => p.phase === currentPhase)
  const phaseCfg  = PHASES[phaseIdx]
  const items     = phaseCfg?.category ? getItemsByCategory(phaseCfg.category) : []
  const checked   = checklistItems.filter(i => i.status !== 'PENDING').length
  const total     = checklistItems.length
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0

  const goNext = () => { const n = PHASES[phaseIdx + 1]; if (n) setPhase(n.phase) }
  const goPrev = () => { const p = PHASES[phaseIdx - 1]; if (p) setPhase(p.phase) }

  const handleStatus = (itemId: string, status: ItemStatus) => updateChecklistItem(itemId, status)

  const handleOpenCamera = useCallback((key: string, label: string) => {
    setCameraTarget({ key, label })
  }, [])

  const handleCapture = useCallback(async (file: File, previewUrl: string) => {
    if (!cameraTarget) return
    const entry: PhotoEntry = { key: cameraTarget.key, label: cameraTarget.label, file, previewUrl, aiPending: true }
    setPhotos(prev => [...prev.filter(p => p.key !== cameraTarget.key), entry])
    setCameraTarget(null)
    const result = await runAI(cameraTarget.key, cameraTarget.label, file)
    setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, aiPending: false, aiResult: result } : p))
  }, [cameraTarget])

  // ── No vehicle ──
  if (!activeVehicle) {
    return (
      <AppShell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px', gap: 20, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>No vehicle selected</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>Add or select a vehicle before starting an inspection.</p>
          </div>
          <Link href="/vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 28px', background: '#22d3ee', color: '#000', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Go to Vehicles
          </Link>
        </div>
      </AppShell>
    )
  }

  const isFirst = phaseIdx === 0
  const isLast  = phaseIdx === PHASES.length - 1

  return (
    <AppShell>
      {cameraTarget && (
        <CameraCapture
          label={cameraTarget.label}
          onCapture={handleCapture}
          onClose={() => setCameraTarget(null)}
        />
      )}

      <div style={{ maxWidth: 680 }}>

        {/* Vehicle banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '13px 16px', marginBottom: 14,
          background: 'rgba(34,211,238,0.04)',
          border: '1px solid rgba(34,211,238,0.12)',
          borderRadius: 14,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Inspecting</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 2 }}>Overall</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#22d3ee', letterSpacing: '-1px', lineHeight: 1 }}>{progress}%</div>
          </div>
        </div>

        {/* Progress track */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 3, transition: 'width 0.5s ease', boxShadow: '0 0 8px rgba(34,211,238,0.4)' }} />
        </div>

        {/* Step tabs — horizontal scroll, no scrollbar */}
        <div className="no-scroll-bar" style={{ display: 'flex', gap: 5, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 } as React.CSSProperties}>
          {PHASES.map((p, idx) => {
            const isActive  = p.phase === currentPhase
            const isDone    = idx < phaseIdx
            const tabBorder = isActive ? 'rgba(34,211,238,0.3)' : isDone ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.07)'
            const tabBg     = isActive ? 'rgba(34,211,238,0.09)' : isDone ? 'rgba(34,197,94,0.04)' : 'transparent'
            const tabColor  = isActive ? '#22d3ee' : isDone ? '#22c55e' : 'rgba(255,255,255,0.28)'
            const badgeBg   = isActive ? 'rgba(34,211,238,0.18)' : isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)'
            const badgeColor = isActive ? '#22d3ee' : isDone ? '#22c55e' : 'rgba(255,255,255,0.25)'
            const showCheck = isDone && !isActive
            return (
              <button
                key={p.phase}
                onClick={() => setPhase(p.phase)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 11px', borderRadius: 10, flexShrink: 0,
                  border: `1px solid ${tabBorder}`,
                  background: tabBg,
                  color: tabColor,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {/* Step number badge */}
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  background: badgeBg,
                  color: badgeColor,
                }}>
                  {showCheck
                    ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : idx + 1
                  }
                </span>
                {p.short}
              </button>
            )
          })}
        </div>

        {/* Phase card */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 16px', marginBottom: 12 }}>
          {/* Phase header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>{phaseCfg?.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                Step {phaseIdx + 1} of {PHASES.length}
              </div>
            </div>
            {currentPhase === 'AI_PHOTOS' && photos.some(p => p.aiPending) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>AI Analysing</span>
              </div>
            )}
          </div>

          {/* PRE_SCREENING */}
          {currentPhase === 'PRE_SCREENING' && (
            <div style={{ marginBottom: 4 }}>
              <ModelResearchGuide
                make={activeVehicle.make}
                model={activeVehicle.model}
                year={activeVehicle.year}
              />
            </div>
          )}

          {/* AI_PHOTOS */}
          {currentPhase === 'AI_PHOTOS' && (
            <div>
              <div style={{ padding: '11px 13px', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)', borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', marginBottom: 3 }}>AI Photo Inspection</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  Photograph each area. AI analyses each image for repairs, repaints, panel gaps, and anomalies. Results are advisory — verify manually.
                </div>
              </div>
              <PhotoGrid photos={photos} onAdd={handleOpenCamera} />
            </div>
          )}

          {/* RISK_ANALYSIS */}
          {currentPhase === 'RISK_ANALYSIS' && <RiskAnalysisPhase photos={photos} />}

          {/* All checklist phases */}
          {currentPhase !== 'AI_PHOTOS' && currentPhase !== 'RISK_ANALYSIS' && currentPhase !== 'PRE_SCREENING' && (
            <ChecklistPhase items={items} isLoading={isLoadingChecklist} onStatus={handleStatus} />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={goPrev}
            disabled={isFirst}
            style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '0 20px', height: 50,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${isFirst ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12,
              fontSize: 14, color: isFirst ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)',
              cursor: isFirst ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>

          <button
            onClick={goNext}
            disabled={isLast}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              height: 50, borderRadius: 12,
              background: isLast ? 'rgba(255,255,255,0.02)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${isLast ? 'rgba(255,255,255,0.06)' : 'rgba(34,211,238,0.25)'}`,
              fontSize: 14, fontWeight: 700,
              color: isLast ? 'rgba(255,255,255,0.12)' : '#22d3ee',
              cursor: isLast ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.1px',
            }}
          >
            {phaseIdx === PHASES.length - 2 ? 'Finish Checklist' : `Next: ${PHASES[phaseIdx + 1]?.short ?? ''}`}
            {!isLast && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}
      </div>
    </AppShell>
  )
}
