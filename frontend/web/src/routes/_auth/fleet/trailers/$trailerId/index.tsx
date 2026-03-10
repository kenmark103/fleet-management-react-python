/**
 * routes/_auth/fleet/trailers/$trailerId/index.tsx
 * Route: /fleet/trailers/:trailerId
 *
 * UI fixes:
 *   - Fixed broken template literal: "${trailer.capacityTons} tons" → backtick
 *   - Mobile nav: top bar wraps on small screens instead of overflowing
 *   - Hero card padding responsive p-4 sm:p-6
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Pencil, Trash2, ArrowLeft, Container, Calendar, Weight } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { LoadingSpinner } from "../../../../../components/atoms/LoadingSpinner";
import { ConfirmDialog } from "../../../../../components/atoms/ConfirmDialog";
import { TrailerStatusBadge } from "../../../../../components/fleet/StatusBadge";
import { useTrailer, useDeleteTrailer } from "../../../../../hooks/useFleet";
import { usePermission } from "../../../../../hooks/usePermission";
import { formatDate, toTitleCase, isExpired, isExpiringSoon } from "../../../../../lib/utils";
import { cn } from "../../../../../lib/utils";

export const Route = createFileRoute("/_auth/fleet/trailers/$trailerId/")({
  component: TrailerDetail,
});

function TrailerDetail() {
  const { trailerId } = Route.useParams();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: trailer, isLoading } = useTrailer(trailerId);
  const deleteTrailer = useDeleteTrailer();
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <LoadingSpinner className="mt-24" />;
  if (!trailer) return <p className="p-8 text-muted-foreground">Trailer not found.</p>;

  const handleDelete = async () => {
    await deleteTrailer.mutateAsync(trailerId);
    navigate({ to: "/fleet/trailers" });
  };

  return (
    <div className="space-y-6">

      {/* Nav + actions — wraps on mobile */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/fleet/trailers">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Trailers
          </Link>
        </Button>
        <div className="flex gap-2">
          {can("trailers:edit") && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/fleet/trailers/$trailerId/edit" params={{ trailerId }}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </Link>
            </Button>
          )}
          {can("trailers:delete") && (
            <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </div>

      {/* Hero card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Container className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-mono">{trailer.plateNumber}</h1>
                <p className="text-muted-foreground text-sm">{trailer.year} {trailer.make} {trailer.model}</p>
                <p className="text-sm text-muted-foreground">{toTitleCase(trailer.type)}</p>
              </div>
            </div>
            <TrailerStatusBadge status={trailer.status} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Specs</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow icon={Container} label="Type"     value={toTitleCase(trailer.type)} />
            {trailer.capacityTons && (
              // ✅ Fixed: was "..." string literal, now backtick template
              <DetailRow icon={Weight} label="Capacity" value={`${trailer.capacityTons} tons`} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ExpiryRow label="Insurance"  date={trailer.insuranceExpiryDate} />
            <ExpiryRow label="Inspection" date={trailer.inspectionExpiryDate} />
          </CardContent>
        </Card>
      </div>

      {trailer.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trailer.notes}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Added {formatDate(trailer.createdAt)} · Updated {formatDate(trailer.updatedAt)}
      </p>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete this trailer?"
        description="This cannot be undone."
        onConfirm={handleDelete}
        isLoading={deleteTrailer.isPending}
        destructive
      />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ExpiryRow({ label, date }: { label: string; date?: string }) {
  const expired = isExpired(date);
  const soon    = isExpiringSoon(date, 30);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />{label}</div>
      <span className={cn("font-medium", expired && "text-red-600", !expired && soon && "text-amber-600")}>
        {date ? formatDate(date) : "—"}
        {expired && " (Expired)"}
        {!expired && soon && " (Soon)"}
      </span>
    </div>
  );
}