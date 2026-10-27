import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adjuntoParaDescarga } from "@/lib/comunicaciones";
import { leerObjeto } from "@/lib/gcs";
import { adjuntoTareaParaDescarga } from "@/lib/tarea-chat";
import { obtenerUsuarioAuthPorCorreo, usuarioPuede } from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esImagen(mime: string | null | undefined) {
  return Boolean(mime && mime.toLowerCase().startsWith("image/"));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  if (!usuario) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const forzarDescarga = new URL(req.url).searchParams.get("download") === "1";

  // Primero intentar como adjunto de tarea.
  if (usuarioPuede(usuario, "tareas.ver")) {
    const deTarea = await adjuntoTareaParaDescarga(id, usuario.id, usuario.esAdmin);
    if (deTarea.ok) {
      try {
        const { buffer, contentType } = await leerObjeto(deTarea.adjunto.gcsObject);
        const mime = contentType || deTarea.adjunto.mime || "application/octet-stream";
        const nombre = deTarea.adjunto.nombre.replace(/"/g, "");
        const inline = !forzarDescarga && esImagen(mime);
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nombre}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": inline ? "private, max-age=3600" : "private, no-store",
          },
        });
      } catch (err) {
        console.error("[gcs] download tarea falló", { id, error: err });
        return NextResponse.json({ error: "gcs_error" }, { status: 502 });
      }
    }
    if (deTarea.motivo === "sin_acceso") {
      return NextResponse.json({ error: "sin_acceso" }, { status: 403 });
    }
  }

  // Adjunto de chat (comunicaciones).
  if (!usuarioPuede(usuario, "comunicaciones.ver")) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }

  const r = await adjuntoParaDescarga(id, usuario.id);
  if (!r.ok) {
    return NextResponse.json(
      { error: r.motivo },
      { status: r.motivo === "sin_acceso" ? 403 : 404 },
    );
  }

  try {
    const { buffer, contentType } = await leerObjeto(r.adjunto.gcsObject);
    const mime = contentType || r.adjunto.mime || "application/octet-stream";
    const nombre = r.adjunto.nombre.replace(/"/g, "");
    const inline = !forzarDescarga && esImagen(mime);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nombre}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": inline ? "private, max-age=3600" : "private, no-store",
      },
    });
  } catch (err) {
    console.error("[gcs] download falló", { id, error: err });
    return NextResponse.json({ error: "gcs_error" }, { status: 502 });
  }
}
