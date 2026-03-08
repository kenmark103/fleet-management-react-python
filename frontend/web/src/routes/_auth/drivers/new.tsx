/**
 * routes/_auth/drivers/new.tsx
 * Fleet Management System — Phase 4 (revised Phase 8)
 *
 * ADMIN-only. Creates both User (role=DRIVER) + Driver profile atomically
 * via POST /drivers. No user_id required — the backend generates it.
 *
 * Sections:
 *   Identity       first/last name, email, phone
 *   Employment     hire date, status
 *   License        number, class, expiry
 *   Personal       DOB, national ID, address
 *   Emergency      contact name + phone
 *   Account        temp password (user changes on first login)
 *   Notes          freeform
 */

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, UserPlus, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { usePermission } from "../../../hooks/usePermission";
// ✅ Use the hook — goes through the api axios instance (correct baseURL +
//    withCredentials + interceptors) instead of raw fetch with API_BASE_URL.
import { useCreateDriver } from "../../../hooks/useDrivers";

export const Route = createFileRoute("/_auth/drivers/new")({
  component: NewDriverPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
      {title}
    </h2>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  // Identity
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  // Employment
  status:                "active" | "inactive";
  hireDate:              string;
  // License
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;
  // Personal
  dateOfBirth:           string;
  nationalId:            string;
  address:               string;
  // Emergency
  emergencyContactName:  string;
  emergencyContactPhone: string;
  // Account
  tempPassword:          string;
  confirmPassword:       string;
  // Notes
  notes:                 string;
}

const EMPTY: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  status: "active", hireDate: "",
  licenseNumber: "", licenseClass: "", licenseExpiryDate: "",
  dateOfBirth: "", nationalId: "", address: "",
  emergencyContactName: "", emergencyContactPhone: "",
  tempPassword: "", confirmPassword: "",
  notes: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function NewDriverPage() {
  const { can } = usePermission();
  const navigate = useNavigate();

  // ✅ Hook must be called unconditionally (Rules of Hooks).
  //    The permission guard renders below after the hook call.
  const createDriver = useCreateDriver();

  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [errors,     setErrors]     = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPass,   setShowPass]   = useState(false);

  if (!can("drivers:create")) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const setSelect =
    (field: keyof FormState) => (val: string) =>
      setForm((f) => ({ ...f, [field]: val }));

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};

    if (!form.firstName.trim())         e.firstName         = "Required";
    if (!form.lastName.trim())          e.lastName          = "Required";
    if (!form.email.trim())             e.email             = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                        e.email             = "Enter a valid email";
    if (!form.phone.trim())             e.phone             = "Required";
    if (!form.hireDate)                 e.hireDate          = "Required";
    if (!form.licenseNumber.trim())     e.licenseNumber     = "Required";
    if (!form.licenseClass.trim())      e.licenseClass      = "Required";
    if (!form.licenseExpiryDate)        e.licenseExpiryDate = "Required";
    if (!form.tempPassword)             e.tempPassword      = "Required";
    else if (form.tempPassword.length < 8)
                                        e.tempPassword      = "Min. 8 characters";
    if (form.confirmPassword !== form.tempPassword)
                                        e.confirmPassword   = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      firstName:             form.firstName.trim(),
      lastName:              form.lastName.trim(),
      email:                 form.email.trim(),
      phone:                 form.phone.trim(),
      status:                form.status,
      hireDate:              new Date(form.hireDate).toISOString(),
      licenseNumber:         form.licenseNumber.trim(),
      licenseClass:          form.licenseClass.trim(),
      licenseExpiryDate:     new Date(form.licenseExpiryDate).toISOString(),
      tempPassword:          form.tempPassword,
      // Optional fields — only include if filled
      ...(form.dateOfBirth                  && { dateOfBirth:           new Date(form.dateOfBirth).toISOString() }),
      ...(form.nationalId.trim()            && { nationalId:            form.nationalId.trim() }),
      ...(form.address.trim()               && { address:               form.address.trim() }),
      ...(form.emergencyContactName.trim()  && { emergencyContactName:  form.emergencyContactName.trim() }),
      ...(form.emergencyContactPhone.trim() && { emergencyContactPhone: form.emergencyContactPhone.trim() }),
      ...(form.notes.trim()                 && { notes:                 form.notes.trim() }),
    };

    // ✅ Navigate immediately on success — don't wait for query invalidation
    //    to finish. The list re-fetches in the background (useCreateDriver's
    //    onSuccess invalidates driverKeys.lists() + driverKeys.summary()).
    //    This is what makes the Docker UX feel snappy instead of hanging.
    createDriver.mutate(payload, {
      onSuccess: () => navigate({ to: "/drivers" }),
    });
  };

  const inputCls = (field: keyof FormState) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/drivers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add New Driver</h1>
          <p className="text-sm text-muted-foreground">
            Creates a driver profile and login account in one step
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card divide-y">

        {/* ── Identity ───────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Identity" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required error={errors.firstName}>
              <Input value={form.firstName} onChange={set("firstName")} className={inputCls("firstName")} placeholder="James" />
            </Field>
            <Field label="Last Name" required error={errors.lastName}>
              <Input value={form.lastName} onChange={set("lastName")} className={inputCls("lastName")} placeholder="Mwangi" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email Address" required error={errors.email}>
              <Input type="email" value={form.email} onChange={set("email")} className={inputCls("email")} placeholder="james@company.com" />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <Input value={form.phone} onChange={set("phone")} className={inputCls("phone")} placeholder="+254 7xx xxx xxx" />
            </Field>
          </div>
        </div>

        {/* ── Employment ─────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Employment" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status" required>
              <Select value={form.status} onValueChange={setSelect("status")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hire Date" required error={errors.hireDate}>
              <Input type="date" value={form.hireDate} onChange={set("hireDate")} className={inputCls("hireDate")} />
            </Field>
          </div>
        </div>

        {/* ── License ────────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="License" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="License Number" required error={errors.licenseNumber}>
              <Input value={form.licenseNumber} onChange={set("licenseNumber")} className={inputCls("licenseNumber")} placeholder="DL-123456" />
            </Field>
            <Field label="License Class" required error={errors.licenseClass}>
              <Input value={form.licenseClass} onChange={set("licenseClass")} className={inputCls("licenseClass")} placeholder="Class CE" />
            </Field>
          </div>
          <Field label="Expiry Date" required error={errors.licenseExpiryDate}>
            <Input type="date" value={form.licenseExpiryDate} onChange={set("licenseExpiryDate")} className={`max-w-xs ${inputCls("licenseExpiryDate")}`} />
          </Field>
        </div>

        {/* ── Personal ───────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Personal (optional)" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth">
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
            <Field label="National ID">
              <Input value={form.nationalId} onChange={set("nationalId")} placeholder="ID number" />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={set("address")} placeholder="Street, City" />
          </Field>
        </div>

        {/* ── Emergency Contact ──────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Emergency Contact (optional)" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <Input value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder="Full name" />
            </Field>
            <Field label="Contact Phone">
              <Input value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="+254 7xx xxx xxx" />
            </Field>
          </div>
        </div>

        {/* ── Account / Temp Password ────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Login Account" />
          <p className="text-sm text-muted-foreground">
            A login account will be created with the email above and role{" "}
            <span className="font-medium text-foreground">Driver</span>.
            Set a temporary password — the driver should change it on first login.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Temporary Password" required error={errors.tempPassword}>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={form.tempPassword}
                  onChange={set("tempPassword")}
                  className={`pr-10 ${inputCls("tempPassword")}`}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password" required error={errors.confirmPassword}>
              <Input
                type={showPass ? "text" : "password"}
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                className={inputCls("confirmPassword")}
                placeholder="Repeat password"
              />
            </Field>
          </div>
        </div>

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Notes (optional)" />
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Any additional notes about this driver…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* API error — sourced from the mutation now */}
      {createDriver.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {createDriver.error?.message ?? "Failed to create driver"}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to="/drivers">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={createDriver.isPending}>
          <UserPlus className="h-4 w-4 mr-2" />
          {createDriver.isPending ? "Creating…" : "Create Driver"}
        </Button>
      </div>
    </div>
  );
}