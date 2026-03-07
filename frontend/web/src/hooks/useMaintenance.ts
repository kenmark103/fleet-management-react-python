/**
 * hooks/useMaintenance.ts
 * Fleet Management System — Phase 7
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type {
  WorkOrder, WorkOrderCreate, WorkOrderUpdate, WorkOrderStatusUpdate,
  WorkOrderPartCreate,
  ServiceSchedule, ServiceScheduleCreate, ServiceScheduleUpdate,
  WorkOrderParams, ScheduleParams,
} from '../types/maintenance'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const maintenanceKeys = {
  workOrders: (p?: WorkOrderParams) => ['maintenance', 'work-orders', p] as const,
  workOrder:  (id: string)          => ['maintenance', 'work-orders', id] as const,
  schedules:  (p?: ScheduleParams)  => ['maintenance', 'schedules', p] as const,
  schedule:   (id: string)          => ['maintenance', 'schedules', id] as const,
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
// WORK ORDER HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkOrders(params: WorkOrderParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.workOrders(params),
    queryFn:  () =>
      api.get<PaginatedResponse<WorkOrder>>(
        `/api/v1/maintenance/work-orders${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
  })
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.workOrder(id),
    queryFn:  () => api.get<ApiResponse<WorkOrder>>(`/api/v1/maintenance/work-orders/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WorkOrderCreate) =>
      api.post<ApiResponse<WorkOrder>>('/api/v1/maintenance/work-orders', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] }),
  })
}

export function useUpdateWorkOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WorkOrderUpdate) =>
      api.patch<ApiResponse<WorkOrder>>(`/api/v1/maintenance/work-orders/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(id) })
    },
  })
}

export function useUpdateWorkOrderStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WorkOrderStatusUpdate) =>
      api.patch<ApiResponse<WorkOrder>>(`/api/v1/maintenance/work-orders/${id}/status`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] })
      qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(id) })
    },
  })
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<object>>(`/api/v1/maintenance/work-orders/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', 'work-orders'] }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useAddWorkOrderPart(woId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WorkOrderPartCreate) =>
      api.post(`/api/v1/maintenance/work-orders/${woId}/parts`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(woId) }),
  })
}

export function useDeleteWorkOrderPart(woId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partId: string) =>
      api.delete(`/api/v1/maintenance/work-orders/${woId}/parts/${partId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: maintenanceKeys.workOrder(woId) }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE SCHEDULE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useServiceSchedules(params: ScheduleParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.schedules(params),
    queryFn:  () =>
      api.get<PaginatedResponse<ServiceSchedule>>(
        `/api/v1/maintenance/schedules${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
  })
}

export function useServiceSchedule(id: string) {
  return useQuery({
    queryKey: maintenanceKeys.schedule(id),
    queryFn:  () => api.get<ApiResponse<ServiceSchedule>>(`/api/v1/maintenance/schedules/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useCreateServiceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceScheduleCreate) =>
      api.post<ApiResponse<ServiceSchedule>>('/api/v1/maintenance/schedules', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', 'schedules'] }),
  })
}

export function useUpdateServiceSchedule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ServiceScheduleUpdate) =>
      api.patch<ApiResponse<ServiceSchedule>>(`/api/v1/maintenance/schedules/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', 'schedules'] })
      qc.invalidateQueries({ queryKey: maintenanceKeys.schedule(id) })
    },
  })
}

export function useDeleteServiceSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<object>>(`/api/v1/maintenance/schedules/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', 'schedules'] }),
  })
}