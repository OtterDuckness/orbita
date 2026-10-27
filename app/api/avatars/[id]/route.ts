import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { leerObjeto } from "@/lib/gcs";
import { avatarParaServir, obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const yo = await obtenerUsuarioAuthPorCorreo(email);
  if (!yo) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const r = await avatarParaServir(id);
  if (!r.ok) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await leerObjeto(r.gcsObject);
    const mime = contentType && contentType.startsWith("image/")
      ? contentType
      : "image/jpeg";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": 'inline; filename="avatar"',
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[gcs] avatar download falló", { id, error: err });
    return NextResponse.json({ error: "gcs_error" }, { status: 502 });
  }
}
