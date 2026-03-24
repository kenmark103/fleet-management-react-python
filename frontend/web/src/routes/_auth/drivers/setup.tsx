/**
 * routes/_auth/drivers/setup.tsx
 * Fleet Management System
 *
 * Driver self-service profile setup.
 * Shown to DRIVER accounts that have no driver_profile yet.
 *
 * Uses DriverCreate (with userId) — NOT the removed DriverAdminCreate.
 * userId is populated from the current authenticated user.
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Loader2, CheckCircle2, AlertCircle, ChevronRight,
  ClipboardList, UserCircle, Phone,
} from "lucide-react";
import { Button }    from "../../../components/ui/button";
import { Input }     from "../../../components/ui/input";
import { Label }     from "../../../components/ui/label";
import { Textarea }  from "../../../components/ui/textarea";
import { Separator } from "../../../components/ui/separator";
import { useAuth }         from "../../../lib/auth-context";
import { useCreateDriver } from "../../../hooks/useDrivers";
import type { DriverCreate } from "../../../types/driver";

export const Route = createFileRoute("/_auth/drivers/setup")({
  component: DriverSetupPage,
});

type Step = "intro" | "personal" | "license" | "emergency" | "done";

interface FormState {
  phone: string; licenseNumber: string; licenseClass: string;
  licenseExpiryDate: string; hireDate: string; dateOfBirth: string;
  nationalId: string; address: string;
  emergencyContactName: string; emergencyContactPhone: string; notes: string;
}

const EMPTY: FormState = {
  phone: "", licenseNumber: "", licenseClass: "",
  licenseExpiryDate: "", hireDate: "", dateOfBirth: "",
  nationalId: "", address: "",
  emergencyContactName: "", emergencyContactPhone: "", notes: "",
};

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const STEPS = [
  { id: "personal" as Step,  label: "Personal" },
  { id: "license" as Step,   label: "License" },
  { id: "emergency" as Step, label: "Emergency" },
];

function StepIndicator({ current }: { current: Step }) {
  const active = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            i < active ? "bg-primary text-primary-foreground" :
            i === active ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
            "bg-muted text-muted-foreground"
          }`}>
            {i < active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`hidden sm:block ml-2 text-sm ${i === active ? "font-medium" : "text-muted-foreground"}`}>
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`w-8 sm:w-16 h-px mx-2 sm:mx-3 ${i < active ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function DriverSetupPage() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const createDriver = useCreateDriver();

  const [step,   setStep]   = useState<Step>("intro");
  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  if (user?.role !== "DRIVER") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="font-medium">This page is only for drivers.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Go to Dashboard</Button>
      </div>
    );
  }

  const set = (f: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }));

  const cls = (f: keyof FormState) => errors[f] ? "border-destructive" : "";

  const validatePersonal = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.phone.trim()) e.phone    = "Required";
    if (!form.hireDate)     e.hireDate = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const validateLicense = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.licenseNumber.trim())  e.licenseNumber     = "Required";
    if (!form.licenseClass.trim())   e.licenseClass      = "Required";
    if (!form.licenseExpiryDate)     e.licenseExpiryDate = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const next = (validate?: () => boolean) => {
    if (validate && !validate()) return;
    setErrors({});
    if (step === "personal")  setStep("license");
    if (step === "license")   setStep("emergency");
  };

  const back = () => {
    if (step === "license")   setStep("personal");
    if (step === "emergency") setStep("license");
  };

  const handleSubmit = async () => {
    // DriverCreate — userId is the current user's own ID
    const payload: DriverCreate = {
      userId:    user!.id,
      firstName: user!.firstName,
      lastName:  user!.lastName,
      email:     user!.email,
      phone:     form.phone.trim(),
      status:    "active",
      licenseNumber:     form.licenseNumber.trim(),
      licenseClass:      form.licenseClass.trim(),
      licenseExpiryDate: new Date(form.licenseExpiryDate).toISOString(),
      hireDate:          new Date(form.hireDate).toISOString(),
      ...(form.dateOfBirth           && { dateOfBirth:           new Date(form.dateOfBirth).toISOString() }),
      ...(form.nationalId.trim()     && { nationalId:            form.nationalId.trim() }),
      ...(form.address.trim()        && { address:               form.address.trim() }),
      ...(form.emergencyContactName.trim()  && { emergencyContactName:  form.emergencyContactName.trim() }),
      ...(form.emergencyContactPhone.trim() && { emergencyContactPhone: form.emergencyContactPhone.trim() }),
      ...(form.notes.trim()          && { notes:                 form.notes.trim() }),
    };
    try {
      await createDriver.mutateAsync(payload);
      setStep("done");
    } catch { /* useCreateDriver shows toast.error */ }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Complete your driver profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is ready. Add your license and contact details so dispatchers can assign you to trips.
        </p>
      </div>

      {step === "intro" && (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <div className="space-y-4">
            {[
              { icon: UserCircle,    title: "Personal details",  desc: "Phone, date of birth, address" },
              { icon: ClipboardList, title: "License info",       desc: "License number, class, and expiry" },
              { icon: Phone,         title: "Emergency contact",  desc: "Name and phone of emergency contact" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Takes about 2 minutes</p>
            <Button onClick={() => setStep("personal")}>Get started <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {!["intro", "done"].includes(step) && (
        <div className="rounded-xl border bg-card px-6 py-4"><StepIndicator current={step} /></div>
      )}

      {step === "personal" && (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-medium">Personal details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>First Name</Label>
              <Input value={user?.firstName ?? ""} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" /></div>
            <div className="space-y-1.5"><Label>Last Name</Label>
              <Input value={user?.lastName ?? ""} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" /></div>
          </div>
          <Field label="Phone Number" required error={errors.phone} hint="Include country code, e.g. +254 7xx xxx xxx">
            <Input value={form.phone} onChange={set("phone")} className={cls("phone")} placeholder="+254 700 000 000" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Hire Date" required error={errors.hireDate}>
              <Input type="date" value={form.hireDate} onChange={set("hireDate")} className={cls("hireDate")} />
            </Field>
            <Field label="Date of Birth" hint="Optional">
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
          </div>
          <Field label="National ID" hint="Optional">
            <Input value={form.nationalId} onChange={set("nationalId")} placeholder="ID or passport number" />
          </Field>
          <Field label="Home Address" hint="Optional">
            <Textarea value={form.address} onChange={set("address")} rows={2} placeholder="Street, City, Country" />
          </Field>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button onClick={() => next(validatePersonal)}>Next: License <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {step === "license" && (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-medium">License information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="License Number" required error={errors.licenseNumber}>
              <Input value={form.licenseNumber} onChange={set("licenseNumber")} className={cls("licenseNumber")} placeholder="DL-0000000" />
            </Field>
            <Field label="License Class" required error={errors.licenseClass} hint="e.g. Class CE">
              <Input value={form.licenseClass} onChange={set("licenseClass")} className={cls("licenseClass")} placeholder="Class CE" />
            </Field>
          </div>
          <Field label="License Expiry Date" required error={errors.licenseExpiryDate}>
            <Input type="date" value={form.licenseExpiryDate} onChange={set("licenseExpiryDate")} className={`max-w-xs ${cls("licenseExpiryDate")}`} />
          </Field>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            You can upload a scan of your license from your profile page after setup.
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t">
            <Button variant="outline" onClick={back}>Back</Button>
            <Button onClick={() => next(validateLicense)}>Next: Emergency Contact <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {step === "emergency" && (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <h2 className="font-medium">Emergency contact <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span></h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name"><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder="Jane Doe" /></Field>
            <Field label="Contact Phone"><Input value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="+254 700 000 001" /></Field>
          </div>
          <Field label="Notes" hint="Languages spoken, special requirements…">
            <Textarea value={form.notes} onChange={set("notes")} rows={2} />
          </Field>
          <div className="flex justify-between gap-3 pt-2 border-t">
            <Button variant="outline" onClick={back}>Back</Button>
            <Button onClick={handleSubmit} disabled={createDriver.isPending}>
              {createDriver.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Complete Setup"}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-lg font-semibold">You're all set, {user?.firstName}!</h1>
          <p className="text-sm text-muted-foreground">
            Your driver profile is complete. You can upload your license document from your profile page at any time.
          </p>
          <Button className="w-full" onClick={() => navigate({ to: "/dashboard" })}>Go to Dashboard</Button>
        </div>
      )}
    </div>
  );
}