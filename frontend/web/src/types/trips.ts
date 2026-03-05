/**
 * types/trip.ts
 * Fleet Management System — Phase 5
**/
// ─────────────────────────────────────────────────────────────────────────────
// TRIP
// ─────────────────────────────────────────────────────────────────────────────

export type TripStatus = "pending" | "en-route" | "completed" | "cancelled";

export interface Trip {
  id: string;
  tripNumber: string;      // human-readable reference e.g. "TRP-00123"
  status: TripStatus;
  origin: string;
  destination: string;
  // Phase 5: coordinate fields
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  scheduledDeparture: string;  // ISO 8601
  scheduledArrival: string;
  actualDeparture?: string;
  actualArrival?: string;
  distanceKm?: number;
  cargoDescription?: string;
  cargoWeightTons?: number;
  assignedTruckId?: string;
  assignedTrailerId?: string;
  assignedDriverId?: string;
  // Phase 5: denormalized display fields
  assignedTruckPlate?: string;
  assignedTrailerPlate?: string;
  assignedDriverName?: string;
  dispatchedBy: string;
  dispatchedByName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Phase 5: latest location ping for map
  lastPing: TripLocationPing;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PING (Option B - full history support)
// ─────────────────────────────────────────────────────────────────────────────

export interface TripLocationPing {
  id: string;
  tripId: string;
  lat: number;
  lng: number;
  recordedAt: string;
  recordedBy: string;
  accuracyM?: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Represents the act of assigning a truck/driver to a trip */
export interface Assignment {
  id: string;
  tripId: string;
  truckId: string;
  driverId: string;
  trailerId?: string;
  assignedAt: string;
  assignedBy: string; // userId
}

// ─────────────────────────────────────────────────────────────────────────────
// API REQUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TripCreateRequest {
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  distanceKm?: number;
  cargoDescription?: string;
  cargoWeightTons?: number;
  assignedTruckId?: string;
  assignedTrailerId?: string;
  assignedDriverId?: string;
  notes?: string;
  // Optional: client can send coords if geocoded client-side
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
}

export interface TripUpdateRequest {
  origin?: string;
  destination?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  status?: TripStatus;
  assignedTruckId?: string;
  assignedTrailerId?: string;
  assignedDriverId?: string;
  actualDeparture?: string;
  actualArrival?: string;
  distanceKm?: number;
  cargoDescription?: string;
  cargoWeightTons?: number;
  notes?: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
}

export interface TripStatusUpdateRequest {
  status: TripStatus;
  notes?: string;
  locationLat?: number;
  locationLng?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS UPDATE  (DRIVER updates their own trip)
// ─────────────────────────────────────────────────────────────────────────────

export interface TripStatusUpdate {
  tripId: string;
  status: TripStatus;
  updatedBy: string;  // driverId
  timestamp: string;
  notes?: string;
  locationLat?: number;
  locationLng?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedTripsResponse {
  data: Trip[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}