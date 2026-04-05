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

    // Attempt token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const stored = localStorage.getItem('uci-user-store')
        const refreshToken = stored ? JSON.parse(stored)?.state?.session?.refreshToken : null
        if (refreshToken) {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken })
          // Update stored token
          const storeState = JSON.parse(localStorage.getItem('uci-user-store') ?? '{}')
          if (storeState?.state?.session) {
            storeState.state.session.accessToken = data.accessToken
            localStorage.setItem('uci-user-store', JSON.stringify(storeState))
          }
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return apiClient(originalRequest)
        }
      } catch {
        // Refresh failed — clear session (will trigger redirect in AuthGuard)
        localStorage.removeItem('uci-user-store')
        window.location.href = '/auth'
      }
    }

    // Normalize error shape
    const normalizedError: ApiError = {
      message: error.response?.data?.message ?? error.message ?? 'An error occurred',
      code: error.response?.data?.code ?? 'UNKNOWN_ERROR',
      statusCode: error.response?.status ?? 0,
      details: error.response?.data?.details,
    }

    return Promise.reject(normalizedError)
  }
)
