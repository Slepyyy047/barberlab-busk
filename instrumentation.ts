import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logEvent, errorCode } = await import('./lib/observability');
  // Framework route template only, never the full URL, query string or request headers.
  logEvent('error', 'request.failed', { route: context.routePath, type: context.routeType, code: errorCode(error) });
};
