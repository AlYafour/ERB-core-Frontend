'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number | null;
  breadcrumbs?: Crumb[];
  backHref?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  count,
  breadcrumbs,
  backHref,
  actions,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <div style={{ marginBottom: 20 }}>

      {/* Breadcrumbs */}
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

      {/* Back button */}
      {backHref !== undefined && (
        <button
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            background: 'transparent',
            border: 'none',
            padding: '0 0 10px',
            cursor: 'pointer',
            transition: 'color 100ms',
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
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* Left: title + description */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}>
              {title}
            </h1>
            {count !== undefined && count !== null && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 22,
                height: 20,
                padding: '0 6px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                {count}
              </span>
            )}
          </div>
          {description && (
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-tertiary)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}>
              {description}
            </p>
          )}
        </div>

        {/* Right: actions */}
        {actions && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
