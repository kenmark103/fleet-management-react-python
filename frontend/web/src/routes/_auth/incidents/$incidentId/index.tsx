/**
 * routes/_auth/incidents/$incidentId/index.tsx
 * Fleet Management System — Phase 8
 *
 * Incident detail page — shows all fields, attachments list,
 * resolution section, and status update for ADMIN/DISPATCHER.
 */

import { useState } from "react"
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, Paperclip, Trash2 } from "lucide-react"
import {
  useIncident,
  useUpdateIncidentStatus,
  useDeleteIncident,
  useDeleteIncidentAttachment,
} from "@/hooks/useIncidents"
import { PageHeader } from "@/components/molecules/PageHeader"
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog"
import { StatusBadge } from "@/components/atoms/StatusBadge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"
import { INCIDENT_TYPE_LABELS, INCIDENT_SEVERITY_COLORS, INCIDENT_STATUSES } from "@/lib/constants"
import { useAuth } from "@/lib/auth-context"
import type { IncidentStatus } from "@/types/incidents"

export const Route = createFileRoute("/_auth/incidents/$incidentId/")({
  component: IncidentDetailPage,
})

function IncidentDetailPage() {
  const { incidentId } = Route.useParams()
  const navigate       = useNavigate()
  const { user }       = useAuth()
  const canManage      = user?.role === "ADMIN" || user?.role === "DISPATCHER"

  const { data: incident, isLoading } = useIncident(incidentId)
  const updateStatus  = useUpdateIncidentStatus(incidentId)
  const deleteInc     = useDeleteIncident()
  const deleteAtt     = useDeleteIncidentAttachment(incidentId)

  const [newStatus, setNewStatus]   = useState<IncidentStatus | "">("")
  const [resolution, setResolution] = useState("")
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  async function handleStatusUpdate() {
    if (!newStatus) return
    try {
      await updateStatus.mutateAsync({
        status:           newStatus as IncidentStatus,
        resolutionNotes:  resolution || undefined,
      })
      toast.success("Status updated")
      setNewStatus("")
      setResolution("")
    } catch {
      toast.error("Failed to update status")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>
    )
  }
  if (!incident) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Incident not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={incident.incidentNumber}
        subtitle={incident.title}
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/incidents" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {canManage && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Core details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <StatusBadge status={incident.status} />
            <Badge
              variant="outline"
              className={INCIDENT_SEVERITY_COLORS[incident.severity]}
            >
              {incident.severity}
            </Badge>
            <Badge variant="secondary">
              {INCIDENT_TYPE_LABELS[incident.type]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{incident.description}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Incident Date</p>
              <p className="font-medium">{formatDate(incident.incidentDate, "datetime")}</p>
            </div>
            {incident.location && (
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium">{incident.location}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Reported By</p>
              <p className="font-medium">{incident.reporterName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Reported On</p>
              <p className="font-medium">{formatDate(incident.createdAt)}</p>
            </div>
            {incident.driverName && (
              <div>
                <p className="text-muted-foreground">Driver</p>
                <p className="font-medium">{incident.driverName}</p>
              </div>
            )}
            {incident.truckPlate && (
              <div>
                <p className="text-muted-foreground">Truck</p>
                <p className="font-mono font-medium">{incident.truckPlate}</p>
              </div>
            )}
            {incident.tripNumber && (
              <div>
                <p className="text-muted-foreground">Trip</p>
                <Link
                  to="/trips/$tripId"
                  params={{ tripId: incident.tripId! }}
                  className="font-mono font-medium text-primary hover:underline"
                >
                  {incident.tripNumber}
                </Link>
              </div>
            )}
          </div>

          {incident.resolutionNotes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolution Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{incident.resolutionNotes}</p>
              </div>
              {incident.resolvedAt && (
                <p className="text-xs text-muted-foreground">
                  Resolved on {formatDate(incident.resolvedAt, "datetime")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            Attachments
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {incident.attachments.length} file{incident.attachments.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incident.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {incident.attachments.map(att => (
                <li key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {att.fileName}
                  </a>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAtt.mutate(att.id, {
                        onSuccess: () => toast.success("Attachment removed"),
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Status update — ADMIN / DISPATCHER only */}
      {canManage && !["resolved", "closed"].includes(incident.status) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Update Status</CardTitle>
            <CardDescription>Move this incident through the review pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Status</Label>
              <Select
                value={newStatus}
                onValueChange={v => setNewStatus(v as IncidentStatus)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATUSES.filter(s => s !== incident.status).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resolution">Resolution Notes (optional)</Label>
              <Textarea
                id="resolution"
                placeholder="Describe the resolution or next steps…"
                rows={3}
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
            </div>

            <Button
              disabled={!newStatus || updateStatus.isPending}
              onClick={handleStatusUpdate}
            >
              {updateStatus.isPending ? "Saving…" : "Update Status"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Incident"
        description={`Delete incident ${incident.incidentNumber}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteInc.isPending}
        onConfirm={() => {
          deleteInc.mutate(incidentId, {
            onSuccess: () => {
              toast.success("Incident deleted")
              navigate({ to: "/incidents" })
            },
          })
        }}
      />
    </div>
  )
}