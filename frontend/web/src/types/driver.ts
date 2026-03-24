/**
 * types/driver.ts
 * Fleet Management System
 *
 * Changes from previous version:
 *   - Removed DriverAdminCreate (used by old "admin creates everything" flow).
 *     That flow is gone — drivers are now invited via /settings/users
 *     and complete their own profile at /drivers/setup.
 *   - DriverCreate restored to include userId (the setup page sends
 *     the current user's own ID to POST /api/v1/drivers).
 *   - tempPassword removed everywhere — passwords are set by users themselves.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type DriverStatus = "active" | "inactive" | "on-leave" | "suspended";

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
  id:                     string;
  userId:                 string;
  firstName:              string;
  lastName:               string;
  email:                  string;
  phone:                  string;
  status:                 DriverStatus;
  licenseNumber:          string;
  licenseClass:           string;
  licenseExpiryDate:      string;   // ISO 8601
  hireDate:               string;
  dateOfBirth?:           string;
  nationalId?:            string;
  address?:               string;
  emergencyContactName?:  string;
  emergencyContactPhone?: string;
  avatarUrl?:             string;
  notes?:                 string;
  // Computed — populated by the backend router
  currentTruckId?:        string;
  activeTripId?:          string;
  createdAt:              string;
  updatedAt:              string;
}

/**
 * POST /api/v1/drivers
 *
 * Used by /drivers/setup when a driver completes their own profile.
 * userId is the current authenticated user's ID — drivers can only
 * create a profile linked to themselves (enforced by backend too).
 *
 * Admins can also POST here to create a profile for a specific user,
 * but they still need to supply the userId of that user's existing account.
 */
export interface DriverCreate {
  userId:                 string;  // links to an existing User row
  firstName:              string;
  lastName:               string;
  email:                  string;
  phone:                  string;
  status:                 DriverStatus;
  licenseNumber:          string;
  licenseClass:           string;
  licenseExpiryDate:      string;
  hireDate:               string;
  dateOfBirth?:           string;
  nationalId?:            string;
  address?:               string;
  emergencyContactName?:  string;
  emergencyContactPhone?: string;
  avatarUrl?:             string;
  notes?:                 string;
}

/**
 * PATCH /api/v1/drivers/{id}
 * All fields optional — only supplied fields are patched.
 */
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
  uploadedBy:  string;  // userId
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
// TRIP HISTORY  (lightweight — full Trip type lives in types/trips.ts)
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