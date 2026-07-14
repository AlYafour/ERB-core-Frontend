import apiClient from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ColumnSpec {
  key: string;
  label: string;
  field_type: 'string' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean' | 'choice';
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  aggregatable: boolean;
  choices: string[];
  sensitive: boolean;
}

export interface ReportSource {
  key: string;
  label: string;
  columns: ColumnSpec[];
}

export interface FilterSpec {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'between' | 'is_null';
  value: unknown;
}

export interface AggregationSpec {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  column: string;
  alias?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  source_label: string;
  columns: string[];
  filters: FilterSpec[];
  sort_by: string[];
  group_by: string[];
  aggregations: AggregationSpec[];
  is_built_in: boolean;
  is_active: boolean;
  version: number;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedule {
  id: string;
  report: string;
  report_name: string;
  cron_expression: string;
  timezone: string;
  export_format: string;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
}

export interface ReportExecution {
  id: string;
  report: string;
  report_name: string;
  triggered_by: number | null;
  triggered_by_username: string | null;
  triggered_via: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  parameters: Record<string, unknown>;
  row_count: number | null;
  truncated: boolean;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string;
  task_id: string;
  idempotency_key: string;
  created_at: string;
}

export interface ReportResult {
  columns: { key: string; label: string; field_type: string }[];
  rows: Record<string, unknown>[];
  total_count: number;
  page: number;
  page_size: number;
  truncated: boolean;
  summaries: Record<string, unknown>;
}

export interface DashboardWidget {
  id: string;
  name: string;
  widget_type: 'count' | 'sum' | 'avg' | 'table';
  source: string;
  metric_field: string;
  filters: FilterSpec[];
  is_active: boolean;
  order: number;
}

export interface KpiResult {
  id: string;
  name: string;
  value: number | null;
  error?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Sources ────────────────────────────────────────────────────────────────

export const getSources = () =>
  apiClient.get<ReportSource[]>('/reporting/sources/').then((r) => r.data);

export const getSourceColumns = (sourceKey: string) =>
  apiClient.get<ColumnSpec[]>(`/reporting/sources/${sourceKey}/columns`).then((r) => r.data);

// ── Definitions ────────────────────────────────────────────────────────────

export const getReportDefinitions = (params?: Record<string, string>) =>
  apiClient
    .get<PaginatedResponse<ReportDefinition>>('/reporting/definitions/', { params })
    .then((r) => r.data);

export const getReportDefinition = (id: string) =>
  apiClient.get<ReportDefinition>(`/reporting/definitions/${id}/`).then((r) => r.data);

export const createReportDefinition = (data: Partial<ReportDefinition>) =>
  apiClient.post<ReportDefinition>('/reporting/definitions/', data).then((r) => r.data);

export const updateReportDefinition = (id: string, data: Partial<ReportDefinition>) =>
  apiClient.put<ReportDefinition>(`/reporting/definitions/${id}/`, data).then((r) => r.data);

export const deleteReportDefinition = (id: string) =>
  apiClient.delete(`/reporting/definitions/${id}/`);

// ── Preview / Export / Run ─────────────────────────────────────────────────

export const previewReport = (
  id: string,
  params?: {
    parameters?: Record<string, unknown>;
    columns?: string[];
    filters?: FilterSpec[];
    sort_by?: string[];
    group_by?: string[];
    aggregations?: AggregationSpec[];
    page?: number;
    page_size?: number;
  }
) =>
  apiClient.post<ReportResult>(`/reporting/definitions/${id}/preview/`, params || {}).then((r) => r.data);

export const exportReport = (
  id: string,
  exportFormat: 'csv' | 'xlsx',
  params?: Record<string, unknown>
) =>
  apiClient
    .post(
      `/reporting/definitions/${id}/export/`,
      { export_format: exportFormat, ...(params || {}) },
      { responseType: 'blob' }
    )
    .then((r) => r.data as Blob);

export const runReport = (id: string, params?: Record<string, unknown>) =>
  apiClient
    .post<ReportExecution>(`/reporting/definitions/${id}/run/`, params || {})
    .then((r) => r.data);

export const getReportExecutions = (id: string) =>
  apiClient
    .get<ReportExecution[]>(`/reporting/definitions/${id}/executions/`)
    .then((r) => r.data);

// ── Schedules ──────────────────────────────────────────────────────────────

export const getSchedules = () =>
  apiClient.get<PaginatedResponse<ReportSchedule>>('/reporting/schedules/').then((r) => r.data);

export const createSchedule = (data: Partial<ReportSchedule>) =>
  apiClient.post<ReportSchedule>('/reporting/schedules/', data).then((r) => r.data);

export const updateSchedule = (id: string, data: Partial<ReportSchedule>) =>
  apiClient.put<ReportSchedule>(`/reporting/schedules/${id}/`, data).then((r) => r.data);

export const deleteSchedule = (id: string) =>
  apiClient.delete(`/reporting/schedules/${id}/`);

// ── Executions ─────────────────────────────────────────────────────────────

export const getAllExecutions = (params?: Record<string, string>) =>
  apiClient
    .get<PaginatedResponse<ReportExecution>>('/reporting/executions/', { params })
    .then((r) => r.data);

// ── Widgets & KPIs ─────────────────────────────────────────────────────────

export const getWidgets = () =>
  apiClient.get<PaginatedResponse<DashboardWidget>>('/reporting/widgets/').then((r) => r.data);

export const createWidget = (data: Partial<DashboardWidget>) =>
  apiClient.post<DashboardWidget>('/reporting/widgets/', data).then((r) => r.data);

export const getKpis = () =>
  apiClient.get<KpiResult[]>('/reporting/widgets/kpi/').then((r) => r.data);

// ── Helpers ────────────────────────────────────────────────────────────────

export function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
