/**
 * routes/_auth/fuel/index.tsx
 * Fleet Management System — Phase 6
 *
 * /fuel — Tabbed page: Fuel Logs | Expenses | Reports
 *
 * Role access:
 *   Fuel Logs tab  → ADMIN (all), FINANCE (all), DRIVER (own only)
 *   Expenses tab   → ADMIN, FINANCE
 *   Reports tab    → ADMIN, FINANCE
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Fuel,
  Receipt,
  BarChart3,
  Plus,
  Download,
  Pencil,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Gauge,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { ConfirmDialog } from "../../../components/atoms/ConfirmDialog";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { StatusBadge } from "../../../components/atoms/StatusBadge";
import { formatNumber, truncate } from "../../../lib/utils";
import { useAppSettings } from "#/lib/settings-context";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from "../../../lib/constants";
import { usePermission } from "../../../hooks/usePermission";
import {
  useFuelLogs,
  useExpenses,
  useFuelReport,
  useDeleteFuelLog,
  useDeleteExpense,
  exportFuelLogsCsv,
} from "../../../hooks/useFuel";
import type { FuelLogParams, ExpenseParams, ExpenseCategory } from "../../../types/fuel";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/fuel/")({
  component: FuelPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "fuel", "maintenance", "tolls", "tyres",
  "insurance", "licensing", "salary", "other",
];

// Recharts donut palette — one color per category
const DONUT_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#6b7280",
];

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function FuelPage() {
  const { can, role } = usePermission();
  const isDriver = role === "DRIVER";
  const {formatCurrency, formatAppDate} = useAppSettings();

  // ── Fuel log filters ──────────────────────────────────────────────────────
  const [logParams, setLogParams] = useState<FuelLogParams>({
    page: 1, pageSize: 20,
  });

  // ── Expense filters ───────────────────────────────────────────────────────
  const [expenseParams, setExpenseParams] = useState<ExpenseParams>({
    page: 1, pageSize: 20,
  });

  // ── Report date range ─────────────────────────────────────────────────────
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo]     = useState("");

  // ── Delete dialog state ───────────────────────────────────────────────────
  const [deleteLog, setDeleteLog]         = useState<string | null>(null);
  const [deleteExpense, setDeleteExpense] = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: logsData,    isLoading: logsLoading    } = useFuelLogs(logParams);
  const { data: expensesData, isLoading: expensesLoading } = useExpenses(expenseParams);
  const { data: report,      isLoading: reportLoading  } = useFuelReport({
    dateFrom: reportDateFrom || undefined,
    dateTo:   reportDateTo   || undefined,
  });

  const deleteFuelLog  = useDeleteFuelLog();
  const deleteExpenseMutation = useDeleteExpense();

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDeleteLog = async () => {
    if (!deleteLog) return;
    try {
      await deleteFuelLog.mutateAsync(deleteLog);
      toast.success("Fuel log deleted.");
    } catch {
      toast.error("Failed to delete fuel log.");
    } finally {
      setDeleteLog(null);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;
    try {
      await deleteExpenseMutation.mutateAsync(deleteExpense);
      toast.success("Expense deleted.");
    } catch {
      toast.error("Failed to delete expense.");
    } finally {
      setDeleteExpense(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      await exportFuelLogsCsv(logParams);
      toast.success("CSV exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel & Costs"
        subtitle="Track fuel consumption, operating expenses and financial reports"
        icon={<Fuel className="h-6 w-6" />}
      />

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList
          className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex"
          data-testid="fuel-tabs"
        >
          <TabsTrigger
            value="logs"
            className="flex items-center gap-2"
            data-testid="fuel-tab-logs"
          >
            <Fuel className="h-4 w-4" />
            Fuel Logs
          </TabsTrigger>
          {!isDriver && (
            <TabsTrigger
              value="expenses"
              className="flex items-center gap-2"
              data-testid="fuel-tab-expenses"
            >
              <Receipt className="h-4 w-4" />
              Expenses
            </TabsTrigger>
          )}
          {can("fuel:view-cost-reports") && (
            <TabsTrigger
              value="reports"
              className="flex items-center gap-2"
              data-testid="fuel-tab-reports"
            >
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          )}
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            FUEL LOGS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="logs" className="space-y-4" data-testid="fuel-panel-logs">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search truck or driver…"
              className="w-48"
              onChange={(e) =>
                setLogParams((p) => ({ ...p, page: 1, search: e.target.value || undefined }))
              }
            />
            <Input
              type="date"
              className="w-40"
              value={logParams.dateFrom ?? ""}
              onChange={(e) =>
                setLogParams((p) => ({ ...p, page: 1, dateFrom: e.target.value || undefined }))
              }
            />
            <Input
              type="date"
              className="w-40"
              value={logParams.dateTo ?? ""}
              onChange={(e) =>
                setLogParams((p) => ({ ...p, page: 1, dateTo: e.target.value || undefined }))
              }
            />

            <div className="ml-auto flex gap-2">
              {can("fuel:export-reports") && (
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
              {can("fuel:log-own") && (
                <Link to="/fuel/logs/new">
                  <Button size="sm" data-testid="add-fuel-btn">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Fuel Log
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card overflow-hidden" data-testid="fuel-logs-list">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Truck</TableHead>
                  {!isDriver && <TableHead>Driver</TableHead>}
                  <TableHead>Trip</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Price / L</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !logsData?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      No fuel logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logsData.data.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">
                        {formatAppDate(log.loggedAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {log.truckPlate ?? log.truckId.slice(0, 8)}
                        </span>
                      </TableCell>
                      {!isDriver && (
                        <TableCell className="text-sm">
                          {log.driverName ?? "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {log.tripNumber ? (
                          <Link
                            to="/trips/$tripId"
                            params={{ tripId: log.tripId! }}
                            className="text-blue-600 hover:underline text-xs font-mono"
                          >
                            {log.tripNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(log.litres, 1)} L
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(log.pricePerLitre)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(log.totalCost)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {truncate(log.stationName, 20)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {can("fuel:edit") && (
                            <Link to="/fuel/logs/$logId/edit" params={{ logId: log.id }}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                          {can("fuel:edit") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteLog(log.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {logsData?.meta && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {logsData.meta.totalItems} log{logsData.meta.totalItems !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={!logsData.meta.hasPreviousPage}
                  onClick={() => setLogParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <span className="self-center px-2">
                  Page {logsData.meta.page} of {logsData.meta.totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={!logsData.meta.hasNextPage}
                  onClick={() => setLogParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            EXPENSES TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {!isDriver && (
          <TabsContent value="expenses" className="space-y-4" data-testid="fuel-panel-expenses">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={expenseParams.category ?? "all"}
                onValueChange={(v) =>
                  setExpenseParams((p) => ({
                    ...p, page: 1,
                    category: v === "all" ? undefined : (v as ExpenseCategory),
                  }))
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                className="w-40"
                value={expenseParams.dateFrom ?? ""}
                onChange={(e) =>
                  setExpenseParams((p) => ({ ...p, page: 1, dateFrom: e.target.value || undefined }))
                }
              />
              <Input
                type="date"
                className="w-40"
                value={expenseParams.dateTo ?? ""}
                onChange={(e) =>
                  setExpenseParams((p) => ({ ...p, page: 1, dateTo: e.target.value || undefined }))
                }
              />

              {can("fuel:add-expense") && (
                <Link to="/fuel/expenses/new" className="ml-auto">
                  <Button size="sm" data-testid="add-expense-btn">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                </Link>
              )}
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card overflow-hidden" data-testid="expenses-list">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : !expensesData?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No expenses found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expensesData.data.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm">
                          {formatAppDate(expense.expenseDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            data-testid="expense-category-badge"
                            variant="outline"
                            className={EXPENSE_CATEGORY_COLORS[expense.category]}
                          >
                            {EXPENSE_CATEGORY_LABELS[expense.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          {truncate(expense.description, 40)}
                        </TableCell>
                        <TableCell>
                          {expense.truckPlate ? (
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {expense.truckPlate}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {expense.driverName ?? "—"}
                        </TableCell>
                        <TableCell>
                          {expense.tripNumber ? (
                            <Link
                              to="/trips/$tripId"
                              params={{ tripId: expense.tripId! }}
                              className="text-blue-600 hover:underline text-xs font-mono"
                            >
                              {expense.tripNumber}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {can("fuel:edit") && (
                              <Link
                                to="/fuel/expenses/$expenseId/edit"
                                params={{ expenseId: expense.id }}
                              >
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                            {can("fuel:edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteExpense(expense.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {expensesData?.meta && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{expensesData.meta.totalItems} expense{expensesData.meta.totalItems !== 1 ? "s" : ""}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={!expensesData.meta.hasPreviousPage}
                    onClick={() => setExpenseParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                  >
                    Previous
                  </Button>
                  <span className="self-center px-2">
                    Page {expensesData.meta.page} of {expensesData.meta.totalPages}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    disabled={!expensesData.meta.hasNextPage}
                    onClick={() => setExpenseParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            REPORTS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {can("fuel:view-cost-reports") && (
          <TabsContent value="reports" className="space-y-6" data-testid="fuel-panel-reports">
            {/* Date range filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Date range:</span>
              <Input
                type="date"
                className="w-40"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                className="w-40"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
              />
              {(reportDateFrom || reportDateTo) && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setReportDateFrom(""); setReportDateTo(""); }}
                >
                  Clear
                </Button>
              )}
              {can("fuel:export-reports") && (
                <Button
                  variant="outline" size="sm"
                  className="ml-auto"
                  onClick={handleExportCsv}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>

            {reportLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              <>
                {/* KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    label="Total Fuel Cost"
                    value={formatCurrency(report.kpis.totalFuelCost)}
                    icon={<Fuel className="h-5 w-5 text-blue-500" />}
                    color="blue"
                  />
                  <KpiCard
                    label="Total Expenses"
                    value={formatCurrency(report.kpis.totalExpenses)}
                    icon={<Receipt className="h-5 w-5 text-orange-500" />}
                    color="orange"
                  />
                  <KpiCard
                    label="Total Combined"
                    value={formatCurrency(report.kpis.totalCombined)}
                    icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
                    color="emerald"
                  />
                  <KpiCard
                    label="Avg Cost / km"
                    value={
                      report.kpis.avgCostPerKm != null
                        ? `${formatCurrency(report.kpis.avgCostPerKm)}/km`
                        : "—"
                    }
                    icon={<Gauge className="h-5 w-5 text-purple-500" />}
                    color="purple"
                  />
                </div>

                {/* Charts row 1: line + bar */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Monthly fuel cost — line chart */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Monthly Fuel Cost
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={report.monthlyFuelCosts}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: number | undefined): [string, string] => [formatCurrency(v), ""]}
                        />
                        <Line
                          type="monotone"
                          dataKey="totalCost"
                          name="Fuel Cost"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly expenses — bar chart */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-500" />
                      Monthly Expenses
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={report.monthlyExpenses}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: number | undefined): [string, string] => [formatCurrency(v), ""]}
                        />
                        <Bar
                          dataKey="totalAmount"
                          name="Expenses"
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Charts row 2: donut + table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Category breakdown — donut */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="font-medium text-sm mb-4">
                      Expense Breakdown by Category
                    </h3>
                    {report.categoryBreakdown.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="60%" height={220}>
                          <PieChart>
                            <Pie
                              data={report.categoryBreakdown}
                              dataKey="total"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={3}
                            >
                              {report.categoryBreakdown.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number | undefined): [string, string] => [formatCurrency(v), ""]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 flex-1">
                          {report.categoryBreakdown.map((item, i) => (
                            <div key={item.category} className="flex items-center gap-2 text-xs">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                              />
                              <span className="flex-1 capitalize">{item.category}</span>
                              <span className="font-medium">
                                {formatCurrency(item.total)}
                              </span>
                              <span className="text-muted-foreground w-10 text-right">
                                {item.percentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                        No expense data available.
                      </div>
                    )}
                  </div>

                  {/* Per-truck consumption table */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="font-medium text-sm mb-4">Per-Truck Fuel Consumption</h3>
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead>Truck</TableHead>
                            <TableHead className="text-right">Litres</TableHead>
                            <TableHead className="text-right">Fuel Cost</TableHead>
                            <TableHead className="text-right">L/100km</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.truckConsumption.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center text-muted-foreground h-20 text-sm"
                              >
                                No data.
                              </TableCell>
                            </TableRow>
                          ) : (
                            report.truckConsumption.map((truck) => (
                              <TableRow key={truck.truckId}>
                                <TableCell>
                                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {truck.truckPlate}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatNumber(truck.totalLitres, 1)} L
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency(truck.totalFuelCost)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {truck.avgLPer100km != null
                                    ? `${formatNumber(truck.avgLPer100km, 2)}`
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground h-32 flex items-center justify-center">
                No report data available.
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Delete dialogs */}
      <ConfirmDialog
        open={Boolean(deleteLog)}
        onOpenChange={(o) => !o && setDeleteLog(null)}
        title="Delete Fuel Log?"
        description="This fuel log will be permanently removed."
        onConfirm={handleDeleteLog}
        confirmLabel="Delete"
        destructive
        isLoading={deleteFuelLog.isPending}
      />
      <ConfirmDialog
        open={Boolean(deleteExpense)}
        onOpenChange={(o) => !o && setDeleteExpense(null)}
        title="Delete Expense?"
        description="This expense record will be permanently removed."
        onConfirm={handleDeleteExpense}
        confirmLabel="Delete"
        destructive
        isLoading={deleteExpenseMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD  (inline — only used on this page)
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "orange" | "emerald" | "purple";
}) {
  const bg: Record<string, string> = {
    blue:    "bg-blue-50 dark:bg-blue-950/30",
    orange:  "bg-orange-50 dark:bg-orange-950/30",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30",
    purple:  "bg-purple-50 dark:bg-purple-950/30",
  };

  return (
    <div className={`rounded-lg border p-4 ${bg[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {icon}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
