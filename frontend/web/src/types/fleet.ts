/**
 * types/fleet.ts
 * Fleet Management System — Phase 2
 *
 * Changes (Stage 2):
 *   - Truck: added wheelConfig, grossWeightTons, axleLoadTons (optional catalog spec fields)
 *   - Trailer: added axles (optional catalog spec field)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS
// ─────────────────────────────────────────────────────────────────────────────

export type TruckStatus = "active" | "inactive" | "in-progress";

export interface Truck {
  id:                    string;
  plateNumber:           string;
  make:                  string;
  model:                 string;
  year:                  number;
  status:                TruckStatus;
  odometerKm:            number;
  fuelType:              "diesel" | "petrol" | "electric" | "hybrid";
  vin?:                  string;
  color?:                string;
  assignedDriverId?:     string;
  currentTripId?:        string;
  insuranceExpiryDate?:  string;   // ISO 8601
  inspectionExpiryDate?: string;
  notes?:                string;
  // Stage 2: catalog spec fields — populated when make/model selected from catalog
  wheelConfig?:          string;
  grossWeightTons?:      number;
  axleLoadTons?:         number;
  createdAt:             string;
  updatedAt:             string;
}

export interface TruckDocument {
  id:          string;
  truckId:     string;
  type:        "insurance" | "registration" | "inspection" | "other";
  fileName:    string;
  fileUrl:     string;
  expiryDate?: string;
  uploadedAt:  string;
  uploadedBy:  string;
}

export interface ServiceRecord {
  id:                string;
  truckId:           string;
  serviceType:       string;
  description:       string;
  odometerAtService: number;
  cost:              number;
  performedBy:       string;
  workOrderId?:      string;
  serviceDate:       string;
  createdAt:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAILERS
// ─────────────────────────────────────────────────────────────────────────────

export type TrailerStatus = "active" | "inactive";

export interface Trailer {
  id:                    string;
  plateNumber:           string;
  make:                  string;
  model:                 string;
  year:                  number;
  status:                TrailerStatus;
  type:                  "flatbed" | "refrigerated" | "tanker" | "box" | "other";
  capacityTons?:         number;
  assignedTripId?:       string;
  insuranceExpiryDate?:  string;
  inspectionExpiryDate?: string;
  notes?:                string;
  // Stage 2: catalog spec field
  axles?:                number;
  createdAt:             string;
  updatedAt:             string;
}

export interface TrailerDocument {
  id:          string;
  trailerId:   string;
  type:        "insurance" | "registration" | "inspection" | "other";
  fileName:    string;
  fileUrl:     string;
  expiryDate?: string;
  uploadedAt:  string;
  uploadedBy:  string;
}

export interface FleetSummary {
  totalTrucks:      number;
  activeTrucks:     number;
  inProgressTrucks: number;
  inactiveTrucks:   number;
  totalTrailers:    number;
  activeTrailers:   number;
  inactiveTrailers: number;
}