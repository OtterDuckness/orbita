import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";

export type RolMensajeIa = "user" | "assistant" | "tool";

export type ConversacionIa = {
  id: string;
  usuarioId: string;
  titulo: string;
  creadoEn: string;
  actualizadoEn: string;
};

export type MensajeIa = {
  id: string;
  conversacionId: string;
  rol: RolMensajeIa;
  contenido: string;
  toolName: string | null;
  creadoEn: string;
};

export type TotalesUso = {
  input: number;
  output: number;
  coste: number;
};

export type GastosUsuario = {
  mes: TotalesUso;
  total: TotalesUso;
};

export type GastosPorUsuario = {
  usuarioId: string;
  mes: TotalesUso;
  total: TotalesUso;
};

export type PreviewChatAdmin = {
  id: string;
  titulo: string;
  creadoEn: string;
  actualizadoEn: string;
  inputTokens: number;
  outputTokens: number;
  costeUsd: number;
  ultimoMensaje: {
    excerpt: string;
    rol: string;
    creadoEn: string;
  } | null;
};

/** Stats por chat (estilo BoostIQ Usage): sin excerpt de mensaje. */
export type EstadisticaChatAdmin = {
  id: string;
  titulo: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioCorreo: string;
  creadoEn: string;
  actualizadoEn: string;
  llamadas: number;
  mensajes: number;
  inputTokens: number;
  outputTokens: number;
  costeUsd: number;
};

type ConvRow = RowDataPacket & {
  id: string;
  usuario_id: string;
  titulo: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
};

type MsgRow = RowDataPacket & {
  id: string;
  conversacion_id: string;
  rol: string;
  contenido: string;
  tool_name: string | null;
  creado_en: Date | string;
};

type UsoAggRow = RowDataPacket & {
  input_tokens: number | string;
  output_tokens: number | string;
  coste_usd: number | string;
};

type UsoPorUsuarioRow = RowDataPacket & {
  usuario_id: string;
  input_tokens: number | string;
  output_tokens: number | string;
  coste_usd: number | string;
};

type PreviewRow = RowDataPacket & {
  id: string;
  titulo: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  coste_usd: number | string | null;
  ultimo_contenido: string | null;
  ultimo_rol: string | null;
  ultimo_creado_en: Date | string | null;
};

type EstadisticaChatRow = RowDataPacket & {
  id: string;
  titulo: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_correo: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
  llamadas: number | string | null;
  mensajes: number | string | null;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  coste_usd: number | string | null;
};

function iso(v: Date | string | null | undefined): string {
  if (v == null) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function num(v: number | string | null | undefined): number {
  return Number(v) || 0;
}

function vacioUso(): TotalesUso {
  return { input: 0, output: 0, coste: 0 };
}

function filaAConv(r: ConvRow): ConversacionIa {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    titulo: r.titulo,
    creadoEn: iso(r.creado_en),
    actualizadoEn: iso(r.actualizado_en),
  };
}

function filaAMsg(r: MsgRow): MensajeIa {
  return {
    id: r.id,
    conversacionId: r.conversacion_id,
    rol: r.rol as RolMensajeIa,
    contenido: r.contenido,
    toolName: r.tool_name,
    creadoEn: iso(r.creado_en),
  };
}

function inicioMesUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 19).replace("T", " ");
}

async function sumarUso(
  whereSql: string,
  params: (string | number)[],
): Promise<TotalesUso> {
  const pool = await getPool();
  const [rows] = await pool.execute<UsoAggRow[]>(
    `SELECT
       COALESCE(SUM(input_tokens), 0) AS input_tokens,
       COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(coste_usd), 0) AS coste_usd
     FROM ia_uso
     WHERE ${whereSql}`,
    params,
  );
  const r = rows[0];
  return {
    input: num(r?.input_tokens),
    output: num(r?.output_tokens),
    coste: num(r?.coste_usd),
  };
}

export async function crearConversacion(
  usuarioId: string,
  titulo: string,
): Promise<ConversacionIa> {
  const id = randomUUID();
  const tituloLimpio = titulo.trim().slice(0, 200) || "Nueva conversación";
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO ia_conversaciones (id, usuario_id, titulo) VALUES (?, ?, ?)`,
    [id, usuarioId, tituloLimpio],
  );
  const conv = await obtenerConversacion(id, usuarioId);
  if (!conv) throw new Error("conversacion_no_creada");
  return conv;
}

/** Solo cambia el título; no toca `actualizado_en` (orden de la lista). */
export async function actualizarTitulo(
  id: string,
  usuarioId: string,
  titulo: string,
): Promise<void> {
  const tituloLimpio = titulo.trim().slice(0, 200) || "Nueva conversación";
  const pool = await getPool();
  await pool.execute(
    `UPDATE ia_conversaciones SET titulo = ? WHERE id = ? AND usuario_id = ?`,
    [tituloLimpio, id, usuarioId],
  );
}

export async function listarConversaciones(usuarioId: string): Promise<ConversacionIa[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ConvRow[]>(
    `SELECT id, usuario_id, titulo, creado_en, actualizado_en
     FROM ia_conversaciones
     WHERE usuario_id = ?
     ORDER BY actualizado_en DESC`,
    [usuarioId],
  );
  return rows.map(filaAConv);
}

export async function obtenerConversacion(
  id: string,
  usuarioId: string,
): Promise<ConversacionIa | null> {
  if (!id) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<ConvRow[]>(
    `SELECT id, usuario_id, titulo, creado_en, actualizado_en
     FROM ia_conversaciones
     WHERE id = ? AND usuario_id = ?
     LIMIT 1`,
    [id, usuarioId],
  );
  const r = rows[0];
  return r ? filaAConv(r) : null;
}

export type ConversacionAdmin = ConversacionIa & {
  usuarioNombre: string;
  usuarioCorreo: string;
};

/** Admin: cualquier chat por id (sin filtro de dueño). */
export async function obtenerConversacionAdmin(
  id: string,
): Promise<ConversacionAdmin | null> {
  if (!id.trim()) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<
    (ConvRow & { usuario_nombre: string; usuario_correo: string })[]
  >(
    `SELECT c.id, c.usuario_id, c.titulo, c.creado_en, c.actualizado_en,
            u.nombre AS usuario_nombre, u.correo AS usuario_correo
     FROM ia_conversaciones c
     INNER JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.id = ?
     LIMIT 1`,
    [id.trim()],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ...filaAConv(r),
    usuarioNombre: r.usuario_nombre,
    usuarioCorreo: r.usuario_correo,
  };
}

export async function listarMensajes(conversacionId: string): Promise<MensajeIa[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<MsgRow[]>(
    `SELECT id, conversacion_id, rol, contenido, tool_name, creado_en
     FROM ia_mensajes
     WHERE conversacion_id = ?
     ORDER BY creado_en ASC`,
    [conversacionId],
  );
  return rows.map(filaAMsg);
}

export async function anadirMensaje(opts: {
  conversacionId: string;
  rol: RolMensajeIa;
  contenido: string;
  toolName?: string | null;
}): Promise<MensajeIa> {
  const id = randomUUID();
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO ia_mensajes (id, conversacion_id, rol, contenido, tool_name)
     VALUES (?, ?, ?, ?, ?)`,
    [id, opts.conversacionId, opts.rol, opts.contenido, opts.toolName ?? null],
  );
  await pool.execute(
    `UPDATE ia_conversaciones SET actualizado_en = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [opts.conversacionId],
  );
  const [rows] = await pool.execute<MsgRow[]>(
    `SELECT id, conversacion_id, rol, contenido, tool_name, creado_en
     FROM ia_mensajes WHERE id = ? LIMIT 1`,
    [id],
  );
  return filaAMsg(rows[0]!);
}

export async function registrarUso(opts: {
  usuarioId: string;
  conversacionId: string | null;
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  webSearchRequests?: number;
  costeUsd: number;
}): Promise<void> {
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO ia_uso
       (id, usuario_id, conversacion_id, modelo, input_tokens, output_tokens,
        cache_creation_tokens, cache_read_tokens, web_search_requests, coste_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      opts.usuarioId,
      opts.conversacionId,
      opts.modelo,
      Math.max(0, Math.floor(opts.inputTokens)),
      Math.max(0, Math.floor(opts.outputTokens)),
      Math.max(0, Math.floor(opts.cacheCreationTokens ?? 0)),
      Math.max(0, Math.floor(opts.cacheReadTokens ?? 0)),
      Math.max(0, Math.floor(opts.webSearchRequests ?? 0)),
      opts.costeUsd,
    ],
  );
}

export async function gastosUsuario(usuarioId: string): Promise<GastosUsuario> {
  const desde = inicioMesUtc();
  const [mes, total] = await Promise.all([
    sumarUso("usuario_id = ? AND creado_en >= ?", [usuarioId, desde]),
    sumarUso("usuario_id = ?", [usuarioId]),
  ]);
  return { mes, total };
}

export async function gastosPorUsuario(): Promise<GastosPorUsuario[]> {
  const pool = await getPool();
  const desde = inicioMesUtc();

  const [totales] = await pool.execute<UsoPorUsuarioRow[]>(
    `SELECT usuario_id,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(coste_usd), 0) AS coste_usd
     FROM ia_uso
     GROUP BY usuario_id`,
  );

  const [meses] = await pool.execute<UsoPorUsuarioRow[]>(
    `SELECT usuario_id,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(coste_usd), 0) AS coste_usd
     FROM ia_uso
     WHERE creado_en >= ?
     GROUP BY usuario_id`,
    [desde],
  );

  const mesMap = new Map(
    meses.map((r) => [
      r.usuario_id,
      {
        input: num(r.input_tokens),
        output: num(r.output_tokens),
        coste: num(r.coste_usd),
      } satisfies TotalesUso,
    ]),
  );

  return totales.map((r) => ({
    usuarioId: r.usuario_id,
    mes: mesMap.get(r.usuario_id) ?? vacioUso(),
    total: {
      input: num(r.input_tokens),
      output: num(r.output_tokens),
      coste: num(r.coste_usd),
    },
  }));
}

export async function listarPreviewsChatsAdmin(
  usuarioId: string,
): Promise<PreviewChatAdmin[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<PreviewRow[]>(
    `SELECT c.id, c.titulo, c.creado_en, c.actualizado_en,
            COALESCE(u.input_tokens, 0) AS input_tokens,
            COALESCE(u.output_tokens, 0) AS output_tokens,
            COALESCE(u.coste_usd, 0) AS coste_usd,
            m.contenido AS ultimo_contenido,
            m.rol AS ultimo_rol,
            m.creado_en AS ultimo_creado_en
     FROM ia_conversaciones c
     LEFT JOIN (
       SELECT conversacion_id,
              SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(coste_usd) AS coste_usd
       FROM ia_uso
       WHERE conversacion_id IS NOT NULL
       GROUP BY conversacion_id
     ) u ON u.conversacion_id = c.id
     LEFT JOIN ia_mensajes m ON m.id = (
       SELECT m2.id FROM ia_mensajes m2
       WHERE m2.conversacion_id = c.id
       ORDER BY m2.creado_en DESC
       LIMIT 1
     )
     WHERE c.usuario_id = ?
     ORDER BY c.actualizado_en DESC`,
    [usuarioId],
  );

  return rows.map((r) => {
    const contenido = r.ultimo_contenido ?? "";
    const excerpt =
      contenido.length > 160 ? `${contenido.slice(0, 157)}…` : contenido;
    return {
      id: r.id,
      titulo: r.titulo,
      creadoEn: iso(r.creado_en),
      actualizadoEn: iso(r.actualizado_en),
      inputTokens: num(r.input_tokens),
      outputTokens: num(r.output_tokens),
      costeUsd: num(r.coste_usd),
      ultimoMensaje:
        r.ultimo_rol && r.ultimo_creado_en
          ? {
              excerpt,
              rol: r.ultimo_rol,
              creadoEn: iso(r.ultimo_creado_en),
            }
          : null,
    };
  });
}

/** Todos los chats IA con métricas (admin). Orden: más recientes primero. */
export async function listarEstadisticasChatsAdmin(opts?: {
  usuarioId?: string | null;
}): Promise<EstadisticaChatAdmin[]> {
  const pool = await getPool();
  const usuarioId = opts?.usuarioId?.trim() || null;
  const [rows] = await pool.execute<EstadisticaChatRow[]>(
    `SELECT c.id, c.titulo, c.usuario_id, c.creado_en, c.actualizado_en,
            u.nombre AS usuario_nombre, u.correo AS usuario_correo,
            COALESCE(uso.llamadas, 0) AS llamadas,
            COALESCE(msg.mensajes, 0) AS mensajes,
            COALESCE(uso.input_tokens, 0) AS input_tokens,
            COALESCE(uso.output_tokens, 0) AS output_tokens,
            COALESCE(uso.coste_usd, 0) AS coste_usd
     FROM ia_conversaciones c
     INNER JOIN usuarios u ON u.id = c.usuario_id
     LEFT JOIN (
       SELECT conversacion_id,
              COUNT(*) AS llamadas,
              SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(coste_usd) AS coste_usd
       FROM ia_uso
       WHERE conversacion_id IS NOT NULL
       GROUP BY conversacion_id
     ) uso ON uso.conversacion_id = c.id
     LEFT JOIN (
       SELECT conversacion_id, COUNT(*) AS mensajes
       FROM ia_mensajes
       WHERE rol IN ('user', 'assistant')
       GROUP BY conversacion_id
     ) msg ON msg.conversacion_id = c.id
     ${usuarioId ? "WHERE c.usuario_id = ?" : ""}
     ORDER BY c.actualizado_en DESC`,
    usuarioId ? [usuarioId] : [],
  );

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    usuarioId: r.usuario_id,
    usuarioNombre: r.usuario_nombre,
    usuarioCorreo: r.usuario_correo,
    creadoEn: iso(r.creado_en),
    actualizadoEn: iso(r.actualizado_en),
    llamadas: num(r.llamadas),
    mensajes: num(r.mensajes),
    inputTokens: num(r.input_tokens),
    outputTokens: num(r.output_tokens),
    costeUsd: num(r.coste_usd),
  }));
}

export async function registrarAcceso(usuarioId: string): Promise<void> {
  const pool = await getPool();
  await pool.execute<ResultSetHeader>(
    `UPDATE usuarios SET ultimo_acceso_en = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [usuarioId],
  );
}
