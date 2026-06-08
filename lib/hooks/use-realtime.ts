import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { getWSManager } from './use-websocket-manager';

interface RealtimeEvent {
  type: string;
  event_type: string;
  model_type: string;
  action: 'created' | 'updated' | 'deleted';
  data: any;
}

export function useRealtimeUpdates() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const manager = getWSManager();
    manager.connect(user.id);

    const unsub = manager.subscribe('realtime', (message) => {
      if (message.type !== 'realtime_update' || !message.event) return;
      const ev: RealtimeEvent = message.event;

      switch (ev.event_type) {
        case 'purchase_request':
          queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
          if (ev.action !== 'deleted')
            queryClient.setQueryData(['purchase-requests', ev.data?.id], ev.data);
          break;
        case 'quotation_request':
          queryClient.invalidateQueries({ queryKey: ['quotation-requests'] });
          if (ev.action !== 'deleted')
            queryClient.setQueryData(['quotation-requests', ev.data?.id], ev.data);
          break;
        case 'purchase_quotation':
          queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
          queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
          if (ev.action !== 'deleted')
            queryClient.setQueryData(['purchase-quotations', ev.data?.id], ev.data);
          break;
        case 'purchase_order':
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
          queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
          if (ev.action !== 'deleted')
            queryClient.setQueryData(['purchase-orders', ev.data?.id], ev.data);
          break;
        case 'product':
          queryClient.invalidateQueries({ queryKey: ['products'] });
          if (ev.action === 'deleted')
            queryClient.removeQueries({ queryKey: ['products', ev.data?.id] });
          else
            queryClient.setQueryData(['products', ev.data?.id], ev.data);
          break;
        case 'supplier':
          queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          if (ev.action === 'deleted')
            queryClient.removeQueries({ queryKey: ['suppliers', ev.data?.id] });
          else
            queryClient.setQueryData(['suppliers', ev.data?.id], ev.data);
          break;
      }
    });

    return unsub;
  }, [user?.id, queryClient]);
}
