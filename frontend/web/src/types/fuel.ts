/**
 * types/fuel.ts
 * Fleet Management System — Phase 6
 *
 * Fuel logs, expenses, and report interfaces.
 * Mirrors schemas/fuel.py exactly — all camelCase.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUEL LOG
// ─────────────────────────────────────────────────────────────────────────────

export interface FuelLog {
  id: string;
  truckId: string;
  driverId: string;
  tripId?: string;
  litres: number;
  pricePerLitre: number;
  totalCost: number;          // computed server-side: litres × pricePerLitre
  currency: string;           // ISO 4217, e.g. "USD", "KES"
  odometerAtFuel: number;
  stationName?: string;
  stationLocation?: string;
  receiptUrl?: string;
  loggedAt: string;           // ISO 8601
  createdAt: string;
  updatedAt: string;
  // Resolved display fields
  truckPlate?: string;
  driverName?: string;
  tripNumber?: string;
}

export interface FuelLogCreate {
  truckId: string;
  driverId: string;
  tripId?: string;
  litres: number;
  pricePerLitre: number;
  currency?: string;
  odometerAtFuel: number;
  stationName?: string;
  stationLocation?: string;
  receiptUrl?: string;
  loggedAt: string;
}

export interface FuelLogUpdate {
  tripId?: string;
  litres?: number;
  pricePerLitre?: number;
  currency?: string;
  odometerAtFuel?: number;
  stationName?: string;
  stationLocation?: string;
  receiptUrl?: string;
  loggedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | "fuel"
  | "maintenance"
  | "tolls"
  | "tyres"
  | "insurance"
  | "licensing"
  | "salary"
  | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  truckId?: string;
  driverId?: string;
  tripId?: string;
  receiptUrl?: string;
  expenseDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Resolved display fields
  truckPlate?: string;
  driverName?: string;
  tripNumber?: string;
  createdByName?: string;
}

export interface ExpenseCreate {
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  description: string;
  truckId?: string;
  driverId?: string;
  tripId?: string;
  receiptUrl?: string;
  expenseDate: string;
}

export interface ExpenseUpdate {
  category?: ExpenseCategory;
  amount?: number;
  currency?: string;
  description?: string;
  truckId?: string;
  driverId?: string;
  tripId?: string;
  receiptUrl?: string;
  expenseDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface FuelReportKpis {
  totalFuelCost: number;
  totalExpenses: number;
  totalCombined: number;
  avgCostPerKm?: number;
  currency: string;
}

export interface MonthlyFuelCost {
  month: string;          // "2026-01"
  totalCost: number;
  totalLitres: number;
}

export interface MonthlyExpenseSummary {
  month: string;
  totalAmount: number;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  total: number;
  percentage: number;
}

export interface TruckConsumption {
  truckId: string;
  truckPlate: string;
  totalLitres: number;
  totalFuelCost: number;
  avgLPer100km?: number;
}

export interface FuelReport {
  kpis: FuelReportKpis;
  monthlyFuelCosts: MonthlyFuelCost[];
  monthlyExpenses: MonthlyExpenseSummary[];
  categoryBreakdown: CategoryBreakdown[];
  truckConsumption: TruckConsumption[];
  currency: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export interface FuelLogParams {
  page?: number;
  pageSize?: number;
  truckId?: string;
  driverId?: string;
  tripId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpenseParams {
  page?: number;
  pageSize?: number;
  category?: ExpenseCategory;
  truckId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportParams {
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
}