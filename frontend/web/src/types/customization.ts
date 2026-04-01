export interface DashboardWidgetConfig {
  key: string
  title: string
  type: string
}

export interface DashboardPreferences {
  userId: string
  dashboardTemplateId?: string | null
  widgets: DashboardWidgetConfig[]
  layout: Record<string, unknown>
  updatedAt: string
}

export interface DashboardTemplate {
  id: string
  name: string
  description?: string | null
  widgetsJson: Record<string, unknown>
  layoutJson: Record<string, unknown>
  isDefault: boolean
}

export interface SavedReportWidget {
  key: string
  title: string
  type: string
}

export interface SavedReport {
  id: string
  name: string
  description?: string | null
  reportType: string
  filtersJson: Record<string, unknown>
  widgetConfigJson: SavedReportWidget[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ReportWidgetConfig {
  id: string
  name: string
  key: string
  category: string
  description?: string | null
  configJson: Record<string, unknown>
}
