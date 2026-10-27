/**
 * Cliente mínimo Gmail API v1 (leer, adjuntos, enviar).
 * Docs: https://developers.google.com/workspace/gmail/api/reference/rest
 */

import { obtenerAccessToken } from "@/lib/google-calendar";
import { esModoPruebas } from "@/lib/sandbox";
import { tokensGooglePorCorreo } from "@/lib/usuarios";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type Tokens = {
  refreshToken: string;
  accessToken?: string | null;
  expiry?: Date | null;
};

export type CorreoCarpeta = "inbox" | "sent";

export const CORREO_QUERY: Record<CorreoCarpeta, string> = {
  inbox: "in:inbox",
  sent: "in:sent",
};

export type CorreoFiltros = {
  carpeta?: CorreoCarpeta;
  /** Texto libre / operadores Gmail (from:, subject:, …). */
  busqueda?: string;
  soloNoLeidos?: boolean;
  conAdjuntos?: boolean;
};

/** Arma `q` de Gmail: carpeta + filtros + búsqueda. */
export function construirQueryCorreo(filtros: CorreoFiltros = {}): string {
  const carpeta = filtros.carpeta ?? "inbox";
  const partes: string[] = [CORREO_QUERY[carpeta]];
  if (filtros.soloNoLeidos) partes.push("is:unread");
  if (filtros.conAdjuntos) partes.push("has:attachment");
  const texto = (filtros.busqueda ?? "").trim();
  if (texto) partes.push(texto);
  return partes.join(" ");
}

/** Fila de lista = conversación (hilo Gmail). `id` === `threadId`. */
export type CorreoListaItem = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  starred: boolean;
  messageCount: number;
};

export type CorreoAdjuntoEnvio = {
  filename: string;
  mimeType: string;
  /** Contenido en base64 estándar (no url-safe). */
  contentBase64: string;
};

const MAX_ADJUNTOS = 5;
const MAX_ADJUNTOS_BYTES = 18 * 1024 * 1024;

export type CorreoAdjuntoMeta = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type CorreoDetalle = {
  id: string;
  threadId: string;
  /** Cabecera Message-ID (para In-Reply-To). */
  messageIdHeader: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  snippet: string;
  unread: boolean;
  starred: boolean;
  attachments: CorreoAdjuntoMeta[];
};

export type CorreoHiloDetalle = {
  threadId: string;
  subject: string;
  unread: boolean;
  starred: boolean;
  messages: CorreoDetalle[];
};

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPart;
  internalDate?: string;
};

function header(headers: GmailHeader[] | undefined, name: string): string {
  const n = name.toLowerCase();
  return headers?.find((h) => (h.name ?? "").toLowerCase() === n)?.value?.trim() ?? "";
}

/** base64url → Buffer (Gmail API). */
export function decodeBase64Url(data: string): Buffer {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

function encodeBase64Url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function walkParts(part: GmailPart | undefined, visit: (p: GmailPart) => void) {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walkParts(child, visit);
}

function extraerCuerpos(payload: GmailPart | undefined): {
  bodyHtml: string | null;
  bodyText: string | null;
} {
  let bodyHtml: string | null = null;
  let bodyText: string | null = null;

  walkParts(payload, (p) => {
    if (p.filename) return;
    const data = p.body?.data;
    if (!data) return;
    const mime = (p.mimeType ?? "").toLowerCase();
    const text = decodeBase64Url(data).toString("utf8");
    if (mime === "text/html" && !bodyHtml) bodyHtml = text;
    if (mime === "text/plain" && !bodyText) bodyText = text;
  });

  if (!bodyHtml && !bodyText && payload?.body?.data && !payload.filename) {
    const mime = (payload.mimeType ?? "").toLowerCase();
    const text = decodeBase64Url(payload.body.data).toString("utf8");
    if (mime === "text/html") bodyHtml = text;
    else bodyText = text;
  }

  return { bodyHtml, bodyText };
}

function extraerAdjuntos(payload: GmailPart | undefined): CorreoAdjuntoMeta[] {
  const out: CorreoAdjuntoMeta[] = [];
  walkParts(payload, (p) => {
    const attachmentId = p.body?.attachmentId;
    const filename = (p.filename ?? "").trim();
    if (!attachmentId || !filename) return;
    out.push({
      attachmentId,
      filename,
      mimeType: p.mimeType || "application/octet-stream",
      size: p.body?.size ?? 0,
    });
  });
  return out;
}

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/** Quita lo más peligroso del HTML de Gmail antes de mostrarlo en Órbita. */
export function sanitizarHtmlCorreo(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

async function gmailFetch(
  tokens: Tokens,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const accessToken = await obtenerAccessToken(tokens);
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function tokensCorreoOError(
  correo: string,
): Promise<{ ok: true; tokens: Tokens } | { ok: false; motivo: "sin_token" }> {
  const tokens = await tokensGooglePorCorreo(correo);
  if (!tokens?.refreshToken) return { ok: false, motivo: "sin_token" };
  return {
    ok: true,
    tokens: {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiry: tokens.expiry,
    },
  };
}

function mensajeADetalle(msg: GmailMessage): CorreoDetalle {
  const headers = msg.payload?.headers;
  const { bodyHtml, bodyText } = extraerCuerpos(msg.payload);
  const messageIdHeader =
    header(headers, "Message-ID") || header(headers, "Message-Id");
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    messageIdHeader,
    from: header(headers, "From"),
    to: header(headers, "To"),
    cc: header(headers, "Cc"),
    subject: header(headers, "Subject") || "(Sin asunto)",
    date: header(headers, "Date") || (msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : null),
    bodyHtml: bodyHtml ? sanitizarHtmlCorreo(bodyHtml) : null,
    bodyText,
    snippet: msg.snippet ?? "",
    unread: (msg.labelIds ?? []).includes("UNREAD"),
    starred: (msg.labelIds ?? []).includes("STARRED"),
    attachments: extraerAdjuntos(msg.payload),
  };
}

function hiloDesdeMensajes(
  threadId: string,
  messages: GmailMessage[],
  snippetFallback?: string,
): CorreoListaItem | null {
  if (messages.length === 0) return null;
  const ordenados = [...messages].sort(
    (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
  );
  const ultimo = ordenados[ordenados.length - 1]!;
  const primero = ordenados[0]!;
  const headersUltimo = ultimo.payload?.headers;
  const headersPrimero = primero.payload?.headers;
  const subject =
    header(headersUltimo, "Subject") ||
    header(headersPrimero, "Subject") ||
    "(Sin asunto)";
  const unread = ordenados.some((m) => (m.labelIds ?? []).includes("UNREAD"));
  const starred = ordenados.some((m) => (m.labelIds ?? []).includes("STARRED"));
  return {
    id: threadId,
    threadId,
    from: header(headersUltimo, "From"),
    to: header(headersUltimo, "To"),
    subject,
    snippet: ultimo.snippet || snippetFallback || "",
    date: header(headersUltimo, "Date") || (ultimo.internalDate
      ? new Date(Number(ultimo.internalDate)).toISOString()
      : null),
    unread,
    starred,
    messageCount: ordenados.length,
  };
}

/** Lista conversaciones (threads.list + metadata). */
export async function listarCorreos(
  tokens: Tokens,
  opts?: {
    maxResults?: number;
    pageToken?: string;
    carpeta?: CorreoCarpeta;
    busqueda?: string;
    soloNoLeidos?: boolean;
    conAdjuntos?: boolean;
    q?: string;
  },
): Promise<{ items: CorreoListaItem[]; nextPageToken: string | null }> {
  const carpeta = opts?.carpeta ?? "inbox";
  const q =
    opts?.q ??
    construirQueryCorreo({
      carpeta,
      busqueda: opts?.busqueda,
      soloNoLeidos: opts?.soloNoLeidos,
      conAdjuntos: opts?.conAdjuntos,
    });
  const params = new URLSearchParams({
    maxResults: String(opts?.maxResults ?? 25),
    q,
  });
  if (opts?.pageToken) params.set("pageToken", opts.pageToken);

  const listRes = await gmailFetch(tokens, `/threads?${params}`);
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail threads.list falló: ${listRes.status} ${text}`);
  }
  const list = (await listRes.json()) as {
    threads?: { id: string; snippet?: string }[];
    nextPageToken?: string;
  };
  const refs = list.threads ?? [];
  if (refs.length === 0) return { items: [], nextPageToken: list.nextPageToken ?? null };

  const items: CorreoListaItem[] = [];
  await Promise.all(
    refs.map(async (ref) => {
      const metaParams = new URLSearchParams({ format: "metadata" });
      for (const h of ["From", "To", "Subject", "Date"]) {
        metaParams.append("metadataHeaders", h);
      }
      const res = await gmailFetch(
        tokens,
        `/threads/${encodeURIComponent(ref.id)}?${metaParams}`,
      );
      if (!res.ok) return;
      const thread = (await res.json()) as {
        id?: string;
        messages?: GmailMessage[];
      };
      const item = hiloDesdeMensajes(
        thread.id ?? ref.id,
        thread.messages ?? [],
        ref.snippet,
      );
      if (item) items.push(item);
    }),
  );

  const orden = new Map(refs.map((r, i) => [r.id, i]));
  items.sort((a, b) => (orden.get(a.threadId) ?? 0) - (orden.get(b.threadId) ?? 0));
  return { items, nextPageToken: list.nextPageToken ?? null };
}

/** Abre una conversación completa (threads.get format=full). */
export async function leerHilo(
  tokens: Tokens,
  threadId: string,
): Promise<CorreoHiloDetalle> {
  const res = await gmailFetch(
    tokens,
    `/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail threads.get falló: ${res.status} ${text}`);
  }
  const thread = (await res.json()) as {
    id?: string;
    messages?: GmailMessage[];
  };
  const messages = [...(thread.messages ?? [])]
    .sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0))
    .map(mensajeADetalle)
    .filter((m) => m.id);
  const subject = messages[0]?.subject || messages.at(-1)?.subject || "(Sin asunto)";
  return {
    threadId: thread.id ?? threadId,
    subject,
    unread: messages.some((m) => m.unread),
    starred: messages.some((m) => m.starred),
    messages,
  };
}

/** Marca el hilo como leído (`leido=true`) o no leído (`leido=false`). */
export async function marcarHiloLeido(
  tokens: Tokens,
  threadId: string,
  leido = true,
): Promise<void> {
  const body = leido
    ? { removeLabelIds: ["UNREAD"] }
    : { addLabelIds: ["UNREAD"] };
  const res = await gmailFetch(tokens, `/threads/${encodeURIComponent(threadId)}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Gmail threads.modify (${leido ? "leído" : "no leído"}) falló: ${res.status} ${text}`,
    );
  }
}

/** Añade o quita STARRED en el hilo. */
export async function marcarHiloEstrella(
  tokens: Tokens,
  threadId: string,
  starred: boolean,
): Promise<void> {
  const body = starred
    ? { addLabelIds: ["STARRED"] }
    : { removeLabelIds: ["STARRED"] };
  const res = await gmailFetch(tokens, `/threads/${encodeURIComponent(threadId)}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail threads.modify (estrella) falló: ${res.status} ${text}`);
  }
}

function nombreAdjuntoMime(filename: string): string {
  const limpio = filename.replace(/[\r\n"]/g, "_").slice(0, 180) || "adjunto";
  if (/^[\x20-\x7E]+$/.test(limpio)) return limpio;
  return `=?UTF-8?B?${Buffer.from(limpio, "utf8").toString("base64")}?=`;
}

function construirMimeRaw(input: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  adjuntos?: CorreoAdjuntoEnvio[];
  inReplyTo?: string;
  references?: string;
}): string {
  const to = input.to.trim();
  const subject = input.subject.trim() || "(Sin asunto)";
  const adjuntos = input.adjuntos ?? [];
  const headersBase = [
    input.from ? `From: ${input.from}` : null,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    "MIME-Version: 1.0",
  ].filter((l): l is string => l !== null);

  if (adjuntos.length === 0) {
    return [...headersBase, "Content-Type: text/plain; charset=utf-8", "", input.body].join(
      "\r\n",
    );
  }

  const boundary = `orbita_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const parts: string[] = [
    ...headersBase,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.body || "",
  ];

  for (const a of adjuntos) {
    const mime = (a.mimeType || "application/octet-stream").replace(/[\r\n]/g, "");
    const b64 = a.contentBase64.replace(/\s+/g, "");
    const wrapped = b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${nombreAdjuntoMime(a.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${nombreAdjuntoMime(a.filename)}"`,
      "",
      wrapped,
    );
  }
  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

export async function descargarAdjuntoGmail(
  tokens: Tokens,
  messageId: string,
  attachmentId: string,
): Promise<{ buffer: Buffer; size: number }> {
  const res = await gmailFetch(
    tokens,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail attachment falló: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data?: string; size?: number };
  if (!data.data) throw new Error("Adjunto vacío");
  const buffer = decodeBase64Url(data.data);
  return { buffer, size: data.size ?? buffer.length };
}

export async function enviarCorreoGmail(
  tokens: Tokens,
  input: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    adjuntos?: CorreoAdjuntoEnvio[];
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  },
): Promise<{ id: string; threadId?: string }> {
  if (await esModoPruebas()) {
    throw new Error("Correo desactivado en modo pruebas");
  }

  const to = input.to.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.split(",")[0]?.trim() ?? "")) {
    throw new Error("Destinatario inválido");
  }

  const adjuntos = input.adjuntos ?? [];
  if (adjuntos.length > MAX_ADJUNTOS) {
    throw new Error(`Máximo ${MAX_ADJUNTOS} adjuntos`);
  }
  let totalBytes = 0;
  for (const a of adjuntos) {
    totalBytes += Math.floor((a.contentBase64.replace(/\s+/g, "").length * 3) / 4);
  }
  if (totalBytes > MAX_ADJUNTOS_BYTES) {
    throw new Error("Adjuntos demasiado grandes (máx. ~18 MB)");
  }

  const raw = encodeBase64Url(
    construirMimeRaw({
      to,
      subject: input.subject,
      body: input.body,
      from: input.from,
      adjuntos,
      inReplyTo: input.inReplyTo,
      references: input.references,
    }),
  );
  const payload: { raw: string; threadId?: string } = { raw };
  if (input.threadId?.trim()) payload.threadId = input.threadId.trim();

  const res = await gmailFetch(tokens, "/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send falló: ${res.status} ${text}`);
  }
  const sent = (await res.json()) as { id?: string; threadId?: string };
  return { id: sent.id ?? "", threadId: sent.threadId };
}
