"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AVATAR_MAX_BYTES } from "@/lib/gcs";
import {
  actualizarNombreUsuario,
  guardarAvatarUsuario,
  obtenerUsuarioAuthPorCorreo,
  quitarAvatarUsuario,
} from "@/lib/usuarios";

async function yoSesion() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const yo = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!yo) redirect("/login");
  return yo;
}

export async function guardarPerfilAction(formData: FormData) {
  const yo = await yoSesion();
  const nombre = String(formData.get("nombre") ?? "");
  const quitar = String(formData.get("quitar_avatar") ?? "") === "1";

  const rNombre = await actualizarNombreUsuario(yo.id, nombre);
  if (!rNombre.ok) redirect(`/ajustes?aviso=${rNombre.motivo}`);

  if (quitar) {
    await quitarAvatarUsuario(yo.id);
  } else {
    const raw = formData.get("avatar");
    if (raw instanceof File && raw.size > 0) {
      if (raw.size > AVATAR_MAX_BYTES) redirect("/ajustes?aviso=archivo_grande");
      const mime = raw.type || "application/octet-stream";
      const r = await guardarAvatarUsuario(yo.id, {
        buffer: Buffer.from(await raw.arrayBuffer()),
        nombre: raw.name || "avatar",
        mime,
        tamanoBytes: raw.size,
      });
      if (!r.ok) redirect(`/ajustes?aviso=${r.motivo}`);
    }
  }

  revalidatePath("/", "layout");
  redirect("/ajustes?aviso=perfil_personal_guardado");
}
