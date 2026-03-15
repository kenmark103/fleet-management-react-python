/**
 * routes/_auth/maintenance/index.tsx
 * Fleet Management System — Phase 7
 * /maintenance — Tabs: Work Orders | Service Schedules
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Wrench, CalendarClock, Plus, Pencil, Trash2,
  Loader2, ChevronRight, Clock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { StatusBadge } from "../../../components/atoms/StatusBadge";
import { ConfirmDialog } from "../../../components/atoms/ConfirmDialog";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { useAppSettings } from "../../../lib/settings-context";
import { WORK_ORDER_STATUSES } from "../../../lib/constants";
import { usePermission } from "../../../hooks/usePermission";
import {
  useWorkOrders, useDeleteWorkOrder,
  useServiceSchedules, useDeleteServiceSchedule,
} from "../../../hooks/useMaintenance";
import type { WorkOrderParams, ScheduleParams, WorkOrderPriority } from "../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/")({
  component: MaintenancePage,
});

const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  low:      "bg-gray-100 text-gray-600 border-gray-200",
  medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

function DueChip({ days }: { days?: number }) {
  if (days == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (days < 0)
    return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">Overdue {Math.abs(days)}d</Badge>;
  if (days <= 30)
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">In {days}d</Badge>;
  return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">{days}d</Badge>;
}

function MaintenancePage() {
  const { can } = usePermission();
  const {formatCurrency, formatAppDate} = useAppSettings();

  const [woParams,       setWoParams]       = useState<WorkOrderParams>({ page: 1, pageSize: 20 });
  const [scheduleParams, setScheduleParams] = useState<ScheduleParams>({ page: 1, pageSize: 20 });
  const [deleteWoId,       setDeleteWoId]       = useState<string | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);

  const { data: woData,       isLoading: woLoading }       = useWorkOrders(woParams);
  const { data: scheduleData, isLoading: scheduleLoading } = useServiceSchedules(scheduleParams);
  const deleteWo       = useDeleteWorkOrder();
  const deleteSchedule = useDeleteServiceSchedule();

  const handleDeleteWo = async () => {
    if (!deleteWoId) return;
    try { await deleteWo.mutateAsync(deleteWoId); toast.success("Work order deleted."); }
    catch { toast.error("Failed to delete."); }
    finally { setDeleteWoId(null); }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    try { await deleteSchedule.mutateAsync(deleteScheduleId); toast.success("Schedule deleted."); }
    catch { toast.error("Failed to delete."); }
    finally { setDeleteScheduleId(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Work orders, service schedules and fleet upkeep"
        icon={<Wrench className="h-6 w-6" />}
      />

      <Tabs defaultValue="work-orders" className="space-y-4">
        <TabsList className="flex w-auto">
          <TabsTrigger value="work-orders" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />Work Orders
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />Service Schedules
          </TabsTrigger>
        </TabsList>

        {/* ══ WORK ORDERS ══════════════════════════════════════════════════ */}
        <TabsContent value="work-orders" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search title…"
              className="w-48"
              onChange={(e) => setWoParams((p) => ({ ...p, page: 1, search: e.target.value || undefined }))}
            />
            <Select
              value={woParams.status ?? "all"}
              onValueChange={(v) => setWoParams((p) => ({ ...p, page: 1, status: v === "all" ? undefined : v as any }))}
            >
              <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {WORK_ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={woParams.priority ?? "all"}
              onValueChange={(v) => setWoParams((p) => ({ ...p, page: 1, priority: v === "all" ? undefined : v as any }))}
            >
              <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {(["low", "medium", "high", "critical"] as WorkOrderPriority[]).map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("maintenance:create-work-order") && (
              <Link to="/maintenance/work-orders/new" className="ml-auto">
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Work Order</Button>
              </Link>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-28">WO #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Truck</TableHead>
                  <TableHead>Mechanic</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {woLoading ? (
                  <TableRow><TableCell colSpan={9} className="h-32 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : !woData?.data.length ? (
                  <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No work orders found.</TableCell></TableRow>
                ) : woData.data.map((wo) => (
                  <TableRow key={wo.id} className={`hover:bg-muted/30 ${wo.status === "overdue" ? "border-l-2 border-l-red-500" : ""}`}>
                    <TableCell><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{wo.workOrderNumber}</span></TableCell>
                    <TableCell className="font-medium text-sm max-w-[180px] truncate">{wo.title}</TableCell>
                    <TableCell>{wo.truckPlate ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{wo.truckPlate}</span> : "—"}</TableCell>
                    <TableCell className="text-sm">{wo.mechanicName ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={PRIORITY_COLORS[wo.priority]}>{wo.priority}</Badge></TableCell>
                    <TableCell><StatusBadge status={wo.status} /></TableCell>
                    <TableCell className="text-sm">{formatAppDate(wo.scheduledDate)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{wo.estimatedCost ? formatCurrency(wo.estimatedCost) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link to="/maintenance/work-orders/$workOrderId" params={{ workOrderId: wo.id }}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="h-3.5 w-3.5" /></Button>
                        </Link>
                        {can("maintenance:update-work-order") && (
                          <Link to="/maintenance/work-orders/$workOrderId/edit" params={{ workOrderId: wo.id }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                          </Link>
                        )}
                        {can("maintenance:close-work-order") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteWoId(wo.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {woData?.meta && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{woData.meta.totalItems} work order{woData.meta.totalItems !== 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!woData.meta.hasPreviousPage} onClick={() => setWoParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}>Previous</Button>
                <span className="self-center px-2">Page {woData.meta.page} of {woData.meta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={!woData.meta.hasNextPage} onClick={() => setWoParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ SERVICE SCHEDULES ════════════════════════════════════════════ */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={scheduleParams.isActive === undefined ? "all" : scheduleParams.isActive ? "active" : "inactive"}
              onValueChange={(v) => setScheduleParams((p) => ({ ...p, page: 1, isActive: v === "all" ? undefined : v === "active" }))}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All schedules</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={scheduleParams.dueSoon ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleParams((p) => ({ ...p, page: 1, dueSoon: !p.dueSoon }))}
            >
              <Clock className="mr-1.5 h-4 w-4" />Due Soon
            </Button>
            {can("maintenance:set-reminders") && (
              <Link to="/maintenance/schedules/new" className="ml-auto">
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Schedule</Button>
              </Link>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Truck</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Last Service</TableHead>
                  <TableHead>Next Service</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : !scheduleData?.data.length ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No service schedules found.</TableCell></TableRow>
                ) : scheduleData.data.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30">
                    <TableCell>{s.truckPlate ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{s.truckPlate}</span> : "—"}</TableCell>
                    <TableCell className="font-medium text-sm">{s.serviceType}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">Every {s.intervalValue} {s.intervalType}</TableCell>
                    <TableCell className="text-sm">{s.lastServiceDate ? formatAppDate(s.lastServiceDate) : "—"}</TableCell>
                    <TableCell className="text-sm">{s.nextServiceDate ? formatAppDate(s.nextServiceDate) : "—"}</TableCell>
                    <TableCell><DueChip days={s.daysUntilDue} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {can("maintenance:set-reminders") && (
                          <Link to="/maintenance/schedules/$scheduleId/edit" params={{ scheduleId: s.id }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                          </Link>
                        )}
                        {can("maintenance:close-work-order") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteScheduleId(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {scheduleData?.meta && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{scheduleData.meta.totalItems} schedule{scheduleData.meta.totalItems !== 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!scheduleData.meta.hasPreviousPage} onClick={() => setScheduleParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}>Previous</Button>
                <span className="self-center px-2">Page {scheduleData.meta.page} of {scheduleData.meta.totalPages}</span>
                <Button variant="outline" size="sm" disabled={!scheduleData.meta.hasNextPage} onClick={() => setScheduleParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={Boolean(deleteWoId)} onOpenChange={(o) => !o && setDeleteWoId(null)}
        title="Delete Work Order?" description="This work order and all its parts will be permanently removed."
        onConfirm={handleDeleteWo} confirmLabel="Delete" destructive isLoading={deleteWo.isPending} />
      <ConfirmDialog open={Boolean(deleteScheduleId)} onOpenChange={(o) => !o && setDeleteScheduleId(null)}
        title="Delete Schedule?" description="This service schedule will be permanently removed."
        onConfirm={handleDeleteSchedule} confirmLabel="Delete" destructive isLoading={deleteSchedule.isPending} />
    </div>
  );
}