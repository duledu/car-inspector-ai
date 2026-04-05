// =============================================================================
// User Store — Zustand
// Authentication state, session management, user profile.
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AuthUser, AuthSession, LoginCredentials, RegisterPayload } from '@/types'
import { authApi } from '@/services/api/auth.api'

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
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
  updateProfile: (updates: Partial<Pick<AuthUser, 'name' | 'avatarUrl'>>) => Promise<void>
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
            state.isLoading = false
            state.error = err?.message ?? 'Login failed'
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
            state.error = err?.message ?? 'Registration failed'
          })
          throw err
        }
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

      refreshSession: async () => {
        const { session } = get()
        if (!session?.refreshToken) return
        try {
          const refreshed = await authApi.refresh(session.refreshToken)
          set((state) => {
            state.session = refreshed
            state.user = refreshed.user
          })
        } catch {
          // Refresh failed — force logout
          set((state) => {
            state.user = null
            state.session = null
            state.isAuthenticated = false
          })
        }
      },

      updateProfile: async (updates) => {
        const updated = await authApi.updateProfile(updates)
        set((state) => {
          if (state.user) {
            state.user.name = updated.name
            state.user.avatarUrl = updated.avatarUrl
          }
        })
      },

      clearError: () => set((state) => { state.error = null }),
    })),
    {
      name: 'uci-user-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist session tokens — never full user data in localStorage in production
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
