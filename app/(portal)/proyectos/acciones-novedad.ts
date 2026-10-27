"use server";

import { revalidatePath } from "next/cache";
import { exigirPermiso } from "@/lib/authz";
import { perteneceAlProyecto } from "@/lib/clientes-mock";
import { marcarAsignacionVista, proyectoPorId } from "@/lib/proyectos";

/** Marca la asignación al proyecto como vista (panel Novedades). */
export async function marcarAsignacionVistaAction(proyectoId: string): Promise<void> {
  const yo = await exigirPermiso("tareas.ver");
  const id = String(proyectoId ?? "").trim();
  if (!id) return;
  const proyecto = await proyectoPorId(id);
  if (!proyecto) return;
  if (!perteneceAlProyecto(proyecto, yo.id) && !yo.esAdmin) return;
  await marcarAsignacionVista(id, yo.id);
  revalidatePath("/");
  revalidatePath("/proyectos");
}
