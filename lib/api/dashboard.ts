import apiClient from './client';

export interface DashboardStats {
  purchaseRequests: { total: number; pending: number; approved: number; rejected: number };
  quotationRequests: { total: number; pending: number; completed: number };
  suppliers: { total: number };
  products: { total: number };
  purchaseOrders: { total: number; pending: number; approved: number; rejected: number; completed: number };
  goodsReceiving: { total: number };
  invoices: { total: number; pending: number; approved: number; paid: number };
}

export interface ProjectAnalytics {
  id: number;
  name: string;
  code: string;
  totalSpending: number;
  poCount: number;
  progress: number;
}

export interface UserActivity {
  id: number;
  username: string;
  createdPR: number;
  approvedRequests: number;
  createdPO: number;
  createdInvoices: number;
}

export interface ProcurementCycleMetrics {
  avgPRToPO: number;
  avgPOToGRN: number;
  avgGRNToInvoice: number;
  bottlenecks: Array<{ stage: string; avgDays: number; count: number }>;
}

export interface ChartData {
  monthlyProcurement: Array<{ month: string; volume: number; count: number }>;
  monthlyInvoices: Array<{ month: string; count: number; amount: number }>;
  projectSpending: Array<{ project: string; spending: number }>;
  supplierComparison: Array<{ supplier: string; poCount: number; totalAmount: number }>;
  statusDistribution: {
    purchaseRequests: { pending: number; approved: number; rejected: number };
    purchaseOrders: { pending: number; approved: number; rejected: number; completed: number };
    invoices: { pending: number; approved: number; paid: number };
  };
}

export interface RecentActivity {
  id: number;
  type: 'purchase_request' | 'quotation' | 'purchase_order' | 'grn' | 'invoice';
  action: 'created' | 'approved' | 'rejected' | 'paid';
  title: string;
  user: string;
  timestamp: string;
  link: string;
}

export interface DashboardCombined {
  stats: DashboardStats;
  chartData: ChartData;
  recentActivity: RecentActivity[];
  userActivity: UserActivity[];
  projectAnalytics: ProjectAnalytics[];
  cycleMetrics: ProcurementCycleMetrics;
}

export const dashboardApi = {
  getCombined: (): Promise<DashboardCombined> =>
    apiClient.get('/dashboard/combined/').then(r => r.data),

  // Legacy individual endpoints (kept for fallback/direct use)
  getStats: (): Promise<DashboardStats> =>
    apiClient.get('/dashboard/stats/').then(r => r.data),
  getProjectAnalytics: (): Promise<ProjectAnalytics[]> =>
    apiClient.get('/dashboard/project-analytics/').then(r => r.data),
  getRecentActivity: (): Promise<RecentActivity[]> =>
    apiClient.get('/dashboard/recent-activity/').then(r => r.data),
  getUserActivity: (): Promise<UserActivity[]> =>
    apiClient.get('/dashboard/user-activity/').then(r => r.data),
  getProcurementCycleMetrics: (): Promise<ProcurementCycleMetrics> =>
    apiClient.get('/dashboard/cycle-metrics/').then(r => r.data),
  getChartData: (): Promise<ChartData> =>
    apiClient.get('/dashboard/chart-data/').then(r => r.data),
};
