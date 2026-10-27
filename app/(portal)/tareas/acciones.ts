"use server";

import { formatearAlta, logActividad } from "@/lib/admin-logs";
import { exigirPermiso } from "@/lib/authz";
import {
  registrarAccionReversible,
  snapTareaPosicion,
} from "@/lib/deshacer";
import { sincronizarTareaConCalendar } from "@/lib/google-calendar";
import { puedeEditarTarea, puedeNotasChatAdjuntos } from "@/lib/permisos-entidad";
import {
  alternarCompletadaTarea,
  crearTarea,
  marcarTareaVista,
  proyectoPersonalDe,
  tareaPorId,
  tareasDelUsuario,
  type TareaUsuario,
} from "@/lib/tablero";
import type { Tarea } from "@/lib/tareas-mock";

export async function crearTareaPersonal(
  formData: FormData,
): Promise<
  | { ok: true; tarea: Tarea; tareas: TareaUsuario[] }
  | { ok: false; motivo: string }
> {
  const usuario = await exigirPermiso("tareas.editar");
  const nombre = String(formData.get("nombre") ?? "");
  const fechaMaxima = String(formData.get("fecha_maxima") ?? "").trim() || undefined;
  const seccion = String(formData.get("seccion") ?? "hoy");
  const syncCalendar =
    formData.get("sync_calendar") === "on" || formData.get("sync_calendar") === "1";

  let fecha: string | undefined = fechaMaxima;
  if (!fecha) {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    if (seccion === "manana") {
      base.setDate(base.getDate() + 1);
    } else if (seccion === "esta_semana") {
      // Viernes de esta semana laboral (si hoy es viernes, queda hoy)
      const dow = base.getDay(); // 0=dom … 6=sáb
      const atrasLunes = dow === 0 ? 6 : dow - 1;
      base.setDate(base.getDate() - atrasLunes + 4);
    } else if (seccion === "este_mes") {
      // Último laborable del mes
      base.setMonth(base.getMonth() + 1, 0);
      const dow = base.getDay();
      if (dow === 6) base.setDate(base.getDate() - 1);
      if (dow === 0) base.setDate(base.getDate() - 2);
    }
    if (
      seccion === "hoy" ||
      seccion === "manana" ||
      seccion === "esta_semana" ||
      seccion === "este_mes"
    ) {
      const y = base.getFullYear();
      const m = String(base.getMonth() + 1).padStart(2, "0");
      const d = String(base.getDate()).padStart(2, "0");
      fecha = `${y}-${m}-${d}`;
    }
  }

  const proyectoId = await proyectoPersonalDe(usuario.id);
  const r = await crearTarea({
    proyectoId,
    nombre,
    fechaMaxima: fecha,
    responsableIds: [usuario.id],
    colaboradorIds: [usuario.id],
    mandadaPorId: usuario.id,
    syncCalendar,
    prioridad: "media",
    dificultad: 3,
  });

  if (!r.ok) return r;

  await sincronizarTareaConCalendar(r.tarea, usuario.correo);
  const tarea = (await tareaPorId(r.tarea.id)) ?? r.tarea;

  await logActividad(
    usuario,
    "tarea_creada",
    formatearAlta(`Tarea personal «${tarea.nombre}»`, [
      { campo: "modo", valor: "personal" },
      { campo: "fecha máxima", valor: tarea.fechaMaxima },
      { campo: "calendar", valor: syncCalendar ? "sí" : "no" },
    ]),
    { tareaId: tarea.id, proyectoId, personal: true },
  );

  const tareas = await tareasDelUsuario(usuario.id);
  return { ok: true, tarea, tareas };
}

export async function alternarCompletadaAction(
  formData: FormData,
): Promise<
  | { ok: true; tarea: Tarea; tareas: TareaUsuario[] }
  | { ok: false; motivo: string }
> {
  const usuario = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeEditarTarea(usuario, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }

  const antes = await tareaPorId(tareaId);
  const r = await alternarCompletadaTarea(tareaId);
  if (!r.ok) return r;

  await logActividad(
    usuario,
    r.tarea.completadaEl ? "tarea_completada" : "tarea_reabierta",
    formatearAlta(`Tarea «${r.tarea.nombre}»`, [
      { campo: "estado", valor: r.tarea.completadaEl ? "completada" : "abierta" },
    ]),
    { tareaId: r.tarea.id, proyectoId: r.tarea.proyectoId },
  );
  if (antes) {
    await registrarAccionReversible({
      actorId: usuario.id,
      via: "ui",
      tipo: "tarea_completada",
      etiqueta: r.tarea.completadaEl
        ? `Completar «${r.tarea.nombre}»`
        : `Reabrir «${r.tarea.nombre}»`,
      entidadTipo: "tarea",
      entidadId: tareaId,
      before: snapTareaPosicion(antes),
      after: snapTareaPosicion(r.tarea),
    }).catch((e) => console.error("[deshacer] registrar completar tarea", e));
  }

  await sincronizarTareaConCalendar(r.tarea, usuario.correo);

  const tareas = await tareasDelUsuario(usuario.id);
  return { ok: true, tarea: r.tarea, tareas };
}

/** Marca la tarea como vista al abrir el detalle (Panel → novedades). */
export async function marcarTareaVistaAction(tareaId: string): Promise<void> {
  const usuario = await exigirPermiso("tareas.ver");
  const id = String(tareaId ?? "").trim();
  if (!id) return;
  if (!(await puedeNotasChatAdjuntos(usuario, id))) return;
  await marcarTareaVista(id, usuario.id);
}
