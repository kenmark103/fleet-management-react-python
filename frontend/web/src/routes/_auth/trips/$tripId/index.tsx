/**
 * routes/_auth/trips/$tripId/index.tsx
 * Fleet Management System — Phase 5
 *
 * Changes:
 *   - "Log Fuel" button added to page header actions bar,
 *     visible only when trip is en-route and user can("fuel:log-own")
 *   - QuickFuelLogSheet wired in below the page
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
} from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

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
} from "../../../../hooks/useTrips";
import { usePermission }       from "../../../../hooks/usePermission";
import { StatusBadge }         from "../../../../components/atoms/StatusBadge";
import { ConfirmDialog }       from "../../../../components/atoms/ConfirmDialog";
import { PageHeader }          from "../../../../components/molecules/PageHeader";
import { DetailCard }          from "../../../../components/molecules/DetailCard";
import { Button }              from "../../../../components/ui/button";
import { QuickFuelLogSheet }   from "../../../../components/forms/QuickFuelLogSheet";
import { formatDate, formatDistance } from "../../../../lib/utils";
import type { TripStatus, Trip } from "../../../../types/trips";
import { toast }               from "sonner";

export const Route = createFileRoute("/_auth/trips/$tripId/")({
  component: TripDetailPage,
});

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

  const [deleteDialogOpen,  setDeleteDialogOpen]  = useState(false);
  // ── Fuel log sheet state ──────────────────────────────────────────────────
  const [fuelSheetOpen,     setFuelSheetOpen]     = useState(false);

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

  // ── Show "Log Fuel" only when en-route and user has fuel permission ────────
  const showFuelButton = trip.status === "en-route" && can("fuel:log-own");

  return (
    <div className="space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
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

            {/* Log Fuel — only visible when en-route */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column — detail cards ──────────────────────────────────── */}
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

        {/* ── Right column — map ──────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <TripRouteMap trip={trip} />
        </div>
      </div>

      {/* ── Quick fuel log sheet ─────────────────────────────────────────── */}
      <QuickFuelLogSheet
        open={fuelSheetOpen}
        onOpenChange={setFuelSheetOpen}
        tripId={tripId}
        tripNumber={trip.tripNumber}
        truckId={trip.assignedTruckId}
        truckPlate={trip.assignedTruckPlate}
      />

      {/* ── Status confirm dialog ────────────────────────────────────────── */}
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

      {/* ── Delete confirm dialog ────────────────────────────────────────── */}
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
// TRIP ROUTE MAP  — isolated component so Leaflet's z-indexes are contained
// ─────────────────────────────────────────────────────────────────────────────

function TripRouteMap({ trip }: { trip: Trip }) {
  const hasOrigin   = Boolean(trip.originLat && trip.originLng);
  const hasDest     = Boolean(trip.destinationLat && trip.destinationLng);
  const hasLastPing = Boolean(trip.lastPing);

  const mapCenter: LatLngExpression = hasOrigin
    ? [trip.originLat!, trip.originLng!]
    : hasLastPing
    ? [trip.lastPing!.lat, trip.lastPing!.lng]
    : [20, 0];

  const mapZoom = hasOrigin || hasLastPing ? 8 : 2;

  const polylinePositions: LatLngExpression[] = [
    ...(hasOrigin   ? [[trip.originLat!,       trip.originLng!]      as LatLngExpression] : []),
    ...(hasLastPing ? [[trip.lastPing!.lat,     trip.lastPing!.lng]   as LatLngExpression] : []),
    ...(hasDest     ? [[trip.destinationLat!,   trip.destinationLng!] as LatLngExpression] : []),
  ];

  return (
    <div className="bg-card p-4 rounded-lg border">
      <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
        <Navigation className="h-4 w-4" />Route Map
      </h3>
      {/*
        isolation-isolate creates a new stacking context that contains
        Leaflet's internal z-indexes so the map never floats above the
        topbar (z-40) or over sheets/modals.
      */}
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
          {polylinePositions.length >= 2 && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{ color: "#3b82f6", weight: 3, dashArray: "8 4" }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
        {hasOrigin   && <LegendDot color="bg-green-500"  label="Origin" />}
        {hasDest     && <LegendDot color="bg-red-500"    label="Destination" />}
        {hasLastPing && (
          <LegendDot color="bg-yellow-400" label={`Last Location (${formatDate(trip.lastPing!.recordedAt, "time")})`} />
        )}
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