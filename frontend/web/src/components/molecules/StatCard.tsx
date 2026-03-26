/**
 * components/molecules/StatCard.tsx
 * KPI summary card for the Dashboard.
 * §4.2 Molecules — props: title, value, icon, trend?, color
 */

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/card";

type TrendDirection = "up" | "down" | "neutral";

interface Trend {
  value: number;       // e.g. 12.5  (percent)
  direction: TrendDirection;
  label?: string;      // e.g. "vs last month"
}

type CardColor = "default" | "blue" | "green" | "amber" | "red" | "purple" | "teal" | "cyan" | "indigo";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: Trend;
  color?: CardColor;
  className?: string;
}

const COLOR_CLASSES: Record<CardColor, { icon: string; iconBg: string }> = {
  default: { icon: "text-muted-foreground", iconBg: "bg-muted" },
  blue:    { icon: "text-blue-600",         iconBg: "bg-blue-50" },
  green:   { icon: "text-green-600",        iconBg: "bg-green-50" },
  amber:   { icon: "text-amber-600",        iconBg: "bg-amber-50" },
  red:     { icon: "text-red-600",          iconBg: "bg-red-50" },
  purple:  { icon: "text-purple-600",       iconBg: "bg-purple-50" },
  teal:    { icon: "text-teal-600",         iconBg: "bg-teal-50" },
  cyan:    { icon: "text-cyan-600",         iconBg: "bg-cyan-50" },
  indigo:  { icon: "text-indigo-600",       iconBg: "bg-indigo-50" },
};

const TREND_ICONS: Record<TrendDirection, LucideIcon> = {
  up:      TrendingUp,
  down:    TrendingDown,
  neutral: Minus,
};

const TREND_COLORS: Record<TrendDirection, string> = {
  up:      "text-green-600",
  down:    "text-red-600",
  neutral: "text-muted-foreground",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "default",
  className,
}: StatCardProps) {
  const { icon: iconColor, iconBg } = COLOR_CLASSES[color];

  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  return (
    <Card className={cn("@container", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {trend && TrendIcon && (
              <div className={cn("flex items-center gap-1 text-xs", TREND_COLORS[trend.direction])}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {trend.value}%{trend.label ? ` ${trend.label}` : ""}
                </span>
              </div>
            )}
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}