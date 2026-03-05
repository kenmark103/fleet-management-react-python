/**
 * hooks/useUsers.ts
 * Fleet Management System — Phase 8
 *
 * All TanStack Query hooks for the User Management module.
 * Mirrors /settings/users backend endpoints exactly.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_BASE_URL } from "../lib/constants";
import type { UserRole } from "../lib/constants";
import type { User, UserListItem, UserCreatePayload, UserUpdatePayload, AdminPasswordResetPayload } from "../types/user";
import type { PaginatedResponse, ApiResponse } from "../types/api";

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const userKeys = {
  all:    ["users"] as const,
  list:   (params: UserListQueryParams) => ["users", "list", params] as const,
  detail: (id: string)                  => ["users", id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export interface UserListQueryParams {
  q?:        string;
  role?:     UserRole | "ALL";
  isActive?: "all" | "active" | "inactive";
  page?:     number;
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
// LIST HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useUsers(params: UserListQueryParams = {}) {
  const { q, role, isActive, page = 1, pageSize = 20 } = params;

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => {
      const search = new URLSearchParams();
      if (q)                       search.set("q", q);
      if (role && role !== "ALL")  search.set("role", role);
      if (isActive === "active")   search.set("isActive", "true");
      if (isActive === "inactive") search.set("isActive", "false");
      search.set("page", String(page));
      search.set("pageSize", String(pageSize));

      return apiFetch<PaginatedResponse<UserListItem>>(
        `/settings/users?${search}`
      );
    },
    placeholderData: (prev) => prev, // keep old data while refetching (no flicker)
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE USER HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn:  () => apiFetch<ApiResponse<User>>(`/settings/users/${id}`),
    select:   (res) => res.data,
    enabled:  Boolean(id),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreatePayload) =>
      apiFetch<ApiResponse<User>>("/settings/users", {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${res.data.firstName} ${res.data.lastName} created successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) =>
      apiFetch<ApiResponse<User>>(`/settings/users/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast.success(`${res.data.firstName} ${res.data.lastName} updated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEACTIVATE  (soft delete via DELETE)
// ─────────────────────────────────────────────────────────────────────────────

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<User>>(`/settings/users/${id}`, { method: "DELETE" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${res.data.firstName} ${res.data.lastName} deactivated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVATE  (PATCH isActive: true)
// ─────────────────────────────────────────────────────────────────────────────

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<User>>(`/settings/users/${id}`, {
        method: "PATCH",
        body:   JSON.stringify({ isActive: true }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${res.data.firstName} ${res.data.lastName} reactivated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminResetPassword(userId: string) {
  return useMutation({
    mutationFn: (payload: AdminPasswordResetPayload) =>
      apiFetch<ApiResponse<object>>(`/settings/users/${userId}/reset-password`, {
        method: "POST",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => toast.success("Password reset successfully"),
    onError:   (e: Error) => toast.error(e.message),
  });
}