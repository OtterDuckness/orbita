"use client";

import { createContext, useContext, type ReactNode } from "react";
import { fijarZonaCliente, parseZona } from "@/lib/zona";
import { ZONA } from "@/lib/formato";

const Ctx = createContext<string>(ZONA);

export function useZonaUsuario(): string {
  return useContext(Ctx);
}

/** Fija la zona en contexto React y en el módulo (para `fecha` / `fechaHora` sin props). */
export function TimezoneProvider({
  zona,
  children,
}: {
  zona: string;
  children: ReactNode;
}) {
  const z = parseZona(zona);
  fijarZonaCliente(z);
  return <Ctx.Provider value={z}>{children}</Ctx.Provider>;
}
