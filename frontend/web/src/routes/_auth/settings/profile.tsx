/**
 * routes/_auth/settings/profile.tsx
 * Fleet Management System — Phase 8
 *
 * Available to ALL authenticated roles.
 * Sections:
 *   1. Avatar upload (click-to-upload, preview)
 *   2. Profile info: first/last name, phone  (email read-only)
 *   3. Change password  (hidden for OAuth-only accounts)
 *
 * Role badge is shown but not editable — admin only can change via /settings/users.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Save, Loader2, Eye, EyeOff, Lock, User } from "lucide-react";

import { API_BASE_URL, ROLE_COLORS, ROLE_LABELS } from "../../../lib/constants";
import type { ChangePasswordPayload, ProfileUpdatePayload, User as UserType } from "../../../types/user";
import { getInitials } from "../../../lib/utils";
import { useAuth } from "../../../lib/auth-context";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfilePage,
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CARD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-gray-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR SECTION
// ─────────────────────────────────────────────────────────────────────────────

function AvatarSection({
  profile,
  onUpdated,
}: {
  profile: UserType;
  onUpdated: (p: UserType) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB");
      return;
    }
    setError(null);
    setUploading(true);

    // Optimistic preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/settings/profile/avatar`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Upload failed");
      }
      const data = await res.json();
      onUpdated(data.data);
    } catch (e: any) {
      setError(e.message);
      setPreview(profile.avatarUrl); // revert preview
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="flex items-start gap-6">
      {/* Avatar circle */}
      <div
        className={`relative cursor-pointer ${isDragging ? "ring-4 ring-blue-300 ring-offset-2" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover ring-4 ring-gray-100"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-500 ring-4 ring-gray-50">
            {getInitials(`${profile.firstName} ${profile.lastName}`)}
          </div>
        )}
        <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 ring-2 ring-white shadow">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
          ) : (
            <Camera className="h-3.5 w-3.5 text-white" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Info */}
      <div className="pt-1">
        <p className="text-sm font-medium text-gray-700">Profile Photo</p>
        <p className="mt-0.5 text-xs text-gray-400">
          Click or drag & drop. JPEG, PNG, or WebP · max 5 MB
        </p>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        <div className="mt-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.role]}`}
          >
            {ROLE_LABELS[profile.role]}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE INFO SECTION
// ─────────────────────────────────────────────────────────────────────────────

function ProfileInfoSection({
  profile,
  onUpdated,
}: {
  profile: UserType;
  onUpdated: (p: UserType) => void;
}) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const isDirty =
    form.firstName !== profile.firstName ||
    form.lastName !== profile.lastName ||
    form.phone !== (profile.phone ?? "");

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !isDirty) return;
    setSubmitting(true);
    setApiError(null);
    setSuccess(false);
    try {
      const payload: ProfileUpdatePayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
      };
      const res = await fetch(`${API_BASE_URL}/settings/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Update failed");
      }
      const data = await res.json();
      onUpdated(data.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setApiError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-100 ${
      errors[field]
        ? "border-red-400 focus:border-red-500"
        : "border-gray-300 focus:border-blue-500"
    }`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" error={errors.firstName}>
          <input
            value={form.firstName}
            onChange={set("firstName")}
            className={inputClass("firstName")}
          />
        </Field>
        <Field label="Last Name" error={errors.lastName}>
          <input
            value={form.lastName}
            onChange={set("lastName")}
            className={inputClass("lastName")}
          />
        </Field>
      </div>

      <Field label="Email Address" hint="Email can only be changed by an administrator">
        <input
          value={profile.email}
          readOnly
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 outline-none"
        />
      </Field>

      <Field label="Phone" hint="Optional">
        <input
          value={form.phone}
          onChange={set("phone")}
          className={inputClass("phone")}
          placeholder="+254 7xx xxx xxx"
        />
      </Field>

      {apiError && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {apiError}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          Profile updated successfully
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={submitting || !isDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD SECTION
// ─────────────────────────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.currentPassword) errs.currentPassword = "Required";
    if (!form.newPassword) errs.newPassword = "Required";
    else if (form.newPassword.length < 8)
      errs.newPassword = "Min. 8 characters";
    else if (form.newPassword === form.currentPassword)
      errs.newPassword = "Must differ from current password";
    if (form.confirmPassword !== form.newPassword)
      errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    setSuccess(false);
    try {
      const payload: ChangePasswordPayload = {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      };
      const res = await fetch(
        `${API_BASE_URL}/settings/profile/change-password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Password change failed");
      }
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setApiError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-100 ${
      errors[field]
        ? "border-red-400 focus:border-red-500"
        : "border-gray-300 focus:border-blue-500"
    }`;

  const ToggleBtn = () => (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <Field label="Current Password" error={errors.currentPassword}>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={form.currentPassword}
            onChange={set("currentPassword")}
            className={inputClass("currentPassword")}
            placeholder="Enter current password"
          />
          <ToggleBtn />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="New Password" error={errors.newPassword}>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={form.newPassword}
              onChange={set("newPassword")}
              className={inputClass("newPassword")}
              placeholder="Min. 8 characters"
            />
            <ToggleBtn />
          </div>
        </Field>
        <Field label="Confirm New Password" error={errors.confirmPassword}>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              className={inputClass("confirmPassword")}
              placeholder="Repeat new password"
            />
            <ToggleBtn />
          </div>
        </Field>
      </div>

      {apiError && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {apiError}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          Password changed successfully
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleChange}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {submitting ? "Updating…" : "Update Password"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { user: authUser, setUser } = useAuth();

  const [profile, setProfile] = useState<UserType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/settings/profile`);
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data.data);
      } catch (e: any) {
        setLoadError(e.message);
      }
    })();
  }, []);

  const handleUpdate = (updated: UserType) => {
    setProfile(updated);
    // Sync to auth context so Topbar/Sidebar reflect changes immediately
    if (setUser) setUser(updated as any);
  };

  if (loadError) {
    return (
      <div className="p-6 text-center text-sm text-red-500">{loadError}</div>
    );
  }
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage your personal information and account security
        </p>
      </div>

      {/* Avatar */}
      <SectionCard
        title="Profile Photo"
        description="Click or drag & drop to update"
        icon={User}
      >
        <AvatarSection profile={profile} onUpdated={handleUpdate} />
      </SectionCard>

      {/* Profile info */}
      <SectionCard
        title="Personal Information"
        description="Update your name and phone number"
        icon={User}
      >
        <ProfileInfoSection profile={profile} onUpdated={handleUpdate} />
      </SectionCard>

      {/* Change password — only shown if account has a password */}
      <SectionCard
        title="Change Password"
        description="Update your login credentials"
        icon={Lock}
      >
        <ChangePasswordSection />
      </SectionCard>
    </div>
  );
}