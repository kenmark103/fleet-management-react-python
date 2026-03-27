/**
 * types/reports.ts
 * Fleet Management System — Phase 8
 */

export interface TripsSummaryReport {
  totalTrips:       number;
  pending:          number;
  enRoute:          number;
  completed:        number;
  cancelled:        number;
  totalDistanceKm:  number;
  avgDurationHours: number;
}

export interface MaintenanceSummaryReport {
  totalWorkOrders: number;
  pending:         number;
  inProgress:      number;
  completed:       number;
  overdue:         number;
  totalCost:       number;
  avgCost:         number;
  currency:        string;
}

export interface DriverPerformanceRow {
  driverId:        string;
  driverName:      string;
  totalTrips:      number;
  completedTrips:  number;
  cancelledTrips:  number;
  totalDistanceKm: number;
  onTimeRate:      number;
}

export interface DriverPerformanceReport {
  drivers:  DriverPerformanceRow[];
  dateFrom?: string;
  dateTo?:   string;
}

export interface ReportDateParams {
  dateFrom?: string;
  dateTo?:   string;
}