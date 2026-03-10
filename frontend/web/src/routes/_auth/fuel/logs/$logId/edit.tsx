

// ═════════════════════════════════════════════════════════════════════════════
// routes/_auth/fuel/logs/$logId/edit.tsx
// /fuel/logs/$logId/edit — Edit an existing fuel log
// ═════════════════════════════════════════════════════════════════════════════

/**
 * routes/_auth/fuel/logs/$logId/edit.tsx
 *
 * NOTE: In your project this must be a separate file at
 *       src/routes/_auth/fuel/logs/$logId/edit.tsx
 *       It is combined here for delivery; split before placing in your tree.
 */
import { createFileRoute as createEditFileRoute, useNavigate as useEditNavigate } from "@tanstack/react-router";
import { ArrowLeft, Fuel as FuelIcon, Loader2 } from "lucide-react";
import { Link as EditLink } from "@tanstack/react-router";
import { Button as EditButton } from "../../../../../components/ui/button";
import { PageHeader as EditPageHeader } from "../../../../../components/molecules/PageHeader";
import { FuelLogForm as EditFuelLogForm } from "../../../../../components/forms/FuelLogForm";
import { useFuelLog, useUpdateFuelLog } from "../../../../../hooks/useFuel";
import { toast as editToast } from "sonner";

export const Route = createEditFileRoute("/_auth/fuel/logs/$logId/edit")({
  component: EditFuelLogPage,
});

function EditFuelLogPage() {
  const { logId }  = Route.useParams();
  const navigate   = useEditNavigate();
  const { data: log, isLoading } = useFuelLog(logId);
  const updateLog  = useUpdateFuelLog(logId);

  const handleSubmit = async (data: Parameters<typeof updateLog.mutateAsync>[0]) => {
    try {
      await updateLog.mutateAsync(data as any);
      editToast.success("Fuel log updated.");
      navigate({ to: "/fuel" });
    } catch (err) {
      editToast.error(err instanceof Error ? err.message : "Failed to update fuel log.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!log) {
    return <div className="p-8 text-muted-foreground">Fuel log not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <EditPageHeader
        title="Edit Fuel Log"
        subtitle={`Logged on ${new Date(log.loggedAt).toLocaleDateString()}`}
        icon={<FuelIcon className="h-6 w-6" />}
        actions={
          <EditLink to="/fuel">
            <EditButton variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </EditButton>
          </EditLink>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <EditFuelLogForm
          initial={log}
          onSubmit={handleSubmit}
          isLoading={updateLog.isPending}
        />
      </div>
    </div>
  );
}