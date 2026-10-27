import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import {
  ESTADOS_PROYECTO,
  PRIORIDADES_PROYECTO,
  normalizarColaboradorIds,
  type AmbitoProyecto,
  type EstadoProyecto,
  type PrioridadProyecto,
  type Proyecto,
} from "@/lib/clientes-mock";
import { tipoActivoPorId } from "@/lib/tipos-proyecto";

export type { AmbitoProyecto, EstadoProyecto, PrioridadProyecto, Proyecto };

type ProyectoRow = RowDataPacket & {
  id: string;
  ambito: AmbitoProyecto;
  nombre: string | null;
  cliente_id: string | null;
  tipo_id: string | null;
  fee_mensual: string | number | null;
  fin_contrato: Date | string | null;
  responsable_id: string | null;
  prioridad: PrioridadProyecto;
  estado: EstadoProyecto;
  personal_de_id: string | null;
  creado_en: Date | string;
};

type MiembroRow = RowDataPacket & { proyecto_id: string; usuario_id: string };
type CountRow = RowDataPacket & { n: number };

function prioridadDe(v: string): PrioridadProyecto {
  return PRIORIDADES_PROYECTO.includes(v as PrioridadProyecto) ? (v as PrioridadProyecto) : "media";
}

function estadoDe(v: string | null | undefined): EstadoProyecto {
  return ESTADOS_PROYECTO.includes(v as EstadoProyecto) ? (v as EstadoProyecto) : "activo";
}

const SELECT_PROYECTO = `id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato,
            responsable_id, prioridad, estado, personal_de_id, creado_en`;

function numero(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fechaDia(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 10) || null;
  return v.toISOString().slice(0, 10);
}

function feeNum(v: string | number | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function miembrosDe(proyectoIds: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (proyectoIds.length === 0) return mapa;
  for (const id of proyectoIds) mapa.set(id, []);

  const pool = await getPool();
  const placeholders = proyectoIds.map(() => "?").join(",");
  const [rows] = await pool.execute<MiembroRow[]>(
    `SELECT proyecto_id, usuario_id FROM proyecto_miembros
     WHERE proyecto_id IN (${placeholders})`,
    proyectoIds,
  );
  for (const r of rows) {
    const lista = mapa.get(r.proyecto_id) ?? [];
    lista.push(r.usuario_id);
    mapa.set(r.proyecto_id, lista);
  }
  return mapa;
}

function filaAProyecto(r: ProyectoRow, colaboradorIds: string[]): Proyecto {
  return {
    id: r.id,
    ambito: r.ambito === "externo" ? "externo" : "interno",
    nombre: r.nombre?.trim() || null,
    clienteId: r.cliente_id,
    tipoId: r.tipo_id,
    feeMensual: feeNum(r.fee_mensual),
    finContrato: fechaDia(r.fin_contrato),
    responsableId: r.responsable_id,
    colaboradorIds,
    prioridad: prioridadDe(r.prioridad),
    estado: estadoDe(r.estado),
    personalDeId: r.personal_de_id ?? null,
    creadoEl: iso(r.creado_en) ?? new Date().toISOString(),
  };
}

function perteneceAUsuario(p: Proyecto, usuarioId: string): boolean {
  return p.responsableId === usuarioId || p.colaboradorIds.includes(usuarioId);
}

function filtrarSoloDe(lista: Proyecto[], soloDe?: string | null): Proyecto[] {
  if (!soloDe) return lista;
  return lista.filter((p) => perteneceAUsuario(p, soloDe));
}

async function reemplazarMiembros(proyectoId: string, colaboradorIds: string[]): Promise<string[]> {
  const ids = normalizarColaboradorIds(colaboradorIds);
  const pool = await getPool();

  if (ids.length === 0) {
    await pool.execute("DELETE FROM proyecto_miembros WHERE proyecto_id = ?", [proyectoId]);
    return [];
  }

  const placeholders = ids.map(() => "?").join(",");
  await pool.execute(
    `DELETE FROM proyecto_miembros
     WHERE proyecto_id = ? AND usuario_id NOT IN (${placeholders})`,
    [proyectoId, ...ids],
  );
  for (const usuarioId of ids) {
    await pool.execute(
      "INSERT IGNORE INTO proyecto_miembros (proyecto_id, usuario_id) VALUES (?, ?)",
      [proyectoId, usuarioId],
    );
  }
  return ids;
}

/** El responsable del proyecto forma parte siempre del equipo de colaboradores. */
function colaboradoresConResponsable(
  colaboradorIds: string[] | undefined,
  responsableId: string | null,
): string[] {
  if (!responsableId) return normalizarColaboradorIds(colaboradorIds ?? []);
  return normalizarColaboradorIds([...(colaboradorIds ?? []), responsableId]);
}

export async function listarProyectos(soloDe?: string | null): Promise<Proyecto[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ProyectoRow[]>(
    `SELECT ${SELECT_PROYECTO}
     FROM proyectos
     WHERE personal_de_id IS NULL
     ORDER BY creado_en ASC`,
  );
  const miembros = await miembrosDe(rows.map((r) => r.id));
  return filtrarSoloDe(
    rows.map((r) => filaAProyecto(r, miembros.get(r.id) ?? [])),
    soloDe,
  );
}

export async function proyectoPorId(proyectoId: string): Promise<Proyecto | null> {
  if (!proyectoId) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<ProyectoRow[]>(
    `SELECT ${SELECT_PROYECTO}
     FROM proyectos WHERE id = ? LIMIT 1`,
    [proyectoId],
  );
  const r = rows[0];
  if (!r) return null;
  const miembros = await miembrosDe([r.id]);
  return filaAProyecto(r, miembros.get(r.id) ?? []);
}

export async function proyectosDe(
  clienteId: string,
  soloDe?: string | null,
): Promise<Proyecto[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ProyectoRow[]>(
    `SELECT ${SELECT_PROYECTO}
     FROM proyectos WHERE cliente_id = ?
     ORDER BY creado_en ASC`,
    [clienteId],
  );
  const miembros = await miembrosDe(rows.map((r) => r.id));
  return filtrarSoloDe(
    rows.map((r) => filaAProyecto(r, miembros.get(r.id) ?? [])),
    soloDe,
  );
}

export async function responsableSugerido(
  clienteId: string,
  soloDe?: string | null,
): Promise<string | null> {
  const lista = await proyectosDe(clienteId, soloDe);
  if (lista.length === 0) return null;
  return lista[lista.length - 1]?.responsableId ?? null;
}

export async function colaboradoresIdsDeCliente(
  clienteId: string,
  soloDe?: string | null,
): Promise<string[]> {
  const ids = new Set<string>();
  for (const p of await proyectosDe(clienteId, soloDe)) {
    for (const id of p.colaboradorIds) ids.add(id);
  }
  return [...ids];
}

function resolverAmbitoCliente(
  ambito: AmbitoProyecto,
  clienteIdRaw: string,
):
  | { ok: true; ambito: AmbitoProyecto; clienteId: string | null }
  | { ok: false; motivo: "cliente_obligatorio" } {
  if (ambito === "externo") {
    const cid = clienteIdRaw.trim();
    if (!cid) return { ok: false, motivo: "cliente_obligatorio" };
    return { ok: true, ambito: "externo", clienteId: cid };
  }
  // Schema CHECK: interno ⇒ cliente_id NULL
  return { ok: true, ambito: "interno", clienteId: null };
}

export async function crearProyecto(input: {
  ambito: AmbitoProyecto;
  clienteId: string;
  nombre?: string;
  tipoId: string;
  feeMensual: string;
  finContrato: string;
  responsableId: string;
  prioridad: string;
  colaboradorIds?: string[];
}): Promise<
  | { ok: true; proyecto: Proyecto }
  | { ok: false; motivo: "falta_dato" | "sin_tipo" | "cliente_obligatorio" | "falta_nombre" }
> {
  const ambitoRes = resolverAmbitoCliente(input.ambito, input.clienteId);
  if (!ambitoRes.ok) return ambitoRes;

  const nombreRaw = (input.nombre ?? "").trim().slice(0, 160);
  let tipoId: string | null = input.tipoId.trim() || null;
  let nombre: string | null = nombreRaw || null;

  if (ambitoRes.ambito === "interno") {
    if (!nombre) return { ok: false, motivo: "falta_nombre" };
    tipoId = null;
  } else {
    if (!tipoId) return { ok: false, motivo: "sin_tipo" };
    if (!(await tipoActivoPorId(tipoId))) return { ok: false, motivo: "sin_tipo" };
  }

  const id = randomUUID();
  const fee = numero(input.feeMensual);
  const fin = input.finContrato.trim() || null;
  const responsableId = input.responsableId.trim() || null;
  if (!responsableId) return { ok: false, motivo: "falta_dato" };
  const prioridad = prioridadDe(input.prioridad);
  const pool = await getPool();

  await pool.execute(
    `INSERT INTO proyectos
      (id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato, responsable_id, prioridad, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
    [id, ambitoRes.ambito, nombre, ambitoRes.clienteId, tipoId, fee, fin, responsableId, prioridad],
  );

  const colaboradorIds = await reemplazarMiembros(
    id,
    colaboradoresConResponsable(input.colaboradorIds, responsableId),
  );
  return {
    ok: true,
    proyecto: {
      id,
      ambito: ambitoRes.ambito,
      nombre,
      clienteId: ambitoRes.clienteId,
      tipoId,
      feeMensual: fee,
      finContrato: fin,
      responsableId,
      colaboradorIds,
      prioridad,
      estado: "activo",
      personalDeId: null,
      creadoEl: new Date().toISOString(),
    },
  };
}

/** Alta externa ligada a una cuenta (desde /clientes). */
export async function anadirProyecto(input: {
  clienteId: string;
  nombre?: string;
  tipoId: string;
  feeMensual: string;
  finContrato: string;
  responsableId: string;
  prioridad: string;
  colaboradorIds?: string[];
}): Promise<
  | { ok: true; proyecto: Proyecto }
  | { ok: false; motivo: "falta_dato" | "sin_tipo" | "cliente_obligatorio" | "falta_nombre" }
> {
  return crearProyecto({
    ambito: "externo",
    clienteId: input.clienteId,
    nombre: input.nombre,
    tipoId: input.tipoId,
    feeMensual: input.feeMensual,
    finContrato: input.finContrato,
    responsableId: input.responsableId,
    prioridad: input.prioridad,
    colaboradorIds: input.colaboradorIds,
  });
}

export async function editarProyecto(input: {
  proyectoId: string;
  ambito: AmbitoProyecto;
  clienteId: string;
  nombre?: string;
  tipoId: string;
  feeMensual: string;
  finContrato: string;
  responsableId: string;
  prioridad: string;
  colaboradorIds?: string[];
}): Promise<
  | { ok: true; colaboradorIds: string[] }
  | {
      ok: false;
      motivo: "falta_dato" | "no_encontrado" | "sin_tipo" | "cliente_obligatorio" | "falta_nombre";
    }
> {
  const existente = await proyectoPorId(input.proyectoId);
  if (!existente) return { ok: false, motivo: "no_encontrado" };

  const ambitoRes = resolverAmbitoCliente(input.ambito, input.clienteId);
  if (!ambitoRes.ok) return ambitoRes;

  const nombreRaw = (input.nombre ?? "").trim().slice(0, 160);
  let tipoId: string | null = input.tipoId.trim() || null;
  let nombre: string | null = nombreRaw || null;

  if (ambitoRes.ambito === "interno") {
    if (!nombre) return { ok: false, motivo: "falta_nombre" };
    tipoId = null;
  } else {
    if (!tipoId) return { ok: false, motivo: "sin_tipo" };
    // Solo se puede asignar un tipo del catálogo vigente; conservar el actual si está retirado.
    if (tipoId !== existente.tipoId && !(await tipoActivoPorId(tipoId))) {
      return { ok: false, motivo: "sin_tipo" };
    }
  }

  const fin = input.finContrato.trim() || null;
  const fee = numero(input.feeMensual);
  const responsableId = input.responsableId.trim() || null;
  if (!responsableId) return { ok: false, motivo: "falta_dato" };
  const prioridad = prioridadDe(input.prioridad);
  const pool = await getPool();

  await pool.execute(
    `UPDATE proyectos
     SET ambito = ?, nombre = ?, cliente_id = ?, tipo_id = ?, fee_mensual = ?,
         fin_contrato = ?, responsable_id = ?, prioridad = ?
     WHERE id = ?`,
    [
      ambitoRes.ambito,
      nombre,
      ambitoRes.clienteId,
      tipoId,
      fee,
      fin,
      responsableId,
      prioridad,
      input.proyectoId,
    ],
  );

  const colaboradorIds = await reemplazarMiembros(
    input.proyectoId,
    colaboradoresConResponsable(input.colaboradorIds, responsableId),
  );
  return { ok: true, colaboradorIds };
}

export async function cambiarEstadoProyecto(
  proyectoId: string,
  estado: EstadoProyecto,
): Promise<{ ok: true; estado: EstadoProyecto } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const id = proyectoId.trim();
  if (!id || !ESTADOS_PROYECTO.includes(estado)) return { ok: false, motivo: "falta_dato" };
  const existente = await proyectoPorId(id);
  if (!existente) return { ok: false, motivo: "no_encontrado" };
  const pool = await getPool();
  await pool.execute("UPDATE proyectos SET estado = ? WHERE id = ?", [estado, id]);
  return { ok: true, estado };
}

/** Archiva todos los proyectos en estado terminado. Devuelve cuántos se archivaron. */
export async function archivarProyectosTerminados(): Promise<{ ok: true; archivados: number }> {
  const pool = await getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE proyectos SET estado = 'archivado' WHERE estado = 'terminado'",
  );
  return { ok: true, archivados: Number(result.affectedRows ?? 0) };
}

/**
 * Hard-delete de proyectos de un cliente (sin papelera).
 * Preferir `eliminarCliente` / papelera para undo; esto es para limpieza interna.
 */
export async function eliminarProyectosDeCliente(clienteId: string): Promise<string[]> {
  const lista = await proyectosDe(clienteId);
  const ids = lista.map((p) => p.id);
  if (ids.length === 0) return [];
  const pool = await getPool();
  for (const id of ids) {
    await pool.execute("DELETE FROM tareas WHERE proyecto_id = ?", [id]);
    await pool.execute("DELETE FROM columnas WHERE proyecto_id = ?", [id]);
    await pool.execute("DELETE FROM proyectos WHERE id = ?", [id]);
  }
  return ids;
}

/**
 * Borra un proyecto (papelera + hard delete).
 * Orden interno: snapshot → tareas → columnas → proyecto (+ CASCADE).
 * No se puede hacer solo DELETE proyectos: tareas.columna_id es ON DELETE RESTRICT.
 */
export async function eliminarProyecto(
  proyectoId: string,
  actor: { id: string; correo: string },
): Promise<
  | { ok: true; eliminacionId: string }
  | { ok: false; motivo: "no_encontrado" }
> {
  const { eliminarProyectoConPapelera } = await import("@/lib/papelera");
  return eliminarProyectoConPapelera(proyectoId, actor);
}

export async function contarProyectosDeTipo(tipoId: string): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS n FROM proyectos WHERE tipo_id = ?",
    [tipoId],
  );
  return rows[0]?.n ?? 0;
}

export type AsignacionReciente = {
  clienteId: string;
  clienteNombre: string;
  proyectoId: string;
  proyectoEtiqueta: string;
  asignadoEn: string;
};

/** Marca la asignación al proyecto como vista (idempotente; actualiza timestamp). */
export async function marcarAsignacionVista(
  proyectoId: string,
  usuarioId: string,
): Promise<void> {
  const pid = proyectoId.trim();
  const uid = usuarioId.trim();
  if (!pid || !uid) return;
  try {
    const pool = await getPool();
    await pool.execute(
      `INSERT INTO asignaciones_vistas (proyecto_id, usuario_id, visto_en)
       VALUES (?, ?, CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE visto_en = VALUES(visto_en)`,
      [pid, uid],
    );
  } catch (error) {
    console.error("[proyectos] marcarAsignacionVista falló", {
      proyectoId: pid,
      usuarioId: uid,
      error,
    });
  }
}

type AsignacionRow = RowDataPacket & {
  cliente_id: string;
  cliente_nombre: string;
  proyecto_id: string;
  proyecto_nombre: string | null;
  tipo_nombre: string | null;
  asignado_en: Date | string;
};

async function filasAsignacionSinVer(
  usuarioId: string,
  dias: number,
): Promise<AsignacionRow[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];
  const ventana = Math.max(1, Math.min(90, Math.floor(dias)));
  const pool = await getPool();
  try {
    const [rows] = await pool.execute<AsignacionRow[]>(
      `SELECT c.id AS cliente_id, c.nombre AS cliente_nombre,
              p.id AS proyecto_id, p.nombre AS proyecto_nombre, t.nombre AS tipo_nombre,
              x.asignado_en
       FROM (
         SELECT pm.proyecto_id, pm.asignado_en
           FROM proyecto_miembros pm
          WHERE pm.usuario_id = ?
            AND pm.asignado_en >= DATE_SUB(NOW(), INTERVAL ${ventana} DAY)
         UNION
         SELECT p.id AS proyecto_id, p.creado_en AS asignado_en
           FROM proyectos p
          WHERE p.responsable_id = ?
            AND p.cliente_id IS NOT NULL
            AND p.creado_en >= DATE_SUB(NOW(), INTERVAL ${ventana} DAY)
       ) x
       JOIN proyectos p ON p.id = x.proyecto_id
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN tipos_proyecto t ON t.id = p.tipo_id
       LEFT JOIN asignaciones_vistas av
         ON av.proyecto_id = x.proyecto_id AND av.usuario_id = ?
       WHERE av.visto_en IS NULL
       ORDER BY x.asignado_en DESC`,
      [uid, uid, uid],
    );
    return rows;
  } catch (error) {
    console.error("[proyectos] filasAsignacionSinVer falló (¿falta migración 026?)", {
      usuarioId: uid,
      error,
    });
    return [];
  }
}

/**
 * Clientes/proyectos asignados al usuario en los últimos `dias` (miembro o responsable),
 * aún no abiertos (sin fila en asignaciones_vistas o reasignados después).
 */
export async function asignacionesRecientes(
  usuarioId: string,
  dias = 7,
): Promise<AsignacionReciente[]> {
  const rows = await filasAsignacionSinVer(usuarioId, dias);
  const vistos = new Set<string>();
  const out: AsignacionReciente[] = [];
  for (const r of rows) {
    if (vistos.has(r.cliente_id)) continue;
    vistos.add(r.cliente_id);
    out.push({
      clienteId: r.cliente_id,
      clienteNombre: r.cliente_nombre,
      proyectoId: r.proyecto_id,
      proyectoEtiqueta:
        r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
      asignadoEn: iso(r.asignado_en) ?? new Date().toISOString(),
    });
  }
  return out;
}

/** IDs de proyecto con asignación reciente sin ver (para punto amarillo en listados). */
export async function idsProyectosAsignacionSinVer(
  usuarioId: string,
  dias = 7,
): Promise<string[]> {
  const rows = await filasAsignacionSinVer(usuarioId, dias);
  return [...new Set(rows.map((r) => r.proyecto_id))];
}

type FavoritoRow = RowDataPacket & { proyecto_id: string };

/** IDs de proyectos marcados como favoritos por el usuario (sidemenu). */
export async function idsProyectosFavoritosDe(usuarioId: string): Promise<Set<string>> {
  const uid = usuarioId.trim();
  if (!uid) return new Set();
  try {
    const pool = await getPool();
    const [rows] = await pool.execute<FavoritoRow[]>(
      "SELECT proyecto_id FROM proyecto_favoritos WHERE usuario_id = ?",
      [uid],
    );
    return new Set(rows.map((r) => r.proyecto_id));
  } catch (error) {
    console.error("[proyectos] idsProyectosFavoritosDe falló (¿falta migración 027?)", {
      usuarioId: uid,
      error,
    });
    return new Set();
  }
}

/** Alterna favorito del usuario. Devuelve el estado final. */
export async function alternarFavoritoProyecto(
  usuarioId: string,
  proyectoId: string,
): Promise<{ ok: true; favorito: boolean } | { ok: false; motivo: "no_encontrado" | "bd" }> {
  const uid = usuarioId.trim();
  const pid = proyectoId.trim();
  if (!uid || !pid) return { ok: false, motivo: "no_encontrado" };
  if (!(await proyectoPorId(pid))) return { ok: false, motivo: "no_encontrado" };

  try {
    const pool = await getPool();
    const [existentes] = await pool.execute<FavoritoRow[]>(
      "SELECT proyecto_id FROM proyecto_favoritos WHERE usuario_id = ? AND proyecto_id = ? LIMIT 1",
      [uid, pid],
    );
    if (existentes.length > 0) {
      await pool.execute(
        "DELETE FROM proyecto_favoritos WHERE usuario_id = ? AND proyecto_id = ?",
        [uid, pid],
      );
      return { ok: true, favorito: false };
    }
    await pool.execute(
      "INSERT IGNORE INTO proyecto_favoritos (usuario_id, proyecto_id) VALUES (?, ?)",
      [uid, pid],
    );
    return { ok: true, favorito: true };
  } catch (error) {
    console.error("[proyectos] alternarFavoritoProyecto falló (¿falta migración 027?)", {
      usuarioId: uid,
      proyectoId: pid,
      error,
    });
    return { ok: false, motivo: "bd" };
  }
}
