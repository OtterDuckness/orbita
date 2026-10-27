/** Modelo Anthropic Haiku 4.5 (API Messages). */
export const MODEL = "claude-haiku-4-5";

/** Precio Haiku 4.5 (docs.anthropic.com/en/about-claude/pricing). */
const USD_POR_MTOK_IN = 1;
const USD_POR_MTOK_OUT = 5;
/** 5-minute cache write = 1.25× base input. */
const USD_POR_MTOK_CACHE_WRITE = 1.25;
/** Cache read = 0.1× base input. */
const USD_POR_MTOK_CACHE_READ = 0.1;
/** Web search: $10 / 1_000 searches. */
const USD_POR_WEB_SEARCH = 10 / 1_000;

/** Tope mensual por usuario (USD estimado). Override: IA_COSTE_MAX_USD_MES. `0`/`off`/`none` = sin tope. */
const TOPE_MENSUAL_DEFAULT_USD = 5;

export function estimarCosteUsd(
  inputTokens: number,
  outputTokens: number,
  extras?: {
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    webSearchRequests?: number;
  },
): number {
  const in_ = Math.max(0, inputTokens) / 1_000_000;
  const out = Math.max(0, outputTokens) / 1_000_000;
  const cacheWrite = Math.max(0, extras?.cacheCreationTokens ?? 0) / 1_000_000;
  const cacheRead = Math.max(0, extras?.cacheReadTokens ?? 0) / 1_000_000;
  const searches = Math.max(0, extras?.webSearchRequests ?? 0);
  return (
    in_ * USD_POR_MTOK_IN +
    out * USD_POR_MTOK_OUT +
    cacheWrite * USD_POR_MTOK_CACHE_WRITE +
    cacheRead * USD_POR_MTOK_CACHE_READ +
    searches * USD_POR_WEB_SEARCH
  );
}

/**
 * Tope de gasto estimado por usuario y mes UTC.
 * - unset → default $5
 * - number > 0 → that cap
 * - 0 / off / none / false → disabled
 */
export function topeMensualUsd(): number | null {
  const raw = process.env.IA_COSTE_MAX_USD_MES?.trim().toLowerCase();
  if (raw === undefined || raw === "") return TOPE_MENSUAL_DEFAULT_USD;
  if (raw === "0" || raw === "off" || raw === "none" || raw === "false") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export class TopeGastoError extends Error {
  readonly usado: number;
  readonly tope: number;

  constructor(usado: number, tope: number) {
    super("tope_gasto");
    this.name = "TopeGastoError";
    this.usado = usado;
    this.tope = tope;
  }
}
