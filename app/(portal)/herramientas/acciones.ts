"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSesionUsuario } from "@/lib/authz";
import {
  actualizarHerramienta,
  crearHerramienta,
  eliminarHerramienta,
  validarHerramientaInput,
} from "@/lib/herramientas";

function inputDesdeForm(formData: FormData) {
  return validarHerramientaInput({
    nombre: String(formData.get("nombre") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
}

export async function crearHerramientaAction(formData: FormData) {
  const usuario = await exigirSesionUsuario();
  const v = inputDesdeForm(formData);
  if (!v.ok) {
    redirect(
      v.motivo === "url_invalida"
        ? "/herramientas?aviso=url_invalida"
        : "/herramientas?aviso=falta_dato",
    );
  }
  const r = await crearHerramienta(usuario.id, v.data);
  if (!r.ok) redirect("/herramientas?aviso=error_bd");
  revalidatePath("/herramientas");
  redirect("/herramientas?aviso=herramienta_creada");
}

export async function actualizarHerramientaAction(formData: FormData) {
  const usuario = await exigirSesionUsuario();
  const id = String(formData.get("id") ?? "").trim();
  const v = inputDesdeForm(formData);
  if (!id || !v.ok) {
    redirect(
      !v.ok && v.motivo === "url_invalida"
        ? "/herramientas?aviso=url_invalida"
        : "/herramientas?aviso=falta_dato",
    );
  }
  const r = await actualizarHerramienta(usuario.id, id, v.data);
  if (!r.ok) {
    redirect(
      r.motivo === "no_encontrado"
        ? "/herramientas?aviso=no_encontrado"
        : "/herramientas?aviso=error_bd",
    );
  }
  revalidatePath("/herramientas");
  redirect("/herramientas?aviso=herramienta_actualizada");
}

export async function eliminarHerramientaAction(formData: FormData) {
  const usuario = await exigirSesionUsuario();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/herramientas?aviso=falta_dato");
  const r = await eliminarHerramienta(usuario.id, id);
  if (!r.ok) {
    redirect(
      r.motivo === "no_encontrado"
        ? "/herramientas?aviso=no_encontrado"
        : "/herramientas?aviso=error_bd",
    );
  }
  revalidatePath("/herramientas");
  redirect("/herramientas?aviso=herramienta_eliminada");
}
