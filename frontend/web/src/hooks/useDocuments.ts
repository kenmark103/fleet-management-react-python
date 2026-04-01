import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { ApiResponse } from '../types/api'
import type {
  DocumentFieldVerification,
  DocumentOCRJob,
  DocumentOCRStartRequest,
} from '../types/documents'

export const documentKeys = {
  all: ['documents'] as const,
  ocr: (entityType: string, entityId: string) => ['documents', 'ocr', entityType, entityId] as const,
}

export function useDocumentOcr(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: documentKeys.ocr(entityType ?? 'missing', entityId ?? 'missing'),
    queryFn: () =>
      api
        .get<ApiResponse<DocumentOCRJob>>(`/api/v1/documents/${entityId}/ocr`, { params: { entity_type: entityType } })
        .then((r) => r.data.data),
    enabled: !!entityType && !!entityId,
    retry: false,
  })
}

export function useStartDocumentOcr(entityType: string, entityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DocumentOCRStartRequest) => api.post<ApiResponse<DocumentOCRJob>>(`/api/v1/documents/${entityId}/ocr`, body).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.ocr(entityType, entityId) })
      toast.success('OCR completed')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useVerifyDocumentFields(entityType: string, entityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { jobId: string; fields: DocumentFieldVerification[] }) =>
      api
        .patch<ApiResponse<DocumentOCRJob>>(`/api/v1/documents/${entityId}/verify-fields`, {
          fields: payload.fields,
        }, {
          params: { job_id: payload.jobId },
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.ocr(entityType, entityId) })
      toast.success('OCR fields verified')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
