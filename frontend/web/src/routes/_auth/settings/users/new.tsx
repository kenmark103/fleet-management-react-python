/**
 * routes/_auth/settings/users/new.tsx
 * Fleet Management System
 *
 * Changes from previous version:
 *   - Reads optional ?role= search param so that /drivers/new can
 *     redirect here with role=DRIVER pre-selected.
 *   - Passes defaultRole to UserForm so the dropdown is pre-filled.
 *   - Everything else unchanged.
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { usePermission } from "../../../../hooks/usePermission";
import { useCreateUser }  from "../../../../hooks/useUsers";
import { UserForm }       from "../../../../components/forms/UserForm";
import type { UserRole }  from "../../../../lib/constants";
import type { UserCreatePayload, UserUpdatePayload } from "../../../../types/user";

// Declare the accepted search params for this route
export const Route = createFileRoute("/_auth/settings/users/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Optional role pre-selection — passed by /drivers/new redirect
    role: (search.role as UserRole | undefined) ?? undefined,
  }),
  component: NewUserPage,
});

function NewUserPage() {
  const { can }    = usePermission();
  const navigate   = useNavigate();
  const createUser = useCreateUser();

  // Read ?role= from the URL — undefined when navigated to directly
  const { role: defaultRole } = useSearch({ from: "/_auth/settings/users/new" });

  if (!can("settings:create-user")) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  const handleSubmit = async (data: UserCreatePayload | UserUpdatePayload) => {
    await createUser.mutateAsync(data as UserCreatePayload);
    navigate({ to: "/settings/users" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/settings/users"
          className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">
            {defaultRole === "DRIVER" ? "Invite Driver" : "Invite New User"}
          </h1>
          <p className="text-sm text-muted-foreground">
            An invite email will be sent — no password needed from you
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <UserForm
          onSubmit={handleSubmit}
          isLoading={createUser.isPending}
          defaultRole={defaultRole} 
        />
      </div>
    </div>
  );
}