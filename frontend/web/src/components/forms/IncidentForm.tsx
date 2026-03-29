/**
 * components/forms/IncidentForm.tsx
 * Fleet Management System — Phase 8
 *
 * Self-contained incident creation form.
 * Used by:
 *   • routes/_auth/incidents/new.tsx  (full page)
 *   • routes/_auth/incidents/index.tsx (inside a Sheet)
 *
 * Trip selector auto-populates driver + truck from the trip's assignment.
 * All three can also be set independently — picking a different driver/truck
 * after a trip is selected clears the auto-fill indicator.
 */

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, Link2, Route, Truck as TruckIcon, User } from "lucide-react"

import { useDrivers } from "@/hooks/useDrivers"
import { useTrucks }  from "@/hooks/useFleet"
import { useTrips }   from "@/hooks/useTrips"

import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge }    from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS } from "@/lib/constants"
import type { IncidentCreate } from "@/types/incidents"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface IncidentFormProps {
  onSubmit:   (data: IncidentCreate) => Promise<void>
  isLoading?: boolean
  onCancel?:  () => void
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE COMBOBOX (reusable within this file)
// ─────────────────────────────────────────────────────────────────────────────

interface ComboOption { value: string; label: string; sublabel?: string }

function ResourceCombobox({
  options, value, onSelect, placeholder, isAutoFilled,
}: {
  options:       ComboOption[]
  value:         string
  onSelect:      (val: string) => void
  placeholder:   string
  isAutoFilled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            isAutoFilled && "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
          )}
        >
          <span className="truncate">
            {selected
              ? selected.label
              : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search…`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onSelect(""); setOpen(false) }}
              >
                <span className="text-muted-foreground">— None —</span>
              </CommandItem>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.sublabel ?? ""}`}
                  onSelect={() => { onSelect(opt.value); setOpen(false) }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")}
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-xs text-muted-foreground">{opt.sublabel}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM
// ─────────────────────────────────────────────────────────────────────────────

export function IncidentForm({ onSubmit, isLoading, onCancel }: IncidentFormProps) {
  // ── resource data ──
  const { data: driversData } = useDrivers({ pageSize: 200, status: "active" })
  // useTrucks from useFleet: api.listTrucks returns paginated — access .data
  const { data: trucksData }  = useTrucks({ pageSize: 200, status: "active" })
  // useTrips: show active trips only; drivers about to report an incident are en-route
  const { data: tripsData }   = useTrips({ pageSize: 200 })

  // ── option lists ──
  const driverOptions = useMemo<ComboOption[]>(() =>
    (driversData?.data ?? []).map(d => ({
      value:    d.id,
      label:    `${d.firstName} ${d.lastName}`,
      sublabel: d.licenseNumber,
    })), [driversData])

  const truckOptions = useMemo<ComboOption[]>(() =>
    // useTrucks returns the raw fleet-api response; shape is { data: Truck[] }
    (trucksData?.data ?? []).map((t: any) => ({
      value:    t.id,
      label:    t.plateNumber ?? t.plate_number,
      sublabel: `${t.make} ${t.model}`,
    })), [trucksData])

  const tripOptions = useMemo<ComboOption[]>(() =>
    (tripsData?.data ?? []).map(t => ({
      value:    t.id,
      label:    t.tripNumber,
      sublabel: `${t.origin} → ${t.destination}`,
    })), [tripsData])

  // ── form state ──
  const [form, setForm] = useState<Partial<IncidentCreate>>({
    severity:     "medium",
    incidentDate: new Date().toISOString().slice(0, 16),
  })
  const [autoFilledTripId, setAutoFilledTripId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof IncidentCreate, string>>>({})

  function setField<K extends keyof IncidentCreate>(key: K, value: IncidentCreate[K] | "") {
    setForm(f => ({ ...f, [key]: value === "" ? undefined : value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function handleTripSelect(tripId: string) {
    setField("tripId", tripId)
    if (!tripId) {
      setAutoFilledTripId(null)
      return
    }
    const trip = tripsData?.data.find(t => t.id === tripId)
    if (!trip) return
    // Auto-populate driver + truck from the trip
    if (trip.assignedDriverId) setField("driverId", trip.assignedDriverId)
    if (trip.assignedTruckId)  setField("truckId",  trip.assignedTruckId)
    setAutoFilledTripId(tripId)
  }

  function handleDriverSelect(id: string) {
    setField("driverId", id)
    setAutoFilledTripId(null)  // manual override clears the indicator
  }

  function handleTruckSelect(id: string) {
    setField("truckId", id)
    setAutoFilledTripId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate required fields
    const newErrors: typeof errors = {}
    if (!form.title)        newErrors.title       = "Required"
    if (!form.description)  newErrors.description = "Required"
    if (!form.type)         newErrors.type        = "Required"
    if (!form.severity)     newErrors.severity    = "Required"
    if (!form.incidentDate) newErrors.incidentDate = "Required"

    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }

    await onSubmit(form as IncidentCreate)
  }

  const autoFilledTrip = autoFilledTripId
    ? tripOptions.find(t => t.value === autoFilledTripId)
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Incident Details ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Incident Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="inc-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="inc-title"
              placeholder="Brief description of the incident"
              value={form.title ?? ""}
              onChange={e => setField("title", e.target.value)}
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Type + Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={v => setField("type", v as IncidentCreate["type"])}
                value={form.type ?? ""}
              >
                <SelectTrigger className={cn(errors.type && "border-destructive")}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Severity <span className="text-destructive">*</span></Label>
              <Select
                onValueChange={v => setField("severity", v as IncidentCreate["severity"])}
                value={form.severity ?? "medium"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inc-date">
                Incident Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inc-date"
                type="datetime-local"
                value={form.incidentDate ?? ""}
                onChange={e => setField("incidentDate", e.target.value)}
                className={cn(errors.incidentDate && "border-destructive")}
              />
              {errors.incidentDate && <p className="text-xs text-destructive">{errors.incidentDate}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inc-location">Location</Label>
              <Input
                id="inc-location"
                placeholder="e.g. Highway A1, km 34"
                value={form.location ?? ""}
                onChange={e => setField("location", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="inc-desc"
              placeholder="Describe what happened in detail…"
              rows={3}
              value={form.description ?? ""}
              onChange={e => setField("description", e.target.value)}
              className={cn(errors.description && "border-destructive")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

        </CardContent>
      </Card>

      {/* ── Link to Trip (optional) ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Route className="h-3.5 w-3.5" />
            Link to Trip
            <Badge variant="secondary" className="ml-auto text-xs font-normal normal-case">optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecting a trip auto-fills the assigned driver and truck. You can still override them below.
          </p>
          <ResourceCombobox
            options={tripOptions}
            value={form.tripId ?? ""}
            onSelect={handleTripSelect}
            placeholder="Search active trips…"
          />
          {autoFilledTrip && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              Driver and truck auto-filled from trip&nbsp;
              <span className="font-mono font-semibold">{autoFilledTrip.label}</span>.
              Change them below to override.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Personnel & Assets ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <User className="h-3.5 w-3.5" />
            Personnel &amp; Assets
            <Badge variant="secondary" className="ml-auto text-xs font-normal normal-case">optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">

          {/* Driver */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Driver</Label>
              {autoFilledTripId && form.driverId && (
                <span className="text-xs text-blue-600 dark:text-blue-400">auto-filled from trip</span>
              )}
            </div>
            <ResourceCombobox
              options={driverOptions}
              value={form.driverId ?? ""}
              onSelect={handleDriverSelect}
              placeholder="Select driver…"
              isAutoFilled={Boolean(autoFilledTripId && form.driverId)}
            />
          </div>

          {/* Truck + Trailer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  <TruckIcon className="mr-1 inline h-3 w-3" />
                  Truck
                </Label>
                {autoFilledTripId && form.truckId && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">auto-filled</span>
                )}
              </div>
              <ResourceCombobox
                options={truckOptions}
                value={form.truckId ?? ""}
                onSelect={handleTruckSelect}
                placeholder="Select truck…"
                isAutoFilled={Boolean(autoFilledTripId && form.truckId)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Trailer</Label>
              <Input
                placeholder="Trailer ID (optional)"
                value={form.trailerId ?? ""}
                onChange={e => setField("trailerId", e.target.value)}
              />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Submitting…" : "Submit Incident"}
        </Button>
      </div>

    </form>
  )
}