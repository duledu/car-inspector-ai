// =============================================================================
// SEO metadata helper — server-only (safe to import from layouts / generateMetadata)
// =============================================================================
import type { Metadata } from 'next'

export type SeoLang = 'en' | 'sr' | 'bg' | 'de' | 'mk' | 'sq'
export type SeoPage =
  | 'home'
  | 'inspection'
  | 'report'
  | 'premium'
  | 'community'
  | 'privacy'
  | 'terms'

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN = 'https://usedcarsdoctor.com'
const SITE_NAME = 'Used Cars Doctor'
const LANG_COOKIE = 'car_inspector_lang'
const FALLBACK_LANG: SeoLang = 'en'
const SUPPORTED_SEO_LANGS: SeoLang[] = ['en', 'sr', 'bg', 'de', 'mk', 'sq']

const PAGE_PATHS: Record<SeoPage, string> = {
  home:       '/',
  inspection: '/inspection',
  report:     '/report',
  premium:    '/premium',
  community:  '/community',
  privacy:    '/legal/privacy',
  terms:      '/legal/terms',
}

// Maps SeoLang → BCP-47 Open Graph locale
const OG_LOCALE: Record<SeoLang, string> = {
  en: 'en_US',
  sr: 'sr_RS',
  bg: 'bg_BG',
  de: 'de_DE',
  mk: 'mk_MK',
  sq: 'sq_AL',
}

// ─── Per-page / per-language copy ────────────────────────────────────────────

interface PageMeta {
  title:        string
  description:  string
  keywords?:    string
}

const META: Record<SeoPage, Partial<Record<SeoLang, PageMeta>>> = {

  // ── Homepage ───────────────────────────────────────────────────────────────
  home: {
    en: {
      title:       'Check Before You Buy | Used Cars Doctor',
      description: 'AI-powered used car inspection. Photograph the car, complete a guided checklist, and get a confidence score before you buy. Detect paint defects, panel damage, and hidden issues.',
      keywords:    'used car inspection, AI car inspection, check car before buying, car inspection checklist, detect car damage from photos, used car buyer tool, vehicle condition check',
    },
    sr: {
      title:       'Proverite Pre Kupovine | Used Cars Doctor',
      description: 'AI pregled polovnog automobila. Fotografišite, popunite kontrolnu listu i dobijte ocenu pouzdanosti pre kupovine. Otkrijte skrivene štete i rizike.',
      keywords:    'pregled automobila, AI pregled, kontrolna lista, provera pre kupovine, detekcija oštećenja',
    },
    bg: {
      title:       'Проверете Преди Покупка | Used Cars Doctor',
      description: 'AI преглед на употребяван автомобил. Снимайте, попълнете контролен списък и получете оценка на увереността преди покупка. Открийте скрити повреди и рискове.',
      keywords:    'преглед на автомобил, AI преглед, контролен списък, проверка преди покупка, употребяван автомобил',
    },
    de: {
      title:       'Vor dem Kauf prüfen | Used Cars Doctor',
      description: 'KI-gestützte Gebrauchtwagenprüfung. Fotos aufnehmen, Checkliste ausfüllen und Vertrauensbewertung vor dem Kauf erhalten. Lackschäden und versteckte Mängel aufdecken.',
      keywords:    'Fahrzeuginspektion, KI Gebrauchtwagenprüfung, Checkliste, Fahrzeug prüfen, Schadenerkennung',
    },
    mk: {
      title:       'Проверете Пред Купување | Used Cars Doctor',
      description: 'AI преглед на половен автомобил. Сликајте, пополнете контролна листа и добијте оценка на доверба пред купување. Откријте скриени штети и ризици.',
      keywords:    'преглед на автомобил, AI проверка, контролна листа, половен автомобил',
    },
    sq: {
      title:       'Kontrollo Para Blerjes | Used Cars Doctor',
      description: 'Inspektim i makinave të përdorura me AI. Fotografoni, plotësoni listën e kontrollit dhe merrni një rezultat besimi para blerjes.',
      keywords:    'inspektim makine, AI inspektim, listë kontrolli, makinë e përdorur',
    },
  },

  // ── Inspection ─────────────────────────────────────────────────────────────
  inspection: {
    en: {
      title:       'AI Car Inspection Checklist | Used Cars Doctor',
      description: 'Step-by-step AI-guided used car inspection. Upload photos for AI damage detection, complete the full checklist, and generate your confidence report.',
      keywords:    'car inspection checklist, AI car inspection, used car checklist, vehicle condition check, detect car damage from photos, photo damage analysis',
    },
    sr: {
      title:       'AI Kontrolna Lista za Pregled Automobila | Used Cars Doctor',
      description: 'Korak po korak AI vođeni pregled polovnog automobila. Fotografišite za AI analizu oštećenja, popunite kontrolnu listu i generišite izveštaj.',
    },
    bg: {
      title:       'AI Контролен Списък за Преглед | Used Cars Doctor',
      description: 'Стъпка по стъпка AI ръководен преглед на употребяван автомобил. Качете снимки за AI анализ на щети, попълнете контролния списък и генерирайте доклада си.',
    },
    de: {
      title:       'KI-Fahrzeuginspektion Checkliste | Used Cars Doctor',
      description: 'Schritt-für-Schritt KI-gestützte Gebrauchtwageninspektion. Fotos für KI-Schadensanalyse hochladen, Checkliste ausfüllen und Bericht erstellen.',
    },
    mk: {
      title:       'AI Контролна Листа за Преглед | Used Cars Doctor',
      description: 'Чекор по чекор AI воден преглед на половен автомобил. Прикачете слики за AI анализа на штети, пополнете ја контролната листа и генерирајте извештај.',
    },
    sq: {
      title:       'Lista e Kontrollit të Inspektimit me AI | Used Cars Doctor',
      description: 'Inspektim hap pas hapi me udhëzim AI. Ngarkoni foto për analizë dëmtimesh, plotësoni listën e kontrollit dhe gjeneroni raportin.',
    },
  },

  // ── Report ─────────────────────────────────────────────────────────────────
  report: {
    en: {
      title:       'Inspection Report & Confidence Score | Used Cars Doctor',
      description: 'View your AI-generated vehicle inspection report. Confidence score, risk flags, negotiation tips, and buyer recommendations based on your full inspection.',
      keywords:    'car inspection report, vehicle confidence score, AI risk assessment, used car buyer report, inspection findings',
    },
    sr: {
      title:       'Izveštaj Pregleda i Ocena Pouzdanosti | Used Cars Doctor',
      description: 'Pogledajte AI generisani izveštaj pregleda vozila. Ocena pouzdanosti, rizici, saveti za pregovore i preporuke za kupca.',
    },
    bg: {
      title:       'Доклад за Преглед и Оценка на Увереността | Used Cars Doctor',
      description: 'Вижте AI генерирания доклад за преглед на автомобила. Оценка на увереността, рискови сигнали, съвети за преговори и препоръки за купувача.',
    },
    de: {
      title:       'Inspektionsbericht & Vertrauensbewertung | Used Cars Doctor',
      description: 'KI-generierten Fahrzeuginspektionsbericht ansehen. Vertrauensbewertung, Risikohinweise, Verhandlungstipps und Empfehlungen für Käufer.',
    },
    mk: {
      title:       'Извештај за Преглед и Оценка на Доверба | Used Cars Doctor',
      description: 'Погледнете го AI генерираниот извештај за преглед. Оценка на доверба, ризици, совети за преговарање и препораки за купувачот.',
    },
    sq: {
      title:       'Raporti i Inspektimit dhe Rezultati i Besimit | Used Cars Doctor',
      description: 'Shikoni raportin e inspektimit të gjeneruar nga AI. Rezultati i besimit, sinjalet e riskut dhe rekomandimet për blerësin.',
    },
  },

  // ── Premium ────────────────────────────────────────────────────────────────
  premium: {
    en: {
      title:       'Premium Vehicle History Reports | Used Cars Doctor',
      description: 'Unlock full VIN history, accident records, ownership history, and service data. Powered by carVertical. Make a fully informed used car purchase decision.',
      keywords:    'VIN check, vehicle history report, car accident history, carVertical, used car history, ownership check',
    },
    sr: {
      title:       'Premium Istorija Vozila | Used Cars Doctor',
      description: 'Otključajte punu VIN istoriju, evidenciju nesreća, istoriju vlasništva i servisne podatke. Donosite informisanu odluku o kupovini.',
    },
    bg: {
      title:       'Премиум История на Автомобила | Used Cars Doctor',
      description: 'Отключете пълна VIN история, записи за катастрофи, история на собствеността и сервизни данни. Вземете информирано решение за покупка.',
    },
    de: {
      title:       'Premium Fahrzeughistorie | Used Cars Doctor',
      description: 'Vollständige VIN-Geschichte, Unfallhistorie, Eigentumshistorie und Serviceprotokoll freischalten. Eine fundierte Kaufentscheidung treffen.',
    },
    mk: {
      title:       'Премиум Историја на Возило | Used Cars Doctor',
      description: 'Отклучете целосна VIN историја, евиденција за несреќи, историја на сопственост и сервисни записи. Донесете информирана одлука за купување.',
    },
    sq: {
      title:       'Raporte Premium të Historisë së Mjetit | Used Cars Doctor',
      description: 'Zhbllokoni historinë e plotë VIN, regjistrat e aksidenteve, historinë e pronësisë dhe të dhënat e shërbimit.',
    },
  },

  // ── Community ──────────────────────────────────────────────────────────────
  community: {
    en: {
      title:       'Used Car Buyers Community | Used Cars Doctor',
      description: 'Ask questions and share insights with experienced used car buyers. Get advice on specific models, common issues, and inspection tips from real buyers.',
      keywords:    'used car forum, car buying advice, used car community, vehicle inspection tips, car buyers help',
    },
    sr: {
      title:       'Zajednica Kupaca Polovnih Automobila | Used Cars Doctor',
      description: 'Postavljajte pitanja i razmenjujte iskustva sa iskusnim kupcima. Dobijte savete o modelima, čestim problemima i pregledima.',
    },
    bg: {
      title:       'Общност на Купувачи на Употребявани Автомобили | Used Cars Doctor',
      description: 'Задавайте въпроси и споделяйте опит с опитни купувачи. Получете съвети за конкретни модели, чести проблеми и прегледи.',
    },
    de: {
      title:       'Gebrauchtwagen-Käufer Community | Used Cars Doctor',
      description: 'Fragen stellen und Erfahrungen mit erfahrenen Käufern teilen. Tipps zu Modellen, häufigen Problemen und Fahrzeuginspektionen erhalten.',
    },
    mk: {
      title:       'Заедница на Купувачи на Половни Автомобили | Used Cars Doctor',
      description: 'Поставувајте прашања и споделувајте искуства со искусни купувачи. Добијте совети за модели, чести проблеми и прегледи.',
    },
    sq: {
      title:       'Komuniteti i Blerësve të Makinave të Përdorura | Used Cars Doctor',
      description: 'Bëni pyetje dhe ndani njohuri me blerës me eksperiencë. Merrni këshilla për modele, probleme të zakonshme dhe inspektime.',
    },
  },

  // ── Privacy ────────────────────────────────────────────────────────────────
  privacy: {
    en: {
      title:       'Privacy Policy | Used Cars Doctor',
      description: 'Privacy Policy for Used Cars Doctor. How we collect, use, and protect your data including vehicle inspection data, AI photo analysis, payment information, and your data rights.',
      keywords:    'privacy policy, data protection, GDPR, used car inspector privacy',
    },
    sr: {
      title:       'Politika Privatnosti | Used Cars Doctor',
      description: 'Politika privatnosti za Used Cars Doctor. Kako prikupljamo, koristimo i štitimo vaše podatke, uključujući podatke o pregledima i platne informacije.',
    },
    bg: {
      title:       'Политика за Поверителност | Used Cars Doctor',
      description: 'Политика за поверителност на Used Cars Doctor. Как събираме, използваме и защитаваме вашите данни, включително данни за прегледи и платежна информация.',
    },
    de: {
      title:       'Datenschutzrichtlinie | Used Cars Doctor',
      description: 'Datenschutzrichtlinie für Used Cars Doctor. Wie wir Ihre Daten, einschließlich Inspektionsdaten und Zahlungsinformationen, erfassen und schützen.',
    },
    mk: {
      title:       'Политика за Приватност | Used Cars Doctor',
      description: 'Политика за приватност на Used Cars Doctor. Како собираме, користиме и заштитуваме вашите податоци, вклучувајќи ги податоците за прегледи.',
    },
    sq: {
      title:       'Politika e Privatësisë | Used Cars Doctor',
      description: 'Politika e privatësisë për Used Cars Doctor. Si mbledhim, përdorim dhe mbrojmë të dhënat tuaja, duke përfshirë të dhënat e inspektimit dhe të pagesave.',
    },
  },

  // ── Terms ──────────────────────────────────────────────────────────────────
  terms: {
    en: {
      title:       'Terms of Service | Used Cars Doctor',
      description: 'Terms of Service for Used Cars Doctor. Covers AI disclaimer, user responsibility, limitation of liability, indemnification, and payment terms.',
      keywords:    'terms of service, terms and conditions, AI disclaimer, used car inspector legal',
    },
    sr: {
      title:       'Uslovi Korišćenja | Used Cars Doctor',
      description: 'Uslovi korišćenja za Used Cars Doctor. Pokriva AI odricanje odgovornosti, odgovornost korisnika i ograničenja odgovornosti.',
    },
    bg: {
      title:       'Условия за Ползване | Used Cars Doctor',
      description: 'Условия за ползване на Used Cars Doctor. Обхваща AI отказ от отговорност, отговорност на потребителя и ограничения на отговорността.',
    },
    de: {
      title:       'Nutzungsbedingungen | Used Cars Doctor',
      description: 'Nutzungsbedingungen für Used Cars Doctor. Umfasst KI-Haftungsausschluss, Benutzerverantwortung und Haftungsbeschränkungen.',
    },
    mk: {
      title:       'Услови за Користење | Used Cars Doctor',
      description: 'Услови за користење на Used Cars Doctor. Опфаќа AI одрекување, одговорност на корисникот и ограничувања на одговорноста.',
    },
    sq: {
      title:       'Kushtet e Shërbimit | Used Cars Doctor',
      description: 'Kushtet e shërbimit për Used Cars Doctor. Mbulon mohimin e AI, përgjegjësinë e përdoruesit dhe kufizimet e përgjegjësisë.',
    },
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isSeoLang(val: unknown): val is SeoLang {
  return typeof val === 'string' && (SUPPORTED_SEO_LANGS as string[]).includes(val)
}

/**
 * Build a Next.js Metadata object for the given page and language.
 * Falls back to English if no translation exists for the requested language.
 * Uses `title.absolute` so the root layout's title template is NOT applied.
 */
export function buildPageMetadata(page: SeoPage, lang: SeoLang = FALLBACK_LANG): Metadata {
  const resolvedLang = isSeoLang(lang) ? lang : FALLBACK_LANG
  const pageMeta = META[page][resolvedLang] ?? META[page][FALLBACK_LANG]!
  const path = PAGE_PATHS[page]
  const canonicalUrl = `${DOMAIN}${path}`

  return {
    title: { absolute: pageMeta.title },
    description: pageMeta.description,
    ...(pageMeta.keywords ? { keywords: pageMeta.keywords } : {}),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title:       pageMeta.title,
      description: pageMeta.description,
      url:         canonicalUrl,
      siteName:    SITE_NAME,
      type:        'website',
      locale:      OG_LOCALE[resolvedLang],
    },
    twitter: {
      card:        'summary_large_image',
      title:       pageMeta.title,
      description: pageMeta.description,
    },
  }
}

/**
 * Read the preferred language from the request cookie.
 * Safe to call from any Server Component or generateMetadata function.
 * Falls back to English if the cookie is absent or unrecognised.
 */
export async function getLangFromCookies(): Promise<SeoLang> {
  try {
    const { cookies } = await import('next/headers')
    const val = cookies().get(LANG_COOKIE)?.value
    return isSeoLang(val) ? val : FALLBACK_LANG
  } catch {
    return FALLBACK_LANG
  }
}
