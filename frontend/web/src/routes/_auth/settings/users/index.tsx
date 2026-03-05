/**
 * routes/_auth/settings/users/index.tsx
 * Fleet Management System — Phase 8
 *
 * ADMIN-only user list. Thin page — all data logic lives in useUsers.ts.
 * Uses shadcn Table, Dialog for reset-password, DropdownMenu for row actions.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, UserPlus, MoreHorizontal, Pencil, KeyRound,
  UserX, UserCheck, ShieldAlert, RefreshCw, Eye, EyeOff,
} from "lucide-react";

import { ROLE_COLORS, ROLE_SHORT_LABELS, USER_ROLES } from "../../../../lib/constants";
import type { UserRole } from "../../../../lib/constants";
import type { UserListItem } from "../../../../types/user";
import { formatDate, getInitials } from "../../../../lib/utils";
import { usePermission } from "../../../../hooks/usePermission";
import { useAuth } from "../../../../lib/auth-context";
import {
  useUsers, useDeactivateUser, useReactivateUser, useAdminResetPassword,
} from "../../../../hooks/useUsers";

import { Button } from "../../../../components/ui/button";
import { Input }  from "../../../../components/ui/input";
import { Label }  from "../../../../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../../components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "../../../../components/ui/dialog";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { useDebounce } from "../../../../hooks/useDebounce";

export const Route = createFileRoute("/_auth/settings/users/")({
  component: UsersPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RoleFilter   = UserRole | "ALL";
type ActiveFilter = "all" | "active" | "inactive";

// ─────────────────────────────────────────────────────────────────────────────
// SMALL DISPLAY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: Pick<UserListItem, "firstName" | "lastName" | "avatarUrl"> }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.firstName} ${user.lastName}`}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-background"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-background">
      {getInitials(`${user.firstName} ${user.lastName}`)}
    </div>
  );
}

function RolePill({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_SHORT_LABELS[role]}
    </span>
  );
}

function StatusDot({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD DIALOG
// ─────────────────────────────────────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [localErr, setLocalErr]   = useState<string | null>(null);

  const resetMutation = useAdminResetPassword(user?.id ?? "");

  const handleSubmit = async () => {
    setLocalErr(null);
    if (password.length < 8) { setLocalErr("Minimum 8 characters"); return; }
    if (password !== confirm) { setLocalErr("Passwords do not match"); return; }

    await resetMutation.mutateAsync({ newPassword: password });
    setPassword(""); setConfirm("");
    onOpenChange(false);
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) { setPassword(""); setConfirm(""); setLocalErr(null); }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Set a new password for{" "}
            <span className="font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </span>
            . They should change it on next login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
            />
          </div>

          {localErr && (
            <p className="text-sm text-destructive">{localErr}</p>
          )}
          {resetMutation.error && (
            <p className="text-sm text-destructive">{(resetMutation.error as Error).message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={resetMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {resetMutation.isPending && <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW ACTION MENU
// ─────────────────────────────────────────────────────────────────────────────

function RowActions({
  user,
  isSelf,
  onResetPassword,
}: {
  user:             UserListItem;
  isSelf:           boolean;
  onResetPassword:  () => void;
}) {
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to="/settings/users/$userId/edit" params={{ userId: user.id }}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit user
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onResetPassword}>
          <KeyRound className="mr-2 h-3.5 w-3.5" />
          Reset password
        </DropdownMenuItem>

        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            {user.isActive ? (
              <DropdownMenuItem
                onClick={() => deactivate.mutate(user.id)}
                className="text-destructive focus:text-destructive"
              >
                <UserX className="mr-2 h-3.5 w-3.5" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => reactivate.mutate(user.id)}
                className="text-emerald-600 focus:text-emerald-600"
              >
                <UserCheck className="mr-2 h-3.5 w-3.5" />
                Reactivate
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON ROWS
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function UsersPage() {
  const { can }      = usePermission();
  const { user: me } = useAuth();

  if (!can("settings:view-users")) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  // ── Filter state ───────────────────────────────────────────────────────────
  const [rawSearch,    setRawSearch]    = useState("");
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [page,         setPage]         = useState(1);

  // Debounce search so we don't hit the API on every keystroke
  const search = useDebounce(rawSearch, 300);

  // Reset page when filters change
  const applyRoleFilter = (r: RoleFilter)     => { setRoleFilter(r);   setPage(1); };
  const applyActiveFilter = (f: ActiveFilter) => { setActiveFilter(f); setPage(1); };

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useUsers({
    q:        search || undefined,
    role:     roleFilter,
    isActive: activeFilter,
    page,
    pageSize: 20,
  });

  const users      = data?.data      ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // ── Reset password dialog ──────────────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);
  const [resetOpen,   setResetOpen]   = useState(false);

  const openReset = (user: UserListItem) => {
    setResetTarget(user);
    setResetOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage system accounts and access roles"
        actions={
          <Button asChild>
            <Link to="/settings/users/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Link>
          </Button>
        }
      />

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={rawSearch}
              onChange={(e) => { setRawSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email…"
              className="pl-9"
            />
          </div>

          {/* Active/Inactive toggle */}
          <div className="flex overflow-hidden rounded-lg border text-sm">
            {(["all", "active", "inactive"] as ActiveFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => applyActiveFilter(f)}
                className={`px-3 py-2 font-medium capitalize transition-colors ${
                  activeFilter === f
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Role pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyRoleFilter("ALL")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              roleFilter === "ALL"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            All roles
          </button>
          {USER_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => applyRoleFilter(r)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                roleFilter === r ? ROLE_COLORS[r] : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {ROLE_SHORT_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card">
        {isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Failed to load users.{" "}
            <button className="underline" onClick={() => refetch()}>Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonRows />
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className={!user.isActive ? "opacity-60" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <span className="font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <RolePill role={user.role} />
                      </TableCell>
                      <TableCell>
                        <StatusDot isActive={user.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.lastLoginAt
                          ? formatDate(user.lastLoginAt, "relative")
                          : <span className="text-muted-foreground/50">Never</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(user.createdAt, "short")}
                      </TableCell>
                      <TableCell>
                        <RowActions
                          user={user}
                          isSelf={me?.id === user.id}
                          onResetPassword={() => openReset(user)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {meta && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {meta.totalItems} user{meta.totalItems !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!meta.hasPreviousPage}
              >
                Previous
              </Button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!meta.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        user={resetTarget}
        open={resetOpen}
        onOpenChange={setResetOpen}
      />
    </div>
  );
}