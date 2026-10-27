/** Default de producto (misma constante que `ZONA` en formato.ts). */
export const ZONA_DEFAULT = "Europe/Madrid";

export const COOKIE_ZONA = "orbita_timezone";

/** Zonas habituales para el selector de Ajustes (IANA). */
export const ZONAS_UI: { id: string; etiqueta: string }[] = [
  { id: "Europe/Madrid", etiqueta: "Madrid (España)" },
  { id: "Europe/Lisbon", etiqueta: "Lisboa (Portugal)" },
  { id: "Europe/London", etiqueta: "Londres (UK)" },
  { id: "Europe/Paris", etiqueta: "París (Francia)" },
  { id: "Atlantic/Canary", etiqueta: "Canarias (España)" },
  { id: "America/Mexico_City", etiqueta: "Ciudad de México" },
  { id: "America/Bogota", etiqueta: "Bogotá (Colombia)" },
  { id: "America/Lima", etiqueta: "Lima (Perú)" },
  { id: "America/Santiago", etiqueta: "Santiago (Chile)" },
  { id: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (Argentina)" },
  { id: "America/Sao_Paulo", etiqueta: "São Paulo (Brasil)" },
  { id: "America/New_York", etiqueta: "Nueva York (USA Este)" },
  { id: "America/Chicago", etiqueta: "Chicago (USA Centro)" },
  { id: "America/Denver", etiqueta: "Denver (USA Montaña)" },
  { id: "America/Los_Angeles", etiqueta: "Los Ángeles (USA Pacífico)" },
  { id: "UTC", etiqueta: "UTC" },
];

let zonaCliente: string | null = null;
/** Registrado solo en servidor vía `zona-server.ts` (evita async_hooks en el bundle client). */
let leerZonaAls: (() => string | undefined) | null = null;

export function registrarLectorZonaAls(lector: () => string | undefined): void {
  leerZonaAls = lector;
}

export function esZonaValida(raw: string | null | undefined): boolean {
  const z = (raw ?? "").trim();
  if (!z || z.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

export function parseZona(raw: string | null | undefined): string {
  const z = (raw ?? "").trim();
  return esZonaValida(z) ? z : ZONA_DEFAULT;
}

/** Zona del request actual (ALS servidor si está registrado, o módulo cliente). */
export function zonaActual(): string {
  return leerZonaAls?.() ?? zonaCliente ?? ZONA_DEFAULT;
}

/** Solo en componentes client (TimezoneProvider). */
export function fijarZonaCliente(zona: string): void {
  zonaCliente = parseZona(zona);
}

export function attrsCookieZona() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}
