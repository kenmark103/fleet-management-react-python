/**
 * routes/_auth/drivers/$driverId.tsx
 * Fleet Management System — Phase 4 (revised Phase 8)
 *
 * Changes from original:
 *   - Edit Sheet + DriverForm removed entirely
 *   - "Edit Profile" button now links to /drivers/$driverId/edit
 *   - Header edit button removed (single Edit action, consistent with other modules)
 *   - Delete description updated to reflect soft-deactivation
 */

import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  useDriver,
  useDeleteDriver,
  useDriverTrips,
} from "../../../../hooks/useDrivers";
import { usePermission } from "../../../../hooks/usePermission";
import { DriverDocuments } from "../../../../components/drivers/DriverDocuments";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { formatDate, isExpired as checkExpired, isExpiringSoon as checkExpiringSoon, getStaticUrl } from "../../../../lib/utils";
import { useIncidents } from "@/hooks/useIncidents";

export const Route = createFileRoute("/_auth/drivers/$driverId/")({
  component: DriverDetailPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function TripStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-700 border-yellow-200",
    "en-route": "bg-blue-100 text-blue-700 border-blue-200",
    completed:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled:  "bg-red-50 text-red-500 border-red-100",
  };
  const labels: Record<string, string> = {
    pending:    "Pending",
    "en-route": "En Route",
    completed:  "Completed",
    cancelled:  "Cancelled",
  };
  return (
    <Badge variant="outline" className={styles[status] ?? ""}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProfileTab({
  driver,
  driverId,
}: {
  driver: import("../../../../types/driver").Driver;
  driverId: string;
}) {
  const { can } = usePermission();
  const isExpired      = checkExpired(driver.licenseExpiryDate);
  const isExpiringSoon = checkExpiringSoon(driver.licenseExpiryDate, 30);

  return (
    <div className="space-y-6">
      {/* License expiry alert */}
      {(isExpired || isExpiringSoon) && (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            isExpired
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-yellow-300 bg-yellow-50 text-yellow-700"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            {isExpired
              ? "This driver's license has expired."
              : `License expires on ${formatDate(driver.licenseExpiryDate, "short")} — renewal required soon.`}
          </p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
          <InfoRow icon={Mail}   label="Email"   value={driver.email} />
          <InfoRow icon={Phone}  label="Phone"   value={driver.phone} />
          <InfoRow icon={MapPin} label="Address" value={driver.address} />
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">License</h3>
          <InfoRow icon={CreditCard} label="License Number" value={driver.licenseNumber} />
          <InfoRow icon={CreditCard} label="License Class"  value={driver.licenseClass} />
          <InfoRow icon={Calendar}   label="Expiry Date"    value={formatDate(driver.licenseExpiryDate, "short")} />
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal</h3>
          <InfoRow
            icon={Calendar}
            label="Date of Birth"
            value={driver.dateOfBirth ? formatDate(driver.dateOfBirth, "short") : undefined}
          />
          <InfoRow icon={CreditCard} label="National ID" value={driver.nationalId} />
          <InfoRow icon={Calendar}   label="Hire Date"   value={formatDate(driver.hireDate, "short")} />
        </div>

        {(driver.emergencyContactName || driver.emergencyContactPhone) && (
          <div className="rounded-xl border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</h3>
            <InfoRow icon={Mail}  label="Name"  value={driver.emergencyContactName} />
            <InfoRow icon={Phone} label="Phone" value={driver.emergencyContactPhone} />
          </div>
        )}
      </div>

      {driver.notes && (
        <div className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{driver.notes}</p>
        </div>
      )}

      {/* Edit link — replaces the old sheet trigger */}
      {can("drivers:edit") && (
        <div className="flex">
          <Button variant="outline" asChild>
            <Link to="/drivers/$driverId/edit" params={{ driverId }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Profile
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────

function TripHistoryTab({ driverId }: { driverId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDriverTrips(driverId, { page, pageSize: 20 });

  const trips      = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Trip #</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                  Loading trips…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                  No trips recorded.
                </TableCell>
              </TableRow>
            )}
            {trips.map((trip) => (
              <TableRow key={trip.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-sm">{trip.tripNumber}</TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{trip.origin}</p>
                  <p className="text-xs text-muted-foreground">→ {trip.destination}</p>
                </TableCell>
                <TableCell className="text-sm">{formatDate(trip.scheduledDeparture, "short")}</TableCell>
                <TableCell className="text-sm">{formatDate(trip.scheduledArrival, "short")}</TableCell>
                <TableCell><TripStatusBadge status={trip.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={!meta.hasPreviousPage} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DriverDetailPage() {
  const { driverId } = useParams({ from: "/_auth/drivers/$driverId/" });
  const navigate     = useNavigate();
  const { can }      = usePermission();
  const { data, isLoading, isError } = useDriver(driverId);
  const deleteDriver = useDeleteDriver();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const driver = data?.data;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-24 text-muted-foreground text-sm">
        Loading driver…
      </div>
    );
  }

  if (isError || !driver) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Driver not found or access denied.</p>
        <Button variant="link" asChild className="mt-2 px-0">
          <Link to="/drivers">← Back to Drivers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">

      {/* Breadcrumb */}
      <Button variant="link" asChild className="px-0 text-muted-foreground -mb-2">
        <Link to="/drivers">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Drivers
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground overflow-hidden shrink-0">
            {driver.avatarUrl ? (
              <img  src={getStaticUrl(driver.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
            ) : (
              `${driver.firstName[0]}${driver.lastName[0]}`
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {driver.firstName} {driver.lastName}
              </h1>
              <Badge
                variant="outline"
                className={
                  driver.status === "active"
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }
              >
                {driver.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {driver.licenseClass} · License {driver.licenseNumber}
            </p>
          </div>
        </div>

        {/* Header actions */}
        {can("drivers:edit") && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link to="/drivers/$driverId/edit" params={{ driverId }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {can("drivers:view-documents") && (
            <TabsTrigger value="documents">Documents</TabsTrigger>
          )}
          {can("drivers:view-trip-history") && (
            <TabsTrigger value="trips">Trip History</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab driver={driver} driverId={driverId} />
        </TabsContent>

        {can("drivers:view-documents") && (
          <TabsContent value="documents" className="mt-6">
            <DriverDocuments driverId={driverId} />
          </TabsContent>
        )}

        {can("drivers:view-trip-history") && (
          <TabsContent value="trips" className="mt-6">
            <TripHistoryTab driverId={driverId} />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Remove ${driver.firstName} ${driver.lastName}?`}
        description="This will delete the driver profile and deactivate their login account. Trip history and fuel records are preserved."
        confirmLabel="Remove Driver"
        destructive
        isLoading={deleteDriver.isPending}
        onConfirm={async () => {
          await deleteDriver.mutateAsync(driverId);
          navigate({ to: "/drivers" });
        }}
      />
    </div>
  );
}
