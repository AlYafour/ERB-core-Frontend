'use client';

import { useToast, removeToast } from '@/lib/hooks/use-toast';

const TOAST_STYLES: Record<string, { borderColor: string; background: string; color: string }> = {
  success: {
    borderColor: 'var(--status-success)',
    background:  'var(--status-success-bg)',
    color:       'var(--status-success)',
  },
  error: {
    borderColor: 'var(--status-error)',
    background:  'var(--status-error-bg)',
    color:       'var(--status-error)',
  },
  warning: {
    borderColor: 'var(--status-warning)',
    background:  'var(--status-warning-bg)',
    color:       'var(--status-warning)',
  },
  info: {
    borderColor: 'var(--status-info)',
    background:  'var(--status-info-bg)',
    color:       'var(--status-info)',
  },
};

export default function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--navbar-height) + 12px)',
      insetInlineEnd: 16,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 380,
      width: '100%',
    }}>
      {toasts.map((toast) => {
        const s = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info;
        return (
          <div
            key={toast.id}
            className="animate-slide-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              border: `1px solid ${s.borderColor}`,
              background: s.background,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <p style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: s.color,
              flex: 1,
              margin: 0,
            }}>
              {toast.message}
            </p>
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                style={{
                  flexShrink: 0,
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: `1px solid ${s.borderColor}`,
                  background: 'transparent',
                  color: s.color,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                padding: 4,
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: s.color,
                opacity: 0.6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
