/**
 * hooks/useReports.ts
 * Fleet Management System — Phase 8
 */

import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type {
  TripsSummaryReport, MaintenanceSummaryReport,
  DriverPerformanceReport, ReportDateParams,
} from '../types/reports'
import type { ApiResponse } from '../types/api'

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const reportKeys = {
  trips:       (p?: ReportDateParams) => ['reports', 'trips', p]       as const,
  maintenance: (p?: ReportDateParams) => ['reports', 'maintenance', p] as const,
  drivers:     (p?: ReportDateParams) => ['reports', 'drivers', p]     as const,
}

export function useTripsReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: reportKeys.trips(params),
    queryFn:  () =>
      api.get<ApiResponse<TripsSummaryReport>>(
        `/api/v1/reports/trips${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
    select:    (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMaintenanceReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: reportKeys.maintenance(params),
    queryFn:  () =>
      api.get<ApiResponse<MaintenanceSummaryReport>>(
        `/api/v1/reports/maintenance${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
    select:    (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDriverPerformanceReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: reportKeys.drivers(params),
    queryFn:  () =>
      api.get<ApiResponse<DriverPerformanceReport>>(
        `/api/v1/reports/drivers${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
    select:    (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}