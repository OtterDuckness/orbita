import {
  borrarEventoSiExiste,
  crearOActualizarEventoTarea,
} from "@/lib/google-calendar";
import { asignarCalendarEventId } from "@/lib/tablero";
import type { Tarea } from "@/lib/tareas-mock";
import { tokensGooglePorCorreo } from "@/lib/usuarios";

export async function sincronizarTareaConCalendar(
  tarea: Tarea,
  correo: string,
): Promise<boolean> {
  const necesitaSync = Boolean(tarea.syncCalendar && tarea.fechaMaxima);
  const necesitaBorrar = Boolean(tarea.calendarEventId) && !necesitaSync;
  if (!necesitaSync && !necesitaBorrar) return true;

  try {
    const tokens = await tokensGooglePorCorreo(correo);
    const refresh = tokens?.refreshToken;
    if (!refresh) {
      console.warn("[calendar] sin refresh_token; re-login con consentimiento Calendar", {
        correo,
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
      const eventId = await crearOActualizarEventoTarea(tokenBag, {
        titulo: tarea.nombre,
        fechaMaxima: tarea.fechaMaxima,
        eventId: tarea.calendarEventId,
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
