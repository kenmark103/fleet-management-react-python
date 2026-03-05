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
} from "@tanstack/react-query";
import type {
  Driver,
  DriverCreate,
  DriverUpdate,
  DriverDocument,
  DriverDocumentCreate,
  DriverSummary,
  DriverTripHistoryItem,
} from "../types/driver";
import type { PaginatedResponse, ApiResponse } from "../types/api";
import { API_BASE_URL } from "../lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// FETCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const driverKeys = {
  all:       ["drivers"] as const,
  lists:     () => ["drivers", "list"] as const,
  list:      (filters: object) => ["drivers", "list", filters] as const,
  summary:   () => ["drivers", "summary"] as const,
  details:   () => ["drivers", "detail"] as const,
  detail:    (id: string) => ["drivers", "detail", id] as const,
  documents: (id: string) => ["drivers", "documents", id] as const,
  trips:     (id: string, filters: object) => ["drivers", "trips", id, filters] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

interface UseDriversParams {
  page?:     number;
  pageSize?: number;
  status?:   string;
  search?:   string;
}

export function useDrivers(params: UseDriversParams = {}) {
  const { page = 1, pageSize = 20, status, search } = params;

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  });

  return useQuery<PaginatedResponse<Driver>>({
    queryKey:    driverKeys.list({ page, pageSize, status, search }),
    queryFn:     () => apiFetch(`/drivers?${searchParams}`),
    placeholderData: keepPreviousData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverSummary() {
  return useQuery<ApiResponse<DriverSummary>>({
    queryKey: driverKeys.summary(),
    queryFn:  () => apiFetch("/drivers/summary"),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export function useDriver(driverId: string | undefined) {
  return useQuery<ApiResponse<Driver>>({
    queryKey: driverKeys.detail(driverId!),
    queryFn:  () => apiFetch(`/drivers/${driverId}`),
    enabled:  !!driverId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateDriver() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Driver>, Error, DriverCreate>({
    mutationFn: (body) =>
      apiFetch("/drivers", {
        method: "POST",
        body:   JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      qc.invalidateQueries({ queryKey: driverKeys.summary() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateDriver(driverId: string) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<Driver>, Error, DriverUpdate>({
    mutationFn: (body) =>
      apiFetch(`/drivers/${driverId}`, {
        method: "PATCH",
        body:   JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.setQueryData(driverKeys.detail(driverId), res);
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      qc.invalidateQueries({ queryKey: driverKeys.summary() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteDriver() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<{ id: string }>, Error, string>({
    mutationFn: (driverId) =>
      apiFetch(`/drivers/${driverId}`, { method: "DELETE" }),
    onSuccess: (_res, driverId) => {
      qc.removeQueries({ queryKey: driverKeys.detail(driverId) });
      qc.invalidateQueries({ queryKey: driverKeys.lists() });
      qc.invalidateQueries({ queryKey: driverKeys.summary() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverDocuments(driverId: string | undefined) {
  return useQuery<ApiResponse<DriverDocument[]>>({
    queryKey: driverKeys.documents(driverId!),
    queryFn:  () => apiFetch(`/drivers/${driverId}/documents`),
    enabled:  !!driverId,
  });
}

export function useUploadDriverDocument(driverId: string) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<DriverDocument>, Error, DriverDocumentCreate>({
    mutationFn: (body) =>
      apiFetch(`/drivers/${driverId}/documents`, {
        method: "POST",
        body:   JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.documents(driverId) });
    },
  });
}

export function useDeleteDriverDocument(driverId: string) {
  const qc = useQueryClient();

  return useMutation<ApiResponse<{ id: string }>, Error, string>({
    mutationFn: (docId) =>
      apiFetch(`/drivers/${driverId}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driverKeys.documents(driverId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP HISTORY
// ─────────────────────────────────────────────────────────────────────────────

interface UseDriverTripsParams {
  page?:     number;
  pageSize?: number;
}

export function useDriverTrips(
  driverId: string | undefined,
  params: UseDriverTripsParams = {}
) {
  const { page = 1, pageSize = 20 } = params;

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
  });

  return useQuery<PaginatedResponse<DriverTripHistoryItem>>({
    queryKey: driverKeys.trips(driverId!, { page, pageSize }),
    queryFn:  () => apiFetch(`/drivers/${driverId}/trips?${searchParams}`),
    enabled:  !!driverId,
    placeholderData: keepPreviousData,
  });
}