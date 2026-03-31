'use client';

/**
 * Catch-all SPA fallback.
 *
 * Every URL not handled by a specific Next.js App Router page
 * (e.g. /dashboard/*, /admin, /auth, /directory, /articles,
 * /list-your-practice, /claim/:id, /testimonial/:token)
 * is rendered here as a fully client-side React SPA using
 * the existing BrowserRouter-based App component.
 *
 * Next.js specific routes (island pages, profile/[id], etc.)
 * take precedence over this catch-all and are served as SSR.
 *
 * ssr: false ensures no server-side execution — the SPA reads
 * window.location and routes internally via React Router.
 */

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), { ssr: false });

export default function CatchAllPage() {
  return <App />;
}
