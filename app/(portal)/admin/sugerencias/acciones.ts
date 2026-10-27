"use server";

import { revalidatePath } from "next/cache";
import { formatearAlta, logActividad } from "@/lib/admin-logs";
import { exigirAdmin } from "@/lib/authz";
import {
  borrarSugerencia,
  convertirSugerenciaEnTarea,
  type Sugerencia,
} from "@/lib/sugerencias";

export async function crearTareaDesdeSugerenciaAction(
  formData: FormData,
): Promise<{ ok: true; sugerencia: Sugerencia } | { ok: false; motivo: string }> {
  const admin = await exigirAdmin();
  const sugerenciaId = String(formData.get("sugerencia_id") ?? "");
  const responsableId = String(formData.get("responsable_id") ?? "");
  const notasTecnicas = String(formData.get("notas_tecnicas") ?? "");

  const r = await convertirSugerenciaEnTarea({
    sugerenciaId,
    responsableId,
    notasTecnicas,
    mandadaPorId: admin.id,
  });
  if (!r.ok) return r;

  await logActividad(
    admin,
    "tarea_creada",
    formatearAlta(`Sugerencia «${r.sugerencia.titulo}» → tarea`, [
      { campo: "proyecto", valor: "Órbita" },
      { campo: "columna", valor: "Por hacer" },
    ]),
    {
      sugerenciaId: r.sugerencia.id,
      tareaId: r.sugerencia.tareaId,
      proyectoId: r.sugerencia.proyectoId,
      responsableId,
    },
  );

  revalidatePath("/admin/sugerencias");
  revalidatePath(`/proyectos/${r.sugerencia.proyectoId}`);
  return { ok: true, sugerencia: r.sugerencia };
}

export async function borrarSugerenciaAction(
  sugerenciaId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const admin = await exigirAdmin();
  const r = await borrarSugerencia(sugerenciaId);
  if (!r.ok) return r;

  await logActividad(admin, "tarea_eliminada", `Sugerencia borrada (${sugerenciaId})`, {
    sugerenciaId,
  });

  revalidatePath("/admin/sugerencias");
  return { ok: true };
}
