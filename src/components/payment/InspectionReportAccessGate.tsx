'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Gauge,
  KeyRound,
  Loader2,
  LockKeyhole,
  TrendingDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

type Benefit = {
  icon: LucideIcon
  titleKey: string
}

const BENEFITS: Benefit[] = [
  {
    icon: Camera,
    titleKey: 'report.accessGate.benefit.aiPhotoAnalysis',
  },
  {
    icon: Gauge,
    titleKey: 'report.accessGate.benefit.riskScore',
  },
  {
    icon: TrendingDown,
    titleKey: 'report.accessGate.benefit.negotiation',
  },
  {
    icon: FileText,
    titleKey: 'report.accessGate.benefit.pdfExport',
  },
]

function vehicleTitle(vehicle?: Vehicle): string {
  if (!vehicle) return ''
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

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
  const vin = vehicle?.vin ? vehicle.vin : t('report.accessGate.vinUnavailable')
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const priceLabel = price?.formatted ?? t('common.loading')

  useEffect(() => {
    let cancelled = false
    setPrice(null)
    paymentApi.getPrice('INSPECTION_REPORT', locale)
      .then((nextPrice) => {
        if (!cancelled) setPrice(nextPrice)
      })
      .catch(() => {
        if (!cancelled) setPrice(null)
      })
    return () => {
      cancelled = true
    }
  }, [locale])

  return (
    <section className="accessGate" aria-labelledby="inspection-report-access-title">
      <div className="vehicleAnchor" aria-label={t('report.accessGate.summaryTitle')}>
        <div className="vehicleText">
          <span className="vehicleLabel">{t('report.accessGate.summaryTitle')}</span>
          <strong>{title || t('report.accessGate.vehicleFallback')}</strong>
        </div>
        <span className="vin">{vin}</span>
      </div>

      <div className="headerBlock">
        <h2 id="inspection-report-access-title">{t('report.accessGate.headline')}</h2>
        <p>{hasRedeemedAccess ? t('report.accessGate.readyBody') : t('report.accessGate.body')}</p>
      </div>

      <div className={hasRedeemedAccess ? 'statusBlock ready' : 'statusBlock'}>
        <div className="statusIcon" aria-hidden="true">
          {hasRedeemedAccess ? <CheckCircle2 size={22} /> : <LockKeyhole size={22} />}
        </div>
        <div className="statusCopy">
          <div className="statusLabel">
            {hasRedeemedAccess ? t('report.accessGate.statusReady') : t('report.accessGate.statusLocked')}
          </div>
          <div className="statusLine">
            {hasRedeemedAccess ? t('report.accessGate.creditsAvailableOne') : t('report.accessGate.creditsAvailableZero')}
          </div>
        </div>
        <div className="statusRequirement">
          {hasRedeemedAccess ? t('report.accessGate.statusReadyLine') : t('report.accessGate.statusLockedLine')}
        </div>
      </div>

      {promoSuccess && (
        <div className="stateMessage success" role="status">
          <CheckCircle2 size={17} />
          <span>{promoSuccess}</span>
        </div>
      )}

      {purchaseError && (
        <div className="stateMessage error" role="alert">
          <AlertCircle size={17} />
          <span>{purchaseError}</span>
        </div>
      )}

      <div className="ctaPanel">
        <div className="primaryAction">
          <button
            type="button"
            className="primaryCta"
            onClick={hasRedeemedAccess ? onContinue : onPurchase}
            disabled={isBusy}
            aria-busy={hasRedeemedAccess ? calculating : purchaseLoading}
          >
            {hasRedeemedAccess && calculating ? (
              <>
                <Loader2 className="spin" size={18} />
                {t('report.accessGate.continuing')}
              </>
            ) : !hasRedeemedAccess && purchaseLoading ? (
              <>
                <Loader2 className="spin" size={18} />
                {t('report.accessGate.preparingCheckout')}
              </>
            ) : (
              <>
                {hasRedeemedAccess ? t('report.accessGate.generateNow') : t('report.accessGate.purchaseReport', { price: priceLabel })}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <div className="ctaSubtext">
            {hasRedeemedAccess ? t('report.accessGate.readyCtaSubtext') : t('report.accessGate.ctaSubtext')}
          </div>
        </div>

        <button
          type="button"
          className="promoToggle"
          onClick={() => setShowPromo((value) => !value)}
          disabled={isBusy}
          aria-expanded={showPromo || Boolean(promoError)}
          aria-controls="inspection-promo-panel"
        >
          <KeyRound size={17} />
          {showPromo ? t('report.accessGate.hidePromo') : t('report.accessGate.havePromo')}
        </button>
      </div>

      <div className="includesSection" aria-label={t('report.accessGate.includedTitle')}>
        <div className="sectionTitle">{t('report.accessGate.includedTitle')}</div>
        <div className="benefitList">
          {BENEFITS.map(({ icon: Icon, titleKey }) => (
            <div className="benefitItem" key={titleKey}>
              <Icon size={16} />
              <span>{t(titleKey)}</span>
            </div>
          ))}
        </div>
      </div>

      {(showPromo || promoError) && (
        <form
          id="inspection-promo-panel"
          className="promoPanel"
          onSubmit={(event) => {
            event.preventDefault()
            if (!isBusy) void onRedeemPromo()
          }}
        >
          <div className="promoHeader">
            <div className="promoIcon"><KeyRound size={18} /></div>
            <div>
              <div className="promoTitle">{t('report.accessGate.promoTitle')}</div>
              <div className="promoHint">{t('report.accessGate.promoHint')}</div>
            </div>
          </div>

          <div className="promoControls">
            <label className="srOnly" htmlFor="inspection-promo-code">
              {t('report.accessRequired.promoLabel')}
            </label>
            <input
              id="inspection-promo-code"
              value={promoCode}
              onChange={(event) => onPromoCodeChange(event.target.value)}
              disabled={isBusy}
              autoComplete="off"
              placeholder={t('report.accessRequired.promoPlaceholder')}
            />
            <button type="submit" disabled={isBusy}>
              {promoLoading ? (
                <>
                  <Loader2 className="spin" size={16} />
                  {t('report.accessRequired.validatingPromo')}
                </>
              ) : (
                t('report.accessRequired.applyPromo')
              )}
            </button>
          </div>

          {promoError && (
            <div className="stateMessage error" role="alert">
              <AlertCircle size={17} />
              <span>{promoError}</span>
            </div>
          )}
        </form>
      )}

      <div className="accessNote">
        <CheckCircle2 size={16} />
        <span>{hasRedeemedAccess ? t('report.accessGate.readyCtaSubtext') : t('report.accessGate.existingReports')}</span>
      </div>

      <style jsx>{`
        .accessGate {
          position: relative;
          display: grid;
          gap: 16px;
          padding: 24px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          background: rgba(8, 17, 22, 0.78);
          box-shadow: 0 18px 54px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.045);
        }

        .vehicleAnchor {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 56px;
          padding: 12px 16px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          background: rgba(255,255,255,0.035);
        }

        .vehicleText {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .vehicleLabel {
          color: rgba(255,255,255,0.42);
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
        }

        .vehicleText strong {
          color: rgba(255,255,255,0.92);
          font-size: 14px;
          font-weight: 760;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vin {
          flex-shrink: 0;
          max-width: 48%;
          color: rgba(255,255,255,0.48);
          font-family: var(--font-mono);
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
          text-align: right;
        }

        .headerBlock {
          display: grid;
          gap: 8px;
          padding: 0 2px;
        }

        h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          font-weight: 720;
          line-height: 1.18;
          letter-spacing: 0;
        }

        p {
          margin: 0;
          color: rgba(255,255,255,0.62);
          font-size: 18px;
          line-height: 1.55;
        }

        .statusBlock {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
        }

        .statusBlock.ready {
          border-color: rgba(134,239,172,0.18);
          background: rgba(34,197,94,0.055);
        }

        .statusIcon,
        .promoIcon {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
        }

        .statusIcon {
          color: #cbd5e1;
          background: rgba(255,255,255,0.07);
        }

        .ready .statusIcon {
          color: #86efac;
          background: rgba(34,197,94,0.11);
        }

        .statusCopy {
          min-width: 0;
          flex: 1;
        }

        .statusLabel {
          color: #fff;
          font-size: 15px;
          font-weight: 760;
          line-height: 1.35;
        }

        .statusLine {
          margin-top: 2px;
          color: rgba(255,255,255,0.52);
          font-size: 12px;
          line-height: 1.45;
        }

        .statusRequirement {
          flex-shrink: 0;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: rgba(255,255,255,0.72);
          font-size: 12px;
          font-weight: 720;
          line-height: 1.2;
          white-space: nowrap;
        }

        .ready .statusRequirement {
          color: #bbf7d0;
          border-color: rgba(134,239,172,0.18);
        }

        .includesSection {
          display: grid;
          gap: 12px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          background: rgba(255,255,255,0.025);
        }

        .sectionTitle {
          color: rgba(255,255,255,0.9);
          font-size: 13px;
          font-weight: 760;
          line-height: 1.25;
        }

        .benefitList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 16px;
        }

        .benefitItem {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          min-height: 24px;
          color: rgba(255,255,255,0.64);
          font-size: 12px;
          line-height: 1.35;
        }

        .benefitItem svg {
          flex-shrink: 0;
          color: #67e8f9;
        }

        .ctaPanel {
          display: grid;
          gap: 8px;
        }

        .primaryAction {
          display: grid;
          gap: 7px;
        }

        button {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          font-family: var(--font-sans);
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
        }

        button:focus-visible,
        input:focus-visible {
          outline: 2px solid rgba(103,232,249,0.8);
          outline-offset: 2px;
        }

        .primaryCta {
          padding: 0 20px;
          border: 1px solid rgba(103,232,249,0.42);
          background: #67e8f9;
          color: #061014;
          font-size: 14px;
          font-weight: 820;
          box-shadow: 0 12px 28px rgba(34,211,238,0.16);
          transition: background 160ms ease, box-shadow 160ms ease;
        }

        .primaryCta:hover:not(:disabled) {
          background: #8be9f5;
          box-shadow: 0 16px 34px rgba(34,211,238,0.2);
        }

        .primaryCta:disabled {
          background: rgba(103,232,249,0.28);
          color: rgba(6,16,20,0.74);
          box-shadow: none;
        }

        .promoToggle {
          width: fit-content;
          min-height: 40px;
          justify-self: center;
          padding: 0 12px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,0.62);
          font-size: 12px;
          font-weight: 720;
          transition: color 160ms ease, background 160ms ease;
        }

        .promoToggle:hover:not(:disabled) {
          color: rgba(255,255,255,0.86);
          background: rgba(255,255,255,0.04);
        }

        .promoToggle:disabled {
          color: rgba(255,255,255,0.34);
        }

        .ctaSubtext {
          color: rgba(255,255,255,0.48);
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        .promoPanel {
          display: grid;
          gap: 13px;
          padding: 15px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          background: rgba(4,16,20,0.58);
        }

        .promoHeader {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .promoIcon {
          color: #fbbf24;
          background: rgba(251,191,36,0.1);
        }

        .promoTitle {
          color: #fff;
          font-size: 13px;
          font-weight: 760;
          line-height: 1.3;
        }

        .promoHint {
          margin-top: 3px;
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          line-height: 1.5;
        }

        .promoControls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(132px, auto);
          gap: 9px;
        }

        input {
          min-height: 48px;
          min-width: 0;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-family: var(--font-sans);
          font-size: 16px;
        }

        input::placeholder {
          color: rgba(255,255,255,0.34);
        }

        .promoControls button {
          padding: 0 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.92);
          color: #071114;
          font-size: 13px;
          font-weight: 820;
        }

        .promoControls button:disabled {
          background: rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.5);
        }

        .stateMessage {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 12px 13px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
        }

        .stateMessage svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .stateMessage.success {
          border: 1px solid rgba(134,239,172,0.24);
          background: rgba(34,197,94,0.08);
          color: #bbf7d0;
        }

        .stateMessage.error {
          border: 1px solid rgba(252,165,165,0.24);
          background: rgba(239,68,68,0.08);
          color: #fecaca;
        }

        .accessNote {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          color: rgba(255,255,255,0.56);
          font-size: 11px;
          line-height: 1.6;
        }

        .accessNote svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: #86efac;
        }

        .srOnly {
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

        .spin {
          animation: spin 900ms linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 560px) {
          .accessGate {
            gap: 16px;
            padding: 16px;
            border-radius: 18px;
          }

          .vehicleAnchor {
            align-items: flex-start;
            gap: 8px;
            padding: 12px;
          }

          h2 {
            font-size: 22px;
            line-height: 1.22;
          }

          p {
            font-size: 13px;
            line-height: 1.65;
          }

          .vin {
            max-width: 42%;
          }

          .statusBlock {
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
          }

          .statusRequirement {
            display: none;
          }

          .benefitList {
            grid-template-columns: 1fr;
          }

          .promoControls {
            grid-template-columns: 1fr;
          }

          .primaryCta,
          .promoControls button {
            width: 100%;
            min-height: 52px;
          }

          .promoToggle {
            width: fit-content;
          }
        }
      `}</style>
    </section>
  )
}
