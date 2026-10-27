/**
 * Fiestas laborales (nacionales + Comunidad de Madrid).
 * Fuente: BOE-A-2025-21667 (Resolución 17 oct 2025, fiestas 2026).
 * https://www.boe.es/eli/es/res/2025/10/17/(2)
 *
 * Incluye nacionales no sustituibles, las que Madrid no sustituye
 * (p. ej. Jueves Santo) y las autonómicas / traslados de Madrid
 * (2 may, 2 nov, 7 dic). Actualizar al publicar el BOE de cada año.
 */
const FESTIVOS_MADRID: Record<string, string> = {
  "2026-01-01": "Año Nuevo",
  "2026-01-06": "Epifanía del Señor",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2026-05-01": "Fiesta del Trabajo",
  "2026-05-02": "Fiesta de la Comunidad de Madrid",
  "2026-08-15": "Asunción de la Virgen",
  "2026-10-12": "Fiesta Nacional de España",
  "2026-11-02": "Día siguiente a Todos los Santos",
  "2026-12-07": "Lunes siguiente al Día de la Constitución",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Natividad del Señor",
};

/** Nombre del festivo en Madrid/nacional, o null si es laborable. */
export function festivoMadrid(ymd: string): string | null {
  return FESTIVOS_MADRID[ymd] ?? null;
}
