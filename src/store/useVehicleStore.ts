// =============================================================================
// Vehicle Store — Zustand
// Active vehicle under inspection + saved vehicles list.
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Vehicle, CreateVehiclePayload } from '@/types'
import { vehicleApi } from '@/services/api/vehicle.api'

interface VehicleState {
  activeVehicleId: string | null
  activeVehicle: Vehicle | null
  vehicles: Vehicle[]
  isLoading: boolean
  error: string | null
}

interface VehicleActions {
  createVehicle: (payload: CreateVehiclePayload) => Promise<Vehicle>
  setActiveVehicle: (vehicle: Vehicle) => void
  fetchVehicles: () => Promise<void>
  fetchVehicle: (id: string) => Promise<void>
  updateVehicle: (id: string, updates: Partial<CreateVehiclePayload>) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>
  clearActive: () => void
}

type VehicleStore = VehicleState & VehicleActions

export const useVehicleStore = create<VehicleStore>()(
  persist(
    immer((set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      activeVehicleId: null,
      activeVehicle: null,
      vehicles: [],
      isLoading: false,
      error: null,

      // ─── Actions ────────────────────────────────────────────────────────────

      createVehicle: async (payload) => {
        set((state) => { state.isLoading = true; state.error = null })
        try {
          const vehicle = await vehicleApi.create(payload)
          set((state) => {
            state.vehicles.unshift(vehicle)
            state.activeVehicle = vehicle
            state.activeVehicleId = vehicle.id
            state.isLoading = false
          })
          return vehicle
        } catch (err: any) {
          set((state) => { state.isLoading = false; state.error = err.message })
          throw err
        }
      },

      setActiveVehicle: (vehicle) => {
        set((state) => {
          state.activeVehicle = vehicle
          state.activeVehicleId = vehicle.id
        })
      },

      fetchVehicles: async () => {
        set((state) => { state.isLoading = true })
        try {
          const vehicles = await vehicleApi.list()
          set((state) => {
            state.vehicles = vehicles
            // Restore active vehicle from list if we have an ID
            if (state.activeVehicleId) {
              state.activeVehicle = vehicles.find((v) => v.id === state.activeVehicleId) ?? null
            }
            state.isLoading = false
          })
        } catch (err: any) {
          set((state) => { state.isLoading = false; state.error = err.message })
        }
      },

      fetchVehicle: async (id) => {
        const vehicle = await vehicleApi.getById(id)
        set((state) => {
          const idx = state.vehicles.findIndex((v) => v.id === id)
          if (idx >= 0) state.vehicles[idx] = vehicle
          else state.vehicles.unshift(vehicle)
          if (state.activeVehicleId === id) state.activeVehicle = vehicle
        })
      },

      updateVehicle: async (id, updates) => {
        const updated = await vehicleApi.update(id, updates)
        set((state) => {
          const idx = state.vehicles.findIndex((v) => v.id === id)
          if (idx >= 0) state.vehicles[idx] = updated
          if (state.activeVehicleId === id) state.activeVehicle = updated
        })
      },

      deleteVehicle: async (id) => {
        await vehicleApi.delete(id)
        set((state) => {
          state.vehicles = state.vehicles.filter((v) => v.id !== id)
          if (state.activeVehicleId === id) {
            state.activeVehicleId = null
            state.activeVehicle = null
          }
        })
      },

      clearActive: () => {
        set((state) => {
          state.activeVehicle = null
          state.activeVehicleId = null
        })
      },
    })),
    {
      name: 'uci-vehicle-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeVehicleId: state.activeVehicleId,
        activeVehicle: state.activeVehicle,
      }),
    }
  )
)
