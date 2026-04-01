export interface FleetHealthTruck {
  truckId: string
  plateNumber: string
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  predictedIssueType?: string | null
  confidence: number
  generatedAt: string
}

export interface FleetHealthResponse {
  fleetAverageScore: number
  highRiskCount: number
  generatedAt: string
  trucks: FleetHealthTruck[]
}

export interface MaintenancePrediction {
  id: string
  truckId: string
  sourceWindowStart: string
  sourceWindowEnd: string
  recommendedAction: string
  dueByDate?: string | null
  dueByOdometer?: number | null
  severity: 'low' | 'medium' | 'high'
  explanation: string
  status: string
  generatedAt: string
}

export interface AnomalyEvent {
  id: string
  entityType: string
  entityId: string
  metricName: string
  observedValue?: number | null
  baselineValue?: number | null
  anomalyScore?: number | null
  severity: 'low' | 'medium' | 'high'
  summary: string
  detectedAt: string
  resolutionStatus: string
}

export interface DriverBehaviorEvent {
  id: string
  driverId: string
  tripId?: string | null
  eventType: string
  severity: 'low' | 'medium' | 'high'
  measuredValue?: number | null
  threshold?: number | null
  notes?: string | null
  occurredAt: string
}

export interface DriverScorecard {
  id: string
  driverId: string
  scorePeriodStart: string
  scorePeriodEnd: string
  safetyScore: number
  efficiencyScore: number
  punctualityScore: number
  totalScore: number
  summary?: string | null
  generatedAt: string
}

export interface CoachingRecommendation {
  id: string
  driverId: string
  recommendationType: string
  reason: string
  suggestedAction: string
  generatedAt: string
  acknowledgedAt?: string | null
}

export interface DriverLeaderboardEntry {
  driverId: string
  driverName: string
  totalScore: number
  safetyScore: number
  efficiencyScore: number
  punctualityScore: number
  generatedAt: string
}

export interface DriverLeaderboardResponse {
  entries: DriverLeaderboardEntry[]
}
