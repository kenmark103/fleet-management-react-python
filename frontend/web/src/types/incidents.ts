/**
 * types/incidents.ts
 * Fleet Management System — Phase 8
 */

export type IncidentType =
  | "accident"
  | "breakdown"
  | "theft"
  | "traffic_violation"
  | "near_miss"
  | "property_damage"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "under_review" | "resolved" | "closed";

export interface IncidentAttachment {
  id:         string;
  incidentId: string;
  fileName:   string;
  fileUrl:    string;
  fileType?:  string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Incident {
  id:               string;
  incidentNumber:   string;
  title:            string;
  description:      string;
  type:             IncidentType;
  severity:         IncidentSeverity;
  status:           IncidentStatus;
  incidentDate:     string;
  location?:        string;
  locationLat?:     number;
  locationLng?:     number;
  driverId?:        string;
  truckId?:         string;
  trailerId?:       string;
  tripId?:          string;
  reportedBy:       string;
  resolutionNotes?: string;
  resolvedAt?:      string;
  resolvedBy?:      string;
  createdAt:        string;
  updatedAt:        string;
  attachments:      IncidentAttachment[];
  // Denormalised
  reporterName:     string;
  driverName?:      string;
  truckPlate?:      string;
  tripNumber?:      string;
}

export interface IncidentCreate {
  title:         string;
  description:   string;
  type:          IncidentType;
  severity:      IncidentSeverity;
  incidentDate:  string;
  location?:     string;
  locationLat?:  number;
  locationLng?:  number;
  driverId?:     string;
  truckId?:      string;
  trailerId?:    string;
  tripId?:       string;
}

export interface IncidentUpdate {
  title?:           string;
  description?:     string;
  type?:            IncidentType;
  severity?:        IncidentSeverity;
  incidentDate?:    string;
  location?:        string;
  driverId?:        string;
  truckId?:         string;
  trailerId?:       string;
  tripId?:          string;
  resolutionNotes?: string;
}

export interface IncidentStatusUpdate {
  status:           IncidentStatus;
  resolutionNotes?: string;
}

export interface IncidentAttachmentCreate {
  fileName:  string;
  fileUrl:   string;
  fileType?: string;
}

export interface IncidentSummary {
  total:       number;
  open:        number;
  underReview: number;
  resolved:    number;
  closed:      number;
  critical:    number;
}

export interface IncidentParams {
  page?:      number;
  pageSize?:  number;
  status?:    IncidentStatus;
  severity?:  IncidentSeverity;
  type?:      IncidentType;
  driverId?:  string;
  truckId?:   string;
  tripId?:    string;
  search?:    string;
  dateFrom?:  string;
  dateTo?:    string;
}