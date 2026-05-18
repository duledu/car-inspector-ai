'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { paymentApi, type ProductPriceDto } from '@/services/api/payment.api'
import type { Vehicle } from '@/types'

interface Props {
  vehicle?: Vehicle
  promoCode: string
  promoLoading: boolean
  promoError: string | null
  promoSuccess?: string | null
  calculating?: boolean
  hasActiveAccess?: boolean
  purchaseLoading?: boolean
  purchaseError?: string | null
  onPromoCodeChange: (value: string) => void
  onRedeemPromo: () => void | Promise<void>
  onContinue: () => void | Promise<void>
  onPurchase: () => void | Promise<void>
}

function vehicleTitle(vehicle?: Vehicle): string {
  if (!vehicle) return ''
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

const BENEFITS = [
  {
    titleKey: 'report.accessGate.benefit.aiPhotoAnalysis',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  },
  {
    titleKey: 'report.accessGate.benefit.riskScore',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    titleKey: 'report.accessGate.benefit.negotiation',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    titleKey: 'report.accessGate.benefit.pdfExport',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
] as const

export function InspectionReportAccessGate({
  vehicle,
  promoCode,
  promoLoading,
  promoError,
  promoSuccess,
  calculating = false,
  hasActiveAccess = false,
  purchaseLoading = false,
  purchaseError = null,
  onPromoCodeChange,
  onRedeemPromo,
  onContinue,
  onPurchase,
}: Props) {
  const { t, i18n } = useTranslation()
  const [showPromo, setShowPromo] = useState(false)
  const [price, setPrice] = useState<ProductPriceDto | null>(null)
  const isBusy = promoLoading || calculating || purchaseLoading
  const hasRedeemedAccess = hasActiveAccess || Boolean(promoSuccess)
  const title = vehicleTitle(vehicle)
  const vin = vehicle?.vin ?? null
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const priceLabel = price?.formatted ?? '…'

  useEffect(() => {
    let cancelled = false
    setPrice(null)
    paymentApi.getPrice('INSPECTION_REPORT', locale)
      .then(nextPrice => { if (!cancelled) setPrice(nextPrice) })
      .catch(() => { if (!cancelled) setPrice(null) })
    return () => { cancelled = true }
  }, [locale])

  return (
    <section aria-labelledby="access-gate-title">

      {/* ── Vehicle identity ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('report.accessGate.summaryTitle')}
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: vin ? 4 : 0 }}>
          {title || t('report.accessGate.vehicleFallback')}
        </div>
        {vin && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginTop: 2 }}>
            {vin}
          </div>
        )}
      </div>

      {/* ── Headline + body ── */}
      <div style={{ marginBottom: 22 }}>
        <h2 id="access-gate-title" style={{ margin: '0 0 10px', fontSize: 'clamp(20px, 3.5vw, 24px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.18 }}>
          {hasRedeemedAccess ? t('report.accessGate.readyTitle') : t('report.accessGate.headline')}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.52)', lineHeight: 1.68 }}>
          {hasRedeemedAccess ? t('report.accessGate.readyBody') : t('report.accessGate.body')}
        </p>
      </div>

      {/* ── Status pill ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '7px 13px', borderRadius: 999,
          background: hasRedeemedAccess ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${hasRedeemedAccess ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          {hasRedeemedAccess ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: hasRedeemedAccess ? '#86efac' : 'rgba(255,255,255,0.6)' }}>
            {hasRedeemedAccess ? t('report.accessGate.statusReady') : t('report.accessGate.statusLocked')}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
            {hasRedeemedAccess ? t('report.accessGate.creditsAvailableOne') : t('report.accessGate.creditsAvailableZero')}
          </span>
        </div>
      </div>

      {/* ── Success message ── */}
      {promoSuccess && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '12px 14px', marginBottom: 16,
          background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 12,
          fontSize: 13, color: '#86efac', lineHeight: 1.55,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>{promoSuccess}</span>
        </div>
      )}

      {/* ── Error message ── */}
      {purchaseError && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '11px 14px', marginBottom: 16,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 12,
          fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{purchaseError}</span>
        </div>
      )}

      {/* ── Primary CTA ── */}
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="gate-primary-cta"
          onClick={hasRedeemedAccess ? onContinue : onPurchase}
          disabled={isBusy}
          aria-busy={hasRedeemedAccess ? calculating : purchaseLoading}
        >
          {hasRedeemedAccess && calculating ? (
            <>
              <Loader2 className="gate-spin" size={17} />
              {t('report.accessGate.continuing')}
            </>
          ) : !hasRedeemedAccess && purchaseLoading ? (
            <>
              <Loader2 className="gate-spin" size={17} />
              {t('report.accessGate.preparingCheckout')}
            </>
          ) : (
            <>
              {hasRedeemedAccess
                ? t('report.accessGate.generateNow')
                : t('report.accessGate.purchaseReport', { price: priceLabel })}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </>
          )}
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', textAlign: 'center', marginTop: 9, lineHeight: 1.5 }}>
          {hasRedeemedAccess ? t('report.accessGate.readyCtaSubtext') : t('report.accessGate.ctaSubtext')}
        </div>
      </div>

      {/* ── Promo toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button
          type="button"
          className="gate-promo-toggle"
          onClick={() => setShowPromo(v => !v)}
          disabled={isBusy}
          aria-expanded={showPromo || Boolean(promoError)}
          aria-controls="gate-promo-panel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          {showPromo ? t('report.accessGate.hidePromo') : t('report.accessGate.havePromo')}
        </button>
      </div>

      {/* ── What's included ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
          {t('report.accessGate.includedTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px' }}>
          {BENEFITS.map(({ titleKey, icon }) => (
            <div key={titleKey} style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 28 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#67e8f9' }}>
                {icon}
              </div>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.3 }}>
                {t(titleKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Promo panel ── */}
      {(showPromo || promoError) && (
        <form
          id="gate-promo-panel"
          onSubmit={e => { e.preventDefault(); if (!isBusy) void onRedeemPromo() }}
          style={{ marginBottom: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'grid', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'rgba(251,191,36,0.09)', border: '1px solid rgba(251,191,36,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{t('report.accessGate.promoTitle')}</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', marginTop: 2, lineHeight: 1.4 }}>{t('report.accessGate.promoHint')}</div>
            </div>
          </div>

          <div className="gate-promo-controls">
            <label className="gate-sr-only" htmlFor="gate-promo-code">{t('report.accessRequired.promoLabel')}</label>
            <input
              id="gate-promo-code"
              className="gate-promo-input"
              value={promoCode}
              onChange={e => onPromoCodeChange(e.target.value)}
              disabled={isBusy}
              autoComplete="off"
              placeholder={t('report.accessRequired.promoPlaceholder')}
            />
            <button type="submit" className="gate-promo-submit" disabled={isBusy}>
              {promoLoading ? (
                <><Loader2 className="gate-spin" size={14} />{t('report.accessRequired.validatingPromo')}</>
              ) : t('report.accessRequired.applyPromo')}
            </button>
          </div>

          {promoError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px',
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)', borderRadius: 10,
              fontSize: 12.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.55,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{promoError}</span>
            </div>
          )}
        </form>
      )}

      {/* ── Footer note ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(134,239,172,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>{hasRedeemedAccess ? t('report.accessGate.readyCtaSubtext') : t('report.accessGate.existingReports')}</span>
      </div>

      <style jsx>{`
        /* Primary CTA */
        .gate-primary-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 56px;
          padding: 0 24px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
          color: #041014;
          font-size: 15px;
          font-weight: 800;
          font-family: var(--font-sans);
          letter-spacing: -0.2px;
          cursor: pointer;
          box-shadow: 0 8px 28px rgba(34,211,238,0.32), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: box-shadow 0.18s ease, transform 0.12s ease, background 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .gate-primary-cta:hover:not(:disabled) {
          box-shadow: 0 12px 36px rgba(34,211,238,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
          transform: translateY(-1px);
        }
        .gate-primary-cta:active:not(:disabled) {
          transform: translateY(0);
        }
        .gate-primary-cta:disabled {
          background: rgba(34,211,238,0.22);
          color: rgba(4,16,20,0.5);
          box-shadow: none;
          cursor: not-allowed;
        }

        /* Promo toggle */
        .gate-promo-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 0 10px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: rgba(255,255,255,0.42);
          font-size: 12px;
          font-weight: 500;
          font-family: var(--font-sans);
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .gate-promo-toggle:hover:not(:disabled) {
          color: rgba(255,255,255,0.72);
          background: rgba(255,255,255,0.04);
        }
        .gate-promo-toggle:disabled {
          color: rgba(255,255,255,0.22);
          cursor: not-allowed;
        }

        /* Promo controls layout */
        .gate-promo-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        /* Promo input */
        .gate-promo-input {
          min-height: 44px;
          min-width: 0;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-family: var(--font-sans);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .gate-promo-input::placeholder {
          color: rgba(255,255,255,0.28);
        }
        .gate-promo-input:focus {
          border-color: rgba(34,211,238,0.4);
        }

        /* Promo submit */
        .gate-promo-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px;
          background: rgba(255,255,255,0.9);
          color: #071114;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-sans);
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .gate-promo-submit:hover:not(:disabled) {
          background: #fff;
        }
        .gate-promo-submit:disabled {
          background: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.4);
          cursor: not-allowed;
        }

        /* Screen reader only */
        .gate-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Spinner */
        .gate-spin {
          animation: gate-spin 900ms linear infinite;
          flex-shrink: 0;
        }
        @keyframes gate-spin {
          to { transform: rotate(360deg); }
        }

        /* Mobile */
        @media (max-width: 480px) {
          .gate-primary-cta {
            min-height: 58px;
            font-size: 14px;
          }
          .gate-promo-controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
