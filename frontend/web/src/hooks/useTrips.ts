/**
 * hooks/useTrips.ts
 * Fleet Management System — Phase 5 (revised Phase 9)
 *
 * Switched from axios `api` instance to raw fetch + API_BASE_URL,
 * matching the pattern used in useDrivers.ts.
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
} from "@tanstack/react-query";
import type {
  Trip,
  TripCreateRequest,
  TripUpdateRequest,
  TripStatusUpdateRequest,
  TripLocationPing,
  PaginatedTripsResponse,
  TripStatus,
} from "../types/trips";
import { API_BASE_URL } from "../lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// FETCH HELPER
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

export const tripKeys = {
  all:     ["trips"] as const,
  lists:   () => ["trips", "list"] as const,
  list:    (filters: object) => ["trips", "list", filters] as const,
  details: () => ["trips", "detail"] as const,
  detail:  (id: string) => ["trips", "detail", id] as const,
  pings:   (id: string) => ["trips", "detail", id, "pings"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

interface ListTripsParams {
  status?:   TripStatus;
  search?:   string;
  page?:     number;
  pageSize?: number;
}

export function useTrips(params: ListTripsParams = {}) {
  const { status, search, page = 1, pageSize = 20 } = params;

  const searchParams = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(status && { status }),
    ...(search && { search }),
  });

  return useQuery<PaginatedTripsResponse>({
    queryKey:        tripKeys.list({ status, search, page, pageSize }),
    queryFn:         () => apiFetch(`/trips?${searchParams}`),
    placeholderData: keepPreviousData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export function useTrip(id: string | undefined) {
  return useQuery<Trip>({
    queryKey: tripKeys.detail(id!),
    queryFn:  () => apiFetch(`/trips/${id}`),
    enabled:  !!id,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation<Trip, Error, TripCreateRequest>({
    mutationFn: (body) =>
      apiFetch("/trips", {
        method: "POST",
        body:   JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateTrip(id: string) {
  const qc = useQueryClient();

  return useMutation<Trip, Error, TripUpdateRequest>({
    mutationFn: (body) =>
      apiFetch(`/trips/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.setQueryData(tripKeys.detail(id), res);
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateTripStatus(id: string) {
  const qc = useQueryClient();

  return useMutation<Trip, Error, TripStatusUpdateRequest>({
    mutationFn: (body) =>
      apiFetch(`/trips/${id}/status`, {
        method: "PATCH",
        body:   JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.setQueryData(tripKeys.detail(id), res);
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteTrip() {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch(`/trips/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: tripKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tripKeys.lists() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PINGS
// ─────────────────────────────────────────────────────────────────────────────

export function useTripPings(tripId: string | undefined, limit = 100) {
  const searchParams = new URLSearchParams({ limit: String(limit) });

  return useQuery<TripLocationPing[]>({
    queryKey: tripKeys.pings(tripId!),
    queryFn:  () => apiFetch(`/trips/${tripId}/pings?${searchParams}`),
    enabled:  !!tripId,
  });
}