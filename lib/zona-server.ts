import { AsyncLocalStorage } from "node:async_hooks";
import { parseZona, registrarLectorZonaAls } from "@/lib/zona";

const zonaAls = new AsyncLocalStorage<string>();
registrarLectorZonaAls(() => zonaAls.getStore());

export function runWithZona<T>(zona: string, fn: () => T): T {
  return zonaAls.run(parseZona(zona), fn);
}

/** Fija la zona para el resto del request async (páginas / server actions). */
export function aplicarZona(zona: string): void {
  zonaAls.enterWith(parseZona(zona));
}
