/**
 * lib/fleet-api.ts
 * Fleet Management System
 *
 * Pure data functions for fleet resources (trucks + trailers).
 * Called by useFleet.ts hooks — not used directly in components.
 * Uses central axios instance for automatic token refresh on 401.
 */

import api from './api'
import type {
  Truck, Trailer, FleetSummary,
  TruckStatus, TrailerStatus,
} from '../types/fleet'

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

// ── Fleet Summary ─────────────────────────────────────────────────────────────

export const getFleetSummary = () =>
  api.get<FleetSummary>('/api/v1/fleet/summary').then(r => r.data)

// ── Trucks ────────────────────────────────────────────────────────────────────

export const listTrucks = (status?: TruckStatus) =>
  api.get<Truck[]>(`/api/v1/fleet/trucks${status ? `?status=${status}` : ''}`).then(r => r.data)

export const getTruck = (id: string) =>
  api.get<Truck>(`/api/v1/fleet/trucks/${id}`).then(r => r.data)

export const createTruck = (payload: TruckPayload) =>
  api.post<Truck>('/api/v1/fleet/trucks', payload).then(r => r.data)

export const updateTruck = (id: string, payload: Partial<TruckPayload>) =>
  api.patch<Truck>(`/api/v1/fleet/trucks/${id}`, payload).then(r => r.data)

export const deleteTruck = (id: string) =>
  api.delete<void>(`/api/v1/fleet/trucks/${id}`).then(r => r.data)

// ── Trailers ──────────────────────────────────────────────────────────────────

export const listTrailers = (status?: TrailerStatus) =>
  api.get<Trailer[]>(`/api/v1/fleet/trailers${status ? `?status=${status}` : ''}`).then(r => r.data)

export const getTrailer = (id: string) =>
  api.get<Trailer>(`/api/v1/fleet/trailers/${id}`).then(r => r.data)

export const createTrailer = (payload: TrailerPayload) =>
  api.post<Trailer>('/api/v1/fleet/trailers', payload).then(r => r.data)

export const updateTrailer = (id: string, payload: Partial<TrailerPayload>) =>
  api.patch<Trailer>(`/api/v1/fleet/trailers/${id}`, payload).then(r => r.data)

export const deleteTrailer = (id: string) =>
  api.delete<void>(`/api/v1/fleet/trailers/${id}`).then(r => r.data)