/**
 * Post-proceso de respuestas del agente: el modelo a veces anuncia N ítems
 * y pinta menos filas. Reconstruye la tabla desde el tool_result y alinea el conteo.
 */

export type ListadoDetectado = {
  kind: "proyectos" | "tareas" | "clientes";
  total: number;
  mostradas: number;
  truncado: boolean;
  items: Record<string, unknown>[];
};

const LIST_KEYS = ["proyectos", "tareas", "clientes"] as const;

type PersonaLike = { nombre?: unknown; eresTu?: unknown } | null | undefined;

function personaTxt(p: PersonaLike): string {
  if (!p || typeof p !== "object") return "—";
  if (p.eresTu === true) return "tú";
  const n = typeof p.nombre === "string" ? p.nombre.trim() : "";
  return n || "—";
}

function celda(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v)
      ? String(v)
      : v.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  }
  const s = String(v).trim();
  return s || "—";
}

function enlace(label: string, url: unknown): string {
  const href = typeof url === "string" ? url.trim() : "";
  const texto = label.trim() || "—";
  if (href.startsWith("/")) return `[${texto}](${href})`;
  return texto;
}

function feeTxt(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`;
}

function prioridadTxt(v: unknown): string {
  const p = String(v ?? "").toLowerCase();
  if (p === "urgente") return "Urgente";
  if (p === "alta") return "Alta";
  if (p === "media") return "Media";
  if (p === "baja") return "Baja";
  return celda(v);
}

function filaMd(cols: string[]): string {
  return `| ${cols.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`;
}

function tablaMd(headers: string[], rows: string[][]): string {
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  return [filaMd(headers), sep, ...rows.map(filaMd)].join("\n");
}

function renderProyectos(items: Record<string, unknown>[]): string {
  return tablaMd(
    ["Proyecto", "Cliente", "Tipo", "Lead", "Prioridad", "Fee mensual"],
    items.map((p) => {
      const etiqueta =
        (typeof p.etiqueta === "string" && p.etiqueta.trim()) ||
        (typeof p.nombre === "string" && p.nombre.trim()) ||
        "Proyecto";
      return [
        enlace(etiqueta, p.url),
        celda(p.clienteNombre),
        celda(p.tipoNombre),
        personaTxt(p.responsable as PersonaLike),
        prioridadTxt(p.prioridad),
        feeTxt(p.feeMensual),
      ];
    }),
  );
}

function renderTareas(items: Record<string, unknown>[]): string {
  return tablaMd(
    ["Tarea", "Proyecto", "Prioridad", "Fecha máx.", "Responsables"],
    items.map((t) => {
      const nombre =
        (typeof t.nombre === "string" && t.nombre.trim()) || "Tarea";
      const resps = Array.isArray(t.responsables)
        ? t.responsables.map((r) => personaTxt(r as PersonaLike)).join(", ")
        : "—";
      return [
        enlace(nombre, t.url),
        celda(t.proyectoEtiqueta),
        prioridadTxt(t.prioridad),
        celda(t.fechaMaxima),
        resps || "—",
      ];
    }),
  );
}

function renderClientes(items: Record<string, unknown>[]): string {
  return tablaMd(
    ["Cliente", "Correo", "Responsable"],
    items.map((c) => [
      celda(c.nombre),
      celda(c.correoAcceso),
      personaTxt(c.responsable as PersonaLike),
    ]),
  );
}

function renderTabla(listado: ListadoDetectado): string {
  if (listado.kind === "proyectos") return renderProyectos(listado.items);
  if (listado.kind === "clientes") return renderClientes(listado.items);
  return renderTareas(listado.items);
}

function esFilaTabla(linea: string) {
  const t = linea.trim();
  return t.startsWith("|") && t.includes("|", 1);
}

function esSeparador(linea: string) {
  if (!esFilaTabla(linea) && !/^\s*[-:| ]+$/.test(linea)) return false;
  let s = linea.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  const cs = s.split("|").map((c) => c.trim());
  return cs.length > 0 && cs.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")));
}

/** Índices [start, endExclusive) del primer bloque tabla o lista de ítems. */
function rangoPrimerListado(texto: string): { start: number; end: number; filas: number } | null {
  const lineas = texto.replace(/\r\n/g, "\n").split("\n");
  let offset = 0;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i] ?? "";
    const start = offset;
    if (esFilaTabla(linea) && i + 1 < lineas.length && esSeparador(lineas[i + 1]!)) {
      let j = i + 2;
      let filas = 0;
      while (j < lineas.length && esFilaTabla(lineas[j]!)) {
        filas += 1;
        j += 1;
      }
      let end = start;
      for (let k = i; k < j; k++) {
        end += lineas[k]!.length;
        if (k < j - 1) end += 1;
      }
      return { start, end, filas };
    }
    if (/^\s*[-*]\s+\S/.test(linea) || /^\s*\d+\.\s+\S/.test(linea)) {
      let j = i;
      let filas = 0;
      while (
        j < lineas.length &&
        (/^\s*[-*]\s+\S/.test(lineas[j]!) || /^\s*\d+\.\s+\S/.test(lineas[j]!))
      ) {
        filas += 1;
        j += 1;
      }
      if (filas >= 2) {
        let end = start;
        for (let k = i; k < j; k++) {
          end += lineas[k]!.length;
          if (k < j - 1) end += 1;
        }
        return { start, end, filas };
      }
    }
    offset += linea.length + 1;
  }
  return null;
}

function fraseConteo(listado: ListadoDetectado): string {
  if (listado.truncado) {
    return `mostrando ${listado.mostradas} de ${listado.total}`;
  }
  return `${listado.total} total`;
}

/**
 * Ajusta conteos en prosa: «(N total)», «mostrando N de ellas», «Hay N más».
 * Fuente de verdad = listado (filas del tool), no lo que inventó el modelo.
 */
function alinearConteoProsa(texto: string, listado: ListadoDetectado): string {
  const mostradas = listado.mostradas;
  const total = listado.total;
  const truncado = listado.truncado || total > mostradas;
  const resto = Math.max(0, total - mostradas);
  const frase = truncado
    ? `mostrando ${mostradas} de ${total}`
    : `${total} total`;

  let out = texto;

  // (mostrando 10 de ellas; hay más) | (mostrando 10 de 31) | (mostrando 10)
  out = out.replace(
    /\(\s*mostrando\s+\d+(?:\s+de\s+(?:\d+|ellas?|ellos?|estas?|estos?))?(?:\s*;\s*hay\s+más)?\s*\)/gi,
    `(${frase})`,
  );

  // mostrando 10 de ellas / mostrando 10 de 31 / mostrando 10 (sin paréntesis)
  out = out.replace(
    /\bmostrando\s+\d+(?:\s+de\s+(?:\d+|ellas?|ellos?|estas?|estos?))?/gi,
    truncado ? `mostrando ${mostradas} de ${total}` : `mostrando ${mostradas}`,
  );

  // (**15 total**) | (15 total) | (**15** total)
  out = out.replace(
    /\(\s*(?:\*\*)?(\d+)(?:\*\*)?\s*total(?:\*\*)?\s*\)/gi,
    (full, nStr: string) => {
      const n = Number(nStr);
      if (!truncado && (n === total || n === mostradas)) return full;
      return `(${frase})`;
    },
  );
  out = out.replace(/\*\*(\d+)\s*total\*\*/gi, (full, nStr: string) => {
    const n = Number(nStr);
    if (!truncado && n === total) return full;
    return `**${frase}**`;
  });

  // Hay 21 más / hay 21 mas
  out = out.replace(/\b[Hh]ay\s+\d+\s+m[aá]s\b/g, () =>
    resto > 0 ? `Hay ${resto} más` : `No hay más`,
  );

  // Cabecera: «Tienes 31 tareas» / «hay 15 proyectos» — solo el primer bloque
  const corte = out.search(/\n\n|\n\|/);
  const cabeza = corte >= 0 ? out.slice(0, corte) : out.slice(0, 280);
  const cola = corte >= 0 ? out.slice(corte) : out.slice(cabeza.length);
  const cabeza2 = cabeza.replace(
    /\b(\d+)\b(?=\s*(?:total|proyectos?|tareas?|clientes?)\b)/gi,
    (nStr) => {
      const n = Number(nStr);
      // El total real va delante de «tareas/proyectos/… en total»
      if (/\btotal\b/i.test(cabeza) && n !== total && n !== mostradas) {
        return String(total);
      }
      if (n === total || n === mostradas) return nStr;
      return String(total);
    },
  );
  return cabeza2 + cola;
}

export function detectarListado(toolName: string, result: unknown): ListadoDetectado | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    // Legacy: array plano (buscar_proyectos / buscar_clientes antiguos)
    if (Array.isArray(result) && result.length > 0 && result.every((x) => x && typeof x === "object")) {
      const kind =
        toolName === "buscar_proyectos"
          ? "proyectos"
          : toolName === "buscar_clientes"
            ? "clientes"
            : toolName === "listar_tareas" || toolName === "listar_mis_tareas"
              ? "tareas"
              : null;
      if (!kind) return null;
      return {
        kind,
        total: result.length,
        mostradas: result.length,
        truncado: false,
        items: result as Record<string, unknown>[],
      };
    }
    return null;
  }
  const r = result as Record<string, unknown>;
  if (typeof r.total !== "number") return null;
  for (const key of LIST_KEYS) {
    if (!Array.isArray(r[key])) continue;
    const items = (r[key] as unknown[]).filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object",
    );
    const kind =
      key === "proyectos"
        ? "proyectos"
        : key === "clientes"
          ? "clientes"
          : "tareas";
    // Solo tools de listado conocidas
    if (
      kind === "proyectos" &&
      toolName !== "buscar_proyectos"
    ) {
      continue;
    }
    if (
      kind === "clientes" &&
      toolName !== "buscar_clientes"
    ) {
      continue;
    }
    if (
      kind === "tareas" &&
      toolName !== "listar_tareas" &&
      toolName !== "listar_mis_tareas"
    ) {
      continue;
    }
    const mostradas =
      typeof r.mostradas === "number" ? r.mostradas : items.length;
    return {
      kind,
      total: r.total,
      mostradas,
      truncado: r.truncado === true || r.total > items.length,
      items,
    };
  }
  return null;
}

/**
 * Si el texto lista entidades pero con distinto nº de filas que el tool_result,
 * sustituye el listado por una tabla completa y alinea el número anunciado
 * («mostrando N», «Hay N más», «(N total)»).
 * No inyecta tabla si el usuario solo recibió un conteo en prosa.
 */
export function alinearListadoRespuesta(
  texto: string,
  listados: ListadoDetectado[],
): string {
  if (!texto.trim() || listados.length === 0) return texto;
  // Preferir el listado más grande del turno (suele ser la respuesta principal).
  const raw = [...listados].sort(
    (a, b) => b.items.length - a.items.length || b.total - a.total,
  )[0]!;
  if (raw.items.length === 0) return texto;

  // Filas reales del tool = fuente de verdad (no el `mostradas` del modelo).
  const listado: ListadoDetectado = {
    ...raw,
    mostradas: raw.items.length,
    truncado: raw.total > raw.items.length || raw.truncado,
  };

  let out = texto;
  const rango = rangoPrimerListado(out);
  if (rango && rango.filas !== listado.items.length) {
    const tabla = renderTabla(listado);
    out = out.slice(0, rango.start) + tabla + out.slice(rango.end);
  }
  return alinearConteoProsa(out, listado);
}
