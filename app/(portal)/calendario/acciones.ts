"use server";

import { exigirPermiso } from "@/lib/authz";
import { crearEventoTimed, type EventoGoogleListado } from "@/lib/google-calendar";
import { tokensGooglePorCorreo } from "@/lib/usuarios";

export async function crearReunionAction(input: {
  titulo: string;
  inicioIso: string;
  finIso: string;
  timeZone: string;
  invitados?: string[];
  notificarInvitados?: boolean;
}): Promise<
  | {
      ok: true;
      evento: EventoGoogleListado;
      invitadosConfirmados: string[];
      notificado: boolean;
    }
  | {
      ok: false;
      motivo:
        | "sin_tokens"
        | "sin_titulo"
        | "rango_invalido"
        | "calendar_fallo"
        | "sin_invitados_validos";
    }
> {
  const usuario = await exigirPermiso("tareas.editar");
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, motivo: "sin_titulo" };

  const inicio = new Date(input.inicioIso);
  const fin = new Date(input.finIso);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    return { ok: false, motivo: "rango_invalido" };
  }

  const { esModoPruebas } = await import("@/lib/sandbox");
  if (await esModoPruebas()) {
    return { ok: false, motivo: "calendar_fallo" };
  }

  const tokens = await tokensGooglePorCorreo(usuario.correo);
  if (!tokens?.refreshToken) {
    return { ok: false, motivo: "sin_tokens" };
  }

  const org = usuario.correo.trim().toLowerCase();
  const invitadosPedidos = (input.invitados ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e !== org);

  try {
    const { invitadosConfirmados, ...evento } = await crearEventoTimed(
      {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiry: tokens.expiry ?? null,
      },
      {
        titulo,
        inicioIso: inicio.toISOString(),
        finIso: fin.toISOString(),
        timeZone: input.timeZone.trim() || "Europe/Madrid",
        invitados: invitadosPedidos,
        notificarInvitados: input.notificarInvitados !== false,
        organizadorEmail: org,
      },
    );

    const notificado =
      input.notificarInvitados !== false && invitadosConfirmados.length > 0;

    if (invitadosPedidos.length > 0 && invitadosConfirmados.length === 0) {
      console.warn("[calendario] Google no devolvió attendees", {
        pedimos: invitadosPedidos.length,
        eventId: evento.id,
      });
    }

    return {
      ok: true,
      evento,
      invitadosConfirmados,
      notificado,
    };
  } catch (error) {
    console.error("[calendario] crear reunión falló", { error });
    return { ok: false, motivo: "calendar_fallo" };
  }
}
