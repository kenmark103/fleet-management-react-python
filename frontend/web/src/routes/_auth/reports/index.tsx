/**
 * routes/_auth/reports/index.tsx
 * Fleet Management System — Phase 8
 *
 * Dedicated Reports page with 4 tabs:
 *   Trips Summary | Fuel & Costs | Maintenance | Driver Performance
 */

import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/molecules/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useTripsReport, useMaintenanceReport, useDriverPerformanceReport } from "@/hooks/useReports"
import { useFuelReport } from "@/hooks/useFuel"
import { formatCurrency, formatDistance, formatNumber } from "@/lib/utils"
import type { ReportDateParams } from "@/types/reports"

export const Route = createFileRoute("/_auth/reports/")({
  component: ReportsPage,
})

// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGE PICKER (shared across all tabs)
// ─────────────────────────────────────────────────────────────────────────────

function DateRangePicker({
  value,
  onChange,
}: {
  value: ReportDateParams
  onChange: (p: ReportDateParams) => void
}) {
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="date-from" className="text-xs">From</Label>
        <Input
          id="date-from"
          type="date"
          className="w-[160px]"
          value={value.dateFrom ?? ""}
          onChange={e => onChange({ ...value, dateFrom: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="date-to" className="text-xs">To</Label>
        <Input
          id="date-to"
          type="date"
          className="w-[160px]"
          value={value.dateTo ?? ""}
          onChange={e => onChange({ ...value, dateTo: e.target.value || undefined })}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: TRIPS
// ─────────────────────────────────────────────────────────────────────────────

function TripsTab() {
  const [dates, setDates] = useState<ReportDateParams>({})
  const { data, isLoading } = useTripsReport(dates)

  return (
    <div className="space-y-6">
      <DateRangePicker value={dates} onChange={setDates} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Total Trips"     value={data.totalTrips} />
            <StatCard label="Completed"       value={data.completed} />
            <StatCard label="En Route"        value={data.enRoute} />
            <StatCard label="Pending"         value={data.pending} />
            <StatCard label="Cancelled"       value={data.cancelled} />
            <StatCard
              label="Total Distance"
              value={formatDistance(data.totalDistanceKm)}
            />
            <StatCard
              label="Avg Trip Duration"
              value={`${data.avgDurationHours.toFixed(1)} hrs`}
            />
            <StatCard
              label="Completion Rate"
              value={
                data.totalTrips > 0
                  ? `${((data.completed / data.totalTrips) * 100).toFixed(0)}%`
                  : "—"
              }
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No data available.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: FUEL & COSTS
// ─────────────────────────────────────────────────────────────────────────────

function FuelTab() {
  const [dates, setDates] = useState<ReportDateParams>({})
  const { data, isLoading } = useFuelReport({
    dateFrom: dates.dateFrom,
    dateTo:   dates.dateTo,
  })

  return (
    <div className="space-y-6">
      <DateRangePicker value={dates} onChange={setDates} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Fuel Total"  value={formatCurrency(data.kpis.totalFuelCost, data.currency)} />
          <StatCard
            label="Total Litres"
            value={formatNumber(data.monthlyFuelCosts.reduce((sum, month) => sum + month.totalLitres, 0), 0)}
            sub="litres consumed"
          />
          <StatCard
            label="Total Fuel Cost"
            value={formatCurrency(data.kpis.totalFuelCost, data.currency)}
          />
          <StatCard
            label="Avg Cost / Fill"
            value={formatCurrency(data.kpis.totalFuelCost / Math.max(data.monthlyFuelCosts.reduce((sum, month) => sum + (month.totalLitres > 0 ? 1 : 0), 0), 1), data.currency)}
          />
          <StatCard
            label="Total Expenses"
            value={formatCurrency(data.kpis.totalExpenses, data.currency)}
          />
          <StatCard
            label="Avg L/100 km"
            value={data.kpis.avgCostPerKm ? `${data.kpis.avgCostPerKm.toFixed(2)} / km` : "—"}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No data available.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────

function MaintenanceTab() {
  const [dates, setDates]   = useState<ReportDateParams>({})
  const { data, isLoading } = useMaintenanceReport(dates)

  return (
    <div className="space-y-6">
      <DateRangePicker value={dates} onChange={setDates} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total Work Orders" value={data.totalWorkOrders} />
          <StatCard label="Completed"         value={data.completed} />
          <StatCard label="In Progress"       value={data.inProgress} />
          <StatCard label="Overdue"           value={data.overdue} />
          <StatCard
            label="Total Cost"
            value={formatCurrency(data.totalCost, data.currency)}
          />
          <StatCard
            label="Avg Cost / WO"
            value={formatCurrency(data.avgCost, data.currency)}
          />
          <StatCard
            label="Completion Rate"
            value={
              data.totalWorkOrders > 0
                ? `${((data.completed / data.totalWorkOrders) * 100).toFixed(0)}%`
                : "—"
            }
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No data available.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: DRIVER PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

function DriversTab() {
  const [dates, setDates]   = useState<ReportDateParams>({})
  const { data, isLoading } = useDriverPerformanceReport(dates)

  return (
    <div className="space-y-6">
      <DateRangePicker value={dates} onChange={setDates} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Total Trips</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Cancelled</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead className="text-right">On-Time Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No driver data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                data.drivers.map(row => (
                  <TableRow key={row.driverId}>
                    <TableCell className="font-medium">{row.driverName}</TableCell>
                    <TableCell className="text-right">{row.totalTrips}</TableCell>
                    <TableCell className="text-right text-emerald-600">{row.completedTrips}</TableCell>
                    <TableCell className="text-right text-red-500">{row.cancelledTrips}</TableCell>
                    <TableCell className="text-right">{formatDistance(row.totalDistanceKm)}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          row.onTimeRate >= 0.9
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : row.onTimeRate >= 0.7
                            ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }
                      >
                        {(row.onTimeRate * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Fleet-wide analytics and performance summaries"
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <Tabs defaultValue="trips">
        <TabsList className="grid w-full grid-cols-4 lg:w-[520px]">
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="fuel">Fuel & Costs</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="trips"       className="mt-6"><TripsTab /></TabsContent>
        <TabsContent value="fuel"        className="mt-6"><FuelTab /></TabsContent>
        <TabsContent value="maintenance" className="mt-6"><MaintenanceTab /></TabsContent>
        <TabsContent value="drivers"     className="mt-6"><DriversTab /></TabsContent>
      </Tabs>
    </div>
  )
}






