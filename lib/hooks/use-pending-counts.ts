import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { usePermissions } from '@/lib/hooks/use-permissions';

export interface PendingCounts {
  pr:        number;
  qr:        number;
  quotation: number;
  po:        number;
  grn:       number;
  invoice:   number;
}

const ZERO: PendingCounts = { pr: 0, qr: 0, quotation: 0, po: 0, grn: 0, invoice: 0 };

async function fetchPendingCounts(): Promise<PendingCounts> {
  const res = await apiClient.get('/purchase-requests/pending-counts/');
  return res.data as PendingCounts;
}

export function usePendingCounts(): PendingCounts {
  const { hasPermission, isAdmin, isLoading: permLoading } = usePermissions();
  const canView = isAdmin || hasPermission('purchase_request', 'view');
  const enabled = !permLoading && canView;

  const { data } = useQuery({
    queryKey: ['pending-counts'],
    queryFn: fetchPendingCounts,
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? 60_000 : false,
  });

  return data ?? ZERO;
}
