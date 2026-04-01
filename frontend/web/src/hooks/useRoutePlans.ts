import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { ApiResponse } from '../types/api'
import type { RouteOptimizeQueryResponse, RoutePlan, RoutePlanRecomputeResponse } from '../types/route-plans'

export const routePlanKeys = {
  all: ['route-plans'] as const,
  detail: (tripId: string) => ['route-plans', tripId] as const,
  optimize: (key: string) => ['route-plans', 'optimize', key] as const,
}

export function useRoutePlan(tripId?: string) {
  return useQuery({
    queryKey: routePlanKeys.detail(tripId ?? 'missing'),
    queryFn: () => api.get<ApiResponse<RoutePlan>>(`/api/v1/trips/${tripId}/route-plan`).then((r) => r.data.data),
    enabled: !!tripId,
    retry: false,
  })
}

export function useGenerateRoutePlan(tripId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<ApiResponse<RoutePlanRecomputeResponse>>(`/api/v1/trips/${tripId}/route-plan`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routePlanKeys.detail(tripId) })
      toast.success('Route plan generated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useOptimizeRoute(params?: {
  originLat?: number
  originLng?: number
  destinationLat?: number
  destinationLng?: number
}) {
  const ready = params?.originLat != null && params?.originLng != null && params?.destinationLat != null && params?.destinationLng != null
  const key = ready ? `${params.originLat}-${params.originLng}-${params.destinationLat}-${params.destinationLng}` : 'missing'

  return useQuery({
    queryKey: routePlanKeys.optimize(key),
    queryFn: () =>
      api
        .get<ApiResponse<RouteOptimizeQueryResponse>>('/api/v1/trips/route-optimize', {
          params: {
            origin_lat: params?.originLat,
            origin_lng: params?.originLng,
            destination_lat: params?.destinationLat,
            destination_lng: params?.destinationLng,
          },
        })
        .then((r) => r.data.data),
    enabled: !!ready,
    staleTime: 10 * 60 * 1000,
  })
}
