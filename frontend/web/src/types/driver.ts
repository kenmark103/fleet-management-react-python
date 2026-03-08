// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type DriverStatus = "active" | "inactive";

export type DriverDocumentType =
  | "license"
  | "medical"
  | "contract"
  | "certificate"
  | "other";

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER
// ─────────────────────────────────────────────────────────────────────────────

export interface Driver {
  id:                    string;
  userId:                string;
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  status:                DriverStatus;
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;   // ISO 8601
  hireDate:              string;
  dateOfBirth?:          string;
  nationalId?:           string;
  address?:              string;
  emergencyContactName?: string;
  emergencyContactPhone?:string;
  avatarUrl?:            string;
  notes?:                string;
  // Computed
  currentTruckId?:       string;
  activeTripId?:         string;
  createdAt:             string;
  updatedAt:             string;
}

/**
 * Used when a Driver record already has a User account and you're
 * linking them — userId is required in this case.
 */
export interface DriverCreate {
  userId:                string;
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  status:                DriverStatus;
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;
  hireDate:              string;
  dateOfBirth?:          string;
  nationalId?:           string;
  address?:              string;
  emergencyContactName?: string;
  emergencyContactPhone?:string;
  avatarUrl?:            string;
  notes?:                string;
}

/**
 * Used by the admin "Add New Driver" form (POST /api/v1/drivers).
 * The backend atomically creates the User (role=DRIVER) + Driver profile,
 * so userId is NOT sent — it is generated server-side.
 * tempPassword is included so the backend can set the initial login credential.
 */
export interface DriverAdminCreate {
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  status:                DriverStatus;
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;
  hireDate:              string;
  tempPassword:          string;
  dateOfBirth?:          string;
  nationalId?:           string;
  address?:              string;
  emergencyContactName?: string;
  emergencyContactPhone?:string;
  avatarUrl?:            string;
  notes?:                string;
}

export type DriverUpdate = Partial<Omit<DriverCreate, "userId">>;

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverDocument {
  id:          string;
  driverId:    string;
  type:        DriverDocumentType;
  fileName:    string;
  fileUrl:     string;
  expiryDate?: string;
  uploadedAt:  string;
  uploadedBy:  string;   // userId
}

export interface DriverDocumentCreate {
  type:        DriverDocumentType;
  fileName:    string;
  fileUrl:     string;
  expiryDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverSummary {
  totalDrivers:         number;
  activeDrivers:        number;
  inactiveDrivers:      number;
  expiringLicenses30d:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP HISTORY ITEM  (lightweight — full Trip type lives in types/trip.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverTripHistoryItem {
  id:                 string;
  tripNumber:         string;
  status:             string;
  origin:             string;
  destination:        string;
  scheduledDeparture: string;
  scheduledArrival:   string;
  actualDeparture?:   string;
  actualArrival?:     string;
  assignedTruckId?:   string;
}