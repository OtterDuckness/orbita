export const COOKIE_TEMA = "orbita_tema";
export type TemaOrbita = "dia" | "noche";

export function parseTema(raw: string | null | undefined): TemaOrbita {
  return raw === "noche" ? "noche" : "dia";
}
