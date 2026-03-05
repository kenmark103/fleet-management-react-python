/**
 * routes/_auth/settings/users/$userId.edit.tsx
 * Fleet Management System — Phase 8
 *
 * Thin page — data loading via useUser, form via UserForm, mutations via useUpdateUser.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert, UserX } from "lucide-react";
import { useAuth } from "../../../../../lib/auth-context";
import { usePermission } from "../../../../../hooks/usePermission";
import { useUser, useUpdateUser } from "../../../../../hooks/useUsers";
import { UserForm } from "../../../../../components/forms/UserForm";
import { Alert, AlertDescription } from "../../../../../components/ui/alert";
import type { UserUpdatePayload } from "../../../../../types/user";

export const Route = createFileRoute("/_auth/settings/users/$userId/edit")({
  component: EditUserPage,
});

function EditUserPage() {
  const { userId }   = Route.useParams();
  const { can }      = usePermission();
  const { user: me } = useAuth();
  const navigate     = useNavigate();

  const { data: user, isLoading, isError } = useUser(userId);
  const updateUser = useUpdateUser(userId);

  if (!can("settings:edit-user")) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        User not found.{" "}
        <Link to="/settings/users" className="underline">
          Back to users
        </Link>
      </div>
    );
  }

  const isSelf = me?.id === userId;

  const handleSubmit = async (data: UserUpdatePayload) => {
    await updateUser.mutateAsync(data);
    navigate({ to: "/settings/users" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings/users"
          className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Edit User</h1>
          <p className="text-sm text-muted-foreground">
            {user.firstName} {user.lastName} · {user.email}
          </p>
        </div>
      </div>

      {/* Inactive user banner */}
      {!user.isActive && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <UserX className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            This account is currently deactivated. You can reactivate it in the form below.
          </AlertDescription>
        </Alert>
      )}

      {/* Form card */}
      <div className="rounded-xl border bg-card p-6">
        <UserForm
          initial={user}
          isSelf={isSelf}
          onSubmit={handleSubmit as any}
          isLoading={updateUser.isPending}
        />
      </div>
    </div>
  );
}