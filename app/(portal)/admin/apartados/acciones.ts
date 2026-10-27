"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActividad } from "@/lib/admin-logs";
import {
  APARTADOS,
  guardarApartados,
  type ApartadosActivos,
} from "@/lib/apartados";
import { exigirAdmin } from "@/lib/authz";

export async function guardarApartadosAction(formData: FormData) {
  const actor = await exigirAdmin();
  const valores = {} as ApartadosActivos;
  for (const a of APARTADOS) {
    valores[a.id] = formData.get(a.id) === "1";
  }

  await guardarApartados(valores, actor.id);
  await logActividad(
    actor,
    "ajuste_guardado",
    APARTADOS.map((a) => `${a.nombre}: ${valores[a.id] ? "equipo" : "solo admins"}`).join("; "),
    {
      clave: "apartados",
      ...Object.fromEntries(APARTADOS.map((a) => [a.clave, valores[a.id] ? "1" : "0"])),
    },
  );

  revalidatePath("/admin/apartados");
  revalidatePath("/", "layout");
  redirect("/admin/apartados?aviso=guardado");
}
