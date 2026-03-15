/**
 * routes/_auth/settings/profile.tsx
 * Fleet Management System — Phase 8
 *
 * Available to ALL authenticated roles.
 * Sections:
 *   1. Avatar upload (click-to-upload or drag-and-drop, optimistic preview)
 *   2. Profile info: first/last name, phone  (email read-only)
 *   3. Change password  (hidden for OAuth-only accounts)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Save, Loader2, Eye, EyeOff, Lock, User } from "lucide-react";
import { toast } from "sonner";

//  All API calls go through the shared axios instance (correct baseURL,
//    withCredentials, token-refresh interceptor).
import apiClient from "../../../lib/api";
import { ROLE_COLORS, ROLE_LABELS } from "../../../lib/constants";
import type {
  ChangePasswordPayload,
  ProfileUpdatePayload,
  User as UserType,
} from "../../../types/user";
import { getInitials, getStaticUrl }  from "../../../lib/utils";
import { useAuth }      from "../../../lib/auth-context";
import { Button }    from "../../../components/ui/button";
import { Input }     from "../../../components/ui/input";
import { Label }     from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import type { ApiResponse } from "../../../types/api";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfilePage,
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

const profileKeys = {
  detail: ["settings", "profile"] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SECTION WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title:        string;
  description?: string;
  icon:         React.ElementType;
  children:     React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
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
  label:    string;
  error?:   string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint  && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
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
  profile:   UserType;
  onUpdated: (p: UserType) => void;
}) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const [preview,   setPreview]   = useState<string | null>(getStaticUrl(profile.avatarUrl));
  const [isDragging, setIsDragging] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      // Clear Content-Type so axios re-detects FormData and sets the correct
      // multipart/form-data boundary. Without this, a global JSON interceptor
      // on the axios instance stomps the boundary and the backend gets a 422.
      return apiClient
        .post<ApiResponse<UserType>>("/api/v1/settings/profile/avatar", fd, {
          headers: { "Content-Type": undefined },
        })
        .then(r => r.data.data);
    },
    onSuccess: (updated) => {
      onUpdated(updated);
      setPreview(getStaticUrl(updated.avatarUrl));
      toast.success("Profile photo updated");
      setError(null);
    },
    onError: (e: any) => {
      // FastAPI 422 detail is an array of {loc, msg, type} objects — not a string.
      // Rendering an object directly in JSX causes React error #31.
      // Flatten to a readable string here so setError always receives a string.
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(", ")
        : (typeof detail === "string" ? detail : e.message ?? "Upload failed");
      setError(msg);
      setPreview(getStaticUrl(profile.avatarUrl)); // revert optimistic preview
    },
  });

  const handleFile = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB");
      return;
    }
    setError(null);
    // Optimistic preview before upload completes
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    uploadMutation.mutate(file);
  };

  return (
    <div className="flex items-start gap-6">
      {/* Avatar circle */}
      <div
        className={`relative cursor-pointer ${isDragging ? "ring-4 ring-ring ring-offset-2" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover ring-4 ring-muted"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground ring-4 ring-muted/50">
            {getInitials(`${profile.firstName} ${profile.lastName}`)}
          </div>
        )}
        <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-foreground ring-2 ring-background shadow">
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-background" />
          ) : (
            <Camera className="h-3.5 w-3.5 text-background" />
          )}
        </div>
        <Input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>

      <div className="pt-1 space-y-2">
        <p className="text-sm font-medium">Profile Photo</p>
        <p className="text-xs text-muted-foreground">
          Click or drag &amp; drop · JPEG, PNG, WebP · max 5 MB
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.role]}`}
        >
          {ROLE_LABELS[profile.role]}
        </span>
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
  profile:   UserType;
  onUpdated: (p: UserType) => void;
}) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName:  profile.lastName,
    phone:     profile.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const isDirty =
    form.firstName !== profile.firstName ||
    form.lastName  !== profile.lastName  ||
    form.phone     !== (profile.phone ?? "");

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim())  errs.lastName  = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: (payload: ProfileUpdatePayload) =>
      apiClient
        .patch<ApiResponse<UserType>>("/api/v1/settings/profile", payload)
        .then(r => r.data.data),
    onSuccess: (updated) => {
      onUpdated(updated);
      toast.success("Profile updated successfully");
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? e.message ?? "Update failed");
    },
  });

  const handleSave = () => {
    if (!validate() || !isDirty) return;
    updateMutation.mutate({
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      phone:     form.phone.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" error={errors.firstName}>
          <Input
            value={form.firstName}
            onChange={set("firstName")}
            className={errors.firstName ? "border-destructive" : ""}
          />
        </Field>
        <Field label="Last Name" error={errors.lastName}>
          <Input
            value={form.lastName}
            onChange={set("lastName")}
            className={errors.lastName ? "border-destructive" : ""}
          />
        </Field>
      </div>

      <Field label="Email Address" hint="Email can only be changed by an administrator">
        <Input value={profile.email} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
      </Field>

      <Field label="Phone" hint="Optional">
        <Input
          value={form.phone}
          onChange={set("phone")}
          placeholder="+254 7xx xxx xxx"
        />
      </Field>

      <div className="flex justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !isDirty}
        >
          {updateMutation.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            : <><Save className="mr-2 h-4 w-4" />Save Changes</>
          }
        </Button>
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
    newPassword:     "",
    confirmPassword: "",
  });
  const [show,   setShow]   = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.currentPassword)         errs.currentPassword = "Required";
    if (!form.newPassword)             errs.newPassword     = "Required";
    else if (form.newPassword.length < 8)
      errs.newPassword = "Min. 8 characters";
    else if (form.newPassword === form.currentPassword)
      errs.newPassword = "Must differ from current password";
    if (form.confirmPassword !== form.newPassword)
      errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const changeMutation = useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      apiClient
        .patch<ApiResponse<object>>("/api/v1/settings/profile/change-password", payload)
        .then(r => r.data),
    onSuccess: () => {
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
      toast.success("Password changed successfully");
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? e.message ?? "Password change failed");
    },
  });

  const handleChange = () => {
    if (!validate()) return;
    changeMutation.mutate({
      currentPassword: form.currentPassword,
      newPassword:     form.newPassword,
    });
  };

  const ToggleBtn = () => (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <Field label="Current Password" error={errors.currentPassword}>
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={form.currentPassword}
            onChange={set("currentPassword")}
            placeholder="Enter current password"
            className={errors.currentPassword ? "border-destructive pr-10" : "pr-10"}
          />
          <ToggleBtn />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="New Password" error={errors.newPassword}>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={form.newPassword}
              onChange={set("newPassword")}
              placeholder="Min. 8 characters"
              className={errors.newPassword ? "border-destructive pr-10" : "pr-10"}
            />
            <ToggleBtn />
          </div>
        </Field>
        <Field label="Confirm New Password" error={errors.confirmPassword}>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Repeat new password"
              className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
            />
            <ToggleBtn />
          </div>
        </Field>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleChange} disabled={changeMutation.isPending}>
          {changeMutation.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
            : <><Lock className="mr-2 h-4 w-4" />Update Password</>
          }
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { setUser } = useAuth();
  const qc          = useQueryClient();

  // ✅ useQuery replaces the raw fetch-in-useEffect pattern — benefits from
  //    the shared cache, staleTime, and the axios interceptor.
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: profileKeys.detail,
    queryFn:  () =>
      apiClient
        .get<ApiResponse<UserType>>("/api/v1/settings/profile")
        .then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const handleUpdate = (updated: UserType) => {
    // Update the query cache directly so re-fetches return the new data
    qc.setQueryData(profileKeys.detail, updated);
    // Sync into auth context so Topbar/Sidebar reflect the change immediately
    setUser(updated as any);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        Failed to load profile. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your personal information and account security
        </p>
      </div>

      <SectionCard
        title="Profile Photo"
        description="Click or drag & drop to update"
        icon={User}
      >
        <AvatarSection profile={profile} onUpdated={handleUpdate} />
      </SectionCard>

      <SectionCard
        title="Personal Information"
        description="Update your name and phone number"
        icon={User}
      >
        <ProfileInfoSection profile={profile} onUpdated={handleUpdate} />
      </SectionCard>

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