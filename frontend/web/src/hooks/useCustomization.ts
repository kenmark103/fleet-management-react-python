import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { ApiResponse } from '../types/api'
import type {
  DashboardPreferences,
  DashboardTemplate,
  ReportWidgetConfig,
  SavedReport,
} from '../types/customization'

export const customizationKeys = {
  dashboard: ['customization', 'dashboard'] as const,
  templates: ['customization', 'dashboard-templates'] as const,
  savedReports: ['customization', 'saved-reports'] as const,
  widgetCatalog: ['customization', 'widget-catalog'] as const,
}

export function useDashboardPreferences() {
  return useQuery({
    queryKey: customizationKeys.dashboard,
    queryFn: () => api.get<ApiResponse<DashboardPreferences>>('/api/v1/settings/dashboard').then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  })
}

export function useDashboardTemplates() {
  return useQuery({
    queryKey: customizationKeys.templates,
    queryFn: () => api.get<ApiResponse<DashboardTemplate[]>>('/api/v1/settings/dashboard/templates').then((r) => r.data.data),
    staleTime: 30 * 60 * 1000,
  })
}

export function useSavedReports() {
  return useQuery({
    queryKey: customizationKeys.savedReports,
    queryFn: () => api.get<ApiResponse<SavedReport[]>>('/api/v1/reports/saved').then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateSavedReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      description?: string
      reportType: string
      filters: Record<string, unknown>
      widgets: Array<{ key: string; title: string; type: string }>
    }) =>
      api
        .post<ApiResponse<SavedReport>>('/api/v1/reports/saved', {
          name: payload.name,
          description: payload.description,
          report_type: payload.reportType,
          filters: payload.filters,
          widgets: payload.widgets,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customizationKeys.savedReports })
      toast.success('Report saved')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useWidgetCatalog() {
  return useQuery({
    queryKey: customizationKeys.widgetCatalog,
    queryFn: () => api.get<ApiResponse<ReportWidgetConfig[]>>('/api/v1/widgets/catalog').then((r) => r.data.data),
    staleTime: 30 * 60 * 1000,
  })
}
