/**
 * hooks/useFuel.ts
 * Fleet Management System — Phase 6
 *
 * All TanStack Query hooks for the Fuel & Costs module.
 * Mirrors routers/fuel.py endpoint structure exactly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/constants";
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
} from "../types/fuel";
import type { PaginatedResponse, ApiResponse } from "../types/api";

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const fuelKeys = {
  all:         ["fuel"] as const,
  logs:        (params?: FuelLogParams)    => ["fuel", "logs", params] as const,
  log:         (id: string)               => ["fuel", "logs", id] as const,
  expenses:    (params?: ExpenseParams)   => ["fuel", "expenses", params] as const,
  expense:     (id: string)               => ["fuel", "expenses", id] as const,
  reports:     (params?: ReportParams)    => ["fuel", "reports", params] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// FUEL LOG HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useFuelLogs(params: FuelLogParams = {}) {
  return useQuery({
    queryKey: fuelKeys.logs(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<FuelLog>>(
        `/fuel/logs${buildQuery(params as Record<string, unknown>)}`
      ),
  });
}

export function useFuelLog(id: string) {
  return useQuery({
    queryKey: fuelKeys.log(id),
    queryFn:  () => apiFetch<ApiResponse<FuelLog>>(`/fuel/logs/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  });
}

export function useCreateFuelLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FuelLogCreate) =>
      apiFetch<ApiResponse<FuelLog>>("/fuel/logs", {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "logs"] });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

export function useUpdateFuelLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FuelLogUpdate) =>
      apiFetch<ApiResponse<FuelLog>>(`/fuel/logs/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "logs"] });
      qc.invalidateQueries({ queryKey: fuelKeys.log(id) });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

export function useDeleteFuelLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<object>>(`/fuel/logs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "logs"] });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useExpenses(params: ExpenseParams = {}) {
  return useQuery({
    queryKey: fuelKeys.expenses(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<Expense>>(
        `/fuel/expenses${buildQuery(params as Record<string, unknown>)}`
      ),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: fuelKeys.expense(id),
    queryFn:  () => apiFetch<ApiResponse<Expense>>(`/fuel/expenses/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExpenseCreate) =>
      apiFetch<ApiResponse<Expense>>("/fuel/expenses", {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "expenses"] });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExpenseUpdate) =>
      apiFetch<ApiResponse<Expense>>(`/fuel/expenses/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "expenses"] });
      qc.invalidateQueries({ queryKey: fuelKeys.expense(id) });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<object>>(`/fuel/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel", "expenses"] });
      qc.invalidateQueries({ queryKey: ["fuel", "reports"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useFuelReport(params: ReportParams = {}) {
  return useQuery({
    queryKey: fuelKeys.reports(params),
    queryFn: () =>
      apiFetch<ApiResponse<FuelReport>>(
        `/fuel/reports${buildQuery(params as Record<string, unknown>)}`
      ),
    select: (res) => res.data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT  (imperative — not a query)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportFuelLogsCsv(params: FuelLogParams = {}): Promise<void> {
  const q = buildQuery(params as Record<string, unknown>);
  const res = await fetch(`${API_BASE_URL}/fuel/reports/export${q}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("CSV export failed.");

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fuel_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}