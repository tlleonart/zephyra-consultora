'use client';

import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useState, useEffect, createContext, useContext } from 'react';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';

const ConvexReadyContext = createContext(false);

export const useConvexReady = () => useContext(ConvexReadyContext);

export const ConvexProvider = ({ children }: { children: ReactNode }) => {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (CONVEX_URL && typeof window !== 'undefined') {
      const convexClient = new ConvexReactClient(CONVEX_URL);
      setClient(convexClient);
      setIsReady(true);
    }
  }, []);

  // During SSR, render children without provider but mark as not ready
  if (!client) {
    return (
      <ConvexReadyContext.Provider value={false}>
        {children}
      </ConvexReadyContext.Provider>
    );
  }

  return (
    <ConvexReadyContext.Provider value={isReady}>
      <BaseConvexProvider client={client}>
        {children}
      </BaseConvexProvider>
    </ConvexReadyContext.Provider>
  );
};
