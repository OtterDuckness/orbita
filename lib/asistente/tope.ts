import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { topeMensualUsd } from "@/lib/asistente/coste";
import { getPool } from "@/lib/db";

/** Clave de mes UTC actual (`YYYY-MM`). */
export function mesUtcClave(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

type TopeRow = RowDataPacket & {
  usuario_id: string;
  tope_usd: number | string;
};

function parseTope(raw: number | string): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Override guardado para un usuario/mes, o `null` si no hay fila. */
export async function obtenerTopeOverride(
  usuarioId: string,
  mesUtc: string = mesUtcClave(),
): Promise<number | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<TopeRow[]>(
    `SELECT usuario_id, tope_usd FROM ia_tope_mensual
     WHERE usuario_id = ? AND mes_utc = ?
     LIMIT 1`,
    [usuarioId, mesUtc],
  );
  const r = rows[0];
  if (!r) return null;
  return parseTope(r.tope_usd);
}

/** Mapa usuarioId → override del mes (solo filas existentes). */
export async function mapaTopesOverrideMes(
  mesUtc: string = mesUtcClave(),
): Promise<Map<string, number>> {
  const pool = await getPool();
  const [rows] = await pool.execute<TopeRow[]>(
    `SELECT usuario_id, tope_usd FROM ia_tope_mensual WHERE mes_utc = ?`,
    [mesUtc],
  );
  return new Map(rows.map((r) => [r.usuario_id, parseTope(r.tope_usd)]));
}

/**
 * Tope efectivo del usuario este mes UTC.
 * - Override en BD → ese valor (`0` = sin tope)
 * - Si no hay override → `IA_COSTE_MAX_USD_MES` (default $5; `null` = desactivado)
 */
export async function topeMensualEfectivo(usuarioId: string): Promise<number | null> {
  const override = await obtenerTopeOverride(usuarioId);
  if (override != null) {
    return override <= 0 ? null : override;
  }
  return topeMensualUsd();
}

/**
 * Guarda o borra el override del mes UTC actual.
 * `topeUsd === null` → elimina la fila (vuelve al tope global).
 * `0` → sin tope ese mes.
 */
export async function guardarTopeMensual(opts: {
  usuarioId: string;
  topeUsd: number | null;
  actorId: string;
  mesUtc?: string;
}): Promise<void> {
  const mes = opts.mesUtc ?? mesUtcClave();
  const pool = await getPool();

  if (opts.topeUsd == null) {
    await pool.execute<ResultSetHeader>(
      `DELETE FROM ia_tope_mensual WHERE usuario_id = ? AND mes_utc = ?`,
      [opts.usuarioId, mes],
    );
    return;
  }

  const tope = Math.max(0, opts.topeUsd);
  await pool.execute(
    `INSERT INTO ia_tope_mensual (usuario_id, mes_utc, tope_usd, actualizado_por)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tope_usd = VALUES(tope_usd),
       actualizado_por = VALUES(actualizado_por)`,
    [opts.usuarioId, mes, tope, opts.actorId],
  );
}
