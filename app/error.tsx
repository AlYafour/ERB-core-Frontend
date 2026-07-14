'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route-segment error boundary (Next.js App Router).
 * Captures the error in Sentry and shows a user-safe message.
 * The request ID (X-Request-Id) is surfaced so support teams can correlate
 * with backend logs without exposing raw stack traces.
 */
export default function RouteError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  // digest is the opaque Next.js server-error ID, safe to show to users
  const ref = error.digest ?? 'unknown'

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
        Something went wrong
      </h2>
      <p style={{ color: '#666', maxWidth: '40ch' }}>
        An unexpected error occurred. Our team has been notified automatically.
      </p>
      <p style={{ fontSize: '0.8rem', color: '#999', fontFamily: 'monospace' }}>
        Reference: {ref}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <a
          href="/dashboard"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: '1px solid #d1d5db',
            color: '#374151',
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
