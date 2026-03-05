/**
 * routes/_auth/dashboard/_mock.ts
 * Fleet Management System — Phase 2
 *
 * All dashboard mock data lives here.
 * To wire real API calls: replace each export with an async fetch function
 * and update the imports in dashboard.tsx accordingly.
 */

import type { StatusValue } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// KPI STATS
// ─────────────────────────────────────────────────────────────────────────────

export const mockKpiStats = {
  totalTrucks: { value: 24, trend: { direction: "up" as const, value: 4 } },
  activeTrips: { value: 9, trend: { direction: "up" as const, value: 12 } },
  driversOnDuty: { value: 11, trend: { direction: "neutral" as const, value: 0 } },
  pendingWorkOrders: { value: 5, trend: { direction: "down" as const, value: 2 } },
  monthlyFuelCost: { value: 18420, trend: { direction: "down" as const, value: 8 } },
  totalTrailers: { value: 18, trend: { direction: "neutral" as const, value: 0 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// MY TRIPS  (shown to ADMIN, DISPATCHER, DRIVER)
// ─────────────────────────────────────────────────────────────────────────────

export interface MockTrip {
  id: string;
  tripNumber: string;
  origin: string;
  destination: string;
  status: StatusValue;
  driver: string;
  scheduledDeparture: string;
  distanceKm: number;
}

export const mockTrips: MockTrip[] = [
  {
    id: "1",
    tripNumber: "TRP-00891",
    origin: "Nairobi Depot",
    destination: "Mombasa Port",
    status: "en-route",
    driver: "James Odhiambo",
    scheduledDeparture: "2026-03-01T06:00:00",
    distanceKm: 478,
  },
  {
    id: "2",
    tripNumber: "TRP-00892",
    origin: "Nairobi Depot",
    destination: "Kisumu Warehouse",
    status: "pending",
    driver: "Faith Wanjiku",
    scheduledDeparture: "2026-03-01T09:00:00",
    distanceKm: 345,
  },
  {
    id: "3",
    tripNumber: "TRP-00890",
    origin: "Eldoret Hub",
    destination: "Nairobi Depot",
    status: "completed",
    driver: "Samuel Kiplagat",
    scheduledDeparture: "2026-02-28T05:30:00",
    distanceKm: 311,
  },
  {
    id: "4",
    tripNumber: "TRP-00889",
    origin: "Nairobi Depot",
    destination: "Nakuru Branch",
    status: "en-route",
    driver: "Grace Muthoni",
    scheduledDeparture: "2026-03-01T07:30:00",
    distanceKm: 156,
  },
  {
    id: "5",
    tripNumber: "TRP-00888",
    origin: "Mombasa Port",
    destination: "Nairobi Depot",
    status: "cancelled",
    driver: "Peter Njoroge",
    scheduledDeparture: "2026-02-28T10:00:00",
    distanceKm: 478,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE ALERTS  (shown to ADMIN, MECHANIC)
// ─────────────────────────────────────────────────────────────────────────────

export interface MockMaintenanceAlert {
  id: string;
  truck: string;
  plateNumber: string;
  issue: string;
  priority: "critical" | "high" | "medium";
  dueDate: string;
  workOrderNumber: string;
}

export const mockMaintenanceAlerts: MockMaintenanceAlert[] = [
  {
    id: "1",
    truck: "Isuzu FVZ",
    plateNumber: "KDG 123A",
    issue: "Engine oil overdue",
    priority: "critical",
    dueDate: "2026-02-25",
    workOrderNumber: "WO-00045",
  },
  {
    id: "2",
    truck: "MAN TGS",
    plateNumber: "KDH 456B",
    issue: "Brake pad inspection",
    priority: "high",
    dueDate: "2026-03-03",
    workOrderNumber: "WO-00046",
  },
  {
    id: "3",
    truck: "Mitsubishi Canter",
    plateNumber: "KDE 789C",
    issue: "Tyre rotation scheduled",
    priority: "medium",
    dueDate: "2026-03-07",
    workOrderNumber: "WO-00047",
  },
  {
    id: "4",
    truck: "Hino 500",
    plateNumber: "KDA 321D",
    issue: "Annual service due",
    priority: "high",
    dueDate: "2026-03-05",
    workOrderNumber: "WO-00048",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY ALERTS  (shown to ADMIN, DISPATCHER)
// ─────────────────────────────────────────────────────────────────────────────

export interface MockExpiryAlert {
  id: string;
  type: "Insurance" | "License" | "Inspection" | "Driver License";
  entity: string;
  reference: string;
  expiryDate: string;
  daysLeft: number;
}

export const mockExpiryAlerts: MockExpiryAlert[] = [
  {
    id: "1",
    type: "Insurance",
    entity: "KDG 123A",
    reference: "Jubilee Policy #8823",
    expiryDate: "2026-03-08",
    daysLeft: 7,
  },
  {
    id: "2",
    type: "Driver License",
    entity: "James Odhiambo",
    reference: "DL-334521",
    expiryDate: "2026-03-14",
    daysLeft: 13,
  },
  {
    id: "3",
    type: "Inspection",
    entity: "KDE 789C",
    reference: "NTSA Cert #4412",
    expiryDate: "2026-03-20",
    daysLeft: 19,
  },
  {
    id: "4",
    type: "Insurance",
    entity: "KDH 456B",
    reference: "APA Policy #2291",
    expiryDate: "2026-03-28",
    daysLeft: 27,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COST SUMMARY  (shown to ADMIN, FINANCE)
// ─────────────────────────────────────────────────────────────────────────────

export interface MockCostEntry {
  month: string;
  fuel: number;
  maintenance: number;
  other: number;
}

export const mockCostSummary: MockCostEntry[] = [
  { month: "Oct", fuel: 14200, maintenance: 3800, other: 1200 },
  { month: "Nov", fuel: 15800, maintenance: 2900, other: 1400 },
  { month: "Dec", fuel: 17100, maintenance: 5200, other: 1800 },
  { month: "Jan", fuel: 16300, maintenance: 3100, other: 1100 },
  { month: "Feb", fuel: 20100, maintenance: 4400, other: 1600 },
  { month: "Mar", fuel: 18420, maintenance: 3200, other: 1380 },
];

// ─────────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY  (all roles — filtered by own data for DRIVER/MECHANIC)
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityType = "trip" | "maintenance" | "fuel" | "user" | "document";

export interface MockActivity {
  id: string;
  type: ActivityType;
  description: string;
  actor: string;
  timestamp: string;
}

export const mockActivity: MockActivity[] = [
  {
    id: "1",
    type: "trip",
    description: "Trip TRP-00891 marked en-route",
    actor: "James Odhiambo",
    timestamp: "2026-03-01T06:12:00",
  },
  {
    id: "2",
    type: "maintenance",
    description: "Work order WO-00045 created for KDG 123A",
    actor: "David Kamau",
    timestamp: "2026-03-01T05:45:00",
  },
  {
    id: "3",
    type: "fuel",
    description: "Fuel log added — 80L for KDH 456B",
    actor: "Faith Wanjiku",
    timestamp: "2026-02-28T18:30:00",
  },
  {
    id: "4",
    type: "trip",
    description: "Trip TRP-00889 assigned to Grace Muthoni",
    actor: "Admin",
    timestamp: "2026-02-28T17:00:00",
  },
  {
    id: "5",
    type: "document",
    description: "Insurance uploaded for KDE 789C",
    actor: "Admin",
    timestamp: "2026-02-28T14:20:00",
  },
  {
    id: "6",
    type: "trip",
    description: "Trip TRP-00888 cancelled",
    actor: "Admin",
    timestamp: "2026-02-28T12:00:00",
  },
];