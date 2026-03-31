// apps/web/providers/QueryProvider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures one QueryClient per component lifecycle
  // NOT created on every render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min — data is "fresh", no refetch
            gcTime: 10 * 60 * 1000, // 10 min — keep in cache after unmount
            retry: 2, // Retry failed requests twice
            refetchOnWindowFocus: false, // CRITICAL: LGU operators alt-tab a lot
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
