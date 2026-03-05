/**
 * types/fleet.ts
 * Fleet Management System — Phase 2
 *
 * Truck and Trailer interfaces.
 * §2.2 Fleet Trucks, §2.3 Fleet Trailers
 */

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS
// ─────────────────────────────────────────────────────────────────────────────

export type TruckStatus = "active" | "inactive" | "in-progress";

export interface Truck {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: TruckStatus;
  odometerKm: number;
  fuelType: "diesel" | "petrol" | "electric" | "hybrid";
  vin?: string;
  color?: string;
  assignedDriverId?: string;
  currentTripId?: string;
  insuranceExpiryDate?: string;   // ISO 8601
  inspectionExpiryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TruckDocument {
  id: string;
  truckId: string;
  type: "insurance" | "registration" | "inspection" | "other";
  fileName: string;
  fileUrl: string;
  expiryDate?: string;
  uploadedAt: string;
  uploadedBy: string; // userId
}

export interface ServiceRecord {
  id: string;
  truckId: string;
  serviceType: string;
  description: string;
  odometerAtService: number;
  cost: number;
  performedBy: string;   // mechanic userId
  workOrderId?: string;
  serviceDate: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAILERS
// ─────────────────────────────────────────────────────────────────────────────

export type TrailerStatus = "active" | "inactive";

export interface Trailer {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: TrailerStatus;
  type: "flatbed" | "refrigerated" | "tanker" | "box" | "other";
  capacityTons?: number;
  assignedTripId?: string;
  insuranceExpiryDate?: string;
  inspectionExpiryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrailerDocument {
  id: string;
  trailerId: string;
  type: "insurance" | "registration" | "inspection" | "other";
  fileName: string;
  fileUrl: string;
  expiryDate?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface FleetSummary {
  totalTrucks:       number;
  activeTrucks:      number;
  inProgressTrucks:  number;
  inactiveTrucks:    number;
  totalTrailers:     number;
  activeTrailers:    number;
  inactiveTrailers:  number;
}