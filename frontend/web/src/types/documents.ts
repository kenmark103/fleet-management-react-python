export interface ExtractedDocumentField {
  id: string
  fieldName: string
  fieldValue: string
  confidence?: number | null
  verified: boolean
}

export interface DocumentVerificationIssue {
  id: string
  issueType: string
  severity: string
  message: string
}

export interface DocumentOCRJob {
  id: string
  documentType: string
  entityType: string
  entityId: string
  fileUrl: string
  status: string
  processor: string
  extractedText?: string | null
  startedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
  createdAt: string
  fields: ExtractedDocumentField[]
  issues: DocumentVerificationIssue[]
}

export interface DocumentOCRStartRequest {
  documentType: string
  entityType: string
  entityId?: string
  fileUrl: string
}

export interface DocumentFieldVerification {
  fieldName: string
  fieldValue: string
}
