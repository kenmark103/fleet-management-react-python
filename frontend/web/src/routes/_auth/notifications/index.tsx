/**
 * routes/_auth/notifications/index.tsx
 * Fleet Management System — Phase 9
 *
 * Full notifications page: filter by type/unread, paginate, mark read, delete.
 * Register in your router: createFileRoute("/_auth/notifications/")
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell, MapPin, Wrench, Fuel, FileText, AlertTriangle,
  CheckCheck, Trash2, ExternalLink, Inbox,
} from "lucide-react";
import {
  useNotifications, useMarkRead, useMarkAllRead,
  useDeleteNotification, type Notification, type NotificationType,
} from "../../../hooks/useNotifications";
import { PageHeader }    from "../../../components/molecules/PageHeader";
import { Button }        from "../../../components/ui/button";
import { Badge }         from "../../../components/ui/badge";
import { formatDate }    from "../../../lib/utils";
import { cn }            from "../../../lib/utils";

export const Route = createFileRoute("/_auth/notifications/")({
  component: NotificationsPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META: Record<NotificationType, { label: string; icon: React.ElementType; color: string }> = {
  trip_assigned:        { label: "Trip Assigned",        icon: MapPin,        color: "bg-blue-100 text-blue-600" },
  trip_status_changed:  { label: "Trip Status",          icon: MapPin,        color: "bg-sky-100 text-sky-600" },
  work_order_assigned:  { label: "Work Order",           icon: Wrench,        color: "bg-amber-100 text-amber-600" },
  maintenance_due:      { label: "Maintenance Due",      icon: AlertTriangle, color: "bg-orange-100 text-orange-600" },
  document_expiring:    { label: "Document Expiring",    icon: FileText,      color: "bg-red-100 text-red-600" },
  fuel_logged:          { label: "Fuel Logged",          icon: Fuel,          color: "bg-green-100 text-green-600" },
  expense_submitted:    { label: "Expense Submitted",    icon: Fuel,          color: "bg-purple-100 text-purple-600" },
  system:               { label: "System",               icon: Bell,          color: "bg-gray-100 text-gray-600" },
};

const TYPE_FILTERS: Array<{ value: NotificationType | "ALL"; label: string }> = [
  { value: "ALL",                label: "All" },
  { value: "trip_assigned",      label: "Trips" },
  { value: "work_order_assigned", label: "Work Orders" },
  { value: "maintenance_due",    label: "Maintenance" },
  { value: "document_expiring",  label: "Documents" },
  { value: "fuel_logged",        label: "Fuel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsPage() {
  const navigate     = useNavigate();
  const [typeFilter, setTypeFilter] = useState<NotificationType | "ALL">("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page,       setPage]       = useState(1);

  const { data, isLoading } = useNotifications({
    page,
    pageSize:   20,
    unreadOnly,
  });

  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();
  const deleteNotif = useDeleteNotification();

  const allNotifs = data?.data ?? [];
  // Client-side type filter (API doesn't support type filter yet — easy to add later)
  const notifications = typeFilter === "ALL"
    ? allNotifs
    : allNotifs.filter(n => n.type === typeFilter);

  const meta          = data?.meta;
  const totalPages    = meta?.totalPages ?? 1;
  const unreadCount   = allNotifs.filter(n => !n.isRead).length;

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) navigate({ to: n.actionUrl });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Your alerts and updates from across the system"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type pills */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setTypeFilter(f.value); setPage(1); }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Unread toggle */}
        <button
          onClick={() => { setUnreadOnly(v => !v); setPage(1); }}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            unreadOnly
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", unreadOnly ? "bg-blue-500" : "bg-muted-foreground/40")} />
          Unread only
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <NotificationsSkeleton />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-30" />
            <p className="font-medium">
              {unreadOnly ? "No unread notifications" : "No notifications"}
            </p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.system;
              const Icon = meta.icon;
              return (
                <li
                  key={n.id}
                  className={cn(
                    "group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/30",
                    !n.isRead && "bg-blue-50/40 dark:bg-blue-950/10"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    meta.color
                  )}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  {/* Content */}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm leading-snug",
                        !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground"
                      )}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatDate(n.createdAt, "relative")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        "border-border bg-background text-muted-foreground"
                      )}>
                        {meta.label}
                      </span>
                      {!n.isRead && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          New
                        </span>
                      )}
                      {n.actionUrl && (
                        <span className="ml-auto text-xs text-muted-foreground/60 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> View
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Actions — revealed on hover */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Mark as read"
                        onClick={() => markRead.mutate(n.id)}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => deleteNotif.mutate(n.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
            <span>{meta?.totalItems ?? 0} notifications</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!meta?.hasPreviousPage}>
                Previous
              </Button>
              <span className="px-2">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={!meta?.hasNextPage}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsSkeleton() {
  return (
    <ul className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-4 px-5 py-4">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}