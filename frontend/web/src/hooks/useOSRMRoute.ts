/**
 * hooks/useOSRMRoute.ts
 * Fleet Management System
 *
 * Fetches a road-following route polyline from the OSRM public demo server.
 * Uses the /route/v1/driving endpoint with GeoJSON geometry output.
 *
 * Drop-in replacement for the straight-line <Polyline> in TripRouteMap.
 * Nominatim still handles geocoding — this only draws the road path.
 *
 * OSRM public server:  router.project-osrm.org
 * Free, no API key, uses OpenStreetMap road data.
 * Rate limit: reasonable for moderate usage (no burst hammering).
 *
 * Returns coordinates as [lat, lng] tuples ready for Leaflet.
 */

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type LatLng = [number, number]; // [lat, lng] — Leaflet order

export type OSRMRouteStatus =
  | "idle"       // no coords provided yet
  | "loading"    // fetching from OSRM
  | "success"    // polyline ready
  | "error"      // OSRM unavailable or no route found
  | "no-coords"; // origin or destination coords missing

export interface OSRMRouteResult {
  /** Road-following polyline as [lat, lng] pairs — drop into <Polyline positions={...}> */
  polyline:     LatLng[];
  /** Route distance in km as reported by OSRM (more accurate than straight-line) */
  distanceKm:   number | null;
  /** Estimated driving duration in seconds */
  durationSecs: number | null;
  status:       OSRMRouteStatus;
  error:        string | null;
}

interface OSRMRouteParams {
  originLat:      number | null | undefined;
  originLng:      number | null | undefined;
  destinationLat: number | null | undefined;
  destinationLng: number | null | undefined;
  /** Skip fetch entirely — useful when trip has no coords yet */
  enabled?:       boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OSRM FETCH (module-level so it's easy to unit test)
// ─────────────────────────────────────────────────────────────────────────────

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * Raw OSRM fetch — returns decoded polyline and route metadata.
 * OSRM coordinates are [lng, lat]; we flip to [lat, lng] for Leaflet.
 */
async function fetchOSRMRoute(
  originLat:      number,
  originLng:      number,
  destinationLat: number,
  destinationLng: number,
  signal?:        AbortSignal,
): Promise<{ polyline: LatLng[]; distanceKm: number; durationSecs: number }> {
  // OSRM expects coordinates as {lng},{lat} pairs separated by semicolons
  const coords = `${originLng},${originLat};${destinationLng},${destinationLat}`;
  const url    = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`OSRM HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message ?? "OSRM returned no route");
  }

  const route      = data.routes[0];
  const geoCoords  = route.geometry.coordinates as [number, number][];

  // Flip [lng, lat] → [lat, lng] for Leaflet
  const polyline: LatLng[] = geoCoords.map(([lng, lat]) => [lat, lng]);

  return {
    polyline,
    distanceKm:   route.distance / 1000,  // metres → km
    durationSecs: route.duration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_RESULT: OSRMRouteResult = {
  polyline:     [],
  distanceKm:   null,
  durationSecs: null,
  status:       "idle",
  error:        null,
};

export function useOSRMRoute({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  enabled = true,
}: OSRMRouteParams): OSRMRouteResult {
  const [result, setResult] = useState<OSRMRouteResult>(EMPTY_RESULT);

  const hasCoords =
    originLat      != null &&
    originLng      != null &&
    destinationLat != null &&
    destinationLng != null;

  useEffect(() => {
    if (!enabled || !hasCoords) {
      setResult((prev) => ({
        ...EMPTY_RESULT,
        status: hasCoords ? "idle" : "no-coords",
        // Preserve previous polyline so map doesn't flash empty on re-render
        polyline: prev.polyline,
      }));
      return;
    }

    const controller = new AbortController();
    setResult((prev) => ({ ...prev, status: "loading", error: null }));

    fetchOSRMRoute(
      originLat!,
      originLng!,
      destinationLat!,
      destinationLng!,
      controller.signal,
    )
      .then(({ polyline, distanceKm, durationSecs }) => {
        setResult({ polyline, distanceKm, durationSecs, status: "success", error: null });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return; // component unmounted — ignore
        console.warn("[useOSRMRoute] fetch failed:", err.message);
        setResult({
          polyline:     [],
          distanceKm:   null,
          durationSecs: null,
          status:       "error",
          error:        err.message,
        });
      });

    return () => controller.abort();

    // Re-fetch when any coordinate changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originLat, originLng, destinationLat, destinationLng, enabled]);

  return result;
}