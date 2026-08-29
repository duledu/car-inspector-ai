'use client'

// =============================================================================
// ConsentCheckboxRow — one mandatory, never-pre-checked consent acknowledgement
// Shared by the signup form (/auth) and the consent-required gate
// (/consent-required) so both present the exact same control.
// =============================================================================

export function ConsentCheckboxRow({ id, checked, touched, onChange, label, errorText }: Readonly<{
  id: string
  checked: boolean
  touched: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  errorText: string
}>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          padding: '11px 12px',
          borderRadius: 10,
          background: touched && !checked ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.025)',
          border: `1px solid ${touched && !checked ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.08)'}`,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <span style={{ position: 'relative', width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            style={{
              position: 'absolute',
              inset: 0,
              width: 22,
              height: 22,
              margin: 0,
              opacity: 0,
              cursor: 'pointer',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: checked ? '#22d3ee' : 'rgba(255,255,255,0.045)',
              border: `1px solid ${checked ? '#22d3ee' : 'rgba(255,255,255,0.2)'}`,
              boxShadow: checked ? '0 0 0 3px rgba(34,211,238,0.12)' : 'inset 0 0 0 1px rgba(0,0,0,0.2)',
              color: '#020617',
              transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {checked && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>{label}</span>
      </label>
      {touched && !checked && (
        <div role="alert" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 2, fontSize: 12, color: '#f87171' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {errorText}
        </div>
      )}
    </div>
  )
}
