// ═════════════════════════════════════════════════════════════════════════════
// routes/_auth/fuel/logs/new.tsx
// /fuel/logs/new — Create a new fuel log
// ═════════════════════════════════════════════════════════════════════════════

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Fuel } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { FuelLogForm } from "../../../../components/forms/FuelLogForm";
import { useCreateFuelLog } from "../../../../hooks/useFuel";
import { toast } from "sonner";
import type { FuelLogCreate, FuelLogUpdate } from "../../../../types/fuel";

export const Route = createFileRoute("/_auth/fuel/logs/new")({
  component: NewFuelLogPage,
});

function NewFuelLogPage() {
  const navigate  = useNavigate();
  const createLog = useCreateFuelLog();

  // ✅ Type as the wide union the form declares; cast to FuelLogCreate for
  //    mutateAsync — this page is always create-only.
  const handleSubmit = async (data: FuelLogCreate | FuelLogUpdate) => {
    try {
      await createLog.mutateAsync(data as FuelLogCreate);
      toast.success("Fuel log created.");
      navigate({ to: "/fuel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create fuel log.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Log Fuel"
        subtitle="Record a new fuel fill-up"
        icon={<Fuel className="h-6 w-6" />}
        actions={
          <Link to="/fuel">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <FuelLogForm
          onSubmit={handleSubmit}
          isLoading={createLog.isPending}
        />
      </div>
    </div>
  );
}