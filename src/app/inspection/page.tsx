'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useVehicleStore, useInspectionStore } from '@/store'
import type { ChecklistCategory, InspectionPhase, ItemStatus } from '@/types'
import { CameraCapture } from '@/components/inspection/CameraCapture'
import { ModelResearchGuide } from '@/components/inspection/ModelResearchGuide'
import AppShell from '../AppShell'

// ─── Photo categories for camera inspection ────────────────────────────────────
const PHOTO_ANGLES = [
  { key: 'FRONT',         label: 'Front',          hint: 'Straight on from the front' },
  { key: 'REAR',          label: 'Rear',            hint: 'Straight on from behind' },
  { key: 'LEFT_SIDE',     label: 'Left Side',       hint: 'Full left side of vehicle' },
  { key: 'RIGHT_SIDE',    label: 'Right Side',      hint: 'Full right side of vehicle' },
  { key: 'FRONT_LEFT',    label: 'Front-Left 45°',  hint: 'Front corner angle' },
  { key: 'FRONT_RIGHT',   label: 'Front-Right 45°', hint: 'Front corner angle' },
  { key: 'HOOD',          label: 'Hood',            hint: 'Top of hood close-up' },
  { key: 'ROOF',          label: 'Roof',            hint: 'Roof panel' },
  { key: 'TRUNK',         label: 'Trunk / Boot',    hint: 'Rear trunk area' },
  { key: 'ENGINE_BAY',    label: 'Engine Bay',      hint: 'Open hood, engine visible' },
  { key: 'INTERIOR',      label: 'Interior',        hint: 'Dashboard and seats' },
  { key: 'ODOMETER',      label: 'Odometer',        hint: 'Dashboard showing mileage' },
  { key: 'VIN_PLATE',     label: 'VIN Plate',       hint: 'VIN number visible' },
  { key: 'WHEELS_FL',     label: 'Wheel – Front L', hint: 'Front left wheel close-up' },
  { key: 'WHEELS_FR',     label: 'Wheel – Front R', hint: 'Front right wheel close-up' },
  { key: 'UNDERBODY',     label: 'Underbody',       hint: 'Under the vehicle if accessible' },
] as const

// ─── Phase config ──────────────────────────────────────────────────────────────
const PHASES: { phase: InspectionPhase; label: string; icon: React.ReactNode; category?: ChecklistCategory }[] = [
  {
    phase: 'PRE_SCREENING', label: 'Overview', category: 'PRE_SCREENING',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    phase: 'AI_PHOTOS', label: 'Photos + AI', category: undefined,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  },
  {
    phase: 'EXTERIOR', label: 'Exterior', category: 'EXTERIOR',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  },
  {
    phase: 'INTERIOR', label: 'Interior', category: 'INTERIOR',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 4 0v2"/><path d="M16 7V5a2 2 0 0 0-4 0"/></svg>,
  },
  {
    phase: 'MECHANICAL', label: 'Mechanical', category: 'MECHANICAL',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  },
  {
    phase: 'TEST_DRIVE', label: 'Test Drive', category: 'TEST_DRIVE',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    phase: 'VIN_DOCS', label: 'Documents', category: 'DOCUMENTS',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  {
    phase: 'RISK_ANALYSIS', label: 'AI Score', category: undefined,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
]

const STATUS_CFG = {
  PENDING: { bg: 'transparent',             border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.3)',  label: 'Pending' },
  OK:      { bg: 'rgba(34,197,94,0.06)',    border: 'rgba(34,197,94,0.22)',   text: '#22c55e',               label: 'OK' },
  WARNING: { bg: 'rgba(245,158,11,0.06)',   border: 'rgba(245,158,11,0.22)', text: '#f59e0b',               label: 'Warn' },
  PROBLEM: { bg: 'rgba(239,68,68,0.06)',    border: 'rgba(239,68,68,0.22)',   text: '#ef4444',               label: 'Issue' },
} as const

type PhotoEntry = { key: string; label: string; file: File; previewUrl: string; aiPending: boolean; aiResult?: MockAIResult }
type MockAIResult = { signal: string; severity: 'ok' | 'warn' | 'flag'; detail: string }
type ChecklistRow = { id: string; itemLabel: string; status: ItemStatus; notes?: string | null }

// ─── Simulated AI analysis ─────────────────────────────────────────────────────
const AI_RESPONSES: Record<string, MockAIResult[]> = {
  FRONT:       [{ signal: 'No obvious deformation detected', severity: 'ok', detail: 'Bumper alignment appears consistent with factory spec.' }],
  REAR:        [{ signal: 'Possible minor repaint on rear bumper', severity: 'warn', detail: 'Color tone variance observed between bumper and quarter panel. Further manual inspection recommended.' }],
  LEFT_SIDE:   [{ signal: 'Panel gap inconsistency observed', severity: 'flag', detail: 'Gap between front door and rear door appears wider than factory tolerance. May indicate prior collision repair.' }],
  RIGHT_SIDE:  [{ signal: 'Paint reflection consistent', severity: 'ok', detail: 'No visible tone variation across right side panels.' }],
  HOOD:        [{ signal: 'Possible filler or repaint detected', severity: 'warn', detail: 'Texture inconsistency near hood edge. Color variance may suggest repair. Manual inspection recommended.' }],
  ENGINE_BAY:  [{ signal: 'Fluid residue visible', severity: 'warn', detail: 'Potential oil seep near valve cover. Further inspection by mechanic recommended.' }],
  FRONT_LEFT:  [{ signal: 'Headlight alignment appears normal', severity: 'ok', detail: 'No visible displacement or moisture in headlight housing.' }],
  FRONT_RIGHT: [{ signal: 'No obvious impact markers', severity: 'ok', detail: 'Front right corner structure appears intact.' }],
  ODOMETER:    [{ signal: 'Odometer reading captured', severity: 'ok', detail: 'Reading recorded for cross-reference with service history.' }],
}

function runMockAI(key: string): Promise<MockAIResult> {
  return new Promise(resolve => setTimeout(() => {
    const results = AI_RESPONSES[key]
    const result  = results?.[Math.floor(Math.random() * (results.length || 1))]
    resolve(result ?? { signal: 'No anomalies detected', severity: 'ok', detail: 'Image analysed. No obvious visual issues found.' })
  }, 1400 + Math.random() * 800))
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AIBadge({ result }: Readonly<{ result: MockAIResult }>) {
  const colors = {
    ok:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  text: '#22c55e' },
    warn: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
    flag: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: '#ef4444' },
  }
  const c = colors[result.severity]
  return (
    <div style={{ padding: '8px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 2 }}>{result.signal}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{result.detail}</div>
    </div>
  )
}

function PhotoGrid({ photos, onAdd }: Readonly<{ photos: PhotoEntry[]; onAdd: (key: string, label: string) => void }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {PHOTO_ANGLES.map(angle => {
        const photo = photos.find(p => p.key === angle.key)
        return (
          <div key={angle.key} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: photo ? 'rgba(34,211,238,0.03)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${photo ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 12,
          }}>
            {/* Thumbnail or placeholder */}
            <div style={{
              width: 56, height: 56, borderRadius: 10, flexShrink: 0,
              overflow: 'hidden',
              background: photo ? 'transparent' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${photo ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.previewUrl} alt={angle.label} className="photo-thumb" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
              {photo?.aiPending && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: photo ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                  {angle.label}
                </span>
                {photo && !photo.aiPending && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(34,211,238,0.1)', color: '#22d3ee',
                  }}>AI</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{angle.hint}</div>
              {photo?.aiResult && <AIBadge result={photo.aiResult} />}
            </div>

            {/* Action button */}
            <button
              onClick={() => onAdd(angle.key, angle.label)}
              style={{
                flexShrink: 0,
                width: 40, height: 40,
                background: photo ? 'rgba(255,255,255,0.05)' : 'rgba(34,211,238,0.1)',
                border: `1px solid ${photo ? 'rgba(255,255,255,0.1)' : 'rgba(34,211,238,0.25)'}`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: photo ? 'rgba(255,255,255,0.4)' : '#22d3ee',
              }}
              aria-label={photo ? `Retake ${angle.label}` : `Capture ${angle.label}`}
            >
              {photo ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ChecklistPhase({ items, isLoading, onStatus }: Readonly<{
  items: ChecklistRow[];
  isLoading: boolean;
  onStatus: (id: string, st: ItemStatus) => void
}>) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ height: 60, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>No items for this category</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => {
        const s = STATUS_CFG[item.status]
        return (
          <div key={item.id} style={{
            padding: '13px 14px', borderRadius: 12,
            background: s.bg, border: `1px solid ${s.border}`,
            transition: 'all 0.12s',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: item.status === 'PENDING' ? 'rgba(255,255,255,0.65)' : '#fff', marginBottom: 10, lineHeight: 1.35 }}>
              {item.itemLabel}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['OK', 'WARNING', 'PROBLEM'] as ItemStatus[]).map(st => {
                const cfg = STATUS_CFG[st]
                const sel = item.status === st
                return (
                  <button
                    key={st}
                    onClick={() => onStatus(item.id, st)}
                    style={{
                      flex: 1, padding: '9px 4px', borderRadius: 9,
                      border: `1px solid ${sel ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                      background: sel ? cfg.bg : 'transparent',
                      color: sel ? cfg.text : 'rgba(255,255,255,0.3)',
                      fontSize: 12, fontWeight: sel ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function InspectionPage() {
  const { activeVehicle }       = useVehicleStore()
  const {
    session, currentPhase, checklistItems, isLoadingChecklist, error,
    initSession, setPhase, updateChecklistItem, getItemsByCategory,
  } = useInspectionStore()

  const [photos, setPhotos]         = useState<PhotoEntry[]>([])
  const [cameraTarget, setCameraTarget] = useState<{ key: string; label: string } | null>(null)

  useEffect(() => {
    if (activeVehicle?.id && !session) initSession(activeVehicle.id)
  }, [activeVehicle?.id])

  const phaseIdx  = PHASES.findIndex(p => p.phase === currentPhase)
  const phaseCfg  = PHASES[phaseIdx]
  const items     = phaseCfg?.category ? getItemsByCategory(phaseCfg.category) : []
  const checked   = checklistItems.filter(i => i.status !== 'PENDING').length
  const total     = checklistItems.length
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0
  const photoCount = photos.length

  const goNext = () => { const n = PHASES[phaseIdx + 1]; if (n) setPhase(n.phase) }
  const goPrev = () => { const p = PHASES[phaseIdx - 1]; if (p) setPhase(p.phase) }

  const handleStatus = (itemId: string, status: ItemStatus) => updateChecklistItem(itemId, status)

  const handleOpenCamera = useCallback((key: string, label: string) => {
    setCameraTarget({ key, label })
  }, [])

  const handleCapture = useCallback(async (file: File, previewUrl: string) => {
    if (!cameraTarget) return
    const entry: PhotoEntry = {
      key: cameraTarget.key, label: cameraTarget.label,
      file, previewUrl, aiPending: true,
    }
    setPhotos(prev => {
      const filtered = prev.filter(p => p.key !== cameraTarget.key)
      return [...filtered, entry]
    })
    setCameraTarget(null)

    // Run mock AI analysis
    const result = await runMockAI(cameraTarget.key)
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

  return (
    <AppShell>
      {/* Camera overlay */}
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
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Inspecting</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 1 }}>Progress</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#22d3ee', letterSpacing: '-1px', lineHeight: 1 }}>{progress}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22d3ee, #818cf8)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>

        {/* Phase tabs — horizontal scroll */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {PHASES.map((p, idx) => {
            const isActive = p.phase === currentPhase
            const isDone   = idx < phaseIdx
            return (
              <button
                key={p.phase}
                onClick={() => setPhase(p.phase)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 12px', borderRadius: 10, flexShrink: 0,
                  border: `1px solid ${isActive ? 'rgba(34,211,238,0.3)' : isDone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  background: isActive ? 'rgba(34,211,238,0.09)' : isDone ? 'rgba(34,197,94,0.05)' : 'transparent',
                  color: isActive ? '#22d3ee' : isDone ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {isDone && !isActive
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : p.icon
                }
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Phase content card */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 16px', marginBottom: 14 }}>

          {/* Phase header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{phaseCfg?.label}</div>
              {currentPhase === 'AI_PHOTOS' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {photoCount} photo{photoCount !== 1 ? 's' : ''} captured
                </div>
              )}
              {currentPhase !== 'AI_PHOTOS' && items.length > 0 && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {items.filter(i => i.status !== 'PENDING').length} of {items.length} checked
                </div>
              )}
            </div>
            {currentPhase === 'AI_PHOTOS' && photoCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#22d3ee' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                AI Analysing
              </div>
            )}
          </div>

          {/* Phase-specific content */}
          {currentPhase === 'AI_PHOTOS' && (
            <div>
              <div style={{ padding: '12px 14px', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', marginBottom: 4 }}>AI Photo Inspection</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                  Take photos of each area. Our AI will analyse each image for signs of repair, repainting, panel gaps, or visual anomalies. Results are advisory — always verify manually.
                </div>
              </div>
              <PhotoGrid photos={photos} onAdd={handleOpenCamera} />
            </div>
          )}

          {currentPhase === 'RISK_ANALYSIS' && (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              {/* AI summary from photos */}
              {photoCount > 0 && (
                <div style={{ marginBottom: 20, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Photo Analysis Summary</div>
                  {photos.filter(p => p.aiResult && p.aiResult.severity !== 'ok').map(p => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                        background: p.aiResult?.severity === 'flag' ? '#ef4444' : '#f59e0b',
                      }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{p.aiResult?.signal}</div>
                      </div>
                    </div>
                  ))}
                  {photos.filter(p => p.aiResult && p.aiResult.severity !== 'ok').length === 0 && (
                    <div style={{ fontSize: 13, color: '#22c55e', padding: '8px 0' }}>No flags raised in photo analysis</div>
                  )}
                </div>
              )}
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                Checklist complete. Calculate your full AI confidence score.
              </p>
              <Link href="/report" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '14px 28px', background: '#22d3ee', color: '#000', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                Calculate Risk Score →
              </Link>
            </div>
          )}

          {currentPhase === 'PRE_SCREENING' && (
            <div style={{ marginBottom: 16 }}>
              <ModelResearchGuide
                make={activeVehicle.make}
                model={activeVehicle.model}
                year={activeVehicle.year}
              />
            </div>
          )}

          {currentPhase !== 'AI_PHOTOS' && currentPhase !== 'RISK_ANALYSIS' && (
            <ChecklistPhase items={items} isLoading={isLoadingChecklist} onStatus={handleStatus} />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={goPrev}
            disabled={phaseIdx === 0}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '13px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 14, color: phaseIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
              cursor: phaseIdx === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <button
            onClick={goNext}
            disabled={phaseIdx === PHASES.length - 1}
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '13px', borderRadius: 12,
              background: phaseIdx === PHASES.length - 1 ? 'transparent' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${phaseIdx === PHASES.length - 1 ? 'rgba(255,255,255,0.08)' : 'rgba(34,211,238,0.25)'}`,
              fontSize: 14, fontWeight: 600,
              color: phaseIdx === PHASES.length - 1 ? 'rgba(255,255,255,0.15)' : '#22d3ee',
              cursor: phaseIdx === PHASES.length - 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {phaseIdx === PHASES.length - 2 ? 'Finish' : 'Next'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
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
