/**
 * hooks/useUsers.ts
 * Fleet Management System — Phase 8
 *
 * All TanStack Query hooks for the User Management module.
 * Mirrors /settings/users backend endpoints exactly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { UserRole } from '../lib/constants'
import type { User, UserListItem, UserCreatePayload, UserUpdatePayload, AdminPasswordResetPayload } from '../types/user'
import type { PaginatedResponse, ApiResponse } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const userKeys = {
  all:    ['users'] as const,
  list:   (params: UserListQueryParams) => ['users', 'list', params] as const,
  detail: (id: string)                  => ['users', id] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export interface UserListQueryParams {
  q?:        string
  role?:     UserRole | 'ALL'
  isActive?: 'all' | 'active' | 'inactive'
  page?:     number
  pageSize?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

export function useUsers(params: UserListQueryParams = {}) {
  const { q, role, isActive, page = 1, pageSize = 20 } = params

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => {
      const search = new URLSearchParams()
      if (q)                       search.set('q', q)
      if (role && role !== 'ALL')  search.set('role', role)
      if (isActive === 'active')   search.set('isActive', 'true')
      if (isActive === 'inactive') search.set('isActive', 'false')
      search.set('page', String(page))
      search.set('pageSize', String(pageSize))

      return api.get<PaginatedResponse<UserListItem>>(`/api/v1/settings/users?${search}`).then(r => r.data)
    },
    placeholderData: (prev) => prev,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE USER
// ─────────────────────────────────────────────────────────────────────────────

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn:  () => api.get<ApiResponse<User>>(`/api/v1/settings/users/${id}`).then(r => r.data),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserCreatePayload) =>
      api.post<ApiResponse<User>>('/api/v1/settings/users', payload).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      // Backend now returns "Invite sent to {email}" as the message
      toast.success(res.message ?? `Invite sent to ${res.data.email}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateUser(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) =>
      api.patch<ApiResponse<User>>(`/api/v1/settings/users/${id}`, payload).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      qc.invalidateQueries({ queryKey: userKeys.detail(id) })
      toast.success(`${res.data.firstName} ${res.data.lastName} updated`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DEACTIVATE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ApiResponse<User>>(`/api/v1/settings/users/${id}`).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success(`${res.data.firstName} ${res.data.lastName} deactivated`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVATE
// ─────────────────────────────────────────────────────────────────────────────

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<User>>(`/api/v1/settings/users/${id}`, { isActive: true }).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success(`${res.data.firstName} ${res.data.lastName} reactivated`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminResetPassword(userId: string) {
  return useMutation({
    mutationFn: (payload: AdminPasswordResetPayload) =>
      api.post<ApiResponse<object>>(`/api/v1/settings/users/${userId}/reset-password`, payload).then(r => r.data),
    onSuccess: () => toast.success('Password reset successfully'),
    onError:   (e: Error) => toast.error(e.message),
  })
}
// ─────────────────────────────────────────────────────────────────────────────
// RESEND INVITE  (for pending users who haven't accepted yet)
// ─────────────────────────────────────────────────────────────────────────────

export function useResendInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiResponse<User>>(`/api/v1/settings/users/${id}/resend-invite`).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success(`Invite resent to ${res.data.email}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}