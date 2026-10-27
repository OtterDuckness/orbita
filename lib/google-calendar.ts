/**
 * Cliente mínimo Google Calendar API v3 (events en calendario primary).
 * Docs: https://developers.google.com/calendar/api/v3/reference/events
 */

import { ZONA } from "@/lib/formato";
import { esModoPruebas } from "@/lib/sandbox";
import { asignarCalendarEventId, tareasDe } from "@/lib/tablero";
import type { Tarea } from "@/lib/tareas-mock";
import { mapaEquipo, tokensGooglePorCorreo, usuarioPorId } from "@/lib/usuarios";

type Tokens = {
  refreshToken: string;
  accessToken?: string | null;
  expiry?: Date | null;
};

type EventoInput = {
  titulo: string;
  fechaMaxima: string | null;
  /** Id de la tarea Orbita; se guarda en extendedProperties para no listarla como reunión. */
  tareaId?: string;
  /** Texto plano → description del evento (p. ej. notas de la tarea). */
  descripcion?: string | null;
  eventId?: string | null;
  /** Correos de invitados (aparecen en su Google Calendar). */
  invitados?: string[];
  /** Correo del organizador; se excluye de attendees. */
  organizadorEmail?: string | null;
  /** Si true: título con ✓ y transparency transparent (menos ruido). */
  completada?: boolean;
  /** Si false, no notifica por correo a invitados (sendUpdates=none). */
  notificarInvitados?: boolean;
};

const PREFIJO_HECHA = "✓ ";

function tituloEventoTarea(titulo: string, completada: boolean): string {
  const limpio = titulo.replace(/^\s*✓\s*/, "").trim() || "(Sin título)";
  return completada ? `${PREFIJO_HECHA}${limpio}` : limpio;
}

function correosInvitados(
  invitados: string[] | undefined,
  organizadorEmail: string | null | undefined,
): string[] {
  const org = organizadorEmail?.trim().toLowerCase() ?? "";
  return [
    ...new Set(
      (invitados ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== org),
    ),
  ];
}

/** Sync si hay fecha máxima y (checkbox calendar o tarea compartida con otros). */
export function necesitaSyncCalendarTarea(tarea: Tarea): boolean {
  if (!tarea.fechaMaxima) return false;
  if (tarea.syncCalendar) return true;
  const ids = tarea.responsableIds;
  if (ids.length > 1) return true;
  if (ids.length === 1 && tarea.mandadaPorId && ids[0] !== tarea.mandadaPorId) return true;
  return false;
}

function clientCreds() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET");
  }
  return { clientId, clientSecret };
}

/** All-day de un solo día (fecha máxima). Google usa end exclusive. */
function fechaAllDayMaxima(maxima: string | null) {
  if (!maxima) return null;
  return { start: maxima, end: sumarUnDia(maxima) };
}

function sumarUnDia(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function obtenerAccessToken(tokens: Tokens): Promise<string> {
  const stillValid =
    tokens.accessToken &&
    tokens.expiry &&
    tokens.expiry.getTime() > Date.now() + 60_000;
  if (stillValid && tokens.accessToken) return tokens.accessToken;

  const { clientId, clientSecret } = clientCreds();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh falló: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return data.access_token;
}

export async function crearOActualizarEventoTarea(
  tokens: Tokens,
  input: EventoInput,
): Promise<string> {
  const rango = fechaAllDayMaxima(input.fechaMaxima);
  if (!rango) {
    throw new Error("Sin fecha máxima para sincronizar a Calendar");
  }

  const accessToken = await obtenerAccessToken(tokens);
  const completada = Boolean(input.completada);
  const emails = correosInvitados(input.invitados, input.organizadorEmail);
  const notificar = input.notificarInvitados === true && emails.length > 0;

  const payload: Record<string, unknown> = {
    summary: tituloEventoTarea(input.titulo, completada),
    description: (input.descripcion ?? "").trim(),
    start: { date: rango.start },
    end: { date: rango.end },
    transparency: completada ? "transparent" : "opaque",
    extendedProperties: {
      private: {
        orbita: "tarea",
        ...(input.tareaId ? { tareaId: input.tareaId } : {}),
      },
    },
  };
  if (emails.length > 0) {
    payload.attendees = emails.map((email) => ({ email }));
  }

  const params = new URLSearchParams();
  params.set("sendUpdates", notificar ? "all" : "none");

  if (input.eventId) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}?${params}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return data.id;
    }
    // Si el evento ya no existe, creamos uno nuevo
    if (res.status !== 404 && res.status !== 410) {
      const text = await res.text();
      throw new Error(`Calendar patch falló: ${res.status} ${text}`);
    }
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar insert falló: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Crea/actualiza (o borra) el evento de una tarea en Google Calendar.
 * Prefiere el Calendar de quien mandó la tarea (dueño del evento); si no hay token, el del actor.
 * Responsables distintos van como invitados → aparecen en su Calendar.
 * Completada: prefijo ✓ + transparency transparent (API Events).
 */
export async function sincronizarTareaConCalendar(
  tarea: Tarea,
  correoActor: string,
): Promise<boolean> {
  if (await esModoPruebas()) return true;

  const necesitaSync = necesitaSyncCalendarTarea(tarea);
  const necesitaBorrar = Boolean(tarea.calendarEventId) && !necesitaSync;
  if (!necesitaSync && !necesitaBorrar) return true;

  let correoOrganizador = correoActor.trim().toLowerCase();
  if (tarea.mandadaPorId) {
    const mandada = await usuarioPorId(tarea.mandadaPorId);
    if (mandada?.email) {
      const tokensMandada = await tokensGooglePorCorreo(mandada.email);
      if (tokensMandada?.refreshToken) {
        correoOrganizador = mandada.email.trim().toLowerCase();
      }
    }
  }

  try {
    const tokens = await tokensGooglePorCorreo(correoOrganizador);
    const refresh = tokens?.refreshToken;
    if (!refresh) {
      console.warn("[calendar] sin refresh_token; re-login con consentimiento Calendar", {
        correo: correoOrganizador,
        tareaId: tarea.id,
      });
      return !necesitaSync;
    }

    const tokenBag = {
      refreshToken: refresh,
      accessToken: tokens?.accessToken,
      expiry: tokens?.expiry ?? null,
    };

    if (necesitaSync) {
      const equipo = await mapaEquipo();
      const invitados = tarea.responsableIds
        .map((id) => equipo.get(id)?.email)
        .filter((e): e is string => Boolean(e));

      const eventId = await crearOActualizarEventoTarea(tokenBag, {
        titulo: tarea.nombre,
        fechaMaxima: tarea.fechaMaxima,
        tareaId: tarea.id,
        descripcion: tarea.notas.map((n) => n.texto).filter(Boolean).join("\n\n"),
        eventId: tarea.calendarEventId,
        invitados,
        organizadorEmail: correoOrganizador,
        completada: Boolean(tarea.completadaEl),
        notificarInvitados: false,
      });
      await asignarCalendarEventId(tarea.id, eventId);
      return true;
    }

    if (tarea.calendarEventId) {
      await borrarEventoSiExiste(tokenBag, tarea.calendarEventId);
      await asignarCalendarEventId(tarea.id, null);
    }
    return true;
  } catch (error) {
    console.error("[calendar] sync falló (la tarea se guardó igual)", {
      tareaId: tarea.id,
      error,
    });
    return false;
  }
}

/**
 * Crea un evento con hora en el calendario primary.
 * @see https://developers.google.com/calendar/api/v3/reference/events/insert
 */
export async function crearEventoTimed(
  tokens: Tokens,
  input: {
    titulo: string;
    inicioIso: string;
    finIso: string;
    timeZone: string;
    invitados?: string[];
    /** Si false, crea el evento sin notificar (sendUpdates=none). */
    notificarInvitados?: boolean;
    /** Correo del organizador; se excluye de attendees. */
    organizadorEmail?: string | null;
  },
): Promise<EventoGoogleListado & { invitadosConfirmados: string[] }> {
  if (await esModoPruebas()) {
    throw new Error("Calendar desactivado en modo pruebas");
  }
  const accessToken = await obtenerAccessToken(tokens);
  const org = input.organizadorEmail?.trim().toLowerCase() ?? "";
  const emails = [
    ...new Set(
      (input.invitados ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== org),
    ),
  ];
  const notificar = input.notificarInvitados !== false && emails.length > 0;

  const payload: Record<string, unknown> = {
    summary: input.titulo.trim() || "(Sin título)",
    start: { dateTime: input.inicioIso, timeZone: input.timeZone },
    end: { dateTime: input.finIso, timeZone: input.timeZone },
  };
  if (emails.length > 0) {
    payload.attendees = emails.map((email) => ({ email }));
  }

  const params = new URLSearchParams();
  params.set("sendUpdates", notificar ? "all" : "none");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar insert timed falló: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    id?: string;
    summary?: string;
    htmlLink?: string;
    hangoutLink?: string;
    location?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
    attendees?: { email?: string; responseStatus?: string }[];
  };

  if (!data.id) throw new Error("Calendar insert timed sin id");
  const diaInicio = diaDeEvento(data.start);
  if (!diaInicio) throw new Error("Calendar insert timed sin fecha");

  const invitadosConfirmados = (data.attendees ?? [])
    .map((a) => a.email?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e) && e !== org);

  if (emails.length > 0 && invitadosConfirmados.length === 0) {
    console.warn("[calendar] insert sin attendees en respuesta", {
      pedimos: emails.length,
      eventId: data.id,
      notificar,
    });
  }

  return {
    id: data.id,
    titulo: data.summary?.trim() || "(Sin título)",
    diaInicio,
    diaFin: diaDeEvento(data.end) ?? undefined,
    htmlLink: data.htmlLink ?? null,
    inicio: data.start?.dateTime ?? null,
    fin: data.end?.dateTime ?? null,
    todoElDia: false,
    enlaceReunion: enlaceVideoDe(data),
    ubicacion: data.location?.trim() || null,
    recurringEventId: null,
    origenOrbitaTarea: false,
    invitadosConfirmados,
  };
}

export async function borrarEventoSiExiste(
  tokens: Tokens,
  eventId: string | null | undefined,
): Promise<void> {
  if (!eventId) return;
  if (await esModoPruebas()) return;
  const accessToken = await obtenerAccessToken(tokens);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Calendar delete falló: ${res.status} ${text}`);
  }
}

/** Borra en Calendar los eventos de las tareas de uno o más proyectos (best-effort). */
export async function borrarEventosCalendarDeProyectos(
  proyectoIds: string[],
  correo: string,
): Promise<void> {
  if (proyectoIds.length === 0) return;
  if (await esModoPruebas()) return;

  let tokenBag: Tokens;
  try {
    const tokens = await tokensGooglePorCorreo(correo);
    if (!tokens?.refreshToken) {
      console.warn("[calendar] sin refresh_token; no se borran eventos al eliminar proyecto(s)", {
        correo,
        proyectoIds,
      });
      return;
    }
    tokenBag = {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiry: tokens.expiry ?? null,
    };
  } catch (error) {
    console.error("[calendar] no se pudieron obtener tokens al eliminar proyecto(s)", {
      correo,
      proyectoIds,
      error,
    });
    return;
  }

  for (const proyectoId of proyectoIds) {
    let tareas;
    try {
      tareas = await tareasDe(proyectoId);
    } catch (error) {
      console.error("[calendar] no se pudieron listar tareas al eliminar proyecto", {
        proyectoId,
        error,
      });
      continue;
    }
    for (const t of tareas) {
      if (!t.calendarEventId) continue;
      try {
        await borrarEventoSiExiste(tokenBag, t.calendarEventId);
      } catch (error) {
        console.error("[calendar] no se pudo borrar evento al eliminar proyecto", {
          proyectoId,
          tareaId: t.id,
          error,
        });
      }
    }
  }
}

export type EventoGoogleListado = {
  id: string;
  titulo: string;
  diaInicio: string;
  diaFin?: string;
  htmlLink: string | null;
  /** ISO con hora (dateTime); null si es de todo el día. */
  inicio: string | null;
  /** ISO con hora (dateTime); null si es de todo el día. */
  fin: string | null;
  todoElDia: boolean;
  /** Meet / videollamada si existe. */
  enlaceReunion: string | null;
  ubicacion: string | null;
  recurringEventId: string | null;
  /** Evento all-day creado por Orbita al sincronizar una tarea. */
  origenOrbitaTarea: boolean;
};

function diaDeEvento(v: { date?: string; dateTime?: string } | undefined): string | null {
  if (!v) return null;
  if (v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) return v.date;
  if (v.dateTime) {
    const d = new Date(v.dateTime);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
  return null;
}

function enlaceVideoDe(item: {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}): string | null {
  const hangout = item.hangoutLink?.trim();
  if (hangout) return hangout;
  const video = item.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video" && e.uri?.trim(),
  );
  return video?.uri?.trim() || null;
}

export async function listarEventosPrimary(
  tokens: Tokens,
  opts: { timeMin: string; timeMax: string },
): Promise<EventoGoogleListado[]> {
  if (await esModoPruebas()) return [];
  const accessToken = await obtenerAccessToken(tokens);
  const params = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    timeZone: ZONA,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    conferenceDataVersion: "1",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar list falló: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    items?: {
      id?: string;
      recurringEventId?: string;
      summary?: string;
      htmlLink?: string;
      hangoutLink?: string;
      location?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      extendedProperties?: { private?: Record<string, string> };
    }[];
  };

  const out: EventoGoogleListado[] = [];
  for (const item of data.items ?? []) {
    if (!item.id) continue;
    const diaInicio = diaDeEvento(item.start);
    if (!diaInicio) continue;
    const todoElDia = Boolean(item.start?.date && !item.start?.dateTime);
    out.push({
      id: item.id,
      titulo: item.summary?.trim() || "(Sin título)",
      diaInicio,
      diaFin: diaDeEvento(item.end) ?? undefined,
      htmlLink: item.htmlLink ?? null,
      inicio: item.start?.dateTime ?? null,
      fin: item.end?.dateTime ?? null,
      todoElDia,
      enlaceReunion: enlaceVideoDe(item),
      ubicacion: item.location?.trim() || null,
      recurringEventId: item.recurringEventId?.trim() || null,
      origenOrbitaTarea: item.extendedProperties?.private?.orbita === "tarea",
    });
  }
  return out;
}
