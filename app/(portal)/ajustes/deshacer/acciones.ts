"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { deshacerAccion } from "@/lib/deshacer";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export async function deshacerAccionAction(
  accionId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, motivo: "sin_permiso" };
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) return { ok: false, motivo: "sin_permiso" };

  const r = await deshacerAccion(accionId, usuario);
  if (!r.ok) return r;

  revalidatePath("/ajustes/deshacer");
  revalidatePath("/eliminados");
  revalidatePath("/clientes");
  revalidatePath("/proyectos");
  revalidatePath("/tareas");
  return { ok: true };
}
