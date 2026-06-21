'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import type { Notification } from '@/types';
import { useWebSocketNotifications } from '@/lib/hooks/use-websocket';
import Link from 'next/link';

const getNotificationIcon = (type: string) => {
  if (type.includes('approved')) {
    return '✓';
  }
  if (type.includes('rejected') || type.includes('deleted')) {
    return '✕';
  }
  if (type.includes('created')) {
    return '+';
  }
  return '•';
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
    case 'user':
      return `/users/${id}`;
    case 'municipal_violation':
      return `/violations/resolve/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'task':
      return `/tasks/${id}`;
    case 'hr_request':
      return `/hr/requests/${id}`;
    case 'hr_payroll':
      return `/hr/payroll/${id}`;
    default:
      return null;
  }
};

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Real-time WebSocket notifications
  useWebSocketNotifications((notification) => {
    // Invalidate queries to refresh notifications
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
      });
    }
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => notificationsApi.getAll({ page: 1, is_read: false }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    setIsOpen(false);
  };

  const count = unreadCount?.count || 0;
  const recentNotifications = notifications?.results?.slice(0, 5) || [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-md transition-all duration-200"
        style={{ 
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span 
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: 'var(--color-error)',
              color: '#FFFFFF',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 z-50 overflow-hidden flex flex-col transition-all duration-200"
          style={{
            width: '380px',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Top Bar */}
          <div 
            className="px-4 py-3 flex items-center justify-between"
            style={{
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            <h3 
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Notifications
            </h3>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium transition-opacity duration-200"
              style={{ 
                color: 'var(--color-orange-500)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              View all
            </Link>
          </div>

          {/* Notifications List */}
          <div 
            className="overflow-y-auto flex-1"
            style={{ maxHeight: '400px' }}
          >
            {recentNotifications.length === 0 ? (
              <div 
                className="px-4 py-8 text-center text-sm"
                style={{ color: 'var(--text-tertiary)' }}
              >
                No new notifications
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                {recentNotifications.map((notification: Notification) => {
                  const link = getNotificationLink(notification);
                  const content = (
                    <div
                      className="px-4 py-3 cursor-pointer transition-colors duration-200"
                      style={{
                        backgroundColor: notification.is_read 
                          ? 'transparent' 
                          : 'var(--bg-tertiary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = notification.is_read 
                          ? 'transparent' 
                          : 'var(--bg-tertiary)';
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p 
                            className="text-sm font-medium mb-1"
                            style={{ 
                              color: 'var(--text-primary)',
                            }}
                          >
                            {notification.title}
                          </p>
                          <p 
                            className="text-xs mb-1.5 leading-relaxed"
                            style={{ 
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {notification.message}
                          </p>
                          <p 
                            className="text-[10px]"
                            style={{ 
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {new Date(notification.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div 
                            className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                            style={{
                              backgroundColor: 'var(--color-orange-500)',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );

                  if (link) {
                    return (
                      <Link key={notification.id} href={link}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={notification.id}>{content}</div>;
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
