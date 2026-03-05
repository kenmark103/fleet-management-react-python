/**
 * components/molecules/PageHeader.tsx
 * Top section of every page — title, optional subtitle, optional action buttons.
 * §4.2 Molecules — used on every protected page
 */

import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title:      string;
  subtitle?:  string;
  /** Optional icon rendered left of the title */
  icon?:      React.ReactNode;
  /** Slot for action buttons (e.g. "Add Truck") — rendered right-aligned */
  actions?:   React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-6", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}