
import { API_BASE_URL } from "./constants";
import type {
  Truck, Trailer, FleetSummary,
  TruckStatus, TrailerStatus,
} from "../types/fleet";

export interface TruckPayload {
  plateNumber:          string;
  make:                 string;
  model:                string;
  year:                 number;
  status:               TruckStatus;
  odometerKm:           number;
  fuelType:             "diesel" | "petrol" | "electric" | "hybrid";
  vin?:                 string;
  color?:               string;
  insuranceExpiryDate?: string;
  inspectionExpiryDate?: string;
  notes?:               string;
}

export interface TrailerPayload {
  plateNumber:          string;
  make:                 string;
  model:                string;
  year:                 number;
  status:               TrailerStatus;
  type:                 "flatbed" | "refrigerated" | "tanker" | "box" | "other";
  capacityTons?:        number;
  insuranceExpiryDate?: string;
  inspectionExpiryDate?: string;
  notes?:               string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Fleet Summary ─────────────────────────────────────────────────────────────

export const getFleetSummary = () =>
  req<FleetSummary>("/fleet/summary");

// ── Trucks ────────────────────────────────────────────────────────────────────

export const listTrucks = (status?: TruckStatus) =>
  req<Truck[]>(`/fleet/trucks${status ? `?status=${status}` : ""}`);

export const getTruck = (id: string) =>
  req<Truck>(`/fleet/trucks/${id}`);

export const createTruck = (payload: TruckPayload) =>
  req<Truck>("/fleet/trucks", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateTruck = (id: string, payload: Partial<TruckPayload>) =>
  req<Truck>(`/fleet/trucks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteTruck = (id: string) =>
  req<void>(`/fleet/trucks/${id}`, { method: "DELETE" });

// ── Trailers ──────────────────────────────────────────────────────────────────

export const listTrailers = (status?: TrailerStatus) =>
  req<Trailer[]>(`/fleet/trailers${status ? `?status=${status}` : ""}`);

export const getTrailer = (id: string) =>
  req<Trailer>(`/fleet/trailers/${id}`);

export const createTrailer = (payload: TrailerPayload) =>
  req<Trailer>("/fleet/trailers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateTrailer = (id: string, payload: Partial<TrailerPayload>) =>
  req<Trailer>(`/fleet/trailers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteTrailer = (id: string) =>
  req<void>(`/fleet/trailers/${id}`, { method: "DELETE" });