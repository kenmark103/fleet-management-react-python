/**
 * hooks/useNotifications.ts
 * Fleet Management System — Phase 9
 *
 * TanStack Query hooks for the notifications system.
 * The unread count is polled every 30 seconds for the bell badge.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'trip_assigned'
  | 'trip_status_changed'
  | 'work_order_assigned'
  | 'maintenance_due'
  | 'document_expiring'
  | 'fuel_logged'
  | 'expense_submitted'
  | 'system'

export interface Notification {
  id:         string
  userId:     string
  type:       NotificationType
  title:      string
  message:    string
  isRead:     boolean
  entityType: string | null
  entityId:   string | null
  actionUrl:  string | null
  createdAt:  string
}

export interface UnreadCount {
  count: number
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all:         ['notifications'] as const,
  list:        (params: object) => ['notifications', 'list', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// UNREAD COUNT  — polled every 30 seconds for the topbar badge
// ─────────────────────────────────────────────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn:  () =>
      api.get<ApiResponse<UnreadCount>>('/api/v1/notifications/unread-count')
        .then(r => r.data.data.count),
    refetchInterval: 30_000,
    staleTime:       15_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

export function useNotifications({
  page = 1,
  pageSize = 20,
  unreadOnly = false,
}: {
  page?:       number
  pageSize?:   number
  unreadOnly?: boolean
} = {}) {
  const params = new URLSearchParams({
    page:      String(page),
    page_size: String(pageSize),
    ...(unreadOnly && { unread_only: 'true' }),
  })

  return useQuery({
    queryKey:        notificationKeys.list({ page, pageSize, unreadOnly }),
    queryFn:         () =>
      api.get<PaginatedResponse<Notification>>(`/api/v1/notifications?${params}`).then(r => r.data),
    placeholderData: (prev) => prev,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK SINGLE READ
// ─────────────────────────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/v1/notifications/${id}/read`, { isRead: true }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL READ
// ─────────────────────────────────────────────────────────────────────────────

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/api/v1/notifications/read-all').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/notifications/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}