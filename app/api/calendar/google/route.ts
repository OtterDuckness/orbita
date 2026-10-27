import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeVerApartado } from "@/lib/apartados";
import { listarEventosPrimary } from "@/lib/google-calendar";
import { filtrarEventosReunion } from "@/lib/agenda";
import { idsEventosCalendarOrbita, tareasDelUsuario } from "@/lib/tablero";
import {
  obtenerUsuarioAuthPorCorreo,
  tokensGooglePorCorreo,
  usuarioPuede,
} from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymdValido(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isoValido(s: string) {
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

/** Fallback cuando solo llegan from/to YMD (calendario de Proyectos). */
function timeMinDe(ymd: string) {
  return `${ymd}T00:00:00.000Z`;
}

function timeMaxDe(ymd: string) {
  return `${ymd}T23:59:59.999Z`;
}

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  if (
    !usuario ||
    !(usuarioPuede(usuario, "proyectos.ver") || usuarioPuede(usuario, "tareas.ver"))
  ) {
    return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
  }
  if (!(await puedeVerApartado("calendario", usuario.esAdmin))) {
    return NextResponse.json({ error: "apartado_off" }, { status: 403 });
  }

  const url = new URL(req.url);
  const timeMinRaw = url.searchParams.get("timeMin")?.trim() ?? "";
  const timeMaxRaw = url.searchParams.get("timeMax")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";

  let timeMin: string;
  let timeMax: string;
  if (timeMinRaw && timeMaxRaw && isoValido(timeMinRaw) && isoValido(timeMaxRaw)) {
    timeMin = new Date(timeMinRaw).toISOString();
    timeMax = new Date(timeMaxRaw).toISOString();
  } else if (ymdValido(from) && ymdValido(to)) {
    timeMin = timeMinDe(from);
    timeMax = timeMaxDe(to);
  } else {
    return NextResponse.json({ error: "rango_invalido" }, { status: 400 });
  }

  const tokens = await tokensGooglePorCorreo(email);
  if (!tokens?.refreshToken) {
    return NextResponse.json({ error: "sin_tokens", eventos: [] }, { status: 200 });
  }

  try {
    const [eventos, idsOrbita, tareas] = await Promise.all([
      listarEventosPrimary(
        {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
          expiry: tokens.expiry ?? null,
        },
        { timeMin, timeMax },
      ),
      idsEventosCalendarOrbita(),
      tareasDelUsuario(usuario.id),
    ]);

    const filtrados = filtrarEventosReunion(eventos, idsOrbita, tareas);
    return NextResponse.json({ eventos: filtrados });
  } catch (error) {
    console.error("[calendar] listar Google falló", { email, error });
    return NextResponse.json({ error: "calendar_fallo", eventos: [] }, { status: 502 });
  }
}
