'use client';

import { MemoryRouter } from 'react-router-dom';
import BigIsland from '@/views/BigIsland';

/**
 * SSR island page client shell.
 * Wraps the full SPA island view (with dynamic practitioner/center/article data)
 * inside a MemoryRouter so React Router Links work in the Next.js context.
 * Server-side metadata lives in page.tsx (generateMetadata).
 */
export default function BigIslandContent() {
  return (
    <MemoryRouter initialEntries={['/big-island']}>
      <BigIsland />
    </MemoryRouter>
  );
}
