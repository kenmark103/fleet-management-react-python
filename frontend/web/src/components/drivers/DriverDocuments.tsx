/**
 * components/drivers/DriverDocuments.tsx
 * Fleet Management System — Phase 4
 *
 * Changes:
 *   - Sheet redesigned: header with icon + description, border divider,
 *     padded scrollable body, sticky footer with action buttons.
 *   - Document list cards replace plain list items — cleaner visual hierarchy.
 *   - Expiry status shown as a coloured badge instead of inline text.
 */

import { useState } from "react";
import {
  useDriverDocuments,
  useUploadDriverDocument,
  useDeleteDriverDocument,
} from "../../hooks/useDrivers";
import { useDocumentOcr, useStartDocumentOcr } from "../../hooks/useDocuments";
import type { DriverDocumentCreate, DriverDocumentType } from "../../types/driver";
import { usePermission } from "../../hooks/usePermission";
import { ConfirmDialog } from "../atoms/ConfirmDialog";
import { Button }        from "../ui/button";
import { Input }         from "../ui/input";
import { Label }         from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "../ui/sheet";
import { Badge }         from "../ui/badge";
import { Separator }     from "../ui/separator";
import {
  FileText, Trash2, Upload, ExternalLink, FilePlus, AlertCircle, Clock,
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import { cn }          from "../../lib/utils";

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
// UPLOAD FORM (lives inside Sheet)
// ─────────────────────────────────────────────────────────────────────────────

function UploadDocumentForm({
  driverId,
  onSuccess,
  onCancel,
}: {
  driverId:  string;
  onSuccess: () => void;
  onCancel:  () => void;
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
      await upload.mutateAsync({ ...form, expiryDate: form.expiryDate || undefined });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        <div className="space-y-1.5">
          <Label>Document Type <span className="text-destructive">*</span></Label>
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
          <Label>File Name <span className="text-destructive">*</span></Label>
          <Input
            required
            value={form.fileName}
            onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))}
            placeholder="license_front.pdf"
          />
        </div>

        <div className="space-y-1.5">
          <Label>File URL <span className="text-destructive">*</span></Label>
          <Input
            required
            value={form.fileUrl}
            onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))}
            placeholder="https://storage.example.com/…"
          />
          <p className="text-xs text-muted-foreground">
            Direct link to the uploaded file.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Expiry Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            type="date"
            value={form.expiryDate?.split("T")[0] ?? ""}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                expiryDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              }))
            }
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="px-6 py-4 border-t bg-background flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={upload.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={upload.isPending || !form.fileName || !form.fileUrl}
        >
          {upload.isPending ? "Uploading…" : "Upload Document"}
        </Button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DriverDocuments({ driverId }: { driverId: string }) {
  const { data, isLoading, isError } = useDriverDocuments(driverId);
  const deleteDoc = useDeleteDriverDocument(driverId);
  const ocrJob = useDocumentOcr("driver", driverId);
  const startOcr = useStartDocumentOcr("driver", driverId);
  const { can }   = usePermission();

  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null);

  if (isLoading) return (
    <div className="py-12 text-center text-muted-foreground text-sm">Loading documents…</div>
  );

  if (isError) return (
    <div className="py-12 text-center text-destructive text-sm">Failed to load documents.</div>
  );

  const docs = data?.data ?? [];
  const now  = Date.now();

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </p>
        {can("drivers:upload-documents") && (
          <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />Upload
          </Button>
        )}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FilePlus className="h-6 w-6 opacity-50" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs mt-0.5">Upload a license, medical certificate, or other document.</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const expDate     = doc.expiryDate ? new Date(doc.expiryDate).getTime() : null;
            const isExpired   = expDate ? expDate < now : false;
            const expiringSoon = expDate && !isExpired
              ? expDate < now + 30 * 24 * 60 * 60 * 1000
              : false;

            return (
              <li
                key={doc.id}
                className="flex items-start gap-4 rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isExpired    ? "bg-destructive/10"  :
                  expiringSoon ? "bg-amber-100 dark:bg-amber-950/30" :
                                 "bg-primary/10",
                )}>
                  <FileText className={cn(
                    "h-4 w-4",
                    isExpired    ? "text-destructive"          :
                    expiringSoon ? "text-amber-600"            :
                                   "text-primary",
                  )} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {DOC_TYPE_LABELS[doc.type]}
                    </Badge>
                    {expDate && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs",
                        isExpired    ? "text-destructive font-medium" :
                        expiringSoon ? "text-amber-600"               :
                                       "text-muted-foreground",
                      )}>
                        {isExpired    ? <AlertCircle className="h-3 w-3" /> :
                         expiringSoon ? <Clock       className="h-3 w-3" /> : null}
                        {isExpired ? "Expired " : expiringSoon ? "Expires soon · " : "Expires "}
                        {formatDate(doc.expiryDate!)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded {formatDate(doc.uploadedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" title="Open file">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  {can("drivers:upload-documents") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startOcr.mutate({ documentType: doc.type, entityType: "driver", entityId: driverId, fileUrl: doc.fileUrl })}
                      disabled={startOcr.isPending}
                      title="Run OCR"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  {can("drivers:upload-documents") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(doc.id)}
                      title="Delete document"
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

      {ocrJob.data && (
        <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">OCR Extraction</p>
              <p className="text-xs text-muted-foreground">
                Latest processor: {ocrJob.data.processor} � Status: {ocrJob.data.status}
              </p>
            </div>
            {startOcr.isPending && <span className="text-xs text-muted-foreground">Processing...</span>}
          </div>

          {ocrJob.data.fields.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {ocrJob.data.fields.map((field: { id: string; fieldName: string; fieldValue: string }) => (
                <div key={field.id} className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.fieldName}</p>
                  <p className="mt-1 text-sm font-medium">{field.fieldValue}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run OCR on a document to extract fields like license number, expiry, and verification issues.
            </p>
          )}

          {ocrJob.data.issues.length > 0 && (
            <div className="space-y-2">
              {ocrJob.data.issues.map((issue: { id: string; message: string }) => (
                <div key={issue.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Sheet ──────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0 overflow-hidden">

          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">Upload Document</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  Attach a license, medical, contract, or other file.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Separator />

          <UploadDocumentForm
            driverId={driverId}
            onSuccess={() => setSheetOpen(false)}
            onCancel={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

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



