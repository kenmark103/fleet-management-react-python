/**
 * components/organisms/Topbar.tsx
 * Fleet Management System — Phase 9
 *
 * Topbar with:
 *   - App logo
 *   - Bell icon with animated unread badge (30s poll)
 *   - Notifications dropdown (last 8, mark read, navigate)
 *   - User avatar dropdown: Profile, Settings (ADMIN), Log out
 */

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell, LogOut, Menu, User, Settings, ChevronRight,
  Truck, MapPin, Wrench, Fuel, FileText, AlertTriangle,
  CheckCheck, ExternalLink,
} from "lucide-react";
import { APP_NAME } from "../../lib/constants";
import { getInitials, formatDate } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { RoleBadge } from "../atoms/RoleBadge";
import { Button } from "../ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  useUnreadCount, useNotifications, useMarkRead, useMarkAllRead,
  type Notification, type NotificationType,
} from "../../hooks/useNotifications";
import type { User as UserType } from "../../types/auth";

interface TopbarProps {
  user:           UserType;
  onLogout:       () => void;
  onMenuToggle?:  () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION ICON MAP
// ─────────────────────────────────────────────────────────────────────────────

const NOTIF_META: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  trip_assigned:        { icon: MapPin,        color: "bg-blue-100 text-blue-600" },
  trip_status_changed:  { icon: MapPin,        color: "bg-sky-100 text-sky-600" },
  work_order_assigned:  { icon: Wrench,        color: "bg-amber-100 text-amber-600" },
  maintenance_due:      { icon: AlertTriangle, color: "bg-orange-100 text-orange-600" },
  document_expiring:    { icon: FileText,      color: "bg-red-100 text-red-600" },
  fuel_logged:          { icon: Fuel,          color: "bg-green-100 text-green-600" },
  expense_submitted:    { icon: Fuel,          color: "bg-purple-100 text-purple-600" },
  system:               { icon: Bell,          color: "bg-gray-100 text-gray-600" },
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION BELL
// ─────────────────────────────────────────────────────────────────────────────

function NotificationBell() {
  const navigate   = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data }                  = useNotifications({ pageSize: 8 });
  const markRead                  = useMarkRead();
  const markAllRead               = useMarkAllRead();

  const notifications = data?.data ?? [];
  const hasUnread     = unreadCount > 0;

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) {
      navigate({ to: n.actionUrl });
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className={cn("h-5 w-5", hasUnread && "text-foreground")} />
          {hasUnread && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center",
                "rounded-full bg-red-500 text-[10px] font-bold text-white",
                "ring-2 ring-background",
                "animate-in zoom-in-50 duration-200"
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {hasUnread && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                {unreadCount} new
              </span>
            )}
          </div>
          {hasUnread && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[26rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">You're all caught up</p>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = NOTIF_META[n.type] ?? NOTIF_META.system;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                    "hover:bg-muted/60",
                    !n.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                >
                  {/* Type icon */}
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    meta.color
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm leading-snug",
                      !n.isRead ? "font-medium text-foreground" : "text-muted-foreground"
                    )}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatDate(n.createdAt, "relative")}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            View all notifications
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────────────────────────────────────

export function Topbar({ user, onLogout, onMenuToggle }: TopbarProps) {
  const displayName = `${user.firstName} ${user.lastName}`;
  const isAdmin     = user.role === "ADMIN";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm">
      {/* Mobile menu toggle */}
      {onMenuToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="h-4 w-4" />
        </div>
        <span className="hidden sm:inline text-[15px] tracking-tight">{APP_NAME}</span>
      </Link>

      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-border" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-9 items-center gap-2 px-2 hover:bg-muted">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="text-xs font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-sm font-medium leading-none">{displayName}</span>
              </div>
              <RoleBadge role={user.role} className="hidden sm:inline-flex" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link to="/settings/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/settings/system" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  System Settings
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}