export type ContenidoAsignacionTarea = {
  nombreDestinatario: string;
  nombreTarea: string;
  solicitanteNombre: string;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  fechaMaxima: string | null;
  fechaPrevista: string | null;
  prioridad: string;
  ctaUrl: string;
  baseUrl: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function asuntoAsignacionTarea(c: ContenidoAsignacionTarea): string {
  return `Órbita · Nueva tarea: ${c.nombreTarea}`;
}

export function plantillaAsignacionTareaHtml(c: ContenidoAsignacionTarea): string {
  const cliente = c.clienteNombre ? ` · ${esc(c.clienteNombre)}` : "";
  const fechaMax = c.fechaMaxima ? esc(c.fechaMaxima) : "Sin fecha límite";
  const fechaPrev = c.fechaPrevista ? esc(c.fechaPrevista) : "—";

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f1f2;">
  <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#111;line-height:1.45;max-width:600px;margin:0 auto;padding:28px 20px;">
    <p style="margin:0 0 6px;color:#c2185b;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Órbita</p>
    <h1 style="font-size:22px;margin:0 0 6px;line-height:1.25;">Te han asignado una tarea</h1>
    <p style="margin:0 0 18px;color:#666;font-size:14px;">Hola ${esc(c.nombreDestinatario)}</p>

    <p style="margin:0 0 16px;font-size:15px;">
      <strong>${esc(c.solicitanteNombre)}</strong> te ha asignado la tarea
      <strong>«${esc(c.nombreTarea)}»</strong>
      en el proyecto <strong>${esc(c.proyectoEtiqueta)}</strong>${cliente}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 22px;background:#fff;border:1px solid #e8e4e6;border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;width:38%;border-bottom:1px solid #f0ecee;">Tarea</td>
        <td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #f0ecee;">${esc(c.nombreTarea)}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0ecee;">Solicitante</td>
        <td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #f0ecee;">${esc(c.solicitanteNombre)}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0ecee;">Proyecto</td>
        <td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #f0ecee;">${esc(c.proyectoEtiqueta)}${cliente}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0ecee;">Fecha límite</td>
        <td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #f0ecee;">${fechaMax}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0ecee;">Fecha prevista</td>
        <td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #f0ecee;">${fechaPrev}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#666;">Prioridad</td>
        <td style="padding:14px 16px;font-size:14px;text-transform:uppercase;">${esc(c.prioridad)}</td>
      </tr>
    </table>

    <p style="margin:0 0 28px;">
      <a href="${esc(c.ctaUrl)}" style="display:inline-block;background:#c2185b;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:8px;">
        Abrir la tarea
      </a>
    </p>

    <p style="margin:0;font-size:13px;color:#666;">
      <a href="${esc(c.baseUrl)}/tareas" style="color:#c2185b;">Mis tareas</a>
    </p>
  </div>
</body>
</html>`;
}

export function plantillaAsignacionTareaTexto(c: ContenidoAsignacionTarea): string {
  const cliente = c.clienteNombre ? ` · ${c.clienteNombre}` : "";
  return [
    "Órbita — Te han asignado una tarea",
    `Hola ${c.nombreDestinatario}`,
    "",
    `${c.solicitanteNombre} te ha asignado «${c.nombreTarea}» en ${c.proyectoEtiqueta}${cliente}.`,
    "",
    `Tarea: ${c.nombreTarea}`,
    `Solicitante: ${c.solicitanteNombre}`,
    `Proyecto: ${c.proyectoEtiqueta}${cliente}`,
    `Fecha límite: ${c.fechaMaxima ?? "Sin fecha límite"}`,
    `Fecha prevista: ${c.fechaPrevista ?? "—"}`,
    `Prioridad: ${c.prioridad}`,
    "",
    `Abrir la tarea: ${c.ctaUrl}`,
    `Mis tareas: ${c.baseUrl}/tareas`,
  ].join("\n");
}
