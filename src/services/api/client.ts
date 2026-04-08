// =============================================================================
// API Client — Base Axios Instance
// All API service files import THIS, never create their own axios instances.
// Handles: auth headers, token refresh, error normalisation.
// =============================================================================

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '@/types'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearSessionAndRedirect() {
  try { localStorage.removeItem('uci-user-store') } catch { /* ignore */ }
  // Use replace so the user can't navigate back to the broken state
  globalThis.location.replace('/auth')
}

// A promise that never resolves — used to swallow the error chain when we
// are already redirecting the user away.  The component unmounts before
// resolution, so there is no memory leak.
const REDIRECT_PENDING = new Promise<never>(() => {})

// ─── Request Interceptor — Attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('uci-user-store')
      if (stored) {
        const state = JSON.parse(stored)
        const token = state?.state?.session?.accessToken
        if (token) config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // Silently ignore storage parse errors
    }
  }
  return config
})

// ─── Response Interceptor — Normalize Errors + Token Refresh ─────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status  = error.response?.status
    const message = error.response?.data?.message ?? ''

    // ── Hard auth failures: token is invalid or server has no secret ──────────
    // These cannot be fixed by refreshing — clear session and redirect immediately.
    const isHardAuthFailure =
      status === 401 &&
      (message === 'Invalid token' ||
       message === 'Server configuration error' ||
       message === 'Missing Authorization header')

    if (isHardAuthFailure) {
      clearSessionAndRedirect()
      // Never resolve — page is navigating away.
      return REDIRECT_PENDING
    }

    // ── Soft auth failure: token expired — attempt silent refresh ─────────────
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const stored = localStorage.getItem('uci-user-store')
        const refreshToken = stored ? JSON.parse(stored)?.state?.session?.refreshToken : null

        if (!refreshToken) {
          // No refresh token available — nothing we can do.
          clearSessionAndRedirect()
          return REDIRECT_PENDING
        }

        const { data } = await axios.post('/api/auth/refresh', { refreshToken })

        // Persist the new access token
        const storeState = JSON.parse(localStorage.getItem('uci-user-store') ?? '{}')
        if (storeState?.state?.session) {
          storeState.state.session.accessToken = data.accessToken
          localStorage.setItem('uci-user-store', JSON.stringify(storeState))
        }

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — session is unrecoverable.
        clearSessionAndRedirect()
        return REDIRECT_PENDING
      }
    }

    // ── All other errors — normalize shape and reject ─────────────────────────
    const normalizedError: ApiError = {
      message: message || error.message || 'An error occurred',
      code: error.response?.data?.code ?? 'UNKNOWN_ERROR',
      statusCode: status ?? 0,
      details: error.response?.data?.details,
    }

    return Promise.reject(normalizedError)
  }
)
