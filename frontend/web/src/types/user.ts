/**
 * types/user.ts
 * Fleet Management System
 */

import type { UserRole } from "../lib/constants";

export type UserStatus = "active" | "inactive" | "pending";

/** Full user object */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
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
  status: UserStatus;
  isActive: boolean;
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** POST /settings/users — admin invites a new user (no password) */
export interface UserCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  phone?: string;
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

/** POST /settings/users/{id}/reset-password */
export interface AdminPasswordResetPayload {
  newPassword: string;
}

/** PATCH /settings/profile */
export interface ProfileUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** PATCH /settings/profile/change-password */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** POST /auth/accept-invite */
export interface AcceptInvitePayload {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** GET /auth/invite-info */
export interface InviteInfo {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface UserListParams {
  q?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export function fullName(user: Pick<User, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`.trim();
}