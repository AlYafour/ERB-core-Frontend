import apiClient from './client';
import { purchaseRequestsApi } from './purchase-requests';
import { purchaseQuotationsApi } from './purchase-quotations';
import { purchaseOrdersApi } from './purchase-orders';
import { goodsReceivingApi } from './goods-receiving';
import { purchaseInvoicesApi } from './purchase-invoices';
import { suppliersApi } from './suppliers';
import { productsApi } from './products';
import { projectsApi } from './projects';
import { quotationRequestsApi } from './quotation-requests';
import { usersApi } from './users';

export interface DashboardStats {
  purchaseRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  quotationRequests: {
    total: number;
    pending: number;
    completed: number;
  };
  suppliers: {
    total: number;
  };
  products: {
    total: number;
  };
  purchaseOrders: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
  };
  goodsReceiving: {
    total: number;
  };
  invoices: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
  };
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
  avgPRToPO: number; // days
  avgPOToGRN: number; // days
  avgGRNToInvoice: number; // days
  bottlenecks: Array<{
    stage: string;
    avgDays: number;
    count: number;
  }>;
}

export interface ChartData {
  monthlyProcurement: Array<{
    month: string;
    volume: number;
    count: number;
  }>;
  monthlyInvoices: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  projectSpending: Array<{
    project: string;
    spending: number;
  }>;
  supplierComparison: Array<{
    supplier: string;
    poCount: number;
    totalAmount: number;
  }>;
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

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    // Fetch all data in parallel
    const [
      purchaseRequests,
      quotationRequests,
      suppliers,
      products,
      purchaseOrders,
      goodsReceiving,
      invoices,
    ] = await Promise.all([
      purchaseRequestsApi.getAll({ page: 1, page_size: 1 }),
      quotationRequestsApi.getAll({ page: 1, page_size: 1 }),
      suppliersApi.getAll({ page: 1, page_size: 1 }),
      productsApi.getAll({ page: 1, page_size: 1 }),
      purchaseOrdersApi.getAll({ page: 1, page_size: 1 }),
      goodsReceivingApi.getAll({ page: 1, page_size: 1 }),
      purchaseInvoicesApi.getAll({ page: 1, page_size: 1 }),
    ]);

    // Get status counts
    const prPending = await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'pending' });
    const prApproved = await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'approved' });
    const prRejected = await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'rejected' });

    const qrPending = await quotationRequestsApi.getAll({ page: 1, page_size: 1, status: 'pending' });
    const qrCompleted = await quotationRequestsApi.getAll({ page: 1, page_size: 1, status: 'completed' });

    const poPending = await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'pending' });
    const poApproved = await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'approved' });
    const poRejected = await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'rejected' });
    const poCompleted = await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'completed' });

    const invPending = await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'pending' });
    const invApproved = await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'approved' });
    const invPaid = await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'paid' });

    return {
      purchaseRequests: {
        total: purchaseRequests.count || 0,
        pending: prPending.count || 0,
        approved: prApproved.count || 0,
        rejected: prRejected.count || 0,
      },
      quotationRequests: {
        total: quotationRequests.count || 0,
        pending: qrPending.count || 0,
        completed: qrCompleted.count || 0,
      },
      suppliers: {
        total: suppliers.count || 0,
      },
      products: {
        total: products.count || 0,
      },
      purchaseOrders: {
        total: purchaseOrders.count || 0,
        pending: poPending.count || 0,
        approved: poApproved.count || 0,
        rejected: poRejected.count || 0,
        completed: poCompleted.count || 0,
      },
      goodsReceiving: {
        total: goodsReceiving.count || 0,
      },
      invoices: {
        total: invoices.count || 0,
        pending: invPending.count || 0,
        approved: invApproved.count || 0,
        paid: invPaid.count || 0,
      },
    };
  },

  getProjectAnalytics: async (): Promise<ProjectAnalytics[]> => {
    const projects = await projectsApi.getAll({ page: 1, page_size: 100 });
    
    // Calculate analytics for each project
    const analytics: ProjectAnalytics[] = [];
    
    for (const project of projects.results || []) {
      const projectPRs = await purchaseRequestsApi.getAll({ 
        page: 1, 
        page_size: 1000,
        project: project.id 
      });
      
      // Get all POs and filter by project manually
      const allPOs = await purchaseOrdersApi.getAll({ 
        page: 1, 
        page_size: 1000,
      });
      
      // Filter POs that belong to this project's PRs
      const projectPRIds = (projectPRs.results || []).map(pr => pr.id);
      const projectPOs = {
        results: (allPOs.results || []).filter((po: any) => 
          projectPRIds.includes(po.purchase_request)
        ),
        count: 0,
      };
      projectPOs.count = projectPOs.results.length;

      let totalSpending = 0;
      for (const po of projectPOs.results || []) {
        totalSpending += (po as any).total || 0;
      }

      analytics.push({
        id: project.id,
        name: project.name,
        code: project.code,
        totalSpending,
        poCount: projectPOs.count || 0,
        progress: 0, // TODO: Calculate based on actual progress
      });
    }

    return analytics.sort((a, b) => b.totalSpending - a.totalSpending).slice(0, 10);
  },

  getRecentActivity: async (): Promise<RecentActivity[]> => {
    const activities: RecentActivity[] = [];
    
    // Get recent purchase requests
    const prs = await purchaseRequestsApi.getAll({ page: 1, page_size: 10 });
    for (const pr of prs.results || []) {
      activities.push({
        id: pr.id,
        type: 'purchase_request',
        action: pr.status === 'approved' ? 'approved' : pr.status === 'rejected' ? 'rejected' : 'created',
        title: pr.title || pr.code,
        user: pr.created_by_name || 'Unknown',
        timestamp: pr.created_at || '',
        link: `/purchase-requests/${pr.id}`,
      });
    }

    // Get recent purchase orders
    const pos = await purchaseOrdersApi.getAll({ page: 1, page_size: 10 });
    for (const po of pos.results || []) {
      activities.push({
        id: po.id,
        type: 'purchase_order',
        action: po.status === 'approved' ? 'approved' : po.status === 'rejected' ? 'rejected' : 'created',
        title: (po as any).order_number || `PO #${po.id}`,
        user: (po as any).created_by_name || 'Unknown',
        timestamp: (po as any).created_at || '',
        link: `/purchase-orders/${po.id}`,
      });
    }

    // Get recent invoices
    const invoices = await purchaseInvoicesApi.getAll({ page: 1, page_size: 10 });
    for (const inv of invoices.results || []) {
      activities.push({
        id: inv.id,
        type: 'invoice',
        action: inv.status === 'paid' ? 'paid' : inv.status === 'approved' ? 'approved' : 'created',
        title: inv.invoice_number,
        user: (inv as any).created_by_name || 'Unknown',
        timestamp: inv.invoice_date || '',
        link: `/purchase-invoices/${inv.id}`,
      });
    }

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  },

  getUserActivity: async (): Promise<UserActivity[]> => {
    const users = await usersApi.getAll({ page: 1, page_size: 100 });
    const activities: UserActivity[] = [];

    for (const user of users.results || []) {
      // Get user's created PRs
      const userPRs = await purchaseRequestsApi.getAll({ 
        page: 1, 
        page_size: 1000,
        created_by: user.id 
      });

      // Get approved PRs by this user
      const approvedPRs = await purchaseRequestsApi.getAll({ 
        page: 1, 
        page_size: 1000,
        approved_by: user.id,
        status: 'approved'
      });

      // Get user's created POs
      const userPOs = await purchaseOrdersApi.getAll({ 
        page: 1, 
        page_size: 1000,
        created_by: user.id 
      });

      // Get user's created invoices
      const userInvoices = await purchaseInvoicesApi.getAll({ 
        page: 1, 
        page_size: 1000,
        created_by: user.id 
      });

      const totalActivity = 
        (userPRs.count || 0) + 
        (approvedPRs.count || 0) + 
        (userPOs.count || 0) + 
        (userInvoices.count || 0);

      if (totalActivity > 0) {
        activities.push({
          id: user.id,
          username: user.username,
          createdPR: userPRs.count || 0,
          approvedRequests: approvedPRs.count || 0,
          createdPO: userPOs.count || 0,
          createdInvoices: userInvoices.count || 0,
        });
      }
    }

    return activities
      .sort((a, b) => {
        const totalA = a.createdPR + a.approvedRequests + a.createdPO + a.createdInvoices;
        const totalB = b.createdPR + b.approvedRequests + b.createdPO + b.createdInvoices;
        return totalB - totalA;
      })
      .slice(0, 10);
  },

  getProcurementCycleMetrics: async (): Promise<ProcurementCycleMetrics> => {
    // Get all POs with their PRs
    const allPOs = await purchaseOrdersApi.getAll({ page: 1, page_size: 1000 });
    const allPRs = await purchaseRequestsApi.getAll({ page: 1, page_size: 1000 });
    const allGRNs = await goodsReceivingApi.getAll({ page: 1, page_size: 1000 });
    const allInvoices = await purchaseInvoicesApi.getAll({ page: 1, page_size: 1000 });

    let totalPRToPODays = 0;
    let prToPOCount = 0;
    let totalPOToGRNDays = 0;
    let poToGRNCount = 0;
    let totalGRNToInvoiceDays = 0;
    let grnToInvoiceCount = 0;

    // Calculate PR to PO average
    for (const po of allPOs.results || []) {
      if ((po as any).purchase_request) {
        const pr = (allPRs.results || []).find((p: any) => p.id === (po as any).purchase_request);
        if (pr && pr.created_at && (po as any).created_at) {
          const prDate = new Date(pr.created_at);
          const poDate = new Date((po as any).created_at);
          const days = Math.floor((poDate.getTime() - prDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            totalPRToPODays += days;
            prToPOCount++;
          }
        }
      }
    }

    // Calculate PO to GRN average
    for (const grn of allGRNs.results || []) {
      if (grn.purchase_order_id) {
        const po = (allPOs.results || []).find((p: any) => p.id === grn.purchase_order_id);
        if (po && (po as any).created_at && grn.receipt_date) {
          const poDate = new Date((po as any).created_at);
          const grnDate = new Date(grn.receipt_date);
          const days = Math.floor((grnDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            totalPOToGRNDays += days;
            poToGRNCount++;
          }
        }
      }
    }

    // Calculate GRN to Invoice average
    for (const invoice of allInvoices.results || []) {
      if (invoice.grn_id) {
        const grn = (allGRNs.results || []).find((g: any) => g.id === invoice.grn_id);
        if (grn && grn.receipt_date && invoice.invoice_date) {
          const grnDate = new Date(grn.receipt_date);
          const invDate = new Date(invoice.invoice_date);
          const days = Math.floor((invDate.getTime() - grnDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            totalGRNToInvoiceDays += days;
            grnToInvoiceCount++;
          }
        }
      }
    }

    const bottlenecks = [
      {
        stage: 'PR → PO',
        avgDays: prToPOCount > 0 ? Math.round(totalPRToPODays / prToPOCount) : 0,
        count: prToPOCount,
      },
      {
        stage: 'PO → GRN',
        avgDays: poToGRNCount > 0 ? Math.round(totalPOToGRNDays / poToGRNCount) : 0,
        count: poToGRNCount,
      },
      {
        stage: 'GRN → Invoice',
        avgDays: grnToInvoiceCount > 0 ? Math.round(totalGRNToInvoiceDays / grnToInvoiceCount) : 0,
        count: grnToInvoiceCount,
      },
    ];

    return {
      avgPRToPO: prToPOCount > 0 ? Math.round(totalPRToPODays / prToPOCount) : 0,
      avgPOToGRN: poToGRNCount > 0 ? Math.round(totalPOToGRNDays / poToGRNCount) : 0,
      avgGRNToInvoice: grnToInvoiceCount > 0 ? Math.round(totalGRNToInvoiceDays / grnToInvoiceCount) : 0,
      bottlenecks: bottlenecks.sort((a, b) => b.avgDays - a.avgDays),
    };
  },

  getChartData: async (): Promise<ChartData> => {
    // Get all data
    const allPRs = await purchaseRequestsApi.getAll({ page: 1, page_size: 1000 });
    const allPOs = await purchaseOrdersApi.getAll({ page: 1, page_size: 1000 });
    const allInvoices = await purchaseInvoicesApi.getAll({ page: 1, page_size: 1000 });
    const allProjects = await projectsApi.getAll({ page: 1, page_size: 100 });
    const allSuppliers = await suppliersApi.getAll({ page: 1, page_size: 1000 });

    // Monthly procurement volume
    const monthlyProcurementMap = new Map<string, { volume: number; count: number }>();
    for (const pr of allPRs.results || []) {
      if (pr.created_at) {
        const date = new Date(pr.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const current = monthlyProcurementMap.get(monthKey) || { volume: 0, count: 0 };
        monthlyProcurementMap.set(monthKey, {
          volume: current.volume + 1,
          count: current.count + 1,
        });
      }
    }

    // Monthly invoices
    const monthlyInvoicesMap = new Map<string, { count: number; amount: number }>();
    for (const inv of allInvoices.results || []) {
      if (inv.invoice_date) {
        const date = new Date(inv.invoice_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const current = monthlyInvoicesMap.get(monthKey) || { count: 0, amount: 0 };
        monthlyInvoicesMap.set(monthKey, {
          count: current.count + 1,
          amount: current.amount + ((inv as any).total || 0),
        });
      }
    }

    // Project spending
    const projectSpendingMap = new Map<string, number>();
    for (const project of allProjects.results || []) {
      const projectPRs = await purchaseRequestsApi.getAll({ 
        page: 1, 
        page_size: 1000,
        project: project.id 
      });
      const projectPRIds = (projectPRs.results || []).map(pr => pr.id);
      const projectPOs = (allPOs.results || []).filter((po: any) => 
        projectPRIds.includes(po.purchase_request)
      );
      let totalSpending = 0;
      for (const po of projectPOs) {
        totalSpending += ((po as any).total || 0);
      }
      if (totalSpending > 0) {
        projectSpendingMap.set(project.name, totalSpending);
      }
    }

    // Supplier comparison
    const supplierMap = new Map<string, { poCount: number; totalAmount: number }>();
    for (const supplier of allSuppliers.results || []) {
      const supplierPOs = (allPOs.results || []).filter((po: any) => 
        po.supplier === supplier.id
      );
      let totalAmount = 0;
      for (const po of supplierPOs) {
        totalAmount += ((po as any).total || 0);
      }
      if (supplierPOs.length > 0) {
        supplierMap.set(supplier.name, {
          poCount: supplierPOs.length,
          totalAmount,
        });
      }
    }

    // Status distribution
    const prStatus = {
      pending: (await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'pending' })).count || 0,
      approved: (await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'approved' })).count || 0,
      rejected: (await purchaseRequestsApi.getAll({ page: 1, page_size: 1, status: 'rejected' })).count || 0,
    };

    const poStatus = {
      pending: (await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'pending' })).count || 0,
      approved: (await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'approved' })).count || 0,
      rejected: (await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'rejected' })).count || 0,
      completed: (await purchaseOrdersApi.getAll({ page: 1, page_size: 1, status: 'completed' })).count || 0,
    };

    const invStatus = {
      pending: (await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'pending' })).count || 0,
      approved: (await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'approved' })).count || 0,
      paid: (await purchaseInvoicesApi.getAll({ page: 1, page_size: 1, status: 'paid' })).count || 0,
    };

    return {
      monthlyProcurement: Array.from(monthlyProcurementMap.entries())
        .map(([key, value]) => {
          const [year, month] = key.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            volume: value.volume,
            count: value.count,
          };
        })
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
        .slice(-12), // Last 12 months
      monthlyInvoices: Array.from(monthlyInvoicesMap.entries())
        .map(([key, value]) => {
          const [year, month] = key.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            count: value.count,
            amount: value.amount,
          };
        })
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
        .slice(-12), // Last 12 months
      projectSpending: Array.from(projectSpendingMap.entries())
        .map(([project, spending]) => ({ project, spending }))
        .sort((a, b) => b.spending - a.spending)
        .slice(0, 10),
      supplierComparison: Array.from(supplierMap.entries())
        .map(([supplier, data]) => ({
          supplier,
          poCount: data.poCount,
          totalAmount: data.totalAmount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10),
      statusDistribution: {
        purchaseRequests: prStatus,
        purchaseOrders: poStatus,
        invoices: invStatus,
      },
    };
  },
};

