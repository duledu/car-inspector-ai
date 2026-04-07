'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVehicleStore } from '@/store'
import type { CreateVehiclePayload, Vehicle } from '@/types'
import AppShell from '../AppShell'

const EMPTY_FORM: CreateVehiclePayload = {
  make: '', model: '', year: new Date().getFullYear(),
  engineCc: undefined, powerKw: undefined,
  mileage: undefined, askingPrice: undefined, currency: 'EUR',
  sellerType: 'PRIVATE', vin: '', notes: '',
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  ACTIVE:   { color: '#22d3ee', label: 'Active' },
  PURCHASED:{ color: '#22c55e', label: 'Purchased' },
  PASSED:   { color: '#6b7280', label: 'Passed' },
  ARCHIVED: { color: '#6b7280', label: 'Archived' },
}

/* ── Segmented control ── */
function Segmented<T extends string>({
  options, value, onChange,
}: Readonly<{ options: ReadonlyArray<{ label: string; value: T }>; value: T; onChange: (v: T) => void }>) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.07)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '8px 0', fontSize: 12, fontWeight: value === opt.value ? 700 : 400,
            borderRadius: 8, border: value === opt.value ? '1px solid rgba(34,211,238,0.25)' : '1px solid transparent',
            background: value === opt.value ? 'rgba(34,211,238,0.1)' : 'transparent',
            color: value === opt.value ? '#22d3ee' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const SELLER_OPTIONS = [
  { label: 'Private', value: 'PRIVATE' },
  { label: 'Dealer', value: 'DEALER' },
  { label: 'Independent', value: 'INDEPENDENT_DEALER' },
] as const

const CURRENCY_OPTIONS = [
  { label: 'EUR', value: 'EUR' },
  { label: 'USD', value: 'USD' },
  { label: 'GBP', value: 'GBP' },
] as const

/* ── Field wrapper ── */
function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function VehiclePage() {
  const router = useRouter()
  const { vehicles, activeVehicle, fetchVehicles, createVehicle, deleteVehicle, setActiveVehicle, isLoading } = useVehicleStore()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<CreateVehiclePayload>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  useEffect(() => { fetchVehicles() }, [])

  const set = (patch: Partial<CreateVehiclePayload>) => setForm(prev => ({ ...prev, ...patch }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const v = await createVehicle(form)
      setActiveVehicle(v)
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'Failed to create vehicle. Please try again.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Remove this vehicle?')) return
    await deleteVehicle(id)
  }

  const handleInspect = (vehicle: Vehicle, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveVehicle(vehicle)
    router.push('/inspection')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, fontSize: 13, color: '#fff',
    fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Vehicles</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {vehicles.length > 0 ? `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} tracked` : 'No vehicles yet'}
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              background: showForm ? 'rgba(255,255,255,0.04)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${showForm ? 'rgba(255,255,255,0.08)' : 'rgba(34,211,238,0.22)'}`,
              color: showForm ? 'rgba(255,255,255,0.45)' : '#22d3ee',
            }}
          >
            {showForm
              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Vehicle</>
            }
          </button>
        </div>

        {/* ── Add vehicle form ── */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,211,238,0.14)',
              borderRadius: 16, padding: '24px', marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 22, letterSpacing: '-0.1px' }}>
              New Vehicle
            </div>

            {/* Row 1: Make / Model / Year */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 14 }}>
              <Field label="Make *">
                <input style={inp} value={form.make} onChange={e => set({ make: e.target.value })} placeholder="BMW" required />
              </Field>
              <Field label="Model *">
                <input style={inp} value={form.model} onChange={e => set({ model: e.target.value })} placeholder="3 Series" required />
              </Field>
              <Field label="Year *">
                <input style={inp} type="number" value={form.year} onChange={e => set({ year: Number.parseInt(e.target.value) })} min={1980} max={new Date().getFullYear() + 1} required />
              </Field>
            </div>

            {/* Row 2: Engine CC / Power kW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
              <Field label="Engine (cc)">
                <div style={{ position: 'relative' }}>
                  <input
                    style={inp} type="number"
                    value={form.engineCc ?? ''}
                    onChange={e => set({ engineCc: e.target.value ? Number.parseInt(e.target.value) : undefined })}
                    placeholder="1995"
                    min={500} max={10000}
                  />
                  {form.engineCc && (
                    <span style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                    }}>
                      {(form.engineCc / 1000).toFixed(1)}L
                    </span>
                  )}
                </div>
              </Field>
              <Field label="Power (kW)">
                <input
                  style={inp} type="number"
                  value={form.powerKw ?? ''}
                  onChange={e => set({ powerKw: e.target.value ? Number.parseInt(e.target.value) : undefined })}
                  placeholder="135"
                  min={1} max={2000}
                />
              </Field>
            </div>

            {/* Row 3: Mileage / Asking Price */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
              <Field label="Mileage (km)">
                <input style={inp} type="number" value={form.mileage ?? ''} onChange={e => set({ mileage: e.target.value ? Number.parseInt(e.target.value) : undefined })} placeholder="85 000" />
              </Field>
              <Field label="Asking Price">
                <input style={inp} type="number" value={form.askingPrice ?? ''} onChange={e => set({ askingPrice: e.target.value ? Number.parseFloat(e.target.value) : undefined })} placeholder="12 500" />
              </Field>
            </div>

            {/* Row 3: Seller type (segmented) */}
            <div style={{ marginBottom: 14 }}>
              <Field label="Seller Type">
                <Segmented
                  options={SELLER_OPTIONS as unknown as { label: string; value: string }[]}
                  value={form.sellerType ?? 'PRIVATE'}
                  onChange={v => set({ sellerType: v as CreateVehiclePayload['sellerType'] })}
                />
              </Field>
            </div>

            {/* Row 4: Currency (segmented) */}
            <div style={{ marginBottom: 14 }}>
              <Field label="Currency">
                <Segmented
                  options={CURRENCY_OPTIONS as unknown as { label: string; value: string }[]}
                  value={form.currency ?? 'EUR'}
                  onChange={v => set({ currency: v })}
                />
              </Field>
            </div>

            {/* Row 5: VIN */}
            <div style={{ marginBottom: 14 }}>
              <Field label="VIN (optional)">
                <input
                  style={{ ...inp, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                  value={form.vin ?? ''} onChange={e => set({ vin: e.target.value })}
                  placeholder="WBA3A5G5XHN123456" maxLength={17}
                />
              </Field>
            </div>

            {/* Row 6: Notes */}
            <div style={{ marginBottom: 20 }}>
              <Field label="Notes">
                <textarea
                  style={{ ...inp, minHeight: 72, resize: 'vertical' }}
                  value={form.notes ?? ''} onChange={e => set({ notes: e.target.value })}
                  placeholder="Any observations about this car…"
                />
              </Field>
            </div>

            {formError && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 9, fontSize: 13, color: '#f87171' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit" disabled={submitting}
                style={{
                  padding: '11px 24px', background: submitting ? 'rgba(34,211,238,0.5)' : '#22d3ee',
                  color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? 'Saving…' : 'Save Vehicle'}
              </button>
              <button
                type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                style={{
                  padding: '11px 18px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Vehicle list ── */}
        {isLoading && vehicles.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2].map(n => (
              <div key={n} className="skeleton" style={{ height: 80, borderRadius: 14 }} />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          /* Empty state */
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16,
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 15, margin: '0 auto 18px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>No vehicles yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>Add your first vehicle to start an AI inspection.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vehicles.map((vehicle) => {
              const isActive = activeVehicle?.id === vehicle.id
              const meta = STATUS_META[vehicle.status] ?? STATUS_META.ARCHIVED
              return (
                <div
                  key={vehicle.id}
                  style={{
                    padding: '16px 20px',
                    background: isActive ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Left: info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </span>
                      {/* Status pill */}
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
                        borderRadius: 5, padding: '2px 7px',
                      }}>
                        {meta.label}
                      </span>
                      {isActive && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#22d3ee', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)',
                          borderRadius: 5, padding: '2px 7px',
                        }}>
                          Selected
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.32)' }}>
                      {vehicle.mileage && <span>{vehicle.mileage.toLocaleString()} km</span>}
                      {vehicle.askingPrice && <span>{vehicle.askingPrice.toLocaleString()} {vehicle.currency}</span>}
                      {vehicle.vin && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>VIN {vehicle.vin}</span>}
                      <span>{vehicle.sellerType.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                    <button
                      onClick={e => handleInspect(vehicle, e)}
                      style={{
                        padding: '10px 16px', background: 'rgba(34,211,238,0.09)',
                        border: '1px solid rgba(34,211,238,0.2)', borderRadius: 9,
                        fontSize: 13, fontWeight: 600, color: '#22d3ee', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        minHeight: 44,
                      }}
                    >
                      Inspect
                    </button>
                    <button
                      onClick={e => handleDelete(vehicle.id, e)}
                      style={{
                        padding: '10px 12px', background: 'transparent',
                        border: '1px solid rgba(239,68,68,0.15)', borderRadius: 9,
                        fontSize: 13, color: 'rgba(239,68,68,0.55)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        minHeight: 44,
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
