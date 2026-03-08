/**
 * hooks/useSettings.ts
 * React Query hook for system settings with caching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import type { SystemSettings, SystemSettingsUpdate } from "../types/settings";
import type { ApiResponse } from "../types/api";

const SETTINGS_KEY = ["system-settings"] as const;

async function fetchSettings(): Promise<SystemSettings | null> {
  const response = await api.get<ApiResponse<SystemSettings>>("/api/v1/settings/system");
  return response.data.data;
}

async function updateSettings(data: SystemSettingsUpdate): Promise<SystemSettings> {
  const response = await api.patch<ApiResponse<SystemSettings>>("/api/v1/settings/system", data);
  return response.data.data;
}

/**
 * Read system settings — cached globally.
 *
 * Non-admin users will receive a 401 from this endpoint. We handle that
 * gracefully: retry is disabled and a 401 is treated as a non-error (returns
 * null) so it doesn't flood the console or trigger the auth interceptor's
 * refresh loop.
 */
export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn:  fetchSettings,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    //  Don't retry on 401/403 — non-admins will always get this response
    retry: (failureCount, error: any) => {
      const status = error?.response?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    //  Treat 401/403 as an expected "no access" state, not an error,
    //    so the query stays in success state with null data rather than
    //    error state — prevents console noise and error UI for non-admins.
    throwOnError: false,
  })
}

/** Update settings — ADMIN only */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}