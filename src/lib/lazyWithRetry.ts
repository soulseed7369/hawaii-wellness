import { lazy, type ComponentType } from 'react';

/**
 * Wrapper around React.lazy() that handles stale chunk failures after deployments.
 *
 * When Vercel (or any CDN) deploys a new build, chunk hashes change. Users who
 * still have the old index.html cached will try to load chunks that no longer
 * exist → dynamic import fails. This wrapper catches that error and triggers a
 * full page reload so the browser picks up the new index.html + correct chunks.
 *
 * A sessionStorage flag prevents infinite reload loops if the error persists.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      const key = 'chunk_reload_attempted';

      // Only auto-reload once per session to prevent infinite loops
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a no-op component while the reload happens
        return { default: (() => null) as unknown as T };
      }

      // Already tried reloading — clear the flag and let the error propagate
      // so the ErrorBoundary can show a user-friendly message
      sessionStorage.removeItem(key);
      throw error;
    }),
  );
}

/**
 * Call this on successful app mount to clear the retry flag.
 * This ensures the next stale-chunk failure gets a fresh reload attempt.
 */
export function clearChunkRetryFlag() {
  sessionStorage.removeItem('chunk_reload_attempted');
}
