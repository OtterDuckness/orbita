"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { COOKIE_TEMA, parseTema, type TemaOrbita } from "@/lib/tema";

const UN_ANO = 60 * 60 * 24 * 365;

export async function guardarTemaAction(formData: FormData) {
  const tema = parseTema(String(formData.get("tema") ?? ""));
  const jar = await cookies();
  jar.set(COOKIE_TEMA, tema, {
    path: "/",
    maxAge: UN_ANO,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
  redirect("/ajustes?aviso=guardado");
}

export async function leerTemaActual(): Promise<TemaOrbita> {
  const jar = await cookies();
  return parseTema(jar.get(COOKIE_TEMA)?.value);
}
