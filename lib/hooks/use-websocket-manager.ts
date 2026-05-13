'use client';

/**
 * Singleton WebSocket manager — one connection per user session.
 * Both realtime updates and notifications share this single socket.
 */

type MessageHandler = (data: any) => void;

interface WSManager {
  subscribe: (id: string, handler: MessageHandler) => () => void;
  connect: (userId: number) => void;
  disconnect: () => void;
}

function buildWsUrl(userId: number): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:9000/api';
  const apiHost = apiUrl.replace('/api', '').replace('http://', '').replace('https://', '');
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsBase = (process.env.NEXT_PUBLIC_WS_URL || `${wsProtocol}//${apiHost}`).replace(/\/ws\/?$/, '');
  return `${wsBase}/ws/notifications/${userId}/`;
}

function createManager(): WSManager {
  let ws: WebSocket | null = null;
  let currentUserId: number | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxAttempts = 0;
  let active = false;
  const handlers = new Map<string, MessageHandler>();

  function dispatch(data: any) {
    handlers.forEach((h) => {
      try { h(data); } catch { /* ignore handler errors */ }
    });
  }

  function scheduleReconnect() {
    if (!active || reconnectAttempts >= maxAttempts || !currentUserId) return;
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectTimer = setTimeout(() => {
      if (active && currentUserId) open(currentUserId);
    }, delay);
  }

  function open(userId: number) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    if (ws) { try { ws.close(1000, 'Reconnecting'); } catch { /* ignore */ } ws = null; }

    try {
      const url = buildWsUrl(userId);
      ws = new WebSocket(url);

      ws.onopen = () => { reconnectAttempts = 0; };
      ws.onmessage = (e) => { try { dispatch(JSON.parse(e.data)); } catch { /* ignore */ } };
      ws.onerror = () => { /* reconnect handled in onclose */ };
      ws.onclose = (ev) => { ws = null; if (ev.code !== 1000) scheduleReconnect(); };
    } catch { /* ignore */ }
  }

  return {
    subscribe(id, handler) {
      handlers.set(id, handler);
      return () => handlers.delete(id);
    },
    connect(userId) {
      active = true;
      currentUserId = userId;
      reconnectAttempts = 0;
      open(userId);
    },
    disconnect() {
      active = false;
      currentUserId = null;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) { try { ws.close(1000, 'User logged out'); } catch { /* ignore */ } ws = null; }
      handlers.clear();
    },
  };
}

const WS_ENABLED = process.env.NEXT_PUBLIC_WS_ENABLED === 'true';

const noopManager: WSManager = {
  subscribe: () => () => {},
  connect: () => {},
  disconnect: () => {},
};

let manager: WSManager | null = null;
export function getWSManager(): WSManager {
  if (!WS_ENABLED) return noopManager;
  if (!manager) manager = createManager();
  return manager;
}
