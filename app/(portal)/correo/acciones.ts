"use server";

import { exigirPermiso } from "@/lib/authz";
import { puedeVerApartado } from "@/lib/apartados";
import {
  enviarCorreoGmail,
  leerHilo,
  listarCorreos,
  marcarHiloEstrella,
  marcarHiloLeido,
  tokensCorreoOError,
  type CorreoAdjuntoEnvio,
  type CorreoCarpeta,
  type CorreoHiloDetalle,
  type CorreoListaItem,
} from "@/lib/google-gmail";
import { usuarioPuede } from "@/lib/usuarios";

function carpetaValida(v: string | undefined): CorreoCarpeta {
  return v === "sent" ? "sent" : "inbox";
}

async function exigirCorreoVer() {
  const usuario = await exigirPermiso("correo.ver");
  if (!(await puedeVerApartado("correo", usuario.esAdmin))) {
    return { ok: false as const, motivo: "apartado_off" as const };
  }
  const tok = await tokensCorreoOError(usuario.correo);
  if (!tok.ok) return { ok: false as const, motivo: "sin_token" as const };
  return { ok: true as const, usuario, tokens: tok.tokens };
}

export async function listarCorreosAction(opts?: {
  pageToken?: string;
  carpeta?: CorreoCarpeta;
  busqueda?: string;
  soloNoLeidos?: boolean;
  conAdjuntos?: boolean;
}): Promise<
  | { ok: true; items: CorreoListaItem[]; nextPageToken: string | null }
  | { ok: false; motivo: "apartado_off" | "sin_token" | "gmail_error"; detalle?: string }
> {
  const gate = await exigirCorreoVer();
  if (!gate.ok) return gate;
  try {
    const r = await listarCorreos(gate.tokens, {
      maxResults: 25,
      pageToken: opts?.pageToken,
      carpeta: carpetaValida(opts?.carpeta),
      busqueda: opts?.busqueda,
      soloNoLeidos: opts?.soloNoLeidos === true,
      conAdjuntos: opts?.conAdjuntos === true,
    });
    return { ok: true, items: r.items, nextPageToken: r.nextPageToken };
  } catch (err) {
    console.error("[correo] listar falló", { correo: gate.usuario.correo, error: err });
    return {
      ok: false,
      motivo: "gmail_error",
      detalle: err instanceof Error ? err.message : "error",
    };
  }
}

export async function leerHiloAction(
  threadId: string,
): Promise<
  | { ok: true; hilo: CorreoHiloDetalle; marcadoLeido: boolean; avisoSync: string | null }
  | { ok: false; motivo: "apartado_off" | "sin_token" | "falta_dato" | "gmail_error"; detalle?: string }
> {
  const id = threadId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };
  const gate = await exigirCorreoVer();
  if (!gate.ok) return gate;
  try {
    const hilo = await leerHilo(gate.tokens, id);
    let marcadoLeido = false;
    let avisoSync: string | null = null;
    if (hilo.unread) {
      try {
        await marcarHiloLeido(gate.tokens, id);
        marcadoLeido = true;
        hilo.unread = false;
        for (const m of hilo.messages) m.unread = false;
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        console.error("[correo] marcar hilo leído falló", {
          correo: gate.usuario.correo,
          threadId: id,
          detalle,
        });
        avisoSync = detalle.includes("403")
          ? "No se pudo marcar como leído en Gmail (403). Añade el scope gmail.modify y cierra sesión / vuelve a entrar."
          : "No se pudo sincronizar el estado leído con Gmail.";
      }
    }
    return { ok: true, hilo, marcadoLeido, avisoSync };
  } catch (err) {
    console.error("[correo] leer hilo falló", {
      correo: gate.usuario.correo,
      threadId: id,
      error: err,
    });
    return {
      ok: false,
      motivo: "gmail_error",
      detalle: err instanceof Error ? err.message : "error",
    };
  }
}

export async function alternarEstrellaAction(
  threadId: string,
  starred: boolean,
): Promise<
  | { ok: true; starred: boolean }
  | { ok: false; motivo: "apartado_off" | "sin_token" | "falta_dato" | "gmail_error"; detalle?: string }
> {
  const id = threadId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };
  const gate = await exigirCorreoVer();
  if (!gate.ok) return gate;
  try {
    await marcarHiloEstrella(gate.tokens, id, starred);
    return { ok: true, starred };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : "error";
    console.error("[correo] estrella hilo falló", {
      correo: gate.usuario.correo,
      threadId: id,
      detalle,
    });
    return { ok: false, motivo: "gmail_error", detalle };
  }
}

/** Marca varios hilos como leídos o no leídos. */
export async function marcarHilosLeidoAction(
  threadIds: string[],
  leido: boolean,
): Promise<
  | { ok: true; okIds: string[]; fallos: string[] }
  | {
      ok: false;
      motivo: "apartado_off" | "sin_token" | "falta_dato" | "gmail_error";
      detalle?: string;
    }
> {
  const ids = [...new Set(threadIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, motivo: "falta_dato" };
  const gate = await exigirCorreoVer();
  if (!gate.ok) return gate;
  const okIds: string[] = [];
  const fallos: string[] = [];
  for (const id of ids) {
    try {
      await marcarHiloLeido(gate.tokens, id, leido);
      okIds.push(id);
    } catch (err) {
      console.error("[correo] marcar hilos leído falló", {
        correo: gate.usuario.correo,
        threadId: id,
        leido,
        error: err,
      });
      fallos.push(id);
    }
  }
  if (okIds.length === 0) {
    return {
      ok: false,
      motivo: "gmail_error",
      detalle: "No se pudo actualizar el estado leído en Gmail.",
    };
  }
  return { ok: true, okIds, fallos };
}

export async function enviarCorreoAction(input: {
  to: string;
  subject: string;
  body: string;
  adjuntos?: CorreoAdjuntoEnvio[];
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<
  | { ok: true; id: string; threadId?: string }
  | {
      ok: false;
      motivo:
        | "apartado_off"
        | "sin_token"
        | "sin_permiso"
        | "falta_dato"
        | "modo_pruebas"
        | "gmail_error";
      detalle?: string;
    }
> {
  const usuario = await exigirPermiso("correo.ver");
  if (!usuarioPuede(usuario, "correo.editar")) {
    return { ok: false, motivo: "sin_permiso" };
  }
  if (!(await puedeVerApartado("correo", usuario.esAdmin))) {
    return { ok: false, motivo: "apartado_off" };
  }
  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body;
  const adjuntos = input.adjuntos ?? [];
  if (!to || (!body.trim() && adjuntos.length === 0)) {
    return { ok: false, motivo: "falta_dato" };
  }

  const tok = await tokensCorreoOError(usuario.correo);
  if (!tok.ok) return { ok: false, motivo: "sin_token" };

  try {
    const r = await enviarCorreoGmail(tok.tokens, {
      to,
      subject,
      body,
      from: usuario.correo,
      adjuntos,
      threadId: input.threadId,
      inReplyTo: input.inReplyTo,
      references: input.references,
    });
    return { ok: true, id: r.id, threadId: r.threadId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    if (msg.includes("modo pruebas")) {
      return { ok: false, motivo: "modo_pruebas" };
    }
    console.error("[correo] enviar falló", { correo: usuario.correo, error: err });
    return { ok: false, motivo: "gmail_error", detalle: msg };
  }
}
