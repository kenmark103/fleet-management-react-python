/**
 * hooks/useTrips.ts
 * Fleet Management System — Phase 5
 *
 * Query key hierarchy:
 *   ["trips"]                          — root
 *   ["trips", "list", filters]         — paginated list
 *   ["trips", "detail", tripId]        — single trip
 *   ["trips", "detail", tripId, "pings"] — location pings
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import api from '../lib/api'
import type {
  Trip,
  TripCreateRequest,
  TripUpdateRequest,
  TripStatusUpdateRequest,
  TripLocationPing,
  PaginatedTripsResponse,
  TripStatus,
} from '../types/trips'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const tripKeys = {
  all:     ['trips'] as const,
  lists:   () => ['trips', 'list'] as const,
  list:    (filters: object) => ['trips', 'list', filters] as const,
  details: () => ['trips', 'detail'] as const,
  detail:  (id: string) => ['trips', 'detail', id] as const,
  pings:   (id: string) => ['trips', 'detail', id, 'pings'] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

interface ListTripsParams {
  status?:   TripStatus
  search?:   string
  page?:     number
  pageSize?: number
}

export function useTrips(params: ListTripsParams = {}) {
  const { status, search, page = 1, pageSize = 20 } = params

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  })

  return useQuery<PaginatedTripsResponse>({
    queryKey:        tripKeys.list({ status, search, page, pageSize }),
    queryFn:         () => api.get<PaginatedTripsResponse>(`/api/v1/trips?${searchParams}`).then(r => r.data),
    placeholderData: keepPreviousData,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export function useTrip(id: string | undefined) {
  return useQuery<Trip>({
    queryKey: tripKeys.detail(id!),
    queryFn:  () => api.get<Trip>(`/api/v1/trips/${id}`).then(r => r.data),
    enabled:  !!id,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient()

  return useMutation<Trip, Error, TripCreateRequest>({
    mutationFn: (body) => api.post<Trip>('/api/v1/trips', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateTrip(id: string) {
  const qc = useQueryClient()

  return useMutation<Trip, Error, TripUpdateRequest>({
    mutationFn: (body) => api.patch<Trip>(`/api/v1/trips/${id}`, body).then(r => r.data),
    onSuccess: (res) => {
      qc.setQueryData(tripKeys.detail(id), res)
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateTripStatus(id: string) {
  const qc = useQueryClient()

  return useMutation<Trip, Error, TripStatusUpdateRequest>({
    mutationFn: (body) => api.patch<Trip>(`/api/v1/trips/${id}/status`, body).then(r => r.data),
    onSuccess: (res) => {
      qc.setQueryData(tripKeys.detail(id), res)
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteTrip() {
  const qc = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete<void>(`/api/v1/trips/${id}`).then(r => r.data),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: tripKeys.detail(id) })
      qc.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PINGS
// ─────────────────────────────────────────────────────────────────────────────

export function useTripPings(tripId: string | undefined, limit = 100) {
  const searchParams = new URLSearchParams({ limit: String(limit) })

  return useQuery<TripLocationPing[]>({
    queryKey: tripKeys.pings(tripId!),
    queryFn:  () => api.get<TripLocationPing[]>(`/api/v1/trips/${tripId}/pings?${searchParams}`).then(r => r.data),
    enabled:  !!tripId,
  })
}