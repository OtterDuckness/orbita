import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import {
  clientePorId,
  editarCliente,
  type Cliente,
  type OrigenAlta,
} from "@/lib/clientes";
import { getPool } from "@/lib/db";
import { restaurarEliminacion } from "@/lib/papelera";
import {
  cambiarEstadoProyecto,
  proyectoPorId,
  type EstadoProyecto,
} from "@/lib/proyectos";
import {
  editarResponsablesTarea,
  editarTarea,
  moverTarea,
  tareaPorId,
} from "@/lib/tablero";
import type { Dificultad, Prioridad, Tarea } from "@/lib/tareas-mock";
import type { UsuarioAuth } from "@/lib/usuarios";

/** Snapshots for before/after (shared by UI actions + agent tools). */
export function snapTareaPosicion(t: Tarea) {
  return {
    columnaId: t.columnaId,
    orden: t.orden,
    completadaEl: t.completadaEl,
  };
}

export function snapTareaEdit(t: Tarea) {
  return {
    nombre: t.nombre,
    fechaPrevista: t.fechaPrevista ?? "",
    fechaMaxima: t.fechaMaxima ?? "",
    syncCalendar: Boolean(t.syncCalendar),
    notificarAsignado: Boolean(t.notificarAsignado),
    mandadaPorId: t.mandadaPorId ?? "",
    prioridad: t.prioridad,
    dificultad: t.dificultad,
  };
}

export function snapTareaResponsables(t: Tarea) {
  return { responsableIds: [...t.responsableIds].sort() };
}

export function snapProyectoEstado(estado: string) {
  return { estado };
}

export function snapCliente(c: Pick<
  Cliente,
  "nombre" | "correoAcceso" | "telefono" | "responsableId" | "tipoCuenta" | "origen"
>) {
  return {
    nombre: c.nombre,
    correoAcceso: c.correoAcceso,
    telefono: c.telefono ?? "",
    responsableId: c.responsableId ?? "",
    tipoCuenta: c.tipoCuenta ?? "",
    origen: c.origen === "clientify" ? "clientify" : "manual",
  };
}

export const DIAS_RETENCION_DESHACER = 7;

export type ViaAccion = "ui" | "asistente";

/** Tipos de fase 1; el registro en call-sites de dominio es el siguiente paso. */
export type TipoAccionReversible =
  | "tarea_movida"
  | "tarea_completada"
  | "tarea_responsables"
  | "tarea_editada"
  | "proyecto_estado"
  | "cliente_editado"
  | "eliminacion";

export type AccionDeshacerLista = {
  id: string;
  via: ViaAccion;
  tipo: TipoAccionReversible;
  etiqueta: string;
  entidadTipo: string | null;
  entidadId: string | null;
  creadoEn: string;
  expiraEn: string;
};

export type MotivoDeshacer =
  | "no_encontrado"
  | "ya_deshecho"
  | "expirado"
  | "sin_permiso"
  | "conflicto"
  | "fallo_aplicar";

type AccionRow = RowDataPacket & {
  id: string;
  actor_id: string;
  via: ViaAccion;
  tipo: string;
  etiqueta: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  before_json: unknown;
  after_json: unknown;
  eliminacion_id: string | null;
  conversacion_id: string | null;
  creado_en: Date | string;
  expira_en: Date | string;
  deshecho_en: Date | string | null;
};

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function esTipo(v: string): v is TipoAccionReversible {
  return (
    v === "tarea_movida" ||
    v === "tarea_completada" ||
    v === "tarea_responsables" ||
    v === "tarea_editada" ||
    v === "proyecto_estado" ||
    v === "cliente_editado" ||
    v === "eliminacion"
  );
}

export type RegistrarAccionInput = {
  actorId: string;
  via?: ViaAccion;
  tipo: TipoAccionReversible;
  etiqueta: string;
  entidadTipo?: string | null;
  entidadId?: string | null;
  before: Record<string, unknown>;
  after?: Record<string, unknown> | null;
  eliminacionId?: string | null;
  conversacionId?: string | null;
};

/** Inserta una acción reversible (retención 7 días). */
export async function registrarAccionReversible(
  input: RegistrarAccionInput,
): Promise<string> {
  const id = randomUUID();
  const expira = new Date();
  expira.setUTCDate(expira.getUTCDate() + DIAS_RETENCION_DESHACER);
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO acciones_reversibles
      (id, actor_id, via, tipo, etiqueta, entidad_tipo, entidad_id,
       before_json, after_json, eliminacion_id, conversacion_id, expira_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
    [
      id,
      input.actorId,
      input.via ?? "ui",
      input.tipo,
      input.etiqueta.slice(0, 500),
      input.entidadTipo ?? null,
      input.entidadId ?? null,
      JSON.stringify(input.before ?? {}),
      input.after != null ? JSON.stringify(input.after) : null,
      input.eliminacionId ?? null,
      input.conversacionId ?? null,
      expira,
    ],
  );
  return id;
}

export async function listarAccionesDeshacer(
  usuario: UsuarioAuth,
  opts?: { limite?: number },
): Promise<AccionDeshacerLista[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 50, 1), 100);
  const pool = await getPool();
  const [rows] = await pool.execute<AccionRow[]>(
    `SELECT id, actor_id, via, tipo, etiqueta, entidad_tipo, entidad_id,
            before_json, after_json, eliminacion_id, conversacion_id,
            creado_en, expira_en, deshecho_en
     FROM acciones_reversibles
     WHERE actor_id = ?
       AND deshecho_en IS NULL
       AND expira_en > UTC_TIMESTAMP(3)
     ORDER BY creado_en DESC
     LIMIT ${limite}`,
    [usuario.id],
  );
  return rows
    .filter((r) => esTipo(r.tipo))
    .map((r) => ({
      id: r.id,
      via: r.via === "asistente" ? "asistente" : "ui",
      tipo: r.tipo as TipoAccionReversible,
      etiqueta: r.etiqueta,
      entidadTipo: r.entidad_tipo,
      entidadId: r.entidad_id,
      creadoEn: iso(r.creado_en)!,
      expiraEn: iso(r.expira_en)!,
    }));
}

export async function obtenerAccionDeshacer(
  id: string,
): Promise<AccionRow | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<AccionRow[]>(
    `SELECT id, actor_id, via, tipo, etiqueta, entidad_tipo, entidad_id,
            before_json, after_json, eliminacion_id, conversacion_id,
            creado_en, expira_en, deshecho_en
     FROM acciones_reversibles WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

async function estadoActualTareaPosicion(tareaId: string) {
  const t = await tareaPorId(tareaId);
  if (!t) return null;
  return {
    columnaId: t.columnaId,
    orden: t.orden,
    completadaEl: t.completadaEl,
  };
}

async function estadoActualResponsables(tareaId: string) {
  const t = await tareaPorId(tareaId);
  if (!t) return null;
  return { responsableIds: [...t.responsableIds].sort() };
}

async function estadoActualTareaEdit(tareaId: string) {
  const t = await tareaPorId(tareaId);
  if (!t) return null;
  return {
    nombre: t.nombre,
    fechaPrevista: t.fechaPrevista ?? "",
    fechaMaxima: t.fechaMaxima ?? "",
    syncCalendar: Boolean(t.syncCalendar),
    notificarAsignado: Boolean(t.notificarAsignado),
    mandadaPorId: t.mandadaPorId ?? "",
    prioridad: t.prioridad,
    dificultad: t.dificultad,
  };
}

async function estadoActualProyectoEstado(proyectoId: string) {
  const p = await proyectoPorId(proyectoId);
  if (!p) return null;
  return { estado: p.estado };
}

async function estadoActualCliente(clienteId: string) {
  const c = await clientePorId(clienteId);
  if (!c) return null;
  return snapCliente(c);
}

function conflictoSiHaceFalta(
  actual: unknown,
  after: Record<string, unknown>,
  before: Record<string, unknown>,
): MotivoDeshacer | null {
  if (sameJson(actual, before)) return null; // ya en el estado previo
  if (after && Object.keys(after).length > 0 && !sameJson(actual, after)) {
    return "conflicto";
  }
  return null;
}

async function aplicarUndo(
  usuario: UsuarioAuth,
  row: AccionRow,
): Promise<{ ok: true } | { ok: false; motivo: MotivoDeshacer }> {
  if (!esTipo(row.tipo)) return { ok: false, motivo: "fallo_aplicar" };
  const before = asRecord(row.before_json);
  const after = asRecord(row.after_json);
  const entidadId = row.entidad_id;

  switch (row.tipo) {
    case "tarea_movida":
    case "tarea_completada": {
      if (!entidadId) return { ok: false, motivo: "fallo_aplicar" };
      const actual = await estadoActualTareaPosicion(entidadId);
      if (!actual) return { ok: false, motivo: "no_encontrado" };
      const conf = conflictoSiHaceFalta(actual, after, {
        columnaId: before.columnaId,
        orden: before.orden,
        completadaEl: before.completadaEl ?? null,
      });
      if (conf) return { ok: false, motivo: conf };
      if (sameJson(actual, {
        columnaId: before.columnaId,
        orden: before.orden,
        completadaEl: before.completadaEl ?? null,
      })) {
        return { ok: true };
      }
      const colId = typeof before.columnaId === "string" ? before.columnaId : "";
      const orden =
        typeof before.orden === "number" ? before.orden : Number(before.orden);
      if (!colId || Number.isNaN(orden)) return { ok: false, motivo: "fallo_aplicar" };
      const r = await moverTarea(entidadId, colId, orden);
      return r.ok ? { ok: true } : { ok: false, motivo: "fallo_aplicar" };
    }
    case "tarea_responsables": {
      if (!entidadId) return { ok: false, motivo: "fallo_aplicar" };
      const actual = await estadoActualResponsables(entidadId);
      if (!actual) return { ok: false, motivo: "no_encontrado" };
      const beforeIds = strArr(before.responsableIds).slice().sort();
      const afterIds = strArr(after.responsableIds).slice().sort();
      const conf = conflictoSiHaceFalta(
        actual,
        { responsableIds: afterIds },
        { responsableIds: beforeIds },
      );
      if (conf) return { ok: false, motivo: conf };
      if (sameJson(actual, { responsableIds: beforeIds })) return { ok: true };
      const t = await tareaPorId(entidadId);
      if (!t) return { ok: false, motivo: "no_encontrado" };
      const proy = await proyectoPorId(t.proyectoId);
      const colaboradorIds =
        proy?.colaboradorIds?.length
          ? proy.colaboradorIds
          : [...new Set([...beforeIds, ...t.responsableIds])];
      const r = await editarResponsablesTarea(entidadId, beforeIds, colaboradorIds);
      return r.ok ? { ok: true } : { ok: false, motivo: "fallo_aplicar" };
    }
    case "tarea_editada": {
      if (!entidadId) return { ok: false, motivo: "fallo_aplicar" };
      const actual = await estadoActualTareaEdit(entidadId);
      if (!actual) return { ok: false, motivo: "no_encontrado" };
      const beforeEdit = {
        nombre: String(before.nombre ?? ""),
        fechaPrevista: String(before.fechaPrevista ?? ""),
        fechaMaxima: String(before.fechaMaxima ?? ""),
        syncCalendar: Boolean(before.syncCalendar),
        notificarAsignado: Boolean(before.notificarAsignado),
        mandadaPorId: String(before.mandadaPorId ?? ""),
        prioridad: before.prioridad as Prioridad,
        dificultad: before.dificultad as Dificultad,
      };
      const conf = conflictoSiHaceFalta(actual, after, beforeEdit);
      if (conf) return { ok: false, motivo: conf };
      if (sameJson(actual, beforeEdit)) return { ok: true };
      const r = await editarTarea({
        tareaId: entidadId,
        ...beforeEdit,
      });
      return r.ok ? { ok: true } : { ok: false, motivo: "fallo_aplicar" };
    }
    case "proyecto_estado": {
      if (!entidadId) return { ok: false, motivo: "fallo_aplicar" };
      const actual = await estadoActualProyectoEstado(entidadId);
      if (!actual) return { ok: false, motivo: "no_encontrado" };
      const estadoBefore = String(before.estado ?? "") as EstadoProyecto;
      const conf = conflictoSiHaceFalta(actual, after, { estado: estadoBefore });
      if (conf) return { ok: false, motivo: conf };
      if (sameJson(actual, { estado: estadoBefore })) return { ok: true };
      const r = await cambiarEstadoProyecto(entidadId, estadoBefore);
      return r.ok ? { ok: true } : { ok: false, motivo: "fallo_aplicar" };
    }
    case "cliente_editado": {
      if (!entidadId) return { ok: false, motivo: "fallo_aplicar" };
      const actual = await estadoActualCliente(entidadId);
      if (!actual) return { ok: false, motivo: "no_encontrado" };
      const beforeEdit = {
        nombre: String(before.nombre ?? ""),
        correoAcceso: String(before.correoAcceso ?? ""),
        telefono: String(before.telefono ?? ""),
        responsableId: String(before.responsableId ?? ""),
        tipoCuenta: String(before.tipoCuenta ?? ""),
        origen: (before.origen === "clientify" ? "clientify" : "manual") as OrigenAlta,
      };
      const conf = conflictoSiHaceFalta(actual, after, beforeEdit);
      if (conf) return { ok: false, motivo: conf };
      if (sameJson(actual, beforeEdit)) return { ok: true };
      const r = await editarCliente({
        clienteId: entidadId,
        nombre: beforeEdit.nombre,
        correoAcceso: beforeEdit.correoAcceso,
        telefono: beforeEdit.telefono,
        responsableId: beforeEdit.responsableId || undefined,
        tipoCuenta: beforeEdit.tipoCuenta || null,
        origen: beforeEdit.origen,
      });
      return r.ok ? { ok: true } : { ok: false, motivo: "fallo_aplicar" };
    }
    case "eliminacion": {
      const elimId =
        row.eliminacion_id ||
        (typeof before.eliminacionId === "string" ? before.eliminacionId : "");
      if (!elimId) return { ok: false, motivo: "fallo_aplicar" };
      const r = await restaurarEliminacion(elimId, usuario);
      if (!r.ok) {
        if (r.motivo === "ya_restaurado") return { ok: true };
        if (
          r.motivo === "expirado" ||
          r.motivo === "conflicto" ||
          r.motivo === "dependencia_faltante" ||
          r.motivo === "sin_permiso" ||
          r.motivo === "no_encontrado"
        ) {
          return {
            ok: false,
            motivo:
              r.motivo === "dependencia_faltante" || r.motivo === "conflicto"
                ? "conflicto"
                : r.motivo === "sin_permiso"
                  ? "sin_permiso"
                  : r.motivo === "expirado"
                    ? "expirado"
                    : "fallo_aplicar",
          };
        }
        return { ok: false, motivo: "fallo_aplicar" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, motivo: "fallo_aplicar" };
  }
}

export async function deshacerAccion(
  accionId: string,
  usuario: UsuarioAuth,
): Promise<
  | { ok: true; etiqueta: string; tipo: TipoAccionReversible }
  | { ok: false; motivo: MotivoDeshacer }
> {
  const row = await obtenerAccionDeshacer(accionId);
  if (!row) return { ok: false, motivo: "no_encontrado" };
  if (row.actor_id !== usuario.id) return { ok: false, motivo: "sin_permiso" };
  if (row.deshecho_en) return { ok: false, motivo: "ya_deshecho" };
  const expira = new Date(row.expira_en);
  if (Number.isNaN(expira.getTime()) || expira.getTime() <= Date.now()) {
    return { ok: false, motivo: "expirado" };
  }
  if (!esTipo(row.tipo)) return { ok: false, motivo: "fallo_aplicar" };

  const aplicado = await aplicarUndo(usuario, row);
  if (!aplicado.ok) return aplicado;

  const pool = await getPool();
  await pool.execute(
    `UPDATE acciones_reversibles
     SET deshecho_en = UTC_TIMESTAMP(3)
     WHERE id = ? AND deshecho_en IS NULL`,
    [accionId],
  );

  return {
    ok: true,
    etiqueta: row.etiqueta,
    tipo: row.tipo,
  };
}

/** Etiqueta corta para UI. */
export function etiquetaTipoAccion(tipo: TipoAccionReversible): string {
  switch (tipo) {
    case "tarea_movida":
      return "Mover tarea";
    case "tarea_completada":
      return "Completar / reabrir";
    case "tarea_responsables":
      return "Responsables";
    case "tarea_editada":
      return "Editar tarea";
    case "proyecto_estado":
      return "Estado proyecto";
    case "cliente_editado":
      return "Editar cliente";
    case "eliminacion":
      return "Eliminación";
    default:
      return tipo;
  }
}
