import { randomUUID } from "crypto";
import type Anthropic from "@anthropic-ai/sdk";
import {
  confirmacionesPendientesEnHistorial,
  mensajeCancelacionTodasUi,
  mensajeCancelacionUi,
  mensajeConfirmacionTodasUi,
  mensajeConfirmacionUi,
  serializarAssistantToolUse,
  serializarToolResult,
  type ConfirmacionPendiente,
} from "@/lib/asistente/historial";
import {
  anadirMensaje,
  listarMensajes,
  type MensajeIa,
} from "@/lib/asistente/store";
import {
  fusionarArgsEditados,
  pendienteAUi,
} from "@/lib/asistente/confirmacion-campos";
import {
  etiquetaConfirmacionPendiente,
  etiquetaTool,
} from "@/lib/asistente/confirmacion-etiqueta";
import {
  esErrorResolucion,
  resolverProyecto,
  resolverTarea,
} from "@/lib/asistente/nombres";
import { ejecutarTool } from "@/lib/asistente/tools";
import { proyectoPorId } from "@/lib/proyectos";
import type { UsuarioAuth } from "@/lib/usuarios";

export { pendienteAUi };

export type ConfirmacionPendientePayload = ReturnType<typeof pendienteAUi>;

function strArg(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** Ids asignables en el proyecto (colaboradores + responsable). */
async function poolIdsParaTool(
  usuario: UsuarioAuth,
  tool: string,
  args: Record<string, unknown>,
): Promise<string[] | undefined> {
  const toolsProyecto = new Set(["crear_tarea"]);
  const toolsTarea = new Set([
    "editar_tarea",
    "asignar_responsables_tarea",
    "guardar_notas_tarea",
    "mover_tarea",
    "alternar_completada_tarea",
    "enviar_mensaje_tarea",
  ]);

  let colaboradorIds: string[] = [];
  let responsableId: string | null = null;

  if (toolsProyecto.has(tool)) {
    const ref = strArg(args, "proyectoId");
    if (!ref) return undefined;
    const p = await resolverProyecto(usuario, ref);
    if (esErrorResolucion(p)) return undefined;
    colaboradorIds = p.colaboradorIds ?? [];
    responsableId = p.responsableId;
  } else if (toolsTarea.has(tool)) {
    const ref = strArg(args, "tareaId");
    if (!ref) return undefined;
    const t = await resolverTarea(usuario, ref);
    if (esErrorResolucion(t)) return undefined;
    const p = await proyectoPorId(t.proyectoId);
    if (!p) return undefined;
    colaboradorIds = p.colaboradorIds ?? [];
    responsableId = p.responsableId;
  } else {
    return undefined;
  }

  const ids = new Set<string>(colaboradorIds);
  if (responsableId) ids.add(responsableId);
  return ids.size > 0 ? [...ids] : undefined;
}

export async function enriquecerPendienteUi(
  usuario: UsuarioAuth,
  p: ConfirmacionPendiente,
): Promise<ConfirmacionPendientePayload> {
  const poolIds = await poolIdsParaTool(usuario, p.tool, p.args);
  return pendienteAUi({ ...p, resumen: p.resumen, ...(poolIds ? { poolIds } : {}) });
}

export async function pendientesUiEnriquecidos(
  usuario: UsuarioAuth,
  historial: MensajeIa[],
): Promise<ConfirmacionPendientePayload[]> {
  const raw = confirmacionesPendientesEnHistorial(historial);
  return Promise.all(raw.map((p) => enriquecerPendienteUi(usuario, p)));
}

export type AccionConfirmacionUi =
  | "confirmar"
  | "cancelar"
  | "confirmar_todas"
  | "cancelar_todas";

export { etiquetaConfirmacionPendiente, etiquetaTool };

function resultadoFallido(out: unknown): boolean {
  if (!out || typeof out !== "object") return false;
  const o = out as Record<string, unknown>;
  if (o.error) return true;
  if (o.ok === false) return true;
  return false;
}

function resumenResultado(tool: string, out: unknown): string {
  if (!out || typeof out !== "object") {
    return "Listo.";
  }
  const o = out as Record<string, unknown>;
  if (o.error) {
    if (typeof o.mensaje === "string" && o.mensaje.trim()) {
      return o.mensaje.trim();
    }
    const detalle =
      typeof o.detalle === "string"
        ? o.detalle
        : typeof o.motivo === "string"
          ? o.motivo
          : String(o.error);
    return `No se pudo completar la acción (${detalle}).`;
  }

  switch (tool) {
    case "crear_cliente":
      return "Cliente creado.";
    case "editar_cliente":
      return "Cliente actualizado.";
    case "enviar_invitacion_cliente":
      return "Invitación marcada como enviada.";
    case "crear_proyecto":
      return "Proyecto creado.";
    case "editar_proyecto":
      return "Proyecto actualizado.";
    case "cambiar_estado_proyecto":
      return "Estado del proyecto actualizado.";
    case "crear_tarea":
      return "Tarea creada.";
    case "editar_tarea":
      return "Tarea actualizada.";
    case "mover_tarea":
      return "Tarea movida.";
    case "alternar_completada_tarea":
      return o.completada ? "Tarea marcada como completada." : "Tarea reabierta.";
    case "asignar_responsables_tarea":
      return "Responsables actualizados.";
    case "guardar_notas_tarea":
      return "Notas guardadas.";
    case "crear_grupo":
      return "Grupo creado.";
    case "borrar_tarea": {
      const borrados = Array.isArray(o.borrados) ? o.borrados : [];
      const fallos = Array.isArray(o.fallos) ? o.fallos : [];
      const nombres = borrados
        .map((b) =>
          b && typeof b === "object" && "nombre" in b
            ? String((b as { nombre: unknown }).nombre)
            : null,
        )
        .filter(Boolean);
      const base =
        nombres.length === 0
          ? "No se borró ninguna tarea."
          : nombres.length === 1
            ? `He borrado «${nombres[0]}» (papelera ~30 días).`
            : `He borrado ${nombres.length} tareas (papelera ~30 días): ${nombres.map((n) => `«${n}»`).join(", ")}.`;
      if (fallos.length > 0) {
        return `${base} ${fallos.length} no se pudieron borrar.`;
      }
      return base;
    }
    case "eliminar_proyecto":
      return "Proyecto eliminado (papelera ~30 días; se puede restaurar en /eliminados).";
    case "eliminar_cliente": {
      const n = typeof o.proyectosQueSeBorran === "number" ? o.proyectosQueSeBorran : null;
      return n != null && n > 0
        ? `Cliente eliminado con ${n} proyecto(s) (papelera ~30 días).`
        : "Cliente eliminado (papelera ~30 días).";
    }
    case "restaurar_eliminado": {
      const restaurados = Array.isArray(o.restaurados) ? o.restaurados : [];
      const fallos = Array.isArray(o.fallos) ? o.fallos : [];
      const base =
        restaurados.length === 0
          ? "No se restauró nada."
          : restaurados.length === 1
            ? "Elemento restaurado."
            : `He restaurado ${restaurados.length} elementos.`;
      if (fallos.length > 0) {
        return `${base} ${fallos.length} fallaron.`;
      }
      return base;
    }
    case "deshacer_accion": {
      if (o.ok === false) {
        const motivo = typeof o.motivo === "string" ? o.motivo : "fallo_aplicar";
        return `No se pudo deshacer (${motivo}).`;
      }
      const et =
        typeof o.etiqueta === "string" && o.etiqueta.trim()
          ? o.etiqueta.trim()
          : "la acción";
      return `He deshecho: ${et}.`;
    }
    case "enviar_mensaje":
    case "enviar_mensaje_tarea":
      return "Mensaje enviado.";
    default:
      return o.ok === false ? "La acción no se completó del todo." : "Hecho.";
  }
}

async function ejecutarPendiente(
  usuario: UsuarioAuth,
  conversacionId: string,
  historial: MensajeIa[],
  pend: ConfirmacionPendiente,
  argsEditados?: Record<string, unknown> | null,
): Promise<{ texto: string; ok: boolean }> {
  const base = fusionarArgsEditados(pend.tool, pend.args, argsEditados);
  const args = { ...base, confirmado: true };
  const out = await ejecutarTool(
    usuario,
    pend.tool,
    args,
    historial,
    conversacionId,
    { confirmadoPorUi: true },
  );

  const toolUseId = `ui_confirm_${randomUUID()}`;
  const blocks: Anthropic.ContentBlock[] = [
    {
      type: "tool_use",
      id: toolUseId,
      name: pend.tool,
      input: args,
    },
  ];
  await anadirMensaje({
    conversacionId,
    rol: "assistant",
    contenido: serializarAssistantToolUse(blocks),
  });
  const contenidoTool = serializarToolResult(toolUseId, pend.tool, out);
  await anadirMensaje({
    conversacionId,
    rol: "tool",
    contenido: contenidoTool,
    toolName: pend.tool,
  });
  historial.push({
    id: toolUseId,
    conversacionId,
    rol: "tool",
    contenido: contenidoTool,
    toolName: pend.tool,
    creadoEn: new Date().toISOString(),
  });

  return { texto: resumenResultado(pend.tool, out), ok: !resultadoFallido(out) };
}

async function pendientesUi(
  usuario: UsuarioAuth,
  historial: MensajeIa[],
): Promise<ConfirmacionPendientePayload[]> {
  return pendientesUiEnriquecidos(usuario, historial);
}

/**
 * Confirmar o cancelar sin otra ronda del LLM.
 * Soporta una acción, o confirmar/cancelar todas las pendientes.
 */
export async function resolverConfirmacionUi(opts: {
  usuario: UsuarioAuth;
  conversacionId: string;
  accion: AccionConfirmacionUi;
  tool?: string;
  clave?: string;
  /** Solo en `confirmar` una: parches de campos editables (el servidor ignora IDs de destino). */
  argsEditados?: Record<string, unknown> | null;
}): Promise<{
  respuesta: string;
  mensajes: MensajeIa[];
  confirmacionesPendientes: ConfirmacionPendientePayload[];
  /** false si alguna tool confirmada falló (no conviene continuar con el LLM). */
  ok: boolean;
}> {
  const { usuario, conversacionId, accion } = opts;
  const historial = await listarMensajes(conversacionId);
  const todas = confirmacionesPendientesEnHistorial(historial);
  if (todas.length === 0) {
    throw new Error("sin_confirmacion_pendiente");
  }

  if (accion === "cancelar_todas") {
    await anadirMensaje({
      conversacionId,
      rol: "user",
      contenido: mensajeCancelacionTodasUi(),
    });
    const respuesta =
      todas.length === 1
        ? `De acuerdo, no voy a ${etiquetaTool(todas[0]!.tool)}.`
        : `De acuerdo, cancelo las ${todas.length} acciones pendientes.`;
    await anadirMensaje({
      conversacionId,
      rol: "assistant",
      contenido: respuesta,
    });
    return {
      respuesta,
      mensajes: await listarMensajes(conversacionId),
      confirmacionesPendientes: [],
      ok: true,
    };
  }

  if (accion === "cancelar") {
    const tool = String(opts.tool ?? "");
    const clave = String(opts.clave ?? "");
    const pend =
      tool && clave
        ? todas.find((p) => p.tool === tool && p.clave === clave)
        : todas.length === 1
          ? todas[0]
          : null;
    if (!pend) throw new Error("sin_confirmacion_pendiente");

    await anadirMensaje({
      conversacionId,
      rol: "user",
      contenido: mensajeCancelacionUi(pend.tool, pend.clave),
    });
    const restantes = todas.filter(
      (p) => !(p.tool === pend.tool && p.clave === pend.clave),
    );
    const respuesta =
      restantes.length === 0
        ? `De acuerdo, no voy a ${etiquetaTool(pend.tool)}.`
        : `De acuerdo, cancelo: ${etiquetaConfirmacionPendiente(pend)}. Quedan ${restantes.length} pendiente(s).`;
    await anadirMensaje({
      conversacionId,
      rol: "assistant",
      contenido: respuesta,
    });
    const hist2 = await listarMensajes(conversacionId);
    return {
      respuesta,
      mensajes: hist2,
      confirmacionesPendientes: await pendientesUi(usuario, hist2),
      ok: true,
    };
  }

  if (accion === "confirmar_todas") {
    const userMsg = await anadirMensaje({
      conversacionId,
      rol: "user",
      contenido: mensajeConfirmacionTodasUi(),
    });
    historial.push(userMsg);

    const resultados: { texto: string; ok: boolean }[] = [];
    for (const pend of todas) {
      resultados.push(
        await ejecutarPendiente(usuario, conversacionId, historial, pend),
      );
    }
    const lineas = resultados.map((r) => r.texto);
    const respuesta =
      lineas.length === 1
        ? lineas[0]!
        : lineas.map((l, i) => `${i + 1}. ${l}`).join("\n");
    await anadirMensaje({
      conversacionId,
      rol: "assistant",
      contenido: respuesta,
    });
    return {
      respuesta,
      mensajes: await listarMensajes(conversacionId),
      confirmacionesPendientes: [],
      ok: resultados.every((r) => r.ok),
    };
  }

  // confirmar una
  const tool = String(opts.tool ?? "");
  const clave = String(opts.clave ?? "");
  const pend =
    tool && clave
      ? todas.find((p) => p.tool === tool && p.clave === clave)
      : todas.length === 1
        ? todas[0]
        : null;
  if (!pend) throw new Error("sin_confirmacion_pendiente");

  const userMsg = await anadirMensaje({
    conversacionId,
    rol: "user",
    contenido: mensajeConfirmacionUi(pend.tool, pend.clave),
  });
  historial.push(userMsg);

  const ejecutado = await ejecutarPendiente(
    usuario,
    conversacionId,
    historial,
    pend,
    opts.argsEditados,
  );
  const hist2 = await listarMensajes(conversacionId);
  const restantes = confirmacionesPendientesEnHistorial(hist2);
  const texto =
    restantes.length > 0
      ? `${ejecutado.texto} Quedan ${restantes.length} pendiente(s).`
      : ejecutado.texto;
  await anadirMensaje({
    conversacionId,
    rol: "assistant",
    contenido: texto,
  });

  const hist3 = await listarMensajes(conversacionId);
  return {
    respuesta: texto,
    mensajes: hist3,
    confirmacionesPendientes: await pendientesUi(usuario, hist3),
    ok: ejecutado.ok,
  };
}
