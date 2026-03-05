/**
 * routes/_auth/maintenance/schedules/$scheduleId/edit.tsx
 * Fleet Management System — Phase 7
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, CalendarClock, ArrowLeft } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { PageHeader } from "../../../../../components/molecules/PageHeader";
import { ServiceScheduleForm } from "../../../../../components/forms/ServiceScheduleForm";
import { useServiceSchedule, useUpdateServiceSchedule } from "../../../../../hooks/useMaintenance";
import type { ServiceScheduleCreate, ServiceScheduleUpdate } from "../../../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/schedules/$scheduleId/edit")({
  component: EditSchedulePage,
});

function EditSchedulePage() {
  const { scheduleId }                  = Route.useParams();
  const navigate                        = useNavigate();
  const { data: schedule, isLoading }   = useServiceSchedule(scheduleId);
  const update                          = useUpdateServiceSchedule(scheduleId);

  const handleSubmit = async (data: ServiceScheduleCreate | ServiceScheduleUpdate) => {
    try {
      await update.mutateAsync(data as ServiceScheduleUpdate);
      toast.success("Schedule updated.");
      navigate({ to: "/maintenance" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update schedule.");
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!schedule)
    return <div className="p-8 text-muted-foreground">Schedule not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Edit Service Schedule"
        subtitle={`${schedule.serviceType} — ${schedule.truckPlate ?? schedule.truckId}`}
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
        <ServiceScheduleForm initial={schedule} onSubmit={handleSubmit} isLoading={update.isPending} />
      </div>
    </div>
  );
}