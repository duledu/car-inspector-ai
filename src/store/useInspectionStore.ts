// =============================================================================
// Inspection Store — Zustand
// Active inspection session state: checklists, AI findings, test drive.
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  InspectionSession,
  ChecklistItem,
  ChecklistCategory,
  ItemStatus,
  AIAnalysisResult,
  AIFinding,
  InspectionPhase,
} from '@/types'
import { inspectionApi } from '@/services/api/inspection.api'
import { aiApi } from '@/services/api/ai.api'
import { normalizeChecklistItems } from '@/lib/inspection/checklist'

interface TestDriveRating {
  category: string
  itemKey: string
  rating: 0 | 1 | 2 | 3 // 0=unrated, 1=good, 2=concern, 3=problem
}

interface InspectionState {
  session: InspectionSession | null
  currentPhase: InspectionPhase
  activeChecklistTab: ChecklistCategory
  checklistItems: ChecklistItem[]
  aiResults: AIAnalysisResult[]
  testDriveRatings: Record<string, TestDriveRating>
  isLoadingChecklist: boolean
  isRunningAI: boolean
  error: string | null
}

interface InspectionActions {
  initSession: (vehicleId: string) => Promise<void>
  setPhase: (phase: InspectionPhase) => void
  setChecklistTab: (tab: ChecklistCategory) => void
  updateChecklistItem: (itemId: string, status: ItemStatus, notes?: string) => Promise<void>
  runAIAnalysis: (vehicleId: string, photoIds: string[]) => Promise<void>
  pushAIResult: (result: AIAnalysisResult) => void
  setTestDriveRating: (key: string, category: string, rating: 0 | 1 | 2 | 3) => void
  getItemsByCategory: (category: ChecklistCategory) => ChecklistItem[]
  getAllFindings: () => AIFinding[]
  resetSession: () => void
}

type InspectionStore = InspectionState & InspectionActions

export const useInspectionStore = create<InspectionStore>()(
  persist(
    immer((set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      session: null,
      currentPhase: 'PRE_SCREENING',
      activeChecklistTab: 'EXTERIOR',
      checklistItems: [],
      aiResults: [],
      testDriveRatings: {},
      isLoadingChecklist: false,
      isRunningAI: false,
      error: null,

      // ─── Actions ────────────────────────────────────────────────────────────

      initSession: async (vehicleId) => {
        set((state) => { state.isLoadingChecklist = true; state.error = null })
        try {
          const previousVehicleId = get().session?.vehicleId
          const session = await inspectionApi.getOrCreateSession(vehicleId)
          set((state) => {
            if (previousVehicleId && previousVehicleId !== session.vehicleId) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`[inspection-store] vehicle switch — discarding stale state. previous="${previousVehicleId}" next="${session.vehicleId}"`)
              }
              state.checklistItems = []
              state.aiResults = []
              state.testDriveRatings = {}
              state.activeChecklistTab = 'EXTERIOR'
            }
            state.session = session
            state.checklistItems = normalizeChecklistItems(session.checklistItems)
            state.currentPhase = session.phase
            state.isLoadingChecklist = false
          })
        } catch (err: any) {
          set((state) => { state.isLoadingChecklist = false; state.error = err.message })
          throw err
        }
      },

      setPhase: (phase) => {
        set((state) => { state.currentPhase = phase })
        // Persist phase to backend (fire and forget)
        const sessionId = get().session?.id
        if (sessionId) {
          inspectionApi.updatePhase(sessionId, phase).catch(console.error)
        }
      },

      setChecklistTab: (tab) => {
        set((state) => { state.activeChecklistTab = tab })
      },

      updateChecklistItem: async (itemId, status, notes) => {
        // Optimistic update
        set((state) => {
          const item = state.checklistItems.find((i) => i.id === itemId)
          if (item) {
            item.status = status
            if (notes !== undefined) item.notes = notes
          }
        })
        // Persist
        try {
          await inspectionApi.updateChecklistItem(itemId, { status, notes })
        } catch (err) {
          // Rollback on failure — re-fetch from server
          const sessionId = get().session?.id
          if (sessionId) {
            const session = await inspectionApi.getSession(sessionId)
            set((state) => { state.checklistItems = normalizeChecklistItems(session.checklistItems) })
          }
          throw err
        }
      },

      runAIAnalysis: async (vehicleId, photoIds) => {
        set((state) => { state.isRunningAI = true; state.error = null })
        try {
          const result = await aiApi.runAnalysis(vehicleId, photoIds)
          set((state) => {
            state.aiResults.unshift(result)
            state.isRunningAI = false
          })
        } catch (err: any) {
          set((state) => { state.isRunningAI = false; state.error = err.message })
          throw err
        }
      },

      pushAIResult: (result) => {
        const currentVehicleId = get().session?.vehicleId
        // Guard: reject results that belong to a different vehicle.
        // This prevents a race where an in-flight AI request for Vehicle A
        // resolves after the user has already switched to Vehicle B.
        if (currentVehicleId && result.vehicleId && result.vehicleId !== currentVehicleId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[inspection-store] pushAIResult: discarding stale result vehicleId="${result.vehicleId}" (active="${currentVehicleId}")`)
          }
          return
        }
        set((state) => {
          state.aiResults.unshift(result)
        })
      },

      setTestDriveRating: (key, category, rating) => {
        set((state) => {
          state.testDriveRatings[key] = { category, itemKey: key, rating }
        })
      },

      getItemsByCategory: (category) => {
        return normalizeChecklistItems(get().checklistItems).filter((i) => i.category === category)
      },

      getAllFindings: () => {
        return get().aiResults.flatMap((r) => r.findings)
      },

      resetSession: () => {
        // Clear persisted photo drafts for the vehicle being reset
        const vehicleId = get().session?.vehicleId
        if (vehicleId) {
          try {
            const raw = localStorage.getItem('uci-photo-drafts')
            if (raw) {
              const remaining = (JSON.parse(raw) as Array<{ vehicleId: string }>)
                .filter(d => d.vehicleId !== vehicleId)
              if (remaining.length === 0) localStorage.removeItem('uci-photo-drafts')
              else localStorage.setItem('uci-photo-drafts', JSON.stringify(remaining))
            }
          } catch { /* ignore */ }
        }
        set((state) => {
          state.session = null
          state.currentPhase = 'PRE_SCREENING'
          state.checklistItems = []
          state.aiResults = []
          state.testDriveRatings = {}
          state.error = null
        })
      },
    })),
    {
      name: 'uci-inspection-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
        currentPhase: state.currentPhase,
        activeChecklistTab: state.activeChecklistTab,
        checklistItems: normalizeChecklistItems(state.checklistItems),
        aiResults: state.aiResults,
        testDriveRatings: state.testDriveRatings,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<InspectionState>
        const storedVehicleId = p.session?.vehicleId ?? null
        if (process.env.NODE_ENV === 'development' && storedVehicleId) {
          console.debug(`[inspection-store] hydrating persisted state for vehicle="${storedVehicleId}"`)
        }
        // Reconstruct explicitly — do NOT use spread so every field is intentional.
        // vehicle-scoped data (checklistItems, aiResults, testDriveRatings) is only
        // valid for storedVehicleId. Filter aiResults so that any result whose
        // vehicleId differs from the stored session is dropped on hydration — this
        // prevents a stale Vehicle A result from leaking into a Vehicle B session
        // when the page refreshes with an old localStorage snapshot.
        const filteredAIResults = storedVehicleId
          ? (p.aiResults ?? []).filter(r => !r.vehicleId || r.vehicleId === storedVehicleId)
          : (p.aiResults ?? [])
        if (process.env.NODE_ENV === 'development' && p.aiResults && filteredAIResults.length < (p.aiResults.length ?? 0)) {
          console.warn(`[inspection-store] merge: dropped ${(p.aiResults.length ?? 0) - filteredAIResults.length} stale aiResult(s) whose vehicleId !== "${storedVehicleId}"`)
        }
        return {
          ...current,
          session:            p.session            ?? null,
          currentPhase:       p.currentPhase       ?? 'PRE_SCREENING',
          activeChecklistTab: p.activeChecklistTab ?? 'EXTERIOR',
          checklistItems:     normalizeChecklistItems(p.checklistItems ?? []),
          aiResults:          filteredAIResults,
          testDriveRatings:   p.testDriveRatings   ?? {},
        }
      },
    }
  )
)
