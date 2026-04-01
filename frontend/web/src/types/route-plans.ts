export interface RouteAlternative {
  id: string
  label: string
  geometryRef?: string | null
  distanceKm?: number | null
  durationSecs?: number | null
  fuelEstimate?: number | null
  rank: number
  notes?: string | null
}

export interface RoutePlan {
  id: string
  tripId: string
  originLat?: number | null
  originLng?: number | null
  destinationLat?: number | null
  destinationLng?: number | null
  routeGeometryRef?: string | null
  distanceKm?: number | null
  durationSecs?: number | null
  etaAt?: string | null
  optimizationSource: string
  score?: number | null
  generatedAt: string
  alternatives: RouteAlternative[]
}

export interface RouteOptimizeQueryResponse {
  primary: RoutePlan
}

export interface RoutePlanRecomputeResponse {
  tripId: string
  generatedAt: string
  routePlan: RoutePlan
}
