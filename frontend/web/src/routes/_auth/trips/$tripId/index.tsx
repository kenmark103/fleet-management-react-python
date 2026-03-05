/**
 * routes/_auth/trips/$tripId/index.tsx
 * Fleet Management System — Phase 5
 *
 * /trips/:tripId — Detail view with Leaflet map
 *
 * Leaflet fixes applied:
 *  1. MapContainer (not Map — v4 API)
 *  2. Default icon broken-URL fix (delete _getIconUrl + mergeOptions)
 *  3. SVG data-URI color icons — no flaky CDN dependency
 *  4. explicit style={{ height }} on MapContainer (Tailwind alone is not enough)
 *  5. leaflet/dist/leaflet.css must be imported in src/main.tsx — NOT here
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
} from "lucide-react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

// ── Leaflet default-icon fix (Vite / webpack break the default asset URLs) ──
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Reliable SVG data-URI color icons — zero CDN dependency ─────────────────
const createColorIcon = (color: string) =>
  new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/></svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: markerShadow,
    shadowSize: [41, 41],
  });

const greenIcon = createColorIcon("#22c55e");   // origin
const redIcon   = createColorIcon("#ef4444");   // destination
const truckIcon = createColorIcon("#f59e0b");   // last known location

// ── MapViewUpdater — re-centers map when trip data loads ────────────────────
// MapContainer props are intentionally static after first render;
// this component handles dynamic re-centering via the imperative API.
function MapViewUpdater({
  center,
  zoom,
}: {
  center: LatLngExpression;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// NOTE: import "leaflet/dist/leaflet.css" belongs in src/main.tsx — once,
// globally. Importing it here causes it to be injected/removed on
// mount/unmount which breaks the map styles.
// ────────────────────────────────────────────────────────────────────────────

import {
  useTrip,
  useUpdateTripStatus,
  useDeleteTrip,
} from "../../../../hooks/useTrips";
import { usePermission } from "../../../../hooks/usePermission";
import { StatusBadge } from "../../../../components/atoms/StatusBadge";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { DetailCard } from "../../../../components/molecules/DetailCard";
import { Button } from "../../../../components/ui/button";
import { formatDate, formatDistance } from "../../../../lib/utils";
import type { TripStatus } from "../../../../types/trips";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────────────────────
// ROUTE
// ────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_auth/trips/$tripId/")({
  component: TripDetailPage,
});

// ────────────────────────────────────────────────────────────────────────────
// PAGE
// ────────────────────────────────────────────────────────────────────────────

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const { data: trip, isLoading } = useTrip(tripId);
  const updateStatus = useUpdateTripStatus(tripId);
  const deleteTrip   = useDeleteTrip();

  // ── Status-update dialog state ──────────────────────────────────────────
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    newStatus: TripStatus | null;
    title: string;
    description: string;
    captureLocation: boolean;
  }>({
    open: false,
    newStatus: null,
    title: "",
    description: "",
    captureLocation: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Loading / not-found guards ───────────────────────────────────────────
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

  // ── Available status-transition actions (role + current status) ──────────
  const getAvailableActions = () => {
    const actions: Array<{
      status: TripStatus;
      label: string;
      icon: React.ReactNode;
      variant: "default" | "destructive" | "outline";
    }> = [];

    if (can("trips:update-status")) {
      if (trip.status === "pending") {
        actions.push({
          status: "en-route",
          label: "Start Trip",
          icon: <Play className="h-4 w-4" />,
          variant: "default",
        });
      }
      if (trip.status === "en-route") {
        actions.push({
          status: "completed",
          label: "Complete Trip",
          icon: <CheckCircle className="h-4 w-4" />,
          variant: "default",
        });
      }
    }

    // Cancel is a separate, higher-privilege action
    if (
      can("trips:cancel") &&
      (trip.status === "pending" || trip.status === "en-route")
    ) {
      actions.push({
        status: "cancelled",
        label: "Cancel Trip",
        icon: <XCircle className="h-4 w-4" />,
        variant: "destructive",
      });
    }

    return actions;
  };

  // ── Open status-update confirm dialog ────────────────────────────────────
  const handleStatusClick = (status: TripStatus, label: string) => {
    // Drivers don't have trips:cancel — use that as a proxy for "is driver"
    const isDriverAction = !can("trips:cancel");
    setStatusDialog({
      open: true,
      newStatus: status,
      title: `${label}?`,
      description: `This will mark the trip as "${status}".`,
      // Capture GPS for driver start/complete actions
      captureLocation: isDriverAction && status !== "cancelled",
    });
  };

  // ── Execute status update, optionally with GPS coords ────────────────────
  const confirmStatusUpdate = async () => {
    if (!statusDialog.newStatus) return;

    let location:
      | { locationLat: number; locationLng: number }
      | undefined = undefined;

    if (statusDialog.captureLocation && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10_000,
          })
        );
        location = {
          locationLat: pos.coords.latitude,
          locationLng: pos.coords.longitude,
        };
      } catch {
        // Non-fatal — location capture failed, continue without it
        toast.warning("Could not capture your location — continuing anyway.");
      }
    }

    try {
      await updateStatus.mutateAsync({
        status: statusDialog.newStatus,
        ...location,
      });
      toast.success(`Trip marked as "${statusDialog.newStatus}".`);
      setStatusDialog((s) => ({ ...s, open: false }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update trip status."
      );
    }
  };

  // ── Delete trip ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await deleteTrip.mutateAsync(tripId);
      toast.success("Trip deleted.");
      navigate({ to: "/trips" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete trip."
      );
    }
  };

  // ── Map data ─────────────────────────────────────────────────────────────
  const hasOrigin   = Boolean(trip.originLat && trip.originLng);
  const hasDest     = Boolean(trip.destinationLat && trip.destinationLng);
  const hasLastPing = Boolean(trip.lastPing);

  // Default center: origin → last ping → world view
  const mapCenter: LatLngExpression = hasOrigin
    ? [trip.originLat!, trip.originLng!]
    : hasLastPing
    ? [trip.lastPing!.lat, trip.lastPing!.lng]
    : [20, 0];

  const mapZoom = hasOrigin || hasLastPing ? 8 : 2;

  // Polyline: origin → last ping (if present) → destination
  const polylinePositions: LatLngExpression[] = [
    ...(hasOrigin ? [[trip.originLat!, trip.originLng!] as LatLngExpression] : []),
    ...(hasLastPing ? [[trip.lastPing!.lat, trip.lastPing!.lng] as LatLngExpression] : []),
    ...(hasDest ? [[trip.destinationLat!, trip.destinationLng!] as LatLngExpression] : []),
  ];

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={`Trip ${trip.tripNumber}`}
        subtitle={`${trip.origin} → ${trip.destination}`}
        actions={
          <div className="flex gap-2">
            <Link to="/trips">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>

            {can("trips:edit") && (
              <Link to="/trips/$tripId/edit" params={{ tripId }}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            )}

            {can("trips:cancel") && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column — detail cards ───────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Status */}
          <DetailCard
            title="Trip Status"
            items={[
              { label: "Current Status", value: <StatusBadge status={trip.status} /> },
              { label: "Trip Number",    value: trip.tripNumber },
              { label: "Created",        value: formatDate(trip.createdAt) },
              { label: "Dispatched By",  value: trip.dispatchedByName ?? "—" },
            ]}
          />

          {/* Schedule */}
          <DetailCard
            title="Schedule"
            items={[
              { label: "Scheduled Departure", value: formatDate(trip.scheduledDeparture, "datetime") },
              { label: "Scheduled Arrival",   value: formatDate(trip.scheduledArrival,   "datetime") },
              { label: "Actual Departure",    value: trip.actualDeparture ? formatDate(trip.actualDeparture, "datetime") : "—" },
              { label: "Actual Arrival",      value: trip.actualArrival   ? formatDate(trip.actualArrival,   "datetime") : "—" },
            ]}
          />

          {/* Route */}
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
              {
                label: "Distance",
                value: trip.distanceKm ? formatDistance(trip.distanceKm) : "—",
              },
            ]}
          />

          {/* Assignments */}
          <DetailCard
            title="Assignments"
            items={[
              {
                label: "Truck",
                value: trip.assignedTruckPlate ? (
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    <span>{trip.assignedTruckPlate}</span>
                  </div>
                ) : "—",
              },
              {
                label: "Trailer",
                value: trip.assignedTrailerPlate ? (
                  <div className="flex items-center gap-1.5">
                    <Container className="h-3.5 w-3.5" />
                    <span>{trip.assignedTrailerPlate}</span>
                  </div>
                ) : "—",
              },
              {
                label: "Driver",
                value: trip.assignedDriverName ? (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{trip.assignedDriverName}</span>
                  </div>
                ) : "—",
              },
            ]}
          />

          {/* Cargo — only render card when data exists */}
          {(trip.cargoDescription || trip.cargoWeightTons) && (
            <DetailCard
              title="Cargo"
              items={[
                { label: "Description", value: trip.cargoDescription ?? "—" },
                {
                  label: "Weight",
                  value: trip.cargoWeightTons
                    ? `${trip.cargoWeightTons} t`
                    : "—",
                },
              ]}
            />
          )}

          {/* Status-update action buttons */}
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

        {/* ── Right column — Leaflet map ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
              <Navigation className="h-4 w-4" />
              Route Map
            </h3>

            {/* MapContainer requires an explicit style height —
                Tailwind h-* classes alone are not reliably picked up
                by Leaflet's internal size calculations.              */}
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom
              className="rounded-md"
              style={{ height: "500px", width: "100%" }}
            >
              {/* Re-center when trip data loads / changes */}
              <MapViewUpdater center={mapCenter} zoom={mapZoom} />

              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              />

              {/* Origin pin — green */}
              {hasOrigin && (
                <Marker
                  position={[trip.originLat!, trip.originLng!]}
                  icon={greenIcon}
                >
                  <Popup>
                    <strong>Origin</strong>
                    <br />
                    {trip.origin}
                  </Popup>
                </Marker>
              )}

              {/* Destination pin — red */}
              {hasDest && (
                <Marker
                  position={[trip.destinationLat!, trip.destinationLng!]}
                  icon={redIcon}
                >
                  <Popup>
                    <strong>Destination</strong>
                    <br />
                    {trip.destination}
                  </Popup>
                </Marker>
              )}

              {/* Driver last-known location — amber truck icon */}
              {hasLastPing && (
                <Marker
                  position={[trip.lastPing!.lat, trip.lastPing!.lng]}
                  icon={truckIcon}
                >
                  <Popup>
                    <strong>Last Known Location</strong>
                    <br />
                    {formatDate(trip.lastPing!.recordedAt, "datetime")}
                  </Popup>
                </Marker>
              )}

              {/* Route polyline: origin → last ping → destination */}
              {polylinePositions.length >= 2 && (
                <Polyline
                  positions={polylinePositions}
                  pathOptions={{
                    color: "#3b82f6",   // blue-500
                    weight: 3,
                    dashArray: "8 4",
                  }}
                />
              )}
            </MapContainer>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              {hasOrigin && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  Origin
                </span>
              )}
              {hasDest && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  Destination
                </span>
              )}
              {hasLastPing && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
                  Last Location
                  {" "}
                  <span className="text-muted-foreground/70">
                    ({formatDate(trip.lastPing!.recordedAt, "time")})
                  </span>
                </span>
              )}
              {!hasOrigin && !hasDest && !hasLastPing && (
                <span className="italic">
                  No location data yet — coords are populated when the trip is created or updated.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status update confirm dialog ─────────────────────────────────── */}
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