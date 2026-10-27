"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { guardarTimezoneUsuario, obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";
import { attrsCookieZona, COOKIE_ZONA, parseZona } from "@/lib/zona";

export async function guardarZonaAction(
  timezone: string,
): Promise<{ ok: true; timezone: string } | { ok: false; motivo: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, motivo: "sin_permiso" };
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) return { ok: false, motivo: "sin_permiso" };

  const r = await guardarTimezoneUsuario(usuario.id, timezone);
  if (!r.ok) return { ok: false, motivo: r.motivo };

  const jar = await cookies();
  jar.set(COOKIE_ZONA, parseZona(r.timezone), attrsCookieZona());
  revalidatePath("/", "layout");
  revalidatePath("/ajustes");
  return r;
}
