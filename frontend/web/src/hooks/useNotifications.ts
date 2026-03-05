/**
 * hooks/useNotifications.ts
 * Fleet Management System — Phase 9
 *
 * TanStack Query hooks for the notifications system.
 * The unread count is polled every 30 seconds for the bell badge.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/constants";
import type { PaginatedResponse, ApiResponse } from "../types/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "trip_assigned"
  | "trip_status_changed"
  | "work_order_assigned"
  | "maintenance_due"
  | "document_expiring"
  | "fuel_logged"
  | "expense_submitted"
  | "system";

export interface Notification {
  id:          string;
  userId:      string;
  type:        NotificationType;
  title:       string;
  message:     string;
  isRead:      boolean;
  entityType:  string | null;
  entityId:    string | null;
  actionUrl:   string | null;
  createdAt:   string;
}

export interface UnreadCount {
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all:         ["notifications"] as const,
  list:        (params: object) => ["notifications", "list", params] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// UNREAD COUNT  — polled every 30 seconds for the topbar badge
// ─────────────────────────────────────────────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () =>
      apiFetch<ApiResponse<UnreadCount>>("/notifications/unread-count").then(
        (r) => r.data.count
      ),
    refetchInterval: 30_000,   // poll every 30s
    staleTime:       15_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

export function useNotifications({
  page = 1,
  pageSize = 20,
  unreadOnly = false,
}: {
  page?:       number;
  pageSize?:   number;
  unreadOnly?: boolean;
} = {}) {
  const params = new URLSearchParams({
    page:       String(page),
    page_size:  String(pageSize),
    ...(unreadOnly && { unread_only: "true" }),
  });

  return useQuery({
    queryKey: notificationKeys.list({ page, pageSize, unreadOnly }),
    queryFn:  () =>
      apiFetch<PaginatedResponse<Notification>>(`/notifications?${params}`),
    placeholderData: (prev) => prev,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK SINGLE READ
// ─────────────────────────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL READ
// ─────────────────────────────────────────────────────────────────────────────

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}