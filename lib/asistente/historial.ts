import type Anthropic from "@anthropic-ai/sdk";
import type { MensajeIa } from "@/lib/asistente/store";

/** Assistant turn that called tools (persisted for API replay; hidden in UI). */
export type ContenidoAssistantToolUse = {
  v: 1;
  kind: "assistant_tool_use";
  blocks: Anthropic.ContentBlock[];
};

/** Tool result linked to a tool_use id. */
export type ContenidoToolResult = {
  v: 1;
  kind: "tool_result";
  tool_use_id: string;
  name: string;
  result: unknown;
};

export function serializarAssistantToolUse(
  blocks: Anthropic.ContentBlock[],
): string {
  const payload: ContenidoAssistantToolUse = {
    v: 1,
    kind: "assistant_tool_use",
    blocks,
  };
  return JSON.stringify(payload);
}

/** Max chars for persisted tool_result envelope (must stay valid JSON). */
const MAX_TOOL_RESULT_ENVELOPE = 12_000;
/** Budget for `result` JSON inside the envelope. */
const MAX_TOOL_RESULT_JSON = 10_500;

/** Shrink tool output so the envelope JSON.stringify fits and remains parseable. */
export function acotarResultadoTool(result: unknown): unknown {
  const raw = JSON.stringify(result ?? null);
  if (raw.length <= MAX_TOOL_RESULT_JSON) return result ?? null;

  // List shapes: keep `total` and shrink the array instead of opaque preview.
  const LIST_KEYS = ["tareas", "proyectos", "clientes"] as const;
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    typeof (result as { total?: unknown }).total === "number"
  ) {
    const r = result as { total: number; [k: string]: unknown };
    const clave = LIST_KEYS.find((k) => Array.isArray(r[k]));
    if (clave) {
      const arr = r[clave] as unknown[];
      let n = Math.min(arr.length, 20);
      while (n > 0) {
        const slim = {
          ...r,
          total: r.total,
          mostradas: n,
          truncado: true,
          [clave]: arr.slice(0, n),
        };
        if (JSON.stringify(slim).length <= MAX_TOOL_RESULT_JSON) return slim;
        n = Math.floor(n / 2);
      }
      return {
        total: r.total,
        mostradas: 0,
        truncado: true,
        [clave]: [],
        aviso: "lista omitida: demasiado grande; usa total",
      };
    }
  }

  return {
    truncado: true,
    preview: raw.slice(0, MAX_TOOL_RESULT_JSON - 64),
  };
}

export function serializarToolResult(
  toolUseId: string,
  name: string,
  result: unknown,
): string {
  const payload: ContenidoToolResult = {
    v: 1,
    kind: "tool_result",
    tool_use_id: toolUseId,
    name,
    result: acotarResultadoTool(result),
  };
  const s = JSON.stringify(payload);
  if (s.length <= MAX_TOOL_RESULT_ENVELOPE) return s;
  // Envelope still too large (long name/id): drop preview further.
  const tighter: ContenidoToolResult = {
    ...payload,
    result: { truncado: true, preview: "(resultado omitido: demasiado grande)" },
  };
  return JSON.stringify(tighter);
}

function parseJson(contenido: string): unknown | null {
  const t = contenido.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

export function esAssistantToolUsePersistido(contenido: string): boolean {
  const j = parseJson(contenido);
  return (
    !!j &&
    typeof j === "object" &&
    (j as ContenidoAssistantToolUse).kind === "assistant_tool_use" &&
    (j as ContenidoAssistantToolUse).v === 1
  );
}

function parseToolResultPersistido(contenido: string): ContenidoToolResult | null {
  const j = parseJson(contenido);
  if (
    !j ||
    typeof j !== "object" ||
    (j as ContenidoToolResult).kind !== "tool_result" ||
    (j as ContenidoToolResult).v !== 1
  ) {
    return null;
  }
  return j as ContenidoToolResult;
}

/** Prefijos de mensajes de control de la UI (por ítem / lote). */
const PRE_CONFIRM = "__confirm__:";
const PRE_CANCEL = "__cancel__:";
const MSG_CONFIRM_ALL = "__confirm_all__";
const MSG_CANCEL_ALL = "__cancel_all__";

export function mensajeConfirmacionUi(
  tool: string,
  clave: string,
): string {
  return `${PRE_CONFIRM}${tool}:${clave}`;
}

export function mensajeCancelacionUi(tool: string, clave: string): string {
  return `${PRE_CANCEL}${tool}:${clave}`;
}

export function mensajeConfirmacionTodasUi(): string {
  return MSG_CONFIRM_ALL;
}

export function mensajeCancelacionTodasUi(): string {
  return MSG_CANCEL_ALL;
}

function parseControlConfirmacion(
  texto: string,
):
  | { tipo: "confirm" | "cancel"; tool: string; clave: string }
  | { tipo: "confirm_all" | "cancel_all" }
  | null {
  const t = texto.trim();
  if (t === MSG_CONFIRM_ALL) return { tipo: "confirm_all" };
  if (t === MSG_CANCEL_ALL) return { tipo: "cancel_all" };
  if (t.startsWith(PRE_CONFIRM)) {
    const rest = t.slice(PRE_CONFIRM.length);
    const i = rest.indexOf(":");
    if (i <= 0) return null;
    return {
      tipo: "confirm",
      tool: rest.slice(0, i),
      clave: rest.slice(i + 1),
    };
  }
  if (t.startsWith(PRE_CANCEL)) {
    const rest = t.slice(PRE_CANCEL.length);
    const i = rest.indexOf(":");
    if (i <= 0) return null;
    return {
      tipo: "cancel",
      tool: rest.slice(0, i),
      clave: rest.slice(i + 1),
    };
  }
  return null;
}

function normalizarConfirmTexto(texto: string): string {
  return texto
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** User message that unlocks `confirmado=true` (typed or Confirmar button). */
export function esConfirmacionAfirmativa(texto: string): boolean {
  const control = parseControlConfirmacion(texto);
  if (control?.tipo === "confirm" || control?.tipo === "confirm_all") return true;
  const t = normalizarConfirmTexto(texto);
  if (!t) return false;
  return /^(si|yes|ok|okay|confirmar|confirm|dale|de acuerdo|adelante|proceder|aceptar|accept)\b/.test(
    t,
  );
}

/** User message that rejects a pending confirmation (Cancelar button / «no»). */
export function esConfirmacionNegativa(texto: string): boolean {
  const control = parseControlConfirmacion(texto);
  if (control?.tipo === "cancel" || control?.tipo === "cancel_all") return true;
  const t = normalizarConfirmTexto(texto);
  if (!t) return false;
  return /^(no|nop|cancelar|cancel|cancelado|rechazar|reject)\b/.test(t);
}

/** True if this user text affirms this specific tool+clave (or all). */
export function mensajeAfirmaChallenge(
  texto: string,
  toolName: string,
  clave: string,
): boolean {
  const control = parseControlConfirmacion(texto);
  if (control?.tipo === "confirm_all") return true;
  if (
    control?.tipo === "confirm" &&
    control.tool === toolName &&
    control.clave === clave
  ) {
    return true;
  }
  // Typed «sí» affirms every open challenge (model may execute several).
  if (control) return false;
  return esConfirmacionAfirmativa(texto);
}

function mensajeCancelaChallenge(
  texto: string,
  toolName: string,
  clave: string,
): boolean {
  const control = parseControlConfirmacion(texto);
  if (control?.tipo === "cancel_all") return true;
  if (
    control?.tipo === "cancel" &&
    control.tool === toolName &&
    control.clave === clave
  ) {
    return true;
  }
  if (control) return false;
  return esConfirmacionNegativa(texto);
}

function esMensajeControlConfirmacion(texto: string): boolean {
  return parseControlConfirmacion(texto) != null;
}

export type ConfirmacionPendiente = {
  tool: string;
  clave: string;
  args: Record<string, unknown>;
  toolUseId: string;
  resumen: string | null;
};

function argsDeToolUse(
  historial: MensajeIa[],
  challengeIdx: number,
  toolUseId: string,
): Record<string, unknown> {
  for (let i = challengeIdx - 1; i >= 0; i--) {
    const m = historial[i]!;
    if (m.rol !== "assistant" || !esAssistantToolUsePersistido(m.contenido)) continue;
    const j = parseJson(m.contenido) as ContenidoAssistantToolUse | null;
    if (!j || !Array.isArray(j.blocks)) continue;
    for (const b of j.blocks) {
      if (
        typeof b === "object" &&
        b !== null &&
        "type" in b &&
        (b as { type: string }).type === "tool_use" &&
        "id" in b &&
        (b as { id: string }).id === toolUseId
      ) {
        const input = (b as { input?: unknown }).input;
        if (input && typeof input === "object" && !Array.isArray(input)) {
          return { ...(input as Record<string, unknown>) };
        }
      }
    }
  }
  return {};
}

function challengeConsumidoTrasConfirm(
  historial: MensajeIa[],
  userIdx: number,
  toolName: string,
  clave: string,
): boolean {
  for (let i = userIdx + 1; i < historial.length; i++) {
    const m = historial[i]!;
    if (m.rol !== "tool") continue;
    const env = parseToolResultPersistido(m.contenido);
    if (!env || env.name !== toolName) continue;
    const r = env.result;
    if (!r || typeof r !== "object") return true;
    const err = (r as { error?: unknown }).error;
    const pend = (r as { pendiente?: { clave?: unknown } }).pendiente;
    const mismoPendiente =
      err === "requiere_confirmacion" &&
      pend &&
      typeof pend === "object" &&
      String(pend.clave ?? "") === clave;
    if (!mismoPendiente) return true;
  }
  return false;
}

/**
 * Challenges still waiting for UI / typed confirm.
 * Several can be open at once (multi-tool turn); each is independent.
 */
function registrarPendienteEnMapa(
  latest: Map<
    string,
    {
      idx: number;
      tool: string;
      clave: string;
      toolUseId: string;
      resumen: string | null;
      argsOverride?: Record<string, unknown>;
    }
  >,
  opts: {
    idx: number;
    toolUseId: string;
    tool: string;
    clave: string;
    resumen: string | null;
    argsOverride?: Record<string, unknown>;
  },
) {
  if (!opts.clave) return;
  latest.set(`${opts.tool}\0${opts.clave}`, opts);
}

export function confirmacionesPendientesEnHistorial(
  historial: MensajeIa[],
): ConfirmacionPendiente[] {
  type Ch = {
    idx: number;
    tool: string;
    clave: string;
    toolUseId: string;
    resumen: string | null;
    argsOverride?: Record<string, unknown>;
  };
  const latest = new Map<string, Ch>();

  for (let i = 0; i < historial.length; i++) {
    const m = historial[i]!;
    if (m.rol !== "tool") continue;
    const env = parseToolResultPersistido(m.contenido);
    if (!env) continue;
    const r = env.result;
    if (!r || typeof r !== "object") continue;
    if ((r as { error?: unknown }).error !== "requiere_confirmacion") continue;

    const listaRaw = (r as { pendientes?: unknown }).pendientes;
    if (Array.isArray(listaRaw) && listaRaw.length > 0) {
      for (const item of listaRaw) {
        if (!item || typeof item !== "object") continue;
        const p = item as {
          tool?: unknown;
          clave?: unknown;
          resumen?: unknown;
          args?: unknown;
        };
        const clave = String(p.clave ?? "");
        if (!clave) continue;
        const tool = String(p.tool ?? env.name);
        const resumen =
          typeof p.resumen === "string" && p.resumen.trim()
            ? p.resumen.trim()
            : null;
        const argsOverride =
          p.args && typeof p.args === "object" && !Array.isArray(p.args)
            ? { ...(p.args as Record<string, unknown>) }
            : undefined;
        registrarPendienteEnMapa(latest, {
          idx: i,
          toolUseId: env.tool_use_id,
          tool,
          clave,
          resumen,
          argsOverride,
        });
      }
      continue;
    }

    const pend = (r as {
      pendiente?: { tool?: unknown; clave?: unknown; resumen?: unknown };
    }).pendiente;
    if (!pend || typeof pend !== "object" || !String(pend.clave ?? "")) continue;
    const tool = String(pend.tool ?? env.name);
    const clave = String(pend.clave);
    const resumen =
      typeof pend.resumen === "string" && pend.resumen.trim()
        ? pend.resumen.trim()
        : null;
    registrarPendienteEnMapa(latest, {
      idx: i,
      toolUseId: env.tool_use_id,
      tool,
      clave,
      resumen,
    });
  }

  const out: ConfirmacionPendiente[] = [];
  for (const ch of latest.values()) {
    let afirmado = false;
    let cerrado = false;
    for (let i = ch.idx + 1; i < historial.length; i++) {
      const m = historial[i]!;
      if (m.rol === "user") {
        if (mensajeCancelaChallenge(m.contenido, ch.tool, ch.clave)) {
          cerrado = true;
          break;
        }
        if (mensajeAfirmaChallenge(m.contenido, ch.tool, ch.clave)) {
          afirmado = true;
          if (challengeConsumidoTrasConfirm(historial, i, ch.tool, ch.clave)) {
            cerrado = true;
            break;
          }
          // Typed «sí» / confirm_all: hide from UI; model will execute.
          const control = parseControlConfirmacion(m.contenido);
          if (!control || control.tipo === "confirm_all") {
            cerrado = true;
            break;
          }
          // Specific __confirm__: keep looking for execution in same/next rows.
          continue;
        }
        if (esMensajeControlConfirmacion(m.contenido)) {
          // Control for another item — ignore.
          continue;
        }
        // Free-form new request → abandon open challenges in UI.
        cerrado = true;
        break;
      }
      if (afirmado && m.rol === "tool") {
        const env = parseToolResultPersistido(m.contenido);
        if (!env || env.name !== ch.tool) continue;
        const r = env.result;
        if (!r || typeof r !== "object") {
          cerrado = true;
          break;
        }
        const err = (r as { error?: unknown }).error;
        const pend = (r as { pendiente?: { clave?: unknown } }).pendiente;
        const mismo =
          err === "requiere_confirmacion" &&
          pend &&
          typeof pend === "object" &&
          String(pend.clave ?? "") === ch.clave;
        if (!mismo) {
          cerrado = true;
          break;
        }
      }
    }
    if (cerrado) continue;
    out.push({
      tool: ch.tool,
      clave: ch.clave,
      toolUseId: ch.toolUseId,
      resumen: ch.resumen,
      args:
        ch.argsOverride ?? argsDeToolUse(historial, ch.idx, ch.toolUseId),
    });
  }

  out.sort((a, b) => a.tool.localeCompare(b.tool) || a.clave.localeCompare(b.clave));
  return out;
}

/** @deprecated Prefer confirmacionesPendientesEnHistorial (multi). */
export function confirmacionPendienteEnHistorial(
  historial: MensajeIa[],
): ConfirmacionPendiente | null {
  return confirmacionesPendientesEnHistorial(historial)[0] ?? null;
}

function firmaArgsSinConfirmado(args: Record<string, unknown>): string {
  const { confirmado: _c, ...rest } = args;
  const keys = Object.keys(rest).sort();
  const slim: Record<string, unknown> = {};
  for (const k of keys) {
    const v = rest[k];
    if (v === undefined) continue;
    slim[k] = v;
  }
  return JSON.stringify(slim);
}

function toolUseConfirmadoMismaFirma(
  historial: MensajeIa[],
  fromIdx: number,
  toolName: string,
  firmaChallenge: string,
): boolean {
  for (let i = fromIdx; i < historial.length; i++) {
    const m = historial[i]!;
    if (m.rol !== "assistant" || !esAssistantToolUsePersistido(m.contenido)) continue;
    const j = parseJson(m.contenido) as ContenidoAssistantToolUse | null;
    if (!j?.blocks) continue;
    for (const b of j.blocks) {
      if (
        typeof b !== "object" ||
        b === null ||
        !("type" in b) ||
        (b as { type: string }).type !== "tool_use" ||
        !("name" in b) ||
        (b as { name: string }).name !== toolName
      ) {
        continue;
      }
      const input = (b as { input?: unknown }).input;
      if (!input || typeof input !== "object" || Array.isArray(input)) continue;
      const args = input as Record<string, unknown>;
      if (args.confirmado !== true) continue;
      if (firmaArgsSinConfirmado(args) === firmaChallenge) return true;
    }
  }
  return false;
}

/**
 * Server two-turn confirm: `confirmado=true` is only valid if this conversation
 * already has a `requiere_confirmacion` for the same tool+clave and a later
 * **affirmative** user message for that challenge, and it was not already consumed.
 */
export function confirmacionDosTurnosOk(
  historial: MensajeIa[],
  toolName: string,
  clave: string,
): boolean {
  let challengeIdx = -1;
  let challengeToolUseId = "";
  for (let i = 0; i < historial.length; i++) {
    const m = historial[i];
    if (m.rol !== "tool") continue;
    const env = parseToolResultPersistido(m.contenido);
    if (!env || env.name !== toolName) continue;
    const r = env.result;
    if (!r || typeof r !== "object") continue;
    const err = (r as { error?: unknown }).error;
    if (err !== "requiere_confirmacion") continue;
    const pend = (r as { pendiente?: { clave?: unknown } }).pendiente;
    if (pend && typeof pend === "object" && String(pend.clave ?? "") === clave) {
      challengeIdx = i;
      challengeToolUseId = env.tool_use_id;
    }
  }
  if (challengeIdx < 0) return false;

  const argsChallenge = argsDeToolUse(historial, challengeIdx, challengeToolUseId);
  const firmaChallenge = firmaArgsSinConfirmado(argsChallenge);

  let userIdx = -1;
  for (let i = challengeIdx + 1; i < historial.length; i++) {
    const m = historial[i];
    if (m.rol === "user") {
      if (mensajeCancelaChallenge(m.contenido, toolName, clave)) {
        return false;
      }
      if (mensajeAfirmaChallenge(m.contenido, toolName, clave)) {
        userIdx = i;
      }
      continue;
    }
  }
  if (userIdx < 0) return false;

  // Already executed this exact challenge (same args + confirmado).
  if (toolUseConfirmadoMismaFirma(historial, userIdx + 1, toolName, firmaChallenge)) {
    return false;
  }
  return true;
}

/** Text shown in the chat UI (skip structured tool-use assistant rows). */
export function textoVisibleEnUi(m: Pick<MensajeIa, "rol" | "contenido">): string | null {
  if (m.rol === "user") {
    const control = parseControlConfirmacion(m.contenido);
    if (!control) return m.contenido;
    if (control.tipo === "confirm_all") return "Confirmar todas";
    if (control.tipo === "cancel_all") return "Cancelar todas";
    if (control.tipo === "confirm") return "Confirmar";
    return "Cancelar";
  }
  if (m.rol !== "assistant") return null;
  if (esAssistantToolUsePersistido(m.contenido)) return null;
  return m.contenido;
}

/**
 * Rebuild Anthropic `messages` from DB rows, including tool_use / tool_result pairs.
 * Legacy plain tool rows (pre-envelope) are skipped — cannot replay without tool_use_id.
 */
export function mensajesParaApi(historial: MensajeIa[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const m of historial) {
    if (m.rol === "user") {
      out.push({ role: "user", content: m.contenido });
      continue;
    }

    if (m.rol === "assistant") {
      const j = parseJson(m.contenido);
      if (
        j &&
        typeof j === "object" &&
        (j as ContenidoAssistantToolUse).kind === "assistant_tool_use" &&
        (j as ContenidoAssistantToolUse).v === 1 &&
        Array.isArray((j as ContenidoAssistantToolUse).blocks)
      ) {
        out.push({
          role: "assistant",
          content: (j as ContenidoAssistantToolUse).blocks,
        });
      } else {
        out.push({ role: "assistant", content: m.contenido });
      }
      continue;
    }

    if (m.rol === "tool") {
      const j = parseJson(m.contenido);
      if (
        j &&
        typeof j === "object" &&
        (j as ContenidoToolResult).kind === "tool_result" &&
        (j as ContenidoToolResult).v === 1 &&
        typeof (j as ContenidoToolResult).tool_use_id === "string"
      ) {
        const tr = j as ContenidoToolResult;
        const prev = out[out.length - 1];
        const block: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: JSON.stringify(tr.result).slice(0, 12000),
        };
        if (
          prev &&
          prev.role === "user" &&
          Array.isArray(prev.content) &&
          prev.content.length > 0 &&
          typeof prev.content[0] === "object" &&
          prev.content[0] !== null &&
          "type" in prev.content[0] &&
          (prev.content[0] as { type: string }).type === "tool_result"
        ) {
          (prev.content as Anthropic.ToolResultBlockParam[]).push(block);
        } else {
          out.push({ role: "user", content: [block] });
        }
      }
      // legacy tool rows without envelope: skip
    }
  }

  return out;
}

function idsToolUseDe(content: Anthropic.MessageParam["content"]): string[] {
  if (!Array.isArray(content)) return [];
  const ids: string[] = [];
  for (const b of content) {
    if (
      typeof b === "object" &&
      b !== null &&
      "type" in b &&
      (b as { type: string }).type === "tool_use" &&
      "id" in b &&
      typeof (b as { id: unknown }).id === "string"
    ) {
      ids.push((b as { id: string }).id);
    }
  }
  return ids;
}

function esMensajeToolResult(m: Anthropic.MessageParam): boolean {
  if (m.role !== "user" || !Array.isArray(m.content) || m.content.length === 0) {
    return false;
  }
  const first = m.content[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "type" in first &&
    (first as { type: string }).type === "tool_result"
  );
}

function idsToolResultDe(content: Anthropic.MessageParam["content"]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(content)) return ids;
  for (const b of content) {
    if (
      typeof b === "object" &&
      b !== null &&
      "type" in b &&
      (b as { type: string }).type === "tool_result" &&
      "tool_use_id" in b &&
      typeof (b as { tool_use_id: unknown }).tool_use_id === "string"
    ) {
      ids.add((b as { tool_use_id: string }).tool_use_id);
    }
  }
  return ids;
}

/**
 * Drop incomplete tool_use turns (no matching tool_result) and orphan tool_result
 * messages so Anthropic never rejects the history with invalid_request_error.
 */
export function sanearMensajesApi(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === "assistant") {
      const ids = idsToolUseDe(m.content);
      if (ids.length === 0) {
        out.push(m);
        continue;
      }
      const next = messages[i + 1];
      const resultIds = next && esMensajeToolResult(next) ? idsToolResultDe(next.content) : null;
      const completo =
        resultIds != null && ids.length > 0 && ids.every((id) => resultIds.has(id));
      if (completo) {
        out.push(m);
        continue;
      }
      // Incomplete pair (crash mid-turn, truncated/unparseable tool row, etc.): skip.
      if (next && esMensajeToolResult(next)) i += 1;
      continue;
    }

    if (esMensajeToolResult(m)) {
      const prev = out[out.length - 1];
      if (!prev || prev.role !== "assistant" || idsToolUseDe(prev.content).length === 0) {
        continue;
      }
      out.push(m);
      continue;
    }

    out.push(m);
  }

  return out;
}

/** Drop a leading cut that would orphan tool_result or split a tool_use pair. */
export function recortarMensajesApi(
  messages: Anthropic.MessageParam[],
  max: number,
): Anthropic.MessageParam[] {
  if (messages.length <= max) return messages;
  let start = messages.length - max;

  while (start > 0 && start < messages.length) {
    const m = messages[start];
    if (esMensajeToolResult(m)) {
      start -= 1;
      continue;
    }
    break;
  }

  return sanearMensajesApi(messages.slice(Math.max(0, start)));
}
