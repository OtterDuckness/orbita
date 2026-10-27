"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  guardarPrefsNotifCorreo,
  normalizarDias,
  normalizarHora,
} from "@/lib/notif-correo-prefs";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export async function guardarNotifCorreoAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario || usuario.rol !== "interna") {
    redirect("/ajustes?aviso=error");
  }

  const activo = formData.get("activo") === "1" || formData.get("activo") === "on";
  const diasRaw = formData.getAll("dias").map((v) => Number(v));
  const dias = normalizarDias(diasRaw);
  const hora = normalizarHora(formData.get("hora"));

  await guardarPrefsNotifCorreo(usuario.id, { activo, dias, hora });
  revalidatePath("/ajustes");
  redirect("/ajustes?aviso=guardado");
}
