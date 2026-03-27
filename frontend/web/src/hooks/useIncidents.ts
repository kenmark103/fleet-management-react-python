/**
 * hooks/useIncidents.ts
 * Fleet Management System — Phase 8
 *
 * All TanStack Query hooks for the Incidents module.
 * Mirrors routers/incidents.py endpoint structure exactly.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api from '../lib/api'
import type {
  Incident, IncidentCreate, IncidentUpdate, IncidentStatusUpdate,
  IncidentAttachmentCreate,
  IncidentSummary, IncidentParams,
} from '../types/incidents'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const incidentKeys = {
  all:      ['incidents'] as const,
  list:     (params?: IncidentParams) => ['incidents', 'list', params] as const,
  detail:   (id: string)              => ['incidents', 'detail', id] as const,
  summary:  ()                        => ['incidents', 'summary'] as const,
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
// READ HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useIncidents(params: IncidentParams = {}) {
  return useQuery({
    queryKey:        incidentKeys.list(params),
    queryFn:         () =>
      api.get<PaginatedResponse<Incident>>(
        `/api/v1/incidents${buildQuery(params as Record<string, unknown>)}`
      ).then(r => r.data),
    placeholderData: keepPreviousData,
    staleTime:       2 * 60 * 1000,
  })
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: incidentKeys.detail(id),
    queryFn:  () =>
      api.get<ApiResponse<Incident>>(`/api/v1/incidents/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

export function useIncidentSummary() {
  return useQuery({
    queryKey:  incidentKeys.summary(),
    queryFn:   () =>
      api.get<ApiResponse<IncidentSummary>>('/api/v1/incidents/summary').then(r => r.data),
    select:    (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IncidentCreate) =>
      api.post<ApiResponse<Incident>>('/api/v1/incidents', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents', 'list'] })
      qc.invalidateQueries({ queryKey: incidentKeys.summary() })
    },
  })
}

export function useUpdateIncident(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IncidentUpdate) =>
      api.patch<ApiResponse<Incident>>(`/api/v1/incidents/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents', 'list'] })
      qc.invalidateQueries({ queryKey: incidentKeys.detail(id) })
    },
  })
}

export function useUpdateIncidentStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IncidentStatusUpdate) =>
      api.patch<ApiResponse<Incident>>(`/api/v1/incidents/${id}/status`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents', 'list'] })
      qc.invalidateQueries({ queryKey: incidentKeys.detail(id) })
      qc.invalidateQueries({ queryKey: incidentKeys.summary() })
    },
  })
}

export function useDeleteIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<object>>(`/api/v1/incidents/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents', 'list'] })
      qc.invalidateQueries({ queryKey: incidentKeys.summary() })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENT HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useAddIncidentAttachment(incidentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IncidentAttachmentCreate) =>
      api.post(`/api/v1/incidents/${incidentId}/attachments`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) }),
  })
}

export function useDeleteIncidentAttachment(incidentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(`/api/v1/incidents/${incidentId}/attachments/${attachmentId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) }),
  })
}