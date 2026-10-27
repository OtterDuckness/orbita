import Anthropic from "@anthropic-ai/sdk";
import {
  estimarCosteUsd,
  MODEL,
  TopeGastoError,
} from "@/lib/asistente/coste";
import {
  acotarResultadoTool,
  mensajesParaApi,
  recortarMensajesApi,
  sanearMensajesApi,
  serializarAssistantToolUse,
  serializarToolResult,
} from "@/lib/asistente/historial";
import {
  alinearListadoRespuesta,
  detectarListado,
  type ListadoDetectado,
} from "@/lib/asistente/listado-respuesta";
import { getSystemPromptParts } from "@/lib/asistente/system-prompt";
import {
  anadirMensaje,
  gastosUsuario,
  listarMensajes,
  registrarUso,
} from "@/lib/asistente/store";
import { titulizarTrasPrimerTurno } from "@/lib/asistente/titulo";
import { ejecutarTool, toolsParaUsuario } from "@/lib/asistente/tools";
import { topeMensualEfectivo } from "@/lib/asistente/tope";
import {
  acotarBloquesParaPersistir,
  toolsWebParaUsuario,
} from "@/lib/asistente/web";
import { esModoPruebas } from "@/lib/sandbox";
import { usuarioPuede, type UsuarioAuth } from "@/lib/usuarios";

const MAX_RONDAS = 8;
const MAX_HISTORIAL = 40;
const CACHE_EPHEMERAL: Anthropic.CacheControlEphemeral = { type: "ephemeral" };
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Quita UUIDs del texto visible al usuario (red de seguridad).
 * Conserva UUIDs dentro de hrefs de enlaces Markdown (p. ej. [SEO](/proyectos/{id})).
 */
function ocultarUuidsEnTexto(texto: string): string {
  const guarded: string[] = [];
  const conMarcas = texto.replace(
    /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (full) => {
      const i = guarded.length;
      guarded.push(full);
      return `\u0000MD${i}\u0000`;
    },
  );
  let out = conMarcas
    .replace(UUID_RE, "")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
  for (let i = 0; i < guarded.length; i++) {
    out = out.replace(`\u0000MD${i}\u0000`, guarded[i]!);
  }
  return out;
}

function clienteAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("Falta ANTHROPIC_API_KEY");
  }
  return new Anthropic({ apiKey: key });
}

/** Mark the last item so tools (+ later system) form a cacheable prefix. */
function conCacheEnUltimaTool(
  tools: Anthropic.ToolUnion[],
): Anthropic.ToolUnion[] {
  if (tools.length === 0) return tools;
  const out = tools.slice();
  const last = out[out.length - 1]!;
  out[out.length - 1] = {
    ...last,
    cache_control: CACHE_EPHEMERAL,
  } as Anthropic.ToolUnion;
  return out;
}

/** Quita cache_control de bloques en messages (p. ej. tool_result de rondas previas). */
function quitarCacheControlDeMensajes(messages: Anthropic.MessageParam[]) {
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block && typeof block === "object" && "cache_control" in block) {
        delete (block as { cache_control?: unknown }).cache_control;
      }
    }
  }
}

function esRequiereConfirmacion(out: unknown): boolean {
  return (
    !!out &&
    typeof out === "object" &&
    !Array.isArray(out) &&
    (out as { error?: unknown }).error === "requiere_confirmacion"
  );
}

function lineasConfirmacion(out: unknown): string[] {
  if (!esRequiereConfirmacion(out)) return [];
  const o = out as {
    pendientes?: unknown;
    pendiente?: { tool?: unknown; resumen?: unknown };
    proyectosQueSeBorran?: unknown;
  };
  if (Array.isArray(o.pendientes) && o.pendientes.length > 0) {
    return o.pendientes
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const r = (p as { resumen?: unknown }).resumen;
        return typeof r === "string" && r.trim() ? r.trim() : null;
      })
      .filter((x): x is string => Boolean(x));
  }
  const resumen =
    typeof o.pendiente?.resumen === "string" && o.pendiente.resumen.trim()
      ? o.pendiente.resumen.trim()
      : null;
  if (resumen) return [resumen];
  const tool = String(o.pendiente?.tool ?? "");
  const nProj =
    typeof o.proyectosQueSeBorran === "number" ? o.proyectosQueSeBorran : null;
  switch (tool) {
    case "borrar_tarea":
      return ["Borrar tarea(s) (papelera ~30 días)"];
    case "eliminar_proyecto":
      return ["Eliminar proyecto (papelera ~30 días)"];
    case "eliminar_cliente":
      return [
        nProj != null && nProj > 0
          ? `Eliminar cliente (+${nProj} proyecto(s))`
          : "Eliminar cliente",
      ];
    case "restaurar_eliminado":
      return ["Restaurar desde la papelera"];
    case "deshacer_accion":
      return ["Deshacer acción"];
    case "enviar_mensaje":
      return ["Enviar mensaje"];
    case "enviar_mensaje_tarea":
      return ["Enviar mensaje en el chat de la tarea"];
    default:
      return tool ? [tool.replace(/_/g, " ")] : ["Continuar"];
  }
}

/** Texto de confirmación si el modelo no escribió nada en el mismo turno que la tool. */
function mensajeConfirmacionPorDefecto(outs: unknown[]): string {
  const lineas = outs.flatMap(lineasConfirmacion);
  if (lineas.length === 0) return "**¿Confirmas** que quieres continuar?";
  if (lineas.length === 1) {
    return `Voy a: ${lineas[0]}. **¿Confirmas?**`;
  }
  return (
    `Hay **${lineas.length} acciones** pendientes. Revisa cada una en el panel (Confirmar / Rechazar):\n\n` +
    lineas.map((l, i) => `${i + 1}. ${l}`).join("\n")
  );
}

const CONTINUAR_TRAS_CONFIRMACION =
  "La acción confirmada ya se ejecutó. Continúa AHORA con el resto de mi petición anterior si quedó algo pendiente (p. ej. recrear tras borrar, crear en otro proyecto, asignar responsables). Llama las tools necesarias enseguida. Si ya no falta nada, responde en una frase corta.";

export async function ejecutarTurno(opts: {
  usuario: UsuarioAuth;
  conversacionId: string;
  mensajeUsuario: string;
  /** Tras lightbox Confirmar: no guarda burbuja de usuario; inyecta instrucción solo al modelo. */
  continuarTrasConfirmacion?: boolean;
}): Promise<{
  respuesta: string;
  titulo: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  webSearchRequests: number;
  costeUsd: number;
}> {
  const { usuario, conversacionId, mensajeUsuario, continuarTrasConfirmacion } =
    opts;
  const texto = continuarTrasConfirmacion
    ? CONTINUAR_TRAS_CONFIRMACION
    : mensajeUsuario.trim();
  if (!texto) throw new Error("mensaje_vacio");

  const tope = await topeMensualEfectivo(usuario.id);
  if (tope != null) {
    const gastos = await gastosUsuario(usuario.id);
    if (gastos.mes.coste >= tope) {
      throw new TopeGastoError(gastos.mes.coste, tope);
    }
  }

  if (!continuarTrasConfirmacion) {
    await anadirMensaje({
      conversacionId,
      rol: "user",
      contenido: texto,
    });
  }

  const historial = await listarMensajes(conversacionId);
  const esPrimerTurno =
    !continuarTrasConfirmacion &&
    historial.filter((m) => m.rol === "user").length === 1;
  const messages: Anthropic.MessageParam[] = sanearMensajesApi(
    recortarMensajesApi(mensajesParaApi(historial), MAX_HISTORIAL),
  );
  if (continuarTrasConfirmacion) {
    messages.push({ role: "user", content: texto });
  }

  const client = clienteAnthropic();
  const clientTools = toolsParaUsuario(usuario).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));
  const webTools = toolsWebParaUsuario(usuario);
  const tools = conCacheEnUltimaTool([
    ...clientTools,
    ...webTools,
  ] as Anthropic.ToolUnion[]);
  const puedeWeb = usuarioPuede(usuario, "asistente.web");
  const modoPruebas = await esModoPruebas();
  const prompt = getSystemPromptParts({
    nombre: usuario.nombre,
    puedeWeb,
    modoPruebas,
    timezone: usuario.timezone,
  });
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: prompt.estable,
      cache_control: CACHE_EPHEMERAL,
    },
    { type: "text", text: prompt.sesion },
  ];

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let webSearchRequests = 0;
  let respuesta = "";
  const listadosTurno: ListadoDetectado[] = [];

  for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages,
      tools: tools.length ? tools : undefined,
    });

    inputTokens += result.usage?.input_tokens ?? 0;
    outputTokens += result.usage?.output_tokens ?? 0;
    cacheCreationTokens += result.usage?.cache_creation_input_tokens ?? 0;
    cacheReadTokens += result.usage?.cache_read_input_tokens ?? 0;
    webSearchRequests += result.usage?.server_tool_use?.web_search_requests ?? 0;

    const toolUses = result.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const textos = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Server tools (web_search / web_fetch) may pause; continue without client tool_result.
    if (result.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: result.content });
      if (textos) respuesta = textos;
      continue;
    }

    if (toolUses.length === 0) {
      respuesta = textos || "(Sin respuesta)";
      break;
    }

    await anadirMensaje({
      conversacionId,
      rol: "assistant",
      contenido: serializarAssistantToolUse(
        acotarBloquesParaPersistir(result.content),
      ),
    });
    messages.push({ role: "assistant", content: result.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const outs: unknown[] = [];
    for (const use of toolUses) {
      const args =
        use.input && typeof use.input === "object"
          ? (use.input as Record<string, unknown>)
          : {};
      const out = await ejecutarTool(usuario, use.name, args, historial, conversacionId);
      outs.push(out);
      const listado = detectarListado(use.name, out);
      if (listado) listadosTurno.push(listado);
      const contenidoTool = serializarToolResult(use.id, use.name, out);
      await anadirMensaje({
        conversacionId,
        rol: "tool",
        contenido: contenidoTool,
        toolName: use.name,
      });
      historial.push({
        id: use.id,
        conversacionId,
        rol: "tool",
        contenido: contenidoTool,
        toolName: use.name,
        creadoEn: new Date().toISOString(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(acotarResultadoTool(out)),
      });
    }
    // Anthropic máx. 4 cache_control: tools(1)+system(1)+último tool_result(1).
    // Sin limpiar, cada ronda acumula otro y al 5º llega 400.
    quitarCacheControlDeMensajes(messages);
    const lastTr = toolResults[toolResults.length - 1];
    if (lastTr) {
      lastTr.cache_control = CACHE_EPHEMERAL;
    }
    messages.push({ role: "user", content: toolResults });

    // Gate: no más rondas LLM; la UI muestra Confirmar/Cancelar sobre el historial.
    if (outs.some(esRequiereConfirmacion)) {
      respuesta = textos || mensajeConfirmacionPorDefecto(outs);
      break;
    }

    if (result.stop_reason === "end_turn" && textos) {
      respuesta = textos;
      break;
    }
  }

  if (!respuesta) {
    respuesta =
      "He alcanzado el límite de pasos de herramientas. Reformula la petición o concreta un solo cambio.";
  }

  respuesta = ocultarUuidsEnTexto(respuesta);
  respuesta = alinearListadoRespuesta(respuesta, listadosTurno);

  await anadirMensaje({
    conversacionId,
    rol: "assistant",
    contenido: respuesta,
  });

  const costeUsd = estimarCosteUsd(inputTokens, outputTokens, {
    cacheCreationTokens,
    cacheReadTokens,
    webSearchRequests,
  });
  await registrarUso({
    usuarioId: usuario.id,
    conversacionId,
    modelo: MODEL,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    webSearchRequests,
    costeUsd,
  });

  let titulo: string | null = null;
  if (esPrimerTurno) {
    titulo = await titulizarTrasPrimerTurno({
      usuarioId: usuario.id,
      conversacionId,
      mensajeUsuario: texto,
      respuestaAsistente: respuesta,
    });
  }

  return {
    respuesta,
    titulo,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    webSearchRequests,
    costeUsd,
  };
}
