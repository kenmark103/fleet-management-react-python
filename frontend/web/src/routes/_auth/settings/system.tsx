/**
 * routes/_auth/settings/system.tsx
 * System Settings Page — ADMIN only
 *
 * On save → useUpdateSettings patches the backend AND immediately updates
 * the React Query cache → SettingsProvider re-renders → formatCurrency,
 * formatDist, formatAppDate, and theme all update across the whole app
 * without a page reload.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2, DollarSign, Bell, Palette, Save,
  Loader2, Wrench, CheckCircle2,
} from "lucide-react";
import { useSettings, useUpdateSettings } from "../../../hooks/useSettings";
import { useAppSettings } from "../../../lib/settings-context";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle,
} from "../../../components/ui/card";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Separator } from "../../../components/ui/separator";
import type { SystemSettings } from "../../../types/settings";

export const Route = createFileRoute("/_auth/settings/system")({
  component: SystemSettingsPage,
});

const CURRENCIES = [
  { value: "USD", label: "USD ($) — US Dollar" },
  { value: "EUR", label: "EUR (€) — Euro" },
  { value: "GBP", label: "GBP (£) — British Pound" },
  { value: "CAD", label: "CAD ($) — Canadian Dollar" },
  { value: "AUD", label: "AUD ($) — Australian Dollar" },
  { value: "KES", label: "KES (KSh) — Kenyan Shilling" },
  { value: "NGN", label: "NGN (₦) — Nigerian Naira" },
] as const;

const DATE_FORMATS = [
  { value: "ISO", label: "ISO (2026-03-03)" },
  { value: "US",  label: "US (03/03/2026)" },
  { value: "EU",  label: "EU (03.03.2026)" },
] as const;

const THEMES = [
  { value: "system", label: "System Default" },
  { value: "light",  label: "Light Mode" },
  { value: "dark",   label: "Dark Mode" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LIVE PREVIEW  — shows unsaved formatting changes before the admin saves
// ─────────────────────────────────────────────────────────────────────────────

function FormatPreview({ currency, dateFormat, distanceUnit }: {
  currency: string; dateFormat: string; distanceUnit: string;
}) {
  const sampleDate = new Date("2026-03-05");

  const currencyStr = new Intl.NumberFormat("en-US", {
    style: "currency", currency,
  }).format(12345.67);

  const dateStr = (() => {
    if (dateFormat === "US") return sampleDate.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    if (dateFormat === "EU") return sampleDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    return sampleDate.toISOString().slice(0, 10);
  })();

  const distStr = distanceUnit === "mi"
    ? `${Math.round(350 * 0.621371).toLocaleString()} mi`
    : `350 km`;

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
        Preview (unsaved)
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
        <span><span className="text-blue-400">Currency: </span>{currencyStr}</span>
        <span><span className="text-blue-400">Date: </span>{dateStr}</span>
        <span><span className="text-blue-400">Distance: </span>{distStr}</span>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function SystemSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  // useAppSettings reads the same RQ cache — reflects the SAVED state
  // and automatically updates everywhere after a save.
  const { formatCurrency, formatAppDate, formatDist } = useAppSettings();

  const [draft, setDraft] = useState<Partial<SystemSettings>>({});
  const current = { ...settings, ...draft } as SystemSettings;
  const hasChanges = Object.keys(draft).length > 0;

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await updateMutation.mutateAsync(draft);
    // useUpdateSettings.onSuccess calls queryClient.setQueryData(SETTINGS_KEY, data)
    // → SettingsProvider sees new data → rebuilds formatters → app updates everywhere
    setDraft({});
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="System Settings"
        subtitle="Configure global fleet management preferences"
        actions={
          hasChanges ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft({})}>Discard</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          ) : null
        }
      />

      {/* Success feedback */}
      {updateMutation.isSuccess && !hasChanges && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">
            Settings saved — currency, dates, distances, and theme are now
            updated across the entire app.
          </AlertDescription>
        </Alert>
      )}

      {/* Current saved state — driven by useAppSettings (reflects live cache) */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Currently Applied Across the App
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="text-muted-foreground">Currency: </span>{formatCurrency(12345.67)}</span>
          <span><span className="text-muted-foreground">Date: </span>{formatAppDate(new Date())}</span>
          <span><span className="text-muted-foreground">Distance: </span>{formatDist(350)}</span>
        </div>
      </div>

      {/* ── ORGANIZATION ─────────────────────────────────────────────────── */}
      <Section icon={Building2} title="Organization" description="Company details and regional settings">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={current.orgName ?? ""}
                onChange={(e) => set("orgName", e.target.value || null)}
                placeholder="Your Fleet Company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={current.orgTimezone ?? "UTC"}
                onChange={(e) => set("orgTimezone", e.target.value)}
                placeholder="e.g. Africa/Nairobi"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={current.dateFormat} onValueChange={(v) => set("dateFormat", v as SystemSettings["dateFormat"])}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── FINANCIAL ────────────────────────────────────────────────────── */}
      <Section icon={DollarSign} title="Financial" description="Currency and unit preferences — affect all cost and distance displays across the app">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select value={current.currency} onValueChange={(v) => set("currency", v as SystemSettings["currency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuel Unit</Label>
              <Select value={current.fuelUnit} onValueChange={(v) => set("fuelUnit", v as SystemSettings["fuelUnit"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="liters">Liters</SelectItem>
                  <SelectItem value="gallons">Gallons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Distance Unit</Label>
              <Select value={current.distanceUnit} onValueChange={(v) => set("distanceUnit", v as SystemSettings["distanceUnit"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Kilometers</SelectItem>
                  <SelectItem value="mi">Miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live preview — only visible while the admin has unsaved changes */}
          {hasChanges && (
            <FormatPreview
              currency={current.currency}
              dateFormat={current.dateFormat}
              distanceUnit={current.distanceUnit}
            />
          )}
        </div>
      </Section>

      {/* ── OPERATIONAL ──────────────────────────────────────────────────── */}
      <Section icon={Wrench} title="Operational Alerts" description="Warning thresholds for maintenance and compliance">
        <div className="grid gap-6 md:grid-cols-3">
          {([
            { key: "maintenanceWarningDays",    label: "Maintenance Warning" },
            { key: "licenseExpiryWarningDays",  label: "License Expiry Warning" },
            { key: "documentExpiryWarningDays", label: "Document Expiry Warning" },
          ] as const).map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={365}
                  value={current[field.key] ?? ""}
                  onChange={(e) => set(field.key, parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days before</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
      <Section icon={Bell} title="Notifications" description="Enable or disable system-wide notifications">
        <div className="space-y-4">
          {([
            { key: "emailAlertsEnabled", label: "Email Alerts",       desc: "Send email notifications for important events" },
            { key: "maintenanceAlerts",  label: "Maintenance Alerts", desc: "Notify when scheduled maintenance is due" },
            { key: "tripStatusAlerts",   label: "Trip Status Alerts", desc: "Notify on trip status changes" },
          ] as const).map((item, i, arr) => (
            <div key={item.key}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={current[item.key] ?? false}
                  onCheckedChange={(v) => set(item.key, v)}
                />
              </div>
              {i < arr.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>
      </Section>

      {/* ── APPEARANCE ───────────────────────────────────────────────────── */}
      <Section icon={Palette} title="Appearance" description="Theme applies immediately across the entire app when saved">
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={current.theme} onValueChange={(v) => set("theme", v as SystemSettings["theme"])}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {THEMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            "System Default" follows the OS dark/light preference.
          </p>
        </div>
      </Section>

      {/* Sticky bottom save bar */}
      {hasChanges && (
        <div className="sticky bottom-6 flex justify-end">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-lg">
            <p className="text-sm text-muted-foreground">Unsaved changes</p>
            <Button variant="outline" size="sm" onClick={() => setDraft({})}>Discard</Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <Save className="mr-2 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}