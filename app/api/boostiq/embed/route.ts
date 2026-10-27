import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mintBoostiqEmbedUrl } from "@/lib/boostiq-embed";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

/** Mint fresco para el iframe Admin (evita tokens quemados por prefetch RSC). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) {
    return NextResponse.json({ ok: false, motivo: "sin_sesion" }, { status: 401 });
  }

  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  if (!usuario?.esAdmin) {
    return NextResponse.json({ ok: false, motivo: "sin_permiso" }, { status: 403 });
  }

  console.info("[ORBITA_EMBED] mint para", usuario.correo);
  const mint = await mintBoostiqEmbedUrl(usuario.correo);
  if (!mint.ok) {
    console.warn("[ORBITA_EMBED] mint falló", mint);
    return NextResponse.json(mint, { status: mint.motivo === "sin_config" ? 503 : 502 });
  }
  console.info(
    "[ORBITA_EMBED] mint ok urlLen=",
    mint.url.length,
    "hasToken=",
    mint.url.includes("orbita_embed=") || mint.url.includes("token="),
  );
  return NextResponse.json(mint);
}
