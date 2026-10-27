"use client";

import { Suspense, type ReactNode } from "react";
import { AvisosProvider } from "./avisos-ui";

/** Suspense requerido por useSearchParams en el provider. */
export function AvisosShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <AvisosProvider>{children}</AvisosProvider>
    </Suspense>
  );
}
