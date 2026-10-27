"use server";

import { revalidatePath } from "next/cache";
import { exigirPermiso } from "@/lib/authz";
import { GCS_MAX_BYTES, mimePermitido } from "@/lib/gcs";
import {
  adjuntosDeTarea,
  borrarAdjuntoTarea,
  enviarMensajeTarea,
  marcarChatTareaVisto,
  mensajesDeTarea,
  puedeAccederTarea,
  subirAdjuntoTarea,
  type AdjuntoTarea,
  type MensajeTarea,
} from "@/lib/tarea-chat";

export async function listarMensajesTareaAction(
  tareaId: string,
): Promise<{ ok: true; mensajes: MensajeTarea[] } | { ok: false; motivo: string }> {
  const yo = await exigirPermiso("tareas.ver");
  if (!(await puedeAccederTarea(tareaId, yo.id, yo.esAdmin))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, mensajes: await mensajesDeTarea(tareaId) };
}

/** Marca el chat de la tarea como leído al abrirlo. */
export async function marcarChatTareaVistoAction(tareaId: string): Promise<void> {
  const yo = await exigirPermiso("tareas.ver");
  const id = String(tareaId ?? "").trim();
  if (!id) return;
  if (!(await puedeAccederTarea(id, yo.id, yo.esAdmin))) return;
  await marcarChatTareaVisto(id, yo.id);
  revalidatePath("/");
  revalidatePath("/tareas");
}

export async function enviarMensajeTareaAction(
  formData: FormData,
): Promise<{ ok: true; mensaje: MensajeTarea } | { ok: false; aviso: string }> {
  const yo = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeAccederTarea(tareaId, yo.id, yo.esAdmin))) {
    return { ok: false, aviso: "sin_permiso" };
  }
  const r = await enviarMensajeTarea(tareaId, yo.id, String(formData.get("cuerpo") ?? ""));
  if (!r.ok) return { ok: false, aviso: r.motivo };
  return r;
}

export async function listarAdjuntosTareaAction(
  tareaId: string,
): Promise<{ ok: true; adjuntos: AdjuntoTarea[] } | { ok: false; motivo: string }> {
  const yo = await exigirPermiso("tareas.ver");
  if (!(await puedeAccederTarea(tareaId, yo.id, yo.esAdmin))) {
    return { ok: false, motivo: "sin_permiso" };
  }
  return { ok: true, adjuntos: await adjuntosDeTarea(tareaId) };
}

export async function subirAdjuntoTareaAction(
  formData: FormData,
): Promise<{ ok: true; adjunto: AdjuntoTarea } | { ok: false; aviso: string }> {
  const yo = await exigirPermiso("tareas.editar");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeAccederTarea(tareaId, yo.id, yo.esAdmin))) {
    return { ok: false, aviso: "sin_permiso" };
  }

  const raw = formData.get("archivo");
  if (!(raw instanceof File) || raw.size === 0) {
    return { ok: false, aviso: "falta_dato" };
  }
  if (raw.size > GCS_MAX_BYTES) return { ok: false, aviso: "archivo_grande" };
  const mime = raw.type || "application/octet-stream";
  if (!mimePermitido(mime)) return { ok: false, aviso: "archivo_invalido" };

  const r = await subirAdjuntoTarea(tareaId, {
    buffer: Buffer.from(await raw.arrayBuffer()),
    nombre: raw.name || "archivo",
    mime,
    tamanoBytes: raw.size,
  });
  if (!r.ok) return { ok: false, aviso: r.motivo };
  return r;
}

export async function borrarAdjuntoTareaAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; aviso: string }> {
  const yo = await exigirPermiso("tareas.editar");
  const adjuntoId = String(formData.get("adjunto_id") ?? "");
  const tareaId = String(formData.get("tarea_id") ?? "");
  if (!(await puedeAccederTarea(tareaId, yo.id, yo.esAdmin))) {
    return { ok: false, aviso: "sin_permiso" };
  }
  const r = await borrarAdjuntoTarea(adjuntoId);
  if (!r.ok) return { ok: false, aviso: r.motivo };
  return r;
}
