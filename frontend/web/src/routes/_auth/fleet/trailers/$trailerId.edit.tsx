import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { TrailerForm } from "../../../../components/fleet/TrailerForm";
import { LoadingSpinner } from "../../../../components/atoms/LoadingSpinner";
import { useTrailer, useUpdateTrailer } from "../../../../hooks/useFleet";
import { usePermission } from "../../../../hooks/usePermission";

export const Route = createFileRoute("/_auth/fleet/trailers/$trailerId/edit")({
  component: EditTrailer,
});

function EditTrailer() {
  const { trailerId } = Route.useParams();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: trailer, isLoading } = useTrailer(trailerId);
  const updateTrailer = useUpdateTrailer();

  if (!can("trailers:edit")) {
    return <p className="p-8 text-muted-foreground">You don't have permission to edit trailers.</p>;
  }
  if (isLoading) return <LoadingSpinner className="mt-24" />;
  if (!trailer) return <p className="p-8 text-muted-foreground">Trailer not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit ${trailer.plateNumber}`}
        subtitle={`${trailer.year} ${trailer.make} ${trailer.model}`}
      />
      <TrailerForm
        defaultValues={trailer}
        isLoading={updateTrailer.isPending}
        onCancel={() => navigate({ to: "/fleet/trailers/$trailerId", params: { trailerId } })}
        onSubmit={async (values) => {
          await updateTrailer.mutateAsync({ id: trailerId, ...values });
          navigate({ to: "/fleet/trailers/$trailerId", params: { trailerId } });
        }}
      />
    </div>
  );
}