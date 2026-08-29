// =============================================================================
// Auth API Service
// All auth-related API calls. No business logic here — only HTTP.
// =============================================================================

import { apiClient } from './client'
import type { AuthSession, LoginCredentials, RegisterPayload, AuthUser, ApiResponse } from '@/types'

export interface ConsentPayload {
  termsAccepted: true
  riskAckAccepted: true
  termsVersion: string
  privacyVersion: string
  riskAckVersion: string
  locale: string
  platform: 'WEB' | 'ANDROID'
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthSession> => {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/login', credentials)
    return data.data
  },

  register: async (payload: RegisterPayload): Promise<AuthSession> => {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/register', payload)
    return data.data
  },

  /** Records consent for an already-authenticated user (Google OAuth's zero-consent path, or re-consent after a required version change). */
  consent: async (payload: ConsentPayload): Promise<AuthUser> => {
    const { data } = await apiClient.post<ApiResponse<AuthUser>>('/auth/consent', payload)
    return data.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  deleteAccount: async (): Promise<void> => {
    await apiClient.post('/auth/delete-account', { confirmed: true })
  },

  refresh: async (): Promise<AuthSession> => {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/refresh', {})
    return data.data
  },

  getMe: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<ApiResponse<AuthUser>>('/auth/me')
    return data.data
  },

  updateProfile: async (updates: Partial<Pick<AuthUser, 'name' | 'avatarUrl' | 'preferredLanguage' | 'countryCode' | 'preferredCurrency'>>): Promise<AuthUser> => {
    const { data } = await apiClient.patch<ApiResponse<AuthUser>>('/auth/me', updates)
    return data.data
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email })
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { token, newPassword })
  },

  sendVerificationEmail: async (): Promise<void> => {
    await apiClient.post('/auth/send-verification')
  },

  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post('/auth/verify-email', { token })
  },
}
