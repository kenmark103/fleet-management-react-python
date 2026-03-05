/**
 * routes/_auth/maintenance/work-orders/new.tsx
 * Fleet Management System — Phase 7
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Wrench, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { WorkOrderForm } from "../../../../components/forms/WorkOrderForm";
import { useCreateWorkOrder } from "../../../../hooks/useMaintenance";
import type { WorkOrderCreate, WorkOrderUpdate } from "../../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/work-orders/new")({
  component: NewWorkOrderPage,
});

function NewWorkOrderPage() {
  const navigate = useNavigate();
  const create   = useCreateWorkOrder();

  const handleSubmit = async (data: WorkOrderCreate | WorkOrderUpdate) => {
    try {
      await create.mutateAsync(data as WorkOrderCreate);
      toast.success("Work order created.");
      navigate({ to: "/maintenance" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create work order.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="New Work Order"
        subtitle="Create a maintenance work order"
        icon={<Wrench className="h-6 w-6" />}
        actions={
          <Link to="/maintenance">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <WorkOrderForm onSubmit={handleSubmit} isLoading={create.isPending} />
      </div>
    </div>
  );
}