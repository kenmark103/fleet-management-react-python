/**
 * lib/fleet-api.ts
 * Fleet Management System
 *
 * Changes (Stage 2):
 *   - TruckPayload: added wheelConfig, grossWeightTons, axleLoadTons (optional)
 *   - TrailerPayload: added axles (optional)
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
  // Catalog spec fields — sent when a known model is selected in the form
  wheelConfig?:          string
  grossWeightTons?:      number
  axleLoadTons?:         number
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
  // Catalog spec field
  axles?:                number
}

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