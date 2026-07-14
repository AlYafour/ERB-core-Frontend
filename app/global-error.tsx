'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root-layout error boundary (Next.js App Router).
 * Renders when an error escapes all inner error.tsx boundaries.
 * Must render its own <html> and <body> tags.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const ref = error.digest ?? 'unknown'

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f9fafb',
        }}
      >
        <div
          role="alert"
          style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '480px',
          }}
        >
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Unexpected Error
          </h1>
          <p style={{ color: '#4b5563', marginBottom: '0.5rem' }}>
            The application encountered a critical error. Our team has been alerted.
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              fontFamily: 'monospace',
              marginBottom: '1.5rem',
            }}
          >
            Reference: {ref}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  )
}
