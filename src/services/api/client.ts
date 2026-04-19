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
  try { sessionStorage.removeItem('uci-user-store') } catch { /* ignore */ }
  globalThis.location.replace('/auth')
}

function readStoredAuthState(): any | null {
  try {
    const stored = localStorage.getItem('uci-user-store')
    if (stored) return JSON.parse(stored)
  } catch {
    // Silently ignore storage parse errors
  }
  return null
}

function writeStoredAuthState(state: any) {
  try {
    localStorage.setItem('uci-user-store', JSON.stringify(state))
  } catch {
    // Silently ignore storage write errors
  }
}

// A promise that never resolves — used to swallow the error chain when we
// are already redirecting the user away.  The component unmounts before
// resolution, so there is no memory leak.
const REDIRECT_PENDING = new Promise<never>(() => {})

// ─── Request Interceptor — Attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    try {
      const state = readStoredAuthState()
      const token = state?.state?.session?.accessToken
      if (token) config.headers.Authorization = `Bearer ${token}`
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
    const requestUrl = originalRequest.url ?? ''
    const isAuthSubmission =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password')

    // When responseType is 'blob' (e.g. PDF download), error bodies arrive as Blob objects.
    // Parse them back to JSON so we can read the message field.
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

    // ── Hard auth failures: token is invalid or server has no secret ──────────
    // These cannot be fixed by refreshing — clear session and redirect immediately.
    const isHardAuthFailure =
      status === 401 &&
      (message === 'Invalid token' ||
       message === 'Server configuration error' ||
       message === 'Missing Authorization header')

    if (isHardAuthFailure && !isAuthSubmission) {
      clearSessionAndRedirect()
      // Never resolve — page is navigating away.
      return REDIRECT_PENDING
    }

    // ── Soft auth failure: token expired — attempt silent refresh ─────────────
    if (status === 401 && !originalRequest._retry && !isAuthSubmission) {
      originalRequest._retry = true
      try {
        const storeState = readStoredAuthState()
        const refreshToken = storeState?.state?.session?.refreshToken ?? null

        if (!refreshToken) {
          // No refresh token available — nothing we can do.
          clearSessionAndRedirect()
          return REDIRECT_PENDING
        }

        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        const refreshed = data?.data

        // Persist the new access token
        if (storeState?.state?.session && refreshed?.accessToken) {
          storeState.state.session = refreshed
          storeState.state.user = refreshed.user
          storeState.state.isAuthenticated = true
          writeStoredAuthState(storeState)
        }

        originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`
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
      code: responseData?.code ?? 'UNKNOWN_ERROR',
      statusCode: status ?? 0,
      details: responseData?.details,
    }

    return Promise.reject(normalizedError)
  }
)
