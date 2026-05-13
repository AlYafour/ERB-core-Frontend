import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { getWSManager } from './use-websocket-manager';

/**
 * Listens for new_notification messages on the shared WebSocket connection.
 * No separate socket is opened — shares the manager created by useRealtimeUpdates.
 */
export function useWebSocketNotifications(
  onNotification: (notification: any) => void,
) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.id) return;

    const manager = getWSManager();
    // connect is idempotent — safe to call even if already connected
    manager.connect(user.id);

    const unsub = manager.subscribe('notifications', (message) => {
      if (message.type === 'new_notification' && message.notification) {
        onNotification(message.notification);
      }
    });

    return unsub;
  }, [user?.id, onNotification]);

  return { isConnected: true };
}
