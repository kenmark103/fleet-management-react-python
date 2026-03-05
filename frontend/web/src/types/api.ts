/**
 * types/api.ts
 * Fleet Management System — Phase 2
 *
 * Generic API response wrappers — used by all api.ts fetch functions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BASE RESPONSE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  field?: string;    // for validation errors — highlights the offending field
  status: number;    // HTTP status code
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PARAMS  (used by list-fetching hooks)
// ─────────────────────────────────────────────────────────────────────────────

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: unknown;   // allows module-specific filter keys
}