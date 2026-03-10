/**
 * lib/fleet-api.ts
 * Fleet Management System
 *
 * Pure data functions for fleet resources (trucks + trailers).
 * Called by useFleet.ts hooks — not used directly in components.
 * Uses central axios instance for automatic token refresh on 401.
 *
 * Changes:
 *   - listTrucks / listTrailers now accept ListParams and return
 *     PaginatedResponse<T> instead of T[] — enables server-side pagination.
 */

import api from './api'
import type {
  Truck, Trailer, FleetSummary,
  TruckStatus, TrailerStatus,
} from '../types/fleet'
import type { PaginatedResponse } from '../types/api'

export interface TruckPayload {
  plateNumber:           string
  make:                  string
  model:                 string
  year:                  number
  status:                TruckStatus
  odometerKm:            number
  fuelType:              'diesel' | 'petrol' | 'electric' | 'hybrid'
  vin?:                  string
  color?:                string
  insuranceExpiryDate?:  string
  inspectionExpiryDate?: string
  notes?:                string
}

export interface TrailerPayload {
  plateNumber:           string
  make:                  string
  model:                 string
  year:                  number
  status:                TrailerStatus
  type:                  'flatbed' | 'refrigerated' | 'tanker' | 'box' | 'other'
  capacityTons?:         number
  insuranceExpiryDate?:  string
  inspectionExpiryDate?: string
  notes?:                string
}

// Shared params shape for all paginated list endpoints
export interface ListParams {
  page?:     number
  pageSize?: number
  search?:   string
}

// ── Fleet Summary ─────────────────────────────────────────────────────────────

export const getFleetSummary = () =>
  api.get<FleetSummary>('/api/v1/fleet/summary').then(r => r.data)

// ── Trucks ────────────────────────────────────────────────────────────────────

export const listTrucks = (
  status?: TruckStatus,
  params: ListParams = {},
): Promise<PaginatedResponse<Truck>> => {
  const { page = 1, pageSize = 20, search } = params
  const qs = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  })
  return api.get<PaginatedResponse<Truck>>(`/api/v1/fleet/trucks?${qs}`).then(r => r.data)
}

export const getTruck = (id: string) =>
  api.get<Truck>(`/api/v1/fleet/trucks/${id}`).then(r => r.data)

export const createTruck = (payload: TruckPayload) =>
  api.post<Truck>('/api/v1/fleet/trucks', payload).then(r => r.data)

export const updateTruck = (id: string, payload: Partial<TruckPayload>) =>
  api.patch<Truck>(`/api/v1/fleet/trucks/${id}`, payload).then(r => r.data)

export const deleteTruck = (id: string) =>
  api.delete<void>(`/api/v1/fleet/trucks/${id}`).then(r => r.data)

// ── Trailers ──────────────────────────────────────────────────────────────────

export const listTrailers = (
  status?: TrailerStatus,
  params: ListParams = {},
): Promise<PaginatedResponse<Trailer>> => {
  const { page = 1, pageSize = 20, search } = params
  const qs = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  })
  return api.get<PaginatedResponse<Trailer>>(`/api/v1/fleet/trailers?${qs}`).then(r => r.data)
}

export const getTrailer = (id: string) =>
  api.get<Trailer>(`/api/v1/fleet/trailers/${id}`).then(r => r.data)

export const createTrailer = (payload: TrailerPayload) =>
  api.post<Trailer>('/api/v1/fleet/trailers', payload).then(r => r.data)

export const updateTrailer = (id: string, payload: Partial<TrailerPayload>) =>
  api.patch<Trailer>(`/api/v1/fleet/trailers/${id}`, payload).then(r => r.data)

export const deleteTrailer = (id: string) =>
  api.delete<void>(`/api/v1/fleet/trailers/${id}`).then(r => r.data)