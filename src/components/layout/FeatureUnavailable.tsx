'use client'

import AppShell from '@/app/AppShell'

type FeatureUnavailableProps = Readonly<{
  title: string
  description: string
}>

export function FeatureUnavailable({ title, description }: FeatureUnavailableProps) {
  return (
    <AppShell>
      <div style={{ maxWidth: 680 }}>
        <div style={{
          padding: '40px 32px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Coming soon
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            {title}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.46)' }}>
            {description}
          </p>
        </div>
      </div>
    </AppShell>
  )
}

