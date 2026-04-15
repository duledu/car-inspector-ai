interface AmbientBackgroundProps {
  readonly variant?: 'desktop' | 'mobile'
}

export function AmbientBackground({ variant = 'mobile' }: AmbientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`ambient-background ambient-background--${variant}`}
    >
      <div className="ambient-background__horizon" />
      <div className="ambient-background__arc ambient-background__arc--outer" />
      <div className="ambient-background__arc ambient-background__arc--inner" />
      <div className="ambient-background__scan" />
      <div className="ambient-background__scan-dot" />
    </div>
  )
}
