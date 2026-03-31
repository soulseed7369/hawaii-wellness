'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function ReactQueryClientProvider({ children }: { children: ReactNode }) {
  // Create QueryClient inside useState so each browser tab gets its own instance
  // and server-side requests don't share cached data across users.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
