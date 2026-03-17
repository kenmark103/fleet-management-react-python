/**
 * components/forms/UserForm.tsx
 * Fleet Management System — Phase 8
 *
 * Shared form used by:
 *   /settings/users/new
 *   /settings/users/$userId/edit
 *
 * - Mode detection via presence of `initial` prop
 * - Driver role shows contextual warning with link to Drivers module
 * - Password fields only appear in create mode
 * - isActive toggle only appears in edit mode (and only if not editing yourself)
 */

import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Loader2, AlertTriangle, Info, UserX, UserCheck, Mail } from "lucide-react";
import { Button }   from "../ui/button";
import { Input }    from "../ui/input";
import { Label }    from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { Separator } from "../ui/separator";
import { USER_ROLES, ROLE_LABELS } from "../../lib/constants";
import type { UserRole } from "../../lib/constants";
import type { User, UserCreatePayload, UserUpdatePayload } from "../../types/user";

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface UserFormProps {
  /** Present in edit mode — undefined in create mode */
  initial?:    User;
  /** Whether the form is editing the currently logged-in user */
  isSelf?:     boolean;
  onSubmit:    (data: UserCreatePayload | UserUpdatePayload) => Promise<void>;
  isLoading:   boolean;
}

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
  label:     string;
  required?: boolean;
  error?:    string;
  hint?:     string;
  children:  React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM
// ─────────────────────────────────────────────────────────────────────────────

export function UserForm({ initial, isSelf = false, onSubmit, isLoading }: UserFormProps) {
  const navigate   = useNavigate();
  const isEditMode = Boolean(initial);

  const [firstName,  setFirstName]  = useState(initial?.firstName ?? "");
  const [lastName,   setLastName]   = useState(initial?.lastName  ?? "");
  const [email,      setEmail]      = useState(initial?.email     ?? "");
  const [role,       setRole]       = useState<UserRole>(initial?.role ?? "DRIVER");
  const [phone,      setPhone]      = useState(initial?.phone     ?? "");
  const [isActive,   setIsActive]   = useState(initial?.isActive  ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim())  errs.lastName  = "Required";
    if (!email.trim())     errs.email     = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditMode) {
      await onSubmit({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim(),
        role,
        phone:     phone.trim() || undefined,
        isActive,
      } as UserUpdatePayload);
    } else {
      await onSubmit({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim(),
        role,
        phone:     phone.trim() || undefined,
      } as UserCreatePayload);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── IDENTITY ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Identity
          </h3>
          <Separator className="mt-2" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" required error={errors.firstName}>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="James"
              className={errors.firstName ? "border-destructive" : ""}
            />
          </Field>

          <Field label="Last Name" required error={errors.lastName}>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Mwangi"
              className={errors.lastName ? "border-destructive" : ""}
            />
          </Field>

          <Field label="Email Address" required error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="james@company.com"
              className={errors.email ? "border-destructive" : ""}
            />
          </Field>

          <Field label="Phone" hint="Optional">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7xx xxx xxx"
            />
          </Field>
        </div>
      </section>

      {/* ── ROLE ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Role & Permissions
          </h3>
          <Separator className="mt-2" />
        </div>

        <Field
          label="Role"
          required
          hint={isSelf ? "You cannot change your own role" : undefined}
        >
          <Select
            value={role}
            onValueChange={(v) => setRole(v as UserRole)}
            disabled={isSelf}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* DRIVER role advisory */}
        {role === "DRIVER" && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              Driver accounts work best when created through the{" "}
              <Link
                to="/drivers/new"
                className="font-semibold underline underline-offset-2 hover:text-amber-900"
              >
                Drivers module
              </Link>
              , which also sets up the driver profile — licence details, vehicle
              assignment, and compliance records. Creating a user here will grant
              system access but will not create a driver profile.
            </AlertDescription>
          </Alert>
        )}

        {/* General role info for non-driver roles */}
        {role !== "DRIVER" && (
          <Alert className="border-blue-100 bg-blue-50 text-blue-700">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Role determines which modules and actions this user can access.
              {!isSelf && " This can be changed later from the Users list."}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* ── INVITE NOTICE  (create mode only) ───────────────────────────── */}
      {!isEditMode && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Account Setup
            </h3>
            <Separator className="mt-2" />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-sm leading-relaxed">
              An invite email will be sent to <strong>{email || "the user's email"}</strong>.
              They'll set their own password when they accept the invite.
              The link expires in <strong>7 days</strong>.
            </p>
          </div>
        </section>
      )}

      {/* ── ACCOUNT STATUS  (edit mode, not self) ────────────────────────── */}
      {isEditMode && !isSelf && (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Account Status
            </h3>
            <Separator className="mt-2" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">
                Account {isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "This user can log in and access the system"
                  : "This user cannot log in until reactivated"}
              </p>
            </div>
            <Button
              type="button"
              variant={isActive ? "destructive" : "outline"}
              size="sm"
              onClick={() => setIsActive((v) => !v)}
              className="gap-1.5"
            >
              {isActive
                ? <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
            </Button>
          </div>
        </section>
      )}

      {/* ── ACTIONS ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/settings/users" })}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}