"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActividad } from "@/lib/admin-logs";
import { guardarAccesoUrlProyectos } from "@/lib/ajustes-globales";
import { exigirAdmin, exigirAdminReal } from "@/lib/authz";
import { enviarDigestPrueba } from "@/lib/digest-correo";
import { escribirCookieSandbox } from "@/lib/sandbox";
import { sincronizarUsuariosAPruebas } from "@/lib/sandbox-sync";
import { escribirCookieVistaUsuario } from "@/lib/vista-usuario";

function destinoAviso(formData: FormData | undefined, codigo: string): string {
  const raw = formData?.get("next");
  const base =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw.split("?")[0] || "/"
      : "/";
  return `${base}?aviso=${codigo}`;
}

export async function guardarAjustesGlobalesAction(formData: FormData) {
  const actor = await exigirAdmin();
  const abierto = formData.get("proyectos_url_abierta") === "1";

  await guardarAccesoUrlProyectos(abierto, actor.id);
  await logActividad(
    actor,
    "ajuste_guardado",
    `Acceso URL a proyectos ajenos: ${abierto ? "permitido" : "bloqueado"}`,
    { clave: "proyectos_url_abierta", valor: abierto ? "1" : "0" },
  );

  revalidatePath("/admin/ajustes");
  revalidatePath("/proyectos");
  redirect("/admin/ajustes?aviso=guardado");
}

export async function enviarDigestPruebaAction() {
  const actor = await exigirAdmin();
  const r = await enviarDigestPrueba({
    id: actor.id,
    nombre: actor.nombre,
    correo: actor.correo,
  });

  if (!r.ok) {
    await logActividad(actor, "digest_prueba_error", r.error, {
      error: r.error,
    });
    redirect("/admin/ajustes?aviso=digest_prueba_error");
  }

  await logActividad(
    actor,
    "digest_prueba",
    `Digest de prueba (${r.tipo}) → ${actor.correo}`,
    { tipo: r.tipo },
  );
  redirect("/admin/ajustes?aviso=digest_prueba_ok");
}

export async function activarModoPruebasAction() {
  const actor = await exigirAdmin();
  const sync = await sincronizarUsuariosAPruebas();
  if (!sync.ok) {
    redirect("/admin/ajustes?aviso=sandbox_error");
  }
  await escribirCookieSandbox(true);
  await logActividad(actor, "ajuste_guardado", "Modo pruebas activado (sesión)", {
    clave: "sandbox",
    valor: "1",
  });
  revalidatePath("/", "layout");
  redirect("/admin/ajustes?aviso=sandbox_on&sandbox=1");
}

export async function desactivarModoPruebasAction() {
  const actor = await exigirAdminReal();
  await escribirCookieSandbox(false);
  await logActividad(actor, "ajuste_guardado", "Modo pruebas desactivado", {
    clave: "sandbox",
    valor: "0",
  });
  revalidatePath("/", "layout");
  // Home: con vista usuario activa no se puede abrir /admin.
  redirect("/?aviso=sandbox_off&sandbox=0");
}

export async function activarVistaUsuarioAction(formData?: FormData) {
  const actor = await exigirAdmin();
  await escribirCookieVistaUsuario(true);
  await logActividad(
    actor,
    "ajuste_guardado",
    "Vista usuario activada (sesión sin privilegios admin)",
    { clave: "vista_usuario", valor: "1" },
  );
  revalidatePath("/", "layout");
  redirect(destinoAviso(formData, "vista_usuario_on"));
}

export async function desactivarVistaUsuarioAction(formData?: FormData) {
  const actor = await exigirAdminReal();
  await escribirCookieVistaUsuario(false);
  await logActividad(actor, "ajuste_guardado", "Vista usuario desactivada", {
    clave: "vista_usuario",
    valor: "0",
  });
  revalidatePath("/", "layout");
  redirect(destinoAviso(formData, "vista_usuario_off"));
}

export async function sincronizarSandboxAction() {
  const actor = await exigirAdmin();
  const sync = await sincronizarUsuariosAPruebas();
  if (!sync.ok) {
    redirect("/admin/ajustes?aviso=sandbox_error");
  }
  await logActividad(
    actor,
    "ajuste_guardado",
    "Usuarios internas copiados a BD de pruebas",
    { clave: "sandbox_sync" },
  );
  revalidatePath("/admin/ajustes");
  redirect("/admin/ajustes?aviso=sandbox_sync_ok");
}
