"use server";

import { revalidatePath } from "next/cache";
import { formatearAlta, logActividad } from "@/lib/admin-logs";
import { exigirSesionUsuario } from "@/lib/authz";
import { crearSugerencia, type Sugerencia } from "@/lib/sugerencias";

export async function enviarSugerenciaAction(
  formData: FormData,
): Promise<{ ok: true; sugerencia: Sugerencia } | { ok: false; motivo: string }> {
  const usuario = await exigirSesionUsuario();
  const titulo = String(formData.get("titulo") ?? "");
  const texto = String(formData.get("texto") ?? "");

  const r = await crearSugerencia({
    autorId: usuario.id,
    autorNombre: usuario.nombre,
    titulo,
    texto,
  });
  if (!r.ok) return r;

  await logActividad(
    usuario,
    "tarea_creada",
    formatearAlta(`Sugerencia «${r.sugerencia.titulo}»`, [
      { campo: "destino", valor: "Inbox admin" },
    ]),
    { sugerenciaId: r.sugerencia.id, proyectoId: r.sugerencia.proyectoId },
  );

  revalidatePath("/admin/sugerencias");
  return { ok: true, sugerencia: r.sugerencia };
}
