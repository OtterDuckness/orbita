"use server";

import { redirect } from "next/navigation";
import { exigirPermiso, exigirSesionUsuario } from "@/lib/authz";
import {
  abrirOCrearDm,
  contarNoLeidosDe,
  crearGrupo,
  enviarMensaje,
  listarConversacionesDe,
  listarMensajes,
  marcarLeido,
  obtenerMensajeVista,
  parseRefToken,
  type ArchivoAdjuntoInput,
  type ConversacionLista,
  type MensajeVista,
} from "@/lib/comunicaciones";
import { avisoDeMotivo } from "@/lib/avisos";
import { GCS_MAX_BYTES, mimePermitido } from "@/lib/gcs";
import { usuarioPuede } from "@/lib/usuarios";

export async function crearDmAction(formData: FormData) {
  const yo = await exigirPermiso("comunicaciones.editar");
  const r = await abrirOCrearDm(yo.id, String(formData.get("usuario_id") ?? ""));
  if (!r.ok) {
    redirect(`/comunicaciones?aviso=${avisoDeMotivo(r.motivo)}`);
  }
  redirect(`/comunicaciones?c=${r.conversacionId}${r.creado ? "&aviso=dm_creado" : ""}`);
}

export async function crearGrupoAction(formData: FormData) {
  const yo = await exigirPermiso("comunicaciones.editar");
  const miembroIds = formData.getAll("miembro_ids").map(String);
  const r = await crearGrupo(yo.id, String(formData.get("nombre") ?? ""), miembroIds);
  if (!r.ok) {
    const aviso = r.motivo === "sin_miembros" ? "grupo_sin_miembros" : avisoDeMotivo(r.motivo);
    redirect(`/comunicaciones?aviso=${aviso}`);
  }
  redirect(`/comunicaciones?c=${r.conversacionId}&aviso=grupo_creado`);
}

async function archivosDeForm(formData: FormData): Promise<
  | { ok: true; archivos: ArchivoAdjuntoInput[] }
  | { ok: false; motivo: "archivo_invalido" | "archivo_grande" }
> {
  const out: ArchivoAdjuntoInput[] = [];
  const raw = formData.getAll("archivo");
  for (const item of raw) {
    if (!(item instanceof File) || item.size === 0) continue;
    if (item.size > GCS_MAX_BYTES) return { ok: false, motivo: "archivo_grande" };
    const mime = item.type || "application/octet-stream";
    if (!mimePermitido(mime)) return { ok: false, motivo: "archivo_invalido" };
    const buffer = Buffer.from(await item.arrayBuffer());
    out.push({
      buffer,
      nombre: item.name || "archivo",
      mime,
      tamanoBytes: item.size,
    });
  }
  return { ok: true, archivos: out.slice(0, 5) };
}

export async function enviarMensajeAction(
  formData: FormData,
): Promise<{ ok: true; mensaje: MensajeVista } | { ok: false; aviso: string }> {
  const yo = await exigirPermiso("comunicaciones.editar");
  const conversacionId = String(formData.get("conversacion_id") ?? "").trim();
  const refs = formData
    .getAll("ref")
    .map((v) => parseRefToken(String(v)))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const archivosRes = await archivosDeForm(formData);
  if (!archivosRes.ok) {
    return { ok: false, aviso: archivosRes.motivo };
  }

  const r = await enviarMensaje(
    conversacionId,
    yo.id,
    String(formData.get("cuerpo") ?? ""),
    refs,
    archivosRes.archivos,
  );
  if (!r.ok) {
    const aviso =
      r.motivo === "vacio"
        ? "mensaje_vacio"
        : r.motivo === "sin_acceso"
          ? "sin_permiso"
          : r.motivo === "ref_invalida"
            ? "ref_invalida"
            : r.motivo === "archivo_invalido" ||
                r.motivo === "archivo_grande" ||
                r.motivo === "gcs_error"
              ? r.motivo
              : avisoDeMotivo(r.motivo);
    return { ok: false, aviso };
  }

  const vista = await obtenerMensajeVista(r.mensaje.id, yo.id);
  if (!vista) {
    return { ok: false, aviso: "no_encontrado" };
  }
  return { ok: true, mensaje: vista };
}

export async function sincronizarChatAction(
  conversacionId: string | null,
  opciones?: { marcarLeido?: boolean },
): Promise<{
  conversaciones: ConversacionLista[];
  mensajes: MensajeVista[] | null;
}> {
  const yo = await exigirPermiso("comunicaciones.ver");
  const marcar = Boolean(opciones?.marcarLeido && conversacionId);
  if (marcar && conversacionId) {
    await marcarLeido(conversacionId, yo.id);
  }
  const conversaciones = await listarConversacionesDe(yo.id);
  if (!conversacionId) {
    return { conversaciones, mensajes: null };
  }
  const mensajes = await listarMensajes(conversacionId, yo.id);
  return { conversaciones, mensajes };
}

export async function marcarLeidoAction(conversacionId: string) {
  const yo = await exigirPermiso("comunicaciones.ver");
  await marcarLeido(conversacionId, yo.id);
}

export async function contarNoLeidosAction(
  excluirConversacionId?: string | null,
): Promise<number> {
  const yo = await exigirSesionUsuario();
  if (!usuarioPuede(yo, "comunicaciones.ver")) return 0;
  return contarNoLeidosDe(yo.id, excluirConversacionId);
}
