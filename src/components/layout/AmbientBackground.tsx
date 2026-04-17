interface AmbientBackgroundProps {
  readonly variant?: 'desktop' | 'mobile'
  readonly context?: 'default' | 'app' | 'inspection'
}

export function AmbientBackground({ variant = 'mobile', context = 'default' }: AmbientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`ambient-background ambient-background--${variant} ambient-background--${context}`}
    >
      <div className="ambient-background__horizon" />
      <div className="ambient-background__arc ambient-background__arc--outer" />
      <div className="ambient-background__arc ambient-background__arc--inner" />
      {context !== 'app' && context !== 'inspection' && (
        <div className="ambient-background__scan" />
      )}
      {(context === 'default' || variant === 'desktop') && (
        <>
          <div className="ambient-background__scan-dot" />
        </>
      )}
      {(context === 'app' || (context === 'inspection' && variant === 'desktop')) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/icons/background_new.png" alt="" className="ambient-background__app-car" />
      )}
    </div>
  )
}
