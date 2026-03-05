/**
 * types/user.ts
 * Fleet Management System — Phase 8
 *
 * Mirrors schemas/user.py (camelCase output via CamelBase).
 * All date fields come as ISO strings from the API.
 */

import type { UserRole } from "../lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// READ SHAPES  (API responses)
// ─────────────────────────────────────────────────────────────────────────────

/** Full user object — single-item endpoints */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight — paginated list */
export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE SHAPES  (request payloads)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /settings/users — admin creates a new user */
export interface UserCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  phone?: string;
  tempPassword: string;
}

/** PATCH /settings/users/{id} — admin edits user */
export interface UserUpdatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  phone?: string;
  isActive?: boolean;
}

/** POST /settings/users/{id}/reset-password — admin resets password */
export interface AdminPasswordResetPayload {
  newPassword: string;
}

/** PATCH /settings/profile — own profile update */
export interface ProfileUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** PATCH /settings/profile/change-password — own password change */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export interface UserListParams {
  q?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns "First Last" for any user shape */
export function fullName(user: Pick<User, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`.trim();
}