import { QueryClient } from '@tanstack/react-query';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The app's QueryClient: a fresh instance per request on the server, and a
 * single shared instance in the browser. Exported (rather than created inside
 * Providers) so non-React code — e.g. the live-location store — can patch the
 * same cache the components read from.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
