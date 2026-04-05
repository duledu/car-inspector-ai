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
          const session = await inspectionApi.getOrCreateSession(vehicleId)
          set((state) => {
            state.session = session
            state.checklistItems = session.checklistItems
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
            set((state) => { state.checklistItems = session.checklistItems })
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

      setTestDriveRating: (key, category, rating) => {
        set((state) => {
          state.testDriveRatings[key] = { category, itemKey: key, rating }
        })
      },

      getItemsByCategory: (category) => {
        return get().checklistItems.filter((i) => i.category === category)
      },

      getAllFindings: () => {
        return get().aiResults.flatMap((r) => r.findings)
      },

      resetSession: () => {
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
        checklistItems: state.checklistItems,
        aiResults: state.aiResults,
        testDriveRatings: state.testDriveRatings,
      }),
    }
  )
)
