import Anthropic from "@anthropic-ai/sdk";
import { estimarCosteUsd, MODEL } from "@/lib/asistente/coste";
import { textoVisibleEnUi } from "@/lib/asistente/historial";
import {
  actualizarTitulo,
  gastosUsuario,
  listarConversaciones,
  listarMensajes,
  registrarUso,
  type MensajeIa,
} from "@/lib/asistente/store";
import { topeMensualEfectivo } from "@/lib/asistente/tope";

const MAX_TITULO = 80;
/** Por carga de /asistente: evita latencia alta en el primer backfill. */
const MAX_REGEN_POR_CARGA = 4;
const MAX_CONTEXTO_CHARS = 1800;

function clienteAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/** Títulos antiguos = primer mensaje truncado (o provisional). */
export function tituloPareceLegacy(
  titulo: string,
  primerMensajeUsuario: string,
): boolean {
  const t = titulo.trim();
  const p = primerMensajeUsuario.trim();
  if (!t) return true;
  if (t === "Nueva conversación") return true;
  if (!p) return false;
  return t === p.slice(0, 80) || t === p.slice(0, 200);
}

function limpiarTitulo(raw: string, fallback: string): string {
  let t = raw
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/u, "")
    .trim();
  if (!t) t = fallback;
  return t.slice(0, MAX_TITULO) || "Nueva conversación";
}

/** Evita re-backfill infinito si el modelo devuelve el mismo texto que el primer mensaje. */
function asegurarNoLegacy(titulo: string, primerMensajeUsuario: string): string {
  if (!tituloPareceLegacy(titulo, primerMensajeUsuario)) return titulo;
  const corto = titulo.split(/\s+/).slice(0, 6).join(" ");
  if (corto && !tituloPareceLegacy(corto, primerMensajeUsuario)) {
    return corto.slice(0, MAX_TITULO);
  }
  return `Chat: ${corto || titulo}`.slice(0, MAX_TITULO);
}

function contextoDesdeMensajes(mensajes: MensajeIa[]): string {
  const partes: string[] = [];
  let total = 0;
  for (const m of mensajes) {
    const texto = textoVisibleEnUi(m);
    if (!texto) continue;
    const rol = m.rol === "user" ? "Usuario" : "Asistente";
    const linea = `${rol}: ${texto.trim().slice(0, 400)}`;
    if (total + linea.length > MAX_CONTEXTO_CHARS) break;
    partes.push(linea);
    total += linea.length + 1;
  }
  return partes.join("\n");
}

/**
 * Genera un título corto con Haiku y lo registra en `ia_uso`.
 * Devuelve null si no hay API key, tope alcanzado o fallo.
 */
export async function generarTituloConversacion(opts: {
  usuarioId: string;
  conversacionId: string;
  mensajes: MensajeIa[];
  fallback: string;
}): Promise<string | null> {
  const client = clienteAnthropic();
  if (!client) return null;

  const tope = await topeMensualEfectivo(opts.usuarioId);
  if (tope != null) {
    const gastos = await gastosUsuario(opts.usuarioId);
    if (gastos.mes.coste >= tope) return null;
  }

  const contexto = contextoDesdeMensajes(opts.mensajes);
  if (!contexto.trim()) return null;

  try {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 40,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `Generate a short chat title (max 8 words) summarizing what was discussed. Match the language of the conversation. No quotes, no trailing punctuation, title only.\n\n${contexto}`,
        },
      ],
    });

    const inputTokens = result.usage?.input_tokens ?? 0;
    const outputTokens = result.usage?.output_tokens ?? 0;
    const costeUsd = estimarCosteUsd(inputTokens, outputTokens);
    await registrarUso({
      usuarioId: opts.usuarioId,
      conversacionId: opts.conversacionId,
      modelo: MODEL,
      inputTokens,
      outputTokens,
      costeUsd,
    });

    const texto = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    const limpio = limpiarTitulo(texto, opts.fallback);
    const primerUser = opts.mensajes.find((m) => m.rol === "user")?.contenido ?? "";
    return asegurarNoLegacy(limpio, primerUser);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[asistente/titulo]", msg);
    return null;
  }
}

/** Tras el primer turno: resume y persiste título. */
export async function titulizarTrasPrimerTurno(opts: {
  usuarioId: string;
  conversacionId: string;
  mensajeUsuario: string;
  respuestaAsistente: string;
}): Promise<string> {
  const fallback =
    opts.mensajeUsuario.trim().slice(0, MAX_TITULO) || "Nueva conversación";
  const mensajes: MensajeIa[] = [
    {
      id: "tmp-u",
      conversacionId: opts.conversacionId,
      rol: "user",
      contenido: opts.mensajeUsuario,
      toolName: null,
      creadoEn: new Date().toISOString(),
    },
    {
      id: "tmp-a",
      conversacionId: opts.conversacionId,
      rol: "assistant",
      contenido: opts.respuestaAsistente,
      toolName: null,
      creadoEn: new Date().toISOString(),
    },
  ];
  const generado = await generarTituloConversacion({
    usuarioId: opts.usuarioId,
    conversacionId: opts.conversacionId,
    mensajes,
    fallback,
  });
  const titulo = generado ?? fallback;
  await actualizarTitulo(opts.conversacionId, opts.usuarioId, titulo);
  return titulo;
}

/**
 * Regenera títulos legacy (primer mensaje truncado) al abrir /asistente.
 * Como máximo MAX_REGEN_POR_CARGA por carga de página.
 */
export async function regenerarTitulosLegacy(
  usuarioId: string,
): Promise<number> {
  const conversaciones = await listarConversaciones(usuarioId);
  const pendientes: { id: string; mensajes: MensajeIa[]; fallback: string }[] =
    [];

  for (const c of conversaciones) {
    if (pendientes.length >= MAX_REGEN_POR_CARGA) break;
    const mensajes = await listarMensajes(c.id);
    const primerUser = mensajes.find((m) => m.rol === "user");
    if (!primerUser) continue;
    if (!tituloPareceLegacy(c.titulo, primerUser.contenido)) continue;
    pendientes.push({
      id: c.id,
      mensajes,
      fallback: primerUser.contenido.trim().slice(0, MAX_TITULO) || c.titulo,
    });
  }

  const resultados = await Promise.all(
    pendientes.map(async (p) => {
      const generado = await generarTituloConversacion({
        usuarioId,
        conversacionId: p.id,
        mensajes: p.mensajes,
        fallback: p.fallback,
      });
      if (!generado) return false;
      await actualizarTitulo(p.id, usuarioId, generado);
      return true;
    }),
  );
  return resultados.filter(Boolean).length;
}
