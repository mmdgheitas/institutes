'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastViewport } from '@/components/ui/ToastViewport';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
              // Never retry auth failures or 4xx validation errors.
              if (error instanceof Error && 'statusCode' in error) {
                const status = (error as { statusCode: number }).statusCode;
                if (status === 401 || status === 403 || status === 404 || status < 500) return false;
              }
              return failureCount < 2;
            },
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
