export const PROJECTS = [
  'payments-api',
  'auth-service',
  'web-dashboard',
  'data-pipeline',
  'notification-worker',
  'search-indexer',
  'billing-core',
  'admin-console',
  'mobile-bff',
  'event-gateway',
] as const

export const REQUESTS = [
  'fix the flaky retry test in billing',
  'add pagination to the invoices endpoint',
  'refactor the session cache to use a TTL map',
  'investigate why the webhook handler times out',
  'migrate the user repository to the new query builder',
  'add input validation to the signup form',
  'reduce bundle size of the dashboard charts',
  'write tests for the rate limiter edge cases',
  'clean up unused feature flags',
  'make the export job resumable after a crash',
  'add structured logging to the payment flow',
  'fix the race condition in the token refresh',
] as const

export const FILE_PATHS = [
  'src/billing/retry.ts',
  'src/billing/invoice-service.ts',
  'src/auth/session.ts',
  'src/auth/token-refresh.ts',
  'src/api/routes/invoices.ts',
  'src/api/middleware/rate-limit.ts',
  'src/db/user-repository.ts',
  'src/db/query-builder.ts',
  'src/jobs/export-job.ts',
  'src/webhooks/handler.ts',
  'src/lib/logger.ts',
  'src/lib/cache.ts',
  'src/config/feature-flags.ts',
  'src/ui/charts/RevenueChart.tsx',
  'src/ui/forms/SignupForm.tsx',
  'tests/billing/retry.test.ts',
  'tests/auth/session.test.ts',
  'tests/api/invoices.test.ts',
] as const

export const SYMBOLS = [
  'retryPolicy',
  'handleWebhook',
  'refreshToken',
  'paginate',
  'createInvoice',
  'SessionCache',
  'validateSignup',
  'rateLimiter',
  'exportCursor',
  'featureFlags',
  'withTransaction',
  'parseCursor',
] as const

export const GLOB_PATTERNS = [
  'src/**/*.ts',
  'tests/**/*.test.ts',
  'src/**/*.tsx',
  '**/package.json',
  'src/db/**/*.ts',
] as const

export const SEARCH_QUERIES = [
  'node.js exponential backoff jitter best practice',
  'postgres cursor pagination vs offset performance',
  'typescript discriminated union exhaustive check',
  'jwt refresh token rotation race condition',
  'vite bundle analyzer tree shaking chart library',
  'zod schema async refinement',
] as const

export const DOC_URLS = [
  'https://nodejs.org/api/timers.html',
  'https://www.postgresql.org/docs/current/queries-limit.html',
  'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
  'https://vitejs.dev/guide/build.html',
  'https://zod.dev/?id=refine',
] as const

export const DIFF_CHANGES: readonly { removed: string[]; added: string[] }[] = [
  { removed: ['  return token.user'], added: ['  if (!token) return null', '  return token.user'] },
  {
    removed: ['  const delay = 1000'],
    added: ['  const delay = Math.min(2 ** attempt * 100, 5000)', '  const jitter = Math.random() * delay * 0.2'],
  },
  {
    removed: ['  const rows = await db.query(sql)'],
    added: ['  const rows = await db.query(sql, { limit, cursor })', '  const next = rows.at(-1)?.id ?? null'],
  },
  {
    removed: ['export async function handleWebhook(req) {'],
    added: ['export async function handleWebhook(req, { signal }) {', '  signal.throwIfAborted()'],
  },
  {
    removed: ['    logger.info("payment " + id)'],
    added: ['    logger.info({ paymentId: id, status }, "payment updated")'],
  },
  {
    removed: ['  if (cache.has(key)) return cache.get(key)'],
    added: ['  const hit = cache.get(key)', '  if (hit && hit.expiresAt > now()) return hit.value'],
  },
  { removed: [], added: ['  if (!email.includes("@")) throw new ValidationError("email")'] },
]

export const COMMAND_RUNS: readonly { command: string; output: string }[] = [
  { command: 'npm test -- billing', output: 'PASS  tests/billing/retry.test.ts (12 tests)' },
  { command: 'npm test -- auth', output: 'PASS  tests/auth/session.test.ts (18 tests)' },
  { command: 'npx tsc --noEmit', output: 'No type errors' },
  { command: 'npm run lint', output: '✔ 0 problems' },
  { command: 'npm test', output: 'Tests: 214 passed, 214 total' },
  { command: 'npm run build', output: '✓ built in 4.21s' },
]

export const TODO_ITEMS = [
  'Reproduce the failure locally',
  'Read the existing implementation',
  'Write a failing test',
  'Implement the fix',
  'Run the full test suite',
  'Update the changelog',
] as const

export const SPINNER_LABELS = [
  'Thinking',
  'Pondering',
  'Cogitating',
  'Reticulating',
  'Percolating',
  'Synthesizing',
  'Noodling',
  'Brewing',
  'Spelunking',
  'Crafting',
] as const

export const SUMMARIES = [
  'All tests passing. The fix is ready for review.',
  'Done. Added the change and covered it with tests.',
  'Implemented and verified locally — build and tests are green.',
  'Refactor complete; behavior unchanged and tests pass.',
] as const
