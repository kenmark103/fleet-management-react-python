/**
 * routes/_auth/dashboard.tsx
 * Fleet Management System — Phase 9
 *
 * Pure UI layer. All data-fetching lives in hooks/useDashboard.ts.
 * Each widget is isolated — a failing widget never breaks its neighbours.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Truck, MapPin, Users, Wrench, DollarSign, Container,
  AlertTriangle, Clock, Activity, TrendingUp,
  ChevronRight, Loader2,
} from "lucide-react";
import { useAuth }        from "../../lib/auth-context";
import { usePermission }  from "../../hooks/usePermission";
import { useAppSettings } from "../../lib/settings-context";
import { PageHeader }     from "../../components/molecules/PageHeader";
import { StatusBadge }    from "../../components/atoms/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge }          from "../../components/ui/badge";
import { Button }         from "../../components/ui/button";
import { formatDate, isExpiringSoon, isExpired } from "../../lib/utils";
import {
  useKpiData,
  useDashboardTrips,
  useDashboardActivity,
  useDashboardExpiryAlerts,
  useDashboardMaintenanceAlerts,
  useDashboardCostSummary,
} from "../../hooks/useDashboard";

export const Route = createFileRoute("/_auth/dashboard")({ component: DashboardPage });

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { user } = useAuth();
  const { can }  = usePermission();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${user?.firstName ?? "there"} 👋`}
        subtitle={formatDate(new Date().toISOString(), "long")}
      />
      <KpiGrid />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(can("trips:view-all") || can("trips:view-own")) && <TripsWidget />}
          <ActivityWidget />
        </div>
        <div className="space-y-6">
          {can("dashboard:view-expiry-alerts")      && <ExpiryAlertsWidget />}
          {can("dashboard:view-maintenance-alerts") && <MaintenanceAlertsWidget />}
          {can("dashboard:view-cost-summary")       && <CostSummaryWidget />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI GRID
// ─────────────────────────────────────────────────────────────────────────────

function KpiGrid() {
  const { can }            = usePermission();
  const { formatCurrency } = useAppSettings();

  const { fleet, drivers, activeTripsCount, pendingWoCount, fuelKpi } = useKpiData({
    canViewKpi:     can("dashboard:view-kpi"),
    canViewDrivers: can("drivers:view-list"),
    canViewTrips:   can("trips:view-all") || can("trips:view-own"),
    canViewMaint:   can("maintenance:view-all"),
    canViewCosts:   can("dashboard:view-cost-summary"),
  });

  const COLOR_MAP = {
    blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",       icon: "text-blue-500",    border: "border-blue-100 dark:border-blue-900" },
    green:   { bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: "text-emerald-500", border: "border-emerald-100 dark:border-emerald-900" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",     icon: "text-amber-500",   border: "border-amber-100 dark:border-amber-900" },
    purple:  { bg: "bg-purple-50 dark:bg-purple-950/30",   icon: "text-purple-500",  border: "border-purple-100 dark:border-purple-900" },
    default: { bg: "bg-gray-50 dark:bg-gray-900/30",       icon: "text-gray-500",    border: "border-gray-100 dark:border-gray-800" },
  };

  const cards = [
    {
      show:    can("dashboard:view-kpi"),
      title:   "Total Trucks",
      value:   fleet.isLoading ? "—" : String(fleet.data?.totalTrucks ?? 0),
      sub:     fleet.data ? `${fleet.data.activeTrucks} active` : undefined,
      icon:    Truck,
      color:   "blue" as const,
      loading: fleet.isLoading,
      href:    "/fleet/trucks",
    },
    {
      show:    can("trips:view-all") || can("trips:view-own"),
      title:   "Active Trips",
      value:   activeTripsCount.isLoading ? "—" : String(activeTripsCount.data ?? 0),
      sub:     "currently en-route",
      icon:    MapPin,
      color:   "green" as const,
      loading: activeTripsCount.isLoading,
      href:    "/trips",
    },
    {
      show:    can("drivers:view-list"),
      title:   "Active Drivers",
      value:   drivers.isLoading ? "—" : String(drivers.data?.activeDrivers ?? 0),
      sub:     drivers.data ? `${drivers.data.expiringLicenses30d} licences expiring` : undefined,
      icon:    Users,
      color:   "default" as const,
      loading: drivers.isLoading,
      href:    "/drivers",
    },
    {
      show:    can("maintenance:view-all"),
      title:   "Pending Work Orders",
      value:   pendingWoCount.isLoading ? "—" : String(pendingWoCount.data ?? 0),
      sub:     "awaiting attention",
      icon:    Wrench,
      color:   "amber" as const,
      loading: pendingWoCount.isLoading,
      href:    "/maintenance",
    },
    {
      show:    can("dashboard:view-cost-summary"),
      title:   "Monthly Fuel Cost",
      value:   fuelKpi.isLoading ? "—" : formatCurrency(fuelKpi.data?.kpis.totalFuelCost ?? 0, true),
      sub:     fuelKpi.data
        ? `+ ${formatCurrency(fuelKpi.data.kpis.totalExpenses ?? 0, true)} expenses`
        : undefined,
      icon:    DollarSign,
      color:   "purple" as const,
      loading: fuelKpi.isLoading,
      href:    "/fuel",
    },
    {
      show:    can("dashboard:view-kpi"),
      title:   "Total Trailers",
      value:   fleet.isLoading ? "—" : String(fleet.data?.totalTrailers ?? 0),
      sub:     fleet.data ? `${fleet.data.activeTrailers} active` : undefined,
      icon:    Container,
      color:   "default" as const,
      loading: fleet.isLoading,
      href:    "/fleet/trailers",
    },
  ].filter(c => c.show);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const c    = COLOR_MAP[card.color];
        const Icon = card.icon;
        return (
          <Link key={card.title} to={card.href}>
            <Card className={`border ${c.border} overflow-hidden transition-shadow hover:shadow-md`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">{card.title}</p>
                    <p className={`mt-1.5 text-2xl font-bold tabular-nums ${card.loading ? "animate-pulse text-muted" : "text-foreground"}`}>
                      {card.value}
                    </p>
                    {card.sub && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{card.sub}</p>
                    )}
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
                    <Icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIPS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

function TripsWidget() {
  const { data, isLoading, isError } = useDashboardTrips();
  const trips = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Recent Trips
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7 gap-1 px-2">
            <Link to="/trips">View all <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TripsSkeleton />
        ) : isError ? (
          <ErrorState message="Could not load trips" />
        ) : trips.length === 0 ? (
          <EmptyState icon={MapPin} message="No trips yet" />
        ) : (
          <div className="divide-y">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                to="/trips/$tripId"
                params={{ tripId: trip.id }}
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{trip.tripNumber}</span>
                    <StatusBadge status={trip.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {trip.origin} <span className="text-muted-foreground/50">→</span> {trip.destination}
                  </p>
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">{trip.assignedDriverName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground/60">{formatDate(trip.scheduledDeparture, "short")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TripsSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY WIDGET
// ─────────────────────────────────────────────────────────────────────────────

function ActivityWidget() {
  const { trips, workOrders } = useDashboardActivity();

  type ActivityItem = {
    id:         string
    icon:       React.ElementType
    colorClass: string
    text:       string
    sub:        string
    ts:         string
  }

  const items: ActivityItem[] = [
    ...(trips.data?.data ?? []).map(t => ({
      id:         `trip-${t.id}`,
      icon:       MapPin,
      colorClass: "bg-blue-100 text-blue-600",
      text:       `Trip ${t.tripNumber}: ${t.origin} → ${t.destination}`,
      sub:        `Status: ${t.status.replace("-", " ")}`,
      ts:         t.scheduledDeparture,
    })),
    ...(workOrders.data?.data ?? []).map(wo => ({
      id:         `wo-${wo.id}`,
      icon:       Wrench,
      colorClass: "bg-amber-100 text-amber-600",
      text:       `${wo.workOrderNumber}: ${wo.title}`,
      sub:        `${wo.truckPlateNumber ?? "—"} · ${wo.priority} priority`,
      ts:         wo.scheduledDate,
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trips.isLoading || workOrders.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} message="No recent activity" />
        ) : (
          <ol className="space-y-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug truncate">{item.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.sub} · {formatDate(item.ts, "relative")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY ALERTS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

function ExpiryAlertsWidget() {
  const WARN_DAYS = 30;
  const { trucks, drivers } = useDashboardExpiryAlerts();

  type ExpiryItem = { id: string; entity: string; type: string; expiryDate: string; daysLeft: number }

  const alerts: ExpiryItem[] = [];

  (trucks.data ?? []).forEach((t) => {
    if (t.insuranceExpiryDate && (isExpiringSoon(t.insuranceExpiryDate, WARN_DAYS) || isExpired(t.insuranceExpiryDate))) {
      const days = Math.ceil((new Date(t.insuranceExpiryDate).getTime() - Date.now()) / 86400000);
      alerts.push({ id: `ins-${t.id}`, entity: `${t.make} ${t.plateNumber}`, type: "Insurance", expiryDate: t.insuranceExpiryDate, daysLeft: days });
    }
    if (t.inspectionExpiryDate && (isExpiringSoon(t.inspectionExpiryDate, WARN_DAYS) || isExpired(t.inspectionExpiryDate))) {
      const days = Math.ceil((new Date(t.inspectionExpiryDate).getTime() - Date.now()) / 86400000);
      alerts.push({ id: `insp-${t.id}`, entity: `${t.make} ${t.plateNumber}`, type: "Inspection", expiryDate: t.inspectionExpiryDate, daysLeft: days });
    }
  });

  (drivers.data ?? []).forEach((d) => {
    if (isExpiringSoon(d.licenseExpiryDate, WARN_DAYS) || isExpired(d.licenseExpiryDate)) {
      const days = Math.ceil((new Date(d.licenseExpiryDate).getTime() - Date.now()) / 86400000);
      alerts.push({ id: `lic-${d.id}`, entity: `${d.firstName} ${d.lastName}`, type: "Driver Licence", expiryDate: d.licenseExpiryDate, daysLeft: days });
    }
  });

  alerts.sort((a, b) => a.daysLeft - b.daysLeft);

  const urgencyClass = (days: number) => {
    if (days <= 7)  return "bg-red-100 text-red-700 border-red-200";
    if (days <= 14) return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Expiry Alerts
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {trucks.isLoading || drivers.isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : alerts.length === 0 ? (
          <EmptyState icon={Clock} message="No upcoming expiries" />
        ) : (
          alerts.slice(0, 6).map((a) => (
            <Link
              key={a.id}
              to={a.id.startsWith("lic-") ? "/drivers/$driverId" : "/fleet/trucks/$truckId"}
              params={a.id.startsWith("lic-")
                ? { driverId:  a.id.replace(/^lic-/, "") }
                : { truckId: a.id.replace(/^(?:ins|insp)-/, "") }
              }
              className="flex items-start justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.entity}</p>
                <p className="text-xs text-muted-foreground">{a.type}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.daysLeft <= 0 ? "Expired " : "Expires "}{formatDate(a.expiryDate, "short")}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyClass(a.daysLeft)}`}>
                {a.daysLeft <= 0 ? "Expired" : `${a.daysLeft}d`}
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE ALERTS WIDGET
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};

function MaintenanceAlertsWidget() {
  const { pending, overdue } = useDashboardMaintenanceAlerts();

  const items = [
    ...(overdue.data?.data ?? []).map(wo => ({ ...wo, _overdue: true })),
    ...(pending.data?.data ?? []).map(wo => ({ ...wo, _overdue: false })),
  ].slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Maintenance
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7 gap-1 px-2">
            <Link to="/maintenance">View all <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {pending.isLoading ? (
          <WidgetSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState icon={Wrench} message="No active work orders" />
        ) : (
          items.map((wo) => (
            <Link
              key={wo.id}
              to="/maintenance/work-orders/$workOrderId"
              params={{ workOrderId: wo.id }}
              className="flex items-start justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{wo.title}</p>
                <p className="text-xs text-muted-foreground">{wo.truckPlateNumber ?? "—"} · {wo.workOrderNumber}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLES[wo.priority] ?? PRIORITY_STYLES.medium}`}>
                  {wo.priority}
                </span>
                {wo._overdue && (
                  <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Overdue</span>
                )}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COST SUMMARY WIDGET
// ─────────────────────────────────────────────────────────────────────────────

function CostSummaryWidget() {
  const { formatCurrency }  = useAppSettings();
  const { data, isLoading } = useDashboardCostSummary();

  if (isLoading) return (
    <Card><CardContent className="p-5"><WidgetSkeleton rows={4} /></CardContent></Card>
  );
  if (!data?.kpis) return (
    <Card><CardContent className="p-5"><EmptyState icon={TrendingUp} message="No cost data yet" /></CardContent></Card>
  );

  const { kpis, monthlyFuelCosts, monthlyExpenses, currency } = data;

  // Merge fuel + expense arrays on month for the sparkline
  const allMonths = Array.from(
    new Set([
      ...(monthlyFuelCosts ?? []).map(m => m.month),
      ...(monthlyExpenses  ?? []).map(m => m.month),
    ])
  ).sort();

  const last6 = allMonths.slice(-6).map(month => ({
    month,
    total:
      ((monthlyFuelCosts ?? []).find(m => m.month === month)?.totalCost  ?? 0) +
      ((monthlyExpenses  ?? []).find(m => m.month === month)?.totalAmount ?? 0),
  }));

  const maxVal = Math.max(...last6.map(m => m.total), 1);

  const bars = [
    { label: "Fuel",     value: kpis.totalFuelCost, color: "bg-blue-500" },
    { label: "Expenses", value: kpis.totalExpenses,  color: "bg-amber-500" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.totalCombined)}</p>
          <p className="text-xs text-muted-foreground">Total (fuel + expenses)</p>
        </div>

        {/* Proportional stacked bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {bars.map((b) => (
            <div
              key={b.label}
              className={`h-full ${b.color}`}
              style={{ width: `${kpis.totalCombined ? (b.value / kpis.totalCombined) * 100 : 0}%` }}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${b.color}`} />
                <span className="text-muted-foreground text-xs">{b.label}</span>
              </div>
              <span className="tabular-nums font-medium text-foreground text-xs">
                {formatCurrency(b.value)}
              </span>
            </div>
          ))}
        </div>

        {/* 6-month sparkline */}
        {last6.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">6-month trend</p>
            <div className="flex h-10 items-end gap-1">
              {last6.map((entry, i) => {
                const pct      = (entry.total / maxVal) * 100;
                const isLatest = i === last6.length - 1;
                return (
                  <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full flex items-end" style={{ height: "32px" }}>
                      <div
                        className={`w-full rounded-sm transition-all ${isLatest ? "bg-primary" : "bg-muted-foreground/25"}`}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{entry.month.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <Icon className="h-7 w-7 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="py-8 text-center text-sm text-destructive">{message}</div>;
}

function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}