// =============================================================================
// API Client — Base Axios Instance
// All API service files import THIS, never create their own axios instances.
// Handles: token refresh (via httpOnly cookies), error normalisation.
//
// Phase 2 of JWT → httpOnly cookie migration:
//   - withCredentials: true  → uci_at / uci_rt cookies are sent automatically
//   - Authorization header injection from localStorage removed
//   - localStorage token reads/writes removed
//   - Refresh interceptor posts to /api/auth/refresh with empty body; the server
//     reads uci_rt from the cookie and sets fresh uci_at / uci_rt cookies.
//
// =============================================================================

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '@/types'

export const apiClient = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout:         15_000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,   // send uci_at / uci_rt httpOnly cookies on every request
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearSessionAndRedirect() {
  // Remove the Zustand store from localStorage so React re-renders in the
  // logged-out state. Auth token cookies are cleared server-side.
  try { localStorage.removeItem('uci-user-store') } catch { /* ignore */ }
  try { sessionStorage.removeItem('uci-user-store') } catch { /* ignore */ }
  globalThis.location.replace('/auth')
}

// A promise that never resolves — used to swallow the error chain when we
// are already redirecting the user away. The component unmounts before
// resolution, so there is no memory leak.
const REDIRECT_PENDING = new Promise<never>(() => {})

// ─── Response Interceptor — Normalize Errors + Token Refresh ─────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status     = error.response?.status
    const requestUrl = originalRequest.url ?? ''

    // Do not intercept auth-submission endpoints — a 401 there is a real
    // credential error, not an expired token that can be refreshed.
    const isAuthSubmission =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password')

    // When responseType is 'blob' (e.g. PDF download), error bodies arrive as
    // Blob objects. Parse them back to JSON so we can read the message field.
    let parsedData: (ApiError & { error?: string }) | undefined
    if (error.response?.data instanceof Blob) {
      try {
        const text = await (error.response.data as Blob).text()
        parsedData = JSON.parse(text)
      } catch { /* use undefined fallback */ }
    } else {
      parsedData = error.response?.data as (ApiError & { error?: string }) | undefined
    }
    const responseData = parsedData
    const message = responseData?.message ?? responseData?.error ?? ''

    // ── Soft auth failure: access token expired — attempt silent cookie refresh ─
    // The uci_rt httpOnly cookie is sent automatically via withCredentials.
    // The server issues fresh uci_at / uci_rt cookies in the Set-Cookie header.
    // The retried original request then carries the new uci_at cookie.
    if (status === 401 && !originalRequest._retry && !isAuthSubmission) {
      originalRequest._retry = true
      try {
        // Empty body — the refresh token arrives as the uci_rt cookie.
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — session is unrecoverable; clear local state and redirect.
        clearSessionAndRedirect()
        return REDIRECT_PENDING
      }
    }

    // ── All other errors — normalize shape and reject ─────────────────────────
    const normalizedError: ApiError = {
      message:    message || error.message || 'An error occurred',
      code:       responseData?.code ?? 'UNKNOWN_ERROR',
      statusCode: status ?? 0,
      details:    responseData?.details,
    }

    return Promise.reject(normalizedError)
  }
)
