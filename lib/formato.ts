import { zonaActual, ZONA_DEFAULT } from "@/lib/zona";

export const ZONA = ZONA_DEFAULT;

/** ISO datetime con hora (no solo YYYY-MM-DD). */
const ISO_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Offset en minutos de `timeZone` respecto a UTC en ese instante (p. ej. +120 en CEST). */
function offsetMinutosEnZona(instant: Date, timeZone: string): number {
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = nombre?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Instant UTC que corresponde a la hora de pared `ymd` + `hora` en `timeZone`
 * (por defecto Europe/Madrid). `hora` = "HH:mm:ss" o "HH:mm:ss.sss".
 */
export function instanteEnZona(
  ymd: string,
  hora = "00:00:00.000",
  timeZone: string = ZONA,
): Date {
  const [ys, ms, ds] = ymd.split("-").map(Number);
  const [hh, mm, resto = "0"] = hora.split(":");
  const [segStr, msStr = "0"] = String(resto).split(".");
  const asUtc = Date.UTC(
    ys!,
    ms! - 1,
    ds!,
    Number(hh),
    Number(mm),
    Number(segStr) || 0,
    Number(msStr.padEnd(3, "0").slice(0, 3)) || 0,
  );
  const off1 = offsetMinutosEnZona(new Date(asUtc), timeZone);
  let instant = new Date(asUtc - off1 * 60_000);
  const off2 = offsetMinutosEnZona(instant, timeZone);
  if (off2 !== off1) instant = new Date(asUtc - off2 * 60_000);
  return instant;
}

export const euros = (n: number | string | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n));

const esDiaSuelto = (d: string | Date) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export const fecha = (d: string | Date | null, timeZone: string = zonaActual()) => {
  if (d === null) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(esDiaSuelto(d) ? {} : { timeZone }),
  }).format(new Date(esDiaSuelto(d) ? `${d}T12:00:00` : d));
};

/** Fecha + hora en la zona del usuario (o la indicada). */
export const fechaHora = (d: string | Date | null, timeZone: string = zonaActual()) => {
  if (d === null) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone,
  }).format(new Date(d));
};

/**
 * Recorre un JSON (p. ej. tool_result del agente) y convierte strings datetime ISO
 * a texto legible en `timeZone`. No toca fechas sueltas YYYY-MM-DD.
 */
export function normalizarDatetimesParaAgente(valor: unknown, timeZone: string = zonaActual()): unknown {
  if (valor == null) return valor;
  if (typeof valor === "string") {
    if (esDiaSuelto(valor)) return valor;
    if (!ISO_DATE_TIME_RE.test(valor.trim())) return valor;
    const t = Date.parse(valor);
    if (Number.isNaN(t)) return valor;
    return fechaHora(new Date(t), timeZone);
  }
  if (typeof valor === "number" || typeof valor === "boolean") return valor;
  if (Array.isArray(valor)) {
    return valor.map((v) => normalizarDatetimesParaAgente(v, timeZone));
  }
  if (typeof valor === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      out[k] = normalizarDatetimesParaAgente(v, timeZone);
    }
    return out;
  }
  return valor;
}
