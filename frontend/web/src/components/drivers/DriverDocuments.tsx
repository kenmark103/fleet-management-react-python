/**
 * components/drivers/DriverDocuments.tsx
 * Fleet Management System — Phase 4
 *
 * Documents tab panel rendered inside DriverDetailPage.
 * Handles list, upload (ADMIN only), and delete (ADMIN only).
 */

import { useState } from "react";
import {
  useDriverDocuments,
  useUploadDriverDocument,
  useDeleteDriverDocument,
} from "../../hooks/useDrivers";
import type { DriverDocumentCreate, DriverDocumentType } from "../../types/driver";
import { usePermission } from "../../hooks/usePermission";
import { ConfirmDialog } from "../atoms/ConfirmDialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Badge } from "../ui/badge";
import { FileText, Trash2, Upload, ExternalLink } from "lucide-react";
import { formatDate} from "../../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DriverDocumentType, string> = {
  license:     "License",
  medical:     "Medical",
  contract:    "Contract",
  certificate: "Certificate",
  other:       "Other",
};

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD FORM
// ─────────────────────────────────────────────────────────────────────────────

function UploadDocumentForm({
  driverId,
  onSuccess,
}: {
  driverId: string;
  onSuccess: () => void;
}) {
  const upload = useUploadDriverDocument(driverId);
  const [form, setForm] = useState<DriverDocumentCreate>({
    type:     "license",
    fileName: "",
    fileUrl:  "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await upload.mutateAsync({
        ...form,
        expiryDate: form.expiryDate || undefined,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>Document Type *</Label>
        <Select
          value={form.type}
          onValueChange={(v) => setForm((p) => ({ ...p, type: v as DriverDocumentType }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DOC_TYPE_LABELS) as DriverDocumentType[]).map((t) => (
              <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>File Name *</Label>
        <Input
          required
          value={form.fileName}
          onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))}
          placeholder="license_front.pdf"
        />
      </div>

      <div className="space-y-1.5">
        <Label>File URL *</Label>
        <Input
          required
          value={form.fileUrl}
          onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))}
          placeholder="https://storage.example.com/…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Expiry Date</Label>
        <Input
          type="date"
          value={form.expiryDate?.split("T")[0] ?? ""}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              expiryDate: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            }))
          }
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload Document"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DriverDocuments({ driverId }: { driverId: string }) {
  const { data, isLoading, isError } = useDriverDocuments(driverId);
  const deleteDoc = useDeleteDriverDocument(driverId);
  const { can } = usePermission();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Loading documents…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-destructive text-sm">
        Failed to load documents.
      </div>
    );
  }

  const docs = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </p>
        {can("drivers:upload-documents") && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Upload Document</SheetTitle>
              </SheetHeader>
              <UploadDocumentForm
                driverId={driverId}
                onSuccess={() => setSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">No documents yet.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {docs.map((doc) => {
            const isExpired = doc.expiryDate
              ? new Date(doc.expiryDate) < new Date()
              : false;
            const expiringSoon = doc.expiryDate && !isExpired
              ? new Date(doc.expiryDate) <
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : false;

            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {DOC_TYPE_LABELS[doc.type]}
                      </Badge>
                      {doc.expiryDate && (
                        <span
                          className={`text-xs ${
                            isExpired
                              ? "text-destructive"
                              : expiringSoon
                              ? "text-yellow-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isExpired ? "Expired" : "Expires"}{" "}
                          {formatDate(new Date(doc.expiryDate), "short")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Uploaded {formatDate(new Date(doc.uploadedAt), "short")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  {can("drivers:upload-documents") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Document"
        description="This document will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        destructive
        isLoading={deleteDoc.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDoc.mutateAsync(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}