import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeUsarAgenteIa } from "@/lib/ajustes-globales";
import {
  pendientesUiEnriquecidos,
  resolverConfirmacionUi,
} from "@/lib/asistente/confirmacion-ui";
import { TopeGastoError } from "@/lib/asistente/coste";
import { ejecutarTurno } from "@/lib/asistente/run";
import {
  crearConversacion,
  listarMensajes,
  obtenerConversacion,
} from "@/lib/asistente/store";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  if (!usuario) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  if (!(await puedeUsarAgenteIa(usuario.esAdmin))) {
    return NextResponse.json({ error: "agente_desactivado" }, { status: 403 });
  }

  let body: {
    conversacionId?: string;
    mensaje?: string;
    accion?: string;
    tool?: string;
    clave?: string;
    argsEditados?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as {
      conversacionId?: string;
      mensaje?: string;
      accion?: string;
      tool?: string;
      clave?: string;
      argsEditados?: Record<string, unknown>;
    };
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const accionRaw = String(body.accion ?? "").trim().toLowerCase();
  const esConfirmacionUi =
    accionRaw === "confirmar" ||
    accionRaw === "cancelar" ||
    accionRaw === "confirmar_todas" ||
    accionRaw === "cancelar_todas";

  let conversacionId = String(body.conversacionId ?? "").trim();
  if (conversacionId) {
    const conv = await obtenerConversacion(conversacionId, usuario.id);
    if (!conv) {
      return NextResponse.json({ error: "conversacion_ajena" }, { status: 404 });
    }
  } else if (esConfirmacionUi) {
    return NextResponse.json({ error: "falta_conversacion" }, { status: 400 });
  } else {
    const conv = await crearConversacion(usuario.id, "Nueva conversación");
    conversacionId = conv.id;
  }

  const nombreVisible =
    usuario.nombre?.trim() || session?.user?.name?.trim() || email;
  const usuarioSesion = { ...usuario, nombre: nombreVisible };

  if (esConfirmacionUi) {
    try {
      const argsEditados =
        body.argsEditados &&
        typeof body.argsEditados === "object" &&
        !Array.isArray(body.argsEditados)
          ? (body.argsEditados as Record<string, unknown>)
          : null;
      const result = await resolverConfirmacionUi({
        usuario: usuarioSesion,
        conversacionId,
        accion: accionRaw as
          | "confirmar"
          | "cancelar"
          | "confirmar_todas"
          | "cancelar_todas",
        tool: body.tool,
        clave: body.clave,
        argsEditados: accionRaw === "confirmar" ? argsEditados : null,
      });

      const esConfirmacionOk =
        (accionRaw === "confirmar" || accionRaw === "confirmar_todas") &&
        result.ok;
      // Tras la última confirmación OK, otra ronda LLM para no dejar a medias
      // peticiones tipo «borra y recrea». No continuar si la tool falló.
      if (esConfirmacionOk && result.confirmacionesPendientes.length === 0) {
        try {
          const cont = await ejecutarTurno({
            usuario: usuarioSesion,
            conversacionId,
            mensajeUsuario: "",
            continuarTrasConfirmacion: true,
          });
          const historial = await listarMensajes(conversacionId);
          const pendientes = await pendientesUiEnriquecidos(
            usuarioSesion,
            historial,
          );
          const respuesta = [result.respuesta, cont.respuesta]
            .map((s) => s.trim())
            .filter(Boolean)
            .join("\n\n");
          return NextResponse.json({
            conversacionId,
            respuesta,
            confirmacionesPendientes: pendientes,
            confirmacionPendiente: pendientes[0] ?? null,
            uso: {
              inputTokens: cont.inputTokens,
              outputTokens: cont.outputTokens,
              cacheCreationTokens: cont.cacheCreationTokens,
              cacheReadTokens: cont.cacheReadTokens,
              webSearchRequests: cont.webSearchRequests,
              costeUsd: cont.costeUsd,
            },
          });
        } catch (contErr) {
          if (
            contErr instanceof TopeGastoError ||
            (contErr instanceof Error && contErr.message === "tope_gasto")
          ) {
            return NextResponse.json({
              conversacionId,
              respuesta: result.respuesta,
              confirmacionesPendientes: [],
              confirmacionPendiente: null,
              errorTopeTrasContinuar: true,
            });
          }
          console.error("[api/asistente] continuar tras confirmacion", contErr);
          return NextResponse.json({
            conversacionId,
            respuesta: result.respuesta,
            confirmacionesPendientes: [],
            confirmacionPendiente: null,
          });
        }
      }

      return NextResponse.json({
        conversacionId,
        respuesta: result.respuesta,
        confirmacionesPendientes: result.confirmacionesPendientes,
        confirmacionPendiente: result.confirmacionesPendientes[0] ?? null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "sin_confirmacion_pendiente") {
        return NextResponse.json(
          { error: "sin_confirmacion_pendiente" },
          { status: 409 },
        );
      }
      console.error("[api/asistente] confirmacion-ui", msg);
      return NextResponse.json(
        { error: "fallo_agente", detalle: msg },
        { status: 500 },
      );
    }
  }

  const mensaje = String(body.mensaje ?? "").trim();
  if (!mensaje) {
    return NextResponse.json({ error: "mensaje_vacio" }, { status: 400 });
  }

  try {
    const result = await ejecutarTurno({
      usuario: usuarioSesion,
      conversacionId,
      mensajeUsuario: mensaje,
    });
    const historial = await listarMensajes(conversacionId);
    const pendientes = await pendientesUiEnriquecidos(usuarioSesion, historial);
    return NextResponse.json({
      conversacionId,
      titulo: result.titulo,
      respuesta: result.respuesta,
      confirmacionesPendientes: pendientes,
      confirmacionPendiente: pendientes[0] ?? null,
      uso: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheCreationTokens: result.cacheCreationTokens,
        cacheReadTokens: result.cacheReadTokens,
        webSearchRequests: result.webSearchRequests,
        costeUsd: result.costeUsd,
      },
    });
  } catch (error) {
    if (
      error instanceof TopeGastoError ||
      (error instanceof Error &&
        error.message === "tope_gasto" &&
        typeof (error as { usado?: unknown }).usado === "number" &&
        typeof (error as { tope?: unknown }).tope === "number")
    ) {
      const e = error as TopeGastoError;
      return NextResponse.json(
        {
          error: "tope_gasto",
          usado: e.usado,
          tope: e.tope,
        },
        { status: 429 },
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api/asistente]", msg);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
    }
    return NextResponse.json({ error: "fallo_agente", detalle: msg }, { status: 500 });
  }
}
