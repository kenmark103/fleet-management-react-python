/**
 * types/user.ts
 * Fleet Management System
 *
 * Re-exports the canonical User type from types/auth.ts so that
 * imports from either path resolve to the same interface.
 *
 * Only management-specific payload types live here.
 * Never define a second User interface in this file.
 */

// ── Canonical type — single source of truth ───────────────────────────────────
export type { User, UserStatus, LoginCredentials, AuthResponse } from "./auth";

import type { UserRole } from "../lib/constants";
import type { UserStatus } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// LIST ITEM  (lightweight — paginated user list)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserListItem {
  id:          string;
  firstName:   string;
  lastName:    string;
  email:       string;
  role:        UserRole;
  status:      UserStatus;
  isActive:    boolean;
  phone:       string | null;
  avatarUrl:   string | null;
  lastLoginAt: string | null;
  createdAt:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE PAYLOADS  — Admin user management
// ─────────────────────────────────────────────────────────────────────────────

/** POST /settings/users — admin invites a new user, no password needed */
export interface UserCreatePayload {
  firstName: string;
  lastName:  string;
  email:     string;
  role:      UserRole;
  phone?:    string;
}

/** PATCH /settings/users/{id} */
export interface UserUpdatePayload {
  firstName?: string;
  lastName?:  string;
  email?:     string;
  role?:      UserRole;
  phone?:     string;
  isActive?:  boolean;
}

/** POST /settings/users/{id}/reset-password */
export interface AdminPasswordResetPayload {
  newPassword: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE PAYLOADS  — Own profile
// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /settings/profile */
export interface ProfileUpdatePayload {
  firstName?: string;
  lastName?:  string;
  phone?:     string;
}

/** PATCH /settings/profile/change-password */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVITE FLOW
// ─────────────────────────────────────────────────────────────────────────────

/** POST /auth/accept-invite */
export interface AcceptInvitePayload {
  token:      string;
  password:   string;
  firstName?: string;
  lastName?:  string;
  phone?:     string;
}

/** GET /auth/invite-info */
export interface InviteInfo {
  firstName: string;
  lastName:  string;
  email:     string;
  role:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────────────────────

export interface UserListParams {
  q?:        string;
  role?:     UserRole;
  isActive?: boolean;
  page?:     number;
  pageSize?: number;
}

export function fullName(
  user: Pick<{ firstName: string; lastName: string }, "firstName" | "lastName">
): string {
  return `${user.firstName} ${user.lastName}`.trim();
}