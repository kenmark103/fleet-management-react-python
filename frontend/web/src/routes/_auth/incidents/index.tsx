/**
 * routes/_auth/incidents/index.tsx
 * Fleet Management System — Phase 8
 *
 * Incidents list page with filtering by status, severity, type and search.
 */

import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertTriangle, Plus, Search } from "lucide-react"
import { useIncidents, useIncidentSummary, useDeleteIncident } from "@/hooks/useIncidents"
import { PageHeader } from "@/components/molecules/PageHeader"
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog"
import { StatusBadge } from "@/components/atoms/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import {
  INCIDENT_STATUSES, INCIDENT_TYPES, INCIDENT_TYPE_LABELS, INCIDENT_SEVERITY_COLORS,
} from "@/lib/constants"
import type { IncidentParams } from "@/types/incidents"
import { useAuth } from "@/lib/auth-context"

export const Route = createFileRoute("/_auth/incidents/")({
  component: IncidentsPage,
})

function IncidentsPage() {
  const { user } = useAuth()
  const canManage = user?.role === "ADMIN" || user?.role === "DISPATCHER"

  const [params, setParams] = useState<IncidentParams>({ page: 1, pageSize: 20 })
  const [search, setSearch]   = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useIncidents({ ...params, search: search || undefined })
  const { data: summary }   = useIncidentSummary()
  const deleteMutation       = useDeleteIncident()

  function setFilter(key: keyof IncidentParams, value: string | undefined) {
    setParams(p => ({ ...p, [key]: value || undefined, page: 1 }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        subtitle="Report and track fleet incidents"
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <Link to="/incidents/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
            </Button>
          </Link>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total",        value: summary.total,       color: "text-foreground" },
            { label: "Open",         value: summary.open,        color: "text-blue-600"   },
            { label: "Under Review", value: summary.underReview, color: "text-yellow-600" },
            { label: "Resolved",     value: summary.resolved,    color: "text-emerald-600"},
            { label: "Closed",       value: summary.closed,      color: "text-gray-500"   },
            { label: "Critical",     value: summary.critical,    color: "text-red-600"    },
          ].map(({ label, value, color }) => (
            <Card key={label} className="text-center">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search incidents…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select onValueChange={v => setFilter("status", v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INCIDENT_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={v => setFilter("severity", v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {(["low", "medium", "high", "critical"] as const).map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={v => setFilter("type", v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {INCIDENT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Truck</TableHead>
              {canManage && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  No incidents found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map(incident => (
                <TableRow key={incident.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link
                      to="/incidents/$incidentId"
                      params={{ incidentId: incident.id }}
                      className="font-mono text-sm font-medium text-primary hover:underline"
                    >
                      {incident.incidentNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {incident.title}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{INCIDENT_TYPE_LABELS[incident.type]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={INCIDENT_SEVERITY_COLORS[incident.severity]}
                    >
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(incident.incidentDate)}
                  </TableCell>
                  <TableCell className="text-sm">{incident.driverName ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{incident.truckPlate ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(incident.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data.meta.totalItems} incidents
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.meta.hasPreviousPage}
              onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.meta.hasNextPage}
              onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title="Delete Incident"
        description="This will permanently remove the incident and all its attachments. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteId) return
          deleteMutation.mutate(deleteId, {
            onSuccess: () => setDeleteId(null),
          })
        }}
      />
    </div>
  )
}