/**
 * hooks/useDashboard.ts
 * Fleet Management System — Phase 9
 *
 * All data-fetching for the dashboard, one hook per widget section.
 * Each hook is independent — a failure in one does not affect the others.
 *
 * Query keys:
 *   ["dashboard", "fleet-summary"]
 *   ["dashboard", "driver-summary"]
 *   ["dashboard", "active-trips-count"]
 *   ["dashboard", "pending-wo-count"]
 *   ["dashboard", "fuel-kpi"]
 *   ["dashboard", "trips"]
 *   ["dashboard", "activity-trips"]
 *   ["dashboard", "activity-work-orders"]
 *   ["dashboard", "expiry-trucks"]
 *   ["dashboard", "expiry-drivers"]
 *   ["dashboard", "maint-pending"]
 *   ["dashboard", "maint-overdue"]
 *   ["dashboard", "cost-summary"]
 */

import { useQuery } from '@tanstack/react-query'
import apiClient from '../lib/api'
import type { PaginatedResponse, ApiResponse } from '../types/api'
import type { StatusValue } from '../lib/constants'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES  (dashboard-local — only the fields each widget actually reads)
// ─────────────────────────────────────────────────────────────────────────────

export interface DashFleetSummary {
  totalTrucks:      number
  activeTrucks:     number
  inactiveTrucks:   number
  inProgressTrucks: number
  totalTrailers:    number
  activeTrailers:   number
  inactiveTrailers: number
}

export interface DashDriverSummary {
  totalDrivers:        number
  activeDrivers:       number
  inactiveDrivers:     number
  expiringLicenses30d: number
}

export interface DashTrip {
  id:                 string
  tripNumber:         string
  status:             StatusValue
  origin:             string
  destination:        string
  scheduledDeparture: string
  assignedDriverName: string | null
  assignedTruckPlate: string | null
}

export interface DashWorkOrder {
  id:               string
  workOrderNumber:  string
  title:            string
  priority:         'low' | 'medium' | 'high' | 'critical'
  status:           string
  truckPlateNumber: string | null
  scheduledDate:    string
}

// Mirrors the real FuelReport shape from routers/fuel.py:
//   report.kpis.*            — top-level totals
//   report.monthlyFuelCosts  — [{month, totalCost}]
//   report.monthlyExpenses   — [{month, totalAmount}]
export interface DashFuelReport {
  kpis: {
    totalFuelCost: number
    totalExpenses: number
    totalCombined: number
    avgCostPerKm:  number | null
  }
  monthlyFuelCosts: Array<{ month: string; totalCost: number }>
  monthlyExpenses:  Array<{ month: string; totalAmount: number }>
  currency:         string
}

export interface DashTruck {
  id:                   string
  plateNumber:          string
  make:                 string
  insuranceExpiryDate:  string | null
  inspectionExpiryDate: string | null
}

export interface DashDriver {
  id:                string
  firstName:         string
  lastName:          string
  licenseExpiryDate: string
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all:               ['dashboard'] as const,
  fleetSummary:      ['dashboard', 'fleet-summary'] as const,
  driverSummary:     ['dashboard', 'driver-summary'] as const,
  activeTripsCount:  ['dashboard', 'active-trips-count'] as const,
  pendingWoCount:    ['dashboard', 'pending-wo-count'] as const,
  fuelKpi:           ['dashboard', 'fuel-kpi'] as const,
  trips:             ['dashboard', 'trips'] as const,
  activityTrips:     ['dashboard', 'activity-trips'] as const,
  activityWorkOrders:['dashboard', 'activity-work-orders'] as const,
  expiryTrucks:      ['dashboard', 'expiry-trucks'] as const,
  expiryDrivers:     ['dashboard', 'expiry-drivers'] as const,
  maintPending:      ['dashboard', 'maint-pending'] as const,
  maintOverdue:      ['dashboard', 'maint-overdue'] as const,
  costSummary:       ['dashboard', 'cost-summary'] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI GRID
// All five queries fire in parallel — no waterfall.
// ─────────────────────────────────────────────────────────────────────────────

interface KpiPermissions {
  canViewKpi:        boolean
  canViewDrivers:    boolean
  canViewTrips:      boolean
  canViewMaint:      boolean
  canViewCosts:      boolean
}

export function useKpiData({
  canViewKpi, canViewDrivers, canViewTrips, canViewMaint, canViewCosts,
}: KpiPermissions) {
  const fleet = useQuery({
    queryKey: dashboardKeys.fleetSummary,
    queryFn:  () => apiClient.get<DashFleetSummary>('/api/v1/fleet/summary').then(r => r.data),
    enabled:  canViewKpi,
    staleTime: 5 * 60 * 1000,
  })

  const drivers = useQuery({
    queryKey: dashboardKeys.driverSummary,
    queryFn:  () => apiClient.get<ApiResponse<DashDriverSummary>>('/api/v1/drivers/summary').then(r => r.data.data),
    enabled:  canViewDrivers,
    staleTime: 5 * 60 * 1000,
  })

  const activeTripsCount = useQuery({
    queryKey: dashboardKeys.activeTripsCount,
    queryFn:  () => apiClient.get<PaginatedResponse<DashTrip>>('/api/v1/trips?status=en-route&page_size=1').then(r => r.data.meta.totalItems),
    enabled:  canViewTrips,
    staleTime: 2 * 60 * 1000,
  })

  const pendingWoCount = useQuery({
    queryKey: dashboardKeys.pendingWoCount,
    queryFn:  () => apiClient.get<PaginatedResponse<DashWorkOrder>>('/api/v1/maintenance/work-orders?status=pending&page_size=1').then(r => r.data.meta.totalItems),
    enabled:  canViewMaint,
    staleTime: 5 * 60 * 1000,
  })

  const fuelKpi = useQuery({
    queryKey: dashboardKeys.fuelKpi,
    queryFn:  () => apiClient.get<ApiResponse<DashFuelReport>>('/api/v1/fuel/reports').then(r => r.data.data),
    enabled:  canViewCosts,
    staleTime: 10 * 60 * 1000,
  })

  return { fleet, drivers, activeTripsCount, pendingWoCount, fuelKpi }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT TRIPS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardTrips() {
  return useQuery({
    queryKey:  dashboardKeys.trips,
    queryFn:   () => apiClient.get<PaginatedResponse<DashTrip>>('/api/v1/trips?page_size=6').then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardActivity() {
  const trips = useQuery({
    queryKey:  dashboardKeys.activityTrips,
    queryFn:   () => apiClient.get<PaginatedResponse<DashTrip>>('/api/v1/trips?page_size=4').then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })

  const workOrders = useQuery({
    queryKey:  dashboardKeys.activityWorkOrders,
    queryFn:   () => apiClient.get<PaginatedResponse<DashWorkOrder>>('/api/v1/maintenance/work-orders?page_size=4').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return { trips, workOrders }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY ALERTS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardExpiryAlerts() {
  const trucks = useQuery({
    queryKey:  dashboardKeys.expiryTrucks,
    queryFn:   () => apiClient.get<PaginatedResponse<DashTruck>>('/api/v1/fleet/trucks?page_size=100').then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  })

  const drivers = useQuery({
    queryKey:  dashboardKeys.expiryDrivers,
    queryFn:   () => apiClient.get<PaginatedResponse<DashDriver>>('/api/v1/drivers?page_size=50').then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  })

  return { trucks, drivers }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE ALERTS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardMaintenanceAlerts() {
  const pending = useQuery({
    queryKey:  dashboardKeys.maintPending,
    queryFn:   () => apiClient.get<PaginatedResponse<DashWorkOrder>>('/api/v1/maintenance/work-orders?status=pending&page_size=5').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const overdue = useQuery({
    queryKey:  dashboardKeys.maintOverdue,
    queryFn:   () => apiClient.get<PaginatedResponse<DashWorkOrder>>('/api/v1/maintenance/work-orders?status=overdue&page_size=5').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return { pending, overdue }
}

// ─────────────────────────────────────────────────────────────────────────────
// COST SUMMARY WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardCostSummary() {
  return useQuery({
    queryKey:  dashboardKeys.costSummary,
    queryFn:   () => apiClient.get<ApiResponse<DashFuelReport>>('/api/v1/fuel/reports').then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  })
}