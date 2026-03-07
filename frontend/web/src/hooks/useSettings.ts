/**
 * hooks/useSettings.ts
 * React Query hook for system settings with caching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { SystemSettings, SystemSettingsUpdate } from '../types/settings'
import type { ApiResponse } from '../types/api'

const SETTINGS_KEY = ['system-settings'] as const

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn:  () =>
      api.get<ApiResponse<SystemSettings>>('/api/v1/settings/system').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SystemSettingsUpdate) =>
      api.patch<ApiResponse<SystemSettings>>('/api/v1/settings/system', data).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data)
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}