import { perteneceAlProyecto, type Proyecto } from "@/lib/clientes-mock";
import { clientePorId } from "@/lib/clientes";
import { proyectoPorId } from "@/lib/proyectos";
import { tareaPorId } from "@/lib/tablero";
import type { Tarea } from "@/lib/tareas-mock";
import type { UsuarioAuth } from "@/lib/usuarios";

export type ActorEntidad = Pick<UsuarioAuth, "id" | "esAdmin">;

export type ContextoProyecto = {
  proyecto: Proyecto;
  /** Responsable del cliente de la cuenta (si el proyecto es externo). */
  clienteResponsableId: string | null;
};

export type ContextoTarea = ContextoProyecto & {
  tarea: Tarea;
};

/** Resultado uniforme para server actions. */
export type ResultadoPermiso =
  | { ok: true }
  | { ok: false; motivo: "sin_permiso" | "no_encontrado" };

export function esResponsableProyecto(p: Proyecto, usuarioId: string): boolean {
  return Boolean(p.responsableId && p.responsableId === usuarioId);
}

export function esColaborador(p: Proyecto, usuarioId: string): boolean {
  return perteneceAlProyecto(p, usuarioId);
}

export function esDueñoPersonal(p: Proyecto, usuarioId: string): boolean {
  return Boolean(p.personalDeId && p.personalDeId === usuarioId);
}

export function esSolicitante(t: Tarea, usuarioId: string): boolean {
  return Boolean(t.mandadaPorId && t.mandadaPorId === usuarioId);
}

/** Asignados de la tarea (`responsable_ids` en BD). */
export function esAsignado(t: Tarea, usuarioId: string): boolean {
  return t.responsableIds.includes(usuarioId);
}

export async function cargarContextoProyecto(
  proyectoId: string,
): Promise<ContextoProyecto | null> {
  const proyecto = await proyectoPorId(proyectoId);
  if (!proyecto) return null;
  let clienteResponsableId: string | null = null;
  if (proyecto.clienteId) {
    const cliente = await clientePorId(proyecto.clienteId);
    clienteResponsableId = cliente?.responsableId ?? null;
  }
  return { proyecto, clienteResponsableId };
}

export async function cargarContextoTarea(
  tareaId: string,
): Promise<ContextoTarea | null> {
  const tarea = await tareaPorId(tareaId);
  if (!tarea) return null;
  const ctx = await cargarContextoProyecto(tarea.proyectoId);
  if (!ctx) return null;
  return { ...ctx, tarea };
}

export function esResponsableClienteCtx(
  ctx: ContextoProyecto,
  usuarioId: string,
): boolean {
  return Boolean(ctx.clienteResponsableId && ctx.clienteResponsableId === usuarioId);
}

/** Dueño comercial de la cuenta o admin. */
export async function puedeGestionarCliente(
  actor: ActorEntidad,
  clienteId: string,
): Promise<boolean> {
  if (actor.esAdmin) return true;
  const cliente = await clientePorId(clienteId);
  if (!cliente) return false;
  return Boolean(cliente.responsableId && cliente.responsableId === actor.id);
}

/** Crear proyectos bajo un cliente externo: admin o responsable de cuenta. */
export async function puedeCrearProyectoEnCliente(
  actor: ActorEntidad,
  clienteId: string,
): Promise<boolean> {
  return puedeGestionarCliente(actor, clienteId);
}

export function puedeVerProyectoCtx(
  actor: ActorEntidad,
  ctx: ContextoProyecto,
): boolean {
  if (actor.esAdmin) return true;
  if (esDueñoPersonal(ctx.proyecto, actor.id)) return true;
  if (esResponsableClienteCtx(ctx, actor.id)) return true;
  return esColaborador(ctx.proyecto, actor.id);
}

export async function puedeVerProyecto(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<boolean> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return false;
  return puedeVerProyectoCtx(actor, ctx);
}

/**
 * Editar/borrar proyecto, colaboradores y columnas.
 * Admin | responsable cliente | responsable proyecto | dueño personal.
 */
export function puedeGestionarProyectoCtx(
  actor: ActorEntidad,
  ctx: ContextoProyecto,
): boolean {
  if (actor.esAdmin) return true;
  if (esDueñoPersonal(ctx.proyecto, actor.id)) return true;
  if (esResponsableClienteCtx(ctx, actor.id)) return true;
  return esResponsableProyecto(ctx.proyecto, actor.id);
}

export async function puedeGestionarProyecto(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<boolean> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return false;
  return puedeGestionarProyectoCtx(actor, ctx);
}

/** Crear tareas: gestores + cualquier colaborador. */
export function puedeCrearTareaCtx(
  actor: ActorEntidad,
  ctx: ContextoProyecto,
): boolean {
  if (puedeGestionarProyectoCtx(actor, ctx)) return true;
  return esColaborador(ctx.proyecto, actor.id);
}

export async function puedeCrearTarea(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<boolean> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return false;
  return puedeCrearTareaCtx(actor, ctx);
}

/**
 * Editar contenido / mover entre columnas:
 * gestores | solicitante | asignado.
 */
export function puedeEditarTareaCtx(
  actor: ActorEntidad,
  ctx: ContextoTarea,
): boolean {
  if (puedeGestionarProyectoCtx(actor, ctx)) return true;
  if (esSolicitante(ctx.tarea, actor.id)) return true;
  return esAsignado(ctx.tarea, actor.id);
}

export const puedeMoverTareaCtx = puedeEditarTareaCtx;

export async function puedeEditarTarea(
  actor: ActorEntidad,
  tareaId: string,
): Promise<boolean> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return false;
  return puedeEditarTareaCtx(actor, ctx);
}

export async function puedeMoverTarea(
  actor: ActorEntidad,
  tareaId: string,
): Promise<boolean> {
  return puedeEditarTarea(actor, tareaId);
}

/** Borrar: gestores | solicitante (no asignado solo). */
export function puedeBorrarTareaCtx(
  actor: ActorEntidad,
  ctx: ContextoTarea,
): boolean {
  if (puedeGestionarProyectoCtx(actor, ctx)) return true;
  return esSolicitante(ctx.tarea, actor.id);
}

export async function puedeBorrarTarea(
  actor: ActorEntidad,
  tareaId: string,
): Promise<boolean> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return false;
  return puedeBorrarTareaCtx(actor, ctx);
}

/** Cambiar asignados: gestores | solicitante. */
export function puedeCambiarAsignadosCtx(
  actor: ActorEntidad,
  ctx: ContextoTarea,
): boolean {
  if (puedeGestionarProyectoCtx(actor, ctx)) return true;
  return esSolicitante(ctx.tarea, actor.id);
}

export async function puedeCambiarAsignados(
  actor: ActorEntidad,
  tareaId: string,
): Promise<boolean> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return false;
  return puedeCambiarAsignadosCtx(actor, ctx);
}

/** Cambiar solicitante: solo gestores (no asignado ni solicitante). */
export function puedeCambiarSolicitanteCtx(
  actor: ActorEntidad,
  ctx: ContextoProyecto,
): boolean {
  return puedeGestionarProyectoCtx(actor, ctx);
}

export async function puedeCambiarSolicitante(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<boolean> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return false;
  return puedeCambiarSolicitanteCtx(actor, ctx);
}

/**
 * Notas / chat / adjuntos: ver el proyecto basta
 * (colaborador ve todas las tareas; puede interactuar).
 */
export function puedeNotasChatAdjuntosCtx(
  actor: ActorEntidad,
  ctx: ContextoTarea,
): boolean {
  if (actor.esAdmin) return true;
  if (esDueñoPersonal(ctx.proyecto, actor.id)) return true;
  if (esSolicitante(ctx.tarea, actor.id) || esAsignado(ctx.tarea, actor.id)) {
    return true;
  }
  return puedeVerProyectoCtx(actor, ctx);
}

export async function puedeNotasChatAdjuntos(
  actor: ActorEntidad,
  tareaId: string,
): Promise<boolean> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return false;
  return puedeNotasChatAdjuntosCtx(actor, ctx);
}

/** Flags de UI para un proyecto (server components). */
export type FlagsProyecto = {
  puedeVer: boolean;
  puedeGestionar: boolean;
  puedeCrearTarea: boolean;
  puedeCambiarSolicitante: boolean;
};

export function flagsProyecto(
  actor: ActorEntidad,
  ctx: ContextoProyecto,
): FlagsProyecto {
  return {
    puedeVer: puedeVerProyectoCtx(actor, ctx),
    puedeGestionar: puedeGestionarProyectoCtx(actor, ctx),
    puedeCrearTarea: puedeCrearTareaCtx(actor, ctx),
    puedeCambiarSolicitante: puedeCambiarSolicitanteCtx(actor, ctx),
  };
}

/** Flags de UI para una tarea. */
export type FlagsTarea = FlagsProyecto & {
  puedeEditar: boolean;
  puedeMover: boolean;
  puedeBorrar: boolean;
  puedeCambiarAsignados: boolean;
  puedeNotasChatAdjuntos: boolean;
  soloLectura: boolean;
};

export function flagsTarea(actor: ActorEntidad, ctx: ContextoTarea): FlagsTarea {
  const base = flagsProyecto(actor, ctx);
  const puedeEditar = puedeEditarTareaCtx(actor, ctx);
  return {
    ...base,
    puedeEditar,
    puedeMover: puedeEditar,
    puedeBorrar: puedeBorrarTareaCtx(actor, ctx),
    puedeCambiarAsignados: puedeCambiarAsignadosCtx(actor, ctx),
    puedeCambiarSolicitante: puedeCambiarSolicitanteCtx(actor, ctx),
    puedeNotasChatAdjuntos: puedeNotasChatAdjuntosCtx(actor, ctx),
    soloLectura: base.puedeVer && !puedeEditar,
  };
}

export async function exigirGestionCliente(
  actor: ActorEntidad,
  clienteId: string,
): Promise<ResultadoPermiso> {
  const cliente = await clientePorId(clienteId);
  if (!cliente) return { ok: false, motivo: "no_encontrado" };
  if (!(await puedeGestionarCliente(actor, clienteId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true };
}

export async function exigirGestionProyecto(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<ResultadoPermiso & { ctx?: ContextoProyecto }> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return { ok: false, motivo: "no_encontrado" };
  if (!puedeGestionarProyectoCtx(actor, ctx)) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, ctx };
}

export async function exigirCrearTarea(
  actor: ActorEntidad,
  proyectoId: string,
): Promise<ResultadoPermiso & { ctx?: ContextoProyecto }> {
  const ctx = await cargarContextoProyecto(proyectoId);
  if (!ctx) return { ok: false, motivo: "no_encontrado" };
  if (!puedeCrearTareaCtx(actor, ctx)) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, ctx };
}

export async function exigirEditarTarea(
  actor: ActorEntidad,
  tareaId: string,
): Promise<ResultadoPermiso & { ctx?: ContextoTarea }> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return { ok: false, motivo: "no_encontrado" };
  if (!puedeEditarTareaCtx(actor, ctx)) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, ctx };
}

export async function exigirBorrarTarea(
  actor: ActorEntidad,
  tareaId: string,
): Promise<ResultadoPermiso & { ctx?: ContextoTarea }> {
  const ctx = await cargarContextoTarea(tareaId);
  if (!ctx) return { ok: false, motivo: "no_encontrado" };
  if (!puedeBorrarTareaCtx(actor, ctx)) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, ctx };
}

/**
 * Solicitante y asignados deben pertenecer al pool de colaboradores del proyecto.
 * Si el pool está vacío, no se admite ningún id (salvo lista vacía de asignados / solicitante null).
 */
export function filtrarIdsEnColaboradores(
  ids: string[],
  colaboradorIds: string[],
): string[] {
  const pool = new Set(
    colaboradorIds.map((id) => id.trim()).filter(Boolean),
  );
  return ids
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id, i, arr) => arr.indexOf(id) === i && pool.has(id));
}

export function solicitanteEnColaboradores(
  mandadaPorId: string | null | undefined,
  colaboradorIds: string[],
): string | null {
  const id = mandadaPorId?.trim() || null;
  if (!id) return null;
  const pool = new Set(
    colaboradorIds.map((c) => c.trim()).filter(Boolean),
  );
  return pool.has(id) ? id : null;
}
