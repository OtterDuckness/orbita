"use server";

import { revalidatePath } from "next/cache";
import { formatearAlta, logActividad } from "@/lib/admin-logs";
import { auth } from "@/auth";
import {
  puedeGestionarPapelera,
  puedeRestaurarTipo,
  restaurarEliminacion,
  obtenerEliminacion,
} from "@/lib/papelera";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export async function restaurarEliminacionAction(
  eliminacionId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, motivo: "sin_permiso" };
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario || !puedeGestionarPapelera(usuario)) {
    return { ok: false, motivo: "sin_permiso" };
  }

  const previa = await obtenerEliminacion(eliminacionId);
  if (!previa) return { ok: false, motivo: "no_encontrado" };
  if (!puedeRestaurarTipo(usuario, previa.tipo)) {
    return { ok: false, motivo: "sin_permiso" };
  }

  const r = await restaurarEliminacion(eliminacionId, usuario);
  if (!r.ok) return r;

  const accion =
    r.tipo === "tarea"
      ? "tarea_restaurada"
      : r.tipo === "proyecto"
        ? "proyecto_restaurado"
        : "cliente_restaurado";
  await logActividad(
    usuario,
    accion,
    formatearAlta(`${r.tipo} «${r.etiqueta}» restaurado desde papelera`, []),
    { eliminacionId, entidadId: r.entidadId, tipo: r.tipo },
  );

  revalidatePath("/eliminados");
  revalidatePath("/clientes");
  revalidatePath("/proyectos");
  revalidatePath("/tareas");
  return { ok: true };
}
