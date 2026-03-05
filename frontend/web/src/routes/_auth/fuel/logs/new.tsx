// ═════════════════════════════════════════════════════════════════════════════
// routes/_auth/fuel/logs/new.tsx
// /fuel/logs/new — Create a new fuel log
// ═════════════════════════════════════════════════════════════════════════════

/**
 * routes/_auth/fuel/logs/new.tsx
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Fuel } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { FuelLogForm } from "../../../../components/forms/FuelLogForm";
import { useCreateFuelLog } from "../../../../hooks/useFuel";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/fuel/logs/new")({
  component: NewFuelLogPage,
});

function NewFuelLogPage() {
  const navigate    = useNavigate();
  const createLog   = useCreateFuelLog();

  const handleSubmit = async (data: Parameters<typeof createLog.mutateAsync>[0]) => {
    try {
      await createLog.mutateAsync(data as any);
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
