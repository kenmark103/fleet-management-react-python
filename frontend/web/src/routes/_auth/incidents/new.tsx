/**
 * routes/_auth/incidents/new.tsx
 * Fleet Management System — Phase 8
 */

import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { useCreateIncident } from "@/hooks/useIncidents"
import { PageHeader } from "@/components/molecules/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS } from "@/lib/constants"
import type { IncidentCreate } from "@/types/incidents"

export const Route = createFileRoute("/_auth/incidents/new")({
  component: NewIncidentPage,
})

const SEVERITIES = ["low", "medium", "high", "critical"] as const

function NewIncidentPage() {
  const navigate = useNavigate()
  const create   = useCreateIncident()

  const [form, setForm] = useState<Partial<IncidentCreate>>({
    severity:    "medium",
    incidentDate: new Date().toISOString().slice(0, 16),
  })

  function set(key: keyof IncidentCreate, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.description || !form.type || !form.severity || !form.incidentDate) {
      toast.error("Please fill in all required fields")
      return
    }
    try {
      const res = await create.mutateAsync(form as IncidentCreate)
      toast.success(`Incident ${res.data.incidentNumber} reported`)
      navigate({ to: "/incidents/$incidentId", params: { incidentId: res.data.id } })
    } catch {
      toast.error("Failed to report incident")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Report Incident"
        subtitle="Log a new fleet incident for review"
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/incidents" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incident Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="Brief description of the incident"
                value={form.title ?? ""}
                onChange={e => set("title", e.target.value)}
              />
            </div>

            {/* Type + Severity row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select onValueChange={v => set("type", v)} value={form.type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Severity <span className="text-destructive">*</span></Label>
                <Select
                  onValueChange={v => set("severity", v)}
                  value={form.severity}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date + Location row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="incident-date">
                  Incident Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="incident-date"
                  type="datetime-local"
                  value={form.incidentDate ?? ""}
                  onChange={e => set("incidentDate", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Highway A1, km 34"
                  value={form.location ?? ""}
                  onChange={e => set("location", e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what happened in detail…"
                rows={4}
                value={form.description ?? ""}
                onChange={e => set("description", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Optional links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related Resources (optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="driver-id">Driver ID</Label>
              <Input
                id="driver-id"
                placeholder="Driver profile ID"
                value={form.driverId ?? ""}
                onChange={e => set("driverId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="truck-id">Truck ID</Label>
              <Input
                id="truck-id"
                placeholder="Truck ID"
                value={form.truckId ?? ""}
                onChange={e => set("truckId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-id">Trip ID</Label>
              <Input
                id="trip-id"
                placeholder="Trip ID"
                value={form.tripId ?? ""}
                onChange={e => set("tripId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trailer-id">Trailer ID</Label>
              <Input
                id="trailer-id"
                placeholder="Trailer ID"
                value={form.trailerId ?? ""}
                onChange={e => set("trailerId", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/incidents" })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Submitting…" : "Submit Incident"}
          </Button>
        </div>
      </form>
    </div>
  )
}