/**
 * routes/_auth/trips/$tripId/index.tsx
 * Fleet Management System — Phase 8
 *
 * Changes from Phase 5:
 *   - Added "Trip Activity" tabs section below the map/detail grid.
 *     Tabs: Fuel Logs | Expenses | Incidents
 *     Each tab shows mini summary stats + a compact table, filtered to
 *     this trip only — no data from other trips ever appears here.
 *
 * TYPE NOTE:
 *   If FuelLogParams / ExpenseParams in types/fuel.ts don't yet have
 *   a `trip_id` field, add them:
 *     trip_id?: string   ← snake_case to match buildQuery → backend
 *   The backend fuel/expenses list endpoints already support trip_id
 *   via the ForeignKey on FuelLog.trip_id / Expense.trip_id columns.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Truck,
  User,
  Container,
  Play,
  CheckCircle,
  XCircle,
  Navigation,
  Loader2,
  Fuel,
  Receipt,
  AlertTriangle,
  Droplets,
} from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { useOSRMRoute }         from "../../../../hooks/useOSRMRoute";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

const createColorIcon = (color: string) =>
  new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/></svg>`,
    iconSize:     [25, 41],
    iconAnchor:   [12, 41],
    popupAnchor:  [1, -34],
    shadowUrl:    markerShadow,
    shadowSize:   [41, 41],
  });

const greenIcon = createColorIcon("#22c55e");
const redIcon   = createColorIcon("#ef4444");
const truckIcon = createColorIcon("#f59e0b");

function MapViewUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

import {
  useTrip,
  useUpdateTripStatus,
  useDeleteTrip,
}                                from "../../../../hooks/useTrips";
import { useFuelLogs, useExpenses } from "../../../../hooks/useFuel";
import { useIncidents }          from "../../../../hooks/useIncidents";
import { usePermission }         from "../../../../hooks/usePermission";
import { StatusBadge }           from "../../../../components/atoms/StatusBadge";
import { ConfirmDialog }         from "../../../../components/atoms/ConfirmDialog";
import { PageHeader }            from "../../../../components/molecules/PageHeader";
import { DetailCard }            from "../../../../components/molecules/DetailCard";
import { Button }                from "../../../../components/ui/button";
import { Badge }                 from "../../../../components/ui/badge";
import { QuickFuelLogSheet }     from "../../../../components/forms/QuickFuelLogSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Separator }             from "../../../../components/ui/separator";
import { formatDate, formatDistance, formatCurrency, formatNumber } from "../../../../lib/utils";
import { INCIDENT_TYPE_LABELS, INCIDENT_SEVERITY_COLORS } from "../../../../lib/constants";
import type { TripStatus, Trip } from "../../../../types/trips";
import { toast }                 from "sonner";

export const Route = createFileRoute("/_auth/trips/$tripId/")({
  component: TripDetailPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const navigate   = useNavigate();
  const { can }    = usePermission();

  const { data: trip, isLoading } = useTrip(tripId);
  const updateStatus = useUpdateTripStatus(tripId);
  const deleteTrip   = useDeleteTrip();

  const [statusDialog, setStatusDialog] = useState<{
    open:            boolean;
    newStatus:       TripStatus | null;
    title:           string;
    description:     string;
    captureLocation: boolean;
  }>({
    open: false, newStatus: null, title: "", description: "", captureLocation: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fuelSheetOpen,    setFuelSheetOpen]    = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!trip) {
    return <div className="p-8 text-muted-foreground">Trip not found.</div>;
  }

  // ── Status-transition buttons ─────────────────────────────────────────────
  const getAvailableActions = () => {
    const actions: Array<{
      status:  TripStatus;
      label:   string;
      icon:    React.ReactNode;
      variant: "default" | "destructive" | "outline";
    }> = [];

    if (can("trips:update-status")) {
      if (trip.status === "pending") {
        actions.push({ status: "en-route",  label: "Start Trip",    icon: <Play        className="h-4 w-4" />, variant: "default" });
      }
      if (trip.status === "en-route") {
        actions.push({ status: "completed", label: "Complete Trip", icon: <CheckCircle className="h-4 w-4" />, variant: "default" });
      }
    }
    if (can("trips:cancel") && (trip.status === "pending" || trip.status === "en-route")) {
      actions.push({ status: "cancelled", label: "Cancel Trip", icon: <XCircle className="h-4 w-4" />, variant: "destructive" });
    }
    return actions;
  };

  const handleStatusClick = (status: TripStatus, label: string) => {
    const isDriverAction = !can("trips:cancel");
    setStatusDialog({
      open:            true,
      newStatus:       status,
      title:           `${label}?`,
      description:     `This will mark the trip as "${status}".`,
      captureLocation: isDriverAction && status !== "cancelled",
    });
  };

  const confirmStatusUpdate = async () => {
    if (!statusDialog.newStatus) return;
    let location: { locationLat: number; locationLng: number } | undefined;

    if (statusDialog.captureLocation && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
        );
        location = { locationLat: pos.coords.latitude, locationLng: pos.coords.longitude };
      } catch {
        toast.warning("Could not capture your location — continuing anyway.");
      }
    }

    try {
      await updateStatus.mutateAsync({ status: statusDialog.newStatus, ...location });
      toast.success(`Trip marked as "${statusDialog.newStatus}".`);
      setStatusDialog((s) => ({ ...s, open: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update trip status.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTrip.mutateAsync(tripId);
      toast.success("Trip deleted.");
      navigate({ to: "/trips" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete trip.");
    }
  };

  const showFuelButton = trip.status === "en-route" && can("fuel:log-own");

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Trip ${trip.tripNumber}`}
        subtitle={`${trip.origin} → ${trip.destination}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/trips">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
            </Link>

            {showFuelButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFuelSheetOpen(true)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:border-amber-400 dark:hover:bg-amber-950/30"
              >
                <Fuel className="mr-2 h-4 w-4" />
                Log Fuel
              </Button>
            )}

            {can("trips:edit") && (
              <Link to="/trips/$tripId/edit" params={{ tripId }}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />Edit
                </Button>
              </Link>
            )}

            {can("trips:cancel") && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
            )}
          </div>
        }
      />

      {/* ── Main grid: detail cards + map ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — detail cards */}
        <div className="lg:col-span-1 space-y-4">

          <DetailCard
            title="Trip Status"
            items={[
              { label: "Current Status", value: <StatusBadge status={trip.status} /> },
              { label: "Trip Number",    value: trip.tripNumber },
              { label: "Created",        value: formatDate(trip.createdAt) },
              { label: "Dispatched By",  value: trip.dispatchedByName ?? "—" },
            ]}
          />

          <DetailCard
            title="Schedule"
            items={[
              { label: "Scheduled Departure", value: formatDate(trip.scheduledDeparture, "datetime") },
              { label: "Scheduled Arrival",   value: formatDate(trip.scheduledArrival,   "datetime") },
              { label: "Actual Departure",    value: trip.actualDeparture ? formatDate(trip.actualDeparture, "datetime") : "—" },
              { label: "Actual Arrival",      value: trip.actualArrival   ? formatDate(trip.actualArrival,   "datetime") : "—" },
            ]}
          />

          <DetailCard
            title="Route"
            items={[
              {
                label: "Origin",
                value: (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-sm">{trip.origin}</span>
                  </div>
                ),
              },
              {
                label: "Destination",
                value: (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-sm">{trip.destination}</span>
                  </div>
                ),
              },
              { label: "Distance", value: trip.distanceKm ? formatDistance(trip.distanceKm) : "—" },
            ]}
          />

          <DetailCard
            title="Assignments"
            items={[
              {
                label: "Truck",
                value: trip.assignedTruckPlate
                  ? <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /><span>{trip.assignedTruckPlate}</span></div>
                  : "—",
              },
              {
                label: "Trailer",
                value: trip.assignedTrailerPlate
                  ? <div className="flex items-center gap-1.5"><Container className="h-3.5 w-3.5" /><span>{trip.assignedTrailerPlate}</span></div>
                  : "—",
              },
              {
                label: "Driver",
                value: trip.assignedDriverName
                  ? <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /><span>{trip.assignedDriverName}</span></div>
                  : "—",
              },
            ]}
          />

          {(trip.cargoDescription || trip.cargoWeightTons) && (
            <DetailCard
              title="Cargo"
              items={[
                { label: "Description", value: trip.cargoDescription ?? "—" },
                { label: "Weight",      value: trip.cargoWeightTons ? `${trip.cargoWeightTons} t` : "—" },
              ]}
            />
          )}

          {/* Status actions */}
          {getAvailableActions().length > 0 && (
            <div className="bg-card p-4 rounded-lg border space-y-3">
              <h3 className="font-medium text-sm">Update Status</h3>
              <div className="flex flex-wrap gap-2">
                {getAvailableActions().map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant}
                    size="sm"
                    onClick={() => handleStatusClick(action.status, action.label)}
                    disabled={updateStatus.isPending}
                  >
                    {action.icon}
                    <span className="ml-1.5">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — map */}
        <div className="lg:col-span-2">
          <TripRouteMap trip={trip} />
        </div>
      </div>

      {/* ── Trip Activity tabs (fuel / expenses / incidents) ─────────────────── */}
      <TripActivityTabs
        tripId={tripId}
        trip={trip}
        currency={trip.currency ?? "USD"}
      />

      {/* ── Quick fuel log sheet ──────────────────────────────────────────────── */}
      <QuickFuelLogSheet
        open={fuelSheetOpen}
        onOpenChange={setFuelSheetOpen}
        tripId={tripId}
        tripNumber={trip.tripNumber}
        truckId={trip.assignedTruckId}
        truckPlate={trip.assignedTruckPlate}
      />

      {/* ── Status confirm dialog ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={statusDialog.open}
        onOpenChange={(open) => setStatusDialog((s) => ({ ...s, open }))}
        title={statusDialog.title}
        description={
          statusDialog.captureLocation
            ? `${statusDialog.description} Your current GPS location will be captured and stored.`
            : statusDialog.description
        }
        onConfirm={confirmStatusUpdate}
        confirmLabel="Confirm"
        destructive={statusDialog.newStatus === "cancelled"}
        isLoading={updateStatus.isPending}
      />

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Trip?"
        description="This action cannot be undone. The trip and all associated location pings will be permanently removed."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        isLoading={deleteTrip.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP ACTIVITY TABS
// Fuel Logs | Expenses | Incidents — all scoped to this tripId only.
// Lives below the main grid so it never competes for vertical space with
// the map, which needs room to breathe.
// ─────────────────────────────────────────────────────────────────────────────

function TripActivityTabs({
  tripId,
  trip,
  currency,
}: {
  tripId:   string;
  trip:     Trip;
  currency: string;
}) {
  // All three queries are independent — only the active tab is visible but
  // all fire in parallel so switching tabs feels instant.
  const { data: fuelData }     = useFuelLogs({ trip_id: tripId, page_size: 50 } as any);
  const { data: expenseData }  = useExpenses({ trip_id: tripId, page_size: 50 } as any);
  const { data: incidentData } = useIncidents({ tripId, pageSize: 10 });

  // ── Derived totals (computed from the fetched list) ───────────────────────
  const fuelLogs   = fuelData?.data     ?? [];
  const expenses   = expenseData?.data  ?? [];
  const incidents  = incidentData?.data ?? [];

  const totalLitres  = fuelLogs.reduce((s, l) => s + (l.litres       ?? 0), 0);
  const totalFuelCost = fuelLogs.reduce((s, l) => s + (l.totalCost   ?? 0), 0);
  const totalExpCost  = expenses.reduce((s, e) => s + (e.amount      ?? 0), 0);

  // Tab label badge counts
  const fuelCount     = fuelLogs.length;
  const expenseCount  = expenses.length;
  const incidentCount = incidents.length;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase px-0.5">
        Trip Activity
      </h2>

      <Tabs defaultValue="fuel">
        <TabsList className="grid w-full grid-cols-3 lg:w-[440px]">
          <TabsTrigger value="fuel" className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5" />
            Fuel Logs
            {fuelCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-[1.25rem] px-1 text-[10px]">
                {fuelCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Expenses
            {expenseCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 min-w-[1.25rem] px-1 text-[10px]">
                {expenseCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incidents
            {incidentCount > 0 && (
              <Badge
                variant="secondary"
                className={`ml-1 h-4 min-w-[1.25rem] px-1 text-[10px] ${
                  incidents.some(i => i.severity === "critical" || i.severity === "high")
                    ? "bg-red-100 text-red-700"
                    : ""
                }`}
              >
                {incidentCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── FUEL LOGS TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="fuel" className="mt-4">
          <Card>
            {/* Summary stat row */}
            {fuelLogs.length > 0 && (
              <>
                <div className="grid grid-cols-3 divide-x border-b">
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Fill-ups</p>
                    <p className="text-xl font-semibold">{fuelCount}</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Total Litres</p>
                    <p className="text-xl font-semibold">{formatNumber(totalLitres, 1)} L</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Fuel Cost</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalFuelCost, currency)}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Price / L</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No fuel logs recorded for this trip.
                    </TableCell>
                  </TableRow>
                ) : (
                  fuelLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{formatDate(log.loggedAt ?? log.createdAt)}</TableCell>
                      <TableCell className="text-sm">{log.stationName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(log.litres, 1)} L</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(log.pricePerLitre, currency)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(log.totalCost, currency)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{log.odometerAtFuel ? `${formatNumber(log.odometerAtFuel, 0)} km` : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {(fuelData?.meta.totalItems ?? 0) > 50 && (
              <div className="border-t px-4 py-2.5">
                <Link to="/fuel" search={{ tripId }}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all {fuelData?.meta.totalItems} fuel logs →
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── EXPENSES TAB ───────────────────────────────────────────────────── */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            {expenses.length > 0 && (
              <>
                <div className="grid grid-cols-3 divide-x border-b">
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Entries</p>
                    <p className="text-xl font-semibold">{expenseCount}</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalExpCost, currency)}</p>
                  </div>
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">Categories</p>
                    <p className="text-xl font-semibold">
                      {new Set(expenses.map(e => e.category)).size}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No expenses recorded for this trip.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{formatDate(exp.expenseDate ?? exp.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {exp.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {exp.description}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(exp.amount, exp.currency ?? currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {(expenseData?.meta.totalItems ?? 0) > 50 && (
              <div className="border-t px-4 py-2.5">
                <Link to="/fuel" search={{ tripId }}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all {expenseData?.meta.totalItems} expenses →
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── INCIDENTS TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
              <CardTitle className="text-sm font-medium">
                Incidents linked to this trip
              </CardTitle>
              <Link to="/incidents/new" search={{ tripId }}>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <AlertTriangle className="mr-1.5 h-3 w-3" />
                  Report Incident
                </Button>
              </Link>
            </CardHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reported By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No incidents reported for this trip.
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell>
                        <Link
                          to="/incidents/$incidentId"
                          params={{ incidentId: inc.id }}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {inc.incidentNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm font-medium">
                        {inc.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {INCIDENT_TYPE_LABELS[inc.type]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${INCIDENT_SEVERITY_COLORS[inc.severity]}`}
                        >
                          {inc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inc.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(inc.incidentDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inc.reporterName}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {(incidentData?.meta.totalItems ?? 0) > 10 && (
              <div className="border-t px-4 py-2.5">
                <Link to="/incidents" search={{ tripId }}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all {incidentData?.meta.totalItems} incidents →
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP ROUTE MAP  — unchanged from Phase 5
// ─────────────────────────────────────────────────────────────────────────────

function TripRouteMap({ trip }: { trip: Trip }) {
  const hasOrigin   = Boolean(trip.originLat      && trip.originLng);
  const hasDest     = Boolean(trip.destinationLat && trip.destinationLng);
  const hasLastPing = Boolean(trip.lastPing);

  const osrm = useOSRMRoute({
    originLat:      trip.originLat,
    originLng:      trip.originLng,
    destinationLat: trip.destinationLat,
    destinationLng: trip.destinationLng,
    enabled:        hasOrigin && hasDest,
  });

  const straightLinePositions: LatLngExpression[] = [
    ...(hasOrigin   ? [[trip.originLat!,             trip.originLng!]      as LatLngExpression] : []),
    ...(hasLastPing ? [[trip.lastPing!.lat,           trip.lastPing!.lng]   as LatLngExpression] : []),
    ...(hasDest     ? [[trip.destinationLat!,         trip.destinationLng!] as LatLngExpression] : []),
  ];

  const mapCenter: LatLngExpression = hasOrigin
    ? [trip.originLat!, trip.originLng!]
    : hasLastPing
    ? [trip.lastPing!.lat, trip.lastPing!.lng]
    : [1.2921, 36.8219];

  const mapZoom = hasOrigin || hasLastPing ? 7 : 5;

  const osrmDistanceLabel =
    osrm.status === "success" && osrm.distanceKm != null
      ? `Road distance: ${osrm.distanceKm.toFixed(0)} km`
      : null;

  const osrmDurationLabel =
    osrm.status === "success" && osrm.durationSecs != null
      ? `Est. drive: ${Math.round(osrm.durationSecs / 3600)} h ${Math.round((osrm.durationSecs % 3600) / 60)} min`
      : null;

  return (
    <div className="bg-card p-4 rounded-lg border">
      <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
        <Navigation className="h-4 w-4" />
        Route Map
        {osrm.status === "loading" && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />
        )}
        {osrm.status === "error" && (
          <span className="text-xs text-amber-600 font-normal ml-1">
            (road routing unavailable — showing straight line)
          </span>
        )}
      </h3>

      <div className="rounded-md overflow-hidden" style={{ isolation: "isolate" }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom
          style={{ height: "380px", width: "100%" }}
        >
          <MapViewUpdater center={mapCenter} zoom={mapZoom} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          {hasOrigin && (
            <Marker position={[trip.originLat!, trip.originLng!]} icon={greenIcon}>
              <Popup><strong>Origin</strong><br />{trip.origin}</Popup>
            </Marker>
          )}
          {hasDest && (
            <Marker position={[trip.destinationLat!, trip.destinationLng!]} icon={redIcon}>
              <Popup><strong>Destination</strong><br />{trip.destination}</Popup>
            </Marker>
          )}
          {hasLastPing && (
            <Marker position={[trip.lastPing!.lat, trip.lastPing!.lng]} icon={truckIcon}>
              <Popup>
                <strong>Last Known Location</strong><br />
                {formatDate(trip.lastPing!.recordedAt, "datetime")}
              </Popup>
            </Marker>
          )}
          {osrm.status === "success" && osrm.polyline.length >= 2 ? (
            <Polyline
              positions={osrm.polyline as LatLngExpression[]}
              pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.85 }}
            />
          ) : (
            straightLinePositions.length >= 2 && (
              <Polyline
                positions={straightLinePositions}
                pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "8 4", opacity: 0.6 }}
              />
            )
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
        {hasOrigin   && <LegendDot color="bg-green-500"  label="Origin" />}
        {hasDest     && <LegendDot color="bg-red-500"    label="Destination" />}
        {hasLastPing && (
          <LegendDot
            color="bg-yellow-400"
            label={`Last Location (${formatDate(trip.lastPing!.recordedAt, "time")})`}
          />
        )}
        {osrmDistanceLabel && <span className="text-blue-600 font-medium">{osrmDistanceLabel}</span>}
        {osrmDurationLabel && <span className="text-blue-600">{osrmDurationLabel}</span>}
        {!hasOrigin && !hasDest && !hasLastPing && (
          <span className="italic">
            No location data yet — coords are populated when the trip is created or updated.
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color} inline-block`} />
      {label}
    </span>
  );
}