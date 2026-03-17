/**
 * routes/accept-invite.tsx
 * PUBLIC route — no auth required.
 *
 * Flow:
 *   1. Reads ?token= from URL
 *   2. GET /auth/invite-info to validate token + prefill name/email
 *   3. User confirms name, adds phone, sets password
 *   4. POST /auth/accept-invite → account activated
 *   5. Redirect to /login with success message
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import api          from "../lib/api";
import type { InviteInfo, AcceptInvitePayload } from "../types/user";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePage,
});

type PageState = "loading" | "ready" | "invalid" | "success";

function AcceptInvitePage() {
  const navigate = useNavigate();
  const token    = new URLSearchParams(window.location.search).get("token") ?? "";

  const [state,     setState]     = useState<PageState>("loading");
  const [info,      setInfo]      = useState<InviteInfo | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Validate token on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    api.get<InviteInfo>(`/auth/invite-info?token=${token}`)
      .then(r => {
        setInfo(r.data);
        setFirstName(r.data.firstName);
        setLastName(r.data.lastName);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim())  errs.lastName  = "Required";
    if (!password)         errs.password  = "Required";
    else if (password.length < 8) errs.password = "Minimum 8 characters";
    if (confirm !== password)     errs.confirm  = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post<AcceptInvitePayload>("/auth/accept-invite", {
        token,
        password,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        phone:     phone.trim() || undefined,
      });
      setState("success");
      setTimeout(() => navigate({ to: "/login" }), 3000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSubmitError(
        Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(", ")
          : detail ?? "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shell ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">FleetMS</span>
          </div>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Validating your invite…</p>
          </div>
        )}

        {/* Invalid token */}
        {state === "invalid" && (
          <div className="rounded-xl border bg-card p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <h1 className="text-lg font-semibold">Invalid or expired link</h1>
            <p className="text-sm text-muted-foreground">
              This invite link is no longer valid. It may have expired or already been used.
              Contact your fleet administrator for a new invite.
            </p>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="rounded-xl border bg-card p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-lg font-semibold">Account activated!</h1>
            <p className="text-sm text-muted-foreground">
              Welcome to FleetMS, {firstName}. Redirecting you to login…
            </p>
            <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
              Go to Login
            </Button>
          </div>
        )}

        {/* Form */}
        {state === "ready" && info && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-6 border-b">
              <h1 className="text-xl font-semibold">Accept your invite</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You've been invited as a <strong>{info.role}</strong>.
                Confirm your details and set a password to get started.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Email — read only */}
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={info.email} readOnly
                  className="bg-muted text-muted-foreground cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here — contact your admin if incorrect.
                </p>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className={errors.firstName ? "border-destructive" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className={errors.lastName ? "border-destructive" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label>Phone <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+254 7xx xxx xxx"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label>Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              {/* Confirm */}
              <div className="space-y-1.5">
                <Label>Confirm Password <span className="text-destructive">*</span></Label>
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className={errors.confirm ? "border-destructive" : ""}
                />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
              </div>

              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activating account…</>
                  : "Activate my account"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}