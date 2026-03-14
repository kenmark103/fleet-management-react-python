/**
 * hooks/useAvailability.ts
 * Fleet Management System
 *
 * Fetches resource availability for a given date range from
 * GET /api/v1/trips/availability.
 *
 * When both departure and arrival are provided the backend checks each
 * truck, trailer, and driver for date-range overlap with existing
 * pending/en-route trips and returns an `available` flag + the
 * conflicting trip number when blocked.
 *
 * When dates are omitted the endpoint returns all active resources
 * with available=true — used for the initial TripForm render before
 * dates are entered.
 *
 * Query key hierarchy:
 *   ["trips", "availability"]                              — root
 *   ["trips", "availability", { departure, arrival, ... }] — specific window
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import api from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES  (mirror schemas/trips.py availability schemas)
// ─────────────────────────────────────────────────────────────────────────────

export interface TruckAvailability {
  id:                  string;
  plateNumber:         string;
  make:                string;
  model:               string;
  year:                number;
  fuelType:            string;
  status:              string;
  available:           boolean;
  conflictTripNumber:  string | null;
  conflictTripId:      string | null;
}

export interface TrailerAvailability {
  id:                  string;
  plateNumber:         string;
  type:                string;
  capacityTons:        number | null;
  available:           boolean;
  conflictTripNumber:  string | null;
  conflictTripId:      string | null;
}

export interface DriverAvailability {
  id:                  string;
  firstName:           string;
  lastName:            string;
  licenseClass:        string;
  available:           boolean;
  conflictTripNumber:  string | null;
  conflictTripId:      string | null;
}

export interface AvailabilityResponse {
  trucks:    TruckAvailability[];
  trailers:  TrailerAvailability[];
  drivers:   DriverAvailability[];
  departure: string | null;
  arrival:   string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const availabilityKeys = {
  all:  ["trips", "availability"] as const,
  window: (
    departure:      string | null,
    arrival:        string | null,
    excludeTripId?: string,
  ) => ["trips", "availability", { departure, arrival, excludeTripId }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseAvailabilityOptions {
  /** ISO 8601 — from scheduledDeparture in TripForm */
  departure?:     string | null;
  /** ISO 8601 — from scheduledArrival in TripForm */
  arrival?:       string | null;
  /**
   * Pass the current trip's ID when editing so the backend excludes it
   * from the overlap check (a trip doesn't conflict with itself).
   */
  excludeTripId?: string;
}

export function useAvailability({
  departure,
  arrival,
  excludeTripId,
}: UseAvailabilityOptions = {}) {
  const dep = departure || null;
  const arr = arrival   || null;

  const params = new URLSearchParams();
  if (dep)           params.set("departure",        dep);
  if (arr)           params.set("arrival",           arr);
  if (excludeTripId) params.set("exclude_trip_id",   excludeTripId);

  return useQuery<AvailabilityResponse>({
    queryKey: availabilityKeys.window(dep, arr, excludeTripId),
    queryFn:  () =>
      api
        .get<AvailabilityResponse>(`/api/v1/trips/availability?${params}`)
        .then((r) => r.data),
    // 30 s stale time — availability can change as other dispatchers book trips
    staleTime:       30 * 1000,
    // Keep previous data while re-fetching so dropdowns don't flash empty
    placeholderData: keepPreviousData,
  });
}