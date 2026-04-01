import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { ApiResponse } from '../types/api'
import type {
  AnomalyEvent,
  CoachingRecommendation,
  DriverBehaviorEvent,
  DriverLeaderboardResponse,
  DriverScorecard,
  FleetHealthResponse,
  MaintenancePrediction,
} from '../types/analytics'

export const analyticsKeys = {
  all: ['analytics'] as const,
  fleetHealth: ['analytics', 'fleet-health'] as const,
  anomalies: ['analytics', 'anomalies'] as const,
  truckPredictions: (truckId: string) => ['analytics', 'truck-predictions', truckId] as const,
  driverScorecard: (driverId: string) => ['analytics', 'driver-scorecard', driverId] as const,
  driverBehavior: (driverId: string) => ['analytics', 'driver-behavior', driverId] as const,
  driverCoaching: (driverId: string) => ['analytics', 'driver-coaching', driverId] as const,
  leaderboard: ['analytics', 'driver-leaderboard'] as const,
}

export function useFleetHealth() {
  return useQuery({
    queryKey: analyticsKeys.fleetHealth,
    queryFn: () => api.get<ApiResponse<FleetHealthResponse>>('/api/v1/analytics/fleet-health').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAnomalies() {
  return useQuery({
    queryKey: analyticsKeys.anomalies,
    queryFn: () => api.get<ApiResponse<AnomalyEvent[]>>('/api/v1/analytics/anomalies').then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  })
}

export function useTruckPredictions(truckId?: string) {
  return useQuery({
    queryKey: analyticsKeys.truckPredictions(truckId ?? 'missing'),
    queryFn: () => api.get<ApiResponse<MaintenancePrediction[]>>(`/api/v1/analytics/trucks/${truckId}/predictions`).then((r) => r.data.data),
    enabled: !!truckId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useDriverScorecard(driverId?: string) {
  return useQuery({
    queryKey: analyticsKeys.driverScorecard(driverId ?? 'missing'),
    queryFn: () => api.get<ApiResponse<DriverScorecard>>(`/api/v1/drivers/${driverId}/scorecard`).then((r) => r.data.data),
    enabled: !!driverId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useDriverBehavior(driverId?: string) {
  return useQuery({
    queryKey: analyticsKeys.driverBehavior(driverId ?? 'missing'),
    queryFn: () => api.get<ApiResponse<DriverBehaviorEvent[]>>(`/api/v1/drivers/${driverId}/behavior-events`).then((r) => r.data.data),
    enabled: !!driverId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useDriverCoaching(driverId?: string) {
  return useQuery({
    queryKey: analyticsKeys.driverCoaching(driverId ?? 'missing'),
    queryFn: () => api.get<ApiResponse<CoachingRecommendation[]>>(`/api/v1/drivers/${driverId}/coaching`).then((r) => r.data.data),
    enabled: !!driverId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useDriverLeaderboard() {
  return useQuery({
    queryKey: analyticsKeys.leaderboard,
    queryFn: () => api.get<ApiResponse<DriverLeaderboardResponse>>('/api/v1/drivers/leaderboard').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRecomputeAnalytics() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/v1/analytics/recompute').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.all })
      toast.success('Analytics refreshed')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
