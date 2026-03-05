/**
 * hooks/useMaintenance.ts
 * Fleet Management System — Phase 7
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/constants";
import type {
  WorkOrder, WorkOrderCreate, WorkOrderUpdate, WorkOrderStatusUpdate,
  WorkOrderPartCreate,
  ServiceSchedule, ServiceScheduleCreate, ServiceScheduleUpdate,
  WorkOrderParams, ScheduleParams,
} from "../types/maintenance";
import type { PaginatedResponse, ApiResponse } from "../types/api";

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const maintenanceKeys = {
  workOrders: (p?: WorkOrderParams) => ["maintenance", "work-orders", p] as const,
  workOrder:  (id: string)          => ["maintenance", "work-orders", id] as const,
  schedules:  (p?: ScheduleParams)  => ["maintenance", "schedules", p] as const,
  schedule:   (id: string)          => ["maintenance", "schedules", id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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
// WORK ORDER HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkOrders(params: WorkOrderParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.workOrders(params),
    queryFn:  () =>
      apiFetch<PaginatedResponse<WorkOrder>>(
        `/maintenance/work-orders${buildQuery(params as Record<string, unknown>)}`
      ),
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.workOrder(id),
    queryFn:  () => apiFetch<ApiResponse<WorkOrder>>(`/maintenance/work-orders/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkOrderCreate) =>
      apiFetch<ApiResponse<WorkOrder>>("/maintenance/work-orders", {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "work-orders"] }),
  });
}

export function useUpdateWorkOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkOrderUpdate) =>
      apiFetch<ApiResponse<WorkOrder>>(`/maintenance/work-orders/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance", "work-orders"] });
      qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(id) });
    },
  });
}

export function useUpdateWorkOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkOrderStatusUpdate) =>
      apiFetch<ApiResponse<WorkOrder>>(`/maintenance/work-orders/${id}/status`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance", "work-orders"] });
      qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(id) });
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<object>>(`/maintenance/work-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "work-orders"] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useAddWorkOrderPart(woId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkOrderPartCreate) =>
      apiFetch(`/maintenance/work-orders/${woId}/parts`, {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(woId) }),
  });
}

export function useDeleteWorkOrderPart(woId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partId: string) =>
      apiFetch(`/maintenance/work-orders/${woId}/parts/${partId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(woId) }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE SCHEDULE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useServiceSchedules(params: ScheduleParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.schedules(params),
    queryFn:  () =>
      apiFetch<PaginatedResponse<ServiceSchedule>>(
        `/maintenance/schedules${buildQuery(params as Record<string, unknown>)}`
      ),
  });
}

export function useServiceSchedule(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.schedule(id),
    queryFn:  () => apiFetch<ApiResponse<ServiceSchedule>>(`/maintenance/schedules/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  });
}

export function useCreateServiceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceScheduleCreate) =>
      apiFetch<ApiResponse<ServiceSchedule>>("/maintenance/schedules", {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "schedules"] }),
  });
}

export function useUpdateServiceSchedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceScheduleUpdate) =>
      apiFetch<ApiResponse<ServiceSchedule>>(`/maintenance/schedules/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance", "schedules"] });
      qc.invalidateQueries({ queryKey: maintenanceKeys.schedule(id) });
    },
  });
}

export function useDeleteServiceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<object>>(`/maintenance/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", "schedules"] }),
  });
}