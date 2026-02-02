'use client';

import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useMemo } from 'react';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';

export const ConvexProvider = ({ children }: { children: ReactNode }) => {
  const convex = useMemo(() => {
    if (!CONVEX_URL) {
      // During build, return null - children will render without Convex
      return null;
    }
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  if (!convex) {
    // Render children without Convex during build/SSR when URL not available
    return <>{children}</>;
  }

  return (
    <BaseConvexProvider client={convex}>
      {children}
    </BaseConvexProvider>
  );
};
