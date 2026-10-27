"use server";

import { redirect } from "next/navigation";
import { registrarAdminLog } from "@/lib/admin-logs";
import { exigirAdmin } from "@/lib/authz";
import {
  asignarPerfilUsuario,
  actualizarPerfil,
  crearPerfil,
  eliminarPerfil,
  guardarPermisosUsuario,
} from "@/lib/perfiles";

export async function crearPerfilAction(formData: FormData) {
  const actor = await exigirAdmin();
  const nombre = String(formData.get("nombre") ?? "");
  const r = await crearPerfil({
    nombre,
    descripcion: String(formData.get("descripcion") ?? ""),
    permisos: formData.getAll("permiso").map(String),
  });
  if (!r.ok) {
    redirect(
      `/admin/permisos?aviso=${r.motivo === "duplicado" ? "perfil_duplicado" : "falta_dato"}`,
    );
  }
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "perfil_creado",
    detalle: nombre.trim(),
    meta: { perfilId: r.id },
  });
  redirect("/admin/permisos?aviso=perfil_creado");
}

export async function editarPerfilAction(formData: FormData) {
  const actor = await exigirAdmin();
  const perfilId = String(formData.get("perfil_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const r = await actualizarPerfil({
    id: perfilId,
    nombre,
    descripcion: String(formData.get("descripcion") ?? ""),
    permisos: formData.getAll("permiso").map(String),
  });
  if (!r.ok) {
    const aviso =
      r.motivo === "duplicado"
        ? "perfil_duplicado"
        : r.motivo === "no_encontrado"
          ? "no_encontrado"
          : "falta_dato";
    redirect(`/admin/permisos?aviso=${aviso}`);
  }
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "perfil_guardado",
    detalle: nombre.trim() || perfilId,
    meta: { perfilId },
  });
  redirect("/admin/permisos?aviso=perfil_guardado");
}

export async function eliminarPerfilAction(formData: FormData) {
  const actor = await exigirAdmin();
  const perfilId = String(formData.get("perfil_id") ?? "");
  const r = await eliminarPerfil(perfilId);
  if (!r.ok) {
    redirect(
      `/admin/permisos?aviso=${r.motivo === "en_uso" ? "perfil_en_uso" : "no_encontrado"}`,
    );
  }
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "perfil_eliminado",
    detalle: `perfil_id=${perfilId}`,
    meta: { perfilId },
  });
  redirect("/admin/permisos?aviso=perfil_eliminado");
}

function destinoSeguro(formData: FormData, conAviso: string): string {
  const volver = String(formData.get("volver") ?? "").trim();
  if (volver.startsWith("/admin/permisos") || volver.startsWith("/admin/usuarios")) {
    const sep = volver.includes("?") ? "&" : "?";
    return `${volver}${sep}aviso=${conAviso}`;
  }
  return `/admin/usuarios?aviso=${conAviso}`;
}

export async function asignarPerfilAction(formData: FormData) {
  const actor = await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "");
  const perfilRaw = String(formData.get("perfil_id") ?? "");
  const r = await asignarPerfilUsuario(usuarioId, perfilRaw || null);
  if (!r.ok) {
    redirect(destinoSeguro(formData, "no_encontrado"));
  }
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "perfil_asignado",
    detalle: perfilRaw
      ? `usuario=${usuarioId} perfil=${perfilRaw}`
      : `usuario=${usuarioId} sin perfil`,
    meta: { usuarioId, perfilId: perfilRaw || null },
  });
  redirect(destinoSeguro(formData, "perfil_asignado"));
}

export async function guardarPermisosUsuarioAction(formData: FormData) {
  const actor = await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "");
  const permisos = formData.getAll("permiso").map(String);
  const r = await guardarPermisosUsuario(usuarioId, permisos);
  if (!r.ok) redirect("/admin/usuarios?aviso=no_encontrado");
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "permisos_usuario_guardados",
    detalle: `usuario=${usuarioId} (${permisos.length} permisos)`,
    meta: { usuarioId, numPermisos: permisos.length },
  });
  redirect(`/admin/permisos?usuario=${usuarioId}&aviso=permisos_usuario_guardados`);
}
