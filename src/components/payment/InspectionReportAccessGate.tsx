'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  Gauge,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Vehicle } from '@/types'

interface Props {
  vehicle?: Vehicle
  promoCode: string
  promoLoading: boolean
  promoError: string | null
  promoSuccess?: string | null
  calculating?: boolean
  onPromoCodeChange: (value: string) => void
  onRedeemPromo: () => void | Promise<void>
  onContinue: () => void | Promise<void>
}

type Benefit = {
  icon: LucideIcon
  titleKey: string
  descKey: string
}

const BENEFITS: Benefit[] = [
  {
    icon: Camera,
    titleKey: 'report.accessGate.benefit.aiPhotoAnalysis',
    descKey: 'report.accessGate.benefit.aiPhotoAnalysisDesc',
  },
  {
    icon: Gauge,
    titleKey: 'report.accessGate.benefit.riskScore',
    descKey: 'report.accessGate.benefit.riskScoreDesc',
  },
  {
    icon: TrendingDown,
    titleKey: 'report.accessGate.benefit.negotiation',
    descKey: 'report.accessGate.benefit.negotiationDesc',
  },
  {
    icon: FileText,
    titleKey: 'report.accessGate.benefit.pdfExport',
    descKey: 'report.accessGate.benefit.pdfExportDesc',
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
  onPromoCodeChange,
  onRedeemPromo,
  onContinue,
}: Props) {
  const { t } = useTranslation()
  const [showPromo, setShowPromo] = useState(false)
  const isBusy = promoLoading || calculating
  const hasRedeemedAccess = Boolean(promoSuccess)
  const title = vehicleTitle(vehicle)

  return (
    <section className="accessGate" aria-labelledby="inspection-report-access-title">
      <div className="heroPanel">
        <div className="intro">
          <div className={hasRedeemedAccess ? 'statusPill ready' : 'statusPill'}>
            {hasRedeemedAccess ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
            {hasRedeemedAccess ? t('report.accessGate.readyBadge') : t('report.accessGate.badge')}
          </div>

          <div className="copyStack">
            <h2 id="inspection-report-access-title">{t('report.accessGate.headline')}</h2>
            <p>{t('report.accessGate.body')}</p>
          </div>

          <div className="assuranceRow" aria-label={t('report.accessGate.assuranceLabel')}>
            <span><CheckCircle2 size={15} />{t('report.accessGate.assurance.oneCredit')}</span>
            <span><CheckCircle2 size={15} />{t('report.accessGate.assurance.lockedReports')}</span>
            <span><CheckCircle2 size={15} />{t('report.accessGate.assurance.pdfExport')}</span>
          </div>
        </div>

        <aside className="summaryPanel" aria-label={t('report.accessGate.summaryTitle')}>
          <div>
            <div className="summaryEyebrow">{t('report.accessGate.summaryTitle')}</div>
            <div className="summaryTitle">{title || t('report.accessGate.vehicleFallback')}</div>
            {vehicle?.vin && <div className="vin">{vehicle.vin}</div>}
          </div>

          <div className="reportPreview" aria-label={t('report.accessGate.previewTitle')}>
            <div>
              <span>{t('report.accessGate.preview.ai')}</span>
              <strong>{t('report.accessGate.preview.ready')}</strong>
            </div>
            <div>
              <span>{t('report.accessGate.preview.risk')}</span>
              <strong>{t('report.accessGate.preview.calculated')}</strong>
            </div>
            <div>
              <span>{t('report.accessGate.preview.pdf')}</span>
              <strong>{t('report.accessGate.preview.included')}</strong>
            </div>
          </div>

          <div className="creditBox">
            <div className="creditIcon"><BadgeCheck size={18} /></div>
            <div>
              <div className="creditTitle">
                {hasRedeemedAccess ? t('report.accessGate.readyTitle') : t('report.accessGate.creditTitle')}
              </div>
              <div className="creditBody">
                {hasRedeemedAccess ? t('report.accessGate.readyBody') : t('report.accessGate.creditBody')}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="valueSection">
        <div className="sectionHeader">
          <div className="sectionTitle">{t('report.accessGate.includedTitle')}</div>
          <div className="sectionText">{t('report.accessGate.includedSubtitle')}</div>
        </div>

        <div className="benefitGrid" aria-label={t('report.accessGate.includedTitle')}>
          {BENEFITS.map(({ icon: Icon, titleKey, descKey }) => (
            <div className="benefitCard" key={titleKey}>
              <div className="benefitIcon"><Icon size={18} /></div>
              <div>
                <div className="benefitTitle">{t(titleKey)}</div>
                <div className="benefitText">{t(descKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="trustPanel" aria-label={t('report.accessGate.trustTitle')}>
        <div className="trustItem">
          <ShieldCheck size={17} />
          <span>{t('report.accessGate.trust.costlyMistakes')}</span>
        </div>
        <div className="trustItem">
          <Gauge size={17} />
          <span>{t('report.accessGate.trust.inspectionLogic')}</span>
        </div>
        <div className="trustItem">
          <LockKeyhole size={17} />
          <span>{t('report.accessGate.trust.lockedSnapshot')}</span>
        </div>
      </div>

      {promoSuccess && (
        <div className="stateMessage success" role="status">
          <CheckCircle2 size={17} />
          <span>{promoSuccess}</span>
        </div>
      )}

      <div className="ctaPanel">
        <div className="primaryAction">
          <button
            type="button"
            className="primaryCta"
            onClick={onContinue}
            disabled={isBusy}
            aria-busy={calculating}
          >
            {calculating ? (
              <>
                <Loader2 className="spin" size={18} />
                {t('report.accessGate.continuing')}
              </>
            ) : (
              <>
                {hasRedeemedAccess ? t('report.accessGate.generateNow') : t('report.accessGate.continue')}
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
        <span>{t('report.accessGate.existingReports')}</span>
      </div>

      <style jsx>{`
        .accessGate {
          position: relative;
          display: grid;
          gap: 18px;
          padding: clamp(18px, 3.5vw, 30px);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)),
            radial-gradient(circle at 10% 0%, rgba(34,211,238,0.14), transparent 30%);
          box-shadow: 0 28px 90px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .accessGate::before {
          content: '';
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(90deg, #67e8f9, #a7f3d0, rgba(255,255,255,0.22));
        }

        .heroPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
          gap: clamp(18px, 3vw, 30px);
          align-items: stretch;
        }

        .intro {
          display: grid;
          align-content: center;
          gap: 18px;
          min-width: 0;
        }

        .statusPill {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border: 1px solid rgba(103,232,249,0.24);
          border-radius: 999px;
          background: rgba(34,211,238,0.08);
          color: #8be9f5;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.08em;
          line-height: 1;
          text-transform: uppercase;
        }

        .statusPill.ready {
          border-color: rgba(134,239,172,0.28);
          background: rgba(34,197,94,0.09);
          color: #86efac;
        }

        .copyStack {
          display: grid;
          gap: 10px;
          max-width: 680px;
        }

        h2 {
          margin: 0;
          color: #fff;
          font-size: clamp(30px, 4.8vw, 48px);
          font-weight: 900;
          line-height: 1.03;
        }

        p {
          max-width: 640px;
          margin: 0;
          color: rgba(255,255,255,0.68);
          font-size: 15px;
          line-height: 1.7;
        }

        .assuranceRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .assuranceRow span {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          color: rgba(255,255,255,0.72);
          font-size: 12px;
          font-weight: 750;
          line-height: 1.2;
        }

        .assuranceRow svg {
          color: #86efac;
          flex-shrink: 0;
        }

        .summaryPanel {
          display: grid;
          gap: 14px;
          align-content: space-between;
          min-height: 240px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          background: rgba(4,16,20,0.54);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .summaryEyebrow {
          margin-bottom: 8px;
          color: rgba(255,255,255,0.44);
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-transform: uppercase;
        }

        .summaryTitle {
          color: #fff;
          font-size: 18px;
          font-weight: 850;
          line-height: 1.28;
        }

        .vin {
          margin-top: 8px;
          color: rgba(255,255,255,0.5);
          font-family: var(--font-mono);
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .reportPreview {
          display: grid;
          gap: 8px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 15px;
          background: rgba(255,255,255,0.035);
        }

        .reportPreview div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 27px;
          color: rgba(255,255,255,0.52);
          font-size: 12px;
        }

        .reportPreview strong {
          color: rgba(255,255,255,0.86);
          font-size: 12px;
          font-weight: 850;
          text-align: right;
          white-space: nowrap;
        }

        .creditBox {
          display: flex;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(103,232,249,0.16);
          border-radius: 16px;
          background: rgba(34,211,238,0.07);
        }

        .creditIcon,
        .promoIcon,
        .benefitIcon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
        }

        .creditIcon {
          color: #67e8f9;
          background: rgba(103,232,249,0.11);
        }

        .creditTitle {
          color: #fff;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.3;
        }

        .creditBody {
          margin-top: 3px;
          color: rgba(255,255,255,0.52);
          font-size: 12px;
          line-height: 1.55;
        }

        .valueSection {
          display: grid;
          gap: 12px;
        }

        .sectionHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .sectionTitle {
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.25;
        }

        .sectionText {
          max-width: 450px;
          color: rgba(255,255,255,0.48);
          font-size: 12px;
          line-height: 1.5;
          text-align: right;
        }

        .benefitGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .benefitCard {
          display: flex;
          gap: 12px;
          min-width: 0;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.095);
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
        }

        .benefitIcon {
          color: #8be9f5;
          background: rgba(103,232,249,0.1);
        }

        .benefitTitle {
          color: #fff;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.3;
        }

        .benefitText {
          margin-top: 4px;
          color: rgba(255,255,255,0.48);
          font-size: 12px;
          line-height: 1.5;
        }

        .trustPanel {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.085);
          border-radius: 18px;
          background: rgba(255,255,255,0.032);
        }

        .trustItem {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          min-width: 0;
          color: rgba(255,255,255,0.62);
          font-size: 12px;
          line-height: 1.55;
        }

        .trustItem svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: #a7f3d0;
        }

        .ctaPanel {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(180px, 0.8fr);
          gap: 12px;
          align-items: start;
        }

        .primaryAction {
          display: grid;
          gap: 7px;
        }

        button {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 14px;
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
          background: linear-gradient(135deg, #67e8f9, #a7f3d0);
          color: #061014;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 18px 36px rgba(34,211,238,0.18);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .primaryCta:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 22px 42px rgba(34,211,238,0.24);
        }

        .primaryCta:disabled {
          background: rgba(103,232,249,0.28);
          color: rgba(6,16,20,0.74);
          box-shadow: none;
        }

        .promoToggle {
          padding: 0 18px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.045);
          color: rgba(255,255,255,0.78);
          font-size: 13px;
          font-weight: 850;
          transition: border-color 160ms ease, background 160ms ease;
        }

        .promoToggle:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.07);
        }

        .promoToggle:disabled {
          color: rgba(255,255,255,0.34);
        }

        .ctaSubtext {
          color: rgba(255,255,255,0.48);
          font-size: 12px;
          line-height: 1.5;
        }

        .promoPanel {
          display: grid;
          gap: 13px;
          padding: 15px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
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
          font-weight: 850;
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
          border-radius: 13px;
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
          font-weight: 900;
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
          font-size: 12px;
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

        @media (max-width: 920px) {
          .heroPanel {
            grid-template-columns: 1fr;
          }

          .summaryPanel {
            min-height: 0;
          }

          .benefitGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .trustPanel {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .accessGate {
            gap: 14px;
            padding: 16px;
            border-radius: 20px;
          }

          .intro {
            gap: 15px;
          }

          h2 {
            font-size: 30px;
            line-height: 1.06;
          }

          p {
            font-size: 14px;
            line-height: 1.65;
          }

          .assuranceRow {
            display: grid;
            grid-template-columns: 1fr;
          }

          .assuranceRow span {
            width: 100%;
            justify-content: flex-start;
          }

          .sectionHeader {
            display: grid;
            gap: 4px;
          }

          .sectionText {
            max-width: none;
            text-align: left;
          }

          .benefitGrid,
          .ctaPanel,
          .promoControls {
            grid-template-columns: 1fr;
          }

          .benefitCard {
            min-height: 0;
            padding: 13px;
          }

          .primaryCta,
          .promoToggle,
          .promoControls button {
            width: 100%;
            min-height: 52px;
          }

          .ctaSubtext {
            text-align: center;
          }
        }
      `}</style>
    </section>
  )
}
