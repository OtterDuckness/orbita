import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { TipoProyecto } from "@/lib/clientes-mock";

export type { TipoProyecto };

type TipoRow = RowDataPacket & {
  id: string;
  nombre: string;
  orden: number;
  activo: number;
};

type CountRow = RowDataPacket & { n: number };

function esDuplicado(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "ER_DUP_ENTRY";
}

function mapTipo(r: TipoRow): TipoProyecto {
  return { id: r.id, nombre: r.nombre, orden: r.orden };
}

/** Catálogo asignable: solo tipos activos. */
export async function listarTiposProyecto(): Promise<TipoProyecto[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<TipoRow[]>(
    `SELECT id, nombre, orden, activo FROM tipos_proyecto
     WHERE activo = 1
     ORDER BY orden ASC, nombre ASC`,
  );
  return rows.map(mapTipo);
}

export async function tipoPorId(tipoId: string | null | undefined): Promise<TipoProyecto | null> {
  if (!tipoId) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<TipoRow[]>(
    "SELECT id, nombre, orden, activo FROM tipos_proyecto WHERE id = ? LIMIT 1",
    [tipoId],
  );
  const r = rows[0];
  return r ? mapTipo(r) : null;
}

/** Solo tipos vigentes del catálogo (no retirados). */
export async function tipoActivoPorId(
  tipoId: string | null | undefined,
): Promise<TipoProyecto | null> {
  if (!tipoId) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<TipoRow[]>(
    "SELECT id, nombre, orden, activo FROM tipos_proyecto WHERE id = ? AND activo = 1 LIMIT 1",
    [tipoId],
  );
  const r = rows[0];
  return r ? mapTipo(r) : null;
}

export async function nombreDeTipo(tipoId: string | null | undefined): Promise<string> {
  return (await tipoPorId(tipoId))?.nombre ?? "—";
}

/** Mapa id → nombre (activos e inactivos) para listados históricos. */
export async function mapaNombresTipo(): Promise<Map<string, string>> {
  const pool = await getPool();
  const [rows] = await pool.execute<TipoRow[]>(
    "SELECT id, nombre, orden, activo FROM tipos_proyecto ORDER BY orden ASC, nombre ASC",
  );
  return new Map(rows.map((r) => [r.id, r.nombre]));
}

export async function contarUsoTipo(tipoId: string): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS n FROM proyectos WHERE tipo_id = ?",
    [tipoId],
  );
  return rows[0]?.n ?? 0;
}

export async function contarUsoActivosTipo(tipoId: string): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS n FROM proyectos WHERE tipo_id = ? AND estado = 'activo'",
    [tipoId],
  );
  return rows[0]?.n ?? 0;
}

export async function crearTipoProyecto(
  nombreRaw: string,
): Promise<{ ok: true; tipo: TipoProyecto } | { ok: false; motivo: "falta_dato" | "duplicado" }> {
  const nombre = nombreRaw.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };
  // Reservado para la opción de UI «Otro…»
  if (nombre.toLowerCase() === "otro" || nombre === "Otro…") {
    return { ok: false, motivo: "falta_dato" };
  }

  const pool = await getPool();

  const [existentes] = await pool.execute<TipoRow[]>(
    "SELECT id, nombre, orden, activo FROM tipos_proyecto WHERE nombre = ? LIMIT 1",
    [nombre],
  );
  const existente = existentes[0];
  if (existente) {
    if (existente.activo) return { ok: false, motivo: "duplicado" };
    await pool.execute("UPDATE tipos_proyecto SET activo = 1 WHERE id = ?", [existente.id]);
    return { ok: true, tipo: mapTipo({ ...existente, activo: 1 }) };
  }

  const [maxRows] = await pool.execute<CountRow[]>(
    "SELECT COALESCE(MAX(orden), -1) AS n FROM tipos_proyecto",
  );
  const orden = (maxRows[0]?.n ?? -1) + 1;
  const id = randomUUID();

  try {
    await pool.execute(
      "INSERT INTO tipos_proyecto (id, nombre, orden, activo) VALUES (?, ?, ?, 1)",
      [id, nombre, orden],
    );
  } catch (err) {
    if (esDuplicado(err)) return { ok: false, motivo: "duplicado" };
    throw err;
  }

  return { ok: true, tipo: { id, nombre, orden } };
}

export async function renombrarTipoProyecto(
  tipoId: string,
  nombreRaw: string,
): Promise<
  { ok: true; tipo: TipoProyecto } | { ok: false; motivo: "falta_dato" | "no_encontrado" | "duplicado" }
> {
  const tipo = await tipoActivoPorId(tipoId);
  if (!tipo) return { ok: false, motivo: "no_encontrado" };
  const nombre = nombreRaw.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  try {
    await pool.execute("UPDATE tipos_proyecto SET nombre = ? WHERE id = ?", [nombre, tipoId]);
  } catch (err) {
    if (esDuplicado(err)) return { ok: false, motivo: "duplicado" };
    throw err;
  }

  return { ok: true, tipo: { ...tipo, nombre } };
}

export async function eliminarTipoProyecto(
  tipoId: string,
  reasignarAId?: string,
): Promise<
  | { ok: true; movidos: number }
  | {
      ok: false;
      motivo: "no_encontrado" | "requiere_reasignacion" | "destino_invalido" | "mismo_destino";
      enUso?: number;
    }
> {
  const tipo = await tipoActivoPorId(tipoId);
  if (!tipo) return { ok: false, motivo: "no_encontrado" };

  const pool = await getPool();
  const enUsoActivos = await contarUsoActivosTipo(tipoId);

  if (enUsoActivos > 0) {
    const dest = (reasignarAId ?? "").trim();
    if (!dest) return { ok: false, motivo: "requiere_reasignacion", enUso: enUsoActivos };
    if (dest === tipoId) return { ok: false, motivo: "mismo_destino", enUso: enUsoActivos };
    if (!(await tipoActivoPorId(dest))) {
      return { ok: false, motivo: "destino_invalido", enUso: enUsoActivos };
    }
    await pool.execute(
      "UPDATE proyectos SET tipo_id = ? WHERE tipo_id = ? AND estado = 'activo'",
      [dest, tipoId],
    );
  }

  const total = await contarUsoTipo(tipoId);
  if (total === 0) {
    await pool.execute("DELETE FROM tipos_proyecto WHERE id = ?", [tipoId]);
  } else {
    await pool.execute("UPDATE tipos_proyecto SET activo = 0 WHERE id = ?", [tipoId]);
  }

  return { ok: true, movidos: enUsoActivos };
}
