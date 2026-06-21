'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import type { Notification } from '@/types';
import { useWebSocketNotifications } from '@/lib/hooks/use-websocket';
import { toast, confirm } from '@/lib/hooks/use-toast';
import Link from 'next/link';
import { Button, Loader, PageHeader, PageShell, WorkspaceSurface } from '@/components/ui';

const getNotificationIcon = (type: string) => {
  if (type.includes('approved')) {
    return (
      <svg style={{ width: 20, height: 20, color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (type.includes('rejected') || type.includes('deleted')) {
    return (
      <svg style={{ width: 20, height: 20, color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (type.includes('created')) {
    return (
      <svg style={{ width: 20, height: 20, color: 'var(--brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    );
  }
  return (
    <svg style={{ width: 20, height: 20, color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
};

const getNotificationLink = (notification: Notification): string | null => {
  if (!notification.related_object_type || !notification.related_object_id) {
    return null;
  }

  const type = notification.related_object_type;
  const id = notification.related_object_id;

  switch (type) {
    case 'purchase_request':
      return `/purchase-requests/${id}`;
    case 'quotation_request':
      return `/quotation-requests/${id}`;
    case 'purchase_quotation':
      return `/purchase-quotations/${id}`;
    case 'product':
      return `/products/view/${id}`;
    case 'supplier':
      return `/suppliers/view/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'task':
      return `/tasks/${id}`;
    case 'hr_request':
      return `/hr/requests/${id}`;
    case 'hr_payroll':
      return `/hr/payroll/${id}`;
    case 'user':
      return `/users/${id}`;
    default:
      return null;
  }
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const queryClient = useQueryClient();

  // Real-time WebSocket notifications
  useWebSocketNotifications((notification) => {
    // Invalidate queries to refresh notifications
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', page, filter],
    queryFn: () => notificationsApi.getAll({
      page,
      is_read: filter === 'unread' ? false : undefined,
    }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('Notification marked as read', 'success');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('All notifications marked as read', 'success');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('All notifications cleared', 'success');
    },
  });

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = async () => {
    markAllAsReadMutation.mutate();
  };

  const handleClearAll = async () => {
    const confirmed = await confirm('Are you sure you want to clear all notifications?');
    if (confirmed) {
      clearAllMutation.mutate();
    }
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Notifications"
          description="Stay updated with all system activities."
          count={data?.count ?? null}
          breadcrumbs={[{ label: 'Notifications' }]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead} isLoading={markAllAsReadMutation.isPending}>
                Mark All Read
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearAll} isLoading={clearAllMutation.isPending}>
                Clear All
              </Button>
            </div>
          }
        />

        <WorkspaceSurface
          toolbar={
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'unread'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    border: filter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: filter === f ? 'var(--primary)' : 'transparent',
                    color: filter === f ? 'var(--primary-foreground)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {f === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
          }
        >
          {isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading notifications...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '32px 16px' }}>
              <p style={{ color: 'var(--color-error)', fontSize: 14 }}>Error loading notifications. Please try again.</p>
            </div>
          ) : !data?.results?.length ? (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No notifications found</p>
            </div>
          ) : (
            <div>
              {data.results.map((notification: Notification, idx: number) => {
                const link = getNotificationLink(notification);
                const isUnread = !notification.is_read;
                const content = (
                  <div
                    onClick={() => { if (isUnread) handleMarkAsRead(notification.id); }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '14px 16px',
                      borderBottom: idx < data.results.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: isUnread ? 'color-mix(in srgb, var(--primary) 4%, transparent)' : 'transparent',
                      cursor: isUnread ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: isUnread ? 600 : 500, color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0 }}>
                            {notification.title}
                          </p>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                            {notification.message}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, opacity: 0.7 }}>
                            {new Date(notification.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 5 }} />}
                      </div>
                    </div>
                  </div>
                );
                return link
                  ? <Link key={notification.id} href={link} style={{ display: 'block', textDecoration: 'none' }}>{content}</Link>
                  : <div key={notification.id}>{content}</div>;
              })}

              {data.count > 50 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {((page - 1) * 50) + 1}–{Math.min(page * 50, data.count)} of {data.count}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!data.previous || page === 1}>Previous</Button>
                    <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={!data.next}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}

