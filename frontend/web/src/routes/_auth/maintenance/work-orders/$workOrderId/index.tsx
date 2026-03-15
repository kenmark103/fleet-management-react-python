/**
 * routes/_auth/maintenance/work-orders/$workOrderId/index.tsx
 * Fleet Management System — Phase 7
 * Detail page: WO metadata + inline parts management
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, Plus, Loader2, Wrench,
  PlayCircle, CheckCircle, AlertTriangle, DollarSign, X, User, Truck,
} from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Badge } from "../../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../components/ui/table";
import { StatusBadge } from "../../../../../components/atoms/StatusBadge";
import { ConfirmDialog } from "../../../../../components/atoms/ConfirmDialog";
import { PageHeader } from "../../../../../components/molecules/PageHeader";
import { formatNumber } from "../../../../../lib/utils";
import { useAppSettings } from "#/lib/settings-context";
import { usePermission } from "../../../../../hooks/usePermission";
import {
  useWorkOrder, useUpdateWorkOrderStatus, useDeleteWorkOrder,
  useAddWorkOrderPart, useDeleteWorkOrderPart,
} from "../../../../../hooks/useMaintenance";
import type { WorkOrderStatus, WorkOrderPriority } from "../../../../../types/maintenance";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/maintenance/work-orders/$workOrderId/")({
  component: WorkOrderDetailPage,
});

const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  low: "bg-gray-100 text-gray-600 border-gray-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

function WorkOrderDetailPage() {
  const { workOrderId } = Route.useParams();
  const navigate        = useNavigate();
  const { can }         = usePermission();
  const {formatAppDate, formatCurrency} = useAppSettings();

  const { data: wo, isLoading } = useWorkOrder(workOrderId);
  const updateStatus = useUpdateWorkOrderStatus(workOrderId);
  const deleteWo     = useDeleteWorkOrder();
  const addPart      = useAddWorkOrderPart(workOrderId);
  const deletePart   = useDeleteWorkOrderPart(workOrderId);

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean; newStatus: WorkOrderStatus | null; title: string; description: string; destructive?: boolean;
  }>({ open: false, newStatus: null, title: "", description: "" });

  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deletePartId, setDeletePartId] = useState<string | null>(null);

  // Add part form state
  const [showPartForm,  setShowPartForm]  = useState(false);
  const [partName,      setPartName]      = useState("");
  const [partNumber,    setPartNumber]    = useState("");
  const [partQty,       setPartQty]       = useState(1);
  const [partUnitCost,  setPartUnitCost]  = useState(0);
  const partTotal = partQty * partUnitCost;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!wo) return <div className="p-8 text-muted-foreground">Work order not found.</div>;

  // Build status action buttons based on current status
  const statusActions: { status: WorkOrderStatus; label: string; icon: React.ReactNode; destructive?: boolean }[] = [];
  if (can("maintenance:update-work-order")) {
    if (wo.status === "pending" || wo.status === "overdue")
      statusActions.push({ status: "in-progress", label: "Start Work", icon: <PlayCircle className="h-4 w-4" /> });
    if (wo.status === "in-progress")
      statusActions.push({ status: "completed", label: "Mark Complete", icon: <CheckCircle className="h-4 w-4" /> });
    if (wo.status !== "completed" && wo.status !== "overdue")
      statusActions.push({ status: "overdue", label: "Mark Overdue", icon: <AlertTriangle className="h-4 w-4" />, destructive: true });
  }

  const handleStatusConfirm = async () => {
    if (!statusDialog.newStatus) return;
    try {
      await updateStatus.mutateAsync({ status: statusDialog.newStatus });
      toast.success(`Status updated to "${statusDialog.newStatus}".`);
      setStatusDialog((s) => ({ ...s, open: false }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to update status."); }
  };

  const handleDelete = async () => {
    try {
      await deleteWo.mutateAsync(workOrderId);
      toast.success("Work order deleted.");
      navigate({ to: "/maintenance" });
    } catch { toast.error("Failed to delete work order."); }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;
    try {
      await addPart.mutateAsync({ partName: partName.trim(), partNumber: partNumber.trim() || undefined, quantity: partQty, unitCost: partUnitCost, currency: wo.currency });
      toast.success("Part added.");
      setPartName(""); setPartNumber(""); setPartQty(1); setPartUnitCost(0); setShowPartForm(false);
    } catch { toast.error("Failed to add part."); }
  };

  const handleDeletePart = async () => {
    if (!deletePartId) return;
    try { await deletePart.mutateAsync(deletePartId); toast.success("Part removed."); }
    catch { toast.error("Failed to remove part."); }
    finally { setDeletePartId(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={wo.workOrderNumber}
        subtitle={wo.title}
        icon={<Wrench className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Link to="/maintenance"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
            {can("maintenance:update-work-order") && (
              <Link to="/maintenance/work-orders/$workOrderId/edit" params={{ workOrderId }}>
                <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
              </Link>
            )}
            {can("maintenance:close-work-order") && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: metadata cards */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Overview</h3>
            <div className="space-y-2 text-sm">
              {[
                ["WO Number",   <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{wo.workOrderNumber}</span>],
                ["Status",      <StatusBadge status={wo.status} />],
                ["Priority",    <Badge variant="outline" className={PRIORITY_COLORS[wo.priority]}>{wo.priority}</Badge>],
                ["Truck",       wo.truckPlate ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded"><Truck className="inline h-3 w-3 mr-1" />{wo.truckPlate}</span> : "—"],
                ["Mechanic",    wo.mechanicName ? <span className="flex items-center gap-1"><User className="h-3 w-3" />{wo.mechanicName}</span> : "—"],
                ["Created By",  wo.createdByName ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule card */}
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Schedule</h3>
            <div className="space-y-2 text-sm">
              {[
                ["Scheduled",  formatAppDate(wo.scheduledDate)],
                ["Completed",  wo.completedDate ? formatAppDate(wo.completedDate) : "—"],
                ["Odometer",   wo.odometerAtService ? `${formatNumber(wo.odometerAtService)} km` : "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost card */}
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Costs</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated</span>
                <span className="font-mono">{wo.estimatedCost ? formatCurrency(wo.estimatedCost) : "—"}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Actual (parts)</span>
                <span className="font-mono">{wo.actualCost != null ? formatCurrency(wo.actualCost) : "—"}</span>
              </div>
              {wo.estimatedCost != null && wo.actualCost != null && (
                <div className={`flex justify-between text-xs pt-1 border-t ${wo.actualCost > wo.estimatedCost ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Variance</span>
                  <span className="font-mono">{formatCurrency(wo.actualCost - wo.estimatedCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status actions */}
          {statusActions.length > 0 && (
            <div className="bg-card border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">Update Status</h3>
              <div className="flex flex-col gap-2">
                {statusActions.map((action) => (
                  <Button key={action.status} variant={action.destructive ? "destructive" : "default"} size="sm" className="w-full justify-start"
                    onClick={() => setStatusDialog({ open: true, newStatus: action.status, title: `${action.label}?`, description: `Change status to "${action.status}"?`, destructive: action.destructive })}
                    disabled={updateStatus.isPending}>
                    {action.icon}<span className="ml-2">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {wo.notes && (
            <div className="bg-card border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-sm">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{wo.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Parts */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" />Parts & Materials
                {wo.parts.length > 0 && <Badge variant="secondary">{wo.parts.length}</Badge>}
              </h3>
              {can("maintenance:update-work-order") && wo.status !== "completed" && (
                <Button size="sm" variant="outline" onClick={() => setShowPartForm((v) => !v)}>
                  {showPartForm ? <><X className="mr-2 h-4 w-4" />Cancel</> : <><Plus className="mr-2 h-4 w-4" />Add Part</>}
                </Button>
              )}
            </div>

            {showPartForm && (
              <form onSubmit={handleAddPart} className="p-4 bg-muted/30 border-b grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Part Name *</Label>
                  <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="e.g. Oil Filter" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Part Number</Label>
                  <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g. OF-1234" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qty *</Label>
                  <Input type="number" min={1} value={partQty} onChange={(e) => setPartQty(parseInt(e.target.value) || 1)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit Cost *</Label>
                  <Input type="number" min={0} step={0.01} value={partUnitCost || ""} onChange={(e) => setPartUnitCost(parseFloat(e.target.value) || 0)} placeholder="0.00" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total (auto)</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-mono text-sm">{formatCurrency(partTotal)}</div>
                </div>
                <div className="md:col-span-4 flex gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={addPart.isPending || !partName.trim()}>
                    {addPart.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Part
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowPartForm(false)}>Cancel</Button>
                </div>
              </form>
            )}

            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Part Name</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {wo.parts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">No parts added yet.</TableCell></TableRow>
                ) : wo.parts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium text-sm">{part.partName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{part.partNumber ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{part.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(part.unitCost)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(part.totalCost)}</TableCell>
                    <TableCell>
                      {can("maintenance:update-work-order") && wo.status !== "completed" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletePartId(part.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {wo.parts.length > 0 && (
                  <TableRow className="bg-muted/20 font-medium">
                    <TableCell colSpan={4} className="text-right text-sm">Total Parts Cost</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(wo.actualCost ?? 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ConfirmDialog open={statusDialog.open} onOpenChange={(o) => setStatusDialog((s) => ({ ...s, open: o }))}
        title={statusDialog.title} description={statusDialog.description}
        onConfirm={handleStatusConfirm} confirmLabel="Confirm"
        destructive={statusDialog.destructive} isLoading={updateStatus.isPending} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Delete Work Order?" description="This work order and all its parts will be permanently removed."
        onConfirm={handleDelete} confirmLabel="Delete" destructive isLoading={deleteWo.isPending} />
      <ConfirmDialog open={Boolean(deletePartId)} onOpenChange={(o) => !o && setDeletePartId(null)}
        title="Remove Part?" description="This part will be removed and the cost recalculated."
        onConfirm={handleDeletePart} confirmLabel="Remove" destructive isLoading={deletePart.isPending} />
    </div>
  );
}