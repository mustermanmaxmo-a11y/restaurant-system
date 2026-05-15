import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 100% of errors, 10% of performance traces (free plan friendly)
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  // Don't log Sentry activity in the console
  debug: false,

  // Supabase Web Locks API contention on concurrent Realtime channel mounts — non-fatal, Supabase retries internally
  ignoreErrors: [
    /Lock broken by another request with the 'steal' option/,
    /was released because another request stole it/,
  ],
})
