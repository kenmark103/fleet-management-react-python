/**
 * hooks/useFuel.ts
 * Fleet Management System — Phase 6
 *
 * All TanStack Query hooks for the Fuel & Costs module.
 * Mirrors routers/fuel.py endpoint structure exactly.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from '../lib/api'
import type {
  FuelLog,
  FuelLogCreate,
  FuelLogUpdate,
  FuelLogParams,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  ExpenseParams,
  FuelReport,
  ReportParams,
} from '../types/fuel'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const fuelKeys = {
  all:      ['fuel'] as const,
  logs:     (params?: FuelLogParams)  => ['fuel', 'logs', params] as const,
  log:      (id: string)              => ['fuel', 'logs', id] as const,
  expenses: (params?: ExpenseParams)  => ['fuel', 'expenses', params] as const,
  expense:  (id: string)              => ['fuel', 'expenses', id] as const,
  reports:  (params?: ReportParams)   => ['fuel', 'reports', params] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// FUEL LOG HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useFuelLogs(params: FuelLogParams = {}) {
  return useQuery({
    queryKey:        fuelKeys.logs(params),
    queryFn:         () =>
      api.get<PaginatedResponse<FuelLog>>(`/api/v1/fuel/logs${buildQuery(params as Record<string, unknown>)}`).then(r => r.data),
    placeholderData: keepPreviousData,
    staleTime:       2 * 60 * 1000,
  })
}

export function useFuelLog(id: string) {
  return useQuery({
    queryKey: fuelKeys.log(id),
    queryFn:  () => api.get<ApiResponse<FuelLog>>(`/api/v1/fuel/logs/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useCreateFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FuelLogCreate) =>
      api.post<ApiResponse<FuelLog>>('/api/v1/fuel/logs', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'logs'] })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

export function useUpdateFuelLog(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FuelLogUpdate) =>
      api.patch<ApiResponse<FuelLog>>(`/api/v1/fuel/logs/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'logs'] })
      qc.invalidateQueries({ queryKey: fuelKeys.log(id) })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

export function useDeleteFuelLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<object>>(`/api/v1/fuel/logs/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'logs'] })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useExpenses(params: ExpenseParams = {}) {
  return useQuery({
    queryKey:        fuelKeys.expenses(params),
    queryFn:         () =>
      api.get<PaginatedResponse<Expense>>(`/api/v1/fuel/expenses${buildQuery(params as Record<string, unknown>)}`).then(r => r.data),
    placeholderData: keepPreviousData,
    staleTime:       2 * 60 * 1000,
  })
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: fuelKeys.expense(id),
    queryFn:  () => api.get<ApiResponse<Expense>>(`/api/v1/fuel/expenses/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExpenseCreate) =>
      api.post<ApiResponse<Expense>>('/api/v1/fuel/expenses', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'expenses'] })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExpenseUpdate) =>
      api.patch<ApiResponse<Expense>>(`/api/v1/fuel/expenses/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'expenses'] })
      qc.invalidateQueries({ queryKey: fuelKeys.expense(id) })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<object>>(`/api/v1/fuel/expenses/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel', 'expenses'] })
      qc.invalidateQueries({ queryKey: ['fuel', 'reports'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useFuelReport(params: ReportParams = {}) {
  return useQuery({
    queryKey:  fuelKeys.reports(params),
    queryFn:   () =>
      api.get<ApiResponse<FuelReport>>(`/api/v1/fuel/reports${buildQuery(params as Record<string, unknown>)}`).then(r => r.data),
    select:    (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT  (imperative — not a query)
// Uses api.defaults.baseURL so it reads from the same single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export async function exportFuelLogsCsv(params: FuelLogParams = {}): Promise<void> {
  const q = buildQuery(params as Record<string, unknown>)
  const base = api.defaults.baseURL ?? ''
  const res = await fetch(`${base}/api/v1/fuel/reports/export${q}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('CSV export failed.')

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fuel_logs_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}