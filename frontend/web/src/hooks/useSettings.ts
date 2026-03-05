/**
 * hooks/useSettings.ts
 * React Query hook for system settings with caching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import type { SystemSettings, SystemSettingsUpdate } from "../types/settings";
import type { ApiResponse } from "../types/api";

const SETTINGS_KEY = ["system-settings"] as const;

async function fetchSettings(): Promise<SystemSettings> {
  const response = await api.get<ApiResponse<SystemSettings>>("/api/v1/settings/system");
  return response.data.data;
}

async function updateSettings(data: SystemSettingsUpdate): Promise<SystemSettings> {
  const response = await api.patch<ApiResponse<SystemSettings>>("/api/v1/settings/system", data);
  return response.data.data;
}

/** Read system settings — cached globally */
export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}

/** Update settings — ADMIN only */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(SETTINGS_KEY, data);
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}