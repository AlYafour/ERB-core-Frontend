import { useQueries } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { usePermissions } from '@/lib/hooks/use-permissions';

async function fetchCount(url: string, params: Record<string, unknown>): Promise<number> {
  const res = await apiClient.get(url, { params: { ...params, page: 1, page_size: 1 } });
  return res.data?.count ?? 0;
}

export interface PendingCounts {
  pr:        number;
  po:        number;
  quotation: number;
  invoice:   number;
}

export function usePendingCounts(): PendingCounts {
  const { hasPermission, isAdmin } = usePermissions();

  const canViewPR        = isAdmin || hasPermission('purchase_request',  'view');
  const canViewPO        = isAdmin || hasPermission('purchase_order',     'view');
  const canViewQuotation = isAdmin || hasPermission('purchase_quotation', 'view');
  const canViewInvoice   = isAdmin || hasPermission('purchase_invoice',   'view');

  const results = useQueries({
    queries: [
      {
        queryKey: ['pending-count', 'pr'],
        queryFn: () => fetchCount('/purchase-requests/', { status: 'pending' }),
        enabled: canViewPR,
        staleTime: 0,
        refetchInterval: canViewPR ? 60_000 : false,
      },
      {
        queryKey: ['pending-count', 'po'],
        queryFn: () => fetchCount('/purchase-orders/', { status: 'pending' }),
        enabled: canViewPO,
        staleTime: 0,
        refetchInterval: canViewPO ? 60_000 : false,
      },
      {
        queryKey: ['pending-count', 'quotation'],
        queryFn: () => fetchCount('/purchase-quotations/', { status: 'pending' }),
        enabled: canViewQuotation,
        staleTime: 0,
        refetchInterval: canViewQuotation ? 60_000 : false,
      },
      {
        queryKey: ['pending-count', 'invoice'],
        queryFn: () => fetchCount('/purchase-invoices/', { status: 'pending' }),
        enabled: canViewInvoice,
        staleTime: 0,
        refetchInterval: canViewInvoice ? 60_000 : false,
      },
    ],
  });

  return {
    pr:        results[0].data ?? 0,
    po:        results[1].data ?? 0,
    quotation: results[2].data ?? 0,
    invoice:   results[3].data ?? 0,
  };
}
