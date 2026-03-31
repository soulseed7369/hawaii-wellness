'use client';

import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReactQueryClientProvider } from '@/components/ReactQueryClientProvider';
import { ReactNode } from 'react';

export function RootLayoutClient({ children }: { children: ReactNode }) {
  return (
    <ReactQueryClientProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          {children}
        </AuthProvider>
      </TooltipProvider>
    </ReactQueryClientProvider>
  );
}
