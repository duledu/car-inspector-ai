// =============================================================================
// User Store — Zustand
// Authentication state, session management, user profile.
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AuthUser, AuthSession, LoginCredentials, RegisterPayload } from '@/types'
import { authApi } from '@/services/api/auth.api'

// ─── Error key resolver ──────────────────────────────────────────────────────
// Returns a translation key (e.g. 'auth.error.invalidCredentials').
// The AuthPage calls t(error) to render the localised string.
function resolveAuthError(err: any, action: 'login' | 'register'): string {
  const code: string   = err?.code      ?? ''
  const status: number = err?.statusCode ?? 0

  if (code === 'CONFIG_ERROR'       || status === 503) return 'auth.error.unavailable'
  if (code === 'INVALID_CREDENTIALS'|| status === 401) return 'auth.error.invalidCredentials'
  if (code === 'EMAIL_IN_USE'       || status === 409) return 'auth.error.emailInUse'
  if (code === 'VALIDATION_ERROR'   || status === 422)
    return action === 'login' ? 'auth.error.validationLogin' : 'auth.error.validationRegister'
  if (action === 'login' && (status >= 500 || !status)) return 'auth.error.genericLogin'
  if (status >= 500) return 'auth.error.serverError'
  if (!status)       return 'auth.error.networkError'

  return action === 'login' ? 'auth.error.loginFailed' : 'auth.error.registerFailed'
}

interface UserState {
  user: AuthUser | null
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface UserActions {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  loginWithGoogle: (session: AuthSession) => void
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
  updateProfile: (updates: Partial<Pick<AuthUser, 'name' | 'avatarUrl' | 'preferredLanguage'>>) => Promise<void>
}

type UserStore = UserState & UserActions

export const useUserStore = create<UserStore>()(
  persist(
    immer((set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ─── Actions ────────────────────────────────────────────────────────────

      login: async (credentials) => {
        set((state) => { state.isLoading = true; state.error = null })
        try {
          const session = await authApi.login(credentials)
          set((state) => {
            state.user = session.user
            state.session = session
            state.isAuthenticated = true
            state.isLoading = false
          })
        } catch (err: any) {
          set((state) => {
            state.user = null
            state.session = null
            state.isAuthenticated = false
            state.isLoading = false
            state.error = resolveAuthError(err, 'login')
          })
          throw err
        }
      },

      register: async (payload) => {
        set((state) => { state.isLoading = true; state.error = null })
        try {
          const session = await authApi.register(payload)
          set((state) => {
            state.user = session.user
            state.session = session
            state.isAuthenticated = true
            state.isLoading = false
          })
        } catch (err: any) {
          set((state) => {
            state.isLoading = false
            state.error = resolveAuthError(err, 'register')
          })
          throw err
        }
      },

      loginWithGoogle: (session) => {
        set((state) => {
          state.user          = session.user
          state.session       = session
          state.isAuthenticated = true
          state.isLoading     = false
          state.error         = null
        })
      },

      logout: async () => {
        try {
          await authApi.logout()
        } finally {
          set((state) => {
            state.user = null
            state.session = null
            state.isAuthenticated = false
            state.error = null
          })
        }
      },

      deleteAccount: async () => {
        try {
          await authApi.deleteAccount()
        } finally {
          set((state) => {
            state.user = null
            state.session = null
            state.isAuthenticated = false
            state.error = null
          })
        }
      },

      refreshSession: async () => {
        try {
          const refreshed = await authApi.refresh()
          set((state) => {
            state.session = refreshed
            state.user = refreshed.user
          })
        } catch (err: any) {
          // Only force-logout on definitive auth rejection (401/403).
          // Network errors (no connection, timeout, device wake) are transient —
          // clearing the session on a brief mobile network hiccup forces users to
          // re-login unnecessarily.
          const status = err?.statusCode ?? err?.response?.status ?? 0
          if (status === 401 || status === 403) {
            set((state) => {
              state.user = null
              state.session = null
              state.isAuthenticated = false
            })
          }
          // Otherwise, keep existing session in place and let the user continue.
        }
      },

      updateProfile: async (updates) => {
        const updated = await authApi.updateProfile(updates)
        set((state) => {
          if (state.user) {
            state.user.name = updated.name
            state.user.avatarUrl = updated.avatarUrl
            if (updated.preferredLanguage !== undefined) {
              state.user.preferredLanguage = updated.preferredLanguage
            }
          }
          // Keep session.user in sync so Zustand persists the updated value
          if (state.session?.user) {
            state.session.user.name = updated.name
            state.session.user.avatarUrl = updated.avatarUrl
            if (updated.preferredLanguage !== undefined) {
              state.session.user.preferredLanguage = updated.preferredLanguage
            }
          }
        })
      },

      clearError: () => set((state) => { state.error = null }),
    })),
    {
      name: 'uci-user-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persisted, current) => {
        // Cast broadly so we can strip legacy token fields that may still be in
        // old localStorage entries written before Phase 3.
        const p = persisted as {
          session?: AuthSession & { accessToken?: unknown; refreshToken?: unknown }
          isAuthenticated?: boolean
        }
        const safeSession: AuthSession | null = p.session?.user
          ? { user: p.session.user, expiresAt: p.session.expiresAt }
          : null
        return {
          ...current,
          session: safeSession,
          isAuthenticated: p.isAuthenticated ?? false,
          user: safeSession?.user ?? null,
        }
      },
    }
  )
)
