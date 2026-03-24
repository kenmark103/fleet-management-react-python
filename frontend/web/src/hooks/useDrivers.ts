/**
 * hooks/useDrivers.ts
 * Fleet Management System — Phase 4
 *
 * TanStack Query hooks for the Drivers module.
 * All mutations invalidate the correct query keys automatically.
 *
 * Query key hierarchy:
 *   ["drivers"]                               — list + summary root
 *   ["drivers", "list", filters]              — paginated list
 *   ["drivers", "summary"]                    — aggregate counts
 *   ["drivers", "detail", driverId]           — single driver
 *   ["drivers", "documents", driverId]        — driver's documents
 *   ["drivers", "trips", driverId, filters]   — driver's trip history
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type {
  Driver,
  DriverCreate,
  DriverUpdate,
  DriverDocument,
  DriverDocumentCreate,
  DriverSummary,
  DriverTripHistoryItem,
} from '../types/driver'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const driverKeys = {
  all:       ['drivers'] as const,
  lists:     () => ['drivers', 'list'] as const,
  list:      (filters: object) => ['drivers', 'list', filters] as const,
  summary:   () => ['drivers', 'summary'] as const,
  details:   () => ['drivers', 'detail'] as const,
  detail:    (id: string) => ['drivers', 'detail', id] as const,
  documents: (id: string) => ['drivers', 'documents', id] as const,
  trips:     (id: string, filters: object) => ['drivers', 'trips', id, filters] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

interface UseDriversParams {
  page?:     number
  pageSize?: number
  status?:   string
  search?:   string
}

export function useDrivers(params: UseDriversParams = {}) {
  const { page = 1, pageSize = 20, status, search } = params

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  })

  return useQuery<PaginatedResponse<Driver>>({
    queryKey:        driverKeys.list({ page, pageSize, status, search }),
    queryFn:         () => api.get<PaginatedResponse<Driver>>(`/api/v1/drivers?${searchParams}`).then(r => r.data),
    placeholderData: keepPreviousData,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverSummary() {
  return useQuery<ApiResponse<DriverSummary>>({
    queryKey: driverKeys.summary(),
    queryFn:  () => api.get<ApiResponse<DriverSummary>>('/api/v1/drivers/summary').then(r => r.data),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export function useDriver(driverId: string | undefined) {
  return useQuery<ApiResponse<Driver>>({
    queryKey: driverKeys.detail(driverId!),
    queryFn:  () => api.get<ApiResponse<Driver>>(`/api/v1/drivers/${driverId}`).then(r => r.data),
    enabled:  !!driverId,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateDriver() {
  const qc = useQueryClient()

  return useMutation<ApiResponse<Driver>, Error, DriverCreate>({
    mutationFn: (body) =>
      api.post<ApiResponse<Driver>>('/api/v1/drivers', body).then(r => r.data),

    onSuccess: (res) => {
      const driver = res.data

      // ✅ Seed the detail cache immediately — if the user navigates to the
      //    driver's profile right after creation it won't need a network round-trip.
      qc.setQueryData(driverKeys.detail(driver.id), res)

      // Invalidate list + summary so they re-fetch in the background.
      // The page has already navigated away by the time this runs, so the
      // user never waits on it — this is what was causing the Docker delay.
      qc.invalidateQueries({ queryKey: driverKeys.lists() })
      qc.invalidateQueries({ queryKey: driverKeys.summary() })

      toast.success(`${driver.firstName} ${driver.lastName} added successfully`)
    },

    onError: (e) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateDriver(driverId: string) {
  const qc = useQueryClient()

  return useMutation<ApiResponse<Driver>, Error, DriverUpdate>({
    mutationFn: (body) =>
      api.patch<ApiResponse<Driver>>(`/api/v1/drivers/${driverId}`, body).then(r => r.data),

    onSuccess: (res) => {
      const driver = res.data
      qc.setQueryData(driverKeys.detail(driverId), res)
      qc.invalidateQueries({ queryKey: driverKeys.lists() })
      qc.invalidateQueries({ queryKey: driverKeys.summary() })
      toast.success(`${driver.firstName} ${driver.lastName} updated`)
    },

    onError: (e) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteDriver() {
  const qc = useQueryClient()

  return useMutation<ApiResponse<{ id: string }>, Error, string>({
    mutationFn: (driverId) =>
      api.delete<ApiResponse<{ id: string }>>(`/api/v1/drivers/${driverId}`).then(r => r.data),

    onSuccess: (_res, driverId) => {
      qc.removeQueries({ queryKey: driverKeys.detail(driverId) })
      qc.invalidateQueries({ queryKey: driverKeys.lists() })
      qc.invalidateQueries({ queryKey: driverKeys.summary() })
      toast.success('Driver removed')
    },

    onError: (e) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverDocuments(driverId: string | undefined) {
  return useQuery<ApiResponse<DriverDocument[]>>({
    queryKey: driverKeys.documents(driverId!),
    queryFn:  () =>
      api.get<ApiResponse<DriverDocument[]>>(`/api/v1/drivers/${driverId}/documents`).then(r => r.data),
    enabled:  !!driverId,
  })
}

export function useUploadDriverDocument(driverId: string) {
  const qc = useQueryClient()

  return useMutation<ApiResponse<DriverDocument>, Error, DriverDocumentCreate>({
    mutationFn: (body) =>
      api.post<ApiResponse<DriverDocument>>(`/api/v1/drivers/${driverId}/documents`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.documents(driverId) })
    },
  })
}

export function useDeleteDriverDocument(driverId: string) {
  const qc = useQueryClient()

  return useMutation<ApiResponse<{ id: string }>, Error, string>({
    mutationFn: (docId) =>
      api.delete<ApiResponse<{ id: string }>>(`/api/v1/drivers/${driverId}/documents/${docId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.documents(driverId) })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP HISTORY
// ─────────────────────────────────────────────────────────────────────────────

interface UseDriverTripsParams {
  page?:     number
  pageSize?: number
}

export function useDriverTrips(
  driverId: string | undefined,
  params: UseDriverTripsParams = {}
) {
  const { page = 1, pageSize = 20 } = params

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
  })

  return useQuery<PaginatedResponse<DriverTripHistoryItem>>({
    queryKey:        driverKeys.trips(driverId!, { page, pageSize }),
    queryFn:         () =>
      api.get<PaginatedResponse<DriverTripHistoryItem>>(`/api/v1/drivers/${driverId}/trips?${searchParams}`).then(r => r.data),
    enabled:         !!driverId,
    placeholderData: keepPreviousData,
  })
}