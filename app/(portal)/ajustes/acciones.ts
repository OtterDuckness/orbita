"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  guardarNavPrefs,
  leerNavPrefs,
  restablecerNavPrefs,
  type NavItemId,
} from "@/lib/nav-mock";

async function emailSesion() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return session.user.email;
}

/** Guarda solo el orden de secciones visibles; conserva ocultos ya guardados. */
export async function guardarOrdenMenu(ordenVisible: string[]) {
  const email = await emailSesion();
  const actuales = leerNavPrefs(email);
  const visto = new Set<string>();
  const orden: NavItemId[] = [];
  for (const id of ordenVisible) {
    if (visto.has(id) || !actuales.orden.includes(id as NavItemId)) continue;
    visto.add(id);
    orden.push(id as NavItemId);
  }
  for (const id of actuales.orden) {
    if (visto.has(id)) continue;
    orden.push(id);
  }
  const r = guardarNavPrefs(email, { orden, ocultos: actuales.ocultos });
  if (!r.ok) return { ok: false as const, motivo: r.motivo };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function restablecerMenuPreferencias() {
  const email = await emailSesion();
  const r = restablecerNavPrefs(email);
  if (!r.ok) redirect("/ajustes?aviso=falta_dato");
  redirect("/ajustes?aviso=menu_restablecido");
}
