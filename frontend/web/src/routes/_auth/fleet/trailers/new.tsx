import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
      <PageHeader title="Add Trailer" subtitle="Register a new trailer in the fleet" />
      <TrailerForm
        isLoading={createTrailer.isPending}
        onCancel={() => navigate({ to: "/fleet/trailers" })}
        onSubmit={async (values) => {
          await createTrailer.mutateAsync(values);
          navigate({ to: "/fleet/trailers" });
        }}
      />
    </div>
  );
}