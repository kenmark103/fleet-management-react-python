/**
 * routes/_auth/maintenance/work-orders/$workOrderId/edit.tsx
 * Fleet Management System — Phase 7
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Wrench, ArrowLeft } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { PageHeader } from "../../../../../components/molecules/PageHeader";
import { WorkOrderForm } from "../../../../../components/forms/WorkOrderForm";
import { useWorkOrder, useUpdateWorkOrder } from "../../../../../hooks/useMaintenance";
import type { WorkOrderCreate, WorkOrderUpdate } from "../../../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/work-orders/$workOrderId/edit")({
  component: EditWorkOrderPage,
});

function EditWorkOrderPage() {
  const { workOrderId }             = Route.useParams();
  const navigate                    = useNavigate();
  const { data: wo, isLoading }     = useWorkOrder(workOrderId);
  const update                      = useUpdateWorkOrder(workOrderId);

  const handleSubmit = async (data: WorkOrderCreate | WorkOrderUpdate) => {
    try {
      await update.mutateAsync(data as WorkOrderUpdate);
      toast.success("Work order updated.");
      navigate({ to: "/maintenance/work-orders/$workOrderId", params: { workOrderId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update work order.");
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!wo)
    return <div className="p-8 text-muted-foreground">Work order not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={`Edit ${wo.workOrderNumber}`}
        subtitle={wo.title}
        icon={<Wrench className="h-6 w-6" />}
        actions={
          <Link to="/maintenance/work-orders/$workOrderId" params={{ workOrderId }}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <WorkOrderForm initial={wo} onSubmit={handleSubmit} isLoading={update.isPending} />
      </div>
    </div>
  );
}