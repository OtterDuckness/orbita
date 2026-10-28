"use client";

import type { ReactNode } from "react";
import { AvisosProvider } from "./avisos-ui";

export function AvisosShell({ children }: { children: ReactNode }) {
  return <AvisosProvider>{children}</AvisosProvider>;
}
