import { enviarCorreo } from "@/lib/email/resend";
import {
  asuntoAsignacionTarea,
  plantillaAsignacionTareaHtml,
  plantillaAsignacionTareaTexto,
} from "@/lib/email/plantillas-asignacion-tarea";
import { proyectoPorId } from "@/lib/proyectos";
import type { Tarea } from "@/lib/tareas-mock";
import { tipoPorId } from "@/lib/tipos-proyecto";
import { usuarioPorId } from "@/lib/usuarios";
import { clientePorId } from "@/lib/clientes";

function baseUrlApp(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function formatearFechaYmd(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  } catch {
    return ymd;
  }
}

/**
 * Envía correo (Resend) a los destinatarios indicados.
 * Best-effort: errores se registran y no se relanzan.
 */
export async function notificarAsignacionTarea(opts: {
  tarea: Tarea;
  destinatarioIds: string[];
  /** No notificar a este usuario (p. ej. el solicitante). */
  excluirUsuarioId?: string | null;
}): Promise<void> {
  const { esModoPruebas } = await import("@/lib/sandbox");
  if (await esModoPruebas()) return;

  const excluir = opts.excluirUsuarioId?.trim() || null;
  const ids = [...new Set(opts.destinatarioIds.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => id !== excluir,
  );
  if (ids.length === 0) return;

  const proyecto = await proyectoPorId(opts.tarea.proyectoId);
  const esPersonal = Boolean(proyecto?.personalDeId);
  let proyectoEtiqueta = "Proyecto";
  let clienteNombre: string | null = null;

  if (esPersonal) {
    proyectoEtiqueta = "Personal";
  } else if (proyecto) {
    if (proyecto.nombre?.trim()) {
      proyectoEtiqueta = proyecto.nombre.trim();
    } else if (proyecto.tipoId) {
      const tipo = await tipoPorId(proyecto.tipoId);
      if (tipo?.nombre?.trim()) proyectoEtiqueta = tipo.nombre.trim();
    }
    if (proyecto.clienteId) {
      const cli = await clientePorId(proyecto.clienteId);
      clienteNombre = cli?.nombre?.trim() || null;
    }
  }

  const solicitante = opts.tarea.mandadaPorId
    ? await usuarioPorId(opts.tarea.mandadaPorId)
    : null;
  const solicitanteNombre = solicitante?.nombre?.trim() || "Alguien del equipo";
  const baseUrl = baseUrlApp();
  const ctaUrl = `${baseUrl}/proyectos/${opts.tarea.proyectoId}?tarea=${encodeURIComponent(opts.tarea.id)}`;
  const fechaMaxima = formatearFechaYmd(opts.tarea.fechaMaxima);
  const fechaPrevista = formatearFechaYmd(opts.tarea.fechaPrevista);

  for (const id of ids) {
    try {
      const dest = await usuarioPorId(id);
      if (!dest?.email?.trim()) {
        console.warn("[notif-asignacion] sin correo", { tareaId: opts.tarea.id, usuarioId: id });
        continue;
      }
      const contenido = {
        nombreDestinatario: dest.nombre?.trim() || dest.email,
        nombreTarea: opts.tarea.nombre,
        solicitanteNombre,
        proyectoEtiqueta,
        clienteNombre,
        fechaMaxima,
        fechaPrevista,
        prioridad: opts.tarea.prioridad,
        ctaUrl,
        baseUrl,
      };
      const r = await enviarCorreo({
        to: dest.email,
        subject: asuntoAsignacionTarea(contenido),
        html: plantillaAsignacionTareaHtml(contenido),
        text: plantillaAsignacionTareaTexto(contenido),
      });
      if (!r.ok) {
        console.warn("[notif-asignacion] fallo envío", {
          tareaId: opts.tarea.id,
          usuarioId: id,
          error: r.error,
        });
      }
    } catch (e) {
      console.warn("[notif-asignacion] error", {
        tareaId: opts.tarea.id,
        usuarioId: id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
