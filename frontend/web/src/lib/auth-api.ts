/**
 * lib/auth-api.ts
 * Fleet Management System — Phase 2
 *
 * Auth API calls: login, logout, getMe.
 *
 * ── IMPORTANT: User type ──
 * `User` is imported from types/auth.ts and re-exported from here.
 * This is the single User type for the entire app.
 * auth-context.tsx, AppShell, and all other files must resolve to the same type.
 * Never define a separate User interface in this file.
 */

import api from "./api";

// Re-export so auth-context.tsx can do: import { User } from '@/lib/auth-api'
// and still get the canonical type from types/auth.ts
export type { User } from "../types/auth";
export type { LoginCredentials, AuthResponse } from "../types/auth";

// ─────────────────────────────────────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────────────────────────────────────

import type { User, LoginCredentials, AuthResponse } from "../types/auth";

/**
 * POST /auth/login
 * Sends credentials, receives user + sets HttpOnly cookie (or stores token).
 */
export async function loginUser(credentials: LoginCredentials): Promise<User> {
  const { data } = await api.post<AuthResponse>("/auth/token", credentials);
  return data.user;
}

/**
 * POST /auth/logout
 * Clears server session / invalidates refresh token.
 */
export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout");
}

/**
 * GET /auth/me
 * Returns the current user from an active session.
 * Throws (4xx) if unauthenticated — caller should catch and treat as null.
 */
export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}