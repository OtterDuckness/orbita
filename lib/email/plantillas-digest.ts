export type ItemDigestLinea = {
  nombre: string;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  fechaMaxima: string | null;
  diasAtraso?: number;
};

export type DigestProyectoResumen = {
  proyecto: string;
  cliente: string | null;
  abiertas: number;
  paraHoy: number;
  atrasadas7: number;
  destacadas: ItemDigestLinea[];
};

export type DigestStats = {
  abiertas: number;
  paraHoy: number;
  atrasadas7: number;
  completadasSemana: number;
  urgentes: number;
};

export type DigestContenido = {
  tipo: "lunes" | "miercoles" | "viernes" | "digest";
  nombreUsuario: string;
  ymd: string;
  resumen: string;
  resumenIa: string | null;
  stats: DigestStats;
  porProyecto: DigestProyectoResumen[];
  pendientesSemana: ItemDigestLinea[];
  porCliente: { cliente: string; items: ItemDigestLinea[] }[];
  atrasadasImportantes: ItemDigestLinea[];
  paraHoy: ItemDigestLinea[];
  completadasSemana: ItemDigestLinea[];
  urgentes: ItemDigestLinea[];
  baseUrl: string;
  ctaUrl: string;
};

const TITULOS: Record<DigestContenido["tipo"], string> = {
  lunes: "Resumen de la semana",
  miercoles: "Seguimiento de mitad de semana",
  viernes: "Cierre de semana",
  digest: "Resumen de tareas",
};

const MAX_LISTA = 6;
const MAX_DESTACADAS = 3;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tope<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

function lineaTexto(it: ItemDigestLinea): string {
  const cliente = it.clienteNombre ? ` · ${it.clienteNombre}` : "";
  const fecha = it.fechaMaxima ? ` (${it.fechaMaxima})` : "";
  const atraso =
    it.diasAtraso != null && it.diasAtraso > 0
      ? ` · ${it.diasAtraso}d atraso`
      : "";
  return `- ${it.nombre} [${it.proyectoEtiqueta}${cliente}]${fecha}${atraso}`;
}

function listaHtml(items: ItemDigestLinea[]): string {
  if (items.length === 0) {
    return `<p style="margin:0 0 12px;color:#666;font-size:14px;">Ninguna</p>`;
  }
  const lis = items
    .map((it) => {
      const meta = [
        it.proyectoEtiqueta,
        it.clienteNombre,
        it.fechaMaxima,
        it.diasAtraso != null && it.diasAtraso > 0
          ? `${it.diasAtraso}d atraso`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li style="margin:0 0 8px;"><strong style="color:#111;">${esc(it.nombre)}</strong><br/><span style="color:#666;font-size:13px;">${esc(meta)}</span></li>`;
    })
    .join("");
  return `<ul style="margin:0 0 8px;padding-left:18px;">${lis}</ul>`;
}

function seccionHtml(titulo: string, items: ItemDigestLinea[]): string {
  const shown = tope(items, MAX_LISTA);
  const extra =
    items.length > MAX_LISTA
      ? `<p style="margin:0 0 16px;color:#666;font-size:13px;">+${items.length - MAX_LISTA} más en la app</p>`
      : "";
  return `<h2 style="font-size:15px;margin:22px 0 8px;color:#111;">${esc(titulo)}</h2>${listaHtml(shown)}${extra}`;
}

function seccionTexto(titulo: string, items: ItemDigestLinea[]): string {
  if (items.length === 0) return `${titulo}\nNinguna\n`;
  const shown = tope(items, MAX_LISTA);
  const extra =
    items.length > MAX_LISTA ? `\n(+${items.length - MAX_LISTA} más en la app)` : "";
  return `${titulo}\n${shown.map(lineaTexto).join("\n")}${extra}\n`;
}

function cardsProyectoHtml(grupos: DigestProyectoResumen[]): string {
  if (grupos.length === 0) {
    return `<p style="margin:0 0 16px;color:#666;">Sin proyectos con tareas abiertas.</p>`;
  }
  return grupos
    .map((g) => {
      const cliente = g.cliente ? ` · ${esc(g.cliente)}` : "";
      const meta = `${g.abiertas} abiertas · ${g.paraHoy} para hoy · ${g.atrasadas7} atraso ≥7d`;
      const dest =
        g.destacadas.length === 0
          ? ""
          : `<ul style="margin:8px 0 0;padding-left:18px;color:#333;font-size:13px;">${g.destacadas
              .map((d) => `<li style="margin:0 0 4px;">${esc(d.nombre)}</li>`)
              .join("")}</ul>`;
      return `<div style="border:1px solid #e8e4e6;border-radius:10px;padding:14px 16px;margin:0 0 10px;background:#faf9fa;">
  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111;">${esc(g.proyecto)}${cliente}</p>
  <p style="margin:0;font-size:13px;color:#666;">${esc(meta)}</p>
  ${dest}
</div>`;
    })
    .join("");
}

function cardsProyectoTexto(grupos: DigestProyectoResumen[]): string {
  if (grupos.length === 0) return "Sin proyectos con tareas abiertas.\n";
  const lines: string[] = [];
  for (const g of grupos) {
    const cliente = g.cliente ? ` · ${g.cliente}` : "";
    lines.push(
      `${g.proyecto}${cliente}: ${g.abiertas} abiertas, ${g.paraHoy} hoy, ${g.atrasadas7} atraso ≥7d`,
    );
    for (const d of g.destacadas) lines.push(`  - ${d.nombre}`);
  }
  return lines.join("\n") + "\n";
}

function ctaBotonHtml(url: string, texto: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td style="border-radius:8px;background:#c2185b;">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(texto)}</a>
    </td>
  </tr>
</table>`;
}

function celdaStatHtml(valor: number, etiqueta: string): string {
  return `<td style="width:33%;padding:10px 8px;text-align:center;vertical-align:top;">
  <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111;line-height:1;">${valor}</p>
  <p style="margin:0;font-size:12px;color:#666;line-height:1.3;">${esc(etiqueta)}</p>
</td>`;
}

function statsHtml(c: DigestContenido): string {
  const celdas = [
    celdaStatHtml(c.stats.abiertas, "tareas abiertas"),
    celdaStatHtml(c.stats.paraHoy, "para hoy"),
    celdaStatHtml(c.stats.atrasadas7, "con atraso de 7+ días"),
  ];
  if (c.tipo === "viernes") {
    celdas.push(
      celdaStatHtml(c.stats.completadasSemana, "hechas esta semana"),
    );
  }
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 16px;border:1px solid #e8e4e6;border-radius:10px;background:#ffffff;">
  <tr>${celdas.join("")}</tr>
</table>`;
}

function statsTexto(c: DigestContenido): string {
  const lines = [
    `- ${c.stats.abiertas} tareas abiertas`,
    `- ${c.stats.paraHoy} para hoy`,
    `- ${c.stats.atrasadas7} con atraso de 7+ días`,
  ];
  if (c.tipo === "viernes") {
    lines.push(`- ${c.stats.completadasSemana} hechas esta semana`);
  }
  return lines.join("\n");
}

export function asuntoDigest(c: DigestContenido): string {
  return `Órbita · ${TITULOS[c.tipo]} (${c.ymd})`;
}

export function plantillaDigestHtml(c: DigestContenido): string {
  const titulo = TITULOS[c.tipo];
  const resumenMostrar = c.resumenIa?.trim() || c.resumen;

  const bloques: string[] = [];
  if (c.tipo === "viernes") {
    bloques.push(seccionHtml("Hecho esta semana", c.completadasSemana));
    bloques.push(seccionHtml("Urgente que queda", c.urgentes));
  } else {
    bloques.push(seccionHtml("Para hoy", c.paraHoy));
    bloques.push(
      seccionHtml("Importante (atraso ≥ 7 días)", c.atrasadasImportantes),
    );
  }

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f1f2;">
  <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#111;line-height:1.45;max-width:600px;margin:0 auto;padding:28px 20px;">
    <p style="margin:0 0 6px;color:#c2185b;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Órbita</p>
    <h1 style="font-size:22px;margin:0 0 6px;line-height:1.25;">${esc(titulo)}</h1>
    <p style="margin:0 0 16px;color:#666;font-size:13px;">${esc(c.ymd)} · Hola ${esc(c.nombreUsuario)}</p>

    ${ctaBotonHtml(c.ctaUrl, "Abrir Órbita")}

    <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Vista rápida</p>
    ${statsHtml(c)}
    <p style="margin:0 0 22px;font-size:15px;color:#111;">${esc(resumenMostrar)}</p>

    <h2 style="font-size:15px;margin:0 0 10px;color:#111;">Por proyecto</h2>
    ${cardsProyectoHtml(c.porProyecto)}

    ${bloques.join("\n")}

    <p style="margin:28px 0 0;font-size:13px;color:#666;">
      <a href="${esc(c.ctaUrl)}" style="color:#c2185b;font-weight:600;">Entrar a Órbita</a>
      ·
      <a href="${esc(c.baseUrl)}/tareas" style="color:#c2185b;">Mis tareas</a>
      ·
      <a href="${esc(c.baseUrl)}/ajustes" style="color:#c2185b;">Preferencias</a>
    </p>
  </div>
</body>
</html>`;
}

export function plantillaDigestTexto(c: DigestContenido): string {
  const titulo = TITULOS[c.tipo];
  const resumenMostrar = c.resumenIa?.trim() || c.resumen;
  const partes: string[] = [
    `Órbita — ${titulo}`,
    `Hola ${c.nombreUsuario} (${c.ymd})`,
    "",
    `Abrir Órbita: ${c.ctaUrl}`,
    "",
    "Vista rápida",
    statsTexto(c),
    "",
    resumenMostrar,
    "",
    "Por proyecto",
    cardsProyectoTexto(c.porProyecto),
  ];

  if (c.tipo === "viernes") {
    partes.push(seccionTexto("Hecho esta semana", c.completadasSemana));
    partes.push(seccionTexto("Urgente que queda", c.urgentes));
  } else {
    partes.push(seccionTexto("Para hoy", c.paraHoy));
    partes.push(
      seccionTexto("Importante (atraso ≥ 7 días)", c.atrasadasImportantes),
    );
  }

  partes.push(`Mis tareas: ${c.baseUrl}/tareas`);
  partes.push(`Preferencias: ${c.baseUrl}/ajustes`);
  return partes.join("\n");
}

export { MAX_DESTACADAS };
