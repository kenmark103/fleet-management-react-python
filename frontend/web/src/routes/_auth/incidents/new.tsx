/**
 * routes/_auth/incidents/new.tsx
 * Fleet Management System — Phase 8
 *
 * Thin page wrapper — all form logic lives in IncidentForm.
 * Mirrors the pattern used by routes/_auth/fuel/expenses/new.tsx.
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { useCreateIncident } from "@/hooks/useIncidents"
import { IncidentForm }      from "@/components/forms/IncidentForm"
import { PageHeader }        from "@/components/molecules/PageHeader"
import { Button }            from "@/components/ui/button"
import type { IncidentCreate } from "@/types/incidents"

export const Route = createFileRoute("/_auth/incidents/new")({
  component: NewIncidentPage,
})

function NewIncidentPage() {
  const navigate = useNavigate()
  const create   = useCreateIncident()

  const handleSubmit = async (data: IncidentCreate) => {
    const res = await create.mutateAsync(data)
    toast.success(`Incident ${res.data.incidentNumber} reported`)
    navigate({ to: "/incidents/$incidentId", params: { incidentId: res.data.id } })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Report Incident"
        subtitle="Log a new fleet incident for review"
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <Link to="/incidents">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border bg-card p-6">
        <IncidentForm
          onSubmit={handleSubmit}
          isLoading={create.isPending}
          onCancel={() => navigate({ to: "/incidents" })}
        />
      </div>
    </div>
  )
}