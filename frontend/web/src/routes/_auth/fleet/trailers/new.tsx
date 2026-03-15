/**
 * routes/_auth/fleet/trailers/new.tsx
 * Route: /fleet/trailers/new
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Container, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { TrailerForm } from "../../../../components/fleet/TrailerForm";
import { useCreateTrailer } from "../../../../hooks/useFleet";
import { usePermission } from "../../../../hooks/usePermission";

export const Route = createFileRoute("/_auth/fleet/trailers/new")({
  component: NewTrailer,
});

function NewTrailer() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const createTrailer = useCreateTrailer();

  if (!can("trailers:create")) {
    return <p className="p-8 text-muted-foreground">You don't have permission to add trailers.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Trailer"
        subtitle="Register a new trailer in the fleet"
        icon={<Container className="h-6 w-6" />}
        actions={
          <Link to="/fleet/trailers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <TrailerForm
        isLoading={createTrailer.isPending}
        onCancel={() => navigate({ to: "/fleet/trailers" })}
        onSubmit={async (values) => {
          const result = await createTrailer.mutateAsync(values);
          // Redirect to edit so user can immediately upload a vehicle photo
          navigate({
            to: "/fleet/trailers/$trailerId/edit",
            params: { trailerId: result.id },
          });
        }}
      />
    </div>
  );
}