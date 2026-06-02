'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

export interface MetricPill {
  label: string;
  value: string | number;
  variant?: 'warning' | 'success' | 'error' | 'info';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number | null;
  breadcrumbs?: Crumb[];
  backHref?: string;
  actions?: ReactNode;
  metrics?: MetricPill[];
}

const METRIC_COLOR: Record<string, string> = {
  warning: '#92400e',
  success: '#065f46',
  error:   '#991b1b',
  info:    'var(--wine-700, #6b21a8)',
};
const METRIC_BG: Record<string, string> = {
  warning: '#fef3c7',
  success: '#d1fae5',
  error:   '#fee2e2',
  info:    'var(--wine-50, #f5f3ff)',
};
const METRIC_BORDER: Record<string, string> = {
  warning: '#fde68a',
  success: '#6ee7b7',
  error:   '#fca5a5',
  info:    'var(--wine-100, #ede9fe)',
};

export default function PageHeader({
  title,
  description,
  count,
  breadcrumbs,
  backHref,
  actions,
  metrics,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <div style={{ marginBottom: 20 }}>

      {/* Breadcrumbs — outside the card */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}>
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    style={{ color: 'var(--text-disabled)', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
                  </svg>
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      textDecoration: 'none',
                      transition: 'color 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-brand)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: isLast ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontWeight: isLast ? 500 : 400,
                  }}>
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* Card container */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-shadow)',
        padding: '18px 24px',
      }}>

        {/* Back button */}
        {backHref !== undefined && (
          <button
            onClick={handleBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
              background: 'transparent', border: 'none',
              padding: '0 0 12px', cursor: 'pointer', transition: 'color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-brand)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        )}

        {/* Title row */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          {/* Left: title + description + metrics */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}>
                {title}
              </h1>
              {count !== undefined && count !== null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 24, height: 22, padding: '0 7px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  {count}
                </span>
              )}
              {metrics && metrics.map((m, i) => {
                const v = m.variant ?? 'info';
                return (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 20,
                    background: METRIC_BG[v], border: `1px solid ${METRIC_BORDER[v]}`,
                    fontSize: 11, fontWeight: 600, color: METRIC_COLOR[v],
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: METRIC_COLOR[v], flexShrink: 0 }} />
                    {m.value} {m.label}
                  </span>
                );
              })}
            </div>
            {description && (
              <p style={{
                fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
                margin: '5px 0 0', lineHeight: 1.5,
              }}>
                {description}
              </p>
            )}
          </div>

          {/* Right: actions */}
          {actions && (
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 8, flexShrink: 0, flexWrap: 'wrap',
            }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
