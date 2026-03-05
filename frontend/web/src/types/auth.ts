/**
 * types/auth.ts
 * Fleet Management System — Phase 2
 *
 * Auth-related TypeScript interfaces.
 * §1 Roles & Definitions, §2 Permission Matrix
 */

import type { UserRole } from "../lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;
  lastLoginAt?: string;
}

/** Derived helper — full display name */
export type UserWithDisplayName = User & { displayName: string };

// ─────────────────────────────────────────────────────────────────────────────
// AUTH FLOW
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT STATE  (used by auth-context.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}