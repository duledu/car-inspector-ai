// =============================================================================
// Server-safe i18n exports.
// React/i18next initialization lives in ./config and must stay client-only.
// =============================================================================

export {
  SUPPORTED_LANGS,
  FALLBACK_LANG,
  LS_KEY,
  LANG_COOKIE,
  LANG_META,
  isSupportedLang,
} from './shared'
export type { SupportedLang } from './shared'
