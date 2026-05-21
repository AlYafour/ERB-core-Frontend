import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENV ?? 'production',
    tracesSampleRate: 0.1,
    // Replay disabled — MutationObserver overhead causes continuous Chrome paint activity
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}
