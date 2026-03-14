/**
 * lib/vehicle-data.ts
 * Fleet Management System
 *
 * Typed helpers over the static vehicle_data.json catalog.
 * Imported directly by TruckForm and TrailerForm — no API call needed
 * for catalog data since it is bundled at build time.
 *
 * If the catalog ever moves to a database-backed endpoint, swap the
 * import for an API fetch and update getTruckMakeNames / getTrailerMakeNames
 * to async functions without touching the forms.
 */

import rawData from "../data/vehicle_data.json";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogTruckModel {
  model:           string;
  wheelConfig:     string;
  grossWeightTons: number;
  axleLoadTons:    number;
}

export interface CatalogTruckMake {
  make:   string;
  models: CatalogTruckModel[];
}

export type TrailerBodyType = "flatbed" | "refrigerated" | "tanker" | "box" | "other";

export interface CatalogTrailerModel {
  model:        string;
  type:         TrailerBodyType;
  capacityTons: number;
  axles:        number;
}

export interface CatalogTrailerMake {
  make:   string;
  models: CatalogTrailerModel[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw data (cast once, reuse everywhere)
// ─────────────────────────────────────────────────────────────────────────────

const TRUCKS:   CatalogTruckMake[]   = rawData.trucks   as CatalogTruckMake[];
const TRAILERS: CatalogTrailerMake[] = rawData.trailers as CatalogTrailerMake[];

// ─────────────────────────────────────────────────────────────────────────────
// Truck helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sorted list of all truck make names. */
export const getTruckMakeNames = (): string[] =>
  TRUCKS.map((m) => m.make).sort();

/** All catalog models for a given make, or [] if make is unknown. */
export const getTruckModels = (make: string): CatalogTruckModel[] =>
  TRUCKS.find((m) => m.make === make)?.models ?? [];

/** Exact model spec record, or undefined. */
export const getTruckModelSpec = (
  make: string,
  model: string,
): CatalogTruckModel | undefined =>
  getTruckModels(make).find((m) => m.model === model);

/** True if make exists in the catalog. */
export const isKnownTruckMake = (make: string): boolean =>
  TRUCKS.some((m) => m.make === make);

/** True if model exists under the given make in the catalog. */
export const isKnownTruckModel = (make: string, model: string): boolean =>
  getTruckModels(make).some((m) => m.model === model);

// ─────────────────────────────────────────────────────────────────────────────
// Trailer helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sorted list of all trailer make names. */
export const getTrailerMakeNames = (): string[] =>
  TRAILERS.map((m) => m.make).sort();

/** All catalog models for a given make, or [] if make is unknown. */
export const getTrailerModels = (make: string): CatalogTrailerModel[] =>
  TRAILERS.find((m) => m.make === make)?.models ?? [];

/** Exact model spec record, or undefined. */
export const getTrailerModelSpec = (
  make: string,
  model: string,
): CatalogTrailerModel | undefined =>
  getTrailerModels(make).find((m) => m.model === model);

/** True if make exists in the catalog. */
export const isKnownTrailerMake = (make: string): boolean =>
  TRAILERS.some((m) => m.make === make);

/** True if model exists under the given make in the catalog. */
export const isKnownTrailerModel = (make: string, model: string): boolean =>
  getTrailerModels(make).some((m) => m.model === model);