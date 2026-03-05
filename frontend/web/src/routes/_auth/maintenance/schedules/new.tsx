/**
 * routes/_auth/maintenance/schedules/new.tsx
 * Fleet Management System — Phase 7
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { ServiceScheduleForm } from "../../../../components/forms/ServiceScheduleForm";
import { useCreateServiceSchedule } from "../../../../hooks/useMaintenance";
import type { ServiceScheduleCreate, ServiceScheduleUpdate } from "../../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/schedules/new")({
  component: NewSchedulePage,
});

function NewSchedulePage() {
  const navigate = useNavigate();
  const create   = useCreateServiceSchedule();

  const handleSubmit = async (data: ServiceScheduleCreate | ServiceScheduleUpdate) => {
    try {
      await create.mutateAsync(data as ServiceScheduleCreate);
      toast.success("Service schedule created.");
      navigate({ to: "/maintenance" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create schedule.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="New Service Schedule"
        subtitle="Set up a recurring maintenance schedule for a truck"
        icon={<CalendarClock className="h-6 w-6" />}
        actions={
          <Link to="/maintenance">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <div className="bg-card border rounded-lg p-6">
        <ServiceScheduleForm onSubmit={handleSubmit} isLoading={create.isPending} />
      </div>
    </div>
  );
}