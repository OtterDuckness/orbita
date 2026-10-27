"use server";

import { redirect } from "next/navigation";
import { registrarAdminLog } from "@/lib/admin-logs";
import { exigirAdmin } from "@/lib/authz";
import {
  actualizarAdminUsuario,
  crearUsuarioInterno,
  eliminarUsuarioInterno,
} from "@/lib/usuarios";

export async function crearUsuarioAction(formData: FormData) {
  const actor = await exigirAdmin();
  const nombre = String(formData.get("nombre") ?? "");
  const correo = String(formData.get("correo") ?? "");
  const esAdmin = formData.get("es_admin") === "1";
  const r = await crearUsuarioInterno({
    nombre,
    correo,
    perfilId: String(formData.get("perfil_id") ?? "") || null,
    esAdmin,
  });
  if (!r.ok) {
    const aviso =
      r.motivo === "correo_duplicado"
        ? "correo_duplicado"
        : r.motivo === "correo_invalido"
          ? "correo_invalido"
          : r.motivo === "perfil_invalido"
            ? "no_encontrado"
            : "falta_dato";
    redirect(`/admin/usuarios?aviso=${aviso}`);
  }
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "usuario_creado",
    detalle: `${nombre.trim()} <${correo.trim().toLowerCase()}>${esAdmin ? " (admin)" : ""}`,
    meta: { usuarioId: r.id },
  });
  redirect("/admin/usuarios?aviso=usuario_creado");
}

export async function eliminarUsuarioAction(formData: FormData) {
  const actor = await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "");
  const r = await eliminarUsuarioInterno(usuarioId, actor.id);
  if (!r.ok) redirect(`/admin/usuarios?aviso=${r.motivo}`);
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: "usuario_eliminado",
    detalle: `usuario_id=${usuarioId}`,
    meta: { usuarioId },
  });
  redirect("/admin/usuarios?aviso=usuario_eliminado");
}

export async function actualizarAdminAction(formData: FormData) {
  const actor = await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "");
  const esAdmin = formData.get("es_admin") === "1";
  const r = await actualizarAdminUsuario(usuarioId, esAdmin);
  if (!r.ok) redirect(`/admin/usuarios?aviso=${r.motivo}`);
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion: esAdmin ? "admin_concedido" : "admin_revocado",
    detalle: `usuario_id=${usuarioId}`,
    meta: { usuarioId, esAdmin },
  });
  redirect("/admin/usuarios?aviso=admin_actualizado");
}
