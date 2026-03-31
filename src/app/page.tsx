/**
 * Next.js App Router root page — placeholder for Phase 1.
 *
 * For now, this is a minimal placeholder.
 * In Phase 1, we'll migrate BigIsland.tsx and other island pages here,
 * implementing static generation (SSG) or incremental static revalidation (ISR).
 */
export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to Hawaiʻi Wellness</h1>
          <p className="text-lg text-muted-foreground">
            Next.js App Router scaffold complete. Public pages and SSR coming in Phase 1.
          </p>
        </div>
      </main>
    </div>
  );
}
