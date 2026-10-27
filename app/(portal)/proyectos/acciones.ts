"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatearAlta, formatearCambios, logActividad } from "@/lib/admin-logs";
import { exigirPermiso } from "@/lib/authz";
import { clientePorId } from "@/lib/clientes";
import {
  registrarAccionReversible,
  snapProyectoEstado,
  snapTareaEdit,
  snapTareaPosicion,
  snapTareaResponsables,
} from "@/lib/deshacer";
import {
  alternarFavoritoProyecto,
  archivarProyectosTerminados,
  cambiarEstadoProyecto,
  crearProyecto,
  editarProyecto,
  eliminarProyecto,
  proyectoPorId,
  type AmbitoProyecto,
} from "@/lib/proyectos";
import {
  crearTipoProyecto,
  eliminarTipoProyecto,
  renombrarTipoProyecto,
  tipoPorId,
} from "@/lib/tipos-proyecto";
import {
  borrarEventoSiExiste,
  borrarEventosCalendarDeProyectos,
  sincronizarTareaConCalendar,
} from "@/lib/google-calendar";
import { notificarAsignacionTarea } from "@/lib/email/notificar-asignacion-tarea";
import {
  puedeBorrarTarea,
  puedeCambiarAsignados,
  puedeCambiarSolicitante,
  puedeCrearProyectoEnCliente,
  puedeCrearTarea,
  puedeEditarTarea,
  puedeGestionarProyecto,
  puedeMoverTarea,
  puedeNotasChatAdjuntos,
  puedeVerProyecto,
} from "@/lib/permisos-entidad";
import { tokensGooglePorCorreo, usuarioPorId } from "@/lib/usuarios";
import {
  alternarCompletadaTarea,
  anadirChecklist,
  borrarColumna,
  borrarTarea,
  columnaPorId,
  crearColumna,
  crearTarea,
  editarResponsablesTarea,
  editarTarea,
  guardarNotas,
  mostrarColumna,
  moverTarea,
  ocultarColumna,
  reordenarColumna,
  sincronizarColaboradoresProyecto,
  tareaPorId,
  toggleChecklist,
} from "@/lib/tablero";
import {
  DIFICULTADES,
  type Columna,
  type Dificultad,
  type ItemChecklist,
  type Prioridad,
  type Tarea,
} from "@/lib/tareas-mock";

/** Conserva ?todo=1 (Ver todo) al volver a la lista tras una acción. */
async function redirectListaProyectos(aviso: string): Promise<never> {
  let todo = false;
  const ref = (await headers()).get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      todo = u.pathname === "/proyectos" && u.searchParams.get("todo") === "1";
    } catch {
      /* ignore */
    }
  }
  const q = new URLSearchParams({ aviso });
  if (todo) q.set("todo", "1");
  return redirect(`/proyectos?${q.toString()}`);
}

function idsColaboradores(formData: FormData) {
  return formData.getAll("colaborador_ids").map(String);
}

async function nombreUsuario(id: string | null | undefined): Promise<string> {
  if (!id) return "—";
  const u = await usuarioPorId(id);
  return u?.nombre ?? id.slice(0, 8);
}

export async function crearProyectoNuevo(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const ambitoRaw = String(formData.get("ambito") ?? "interno");
  const ambito: AmbitoProyecto = ambitoRaw === "externo" ? "externo" : "interno";
  const clienteId = String(formData.get("cliente_id") ?? "").trim();

  if (ambito === "externo") {
    if (!clienteId) return await redirectListaProyectos("cliente_obligatorio");
    if (!(await clientePorId(clienteId))) {
      return await redirectListaProyectos("no_encontrado");
    }
    if (!(await puedeCrearProyectoEnCliente(actor, clienteId))) {
      return await redirectListaProyectos("sin_permiso");
    }
  }

  const responsableId =
    String(formData.get("responsable_id") ?? "").trim() || actor.id;

  const resultado = await crearProyecto({
    ambito,
    clienteId,
    nombre: String(formData.get("nombre") ?? ""),
    tipoId: String(formData.get("tipo_id") ?? ""),
    feeMensual: String(formData.get("fee_mensual") ?? ""),
    finContrato: String(formData.get("fin_contrato") ?? ""),
    responsableId,
    prioridad: String(formData.get("prioridad") ?? "media"),
    colaboradorIds: idsColaboradores(formData),
  });

  if (!resultado.ok) {
    return await redirectListaProyectos(resultado.motivo);
  }
  const tipo = await tipoPorId(resultado.proyecto.tipoId);
  const cliente = clienteId ? await clientePorId(clienteId) : null;
  const responsable = await nombreUsuario(responsableId);
  const titulo =
    resultado.proyecto.nombre?.trim() ||
    tipo?.nombre ||
    (ambito === "interno" ? "Proyecto interno" : "Proyecto");
  await logActividad(
    actor,
    "proyecto_creado",
    formatearAlta(
      ambito === "externo"
        ? `Proyecto externo «${titulo}» · cliente «${cliente?.nombre ?? "cliente"}»`
        : `Proyecto interno «${titulo}»`,
      [
        { campo: "nombre", valor: resultado.proyecto.nombre },
        { campo: "tipo", valor: tipo?.nombre },
        { campo: "prioridad", valor: formData.get("prioridad") ?? "media" },
        { campo: "oportunidad", valor: String(formData.get("fee_mensual") ?? "") || null },
        { campo: "fin contrato", valor: String(formData.get("fin_contrato") ?? "") || null },
        { campo: "responsable", valor: responsable === "—" ? null : responsable },
      ],
    ),
    { proyectoId: resultado.proyecto.id, ambito, clienteId: clienteId || null },
  );
  return await redirectListaProyectos("proyecto_nuevo");
}

export async function editarProyectoLista(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const ambitoRaw = String(formData.get("ambito") ?? "interno");
  const ambito: AmbitoProyecto = ambitoRaw === "externo" ? "externo" : "interno";
  const clienteId = String(formData.get("cliente_id") ?? "").trim();
  const proyectoId = String(formData.get("proyecto_id") ?? "");

  if (!(await puedeGestionarProyecto(actor, proyectoId))) {
    return await redirectListaProyectos("sin_permiso");
  }

  if (ambito === "externo") {
    if (!clienteId) return await redirectListaProyectos("cliente_obligatorio");
    if (!(await clientePorId(clienteId))) {
      return await redirectListaProyectos("no_encontrado");
    }
  }

  const antes = await proyectoPorId(proyectoId);
  const nombreNuevo = String(formData.get("nombre") ?? "");
  const tipoNuevo = String(formData.get("tipo_id") ?? "");
  const feeNuevo = String(formData.get("fee_mensual") ?? "");
  const finNuevo = String(formData.get("fin_contrato") ?? "");
  const responsableNuevo = String(formData.get("responsable_id") ?? "");
  const prioridadNueva = String(formData.get("prioridad") ?? "media");

  const resultado = await editarProyecto({
    proyectoId,
    ambito,
    clienteId,
    nombre: nombreNuevo,
    tipoId: tipoNuevo,
    feeMensual: feeNuevo,
    finContrato: finNuevo,
    responsableId: responsableNuevo,
    prioridad: prioridadNueva,
    colaboradorIds: idsColaboradores(formData),
  });

  if (!resultado.ok) {
    return await redirectListaProyectos(resultado.motivo);
  }
  await sincronizarColaboradoresProyecto(proyectoId, resultado.colaboradorIds);

  const [tipoAntes, tipoDespues, clienteAntes, clienteDespues, respAntes, respDespues] =
    await Promise.all([
      tipoPorId(antes?.tipoId),
      tipoPorId(tipoNuevo || null),
      clientePorId(antes?.clienteId),
      clientePorId(clienteId || null),
      nombreUsuario(antes?.responsableId),
      nombreUsuario(responsableNuevo),
    ]);
  const tituloLog =
    nombreNuevo.trim() ||
    tipoDespues?.nombre ||
    antes?.nombre ||
    tipoAntes?.nombre ||
    proyectoId.slice(0, 8);
  const etiqueta =
    ambito === "externo"
      ? `Proyecto «${tituloLog}» · cliente «${clienteDespues?.nombre ?? clienteAntes?.nombre ?? "—"}»`
      : `Proyecto interno «${tituloLog}»`;

  await logActividad(
    actor,
    "proyecto_editado",
    formatearCambios(etiqueta, [
      { campo: "nombre", de: antes?.nombre, a: nombreNuevo.trim() || null },
      { campo: "ámbito", de: antes?.ambito, a: ambito },
      { campo: "cliente", de: clienteAntes?.nombre, a: clienteDespues?.nombre },
      { campo: "tipo", de: tipoAntes?.nombre, a: tipoDespues?.nombre },
      {
        campo: "oportunidad",
        de: antes?.feeMensual != null ? String(antes.feeMensual) : null,
        a: feeNuevo.trim() || null,
      },
      { campo: "fin contrato", de: antes?.finContrato, a: finNuevo.trim() || null },
      { campo: "prioridad", de: antes?.prioridad, a: prioridadNueva },
      { campo: "responsable", de: respAntes, a: respDespues },
      {
        campo: "colaboradores",
        de: antes ? String(antes.colaboradorIds.length) : null,
        a: String(resultado.colaboradorIds.length),
      },
    ]),
    {
      proyectoId,
      ambito,
      clienteId: ambito === "externo" ? clienteId || null : null,
    },
  );
  return await redirectListaProyectos("proyecto_editado");
}

export async function eliminarProyectoLista(formData: FormData) {
  const usuario = await exigirPermiso("proyectos.editar");
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeGestionarProyecto(usuario, proyectoId))) {
    return await redirectListaProyectos("sin_permiso");
  }
  const antes = await proyectoPorId(proyectoId);
  const cliente = await clientePorId(antes?.clienteId);
  await borrarEventosCalendarDeProyectos([proyectoId], usuario.correo);
  const resultado = await eliminarProyecto(proyectoId, {
    id: usuario.id,
    correo: usuario.correo,
  });
  if (!resultado.ok) return await redirectListaProyectos("no_encontrado");
  const tipo = await tipoPorId(antes?.tipoId);
  const titulo = antes?.nombre?.trim() || tipo?.nombre || proyectoId.slice(0, 8);
  await logActividad(
    usuario,
    "proyecto_eliminado",
    formatearAlta(
      antes?.ambito === "externo"
        ? `Proyecto «${titulo}» · cliente «${cliente?.nombre ?? "cliente"}» eliminado`
        : `Proyecto interno «${titulo}» eliminado`,
      [
        { campo: "nombre", valor: antes?.nombre },
        { campo: "tipo", valor: tipo?.nombre },
        { campo: "prioridad", valor: antes?.prioridad },
        { campo: "estado", valor: antes?.estado },
      ],
    ),
    {
      proyectoId,
      clienteId: antes?.clienteId ?? null,
      eliminacionId: resultado.eliminacionId,
    },
  );
  await registrarAccionReversible({
    actorId: usuario.id,
    via: "ui",
    tipo: "eliminacion",
    etiqueta: `Eliminar proyecto «${titulo}»`,
    entidadTipo: "proyecto",
    entidadId: proyectoId,
    before: { eliminacionId: resultado.eliminacionId },
    eliminacionId: resultado.eliminacionId,
  }).catch((e) => console.error("[deshacer] registrar eliminacion proyecto", e));
  return await redirectListaProyectos("proyecto_eliminado");
}

/** Fija o quita el proyecto del submenú del sidemenu (preferencia por usuario). */
export async function alternarFavoritoProyectoLista(formData: FormData) {
  const yo = await exigirPermiso("proyectos.ver");
  const proyectoId = String(formData.get("proyecto_id") ?? "").trim();
  if (!(await puedeVerProyecto(yo, proyectoId))) return;
  const r = await alternarFavoritoProyecto(yo.id, proyectoId);
  if (!r.ok) return;
  revalidatePath("/", "layout");
  revalidatePath("/proyectos");
}

export async function marcarProyectoTerminado(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeGestionarProyecto(actor, proyectoId))) {
    return await redirectListaProyectos("sin_permiso");
  }
  const antes = await proyectoPorId(proyectoId);
  const cliente = await clientePorId(antes?.clienteId);
  const r = await cambiarEstadoProyecto(proyectoId, "terminado");
  if (!r.ok) return await redirectListaProyectos(r.motivo);
  const titulo =
    antes?.nombre?.trim() ||
    (antes?.ambito === "externo" ? cliente?.nombre : null) ||
    proyectoId.slice(0, 8);
  await logActividad(
    actor,
    "proyecto_terminado",
    formatearCambios(
      antes?.ambito === "externo"
        ? `Proyecto «${cliente?.nombre ?? proyectoId.slice(0, 8)}»`
        : `Proyecto interno (${proyectoId.slice(0, 8)})`,
      [{ campo: "estado", de: antes?.estado, a: "terminado" }],
    ),
    { proyectoId, clienteId: antes?.clienteId ?? null },
  );
  if (antes?.estado) {
    await registrarAccionReversible({
      actorId: actor.id,
      via: "ui",
      tipo: "proyecto_estado",
      etiqueta: `Estado «${titulo}»: ${antes.estado} → terminado`,
      entidadTipo: "proyecto",
      entidadId: proyectoId,
      before: snapProyectoEstado(antes.estado),
      after: snapProyectoEstado("terminado"),
    }).catch((e) => console.error("[deshacer] registrar estado proyecto", e));
  }
  return await redirectListaProyectos("proyecto_terminado");
}

export async function archivarProyectoLista(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeGestionarProyecto(actor, proyectoId))) {
    return await redirectListaProyectos("sin_permiso");
  }
  const antes = await proyectoPorId(proyectoId);
  const cliente = await clientePorId(antes?.clienteId);
  const r = await cambiarEstadoProyecto(proyectoId, "archivado");
  if (!r.ok) return await redirectListaProyectos(r.motivo);
  const tituloArch =
    antes?.nombre?.trim() ||
    (antes?.ambito === "externo" ? cliente?.nombre : null) ||
    proyectoId.slice(0, 8);
  await logActividad(
    actor,
    "proyecto_archivado",
    formatearCambios(
      antes?.ambito === "externo"
        ? `Proyecto «${cliente?.nombre ?? proyectoId.slice(0, 8)}»`
        : `Proyecto interno (${proyectoId.slice(0, 8)})`,
      [{ campo: "estado", de: antes?.estado, a: "archivado" }],
    ),
    { proyectoId, clienteId: antes?.clienteId ?? null },
  );
  if (antes?.estado) {
    await registrarAccionReversible({
      actorId: actor.id,
      via: "ui",
      tipo: "proyecto_estado",
      etiqueta: `Estado «${tituloArch}»: ${antes.estado} → archivado`,
      entidadTipo: "proyecto",
      entidadId: proyectoId,
      before: snapProyectoEstado(antes.estado),
      after: snapProyectoEstado("archivado"),
    }).catch((e) => console.error("[deshacer] registrar estado proyecto", e));
  }
  return await redirectListaProyectos("proyecto_archivado");
}

export async function reactivarProyectoLista(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeGestionarProyecto(actor, proyectoId))) {
    return await redirectListaProyectos("sin_permiso");
  }
  const antes = await proyectoPorId(proyectoId);
  const cliente = await clientePorId(antes?.clienteId);
  const r = await cambiarEstadoProyecto(proyectoId, "activo");
  if (!r.ok) return await redirectListaProyectos(r.motivo);
  const tituloRe =
    antes?.nombre?.trim() ||
    (antes?.ambito === "externo" ? cliente?.nombre : null) ||
    proyectoId.slice(0, 8);
  await logActividad(
    actor,
    "proyecto_reactivado",
    formatearCambios(
      antes?.ambito === "externo"
        ? `Proyecto «${cliente?.nombre ?? proyectoId.slice(0, 8)}»`
        : `Proyecto interno (${proyectoId.slice(0, 8)})`,
      [{ campo: "estado", de: antes?.estado, a: "activo" }],
    ),
    { proyectoId, clienteId: antes?.clienteId ?? null },
  );
  if (antes?.estado) {
    await registrarAccionReversible({
      actorId: actor.id,
      via: "ui",
      tipo: "proyecto_estado",
      etiqueta: `Estado «${tituloRe}»: ${antes.estado} → activo`,
      entidadTipo: "proyecto",
      entidadId: proyectoId,
      before: snapProyectoEstado(antes.estado),
      after: snapProyectoEstado("activo"),
    }).catch((e) => console.error("[deshacer] registrar estado proyecto", e));
  }
  return await redirectListaProyectos("proyecto_reactivado");
}

export async function archivarTodoTerminadoLista() {
  const actor = await exigirPermiso("proyectos.editar");
  const r = await archivarProyectosTerminados();
  if (r.archivados > 0) {
    await logActividad(actor, "proyectos_archivados_lote", `${r.archivados} proyectos`, {
      archivados: r.archivados,
    });
  }
  return await redirectListaProyectos(
    r.archivados > 0 ? "proyectos_archivados" : "ningun_terminado",
  );
}

export async function crearApartado(
  formData: FormData,
): Promise<{ ok: true; columna: Columna } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeGestionarProyecto(actor, proyectoId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const nombre = String(formData.get("nombre") ?? "");
  const r = await crearColumna(proyectoId, nombre);
  if (r.ok) {
    await logActividad(actor, "apartado_creado", `${nombre.trim()} · proyecto ${proyectoId}`, {
      proyectoId,
      columnaId: r.columna.id,
    });
  }
  return r;
}

export async function borrarApartado(
  formData: FormData,
): Promise<
  { ok: true; porHacerId: string; tareasMovidas: string[] } | { ok: false; motivo: string }
> {
  const actor = await exigirPermiso("tareas.editar");
  const columnaId = String(formData.get("columna_id") ?? "");
  const col = await columnaPorId(columnaId);
  if (!col) return { ok: false, motivo: "no_encontrado" };
  if (!(await puedeGestionarProyecto(actor, col.proyectoId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const r = await borrarColumna(columnaId);
  if (r.ok) {
    await logActividad(actor, "apartado_borrado", `columna ${columnaId}`, { columnaId });
  }
  return r;
}

export async function reordenarApartado(
  formData: FormData,
): Promise<{ ok: true; columnas: Columna[] } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const columnaId = String(formData.get("columna_id") ?? "");
  const col = await columnaPorId(columnaId);
  if (!col) return { ok: false, motivo: "no_encontrado" };
  if (!(await puedeGestionarProyecto(actor, col.proyectoId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const raw = formData.get("indice");
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, motivo: "falta_dato" };
  return reordenarColumna(columnaId, n);
}

export async function ocultarApartado(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.ver");
  return ocultarColumna(actor.id, String(formData.get("columna_id") ?? ""));
}

export async function mostrarApartado(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.ver");
  return mostrarColumna(actor.id, String(formData.get("columna_id") ?? ""));
}

export async function borrarTareaProyecto(
  formData: FormData,
): Promise<{ ok: true; tareas: Tarea[] } | { ok: false; motivo: string }> {
  const usuario = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeBorrarTarea(usuario, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const prev = await tareaPorId(tareaId);
  const correo = usuario.correo;

  if (prev?.calendarEventId) {
    try {
      const tokens = await tokensGooglePorCorreo(correo);
      if (tokens?.refreshToken) {
        await borrarEventoSiExiste(
          {
            refreshToken: tokens.refreshToken,
            accessToken: tokens.accessToken,
            expiry: tokens.expiry ?? null,
          },
          prev.calendarEventId,
        );
      }
    } catch (error) {
      console.error("[calendar] no se pudo borrar evento al eliminar tarea", { tareaId, error });
    }
  }

  const r = await borrarTarea(tareaId, { id: usuario.id, correo: usuario.correo });
  if (r.ok) {
    const nombreT = prev?.nombre ?? tareaId.slice(0, 8);
    await logActividad(
      usuario,
      "tarea_borrada",
      formatearAlta(`Tarea «${nombreT}» eliminada`, [
        { campo: "prioridad", valor: prev?.prioridad },
      ]),
      {
        tareaId,
        proyectoId: prev?.proyectoId,
        eliminacionId: r.eliminacionId,
      },
    );
    await registrarAccionReversible({
      actorId: usuario.id,
      via: "ui",
      tipo: "eliminacion",
      etiqueta: `Eliminar tarea «${nombreT}»`,
      entidadTipo: "tarea",
      entidadId: tareaId,
      before: { eliminacionId: r.eliminacionId },
      eliminacionId: r.eliminacionId,
    }).catch((e) => console.error("[deshacer] registrar eliminacion tarea", e));
  }
  return r;
}

export async function crearTareaProyecto(
  formData: FormData,
): Promise<
  | { ok: true; tarea: Tarea; tareas: Tarea[]; calendarFallo?: boolean }
  | { ok: false; motivo: string }
> {
  const usuario = await exigirPermiso("tareas.editar");
  const prioridad = String(formData.get("prioridad") ?? "media") as Prioridad;
  const okPrioridad = ["baja", "media", "alta", "urgente"].includes(prioridad);
  const dificultadRaw = Number(formData.get("dificultad") ?? 3);
  const dificultad: Dificultad = DIFICULTADES.includes(dificultadRaw as Dificultad)
    ? (dificultadRaw as Dificultad)
    : 3;
  const rapida = formData.get("rapida") === "1";
  const correo = usuario.correo;
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!(await puedeCrearTarea(usuario, proyectoId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const proyecto = await proyectoPorId(proyectoId);
  const colaboradorIds = proyecto?.colaboradorIds ?? [];

  if (rapida) {
    const yo = String(formData.get("creada_por_id") ?? "");
    const r = await crearTarea({
      proyectoId,
      columnaId: String(formData.get("columna_id") ?? "") || undefined,
      nombre: String(formData.get("nombre") ?? ""),
      responsableIds: yo ? [yo] : [],
      colaboradorIds,
      mandadaPorId: yo,
      syncCalendar: false,
      prioridad: "media",
      dificultad: 3,
    });
    if (r.ok) {
      await logActividad(
        usuario,
        "tarea_creada",
        formatearAlta(`Tarea «${r.tarea.nombre}»`, [
          { campo: "modo", valor: "rápida" },
          { campo: "prioridad", valor: "media" },
          { campo: "dificultad", valor: 3 },
        ]),
        {
          tareaId: r.tarea.id,
          proyectoId,
          rapida: true,
        },
      );
    }
    return r;
  }

  const resultado = await crearTarea({
    proyectoId,
    nombre: String(formData.get("nombre") ?? ""),
    fechaPrevista: String(formData.get("fecha_prevista") ?? ""),
    fechaMaxima: String(formData.get("fecha_maxima") ?? ""),
    syncCalendar: formData.get("sync_calendar") === "on",
    notificarAsignado: formData.get("notificar_asignado") === "on",
    responsableIds: formData.getAll("responsable_ids").map(String),
    colaboradorIds,
    mandadaPorId: String(formData.get("mandada_por_id") ?? ""),
    prioridad: okPrioridad ? prioridad : "media",
    dificultad,
  });

  if (resultado.ok) {
    await logActividad(
      usuario,
      "tarea_creada",
      formatearAlta(`Tarea «${resultado.tarea.nombre}»`, [
        { campo: "prioridad", valor: resultado.tarea.prioridad },
        { campo: "dificultad", valor: resultado.tarea.dificultad },
        { campo: "fecha máxima", valor: resultado.tarea.fechaMaxima },
        { campo: "fecha prevista", valor: resultado.tarea.fechaPrevista },
        { campo: "calendar", valor: resultado.tarea.syncCalendar ? "sí" : "no" },
      ]),
      { tareaId: resultado.tarea.id, proyectoId },
    );
    if (resultado.tarea.notificarAsignado && resultado.tarea.responsableIds.length > 0) {
      await notificarAsignacionTarea({
        tarea: resultado.tarea,
        destinatarioIds: resultado.tarea.responsableIds,
        excluirUsuarioId: resultado.tarea.mandadaPorId,
      });
    }
    const calendarOk = await sincronizarTareaConCalendar(resultado.tarea, correo);
    const actualizada = await tareaPorId(resultado.tarea.id);
    if (actualizada) {
      return {
        ok: true,
        tarea: actualizada,
        tareas: resultado.tareas.map((t) => (t.id === actualizada.id ? actualizada : t)),
        calendarFallo: !calendarOk,
      };
    }
    return { ...resultado, calendarFallo: !calendarOk };
  }

  return resultado;
}

export async function moverTareaProyecto(
  formData: FormData,
): Promise<{ ok: true; tarea: Tarea; tareas: Tarea[] } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const raw = formData.get("indice");
  let indice: number | undefined;
  if (raw !== null && String(raw) !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) indice = n;
  }
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeMoverTarea(actor, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const columnaId = String(formData.get("columna_id") ?? "");
  const antes = await tareaPorId(tareaId);
  const r = await moverTarea(tareaId, columnaId, indice);
  if (r.ok) {
    await logActividad(actor, "tarea_movida", `${r.tarea.nombre} → columna ${columnaId}`, {
      tareaId,
      columnaId,
      proyectoId: r.tarea.proyectoId,
    });
    if (antes) {
      await registrarAccionReversible({
        actorId: actor.id,
        via: "ui",
        tipo: "tarea_movida",
        etiqueta: `Mover «${r.tarea.nombre}»`,
        entidadTipo: "tarea",
        entidadId: tareaId,
        before: snapTareaPosicion(antes),
        after: snapTareaPosicion(r.tarea),
      }).catch((e) => console.error("[deshacer] registrar mover tarea", e));
    }
  }
  return r;
}

/** Completar / reabrir: Terminadas ↔ Por hacer (como el checkbox de /tareas). */
export async function alternarCompletadaProyecto(
  formData: FormData,
): Promise<{ ok: true; tarea: Tarea; tareas: Tarea[] } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeEditarTarea(actor, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const antes = await tareaPorId(tareaId);
  const r = await alternarCompletadaTarea(tareaId);
  if (r.ok) {
    await logActividad(
      actor,
      r.tarea.completadaEl ? "tarea_completada" : "tarea_reabierta",
      formatearAlta(`Tarea «${r.tarea.nombre}»`, [
        { campo: "estado", valor: r.tarea.completadaEl ? "completada" : "abierta" },
      ]),
      { tareaId: r.tarea.id, proyectoId: r.tarea.proyectoId },
    );
    if (antes) {
      await registrarAccionReversible({
        actorId: actor.id,
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
    await sincronizarTareaConCalendar(r.tarea, actor.correo);
  }
  return r;
}

export async function editarTareaProyecto(
  formData: FormData,
): Promise<
  { ok: true; tarea: Tarea; calendarFallo?: boolean } | { ok: false; motivo: string }
> {
  const usuario = await exigirPermiso("tareas.editar");
  const prioridad = String(formData.get("prioridad") ?? "media") as Prioridad;
  const okPrioridad = ["baja", "media", "alta", "urgente"].includes(prioridad);
  const dificultadRaw = Number(formData.get("dificultad") ?? 3);
  const dificultad: Dificultad = DIFICULTADES.includes(dificultadRaw as Dificultad)
    ? (dificultadRaw as Dificultad)
    : 3;
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeEditarTarea(usuario, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const antes = await tareaPorId(tareaId);
  if (!antes) return { ok: false, motivo: "no_encontrado" };
  const proyecto = await proyectoPorId(antes.proyectoId);
  const colaboradorIds = proyecto?.colaboradorIds ?? [];
  const nombreNuevo = String(formData.get("nombre") ?? "");
  const fechaPrevista = String(formData.get("fecha_prevista") ?? "");
  const fechaMaxima = String(formData.get("fecha_maxima") ?? "");
  const syncCalendar = formData.get("sync_calendar") === "on";
  const pideNotificar = formData.get("notificar_asignado") === "on";
  const esSolicitante = Boolean(antes.mandadaPorId && antes.mandadaPorId === usuario.id);
  const puedeGestionar = await puedeGestionarProyecto(usuario, antes.proyectoId);
  const puedeToggleNotificar = esSolicitante || puedeGestionar;
  const notificarAsignado = puedeToggleNotificar
    ? pideNotificar
    : Boolean(antes.notificarAsignado);

  const puedeSolicitante = await puedeCambiarSolicitante(usuario, antes.proyectoId);
  const mandadaPorId = puedeSolicitante
    ? String(formData.get("mandada_por_id") ?? "")
    : (antes.mandadaPorId ?? "");

  const resultado = await editarTarea({
    tareaId,
    nombre: nombreNuevo,
    fechaPrevista,
    fechaMaxima,
    syncCalendar,
    notificarAsignado,
    mandadaPorId,
    colaboradorIds,
    prioridad: okPrioridad ? prioridad : "media",
    dificultad,
  });

  if (resultado.ok) {
    await logActividad(
      usuario,
      "tarea_editada",
      formatearCambios(`Tarea «${resultado.tarea.nombre}»`, [
        { campo: "nombre", de: antes.nombre, a: nombreNuevo.trim() },
        { campo: "prioridad", de: antes.prioridad, a: resultado.tarea.prioridad },
        { campo: "dificultad", de: antes.dificultad, a: resultado.tarea.dificultad },
        { campo: "fecha prevista", de: antes.fechaPrevista, a: resultado.tarea.fechaPrevista },
        { campo: "fecha máxima", de: antes.fechaMaxima, a: resultado.tarea.fechaMaxima },
        { campo: "calendar", de: antes.syncCalendar, a: resultado.tarea.syncCalendar },
        {
          campo: "notificar asignado",
          de: antes.notificarAsignado ? "sí" : "no",
          a: resultado.tarea.notificarAsignado ? "sí" : "no",
        },
      ]),
      { tareaId: resultado.tarea.id, proyectoId: resultado.tarea.proyectoId },
    );
    await registrarAccionReversible({
      actorId: usuario.id,
      via: "ui",
      tipo: "tarea_editada",
      etiqueta: `Editar «${resultado.tarea.nombre}»`,
      entidadTipo: "tarea",
      entidadId: resultado.tarea.id,
      before: snapTareaEdit(antes),
      after: snapTareaEdit(resultado.tarea),
    }).catch((e) => console.error("[deshacer] registrar editar tarea", e));
    const activoAhora =
      puedeToggleNotificar && !antes.notificarAsignado && resultado.tarea.notificarAsignado;
    if (activoAhora && resultado.tarea.responsableIds.length > 0) {
      await notificarAsignacionTarea({
        tarea: resultado.tarea,
        destinatarioIds: resultado.tarea.responsableIds,
        excluirUsuarioId: resultado.tarea.mandadaPorId,
      });
    }
    const calendarOk = await sincronizarTareaConCalendar(resultado.tarea, usuario.correo);
    const actualizada = await tareaPorId(resultado.tarea.id);
    if (actualizada) return { ok: true, tarea: actualizada, calendarFallo: !calendarOk };
    return { ...resultado, calendarFallo: !calendarOk };
  }

  return resultado;
}

export async function guardarNotasTarea(
  formData: FormData,
): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: string }> {
  const usuario = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeNotasChatAdjuntos(usuario, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const r = await guardarNotas(
    tareaId,
    String(formData.get("texto") ?? ""),
    String(formData.get("autor_id") ?? ""),
  );
  if (r.ok) {
    await sincronizarTareaConCalendar(r.tarea, usuario.correo);
  }
  return r;
}

export async function guardarResponsablesTarea(
  formData: FormData,
): Promise<{ ok: true; tarea: Tarea } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeCambiarAsignados(actor, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  const tarea = await tareaPorId(tareaId);
  const proyecto = tarea ? await proyectoPorId(tarea.proyectoId) : null;
  const antesIds = new Set(tarea?.responsableIds ?? []);
  const r = await editarResponsablesTarea(
    tareaId,
    formData.getAll("responsable_ids").map(String),
    proyecto?.colaboradorIds ?? [],
  );
  if (r.ok) {
    await logActividad(actor, "tarea_responsables", `${r.tarea.nombre} (${tareaId})`, {
      tareaId,
      proyectoId: r.tarea.proyectoId,
    });
    if (tarea) {
      await registrarAccionReversible({
        actorId: actor.id,
        via: "ui",
        tipo: "tarea_responsables",
        etiqueta: `Responsables «${r.tarea.nombre}»`,
        entidadTipo: "tarea",
        entidadId: tareaId,
        before: snapTareaResponsables(tarea),
        after: snapTareaResponsables(r.tarea),
      }).catch((e) => console.error("[deshacer] registrar responsables", e));
    }
    if (r.tarea.notificarAsignado) {
      const nuevos = r.tarea.responsableIds.filter((id) => !antesIds.has(id));
      if (nuevos.length > 0) {
        await notificarAsignacionTarea({
          tarea: r.tarea,
          destinatarioIds: nuevos,
          excluirUsuarioId: r.tarea.mandadaPorId,
        });
      }
    }
    await sincronizarTareaConCalendar(r.tarea, actor.correo);
  }
  return r;
}

export async function anadirItemChecklist(
  formData: FormData,
): Promise<{ ok: true; item: ItemChecklist } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeEditarTarea(actor, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return anadirChecklist(tareaId, String(formData.get("texto") ?? ""));
}

export async function alternarChecklist(
  formData: FormData,
): Promise<{ ok: true; item: ItemChecklist } | { ok: false; motivo: string }> {
  const actor = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeEditarTarea(actor, tareaId))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return toggleChecklist(tareaId, String(formData.get("item_id") ?? ""));
}

export async function crearTipoProyectoAction(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const nombre = String(formData.get("nombre") ?? "");
  const r = await crearTipoProyecto(nombre);
  if (!r.ok) {
    return await redirectListaProyectos(r.motivo === "duplicado" ? "tipo_duplicado" : "falta_dato");
  }
  await logActividad(actor, "tipo_creado", nombre.trim(), { tipoId: r.tipo.id });
  return await redirectListaProyectos("tipo_creado");
}

/** Crea un tipo y lo devuelve (para el selector «Otro…» sin cerrar el lightbox). */
export async function crearTipoProyectoInline(
  formData: FormData,
): Promise<
  { ok: true; tipo: { id: string; nombre: string; orden: number } } | { ok: false; motivo: string }
> {
  const actor = await exigirPermiso("proyectos.editar");
  const nombre = String(formData.get("nombre") ?? "");
  const r = await crearTipoProyecto(nombre);
  if (r.ok) {
    await logActividad(actor, "tipo_creado", nombre.trim(), { tipoId: r.tipo.id });
  }
  return r;
}

export async function renombrarTipoProyectoAction(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const tipoId = String(formData.get("tipo_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const antes = await tipoPorId(tipoId);
  const r = await renombrarTipoProyecto(tipoId, nombre);
  if (!r.ok) {
    const aviso =
      r.motivo === "duplicado"
        ? "tipo_duplicado"
        : r.motivo === "no_encontrado"
          ? "no_encontrado"
          : "falta_dato";
    return await redirectListaProyectos(aviso);
  }
  await logActividad(
    actor,
    "tipo_renombrado",
    formatearCambios("Tipo de proyecto", [
      { campo: "nombre", de: antes?.nombre, a: nombre.trim() },
    ]),
    { tipoId },
  );
  return await redirectListaProyectos("tipo_renombrado");
}

export async function eliminarTipoProyectoAction(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const tipoId = String(formData.get("tipo_id") ?? "");
  const antes = await tipoPorId(tipoId);
  const r = await eliminarTipoProyecto(
    tipoId,
    String(formData.get("reasignar_a") ?? "") || undefined,
  );
  if (!r.ok) {
    const aviso =
      r.motivo === "requiere_reasignacion" || r.motivo === "mismo_destino" || r.motivo === "destino_invalido"
        ? "tipo_requiere_reasignacion"
        : r.motivo === "no_encontrado"
          ? "no_encontrado"
          : "falta_dato";
    return await redirectListaProyectos(aviso);
  }
  await logActividad(
    actor,
    "tipo_eliminado",
    `Tipo «${antes?.nombre ?? tipoId.slice(0, 8)}» eliminado`,
    { tipoId },
  );
  return await redirectListaProyectos("tipo_eliminado");
}
