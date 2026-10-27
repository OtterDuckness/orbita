import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeVerApartado } from "@/lib/apartados";
import {
  descargarAdjuntoGmail,
  tokensCorreoOError,
} from "@/lib/google-gmail";
import { obtenerUsuarioAuthPorCorreo, usuarioPuede } from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]+/gi, "_").slice(0, 180) || "adjunto";
}

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  if (!usuario || !usuarioPuede(usuario, "correo.ver")) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }
  if (!(await puedeVerApartado("correo", usuario.esAdmin))) {
    return NextResponse.json({ error: "apartado_off" }, { status: 403 });
  }

  const url = new URL(req.url);
  const messageId = (url.searchParams.get("messageId") ?? "").trim();
  const attachmentId = (url.searchParams.get("attachmentId") ?? "").trim();
  const filename = nombreSeguro(url.searchParams.get("filename") ?? "adjunto");
  const mime = (url.searchParams.get("mime") ?? "application/octet-stream").trim();

  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: "falta_dato" }, { status: 400 });
  }

  const tok = await tokensCorreoOError(email);
  if (!tok.ok) {
    return NextResponse.json({ error: "sin_token" }, { status: 403 });
  }

  try {
    const { buffer } = await descargarAdjuntoGmail(tok.tokens, messageId, attachmentId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[gmail] download adjunto falló", { email, messageId, error: err });
    return NextResponse.json({ error: "gmail_error" }, { status: 502 });
  }
}
