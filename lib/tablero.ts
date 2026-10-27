import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { normalizarColaboradorIds } from "@/lib/clientes-mock";
import {
  COLUMNAS_FIJAS,
  DIFICULTADES,
  PRIORIDADES,
  ordenarColumnasTablero,
  type Columna,
  type Dificultad,
  type ItemChecklist,
  type NotaTarea,
  type Prioridad,
  type Tarea,
} from "@/lib/tareas-mock";

type ColumnaRow = RowDataPacket & {
  id: string;
  proyecto_id: string;
  nombre: string;
  fija: number | boolean;
  orden: number;
};

type TareaRow = RowDataPacket & {
  id: string;
  proyecto_id: string;
  columna_id: string;
  nombre: string;
  fecha_prevista: Date | string | null;
  fecha_maxima: Date | string | null;
  sync_calendar: number | boolean;
  notificar_asignado?: number | boolean;
  calendar_event_id: string | null;
  mandada_por_id: string | null;
  responsable_ids: unknown;
  prioridad: string;
  dificultad?: number;
  notas: string | null;
  notas_autor_id: string | null;
  notas_creado_en: Date | string | null;
  completada_en: Date | string | null;
  orden: number;
  creado_en: Date | string;
};

type ChecklistRow = RowDataPacket & {
  id: string;
  tarea_id: string;
  texto: string;
  hecho: number | boolean;
  orden: number;
};

type CountRow = RowDataPacket & { proyecto_id: string; n: number };

const U_DEV = "b0000000-0000-4000-8000-000000000002";
const NOTAS_MAX = 10_000;
const CHECKLIST_TEXTO_MAX = 500;

const TAREA_SELECT = `id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima,
            sync_calendar, notificar_asignado, calendar_event_id, mandada_por_id, responsable_ids,
            prioridad, dificultad, notas, notas_autor_id, notas_creado_en, completada_en, orden, creado_en`;

const PESO_PRIORIDAD: Record<Prioridad, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

function fechaDia(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 10) || null;
  return v.toISOString().slice(0, 10);
}

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function prioridadDe(v: string): Prioridad {
  return PRIORIDADES.includes(v as Prioridad) ? (v as Prioridad) : "media";
}

function dificultadDe(v: unknown): Dificultad {
  const n = typeof v === "number" ? v : Number(v);
  return DIFICULTADES.includes(n as Dificultad) ? (n as Dificultad) : 3;
}

function parseResponsables(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pesoPrioridad(p: Prioridad) {
  return PESO_PRIORIDAD[p];
}

function compararPorOrden(a: Tarea, b: Tarea) {
  return a.orden - b.orden || a.creadoEl.localeCompare(b.creadoEl);
}

function indicePorPrioridad(lista: Tarea[], prioridad: Prioridad) {
  const peso = pesoPrioridad(prioridad);
  for (let i = 0; i < lista.length; i++) {
    if (pesoPrioridad(lista[i].prioridad) > peso) return i;
  }
  return lista.length;
}

function filaAColumna(r: ColumnaRow): Columna {
  return {
    id: r.id,
    proyectoId: r.proyecto_id,
    nombre: r.nombre,
    fija: Boolean(r.fija),
    orden: r.orden,
  };
}

export async function columnaPorId(columnaId: string): Promise<Columna | null> {
  const id = columnaId.trim();
  if (!id) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden FROM columnas WHERE id = ? LIMIT 1`,
    [id],
  );
  const raw = rows[0];
  return raw ? filaAColumna(raw) : null;
}

function notasDeFila(r: TareaRow): NotaTarea[] {
  const texto = r.notas?.trim() ? r.notas : "";
  if (!texto) return [];
  return [
    {
      id: `n-${r.id}`,
      texto,
      autorId: r.notas_autor_id || U_DEV,
      creadoEl: iso(r.notas_creado_en) ?? iso(r.creado_en) ?? new Date().toISOString(),
    },
  ];
}

function filaATarea(r: TareaRow, checklist: ItemChecklist[] = []): Tarea {
  return {
    id: r.id,
    proyectoId: r.proyecto_id,
    columnaId: r.columna_id,
    nombre: r.nombre,
    fechaPrevista: fechaDia(r.fecha_prevista),
    fechaMaxima: fechaDia(r.fecha_maxima),
    syncCalendar: Boolean(r.sync_calendar),
    notificarAsignado: Boolean(r.notificar_asignado),
    calendarEventId: r.calendar_event_id,
    responsableIds: parseResponsables(r.responsable_ids),
    mandadaPorId: r.mandada_por_id,
    prioridad: prioridadDe(r.prioridad),
    dificultad: dificultadDe(r.dificultad),
    notas: notasDeFila(r),
    checklist: checklist.map((c) => ({ ...c })),
    completadaEl: iso(r.completada_en),
    orden: r.orden,
    creadoEl: iso(r.creado_en) ?? new Date().toISOString(),
  };
}

async function checklistPorTareas(tareaIds: string[]): Promise<Map<string, ItemChecklist[]>> {
  const mapa = new Map<string, ItemChecklist[]>();
  for (const id of tareaIds) mapa.set(id, []);
  if (tareaIds.length === 0) return mapa;

  const pool = await getPool();
  const placeholders = tareaIds.map(() => "?").join(",");
  const [rows] = await pool.execute<ChecklistRow[]>(
    `SELECT id, tarea_id, texto, hecho, orden
     FROM tarea_checklist WHERE tarea_id IN (${placeholders})
     ORDER BY orden ASC, creado_en ASC`,
    tareaIds,
  );
  for (const r of rows) {
    const lista = mapa.get(r.tarea_id) ?? [];
    lista.push({ id: r.id, texto: r.texto, hecho: Boolean(r.hecho) });
    mapa.set(r.tarea_id, lista);
  }
  return mapa;
}

async function filasATareas(rows: TareaRow[]): Promise<Tarea[]> {
  const checklist = await checklistPorTareas(rows.map((r) => r.id));
  return rows
    .map((r) => filaATarea(r, checklist.get(r.id) ?? []))
    .sort(compararPorOrden);
}

async function columnasRaw(proyectoId: string): Promise<Columna[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden
     FROM columnas WHERE proyecto_id = ?
     ORDER BY orden ASC`,
    [proyectoId],
  );
  return rows.map(filaAColumna);
}

async function reindexarOrdenes(tareasOrdenadas: { id: string; orden: number }[]) {
  if (tareasOrdenadas.length === 0) return;
  const pool = await getPool();
  for (let i = 0; i < tareasOrdenadas.length; i++) {
    const t = tareasOrdenadas[i]!;
    if (t.orden === i) continue;
    await pool.execute("UPDATE tareas SET orden = ? WHERE id = ?", [i, t.id]);
    t.orden = i;
  }
}

async function listarEnColumna(columnaId: string, exceptoId?: string): Promise<Tarea[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<TareaRow[]>(
    `SELECT ${TAREA_SELECT}
     FROM tareas WHERE columna_id = ?${exceptoId ? " AND id <> ?" : ""}
     ORDER BY orden ASC, creado_en ASC`,
    exceptoId ? [columnaId, exceptoId] : [columnaId],
  );
  return filasATareas(rows);
}

/** Crea las 5 columnas fijas si el proyecto aún no las tiene. */
export async function asegurarColumnas(proyectoId: string): Promise<Columna[]> {
  let cols = await columnasRaw(proyectoId);
  if (cols.length > 0) return cols;

  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Bloquea la fila del proyecto para serializar creaciones concurrentes
    // (columnasDe + tareasDe en paralelo en la página del tablero).
    await conn.execute("SELECT id FROM proyectos WHERE id = ? FOR UPDATE", [proyectoId]);

    const [rows] = await conn.execute<ColumnaRow[]>(
      `SELECT id, proyecto_id, nombre, fija, orden
       FROM columnas WHERE proyecto_id = ?
       ORDER BY orden ASC`,
      [proyectoId],
    );
    if (rows.length === 0) {
      for (let i = 0; i < COLUMNAS_FIJAS.length; i++) {
        const c = COLUMNAS_FIJAS[i]!;
        await conn.execute(
          `INSERT INTO columnas (id, proyecto_id, nombre, fija, orden) VALUES (?, ?, ?, 1, ?)`,
          [randomUUID(), proyectoId, c.nombre, i],
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return columnasRaw(proyectoId);
}

export async function columnasDe(proyectoId: string): Promise<Columna[]> {
  return asegurarColumnas(proyectoId);
}

export async function tareasDe(proyectoId: string): Promise<Tarea[]> {
  await asegurarColumnas(proyectoId);
  const pool = await getPool();
  const [rows] = await pool.execute<TareaRow[]>(
    `SELECT ${TAREA_SELECT}
     FROM tareas WHERE proyecto_id = ?
     ORDER BY orden ASC, creado_en ASC`,
    [proyectoId],
  );
  return filasATareas(rows);
}

export async function tareaPorId(tareaId: string): Promise<Tarea | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<TareaRow[]>(
    `SELECT ${TAREA_SELECT}
     FROM tareas WHERE id = ? LIMIT 1`,
    [tareaId],
  );
  const r = rows[0];
  if (!r) return null;
  const [tarea] = await filasATareas([r]);
  return tarea ?? null;
}

export async function crearColumna(
  proyectoId: string,
  nombre: string,
): Promise<{ ok: true; columna: Columna } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const pid = proyectoId.trim();
  if (!pid) return { ok: false, motivo: "no_encontrado" };
  const n = nombre.trim();
  if (!n) return { ok: false, motivo: "falta_dato" };

  const cols = await asegurarColumnas(pid);
  const terminadas = cols.find((c) => c.fija && c.nombre === "Terminadas");
  const rechazadas = cols.find((c) => c.fija && c.nombre === "Rechazadas / eliminadas");
  // Entre Terminadas y Rechazadas (antes de Rechazadas).
  const orden =
    rechazadas?.orden ?? (terminadas ? terminadas.orden + 1 : cols.length);
  const pool = await getPool();

  await pool.execute(
    `UPDATE columnas SET orden = orden + 1 WHERE proyecto_id = ? AND orden >= ?`,
    [pid, orden],
  );

  const id = randomUUID();
  await pool.execute(
    `INSERT INTO columnas (id, proyecto_id, nombre, fija, orden) VALUES (?, ?, ?, 0, ?)`,
    [id, pid, n, orden],
  );

  return {
    ok: true,
    columna: { id, proyectoId: pid, nombre: n, fija: false, orden },
  };
}

const NOMBRES_FLUJO = COLUMNAS_FIJAS.filter(
  (c) => c.nombre !== "Rechazadas / eliminadas",
).map((c) => c.nombre);

/**
 * Reordena un apartado creado (!fija).
 * `indiceDestino` es el índice en la vista (flujo → custom → Rechazadas), sin la columna arrastrada.
 * Los custom solo pueden quedar entre el flujo fijo y Rechazadas.
 */
export async function reordenarColumna(
  columnaId: string,
  indiceDestino: number,
): Promise<{ ok: true; columnas: Columna[] } | { ok: false; motivo: "no_encontrado" | "fija" }> {
  const pool = await getPool();
  const [rows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden FROM columnas WHERE id = ? LIMIT 1`,
    [columnaId],
  );
  const raw = rows[0];
  if (!raw) return { ok: false, motivo: "no_encontrado" };
  const col = filaAColumna(raw);
  if (col.fija) return { ok: false, motivo: "fija" };

  const ordenadas = await asegurarColumnas(col.proyectoId);
  const sin = ordenarColumnasTablero(ordenadas.filter((c) => c.id !== columnaId));
  const nFlujo = sin.filter((c) => c.fija && NOMBRES_FLUJO.includes(c.nombre)).length;
  const nCustom = sin.filter((c) => !c.fija).length;
  const dest = Math.max(
    nFlujo,
    Math.min(nFlujo + nCustom, Math.floor(indiceDestino)),
  );
  sin.splice(dest, 0, col);
  for (let i = 0; i < sin.length; i++) {
    sin[i]!.orden = i;
    await pool.execute("UPDATE columnas SET orden = ? WHERE id = ?", [i, sin[i]!.id]);
  }
  return { ok: true, columnas: [...sin] };
}

/** IDs de apartados ocultos para un usuario en un proyecto. */
export async function columnasOcultasDe(usuarioId: string, proyectoId: string): Promise<string[]> {
  const uid = usuarioId.trim();
  const pid = proyectoId.trim();
  if (!uid || !pid) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<(RowDataPacket & { columna_id: string })[]>(
    `SELECT o.columna_id
     FROM columnas_ocultas_usuario o
     INNER JOIN columnas c ON c.id = o.columna_id
     WHERE o.usuario_id = ? AND c.proyecto_id = ?`,
    [uid, pid],
  );
  return rows.map((r) => r.columna_id);
}

export async function ocultarColumna(
  usuarioId: string,
  columnaId: string,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" | "falta_dato" }> {
  const uid = usuarioId.trim();
  const cid = columnaId.trim();
  if (!uid || !cid) return { ok: false, motivo: "falta_dato" };
  const pool = await getPool();
  const [rows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden FROM columnas WHERE id = ? LIMIT 1`,
    [cid],
  );
  if (!rows[0]) return { ok: false, motivo: "no_encontrado" };
  await pool.execute(
    `INSERT IGNORE INTO columnas_ocultas_usuario (usuario_id, columna_id) VALUES (?, ?)`,
    [uid, cid],
  );
  return { ok: true };
}

export async function mostrarColumna(
  usuarioId: string,
  columnaId: string,
): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" }> {
  const uid = usuarioId.trim();
  const cid = columnaId.trim();
  if (!uid || !cid) return { ok: false, motivo: "falta_dato" };
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM columnas_ocultas_usuario WHERE usuario_id = ? AND columna_id = ?`,
    [uid, cid],
  );
  return { ok: true };
}

/** Solo apartados no fijos. Las tareas pasan a "Por hacer". */
export async function borrarColumna(
  columnaId: string,
): Promise<
  { ok: true; porHacerId: string; tareasMovidas: string[] } | { ok: false; motivo: "no_encontrado" | "fija" }
> {
  const pool = await getPool();
  const [rows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden FROM columnas WHERE id = ? LIMIT 1`,
    [columnaId],
  );
  const raw = rows[0];
  if (!raw) return { ok: false, motivo: "no_encontrado" };
  const col = filaAColumna(raw);
  if (col.fija) return { ok: false, motivo: "fija" };

  const cols = await asegurarColumnas(col.proyectoId);
  const porHacer = cols.find((c) => c.fija && c.nombre === "Por hacer");
  if (!porHacer) return { ok: false, motivo: "no_encontrado" };

  const [tareaRows] = await pool.execute<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM tareas WHERE columna_id = ?",
    [columnaId],
  );
  const movidas = tareaRows.map((t) => t.id);

  if (movidas.length > 0) {
    await pool.execute(
      `UPDATE tareas SET columna_id = ?, completada_en = NULL WHERE columna_id = ?`,
      [porHacer.id, columnaId],
    );
  }

  await pool.execute("DELETE FROM columnas WHERE id = ?", [columnaId]);

  const enPorHacer = await listarEnColumna(porHacer.id);
  await reindexarOrdenes(enPorHacer);

  return { ok: true, porHacerId: porHacer.id, tareasMovidas: movidas };
}

export async function crearTarea(input: {
  proyectoId: string;
  nombre: string;
  columnaId?: string;
  fechaPrevista?: string;
  fechaMaxima?: string;
  syncCalendar?: boolean;
  notificarAsignado?: boolean;
  responsableIds?: string[];
  colaboradorIds?: string[];
  mandadaPorId?: string;
  prioridad?: Prioridad;
  dificultad?: Dificultad;
}): Promise<{ ok: true; tarea: Tarea; tareas: Tarea[] } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const proyectoId = input.proyectoId.trim();
  if (!proyectoId) return { ok: false, motivo: "no_encontrado" };
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };

  const cols = await asegurarColumnas(proyectoId);
  const destino =
    (input.columnaId ? cols.find((c) => c.id === input.columnaId) : null) ??
    cols.find((c) => c.fija && c.nombre === "Por hacer") ??
    cols[0];
  if (!destino) return { ok: false, motivo: "falta_dato" };

  const enCol = await listarEnColumna(destino.id);
  const prioridad = input.prioridad ?? "media";
  const dificultad = input.dificultad ?? 3;
  const orden = indicePorPrioridad(enCol, prioridad);
  // Solicitante y asignados ⊆ colaboradores del proyecto (pool vacío ⇒ nadie).
  const poolSet = new Set(normalizarColaboradorIds(input.colaboradorIds ?? []));
  const responsableIds = normalizarColaboradorIds(input.responsableIds ?? []).filter((rid) =>
    poolSet.has(rid),
  );
  const mandadaRaw = input.mandadaPorId?.trim() || null;
  const mandadaPorId = mandadaRaw && poolSet.has(mandadaRaw) ? mandadaRaw : null;
  const fechaPrevista = input.fechaPrevista?.trim() || null;
  const fechaMaxima = input.fechaMaxima?.trim() || null;
  const syncCalendar = input.syncCalendar ?? false;
  const notificarAsignado = input.notificarAsignado ?? false;
  const id = randomUUID();
  const creadoEl = new Date();

  const pool = await getPool();
  await pool.execute(
    `INSERT INTO tareas (
       id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima,
       sync_calendar, notificar_asignado, calendar_event_id, mandada_por_id, responsable_ids,
       prioridad, dificultad, notas, notas_autor_id, notas_creado_en, completada_en, orden, creado_en
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, CAST(? AS JSON), ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
    [
      id,
      proyectoId,
      destino.id,
      nombre,
      fechaPrevista,
      fechaMaxima,
      syncCalendar ? 1 : 0,
      notificarAsignado ? 1 : 0,
      mandadaPorId,
      JSON.stringify(responsableIds),
      prioridad,
      dificultad,
      orden,
      creadoEl,
    ],
  );

  const reordenadas = await listarEnColumna(destino.id, id);
  const nueva: Tarea = {
    id,
    proyectoId,
    columnaId: destino.id,
    nombre,
    fechaPrevista,
    fechaMaxima,
    syncCalendar,
    notificarAsignado,
    calendarEventId: null,
    responsableIds,
    mandadaPorId,
    prioridad,
    dificultad,
    notas: [],
    checklist: [],
    completadaEl: null,
    orden,
    creadoEl: creadoEl.toISOString(),
  };
  reordenadas.splice(orden, 0, nueva);
  await reindexarOrdenes(reordenadas);

  return { ok: true, tarea: nueva, tareas: await tareasDe(proyectoId) };
}

export async function borrarTarea(
  tareaId: string,
  actor: { id: string; correo: string },
): Promise<
  | { ok: true; tareas: Tarea[]; eliminacionId: string }
  | { ok: false; motivo: "no_encontrado" }
> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };

  const { eliminarTareaConPapelera } = await import("@/lib/papelera");
  const r = await eliminarTareaConPapelera(tareaId, actor);
  if (!r.ok) return r;

  const restantes = await listarEnColumna(t.columnaId);
  await reindexarOrdenes(restantes);

  return {
    ok: true,
    tareas: await tareasDe(t.proyectoId),
    eliminacionId: r.eliminacionId,
  };
}

export async function moverTarea(
  tareaId: string,
  columnaId: string,
  indice?: number,
): Promise<{ ok: true; tarea: Tarea; tareas: Tarea[] } | { ok: false; motivo: "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };

  const pool = await getPool();
  const [colRows] = await pool.execute<ColumnaRow[]>(
    `SELECT id, proyecto_id, nombre, fija, orden FROM columnas WHERE id = ? LIMIT 1`,
    [columnaId],
  );
  const colRaw = colRows[0];
  if (!colRaw) return { ok: false, motivo: "no_encontrado" };
  const col = filaAColumna(colRaw);
  if (col.proyectoId !== t.proyectoId) return { ok: false, motivo: "no_encontrado" };

  const origenId = t.columnaId;
  let completadaEl = t.completadaEl;
  if (col.fija && col.nombre === "Terminadas") {
    completadaEl = completadaEl ?? new Date().toISOString();
  } else if (!(col.fija && col.nombre.startsWith("Rechazadas"))) {
    completadaEl = null;
  }

  const destino = await listarEnColumna(columnaId, t.id);
  const idx =
    indice === undefined
      ? indicePorPrioridad(destino, t.prioridad)
      : Math.max(0, Math.min(Math.floor(indice), destino.length));

  await pool.execute(
    `UPDATE tareas SET columna_id = ?, completada_en = ?, orden = ? WHERE id = ?`,
    [columnaId, completadaEl ? new Date(completadaEl) : null, idx, tareaId],
  );

  const movida: Tarea = { ...t, columnaId, completadaEl, orden: idx };
  destino.splice(idx, 0, movida);
  await reindexarOrdenes(destino);
  if (origenId !== columnaId) {
    const origen = await listarEnColumna(origenId);
    await reindexarOrdenes(origen);
  }

  const actualizada = (await tareaPorId(tareaId))!;
  return { ok: true, tarea: actualizada, tareas: await tareasDe(t.proyectoId) };
}

/** Alterna completada: Terminadas ↔ Por hacer (reutiliza moverTarea). */
export async function alternarCompletadaTarea(
  tareaId: string,
): Promise<{ ok: true; tarea: Tarea; tareas: Tarea[] } | { ok: false; motivo: "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };
  const cols = await asegurarColumnas(t.proyectoId);
  const destino = t.completadaEl
    ? cols.find((c) => c.fija && c.nombre === "Por hacer")
    : cols.find((c) => c.fija && c.nombre === "Terminadas");
  if (!destino) return { ok: false, motivo: "no_encontrado" };
  return moverTarea(tareaId, destino.id);
}

export async function editarTarea(input: {
  tareaId: string;
  nombre: string;
  fechaPrevista: string;
  fechaMaxima: string;
  syncCalendar: boolean;
  notificarAsignado: boolean;
  mandadaPorId: string;
  /** Si se indica, el solicitante debe pertenecer a este pool. */
  colaboradorIds?: string[];
  prioridad: Prioridad;
  dificultad: Dificultad;
}): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const t = await tareaPorId(input.tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };

  let fechaPrevista = input.fechaPrevista.trim() || null;
  let fechaMaxima = input.fechaMaxima.trim() || null;
  if (fechaPrevista && fechaMaxima && fechaPrevista > fechaMaxima) {
    fechaPrevista = fechaMaxima;
  }
  const mandadaRaw = input.mandadaPorId.trim() || null;
  // Si se pasa colaboradorIds, el solicitante debe estar en el pool.
  const poolCols = input.colaboradorIds
    ? new Set(normalizarColaboradorIds(input.colaboradorIds))
    : null;
  const mandadaPorId =
    mandadaRaw && (!poolCols || poolCols.has(mandadaRaw)) ? mandadaRaw : null;

  const pool = await getPool();
  await pool.execute(
    `UPDATE tareas
     SET nombre = ?, fecha_prevista = ?, fecha_maxima = ?, sync_calendar = ?,
         notificar_asignado = ?, mandada_por_id = ?, prioridad = ?, dificultad = ?
     WHERE id = ?`,
    [
      nombre,
      fechaPrevista,
      fechaMaxima,
      input.syncCalendar ? 1 : 0,
      input.notificarAsignado ? 1 : 0,
      mandadaPorId,
      input.prioridad,
      input.dificultad,
      input.tareaId,
    ],
  );

  return { ok: true, tarea: (await tareaPorId(input.tareaId))! };
}

export async function asignarCalendarEventId(
  tareaId: string,
  calendarEventId: string | null,
): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };
  const pool = await getPool();
  await pool.execute("UPDATE tareas SET calendar_event_id = ? WHERE id = ?", [
    calendarEventId,
    tareaId,
  ]);
  return { ok: true, tarea: (await tareaPorId(tareaId))! };
}

export async function editarResponsablesTarea(
  tareaId: string,
  responsableIds: string[],
  colaboradorIds?: string[],
): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };
  // Asignados ⊆ colaboradores (pool vacío ⇒ lista vacía).
  const poolSet = new Set(normalizarColaboradorIds(colaboradorIds ?? []));
  const ids = normalizarColaboradorIds(responsableIds).filter((id) => poolSet.has(id));
  const pool = await getPool();
  await pool.execute("UPDATE tareas SET responsable_ids = CAST(? AS JSON) WHERE id = ?", [
    JSON.stringify(ids),
    tareaId,
  ]);
  return { ok: true, tarea: (await tareaPorId(tareaId))! };
}

/** Tras cambiar el equipo del proyecto, limpia responsables de tareas fuera del pool. */
export async function sincronizarColaboradoresProyecto(proyectoId: string, colaboradorIds: string[]) {
  const ok = new Set(normalizarColaboradorIds(colaboradorIds));
  const pool = await getPool();
  const [rows] = await pool.execute<TareaRow[]>(
    `SELECT id, responsable_ids FROM tareas WHERE proyecto_id = ?`,
    [proyectoId],
  );
  for (const r of rows) {
    const actual = parseResponsables(r.responsable_ids);
    const filtrados = actual.filter((id) => ok.has(id));
    if (filtrados.length !== actual.length) {
      await pool.execute("UPDATE tareas SET responsable_ids = CAST(? AS JSON) WHERE id = ?", [
        JSON.stringify(filtrados),
        r.id,
      ]);
    }
  }
}

export async function guardarNotas(
  tareaId: string,
  texto: string,
  autorId: string,
): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };

  const limpio = texto.slice(0, NOTAS_MAX);
  const pool = await getPool();

  if (!limpio.trim()) {
    await pool.execute(
      `UPDATE tareas SET notas = NULL, notas_autor_id = NULL, notas_creado_en = NULL WHERE id = ?`,
      [tareaId],
    );
  } else {
    const autor = autorId.trim() || t.notas[0]?.autorId || U_DEV;
    const creado = t.notas[0]?.creadoEl ? new Date(t.notas[0].creadoEl) : new Date();
    await pool.execute(
      `UPDATE tareas SET notas = ?, notas_autor_id = ?, notas_creado_en = COALESCE(notas_creado_en, ?) WHERE id = ?`,
      [limpio, autor, creado, tareaId],
    );
  }

  return { ok: true, tarea: (await tareaPorId(tareaId))! };
}

export async function anadirChecklist(
  tareaId: string,
  texto: string,
): Promise<{ ok: true; item: ItemChecklist } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const t = await tareaPorId(tareaId);
  if (!t) return { ok: false, motivo: "no_encontrado" };
  const tx = texto.trim().slice(0, CHECKLIST_TEXTO_MAX);
  if (!tx) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const orden = t.checklist.length;
  const id = randomUUID();
  await pool.execute(
    `INSERT INTO tarea_checklist (id, tarea_id, texto, hecho, orden) VALUES (?, ?, ?, 0, ?)`,
    [id, tareaId, tx, orden],
  );
  return { ok: true, item: { id, texto: tx, hecho: false } };
}

export async function toggleChecklist(
  tareaId: string,
  itemId: string,
): Promise<{ ok: true; item: ItemChecklist } | { ok: false; motivo: "no_encontrado" }> {
  const pool = await getPool();
  const [rows] = await pool.execute<ChecklistRow[]>(
    `SELECT id, tarea_id, texto, hecho, orden FROM tarea_checklist WHERE id = ? AND tarea_id = ? LIMIT 1`,
    [itemId, tareaId],
  );
  const r = rows[0];
  if (!r) return { ok: false, motivo: "no_encontrado" };

  const hecho = !Boolean(r.hecho);
  await pool.execute("UPDATE tarea_checklist SET hecho = ? WHERE id = ?", [hecho ? 1 : 0, itemId]);
  return { ok: true, item: { id: r.id, texto: r.texto, hecho } };
}

/** Fixed columns that are not open work (Terminadas / Rechazadas). */
export function esColumnaCerrada(
  col: { fija: boolean; nombre: string } | null | undefined,
): boolean {
  if (!col?.fija) return false;
  return col.nombre === "Terminadas" || col.nombre.startsWith("Rechazadas");
}

export async function contarTareasAbiertasMap(proyectoIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  for (const id of proyectoIds) mapa.set(id, 0);
  if (proyectoIds.length === 0) return mapa;

  const pool = await getPool();
  const placeholders = proyectoIds.map(() => "?").join(",");
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT t.proyecto_id, COUNT(*) AS n FROM tareas t
     JOIN columnas col ON col.id = t.columna_id
     WHERE t.proyecto_id IN (${placeholders})
       AND t.completada_en IS NULL
       AND NOT (col.fija = 1 AND (col.nombre = 'Terminadas' OR col.nombre LIKE 'Rechazadas%'))
     GROUP BY t.proyecto_id`,
    proyectoIds,
  );
  for (const r of rows) mapa.set(r.proyecto_id, Number(r.n) || 0);
  return mapa;
}

export type TareaPanel = {
  id: string;
  nombre: string;
  proyectoId: string;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  fechaMaxima: string | null;
  creadoEl: string;
  completada: boolean;
};

/** Tareas donde el usuario es responsable (para novedades del Panel). */
export async function tareasDelUsuarioParaPanel(usuarioId: string): Promise<TareaPanel[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<
    (RowDataPacket & {
      id: string;
      nombre: string;
      proyecto_id: string;
      fecha_maxima: Date | string | null;
      completada_en: Date | string | null;
      creado_en: Date | string;
      proyecto_nombre: string | null;
      tipo_nombre: string | null;
      cliente_nombre: string | null;
    })[]
  >(
    `SELECT t.id, t.nombre, t.proyecto_id, t.fecha_maxima, t.completada_en, t.creado_en,
            p.nombre AS proyecto_nombre, tp.nombre AS tipo_nombre, c.nombre AS cliente_nombre
     FROM tareas t
     JOIN proyectos p ON p.id = t.proyecto_id
     LEFT JOIN tipos_proyecto tp ON tp.id = p.tipo_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE JSON_CONTAINS(t.responsable_ids, JSON_QUOTE(?))
     ORDER BY t.creado_en DESC
     LIMIT 200`,
    [uid],
  );

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    proyectoId: r.proyecto_id,
    proyectoEtiqueta: r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
    clienteNombre: r.cliente_nombre,
    fechaMaxima: fechaDia(r.fecha_maxima),
    creadoEl: iso(r.creado_en) ?? new Date().toISOString(),
    completada: r.completada_en != null,
  }));
}

/** Marca la tarea como vista por el usuario (idempotente). */
export async function marcarTareaVista(tareaId: string, usuarioId: string): Promise<void> {
  const tid = tareaId.trim();
  const uid = usuarioId.trim();
  if (!tid || !uid) return;
  try {
    const pool = await getPool();
    await pool.execute(
      `INSERT IGNORE INTO tareas_vistas (tarea_id, usuario_id) VALUES (?, ?)`,
      [tid, uid],
    );
  } catch (error) {
    console.error("[tablero] marcarTareaVista falló", { tareaId: tid, usuarioId: uid, error });
  }
}

export type TareaVencidaPanel = {
  id: string;
  nombre: string;
  proyectoId: string;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  fechaMaxima: string;
  esPersonal: boolean;
};

/**
 * Tareas abiertas del usuario con fecha máxima entre `desdeYmd` y `hastaYmd` (inclusive).
 * Panel: últimos 15 días excluyendo ayer (hoy-15 … hoy-2).
 */
export async function tareasVencidasPanel(
  usuarioId: string,
  desdeYmd: string,
  hastaYmd: string,
  limite = 8,
): Promise<TareaVencidaPanel[]> {
  const uid = usuarioId.trim();
  if (!uid || !desdeYmd || !hastaYmd) return [];
  const lim = Math.max(1, Math.min(20, Math.floor(limite)));
  const pool = await getPool();
  const [rows] = await pool.execute<
    (RowDataPacket & {
      id: string;
      nombre: string;
      proyecto_id: string;
      fecha_maxima: Date | string;
      proyecto_nombre: string | null;
      tipo_nombre: string | null;
      cliente_nombre: string | null;
      personal_de_id: string | null;
    })[]
  >(
    `SELECT t.id, t.nombre, t.proyecto_id, t.fecha_maxima, p.personal_de_id,
            p.nombre AS proyecto_nombre, tp.nombre AS tipo_nombre, c.nombre AS cliente_nombre
     FROM tareas t
     JOIN proyectos p ON p.id = t.proyecto_id
     LEFT JOIN tipos_proyecto tp ON tp.id = p.tipo_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE JSON_CONTAINS(t.responsable_ids, JSON_QUOTE(?))
       AND t.completada_en IS NULL
       AND t.fecha_maxima IS NOT NULL
       AND t.fecha_maxima >= ?
       AND t.fecha_maxima <= ?
     ORDER BY t.fecha_maxima ASC, t.nombre ASC
     LIMIT ${lim}`,
    [uid, desdeYmd, hastaYmd],
  );

  return rows.flatMap((r) => {
    const fechaMaxima = fechaDia(r.fecha_maxima);
    if (!fechaMaxima) return [];
    return [
      {
        id: r.id,
        nombre: r.nombre,
        proyectoId: r.proyecto_id,
        proyectoEtiqueta: r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
        clienteNombre: r.cliente_nombre,
        fechaMaxima,
        esPersonal: r.personal_de_id === uid,
      },
    ];
  });
}

export type TareaNuevaSinVer = {
  id: string;
  nombre: string;
  proyectoId: string;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  creadoEl: string;
};

/**
 * Tareas asignadas por otra persona, abiertas, no vistas, no personales,
 * creadas en los últimos `dias` (por defecto 14). Si falta la tabla, [].
 */
export async function tareasNuevasSinVer(
  usuarioId: string,
  dias = 14,
): Promise<TareaNuevaSinVer[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];
  const pool = await getPool();
  try {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        id: string;
        nombre: string;
        proyecto_id: string;
        creado_en: Date | string;
        proyecto_nombre: string | null;
        tipo_nombre: string | null;
        cliente_nombre: string | null;
      })[]
    >(
      `SELECT t.id, t.nombre, t.proyecto_id, t.creado_en,
              p.nombre AS proyecto_nombre, tp.nombre AS tipo_nombre, c.nombre AS cliente_nombre
       FROM tareas t
       JOIN proyectos p ON p.id = t.proyecto_id
       LEFT JOIN tipos_proyecto tp ON tp.id = p.tipo_id
       LEFT JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN tareas_vistas tv ON tv.tarea_id = t.id AND tv.usuario_id = ?
       WHERE JSON_CONTAINS(t.responsable_ids, JSON_QUOTE(?))
         AND t.completada_en IS NULL
         AND t.mandada_por_id IS NOT NULL
         AND t.mandada_por_id <> ?
         AND p.personal_de_id IS NULL
         AND tv.tarea_id IS NULL
         AND t.creado_en >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
       ORDER BY t.creado_en DESC
       LIMIT 20`,
      [uid, uid, uid, dias],
    );

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      proyectoId: r.proyecto_id,
      proyectoEtiqueta: r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
      clienteNombre: r.cliente_nombre,
      creadoEl: iso(r.creado_en) ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[tablero] tareasNuevasSinVer falló (¿falta migración 022?)", {
      usuarioId: uid,
      error,
    });
    return [];
  }
}

export type TareaUsuario = Tarea & {
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  esPersonal: boolean;
  /** Metadatos de la columna del tablero (para filtrar /tareas). */
  columnaFija: boolean;
  columnaNombre: string;
};

/**
 * Obtiene o crea el proyecto oculto "Personal" del usuario.
 * Serializa creaciones concurrentes bloqueando la fila del usuario.
 */
export async function proyectoPersonalDe(usuarioId: string): Promise<string> {
  const uid = usuarioId.trim();
  if (!uid) throw new Error("usuario_id vacío");

  const pool = await getPool();
  const [existentes] = await pool.execute<(RowDataPacket & { id: string })[]>(
    `SELECT id FROM proyectos WHERE personal_de_id = ? LIMIT 1`,
    [uid],
  );
  if (existentes[0]?.id) {
    await asegurarColumnas(existentes[0].id);
    return existentes[0].id;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("SELECT id FROM usuarios WHERE id = ? FOR UPDATE", [uid]);

    const [rows] = await conn.execute<(RowDataPacket & { id: string })[]>(
      `SELECT id FROM proyectos WHERE personal_de_id = ? LIMIT 1`,
      [uid],
    );
    if (rows[0]?.id) {
      await conn.commit();
      await asegurarColumnas(rows[0].id);
      return rows[0].id;
    }

    const id = randomUUID();
    await conn.execute(
      `INSERT INTO proyectos
        (id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato,
         responsable_id, prioridad, estado, personal_de_id)
       VALUES (?, 'interno', 'Personal', NULL, NULL, NULL, NULL, ?, 'media', 'activo', ?)`,
      [id, uid, uid],
    );
    await conn.execute(
      "INSERT IGNORE INTO proyecto_miembros (proyecto_id, usuario_id) VALUES (?, ?)",
      [id, uid],
    );
    await conn.commit();
    await asegurarColumnas(id);
    return id;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Tareas visibles en /tareas: responsable = yo, mandada_por = yo, o proyecto personal.
 * Incluye completadas (la UI las filtra por sección).
 * Excluye «Rechazadas / eliminadas» (no deben listarse fuera del tablero).
 */
export async function tareasDelUsuario(usuarioId: string): Promise<TareaUsuario[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];
  // Asegura que exista el proyecto personal (aunque aún no tenga tareas).
  const personalId = await proyectoPersonalDe(uid);
  const pool = await getPool();
  const [rows] = await pool.execute<
    (TareaRow & {
      proyecto_nombre: string | null;
      tipo_nombre: string | null;
      cliente_nombre: string | null;
      personal_de_id: string | null;
      columna_fija: number | boolean;
      columna_nombre: string;
    })[]
  >(
    `SELECT t.id, t.proyecto_id, t.columna_id, t.nombre, t.fecha_prevista, t.fecha_maxima,
            t.sync_calendar, t.notificar_asignado, t.calendar_event_id, t.mandada_por_id, t.responsable_ids,
            t.prioridad, t.dificultad, t.notas, t.notas_autor_id, t.notas_creado_en, t.completada_en,
            t.orden, t.creado_en,
            p.nombre AS proyecto_nombre, tp.nombre AS tipo_nombre, c.nombre AS cliente_nombre,
            p.personal_de_id,
            col.fija AS columna_fija, col.nombre AS columna_nombre
     FROM tareas t
     JOIN proyectos p ON p.id = t.proyecto_id
     JOIN columnas col ON col.id = t.columna_id
     LEFT JOIN tipos_proyecto tp ON tp.id = p.tipo_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE (p.personal_de_id = ?
        OR JSON_CONTAINS(t.responsable_ids, JSON_QUOTE(?))
        OR t.mandada_por_id = ?)
       AND NOT (col.fija = 1 AND col.nombre LIKE 'Rechazadas%')
     ORDER BY t.fecha_maxima IS NULL ASC, t.fecha_maxima ASC, t.creado_en DESC
     LIMIT 500`,
    [uid, uid, uid],
  );

  const checklist = await checklistPorTareas(rows.map((r) => r.id));
  return rows.map((r) => {
    const base = filaATarea(r, checklist.get(r.id) ?? []);
    const esPersonal = r.personal_de_id === uid || r.proyecto_id === personalId;
    return {
      ...base,
      proyectoEtiqueta: esPersonal
        ? "Personal"
        : r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
      clienteNombre: esPersonal ? null : r.cliente_nombre,
      esPersonal,
      columnaFija: Boolean(r.columna_fija),
      columnaNombre: r.columna_nombre,
    };
  });
}

/**
 * Una tarea enriquecida para /tareas (p. ej. deep-link ?tarea=), aunque no esté
 * en la lista habitual de responsable/solicitante/personal.
 */
export async function tareaUsuarioPorId(tareaId: string): Promise<TareaUsuario | null> {
  const tid = tareaId.trim();
  if (!tid) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<
    (TareaRow & {
      proyecto_nombre: string | null;
      tipo_nombre: string | null;
      cliente_nombre: string | null;
      personal_de_id: string | null;
      columna_fija: number | boolean;
      columna_nombre: string;
    })[]
  >(
    `SELECT t.id, t.proyecto_id, t.columna_id, t.nombre, t.fecha_prevista, t.fecha_maxima,
            t.sync_calendar, t.notificar_asignado, t.calendar_event_id, t.mandada_por_id, t.responsable_ids,
            t.prioridad, t.dificultad, t.notas, t.notas_autor_id, t.notas_creado_en, t.completada_en,
            t.orden, t.creado_en,
            p.nombre AS proyecto_nombre, tp.nombre AS tipo_nombre, c.nombre AS cliente_nombre,
            p.personal_de_id,
            col.fija AS columna_fija, col.nombre AS columna_nombre
     FROM tareas t
     JOIN proyectos p ON p.id = t.proyecto_id
     JOIN columnas col ON col.id = t.columna_id
     LEFT JOIN tipos_proyecto tp ON tp.id = p.tipo_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE t.id = ?
     LIMIT 1`,
    [tid],
  );
  const r = rows[0];
  if (!r) return null;
  const checklist = await checklistPorTareas([tid]);
  const base = filaATarea(r, checklist.get(tid) ?? []);
  const esPersonal = r.personal_de_id != null;
  return {
    ...base,
    proyectoEtiqueta: esPersonal
      ? "Personal"
      : r.proyecto_nombre?.trim() || r.tipo_nombre?.trim() || "Proyecto",
    clienteNombre: esPersonal ? null : r.cliente_nombre,
    esPersonal,
    columnaFija: Boolean(r.columna_fija),
    columnaNombre: r.columna_nombre,
  };
}

/** Ids de eventos Google creados por Orbita (para no duplicar en la capa Google). */
export async function idsEventosCalendarOrbita(): Promise<Set<string>> {
  const pool = await getPool();
  const [rows] = await pool.execute<(RowDataPacket & { calendar_event_id: string })[]>(
    `SELECT calendar_event_id FROM tareas WHERE calendar_event_id IS NOT NULL`,
  );
  return new Set(rows.map((r) => r.calendar_event_id).filter(Boolean));
}

export type BucketTarea = "por_hacer" | "progreso" | "finalizado" | "excluida";

export const COLOR_STATS = {
  porHacer: "#94a3b8",
  porHacerFondo: "#e2e8f0",
  porHacerTexto: "#334155",
  progreso: "#3b82f6",
  progresoSuave: "#38bdf8",
  progresoFuerte: "#2563eb",
  progresoRevision: "#6366f1",
  finalizado: "#22c55e",
  excluida: "#f97316",
} as const;

const AZULES_PROGRESO_EXTRA = [
  COLOR_STATS.progresoSuave,
  COLOR_STATS.progresoFuerte,
  "#0ea5e9",
  "#818cf8",
] as const;

export type StatsEstado = {
  columnaId: string;
  nombre: string;
  fija: boolean;
  count: number;
  color: string;
};

export type StatsUsuario = {
  usuarioId: string | null;
  nombre: string;
  porHacer: number;
  progreso: number;
  finalizado: number;
  total: number;
};

export type StatsProyecto = {
  total: number;
  porHacer: number;
  progreso: number;
  finalizado: number;
  porEstado: StatsEstado[];
  porUsuario: StatsUsuario[];
};

function bucketDeColumna(col: Columna | undefined): BucketTarea {
  if (!col) return "progreso";
  if (col.fija && col.nombre === "Por hacer") return "por_hacer";
  if (col.fija && col.nombre === "Terminadas") return "finalizado";
  if (col.fija && col.nombre === "Rechazadas / eliminadas") return "excluida";
  return "progreso";
}

/** Color de una columna alineado con las tarjetas Por hacer / Progreso / Finalizado. */
function colorDeEstado(col: Columna, columnas: Columna[]): string {
  const bucket = bucketDeColumna(col);
  if (bucket === "por_hacer") return COLOR_STATS.porHacer;
  if (bucket === "finalizado") return COLOR_STATS.finalizado;
  if (bucket === "excluida") return COLOR_STATS.excluida;
  if (col.fija && col.nombre === "En curso") return COLOR_STATS.progreso;
  if (col.fija && col.nombre === "En revisión") return COLOR_STATS.progresoRevision;
  const extras = columnas
    .filter((c) => !c.fija && bucketDeColumna(c) === "progreso")
    .sort((a, b) => a.orden - b.orden);
  const i = extras.findIndex((c) => c.id === col.id);
  return AZULES_PROGRESO_EXTRA[(i < 0 ? 0 : i) % AZULES_PROGRESO_EXTRA.length]!;
}

/** Agrega tareas del proyecto para la vista Info (estilo Holded). */
export function statsProyecto(
  tareas: Tarea[],
  columnas: Columna[],
  equipo: { id: string; nombre: string }[],
): StatsProyecto {
  const colPorId = new Map(columnas.map((c) => [c.id, c]));
  const nombrePorId = new Map(equipo.map((p) => [p.id, p.nombre]));

  let porHacer = 0;
  let progreso = 0;
  let finalizado = 0;

  const countPorCol = new Map<string, number>();
  for (const c of columnas) countPorCol.set(c.id, 0);

  type AccUsuario = { porHacer: number; progreso: number; finalizado: number };
  const porUsuarioMap = new Map<string | null, AccUsuario>();

  function bumpUsuario(uid: string | null, bucket: BucketTarea) {
    if (bucket === "excluida") return;
    const acc = porUsuarioMap.get(uid) ?? { porHacer: 0, progreso: 0, finalizado: 0 };
    if (bucket === "por_hacer") acc.porHacer += 1;
    else if (bucket === "progreso") acc.progreso += 1;
    else acc.finalizado += 1;
    porUsuarioMap.set(uid, acc);
  }

  for (const t of tareas) {
    const col = colPorId.get(t.columnaId);
    const bucket = bucketDeColumna(col);
    countPorCol.set(t.columnaId, (countPorCol.get(t.columnaId) ?? 0) + 1);

    if (bucket === "por_hacer") porHacer += 1;
    else if (bucket === "progreso") progreso += 1;
    else if (bucket === "finalizado") finalizado += 1;

    const ids = t.responsableIds.length > 0 ? t.responsableIds : [null];
    for (const uid of ids) bumpUsuario(uid, bucket);
  }

  const columnasOrdenadas = [...columnas].sort((a, b) => a.orden - b.orden);
  const porEstado: StatsEstado[] = columnasOrdenadas.map((c) => ({
    columnaId: c.id,
    nombre: c.nombre,
    fija: c.fija,
    count: countPorCol.get(c.id) ?? 0,
    color: colorDeEstado(c, columnasOrdenadas),
  }));

  const porUsuario: StatsUsuario[] = [...porUsuarioMap.entries()]
    .map(([usuarioId, acc]) => ({
      usuarioId,
      nombre: usuarioId ? (nombrePorId.get(usuarioId) ?? "Usuario") : "No asignado",
      porHacer: acc.porHacer,
      progreso: acc.progreso,
      finalizado: acc.finalizado,
      total: acc.porHacer + acc.progreso + acc.finalizado,
    }))
    .sort((a, b) => {
      if (a.usuarioId === null) return 1;
      if (b.usuarioId === null) return -1;
      return b.total - a.total || a.nombre.localeCompare(b.nombre, "es");
    });

  return {
    total: porHacer + progreso + finalizado,
    porHacer,
    progreso,
    finalizado,
    porEstado,
    porUsuario,
  };
}
