import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export const CLAVE_PROYECTOS_URL_ABIERTA = "proyectos_url_abierta";
export const CLAVE_AGENTE_IA_ACTIVO = "agente_ia_activo";

type AjusteRow = RowDataPacket & { valor: string };

export async function leerAjuste(clave: string, porDefecto = "0"): Promise<string> {
  const pool = await getPool();
  const [rows] = await pool.execute<AjusteRow[]>(
    "SELECT valor FROM ajustes WHERE clave = ? LIMIT 1",
    [clave],
  );
  return rows[0]?.valor ?? porDefecto;
}

export async function escribirAjuste(
  clave: string,
  valor: string,
  actorId: string | null,
): Promise<void> {
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO ajustes (clave, valor, actualizado_por)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)`,
    [clave, valor, actorId],
  );
}

/** Si true, cualquier usuario con permiso puede abrir /proyectos/[id] aunque no sea miembro. */
export async function accesoUrlProyectosAbierto(): Promise<boolean> {
  const v = await leerAjuste(CLAVE_PROYECTOS_URL_ABIERTA, "0");
  return v === "1" || v.toLowerCase() === "true";
}

export async function guardarAccesoUrlProyectos(
  abierto: boolean,
  actorId: string | null,
): Promise<void> {
  await escribirAjuste(CLAVE_PROYECTOS_URL_ABIERTA, abierto ? "1" : "0", actorId);
}

/** Si false, el chat /asistente queda oculto a no-admins (admins siempre pueden). */
export async function agenteIaActivo(): Promise<boolean> {
  const v = await leerAjuste(CLAVE_AGENTE_IA_ACTIVO, "1");
  return v === "1" || v.toLowerCase() === "true";
}

/** Acceso al chat/API: equipo entero si el ajuste está on; si no, solo admins. */
export async function puedeUsarAgenteIa(esAdmin: boolean): Promise<boolean> {
  if (esAdmin) return true;
  return agenteIaActivo();
}

export async function guardarAgenteIaActivo(
  activo: boolean,
  actorId: string | null,
): Promise<void> {
  await escribirAjuste(CLAVE_AGENTE_IA_ACTIVO, activo ? "1" : "0", actorId);
}
